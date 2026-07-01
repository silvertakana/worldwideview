import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureRequestError: vi.fn() }));
vi.mock("./sentry.server.config", () => ({}));
vi.mock("./sentry.edge.config", () => ({}));

import { register } from "./instrumentation";

describe("instrumentation — register()", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_RUNTIME", "nodejs");
        vi.stubEnv("ENCRYPTION_MASTER_KEY", "test-key-64-chars-abcdef1234567890abcdef");
        vi.stubEnv("BETTER_AUTH_SECRET", "test-auth-secret");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("throws when ENCRYPTION_MASTER_KEY is not set", async () => {
        vi.stubEnv("ENCRYPTION_MASTER_KEY", "");
        await expect(register()).rejects.toThrow(
            "[startup] ENCRYPTION_MASTER_KEY is not set. The server cannot start without it."
        );
    });

    it("throws when BETTER_AUTH_SECRET is not set", async () => {
        vi.stubEnv("BETTER_AUTH_SECRET", "");
        await expect(register()).rejects.toThrow(
            "[startup] BETTER_AUTH_SECRET is not set. The server cannot start without it."
        );
    });

    it("resolves without throwing when BETTER_AUTH_SECRET is set", async () => {
        await expect(register()).resolves.toBeUndefined();
    });

    it("does not throw when NEXT_RUNTIME is edge (skips nodejs checks)", async () => {
        vi.stubEnv("NEXT_RUNTIME", "edge");
        vi.stubEnv("ENCRYPTION_MASTER_KEY", "");
        await expect(register()).resolves.toBeUndefined();
    });
});
