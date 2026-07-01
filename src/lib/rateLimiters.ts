import { RateLimiter, getClientIp } from "./rateLimit";

export { getClientIp };

/**
 * Pre-configured rate limiters for sensitive API endpoints.
 * These are singletons — one instance per endpoint, shared across requests.
 */

/** /api/keys/verify — prevents API key brute-force. */
export const keyVerifyLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 5,
});

/** /api/camera/proxy — prevents SSRF abuse. */
export const cameraProxyLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
});

/** /api/marketplace/install-redirect — prevents install spam. */
export const installLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
});

/** /api/marketplace/grant-token — prevents JWT generation spam. */
export const grantTokenLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 5,
});

/** /api/marketplace/status, install, uninstall — general marketplace API. */
export const marketplaceApiLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
});

// TODO: move mcpLimiter and apiKeyManagementLimiter to @upstash/ratelimit for
// multi-replica deployments — in-process limiters are per-replica and do not
// share state across horizontal scale-out.

/**
 * GET /api/globe/commands — browser poll at ~1500ms across a small number of tabs.
 * 120 req/60s per IP comfortably covers several simultaneous tabs with headroom.
 */
export const globeCommandsLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 120,
});

/**
 * GET /api/globe/commands/stream -- SSE push transport (Phase 19b).
 * SSE is a long-lived connection, not a burst. One connection per tab per session.
 * 10 req/60s per IP: covers normal tab open/reconnect cycles with headroom.
 */
export const globeCommandsStreamLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
});

/** /api/mcp — prevents scan/DoS before the expensive auth layer runs. */
export const mcpLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
});

/** /api/api-keys GET/POST/DELETE — prevents enumeration and creation spam. */
export const apiKeyManagementLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
});

/**
 * GET /api/mcp/invocations -- browser bridge polls for pending tool invocations.
 * 120 req/60s per IP mirrors globeCommandsLimiter (several tabs at ~1500ms).
 */
export const mcpInvocationsLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 120,
});

/**
 * POST /api/mcp/results -- browser bridge posts tool execution results.
 * 60 req/60s per IP: one result per invocation, invocations are bounded.
 */
export const mcpResultsLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
});
