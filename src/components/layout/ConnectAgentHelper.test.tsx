/**
 * Renders the connect panel in each endpoint state (CONNECT-01 / T-17-04).
 *
 * The resolver itself is unit-tested in src/lib/mcp/endpoint.test.ts. These tests
 * cover what the user actually sees: the instance's own URL when it can be
 * derived, the explicit override when one is configured, and a plain explanation
 * with the expected shape -- no copy field and no dead URL -- when the endpoint
 * cannot be detected. The token must stay in the Authorization header value and
 * must never appear in a URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
    readBrowserOrigin: vi.fn<() => string | null>(),
    edition: "local" as "local" | "cloud" | "demo",
}));

vi.mock("@/lib/mcp/endpoint", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/mcp/endpoint")>();
    return { ...actual, readBrowserOrigin: mocks.readBrowserOrigin };
});

// Getters, not fixed values: the edition is per-test so the cloud path (the one
// that used to advertise a foreign host) is covered explicitly.
vi.mock("@/core/edition", () => ({
    get edition() { return mocks.edition; },
    get isCloud() { return mocks.edition === "cloud"; },
    get isDemo() { return mocks.edition === "demo"; },
}));

import { ConnectAgentHelper } from "./ConnectAgentHelper";

const CLOUD_ORIGIN = "https://acme.cloud-wwv.dev";
const LOCAL_EXAMPLE = "http://localhost:3000/api/mcp";

interface McpServersBlock {
    mcpServers: {
        worldwideview: {
            url: string;
            headers: { Authorization: string };
        };
    };
}

/** Every copy-field value currently on screen (endpoint URL, JSON block, prompt). */
function fieldValues(): string[] {
    return Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
    ).map((el) => el.value);
}

beforeEach(() => {
    mocks.readBrowserOrigin.mockReset();
    mocks.edition = "local";
    delete process.env.NEXT_PUBLIC_MCP_API_URL;
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("ConnectAgentHelper endpoint states", () => {
    it("advertises the instance's own origin for a cloud tenant", () => {
        mocks.readBrowserOrigin.mockReturnValue(CLOUD_ORIGIN);
        render(<ConnectAgentHelper />);

        expect(screen.getByDisplayValue(CLOUD_ORIGIN + "/api/mcp")).toBeDefined();
        expect(document.body.innerHTML).not.toContain("worldmonitor");
    });

    it("prefers NEXT_PUBLIC_MCP_API_URL when it is configured", () => {
        vi.stubEnv("NEXT_PUBLIC_MCP_API_URL", "https://mcp.example.com/api/mcp");
        mocks.readBrowserOrigin.mockReturnValue(CLOUD_ORIGIN);
        render(<ConnectAgentHelper />);

        expect(screen.getByDisplayValue("https://mcp.example.com/api/mcp")).toBeDefined();
        expect(screen.queryByDisplayValue(CLOUD_ORIGIN + "/api/mcp")).toBeNull();
    });

    it("says so, with the expected shape, when the endpoint cannot be detected", () => {
        mocks.readBrowserOrigin.mockReturnValue(null);
        render(<ConnectAgentHelper />);

        expect(screen.getByText("MCP endpoint not detected")).toBeDefined();
        expect(screen.getByText(/no NEXT_PUBLIC_MCP_API_URL is configured/)).toBeDefined();
        expect(screen.getByText(/open this panel from the running instance/)).toBeDefined();
        expect(screen.getByText(LOCAL_EXAMPLE)).toBeDefined();

        // No copy field for a URL, and no dead URL anywhere on the page.
        expect(screen.queryByText("Endpoint URL")).toBeNull();
        expect(screen.queryByText("mcpServers config block")).toBeNull();
        expect(fieldValues().some((value) => value.includes("/api/mcp"))).toBe(false);
        expect(document.body.innerHTML).not.toContain("worldmonitor");
    });

    it("uses the cloud shape when the cloud edition cannot detect the endpoint", () => {
        mocks.edition = "cloud";
        mocks.readBrowserOrigin.mockReturnValue(null);
        render(<ConnectAgentHelper />);

        expect(screen.getByText("MCP endpoint not detected")).toBeDefined();
        expect(screen.getByText("https://<your-instance>.cloud-wwv.dev/api/mcp")).toBeDefined();
        expect(fieldValues().some((value) => value.includes("worldmonitor"))).toBe(false);
    });

    it("advertises its own origin on the cloud edition, never a foreign host", () => {
        mocks.edition = "cloud";
        mocks.readBrowserOrigin.mockReturnValue(CLOUD_ORIGIN);
        render(<ConnectAgentHelper />);

        expect(screen.getByDisplayValue(CLOUD_ORIGIN + "/api/mcp")).toBeDefined();
        expect(document.body.innerHTML).not.toContain("api.worldmonitor");
    });

    it("reports an unusable configured override instead of rendering a dead URL", () => {
        vi.stubEnv("NEXT_PUBLIC_MCP_API_URL", "not-a-url");
        mocks.readBrowserOrigin.mockReturnValue(CLOUD_ORIGIN);
        render(<ConnectAgentHelper />);

        expect(screen.getByText("MCP endpoint not detected")).toBeDefined();
        expect(screen.getByText(/not to an absolute http\(s\) URL/)).toBeDefined();
        expect(screen.queryByText("Endpoint URL")).toBeNull();
        expect(fieldValues().some((value) => value.includes("/api/mcp"))).toBe(false);
    });

    it("keeps the token in the Authorization header and out of every URL", () => {
        mocks.readBrowserOrigin.mockReturnValue(CLOUD_ORIGIN);
        render(<ConnectAgentHelper token="wwv_abc.secret" />);

        const block = screen.getByDisplayValue(/"mcpServers"/) as HTMLTextAreaElement;
        const parsed = JSON.parse(block.value) as McpServersBlock;

        expect(parsed.mcpServers.worldwideview.url).toBe(CLOUD_ORIGIN + "/api/mcp");
        expect(parsed.mcpServers.worldwideview.url).not.toContain("wwv_abc.secret");
        expect(parsed.mcpServers.worldwideview.headers.Authorization).toBe("Bearer wwv_abc.secret");
        expect(screen.getByDisplayValue("Bearer wwv_abc.secret")).toBeDefined();

        // The standalone Endpoint URL field is exactly the URL -- no token, no
        // query string. (The JSON block above legitimately carries the token, but
        // only in its Authorization header value.)
        const endpointField = screen.getByDisplayValue(CLOUD_ORIGIN + "/api/mcp") as HTMLInputElement;
        expect(endpointField.value).not.toContain("wwv_abc.secret");
        expect(endpointField.value).not.toContain("?");
    });
});
