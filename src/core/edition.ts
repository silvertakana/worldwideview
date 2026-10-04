/**
 * Edition detection module.
 *
 * The edition is resolved from the environment at RUNTIME on the server,
 * so self-hosters can pull the prebuilt image and switch editions via a
 * runtime .env without rebuilding.
 *
 * Precedence (server-side, evaluated at request/module-load time):
 *   1. WWV_EDITION            — runtime env var (settable in a runtime .env)
 *   2. NEXT_PUBLIC_WWV_EDITION — build-time baked value (kept for the
 *                                docker-publish :latest/:cloud/:demo builds)
 *   3. "local"                — fallback when both are unset/invalid
 *
 * Client bundles still receive the NEXT_PUBLIC_ build-time bake; server
 * code should prefer `getEdition()` / `resolveServerEdition()` so runtime
 * overrides apply.
 */

// ---------------------------------------------------------------------------
// Edition type & constant
// ---------------------------------------------------------------------------

export type Edition = "local" | "cloud" | "demo";

const VALID_EDITIONS: ReadonlySet<string> = new Set<Edition>([
    "local",
    "cloud",
    "demo",
]);

/**
 * Resolve the current edition from the environment.
 * Falls back to `"local"` when the env var is unset or invalid.
 */
export function resolveEdition(raw?: string): Edition {
    const value = (raw ?? "").trim().toLowerCase();
    if (VALID_EDITIONS.has(value)) return value as Edition;
    return "local";
}

/**
 * Server-side runtime edition resolution.
 *
 * Reads `WWV_EDITION` first (runtime, settable via a runtime .env on the
 * prebuilt image), then falls back to the build-time baked
 * `NEXT_PUBLIC_WWV_EDITION`. Never inlined into client bundles — call this
 * only from server code (route handlers, middleware, instrumentation).
 */
export function resolveServerEdition(): Edition {
    const runtime = process.env.WWV_EDITION;
    if (runtime !== undefined && runtime.trim() !== "") {
        return resolveEdition(runtime);
    }
    return resolveEdition(process.env.NEXT_PUBLIC_WWV_EDITION);
}

/** Current deployment edition — determined once at module load. */
export const edition: Edition = resolveServerEdition();

/**
 * Fresh edition lookup for request-scoped server code.
 * Unlike the module-load `edition` constant, this re-reads the env on every
 * call, so tests (vi.stubEnv) and runtime .env overrides apply immediately.
 */
export function getEdition(): Edition {
    return resolveServerEdition();
}

// ---------------------------------------------------------------------------
// Boolean helpers
// ---------------------------------------------------------------------------

/** True when running as a self-hosted local instance. */
export const isLocal: boolean = edition === "local";

/** True when running as a managed cloud instance. */
export const isCloud: boolean = edition === "cloud";

/** True when running as the public demo instance. */
export const isDemo: boolean = edition === "demo";

// ---------------------------------------------------------------------------
// Secure-context detection (https)
// ---------------------------------------------------------------------------

/**
 * True when the deployment serves over https, derived from the configured auth
 * URL or a production NODE_ENV. This is the request-independent half of the
 * secure-context check: the NextAuth cookie WRITER (auth.ts) uses it to decide
 * the secure flag / __Secure- cookie prefix, and the edge proxy READER (proxy.ts)
 * ORs it with per-request X-Forwarded-Proto / protocol when reading the token.
 * Centralised here so the writer and reader can never disagree on which cookie
 * name is in play behind a TLS-terminating reverse proxy.
 */
export function isHttpsDeployment(): boolean {
    const authUrl = process.env.BETTER_AUTH_URL ?? process.env.AUTH_URL ?? "";
    return authUrl.startsWith("https://") || process.env.NODE_ENV === "production";
}

// ---------------------------------------------------------------------------
// Demo admin secret (must be before feature flags so they can reference it)
// ---------------------------------------------------------------------------

/**
 * Server-side secret used as the admin password on the demo edition.
 * Checks multiple env vars for backward compatibility with migration:
 *   `WWV_ADMIN_PASSWORD` (preferred) → `ADMIN_PASSWORD` → `WWV_DEMO_ADMIN_SECRET` (legacy).
 * Never use `NEXT_PUBLIC_` prefix.
 * When configured on demo, enables plugin management for the instance.
 */
