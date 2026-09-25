/**
 * @file instanceUrl.ts
 *
 * Absolute base URL of an instance's own pages.
 *
 * A cloud instance is reachable at `<subdomain>.<tenant domain>` -- the address an
 * operator actually browses, and the one the shared container resolves a tenant
 * from. `NEXT_PUBLIC_APP_URL` names a single host, which on that container is no
 * tenant's address at all, so it is only the fallback for deployments that
 * genuinely pin one host (self-hosted, local). A proxy-reported host comes next,
 * and the request's own origin last, so a setup link is never handed back as a
 * bare relative path.
 */

export interface InstanceBaseUrlOptions {
    /** Workspace subdomain, when the response has one. */
    subdomain?: string | null;
    /** `x-forwarded-host` as sent by the reverse proxy, when present. */
    forwardedHost?: string | null;
    /** `x-forwarded-proto` as sent by the reverse proxy, when present. */
    forwardedProto?: string | null;
    /** The incoming request URL, used as the last-resort origin. */
    requestUrl?: string | null;
}

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/i;

/** First value of a possibly comma-separated header, lowercased, without scheme or slash. */
function normalizeHost(value: string | null | undefined): string {
    if (!value) return "";
    const first = value.split(",")[0] ?? "";
    return first.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^\.+/, "").replace(/\/+$/, "");
}

/** A configured base URL, given a scheme when the operator omitted one. */
function normalizeBaseUrl(value: string | null | undefined): string {
    if (!value) return "";
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** http only for a loopback host, so a local dev server is not addressed over TLS. */
function schemeFor(host: string): string {
    return LOOPBACK_HOST.test(host) ? "http" : "https";
}

function originFromUrl(value: string | null | undefined): string {
    if (!value) return "";
    try {
        return new URL(value).host;
    } catch {
        return "";
    }
}

export function resolveInstanceBaseUrl(options: InstanceBaseUrlOptions = {}): string {
    const subdomain = (options.subdomain ?? "").trim().toLowerCase();
    const tenantDomain = normalizeHost(process.env.NEXT_PUBLIC_WWV_TENANT_DOMAIN);
    if (subdomain && tenantDomain) {
        return `${schemeFor(tenantDomain)}://${subdomain}.${tenantDomain}`;
    }

    const configured = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (configured) return configured;

    const forwardedHost = normalizeHost(options.forwardedHost);
    if (forwardedHost) {
        const reported = (options.forwardedProto ?? "").split(",")[0]?.trim().toLowerCase();
        const proto = reported === "http" || reported === "https" ? reported : schemeFor(forwardedHost);
        return `${proto}://${forwardedHost}`;
    }

    const requestHost = normalizeHost(originFromUrl(options.requestUrl));
    if (requestHost) return `${schemeFor(requestHost)}://${requestHost}`;

    return "";
}
