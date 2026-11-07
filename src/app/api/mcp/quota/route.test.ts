/**
 * GET /api/mcp/quota is public and keyless on purpose, so what it may say is the
 * whole test: the published budgets, the published tool names, and nothing that
 * would identify a customer or a key.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ demo: false }));

vi.mock("@/core/edition", () => ({
    get isDemo() {
        return state.demo;
    },
}));

vi.mock("@/lib/rateLimiters", () => ({
    mcpLimiter: { check: vi.fn().mockReturnValue(null) },
    getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { GET } from "./route";
import { mcpLimiter } from "@/lib/rateLimiters";

const limiterSpy = vi.mocked(mcpLimiter.check);

function request(): Request {
    return new Request("http://localhost:3000/api/mcp/quota");
}

describe("GET /api/mcp/quota", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.demo = false;
        limiterSpy.mockReturnValue(null);
    });

    it("answers a keyless caller with the published budgets", async () => {
        const res = await GET(request());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.endpoint).toBe("/api/mcp");
        expect(body.call_budgets).toEqual([
            { tier: "free", calls_per_minute: 30, window_seconds: 60 },
            { tier: "basic", calls_per_minute: 300, window_seconds: 60 },
            { tier: "pro", calls_per_minute: 300, window_seconds: 60 },
            { tier: "enterprise", calls_per_minute: 300, window_seconds: 60 },
        ]);
    });

    it("lists the tools with their metered flag, so an agent can plan its calls", async () => {
        const body = await (await GET(request())).json();

        const byName = new Map(
            (body.tools as { name: string; metered: boolean }[]).map((tool) => [tool.name, tool]),
        );
        expect(body.tool_count).toBe(body.tools.length);
        expect(byName.get("search_entities")).toMatchObject({ metered: true });
        expect(byName.get("get_usage")).toMatchObject({ metered: false });
    });

    it("carries no key material and no customer identity", async () => {
        const text = JSON.stringify(await (await GET(request())).json());

        expect(text).not.toMatch(/wwv_[A-Za-z0-9_-]{6,}/);
        expect(text).not.toMatch(/authorization/i);
        expect(text).not.toMatch(/keyId|key_id|userId|user_id/);
    });

    it("is still behind the coarse per-IP limiter", async () => {
        limiterSpy.mockReturnValue(new Response("limited", { status: 429 }) as never);

        const res = await GET(request());
        expect(res.status).toBe(429);
    });

    it("answers 403 in the demo edition", async () => {
        state.demo = true;
        const res = await GET(request());
        expect(res.status).toBe(403);
    });
});
