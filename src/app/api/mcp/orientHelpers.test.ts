/**
 * Contract tests for the frozen empty-reason vocabulary in orientHelpers.
 *
 * mapEngineReason is exported and its parameter is a plain string, so the
 * mapping is a public contract, not an internal detail: the v1 defect this
 * overhaul removed was reporting an outage or an unknown condition as "no data".
 * Note that no production caller currently passes an unrecognized reason --
 * listStreamingPlugins only ever yields the two literals below -- so the
 * fallback case is asserted directly here rather than reached end to end.
 */

import { describe, it, expect } from "vitest";
import { ENGINE_UNREACHABLE_HINT, NO_ACTIVE_PLUGINS_HINT, mapEngineReason } from "./orientHelpers";

describe("mapEngineReason -- the frozen vocabulary", () => {
    it("maps a dead engine to its own outage reason", () => {
        expect(mapEngineReason("engine_unreachable")).toBe("engine_unreachable");
    });

    it("maps an idle engine to plugin_not_streaming, not to an outage", () => {
        expect(mapEngineReason("no_active_plugins")).toBe("plugin_not_streaming");
    });

    it("maps a missing reason to unknown, never to no_data_matches", () => {
        expect(mapEngineReason(undefined)).toBe("unknown");
    });

    it("maps an unrecognized reason to unknown rather than guessing no data", () => {
        expect(mapEngineReason("some_reason_added_later")).toBe("unknown");
    });
});

describe("the two engine hints stay distinct", () => {
    it("tells an outage apart from an idle engine", () => {
        expect(ENGINE_UNREACHABLE_HINT).not.toBe(NO_ACTIVE_PLUGINS_HINT);
        expect(ENGINE_UNREACHABLE_HINT).toMatch(/OUTAGE/);
        expect(NO_ACTIVE_PLUGINS_HINT).toMatch(/NOT an outage/);
    });
});