const ADMIN_PASSWORD: string | undefined =
    (process.env.WWV_ADMIN_PASSWORD?.trim() ||
     process.env.ADMIN_PASSWORD?.trim() ||
     process.env.WWV_DEMO_ADMIN_SECRET?.trim()) || undefined;

/** True when demo edition has an admin secret configured. */
export const isDemoAdminConfigured: boolean = isDemo && !!ADMIN_PASSWORD;

// ---------------------------------------------------------------------------
// Feature flags (derived from edition)
// ---------------------------------------------------------------------------

/** Auth (login / registration) is available on local & cloud, not demo. */
export const isAuthEnabled: boolean = !isDemo;

/**
 * Plugin install/uninstall is enabled on local & cloud.
 * On demo, only enabled when the operator has configured an admin secret.
 */
export const isPluginInstallEnabled: boolean = !isDemo || isDemoAdminConfigured;

/** Settings are editable on local & cloud, read-only on demo. */
export const isSettingsEditable: boolean = !isDemo;

/**
 * History playback is available on local & cloud, not demo.
 * On demo the server uses shared credentials — storing and redistributing
 * OpenSky data to third-party users would breach the non-transferable clause.
 * On local/cloud each user supplies their own credentials, so they hold their
 * own licence relationship with OpenSky.
 */
export const isHistoryEnabled: boolean = !isDemo;

/**
 * Returns the demo admin secret for use by the auth provider.
 * Only returns a value on demo edition when the secret is configured.
 */
export function getDemoAdminSecret(): string | undefined {
    if (!isDemo) return undefined;
    return ADMIN_PASSWORD;
}

/** Demo admin session role constant. */
export const DEMO_ADMIN_ROLE = "demo-admin";

// ---------------------------------------------------------------------------
// Per-plugin ticket auth flag (ADR-001)
// ---------------------------------------------------------------------------

/**
 * Whether one plugin opted into ticket auth through the local override list.
 *
 * Controlled by NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS (comma-separated plugin IDs).
 *
 * @deprecated Cloud and demo instances authenticate by capability now, through
 * `ticketAuthRequired`. This list survives one release as the opt-in for a
 * local instance that points at an engine with auth on, and is then removed.
 */
export function ticketAuthEnabledForPlugin(pluginId: string): boolean {
    const list = process.env.NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS ?? "";
    return list.split(",").map((s) => s.trim()).filter(Boolean).includes(pluginId);
}

/**
 * Whether this instance must authenticate before it subscribes to an engine.
 *
 * Cloud and demo instances stream from a hosted engine that requires tickets, so
 * they always ask for one. A local (sovereign) instance runs its own engine and
 * usually has no marketplace account at all, so it asks only when the operator
 * opted a plugin in through the list above.
 *
 * The edition is read per call, so a runtime override applies without a rebuild.
 */
export function ticketAuthRequired(pluginIds: readonly string[]): boolean {
    const current = getEdition();
    if (current === "cloud" || current === "demo") return true;
    return pluginIds.some((id) => ticketAuthEnabledForPlugin(id));
}

/**
 * Whether this instance is expected to hold a marketplace credential at all.
 *
 * True for the editions that stream from a hosted engine. A local instance
 * without a credential is normal, not a fault, and must not be told otherwise.
 */
export function marketplaceCredentialRequired(): boolean {
    const current = getEdition();
    return current === "cloud" || current === "demo";
}

/**
 * Returns `true` when the session belongs to the demo admin user.
 * Accepts any session-like object (uses runtime narrowing to avoid
 * type conflicts with Auth.js `Session` which doesn't declare `role`).
 *
 * An operator with the standard `admin` role is the demo admin;
 * `demo-admin` is kept for legacy seeded accounts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDemoAdmin(session: any): boolean {
    if (!isDemo) return false;
    const role = session?.user?.role;
    return role === DEMO_ADMIN_ROLE || role === "admin";
}
