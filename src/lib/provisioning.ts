import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { generateSetupToken } from "@/lib/setup-token";

/**
 * Account provisioning for the globe app.
 *
 * The hub calls this when a new user signs up for cloud, and it can deliver the
 * same account more than once. Provisioning is therefore all-or-nothing and
 * idempotent: every delivery either commits user + credential account +
 * workspace + owner membership + setup token together, or leaves no row behind,
 * and repeated deliveries converge on exactly one workspace.
 */

/** Interactive-transaction client handed to the `$transaction` callback. */
type ProvisioningTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** A fully provisioned account. */
export interface ProvisionedAccount {
    userId: string;
    organizationId: string;
    rawToken: string;
}

/**
 * The transaction could not be committed (it timed out or lost a write conflict).
 * Nothing was committed, so the delivery can safely be retried.
 */
export class ProvisioningContentionError extends Error {
    readonly reason: unknown;

    constructor(reason: unknown) {
        super("Provisioning transaction could not be committed");
        this.name = "ProvisioningContentionError";
        this.reason = reason;
    }
}

/**
 * Interactive transactions default to a 2s wait and a 5s timeout. Concurrent
 * deliveries of the same account contend on `user.email` and then on the user row
 * lock, so give each attempt more headroom than the default before killing it.
 */
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/** How many times a contended attempt is retried before giving up. */
const MAX_ATTEMPTS = 3;

/** P2002 — a unique constraint rejected the row. */
function isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error
        && (error as { code: string }).code === "P2002";
}

/** P2028/P2034 — the transaction was closed, timed out, or lost a write conflict. */
function isTransactionConflict(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("code" in error)) return false;
    const code = (error as { code: string }).code;
    return code === "P2028" || code === "P2034";
}

function slugBase(email: string): string {
    return email.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * First free workspace slug for this email.
 *
 * The lookup is advisory: two concurrent attempts can both see the same slug as
 * free and `organization_slug_key` then rejects the loser, which retries and finds
 * the winner's row, because the winner committed before the rejection surfaced.
 */
async function nextAvailableSlug(tx: ProvisioningTx, email: string): Promise<string> {
    const slug = slugBase(email);
    let candidate = slug;
    let attempt = 0;
    while (await tx.pluginOrganization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
        attempt++;
        candidate = `${slug}-${attempt}`;
    }
    return candidate;
}

/**
 * Guarantee the credential account row for an already-existing user.
 *
 * Provisioning can be interrupted after the user row is committed, which leaves
 * the account without a credential login; setup would then fail at activation.
 */
async function ensureCredentialAccount(
    tx: ProvisioningTx,
    userId: string,
    email: string,
    hashedPlaceholder: string,
): Promise<void> {
    const existing = await tx.betterAuthAccount.findFirst({
        where: { userId, providerId: "credential" },
        select: { id: true },
    });
    if (existing) return;

    await tx.betterAuthAccount.create({
        data: {
            userId,
            accountId: email,
            providerId: "credential",
            password: hashedPlaceholder,
        },
    });
}

type CreationOutcome =
    | { kind: "created"; account: ProvisionedAccount }
    | { kind: "contended"; userId: string };

/**
 * Create the user, credential account, workspace, owner membership and setup
 * token as one unit.
 *
 * Either every row lands or none does. Without that, an interrupted delivery
 * commits a user with no workspace and every later retry reports success while
 * handing out a setup token with a null organization.
 *
 * A unique violation is not necessarily fatal: it is how a concurrent delivery of
 * the same account announces itself. The user row is re-read to tell the two
 * collisions apart, and only a slug collision (user absent) is retried.
 */
async function createProvisionedAccount(email: string, name: string): Promise<CreationOutcome> {
    const hashedPlaceholder = await hashPassword(crypto.randomBytes(32).toString("hex"));
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            const account = await prisma.$transaction(async (tx) => {
                const user = await tx.betterAuthUser.create({
                    data: {
                        name,
                        email,
                        emailVerified: false,
                        role: "user",
                    },
                });

                await ensureCredentialAccount(tx, user.id, email, hashedPlaceholder);

                const slug = await nextAvailableSlug(tx, email);
                const org = await tx.pluginOrganization.create({
                    data: {
                        name: `${name}'s Workspace`,
                        slug,
                    },
                });

                await tx.pluginMember.create({
                    data: {
                        organizationId: org.id,
                        userId: user.id,
                        role: "owner",
                    },
                });

                const { rawToken } = await generateSetupToken(user.id, org.id, tx);

                return { userId: user.id, organizationId: org.id, rawToken };
            }, TRANSACTION_OPTIONS);

            return { kind: "created", account };
        } catch (error) {
            lastError = error;
            if (isTransactionConflict(error)) throw new ProvisioningContentionError(error);
            if (!isUniqueViolation(error)) throw error;

            const winner = await prisma.betterAuthUser.findUnique({
                where: { email },
                select: { id: true },
            });
            if (winner) return { kind: "contended", userId: winner.id };
        }
    }

    throw lastError ?? new Error("Provisioning attempts exhausted");
}

