import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { dataBus } from "@/core/data/DataBus";
import { useStore } from "@/core/state/store";
import { AlertToasts } from "./AlertToasts";
import type { DataBusEvents } from "@worldwideview/wwv-plugin-sdk";

const FIRED: DataBusEvents["alertFired"] = {
    rule: {
        id: "rule-1",
        name: "Big quake",
        pluginId: "earthquakes",
        condition: { field: "magnitude", op: "gt", value: 5 },
    },
    entity: {
        id: "q-1",
        pluginId: "earthquakes",
        latitude: 61,
        longitude: -149,
        timestamp: new Date("2026-08-25T00:00:00Z"),
        properties: { magnitude: 6.2, place: "Alaska" },
    },
    pluginId: "earthquakes",
};

function fireAlert() {
    act(() => {
        dataBus.emit("alertFired", FIRED);
    });
}

describe("AlertToasts", () => {
    beforeEach(() => {
        useStore.setState({ alertToasts: [], alertUnreadCount: 0 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders a toast when alertFired fires on the data bus and bumps unread", () => {
        render(<AlertToasts />);
        fireAlert();
        expect(screen.getByText("Big quake")).toBeDefined();
        expect(screen.getByText(/Central Alaska|Alaska/)).toBeDefined();
        expect(useStore.getState().alertUnreadCount).toBe(1);
        expect(useStore.getState().alertToasts).toHaveLength(1);
    });

    it("auto-dismisses the toast after the TTL", () => {
        vi.useFakeTimers();
        render(<AlertToasts />);
        fireAlert();
        expect(useStore.getState().alertToasts).toHaveLength(1);
        act(() => {
            vi.advanceTimersByTime(8500);
        });
        expect(useStore.getState().alertToasts).toHaveLength(0);
    });

    it("dismisses on the X button", () => {
        render(<AlertToasts />);
        fireAlert();
        act(() => {
            screen.getByRole("button", { name: "Dismiss alert" }).click();
        });
        expect(useStore.getState().alertToasts).toHaveLength(0);
    });
});