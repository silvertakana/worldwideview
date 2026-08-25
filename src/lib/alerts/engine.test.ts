import { describe, it, expect, vi, afterEach } from "vitest";
import type { DataBusEvents, GeoEntity } from "@worldwideview/wwv-plugin-sdk";
import { attachAlertEngine, DEDUPE_WINDOW_MS, RULES_REFRESH_MS, type AlertBusLike, type RuleRecord } from "./engine";

type Handler = (data: unknown) => void;

class MockBus implements AlertBusLike {
    handlers = new Map<keyof DataBusEvents, Set<Handler>>();
    emitCalls: Array<{ event: string; data: unknown }> = [];
    unsubscribed = false;

    on<K extends keyof DataBusEvents>(event: K, handler: (data: DataBusEvents[K]) => void): () => void {
        if (!this.handlers.has(event)) this.handlers.set(event, new Set());
        this.handlers.get(event)!.add(handler as Handler);
        return () => {
            this.handlers.get(event)?.delete(handler as Handler);
            this.unsubscribed = this.handlers.get(event)?.size === 0;
        };
    }

    off<K extends keyof DataBusEvents>(event: K, handler: (data: DataBusEvents[K]) => void): void {
        this.handlers.get(event)?.delete(handler as Handler);
    }

    emit<K extends keyof DataBusEvents>(event: K, data: DataBusEvents[K]): void {
        this.emitCalls.push({ event: String(event), data });
        this.handlers.get(event)?.forEach((h) => h(data));
    }

    fireDataUpdated(pluginId: string, entities: GeoEntity[]): void {
        this.emit("dataUpdated", { pluginId, entities });
    }

    firedAlerts(): Array<{ rule: RuleRecord; entity: GeoEntity; pluginId: string }> {
        return this.emitCalls
            .filter((c) => c.event === "alertFired")
            .map((c) => c.data as { rule: RuleRecord; entity: GeoEntity; pluginId: string });
    }
}

function entity(id: string, magnitude = 6.2): GeoEntity {
    return {
        id,
        pluginId: "earthquakes",
        latitude: 61,
        longitude: -149,
        timestamp: new Date("2026-08-26T00:00:00Z"),
        label: `M${magnitude} quake`,
        // Plugin-mapped fields live in the metadata bag (matches FilterDefinition.propertyKey).
        properties: { magnitude, place: "Alaska" },
    };
}

function rule(overrides: Partial<RuleRecord> = {}): RuleRecord {
    return {
        id: "rule-1",
        name: "Big quake",
        pluginId: "earthquakes",
        condition: { field: "magnitude", op: "gt", value: 5 },
        enabled: true,
        ...overrides,
    };
}

const cleanups: Array<() => void> = [];
afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()!();
});

function attach(bus: MockBus, rules: RuleRecord[], now: () => number, persistEvent = vi.fn(async () => undefined)) {
    const fetchRules = vi.fn(async () => rules);
    const cleanup = attachAlertEngine(bus, { fetchRules, persistEvent, now });
    cleanups.push(cleanup);
    return { fetchRules, persistEvent };
}

async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("attachAlertEngine", () => {
    it("loads enabled rules for the emitted plugin channel and fires alertFired on match", async () => {
        const bus = new MockBus();
        const { persistEvent } = attach(bus, [rule()], () => 0);
        await flush();

        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);

        const alerts = bus.firedAlerts();
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule.id).toBe("rule-1");
        expect(alerts[0].entity.id).toBe("eq-1");
        expect(alerts[0].pluginId).toBe("earthquakes");
        expect(persistEvent).toHaveBeenCalledWith({
            ruleId: "rule-1",
            pluginId: "earthquakes",
            entityId: "eq-1",
            summary: "Big quake matched earthquakes entity eq-1",
        });
    });

    it("does not fire when the entity does not match the condition", async () => {
        const bus = new MockBus();
        attach(bus, [rule()], () => 0);
        await flush();

        bus.fireDataUpdated("earthquakes", [entity("eq-1", 3.1)]);
        expect(bus.firedAlerts()).toHaveLength(0);
    });

    it("does not evaluate rules belonging to other plugin channels", async () => {
        const bus = new MockBus();
        attach(bus, [rule({ pluginId: "volcanoes" })], () => 0);
        await flush();

        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
        expect(bus.firedAlerts()).toHaveLength(0);
    });

    it("skips disabled rules", async () => {
        const bus = new MockBus();
        attach(bus, [rule({ enabled: false })], () => 0);
        await flush();

        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
        expect(bus.firedAlerts()).toHaveLength(0);
    });

    it("dedupes the same rule+entity within the 60s window", async () => {
        const bus = new MockBus();
        const clock = { t: 0 };
        attach(bus, [rule()], () => clock.t);
        await flush();

        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
        expect(bus.firedAlerts()).toHaveLength(1);

        clock.t = DEDUPE_WINDOW_MS;
        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
        expect(bus.firedAlerts()).toHaveLength(2);
    });

    it("fires once per entity when multiple entities match", async () => {
        const bus = new MockBus();
        attach(bus, [rule()], () => 0);
        await flush();

        bus.fireDataUpdated("earthquakes", [entity("eq-1"), entity("eq-2")]);
        expect(bus.firedAlerts()).toHaveLength(2);
    });

    it("evaluates multiple rules for the same channel independently", async () => {
        const bus = new MockBus();
        attach(bus, [
            rule(),
            rule({ id: "rule-2", name: "Deep quake", condition: { field: "magnitude", op: "lt", value: 1 } }),
        ], () => 0);
        await flush();

        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
        expect(bus.firedAlerts()).toHaveLength(1);
        expect(bus.firedAlerts()[0].rule.id).toBe("rule-1");
    });

    it("keeps the last known rules when a refresh fails", async () => {
        vi.useFakeTimers();
        try {
            const bus = new MockBus();
            const fetchRules = vi.fn()
                .mockRejectedValueOnce(new Error("network"))
                .mockResolvedValueOnce([rule()]);
            const cleanup = attachAlertEngine(bus, { fetchRules, now: () => 0 });
            cleanups.push(cleanup);

            // Initial refresh fails -> no rules, no alert.
            await vi.advanceTimersByTimeAsync(0);
            await Promise.resolve();
            bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
            expect(bus.firedAlerts()).toHaveLength(0);

            // The 60s rules refresh now succeeds and picks up the rule.
            await vi.advanceTimersByTimeAsync(RULES_REFRESH_MS);
            bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
            expect(bus.firedAlerts()).toHaveLength(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("cleanup unsubscribes: no alert fires after detach", async () => {
        const bus = new MockBus();
        attach(bus, [rule()], () => 0);
        await flush();

        cleanups.pop()!();
        bus.fireDataUpdated("earthquakes", [entity("eq-1")]);
        expect(bus.firedAlerts()).toHaveLength(0);
    });

    it("ignores empty entity batches", async () => {
        const bus = new MockBus();
        attach(bus, [rule()], () => 0);
        await flush();

        bus.fireDataUpdated("earthquakes", []);
        expect(bus.firedAlerts()).toHaveLength(0);
    });
});