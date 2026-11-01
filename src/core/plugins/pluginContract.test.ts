import { describe, it, expect } from "vitest";
import { getMissingPluginMethods, isWorldPlugin } from "./pluginContract";

const fullPlugin = {
    id: "p", name: "P", description: "", icon: "Box", category: "custom", version: "1.0.0",
    initialize: async () => {}, destroy: () => {}, fetch: async () => [], getPollingInterval: () => 0,
};

describe("pluginContract", () => {
    it("accepts an object implementing every lifecycle method", () => {
        expect(getMissingPluginMethods(fullPlugin)).toEqual([]);
        expect(isWorldPlugin(fullPlugin)).toBe(true);
    });

    it("names exactly the methods a foreign-API bundle is missing", () => {
        // Shape of a plugin built against a different host (initialize(ctx, config) + destroy only).
        const foreign = { id: "x", initialize: async () => {}, destroy: () => {} };
        expect(getMissingPluginMethods(foreign)).toEqual(["fetch", "getPollingInterval"]);
        expect(isWorldPlugin(foreign)).toBe(false);
    });

    it("treats primitives and nullish values as missing everything", () => {
        expect(getMissingPluginMethods(null)).toEqual(["initialize", "fetch", "getPollingInterval", "destroy"]);
        expect(getMissingPluginMethods("plugin")).toHaveLength(4);
        expect(isWorldPlugin(undefined)).toBe(false);
    });
});
