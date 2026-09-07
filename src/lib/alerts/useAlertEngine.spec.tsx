import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { useAlertEngine } from "./engine";

const mockIsDemo = vi.hoisted(() => ({ value: false }));
vi.mock("@/core/edition", () => ({
    get isDemo() { return mockIsDemo.value; },
}));
vi.mock("@/core/data/DataBus", () => ({
    dataBus: {
        on: vi.fn(() => () => {}),
        off: vi.fn(),
        emit: vi.fn(),
    },
}));

function AlertEngineProbe() {
    useAlertEngine();
    return null;
}

describe("useAlertEngine — demo edition gating", () => {
    beforeEach(() => {
        mockIsDemo.value = false;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rules: [] }),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        cleanup();
    });

    it("does not attach the engine or poll /api/alerts on the demo edition", async () => {
        mockIsDemo.value = true;
        const fetchMock = vi.mocked(fetch);

        render(<AlertEngineProbe />);
        // Give the mount effect a chance to run.
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(fetchMock).not.toHaveBeenCalledWith("/api/alerts", expect.anything());
    });

    it("attaches the engine and refreshes rules from /api/alerts when not on demo", async () => {
        render(<AlertEngineProbe />);

        await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/alerts", expect.anything()));
    });
});