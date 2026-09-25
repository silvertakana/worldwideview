import { describe, it, expect } from "vitest";

import {
    FIRST_CALL,
    canonicalWorkflow,
    catalog,
    dataHonesty,
    legacyTools,
    sessionModel,
} from "@/lib/mcp/toolCatalog";
import { MCP_SERVER_VERSION } from "@/lib/mcp/server";
import { GET } from "./route";

const ORIGIN = "https://cloud-wwv.dev";

async function fetchDoc() {
    const response = await GET(new Request(ORIGIN + "/llms.txt"));
    return { response, body: await response.text() };
}

describe("GET /llms.txt", () => {
    it("serves plain text that a client may cache but must revalidate", async () => {
        const { response } = await fetchDoc();

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
        expect(response.headers.get("Cache-Control")).toContain("public");
        expect(response.headers.get("Cache-Control")).toContain("stale-while-revalidate");
    });

    it("says what WorldWideView is and how to connect", async () => {
        const { body } = await fetchDoc();

        expect(body).toContain("# WorldWideView");
        expect(body).toContain("## Connect");
        expect(body).toContain(ORIGIN + "/api/mcp");
        expect(body).toContain("Authorization: Bearer");
        expect(body).toContain("120 requests per 60-second window per API key");
        expect(body).toContain(MCP_SERVER_VERSION);
        expect(body).toContain("/.well-known/mcp/server-card.json");
    });

    it("names the first call and the canonical workflow", async () => {
        const { body } = await fetchDoc();

        expect(body).toContain("## Call this first");
        expect(body).toContain("`" + FIRST_CALL + "`");
        expect(body).toContain("## Canonical workflow");
        for (const step of canonicalWorkflow) {
            expect(body, step.tool).toContain("`" + step.tool + "`");
        }
    });

    it("lists every advertised tool under its category heading", async () => {
        const { body } = await fetchDoc();

        expect(body).toContain("## Tools (" + catalog.length + " advertised)");
        for (const tool of catalog) {
            expect(body, tool.name).toContain("`" + tool.name + "`");
            expect(body, tool.name).toContain(tool.purpose);
        }
        for (const heading of ["Discovery", "Data --", "Cockpit --", "Live filtering --"]) {
            expect(body, heading).toContain(heading);
        }
    });

    it("states which tools need an open browser tab", async () => {
        const { body } = await fetchDoc();

        expect(body).toContain("## Sessions");
        expect(body).toContain(sessionModel.definition);
        for (const name of sessionModel.requiresSession) {
            expect(body, name).toContain(name);
        }
        expect(body).toContain("no_active_session");
    });

    it("carries the data-honesty list, verified feeds and placeholders alike", async () => {
        const { body } = await fetchDoc();

        expect(body).toContain("## Data honesty");
        expect(body).toContain("PLACEHOLDER feeds");
        for (const feed of dataHonesty.verifiedReal) {
            expect(body, feed.feed).toContain(feed.feed);
            expect(body, feed.source).toContain(feed.source);
        }
        for (const feed of dataHonesty.placeholder) {
            expect(body, feed.feed).toContain(feed.feed);
        }
        expect(body).toContain(dataHonesty.rule);
    });

    it("lists the legacy handlers so they are not invisible", async () => {
        const { body } = await fetchDoc();

        expect(body).toContain("## Legacy handlers");
        for (const tool of legacyTools) {
            expect(body, tool.name).toContain(tool.name);
        }
    });

    it("uses the origin of the request, so one build serves any host", async () => {
        const other = "https://staging.example.test";
        const response = await GET(new Request(other + "/llms.txt"));
        const body = await response.text();

        expect(body).toContain(other + "/api/mcp");
        expect(body).not.toContain(ORIGIN + "/api/mcp");
    });

    it("is deterministic for a given origin", async () => {
        const first = await fetchDoc();
        const second = await fetchDoc();

        expect(first.body).toBe(second.body);
    });
});
