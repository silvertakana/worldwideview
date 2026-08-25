/**
 * Tests for the JWKS contract this instance publishes for the data engine.
 *
 * The data engine verifies plugin tickets against the JWKS served at
 * /api/ba/jwks (wwv-data-engine src/jwt-auth.ts uses createRemoteJWKSet with
 * JWKS_URL). These tests pin the globe-side contract: the jwt plugin must
 * register the JWKS + token endpoints and document the key-set response
 * shape the engine's resolver consumes.
 */
import { describe, it, expect } from "vitest";
import { jwtPlugin, JWT_PLUGIN_OPTIONS } from "./jwt-plugin";

describe("JWT plugin JWKS contract (/api/ba/jwks)", () => {
    it("registers the JWKS endpoint as a GET on /jwks", () => {
        const endpoint = jwtPlugin.endpoints.getJwks as unknown as {
            path: string;
            options: { method: string };
        };
        expect(endpoint.path).toBe("/jwks");
        expect(endpoint.options.method).toBe("GET");
    });

    it("registers the token endpoint as a GET on /token", () => {
        const endpoint = jwtPlugin.endpoints.getToken as unknown as {
            path: string;
            options: { method: string };
        };
        expect(endpoint.path).toBe("/token");
        expect(endpoint.options.method).toBe("GET");
    });

    it("maps JWKS storage to the pluginJwks model", () => {
        expect(JWT_PLUGIN_OPTIONS.schema.jwks.modelName).toBe("pluginJwks");
    });

    it("documents the key-set response shape the data engine consumes", () => {
        const endpoint = jwtPlugin.endpoints.getJwks as unknown as {
            options: { metadata: unknown };
        };
        const metadata = JSON.stringify(endpoint.options.metadata);
        expect(metadata).toContain("keys");
        expect(metadata).toContain("kid");
        expect(metadata).toContain("kty");
        expect(metadata).toContain("alg");
    });
});