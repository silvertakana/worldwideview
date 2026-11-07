/**
 * @file metering.ts
 * @description The one seam that counts MCP tool calls: a Proxy over the
 * per-request McpServer that wraps every server.registerTool handler.
 *
 * WHY A PROXY AND NOT 23 EDITS. Every registrar -- the eight static ones and the
 * dynamic plugin dispatcher -- registers tools through the same three-argument
 * server.registerTool(name, config, handler). Wrapping that method on the server
 * instance covers all of them today, and covers a registrar written next month
 * without touching it. A per-registrar edit would be a decision each new
 * registrar has to remember; this is a decision it cannot forget.
 *
 * WHY EVERY OTHER PROPERTY IS BOUND TO THE TARGET. The SDK calls server.connect()
 * with `this` implied by the receiver. A Proxy that returns an unbound method
 * makes `this` the Proxy, and the class's private fields are not reachable
 * through it -- connect() then fails at run time, not compile time. Binding to
 * the real instance keeps the object the SDK sees as self-consistent as the one
 * it would have had.
 *
 * WHAT IS COUNTED. A tools/call that reached a registered handler, including a
 * handler that returns isError:true: the work was done, and the meter bills
 * calls rather than successes. Not counted: tools/list, resources/read,
 * prompts/get (no handler is wrapped) and input-schema rejections (the SDK
 * rejects before the handler runs). Tools flagged `metered: false` in
 * toolRegistry.ts are registered unwrapped, so self-diagnosis cannot cost money.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_TOOLS } from "./toolRegistry";
import { recordToolCall } from "./usagePeriod";

/** Who the calls are attributed to, taken from the verified auth result. */
export interface MeteringContext {
    userId: string;
    keyId: string;
}

type ToolHandler = (...args: unknown[]) => unknown;
type RegisterTool = (name: string, config: unknown, handler: unknown) => unknown;

/**
 * Tool names that must never be metered, derived from the registry so the
 * allowlist has exactly one home and is type-checked against every descriptor.
 */
const UNMETERED_TOOL_NAMES: ReadonlySet<string> = new Set(
    MCP_TOOLS.filter((tool) => !tool.metered).map((tool) => tool.name),
);

/** True when a call to this tool name is counted. Plugin tools are always counted. */
export function isMeteredTool(toolName: string): boolean {
    return !UNMETERED_TOOL_NAMES.has(toolName);
}

/**
 * Wraps a handler so its outcome is recorded after it settles.
 *
 * The counter is awaited rather than fire-and-forget: lastUsedAt is cosmetic and
 * may be dropped, a billing number may not. recordToolCall catches everything
 * internally, so awaiting it cannot turn a metering fault into a tool failure.
 */
function meteredHandler(name: string, handler: ToolHandler, ctx: MeteringContext) {
    return async (...args: unknown[]): Promise<unknown> => {
        const startedAt = Date.now();
        try {
            return await handler(...args);
        } finally {
            await recordToolCall({
                userId: ctx.userId,
                keyId: ctx.keyId,
                toolName: name,
                durationMs: Date.now() - startedAt,
            });
        }
    };
}

/**
 * Returns a server whose registerTool records every call, and which is otherwise
 * the same server object.
 *
 * The Proxy is created per request because the server is per request (the
 * stateless invariant in route.ts), so the counter is bound to exactly one key.
 */
export function withMetering(server: McpServer, ctx: MeteringContext): McpServer {
    return new Proxy(server, {
        get(target, property) {
            if (property === "registerTool") {
                const registerTool = (name: string, config: unknown, handler: unknown) => {
                    const original = (target as unknown as { registerTool: RegisterTool }).registerTool;
                    const wrapped = isMeteredTool(name)
                        ? meteredHandler(name, handler as ToolHandler, ctx)
                        : handler;
                    return original.call(target, name, config, wrapped);
                };
                return registerTool;
            }

            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    }) as McpServer;
}
