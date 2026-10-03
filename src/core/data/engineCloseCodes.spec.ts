import { describe, it, expect } from "vitest";
import {
    classifyEngineClose,
    WS_CLOSE_TOKEN_EXPIRED,
    WS_CLOSE_AUTH_REQUIRED,
    WS_CLOSE_INVALID_PLUGIN_ID,
    WS_CLOSE_SUBSCRIPTION_LIMIT,
    WS_CLOSE_RATE_LIMIT,
    WS_CLOSE_NOT_IN_SCOPE,
} from "./engineCloseCodes";

describe("classifyEngineClose", () => {
    it("treats a missing or stale credential as something a fresh ticket fixes", () => {
        expect(classifyEngineClose(WS_CLOSE_AUTH_REQUIRED)).toBe("refresh-ticket");
        expect(classifyEngineClose(WS_CLOSE_TOKEN_EXPIRED)).toBe("refresh-ticket");
    });

    it("blocks codes that a reconnect can never satisfy", () => {
        expect(classifyEngineClose(WS_CLOSE_NOT_IN_SCOPE)).toBe("block");
        expect(classifyEngineClose(WS_CLOSE_INVALID_PLUGIN_ID)).toBe("block");
        expect(classifyEngineClose(WS_CLOSE_SUBSCRIPTION_LIMIT)).toBe("block");
    });

    it("backs off when the engine is merely rate limiting", () => {
        expect(classifyEngineClose(WS_CLOSE_RATE_LIMIT)).toBe("backoff");
    });

    it("keeps ordinary and unknown closes retryable", () => {
        expect(classifyEngineClose(1000)).toBe("retry");
        expect(classifyEngineClose(1006)).toBe("retry");
        expect(classifyEngineClose(undefined)).toBe("retry");
        // An unknown future code must never strand the client in a blocked state.
        expect(classifyEngineClose(4999)).toBe("retry");
    });
});
