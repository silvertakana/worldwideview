import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useStore } from "@/core/state/store";
import { AlertsPanel } from "./AlertsPanel";

const mockIsDemo = vi.hoisted(() => ({ value: false }));
vi.mock("@/core/edition", () => ({
    get isDemo() { return mockIsDemo.value; },
}));

describe("AlertsPanel — demo edition gating", () => {
    beforeEach(() => {
        mockIsDemo.value = false;
        useStore.setState({
            alertRules: [],
            alertRulesLoading: false,
            alertRulesError: null,
            alertUnreadCount: 2,
            alertToasts: [],
        });
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("skips fetchAlerts and keeps the unread badge on the demo edition", async () => {
        mockIsDemo.value = true;
        const fetchMock = vi.mocked(fetch);
        render(<AlertsPanel />);

        // Let the mount effect flush.
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(fetchMock).not.toHaveBeenCalledWith("/api/alerts", expect.anything());
        expect(useStore.getState().alertUnreadCount).toBe(2);
        // The panel body itself still renders.
        expect(screen.getByTestId("alerts-panel")).toBeDefined();
    });

    it("fetches alerts and clears the unread badge when not on demo", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rules: [] }),
        }));
        render(<AlertsPanel />);

        await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/alerts", expect.anything()));
        expect(useStore.getState().alertUnreadCount).toBe(0);
    });
});