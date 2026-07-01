import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/better-auth", () => ({
    auth: {
        handler: vi.fn(),
    },
}));

import { GET, POST } from "./route";
import { auth } from "@/lib/better-auth";

describe("BA route wrapHandler", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("passes through a successful response", async () => {
        const body = { ok: true };
        vi.mocked(auth.handler).mockResolvedValue(
            Response.json(body, { status: 200 }),
        );

        const res = await GET(new Request("http://localhost:3000/api/ba/session"));

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual(body);
    });

    it("returns 500 JSON when handler throws an Error", async () => {
        vi.mocked(auth.handler).mockRejectedValue(new Error("Something went wrong"));

        const res = await GET(new Request("http://localhost:3000/api/ba/session"));

        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({
            error: "BA handler error",
            message: "Something went wrong",
        });
    });

    it("coerces non-Error throw to string in message", async () => {
        vi.mocked(auth.handler).mockRejectedValue("string error");

        const res = await GET(new Request("http://localhost:3000/api/ba/session"));

        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({
            error: "BA handler error",
            message: "string error",
        });
    });

    it("logs error message and stack on Error with stack", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const err = new Error("with stack");
        vi.mocked(auth.handler).mockRejectedValue(err);

        await GET(new Request("http://localhost:3000/api/ba/session"));

        expect(spy).toHaveBeenCalledWith("[BA Route] Error:", "with stack");
        expect(spy).toHaveBeenCalledWith("[BA Route] Stack:", err.stack);
        spy.mockRestore();
    });

    it("logs only message on Error without stack", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const err = new Error("no stack");
        Object.defineProperty(err, "stack", { value: undefined });
        vi.mocked(auth.handler).mockRejectedValue(err);

        await GET(new Request("http://localhost:3000/api/ba/session"));

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("[BA Route] Error:", "no stack");
        spy.mockRestore();
    });

    it("also wraps POST handler", async () => {
        vi.mocked(auth.handler).mockRejectedValue(new Error("post error"));

        const res = await POST(
            new Request("http://localhost:3000/api/ba/sign-in/email", { method: "POST" }),
        );

        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({
            error: "BA handler error",
            message: "post error",
        });
    });
});
