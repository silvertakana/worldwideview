import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * In-memory stand-in for the Postgres store behind `prisma`.
 *
 * It enforces the real unique constraints that matter here (`user.email`,
 * `organization.slug`, `account(providerId, accountId)`,
 * `member(organizationId, userId)`), models interactive transactions with an
 * undo log (so a rollback restores exactly the rows that transaction wrote),
 * and models `SELECT ... FOR UPDATE` with a per-row lock queue.
 *
 * It also carries two deliberate fault injectors so the failure modes the
 * provision route has to survive can be reproduced deterministically.
 */
const provisionDb = vi.hoisted(() => {
    interface UserRow {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        role: string;
    }

    interface AccountRow {
        id: string;
        userId: string;
        accountId: string;
        providerId: string;
        password: string | null;
    }

    interface OrganizationRow {
        id: string;
        name: string;
        slug: string;
    }

    interface MemberRow {
        id: string;
        organizationId: string;
        userId: string;
        role: string;
        createdAt: Date;
    }

    interface SetupTokenRow {
        id: string;
        tokenHash: string;
        userId: string;
        organizationId: string | null;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
    }

    interface Store {
        users: UserRow[];
        accounts: AccountRow[];
        organizations: OrganizationRow[];
        members: MemberRow[];
        setupTokens: SetupTokenRow[];
    }

    type UndoLog = (() => void)[];

    const emptyStore = (): Store => ({
        users: [],
        accounts: [],
        organizations: [],
        members: [],
        setupTokens: [],
    });

    let store: Store = emptyStore();
    let sequence = 0;

    // Fault injection: absolute ordinal (1-based) of the organization insert that fails.
    let failingOrganizationInsert = 0;
    let organizationInserts = 0;
    // Fault injection: the next user insert for this email loses to a rival delivery.
    let rivalWinnerEmail: string | null = null;

    // Row locks: models `SELECT ... FOR UPDATE` on the user row. Waiters are released
    // when the holding transaction commits or rolls back.
    const lockQueue = new Map<string, Promise<void>>();
    const lockReleases = new Map<string, () => void>();

    // Fault injection: the next transaction rolls back after writing, as a lost write conflict does.
    let failingTransactionCommit: string | null = null;

    const nextId = (prefix: string): string => `${prefix}-${++sequence}`;

    function uniqueViolation(constraint: string): Error {
        return Object.assign(new Error(`Unique constraint failed on the fields: (${constraint})`), {
            code: "P2002",
            meta: { target: constraint.split(",") },
        });
    }

    async function lockUserRow(email: string, transactionId: string): Promise<{ id: string }[]> {
        const preceding = lockQueue.get(email) ?? Promise.resolve();
        let release: () => void = () => { };
        const held = new Promise<void>((resolve) => { release = resolve; });
        lockQueue.set(email, preceding.then(() => held));
        await preceding;
        lockReleases.set(transactionId, release);
        return store.users.filter((user) => user.email === email).map((user) => ({ id: user.id }));
    }

    function releaseLocks(transactionId: string): void {
        const release = lockReleases.get(transactionId);
        if (!release) return;
        lockReleases.delete(transactionId);
        release();
    }

    function createDelegates(log: UndoLog | null) {
        const track = (undo: () => void): void => {
            log?.push(undo);
        };

        return {
            betterAuthUser: {
                async findUnique(args: { where: { email: string } }): Promise<UserRow | null> {
                    return store.users.find((user) => user.email === args.where.email) ?? null;
                },
                async create(args: { data: Omit<UserRow, "id"> }): Promise<UserRow> {
                    if (rivalWinnerEmail !== null && args.data.email === rivalWinnerEmail) {
                        // A rival delivery committed this account first. That commit is not
                        // part of our transaction, so it must survive our rollback.
                        rivalWinnerEmail = null;
                        store.users.push({ id: nextId("user"), ...args.data });
                        throw uniqueViolation("email");
                    }
                    if (store.users.some((user) => user.email === args.data.email)) {
                        throw uniqueViolation("email");
                    }
                    const user: UserRow = { id: nextId("user"), ...args.data };
                    store.users.push(user);
                    track(() => { store.users = store.users.filter((row) => row !== user); });
                    return user;
                },
            },
            betterAuthAccount: {
                async findFirst(args: { where: { userId: string; providerId: string } }): Promise<AccountRow | null> {
                    return store.accounts.find((account) =>
                        account.userId === args.where.userId && account.providerId === args.where.providerId) ?? null;
                },
                async create(args: { data: Omit<AccountRow, "id"> }): Promise<AccountRow> {
                    if (store.accounts.some((account) =>
                        account.providerId === args.data.providerId && account.accountId === args.data.accountId)) {
                        throw uniqueViolation("providerId,accountId");
                    }
                    const account: AccountRow = { id: nextId("account"), ...args.data };
                    store.accounts.push(account);
                    track(() => { store.accounts = store.accounts.filter((row) => row !== account); });
                    return account;
                },
            },
            pluginOrganization: {
                async findUnique(args: { where: { slug: string } }): Promise<OrganizationRow | null> {
                    return store.organizations.find((organization) => organization.slug === args.where.slug) ?? null;
                },
                async findMany(args: { where: { id: { in: string[] } } }): Promise<OrganizationRow[]> {
                    return store.organizations.filter((organization) => args.where.id.in.includes(organization.id));
                },
                async create(args: { data: Omit<OrganizationRow, "id"> }): Promise<OrganizationRow> {
                    organizationInserts += 1;
                    if (organizationInserts === failingOrganizationInsert) {
                        throw new Error("simulated organization insert failure");
                    }
                    if (store.organizations.some((organization) => organization.slug === args.data.slug)) {
                        throw uniqueViolation("slug");
                    }
                    const organization: OrganizationRow = { id: nextId("org"), ...args.data };
                    store.organizations.push(organization);
                    track(() => { store.organizations = store.organizations.filter((row) => row !== organization); });
                    return organization;
                },
            },
            pluginMember: {
                async findMany(args: { where: { userId: string } }): Promise<MemberRow[]> {
                    return store.members
                        .filter((member) => member.userId === args.where.userId)
                        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
                },
                async findFirst(args: { where: { userId: string; role?: string } }): Promise<MemberRow | null> {
                    return [...store.members]
                        .filter((member) =>
                            member.userId === args.where.userId
                            && (args.where.role === undefined || member.role === args.where.role))
                        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0] ?? null;
                },
                async create(args: { data: Omit<MemberRow, "id" | "createdAt"> }): Promise<MemberRow> {
                    if (store.members.some((member) =>
                        member.organizationId === args.data.organizationId && member.userId === args.data.userId)) {
                        throw uniqueViolation("organizationId,userId");
                    }
                    const member: MemberRow = { id: nextId("member"), createdAt: new Date(), ...args.data };
                    store.members.push(member);
                    track(() => { store.members = store.members.filter((row) => row !== member); });
                    return member;
                },
            },
            setupToken: {
                async create(args: { data: Omit<SetupTokenRow, "id" | "usedAt" | "createdAt"> }): Promise<SetupTokenRow> {
                    const token: SetupTokenRow = { id: nextId("token"), usedAt: null, createdAt: new Date(), ...args.data };
                    store.setupTokens.push(token);
                    track(() => { store.setupTokens = store.setupTokens.filter((row) => row !== token); });
                    return token;
                },
            },
        };
    }

    const root = createDelegates(null);

    function makeTransactionClient(transactionId: string, log: UndoLog) {
        return {
            ...createDelegates(log),
            async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<{ id: string }[]> {
                const sql = Array.from(strings).join("?");
                if (!/for update/i.test(sql)) throw new Error(`Unsupported raw query: ${sql}`);
                return lockUserRow(String(values[0] ?? "").toLowerCase(), transactionId);
            },
        };
    }

    type TransactionClient = ReturnType<typeof makeTransactionClient>;

    async function $transaction(callback: (tx: TransactionClient) => Promise<unknown>): Promise<unknown> {
        const transactionId = nextId("tx");
        const log: UndoLog = [];
        try {
            const result = await callback(makeTransactionClient(transactionId, log));
            if (failingTransactionCommit !== null) {
                const code = failingTransactionCommit;
                failingTransactionCommit = null;
                throw Object.assign(new Error(`Transaction failed to commit: ${code}`), { code });
            }
            return result;
        } catch (error) {
            for (const undo of log.reverse()) undo();
            throw error;
        } finally {
            releaseLocks(transactionId);
        }
    }

    function seedUser(email: string, name: string): UserRow {
        const user: UserRow = { id: nextId("user"), name, email, emailVerified: false, role: "user" };
        store.users.push(user);
        return user;
    }

    function seedProvisionedAccount(email: string, name: string): { user: UserRow; organization: OrganizationRow } {
        const user = seedUser(email, name);
        store.accounts.push({
            id: nextId("account"),
            userId: user.id,
            accountId: email,
            providerId: "credential",
            password: "existing-hash",
        });
        const organization: OrganizationRow = { id: nextId("org"), name: `${name}'s Workspace`, slug: email.split("@")[0] };
        store.organizations.push(organization);
        store.members.push({
            id: nextId("member"),
            organizationId: organization.id,
            userId: user.id,
            role: "owner",
            createdAt: new Date(),
        });
        return { user, organization };
    }

    /** A membership row whose organization no longer exists (`member` has no FK). */
    function seedDanglingMembership(email: string, name: string): UserRow {
        const user = seedUser(email, name);
        store.members.push({
            id: nextId("member"),
            organizationId: nextId("org"),
            userId: user.id,
            role: "owner",
            createdAt: new Date(),
        });
        return user;
    }

    return {
        prisma: { ...root, $transaction },
        reset(): void {
            store = emptyStore();
            sequence = 0;
            organizationInserts = 0;
            failingOrganizationInsert = 0;
            rivalWinnerEmail = null;
            lockQueue.clear();
            lockReleases.clear();
        },
        failOrganizationInsert(ordinal: number): void {
            failingOrganizationInsert = ordinal;
        },
        loseUserInsertToRival(email: string): void {
            rivalWinnerEmail = email;
        },
        failTransactionCommit(code: string): void {
            failingTransactionCommit = code;
        },
        seedUser,
        seedProvisionedAccount,
        seedDanglingMembership,
        state(): Store {
            return structuredClone(store);
        },
    };
});