/**
 * Complete provisioning for a user row that already exists.
 *
 * A user can exist with no organization or no membership when an earlier delivery
 * committed the user row and then failed, so this repairs that state instead of
 * returning a setup token whose organization is null — a token that leaves the
 * account unusable and that no retry can recover, because the retry takes this
 * same branch.
 *
 * Returns null when the user row is gone by the time it is locked.
 */
async function completeExistingProvisioning(email: string, name: string): Promise<ProvisionedAccount | null> {
    const hashedPlaceholder = await hashPassword(crypto.randomBytes(32).toString("hex"));
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                // Hold the account row for the rest of the transaction. Retries for the
                // same user queue here, which is what stops two of them from each
                // creating their own workspace: the guard that duplicates cannot slip
                // past the create path (`user_email_key`) does not apply once the user
                // row is already committed.
                const locked = await tx.$queryRaw<{ id: string }[]>`
                    SELECT id FROM "user" WHERE email = ${email} FOR UPDATE
                `;
                if (locked.length === 0) return null;
                const userId = locked[0].id;

                const memberships = await tx.pluginMember.findMany({
                    where: { userId },
                    orderBy: { createdAt: "asc" },
                    select: { organizationId: true },
                });

                // `member` carries no foreign key to `organization`, so a membership can
                // outlive the workspace it points at. Such a row is not a provisioned
                // account and must not be handed a setup token.
                let organizationId: string | null = null;
                if (memberships.length > 0) {
                    const liveOrganizations = await tx.pluginOrganization.findMany({
                        where: { id: { in: memberships.map((row) => row.organizationId) } },
                        select: { id: true },
                    });
                    const live = new Set(liveOrganizations.map((row) => row.id));
                    organizationId = memberships.find((row) => live.has(row.organizationId))?.organizationId ?? null;
                }

                if (!organizationId) {
                    const slug = await nextAvailableSlug(tx, email);
                    const org = await tx.pluginOrganization.create({
                        data: {
                            name: `${name}'s Workspace`,
                            slug,
                        },
                    });
                    await tx.pluginMember.create({
                        data: {
                            organizationId: org.id,
                            userId,
                            role: "owner",
                        },
                    });
                    organizationId = org.id;
                }

                await ensureCredentialAccount(tx, userId, email, hashedPlaceholder);
                const { rawToken } = await generateSetupToken(userId, organizationId, tx);

                return { userId, organizationId, rawToken };
            }, TRANSACTION_OPTIONS);
        } catch (error) {
            lastError = error;
            if (isTransactionConflict(error)) throw new ProvisioningContentionError(error);
            if (!isUniqueViolation(error)) throw error;
            // A concurrent repair committed the membership or took the slug first; a
            // fresh transaction now sees those rows and converges on them.
        }
    }

    throw lastError ?? new Error("Provisioning attempts exhausted");
}

/**
 * Provision the account for `email`, or repair it when it already exists.
 *
 * Returns the provisioned account with a fresh setup token, or null when the
 * account could not be completed (never a token without a workspace).
 *
 * @throws ProvisioningContentionError when the transaction was abandoned; nothing
 * was committed, so the caller can retry the delivery.
 */
export async function provisionAccount(email: string, name: string): Promise<ProvisionedAccount | null> {
    const existingUser = await prisma.betterAuthUser.findUnique({
        where: { email },
        select: { id: true },
    });

    if (existingUser) {
        // The user exists, but the workspace or the membership may not: earlier
        // deliveries could commit the user row and then fail. Repair that state
        // rather than handing out a setup token for an account that has no
        // organization to activate against.
        return completeExistingProvisioning(email, name);
    }

    const outcome = await createProvisionedAccount(email, name);
    return outcome.kind === "created"
        ? outcome.account
        : completeExistingProvisioning(email, name);
}
