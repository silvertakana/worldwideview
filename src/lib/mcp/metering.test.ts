/**
 * The metering seam, tested against a capturing server: what the Proxy binds,
 * what the wrapped handler does with an outcome, and what it must leave alone.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("@/lib/db", () => ({
    prisma: {
        mcpToolUsageMonthly: { upsert: vi.fn() },
    },
}));

import { prisma } from "@/lib/db";
import { isMeteredTool, withMetering } from "./metering";

/** The SDK's result shape, so the handlers below typecheck as real tool handlers. */
function textResult(text: string) {
    return { content: [{ type: "text" as const, text }] };
}

const upsert = vi.mocked(prisma.mcpToolUsageMonthly.upsert);

interface Registered {
    name: string;
    config: unknown;
    handler: (...args: unknown[]) => unknown;
}

/**
 * A stand-in for the SDK server: it records what was registered and keeps the
 * handler, which is all the seam ever touches.
 */
function capturingServer() {
    const registered: Registered[] = [];
    const server = {
        connect: vi.fn(function (this: unknown) {
            return this;
        }),
        registerTool: vi.fn((name: string, config: unknown, handler: (...a: unknown[]) => unknown) => {
            registered.push({ name, config, handler });
            return { name };
        }),
        registerResource: vi.fn(),
    };
    return { server: server as unknown as McpServer, registered, raw: server };
}

const ctx = { userId: "user-1", keyId: "key-1" };

describe("withMetering", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        upsert.mockResolvedValue({} as never);
    });

    it("counts one metered call once, for the authenticated key", async () => {
        const { server, registered } = capturingServer();
        const metered = withMetering(server, ctx);

        metered.registerTool("search_entities", { description: "d" }, async () => textResult("found"));
        const result = await registered[0].handler({ q: "x" }, { sessionId: undefined });

        expect(result).toEqual(textResult("found"));
        expect(upsert).toHaveBeenCalledTimes(1);
        const args = upsert.mock.calls[0][0] as unknown as {
            create: { keyId: string; userId: string; toolName: string; calls: number };
        };
        expect(args.create).toMatchObject({
            keyId: "key-1",
            userId: "user-1",
            toolName: "search_entities",
            calls: 1,
        });
    });

    it("counts a handler that threw, because the work was attempted", async () => {
        const { server, registered } = capturingServer();
        const metered = withMetering(server, ctx);

        metered.registerTool("investigate_area", { description: "d" }, async () => {
            throw new Error("engine down");
        });

        await expect(registered[0].handler({}, {})).rejects.toThrow("engine down");
        expect(upsert).toHaveBeenCalledTimes(1);
    });

    it("counts a handler that returned isError, because the work was done", async () => {
        const { server, registered } = capturingServer();
        const metered = withMetering(server, ctx);

        metered.registerTool("get_entity_details", { description: "d" }, async () => ({
            ...textResult("nothing here"),
            isError: true,
        }));

        await registered[0].handler({}, {});
        expect(upsert).toHaveBeenCalledTimes(1);
    });

    it("does not count a tool the registry marks unmetered", async () => {
        const { server, registered } = capturingServer();
        const metered = withMetering(server, ctx);

        metered.registerTool("get_usage", { description: "d" }, async () => textResult('{"calls":7}'));
        const result = await registered[0].handler({}, {});

        expect(result).toEqual(textResult('{"calls":7}'));
        expect(upsert).not.toHaveBeenCalled();
        expect(isMeteredTool("get_usage")).toBe(false);
        expect(isMeteredTool("search_entities")).toBe(true);
    });

    it("passes the name and config through to the server unchanged", async () => {
        const { server, registered, raw } = capturingServer();
        const metered = withMetering(server, ctx);
        const config = { description: "unchanged", inputSchema: {} };

        metered.registerTool("pan_globe", config, async () => textResult("ok"));

        expect(raw.registerTool).toHaveBeenCalledTimes(1);
        expect(raw.registerTool.mock.calls[0][0]).toBe("pan_globe");
        expect(raw.registerTool.mock.calls[0][1]).toBe(config);
        expect(registered[0].config).toBe(config);
    });

    it("binds every other method to the server it wraps", () => {
        const { server, raw } = capturingServer();
        const metered = withMetering(server, ctx);

        // connect() is the SDK's own call, and it relies on `this` being the
        // real instance: an unbound Proxy would break it at run time, not at
        // compile time.
        metered.connect({} as never);
        expect(raw.connect).toHaveBeenCalledTimes(1);
        expect(raw.connect.mock.instances[0]).toBe(raw);
    });

    it("still counts plugin tools, which are not in the registry", () => {
        expect(isMeteredTool("flights__get_positions")).toBe(true);
    });
});
