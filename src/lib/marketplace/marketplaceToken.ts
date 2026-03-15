import { SignJWT, jwtVerify } from "jose";

const SCOPE = "marketplace";
const EXPIRY = "30d";

function getSecret(): Uint8Array {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is not set");
    return new TextEncoder().encode(secret);
}

/**
 * Issue a short-lived JWT scoped to marketplace API access.
 * Signed with AUTH_SECRET — no database required.
 */
export async function issueMarketplaceToken(): Promise<string> {
    return new SignJWT({ scope: SCOPE })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(EXPIRY)
        .sign(getSecret());
}

export interface MarketplaceTokenPayload {
    scope: string;
    iat: number;
    exp: number;
}

/**
 * Verify a marketplace JWT. Throws if invalid, expired, or wrong scope.
 */
export async function verifyMarketplaceToken(
    token: string,
): Promise<MarketplaceTokenPayload> {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.scope !== SCOPE) {
        throw new Error("Token scope mismatch");
    }
    return payload as unknown as MarketplaceTokenPayload;
}
