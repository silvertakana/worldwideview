import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStore } from "@/core/state/store";
import { DataConfigPanel } from "./index";

const mockIsDemo = vi.hoisted(() => ({ value: false }));
vi.mock("@/core/edition", () => ({
    get isDemo() { return mockIsDemo.value; },
}));

// The tab panels pull in heavy engine/plugin rendering; stub the ones that are
// incidental to the alerts gating under test (AlertsPanel/AlertsTabButton stay
// real so the gated mount is exercised end to end).
vi.mock("@/components/panels/FilterPanel", () => ({
    FilterSection: function FilterSectionStub() { return <div data-testid="filter-section" />; },
}));
vi.mock("./IntelTab", () => ({
    IntelTab: function IntelTabStub() { return <div data-testid="intel-tab" />; },
}));
vi.mock("./CacheTab", () => ({
    CacheTab: function CacheTabStub() { return <div data-testid="cache-tab" />; },
}));
vi.mock("./OverlayTab", () => ({
    OverlayTab: function OverlayTabStub() { return <div data-testid="overlay-tab" />; },
}));

describe("DataConfigPanel — alerts gating on the demo edition", () => {
    beforeEach(() => {
        mockIsDemo.value = false;
        useStore.setState({ configPanelOpen: true, activeConfigTab: "alerts" });
        vi.stubGlobal("fetch", vi.fn());
        // jsdom has no matchMedia; the panel's useIsMobile hook requires it.
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("hides the alerts tab button and panel on the demo edition", async () => {
        mockIsDemo.value = true;
        render(<DataConfigPanel />);

        expect(screen.queryByTestId("alerts-tab")).toBeNull();
        expect(screen.queryByTestId("alerts-panel")).toBeNull();
        // The rest of the sidebar still renders.
        expect(screen.getByText("Data Configuration")).toBeDefined();
        expect(screen.getByText("Provide Feedback")).toBeDefined();
        // AlertsPanel never mounts, so nothing fetches /api/alerts.
        expect(fetch).not.toHaveBeenCalledWith("/api/alerts", expect.anything());
    });

    it("shows the alerts tab button and panel when not on demo", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rules: [] }),
        }));
        const { findByTestId } = render(<DataConfigPanel />);

        expect(screen.getByTestId("alerts-tab")).toBeDefined();
        expect(await findByTestId("alerts-panel")).toBeDefined();
    });
});