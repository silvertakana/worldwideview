// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";

// Set a test secret before importing the module
beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long!!";
});

import { issueMarketplaceToken, verifyMarketplaceToken } from "./marketplaceToken";

describe("marketplaceToken", () => {
    describe("issueMarketplaceToken", () => {
        it("returns a non-empty JWT string", async () => {
            const token = await issueMarketplaceToken();
            expect(typeof token).toBe("string");
            expect(token.split(".")).toHaveLength(3); // header.payload.signature
        });
    });

    describe("verifyMarketplaceToken", () => {
        it("verifies a freshly issued token and returns scope", async () => {
            const token = await issueMarketplaceToken();
            const payload = await verifyMarketplaceToken(token);
            expect(payload.scope).toBe("marketplace");
        });

        it("throws on a tampered token", async () => {
            const token = await issueMarketplaceToken();
            const [h, p, s] = token.split(".");
            const tampered = `${h}.${p}x.${s}`;
            await expect(verifyMarketplaceToken(tampered)).rejects.toThrow();
        });

        it("throws on a token signed with a different secret", async () => {
            const token = await issueMarketplaceToken();
            process.env.NEXTAUTH_SECRET = "a-completely-different-secret-here!";
            await expect(verifyMarketplaceToken(token)).rejects.toThrow();
        });

        it("throws on a token with wrong scope", async () => {
            // Manually craft a token with wrong scope using the same secret
            const { SignJWT } = await import("jose");
            const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
            const wrongScopeToken = await new SignJWT({ scope: "admin" })
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt()
                .setExpirationTime("1d")
                .sign(secret);
            await expect(verifyMarketplaceToken(wrongScopeToken)).rejects.toThrow("scope");
        });
    });
});