vi.mock("@/lib/db", () => ({ prisma: provisionDb.prisma }));

vi.mock("@/lib/cross-service/verify", () => ({
    verifyCrossServiceSignature: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock("better-auth/crypto", () => ({
    hashPassword: vi.fn(async () => "hashed-placeholder-password"),
}));

import { POST } from "./route";

interface AttemptResult {
    ok: boolean;
    status: number;
    body: { setupToken?: string; setupUrl?: string; error?: string; code?: string };
    error?: unknown;
}

async function attemptProvision(email: string, name = "Test User"): Promise<AttemptResult> {
    const request = new NextRequest("http://localhost:3000/api/provision", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "X-Service-Signature": "t=1234567890,n=test-nonce,sig=valid",
        },
        body: JSON.stringify({ email, name, hubUserId: "hub-user-1" }),
    });

    try {
        const response = await POST(request);
        return { ok: true, status: response.status, body: await response.json() };
    } catch (error) {
        return { ok: false, status: 0, body: {}, error };
    }
}

beforeEach(() => {
    provisionDb.reset();
});

describe("POST /api/provision", () => {
    it("leaves no partial account behind when a later insert fails, so a retry can provision fully", async () => {
        provisionDb.failOrganizationInsert(1);

        const first = await attemptProvision("partial@example.com");
        expect(first.ok).toBe(false);

        // A half-provisioned account (user without organization/membership) is the
        // broken state that must never be committed.
        const afterFailure = provisionDb.state();
        expect(afterFailure.users).toHaveLength(0);
        expect(afterFailure.accounts).toHaveLength(0);

        const retry = await attemptProvision("partial@example.com");
        expect(retry.status).toBe(200);
        expect(retry.body.setupToken).toBeTruthy();
        expect(retry.body.setupUrl).toContain("/setup?token=");

        const state = provisionDb.state();
        expect(state.users).toHaveLength(1);
        expect(state.accounts).toHaveLength(1);
        expect(state.organizations).toHaveLength(1);
        expect(state.members).toHaveLength(1);
        expect(state.members[0].role).toBe("owner");
        expect(state.setupTokens).toHaveLength(1);
        expect(state.setupTokens[0].organizationId).toBe(state.organizations[0].id);
    });

    it("repairs an existing user that has no organization or membership", async () => {
        const user = provisionDb.seedUser("orphan@example.com", "Orphan User");

        const result = await attemptProvision("orphan@example.com", "Orphan User");

        expect(result.status).toBe(200);
        expect(result.body.setupToken).toBeTruthy();

        const state = provisionDb.state();
        expect(state.users).toHaveLength(1);
        expect(state.accounts).toHaveLength(1);
        expect(state.accounts[0]).toMatchObject({ userId: user.id, providerId: "credential", accountId: "orphan@example.com" });
        expect(state.organizations).toHaveLength(1);
        expect(state.members).toHaveLength(1);
        expect(state.members[0]).toMatchObject({ userId: user.id, role: "owner" });

        // The setup token must point at the repaired organization, never at null.
        expect(state.setupTokens).toHaveLength(1);
        expect(state.setupTokens[0].organizationId).toBe(state.organizations[0].id);
        expect(state.setupTokens[0].userId).toBe(user.id);
    });

    it("repairs a user whose membership points at a workspace that no longer exists", async () => {
        const user = provisionDb.seedDanglingMembership("dangling@example.com", "Dangling User");

        const result = await attemptProvision("dangling@example.com", "Dangling User");

        expect(result.status).toBe(200);
        expect(result.body.setupToken).toBeTruthy();

        const state = provisionDb.state();
        expect(state.organizations).toHaveLength(1);
        const organization = state.organizations[0];
        expect(state.accounts).toHaveLength(1);
        expect(state.members.map((member) => member.organizationId)).toContain(organization.id);
        expect(state.setupTokens).toHaveLength(1);
        expect(state.setupTokens[0]).toMatchObject({ userId: user.id, organizationId: organization.id });
    });

    it("reports a retryable failure and rolls back completely when the transaction cannot commit", async () => {
        provisionDb.failTransactionCommit("P2034");

        const result = await attemptProvision("conflict@example.com");

        expect(result.status).toBe(503);
        expect(result.body.code).toBe("PROVISION_CONTENTION");

        const state = provisionDb.state();
        expect(state.users).toHaveLength(0);
        expect(state.accounts).toHaveLength(0);
        expect(state.organizations).toHaveLength(0);
        expect(state.members).toHaveLength(0);
        expect(state.setupTokens).toHaveLength(0);

        const retry = await attemptProvision("conflict@example.com");
        expect(retry.status).toBe(200);
        expect(provisionDb.state().organizations).toHaveLength(1);
    });

    it("adopts the committed account when it loses the insert race to a rival delivery", async () => {
        provisionDb.loseUserInsertToRival("raced@example.com");

        const result = await attemptProvision("raced@example.com");

        expect(result.status).toBe(200);
        expect(result.body.setupToken).toBeTruthy();

        const state = provisionDb.state();
        expect(state.users).toHaveLength(1);
        expect(state.organizations).toHaveLength(1);
        expect(state.members).toHaveLength(1);
        expect(state.members[0].userId).toBe(state.users[0].id);
        expect(state.setupTokens).toHaveLength(1);
        expect(state.setupTokens[0].organizationId).toBe(state.organizations[0].id);
    });

    it("keeps an already provisioned account unchanged", async () => {
        const { user, organization } = provisionDb.seedProvisionedAccount("ready@example.com", "Ready User");

        const result = await attemptProvision("ready@example.com", "Ready User");

        expect(result.status).toBe(200);
        expect(result.body.setupToken).toBeTruthy();

        const state = provisionDb.state();
        expect(state.users).toHaveLength(1);
        expect(state.accounts).toHaveLength(1);
        expect(state.organizations).toHaveLength(1);
        expect(state.members).toHaveLength(1);
        expect(state.members[0].organizationId).toBe(organization.id);
        expect(state.setupTokens).toHaveLength(1);
        expect(state.setupTokens[0]).toMatchObject({ userId: user.id, organizationId: organization.id });
    });

    it("converges on a single workspace when retries arrive concurrently", async () => {
        provisionDb.seedUser("burst@example.com", "Burst User");

        const results = await Promise.all([
            attemptProvision("burst@example.com", "Burst User"),
            attemptProvision("burst@example.com", "Burst User"),
            attemptProvision("burst@example.com", "Burst User"),
        ]);

        for (const result of results) {
            expect(result.status).toBe(200);
            expect(result.body.setupToken).toBeTruthy();
        }

        const state = provisionDb.state();
        expect(state.organizations).toHaveLength(1);
        expect(state.members).toHaveLength(1);
        expect(state.accounts).toHaveLength(1);
        expect(new Set(state.setupTokens.map((token) => token.organizationId)).size).toBe(1);
    });
});
