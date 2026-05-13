import { describe, it, expect, vi, afterEach } from "vitest";
import { dataBus } from "./DataBus";

/**
 * DataBus is a typed singleton event bus used by every plugin and most
 * of the UI for cross-component communication. A regression here would
 * be silent and immediate — events stop arriving, layers go blank, the
 * agent bus stops responding — so it's worth pinning down the basics.
 *
 * Each test removes the listeners it adds in `afterEach` so the
 * singleton state doesn't leak between tests.
 */

afterEach(() => {
    dataBus.removeAllListeners();
});

describe("DataBus", () => {
    it("dispatches emit() payloads to subscribers of the matching event", () => {
        const handler = vi.fn();
        dataBus.on("dataUpdated", handler);

        dataBus.emit("dataUpdated", { pluginId: "test", entities: [] });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ pluginId: "test", entities: [] });
    });

    it("returns an unsubscribe function from on() that detaches the handler", () => {
        const handler = vi.fn();
        const unsubscribe = dataBus.on("dataUpdated", handler);

        unsubscribe();
        dataBus.emit("dataUpdated", { pluginId: "test", entities: [] });

        expect(handler).not.toHaveBeenCalled();
    });

    it("isolates handler failures so one throw doesn't block other subscribers", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const throwing = vi.fn(() => {
            throw new Error("intentional");
        });
        const surviving = vi.fn();
        dataBus.on("layerToggled", throwing);
        dataBus.on("layerToggled", surviving);

        dataBus.emit("layerToggled", { pluginId: "test", enabled: true });

        expect(throwing).toHaveBeenCalledTimes(1);
        expect(surviving).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });
});
