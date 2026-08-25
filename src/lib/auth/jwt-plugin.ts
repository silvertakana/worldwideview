import { jwt } from "better-auth/plugins";

/**
 * Better Auth JWT plugin wiring — the JWKS this instance publishes at
 * /api/ba/jwks is the trust anchor the data engine uses to verify plugin
 * tickets (see wwv-data-engine src/jwt-auth.ts). Extracted so the
 * contract is unit-testable and a regression fails loudly.
 */
export const JWT_PLUGIN_OPTIONS = {
    schema: { jwks: { modelName: "pluginJwks" } },
} as const;

export const jwtPlugin = jwt(JWT_PLUGIN_OPTIONS);