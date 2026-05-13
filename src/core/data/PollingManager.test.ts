import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The store import in PollingManager's constructor pulls in Cesium,
// zustand middleware, and the entire UI state tree. Mock it before the
// module loads so the polling-manager singleton wakes up against a
// shape that's safe in jsdom.
vi.mock("@/core/state/store", () => ({
    useStore: {
        getState: () => ({ dataConfig: { pollingIntervals: {} } }),
        subscribe: () => () => {},
    },
}));

import { pollingManager } from "./PollingManager";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    // Clean up timers and any tasks registered in this test so the next
    // one starts from a known state. The singleton doesn't expose a
    // reset method, but `stopAll` + `unregister` covers our cases.
    pollingManager.stopAll();
    vi.useRealTimers();
});

// Helper: drain the microtask queue so the immediate `run()` Promise
// scheduled inside `start()` resolves before we assert on call counts.
// We can't use `runAllTimersAsync` here because setInterval is unbounded
// and `runOnlyPendingTimersAsync` advances the next interval tick too,
// which would double-count.
async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("PollingManager", () => {
    it("runs the callback once immediately when start() is called", async () => {
        const callback = vi.fn(async () => {});
        pollingManager.register("test", 60_000, callback);

        pollingManager.start("test");
        await flushMicrotasks();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("schedules recurring calls at intervalMs after the initial run", async () => {
        const callback = vi.fn(async () => {});
        pollingManager.register("test", 1_000, callback);

        pollingManager.start("test");
        await flushMicrotasks();
        expect(callback).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1_000);
        expect(callback).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(2_000);
        expect(callback).toHaveBeenCalledTimes(4);
    });

    it("stops scheduling further calls after stop()", async () => {
        const callback = vi.fn(async () => {});
        pollingManager.register("test", 1_000, callback);

        pollingManager.start("test");
        await flushMicrotasks();
        expect(callback).toHaveBeenCalledTimes(1);

        pollingManager.stop("test");
        await vi.advanceTimersByTimeAsync(10_000);

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
