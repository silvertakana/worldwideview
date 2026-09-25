import { describe, it, expect } from "vitest";

import {
    FIRST_CALL,
    type ToolCategory,
    allKnownToolNames,
    canonicalWorkflow,
    catalog,
    dataHonesty,
    findTool,
    legacyTools,
    sessionModel,
    toolNames,
    toolsByCategory,
} from "./toolCatalog";
import { toolGuides } from "./toolDetails";

const CATEGORIES: readonly ToolCategory[] = ["discovery", "data", "cockpit", "filter"];

describe("toolCatalog", () => {
    it("advertises 15 uniquely named tools with a real one-line purpose each", () => {
        expect(catalog).toHaveLength(15);
        expect(new Set(toolNames()).size).toBe(catalog.length);

        for (const tool of catalog) {
            expect(tool.purpose.length, tool.name).toBeGreaterThan(20);
            expect(CATEGORIES.includes(tool.category), tool.name).toBe(true);
            expect(typeof tool.requiresSession, tool.name).toBe("boolean");
            expect(tool.parameters, tool.name).toBeTypeOf("object");
        }
    });

    it("keeps legacy handlers out of the advertised inventory but still resolvable", () => {
        expect(legacyTools).toHaveLength(2);

        for (const tool of legacyTools) {
            expect(tool.purpose).toContain("LEGACY");
            expect(toolNames()).not.toContain(tool.name);
            expect(findTool(tool.name)?.name).toBe(tool.name);
        }
    });

    it("resolves every known name and nothing else", () => {
        expect(allKnownToolNames()).toHaveLength(catalog.length + legacyTools.length);
        expect(new Set(allKnownToolNames()).size).toBe(allKnownToolNames().length);
        expect(findTool("search_entities")).toBeUndefined();
        expect(findTool("get_entities_in_region")).toBeUndefined();
        expect(findTool("fly_to")).toBeUndefined();
    });

    it("partitions the catalog into its categories", () => {
        const grouped = CATEGORIES.flatMap((category) => toolsByCategory(category));

        expect(grouped.map((tool) => tool.name).sort()).toEqual(toolNames().sort());
    });

    it("splits the inventory into session-bound and session-free halves", () => {
        const requires = [...sessionModel.requiresSession].sort();
        const works = [...sessionModel.worksWithoutSession].sort();

        expect(requires).toEqual(
            catalog.filter((tool) => tool.requiresSession).map((tool) => tool.name).sort(),
        );
        expect(works).toEqual(
            catalog.filter((tool) => !tool.requiresSession).map((tool) => tool.name).sort(),
        );
        expect(requires.filter((name) => works.includes(name))).toEqual([]);
    });

    it("puts the first call first in the workflow, once, with a reason for each step", () => {
        expect(canonicalWorkflow[0].tool).toBe(FIRST_CALL);
        expect(canonicalWorkflow).toHaveLength(4);
        expect(canonicalWorkflow.map((step) => step.step)).toEqual([1, 2, 3, 4]);

        for (const step of canonicalWorkflow) {
            expect(findTool(step.tool), step.tool).toBeDefined();
            expect(step.why.length, step.tool).toBeGreaterThan(20);
        }
    });

    it("marks every placeholder feed and names a source for every verified one", () => {
        expect(dataHonesty.placeholder.length).toBeGreaterThan(0);

        for (const feed of dataHonesty.verifiedReal) {
            expect(feed.source.length, feed.feed).toBeGreaterThan(0);
            expect(feed.note.length, feed.feed).toBeGreaterThan(0);
        }
        for (const feed of dataHonesty.placeholder) {
            expect(feed.why.length, feed.feed).toBeGreaterThan(0);
        }
        expect(dataHonesty.rule).toContain("placeholder");
    });
});

describe("toolGuides", () => {
    it("documents every tool the server can register, and nothing it cannot", () => {
        expect(Object.keys(toolGuides).sort()).toEqual(allKnownToolNames().sort());
    });

    it("answers when to use it, when not to, what comes back, and how to call it", () => {
        for (const name of allKnownToolNames()) {
            const guide = toolGuides[name];

            expect(guide.useWhen.length, name).toBeGreaterThan(0);
            expect(guide.avoidWhen.length, name).toBeGreaterThan(0);
            expect(guide.returns.length, name).toBeGreaterThan(20);
            expect(guide.example, name).toContain(name);
        }
    });

    it("names the tool that does the job instead, when a tool is the wrong call", () => {
        // investigate_area is the default for "what is happening around X"; a precise
        // self-defined sweep is query_entities, and the guide has to say so.
        expect(toolGuides["investigate_area"].avoidWhen.join(" ")).toContain("query_entities");
        expect(toolGuides["orient"].avoidWhen.join(" ").length).toBeGreaterThan(20);
    });
});
