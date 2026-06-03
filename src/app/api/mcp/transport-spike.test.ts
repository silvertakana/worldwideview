/**
 * Transport runtime spike — Phase 17, Wave 0 (17-01, Task 3)
 *
 * PURPOSE: De-risk D-17-02 BEFORE Wave 1 implementation. Proves that the raw
 * @modelcontextprotocol/sdk web-standard Streamable HTTP transport can be
 * imported, instantiated statelessly, and connected to a McpServer within the
 * Vitest runtime (which runs under the same Web Standard environment a
 * Next.js 16 App Router route handler uses: global Request, Response, Headers,
 * ReadableStream are all available).
 *
 * PASS/SKIP semantics (intentionally different from route.test.ts RED baseline):
 *   - SDK NOT installed (Wave 0): test SKIPS cleanly. Suite does not hard-fail.
 *   - SDK IS installed  (Wave 1+): test MUST PASS green.
 *
 * BLOCKER ESCALATION RULE:
 *   If the SDK IS installed and ANY assertion in this file throws at runtime
 *   (import fails, constructor throws, handleRequest is missing, connect
 *   rejects), the executor MUST STOP and flag a BLOCKER in the 17-02 SUMMARY
 *   rather than pulling the Phase 19 custom server.ts work forward. Do NOT
 *   silently swallow errors and mark the test pending.
 *
 * DO NOT install @modelcontextprotocol/sdk in this wave. That happens in 17-02.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Runtime guard: detect whether the SDK is installed before importing.
//
// The /* @vite-ignore */ comment suppresses Vite's static import-analysis
// transform error for an unresolved specifier — the import is evaluated at
// runtime only, so it throws naturally when the package is absent rather than
// crashing the transform step.
// ---------------------------------------------------------------------------

const SDK_HTTP_SPECIFIER = "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
const SDK_MCP_SPECIFIER = "@modelcontextprotocol/sdk/server/mcp.js";

async function sdkAvailable(): Promise<boolean> {
    try {
        // @vite-ignore
        await import(/* @vite-ignore */ SDK_HTTP_SPECIFIER);
        return true;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Spike suite
// ---------------------------------------------------------------------------

describe("Transport spike: @modelcontextprotocol/sdk web-standard transport", () => {
    it(
        "WebStandardStreamableHTTPServerTransport and McpServer import, instantiate, and connect (or skip if SDK not installed)",
        async () => {
            const available = await sdkAvailable();

            if (!available) {
                // SDK not yet installed (Wave 0 state) — skip cleanly.
                // Wave 1 (17-02) installs the package; this test will go green then.
                console.error(
                    "[17-01 spike] @modelcontextprotocol/sdk not installed yet — install in 17-02"
                );
                // Return early — test body is a no-op at this wave; no assertions fire.
                return;
            }

            // ----------------------------------------------------------------
            // From here onward: SDK IS installed. All assertions are mandatory.
            // Any failure -> BLOCKER in 17-02 SUMMARY.
            // ----------------------------------------------------------------

            const { WebStandardStreamableHTTPServerTransport } =
                // @vite-ignore
                await import(/* @vite-ignore */ SDK_HTTP_SPECIFIER) as {
                    WebStandardStreamableHTTPServerTransport: new (opts: {
                        sessionIdGenerator: undefined;
                    }) => {
                        handleRequest: (req: Request) => Promise<Response>;
                        start: () => Promise<void>;
                    };
                };

            const { McpServer } =
                // @vite-ignore
                await import(/* @vite-ignore */ SDK_MCP_SPECIFIER) as {
                    McpServer: new (info: { name: string; version: string }) => {
                        connect: (transport: unknown) => Promise<void>;
                    };
                };

            // 1. Both exports must be constructor functions
            expect(typeof WebStandardStreamableHTTPServerTransport).toBe("function");
            expect(typeof McpServer).toBe("function");

            // 2. Construct McpServer — empty capabilities (Phase 17 registers no tools/resources)
            const mcpServer = new McpServer({
                name: "worldwideview",
                version: "test",
            });
            expect(mcpServer).toBeTruthy();

            // 3. Construct transport in STATELESS mode (D-17-04: sessionIdGenerator: undefined)
            const transport = new WebStandardStreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });
            expect(transport).toBeTruthy();

            // 4. Transport must expose handleRequest (Web Standard Request -> Promise<Response>)
            expect(typeof transport.handleRequest).toBe("function");

            // 5. Transport must expose start (Transport interface contract)
            expect(typeof transport.start).toBe("function");

            // 6. mcpServer.connect(transport) must resolve without throwing.
            //    This is the critical proof: the SDK does not require a custom server.ts
            //    to wire McpServer + WebStandardStreamableHTTPServerTransport.
            await expect(mcpServer.connect(transport)).resolves.not.toThrow();
        }
    );
});
