import { describe, it, expect, afterEach, vi } from "vitest";
import { pluginRegistry } from "./PluginRegistry";
import type { WorldPlugin } from "@/core/plugins/PluginTypes";

/**
 * PluginRegistry is the static-side companion to PluginManager: built-in
 * plugins register here at startup, then PluginManager copies them in.
 * Same-id duplicates have to be ignored quietly (warned, not thrown) so
 * the boot path doesn't crash on a re-import during dev hot-reload.
 */

function makePlugin(overrides: Partial<WorldPlugin> = {}): WorldPlugin {
    return {
        id: "test-plugin",
        name: "Test Plugin",
        description: "for tests",
        icon: "Box",
        category: "custom",
        version: "1.0.0",
        initialize: async () => {},
        destroy: () => {},
        fetch: async () => [],
        getPollingInterval: () => 60_000,
        getLayerConfig: () => ({
            color: "#fff",
            clusterEnabled: false,
            clusterDistance: 50,
        }),
        renderEntity: () => ({ type: "point" }),
        ...overrides,
    };
}

afterEach(() => {
    for (const p of pluginRegistry.getAll()) pluginRegistry.unregister(p.id);
});

describe("PluginRegistry", () => {
    it("ignores a second register() with the same id and warns rather than throwing", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const first = makePlugin({ id: "dup", name: "first" });
        const second = makePlugin({ id: "dup", name: "second" });

        pluginRegistry.register(first);
        pluginRegistry.register(second);

        expect(pluginRegistry.get("dup")).toBe(first);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("filters by category via getByCategory()", () => {
        pluginRegistry.register(makePlugin({ id: "a", category: "aviation" }));
        pluginRegistry.register(makePlugin({ id: "b", category: "custom" }));
        pluginRegistry.register(makePlugin({ id: "c", category: "aviation" }));

        const aviation = pluginRegistry.getByCategory("aviation").map((p) => p.id).sort();
        expect(aviation).toEqual(["a", "c"]);
    });
});
