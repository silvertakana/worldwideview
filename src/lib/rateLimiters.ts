import { RateLimiter } from "./rateLimit";

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

/** /api/auth/[...nextauth] — prevents credential brute-force. */
export const authLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
});
