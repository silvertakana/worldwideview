import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import type { MarketplaceSessionToken } from "@worldwideview/wwv-plugin-sdk";

const SCOPE = "marketplace";
const ISSUER = "worldwideview";
const AUDIENCE = "worldwideview-marketplace";
const EXPIRY = "4h";

// Simple in-memory revocation list for JWT tokens (resets on restart)
// In a distributed setup, this should be backed by Redis.
const revokedJtis = new Set<string>();

function getSecret(): Uint8Array {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
    return new TextEncoder().encode(secret);
}

/**
 * Issue a marketplace session JWT scoped to API access, bound to a specific user.
 * Signed with BETTER_AUTH_SECRET — no database required.
 * Returns a branded MarketplaceSessionToken to prevent accidental use as a WebSocket credential.
 */
export async function issueMarketplaceToken(userId: string): Promise<MarketplaceSessionToken> {
    return new SignJWT({ scope: SCOPE })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime(EXPIRY)
        .sign(getSecret()) as Promise<MarketplaceSessionToken>;
}

export interface MarketplaceTokenPayload {
    scope: string;
    sub: string;
    iss: string;
    aud: string;
    iat: number;
    exp: number;
    jti?: string;
}

/**
 * Revoke a specific marketplace JWT by its JTI claim.
 */
export function revokeMarketplaceToken(jti: string): void {
    if (jti) revokedJtis.add(jti);
}

/**
 * Verify a marketplace JWT. Throws if invalid, expired, wrong scope,
 * or missing required claims (sub, iss, aud).
 */
export async function verifyMarketplaceToken(
    token: string,
): Promise<MarketplaceTokenPayload> {
    const { payload } = await jwtVerify(token, getSecret(), {
        issuer: ISSUER,
        audience: AUDIENCE,
    });
    if (payload.scope !== SCOPE) {
        throw new Error("Token scope mismatch");
    }
    if (!payload.sub) {
        throw new Error("Token missing subject");
    }
    if (payload.jti && revokedJtis.has(payload.jti as string)) {
        throw new Error("Token has been revoked");
    }
    return payload as unknown as MarketplaceTokenPayload;
}
