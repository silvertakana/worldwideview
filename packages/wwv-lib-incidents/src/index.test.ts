/**
 * Guard tests for the BaseIncidentPlugin WebSocket payload contract.
 *
 * CONTEXT — The bug this suite guards against (now fixed):
 *   WsClient.handleDataMessage (src/core/data/WsClient.ts, lines 166-190) has three branches:
 *     1. Plugin has `mapWebsocketPayload` → called with raw payload → must return GeoEntity[]
 *     2. No handler AND payload IS a flat array → used directly (timestamps normalised)
 *     3. No handler AND payload is ANY OTHER object → silently dropped (console.warn + return)
 *
 *   BaseIncidentPlugin now provides a default `mapWebsocketPayload` that unwraps the three
 *   common payload shapes (scheduler envelope, GeoJSON FeatureCollection, flat array).
 *   Subclasses may override for domain-specific shapes.
 */

import { describe, it, expect } from "vitest";
import { BaseIncidentPlugin } from "./index";
import type {
    GeoEntity,
    TimeRange,
    ServerPluginConfig,
    FilterDefinition,
    PluginCategory,
    CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";

// ─── Minimal GeoEntity factory ────────────────────────────────────────────────

function makeEntity(id: string, overrides: Partial<GeoEntity> = {}): GeoEntity {
    return {
        id,
        pluginId: "test-incident-plugin",
        latitude: 35.6762,
        longitude: 139.6503,
        timestamp: new Date("2025-01-01T00:00:00Z"),
        properties: {},
        ...overrides,
    };
}

// ─── Minimal concrete subclass ────────────────────────────────────────────────
// We keep it as bare-bones as possible — only the abstract members required to
// instantiate the class. We do NOT add mapWebsocketPayload here, so we're testing
// the BaseIncidentPlugin base behaviour exactly.

class MinimalIncidentPlugin extends BaseIncidentPlugin {
    id = "test-incident-plugin";
    name = "Test Incident Plugin";
    description = "Test";
    icon = null;
    category: PluginCategory = "natural-disaster";
    version = "0.0.1";

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        return [];
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/test-incident-plugin",
            // Test fixture: the plugin DECLARES its own streamUrl (agnostic-frontend
            // invariant). The literal is arbitrary — this suite never asserts on it.
            streamUrl: "ws://localhost:5000/stream",
            pollingIntervalMs: 0,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [];
    }

    getLegend(): { label: string; color: string; filterId?: string; filterValue?: string }[] {
        return [];
    }

    protected getSeverityValue(_entity: GeoEntity): number {
        return 0;
    }

    protected getSeverityColor(_value: number): string {
        return "#ef4444";
    }

    protected getSeveritySize(_value: number): number {
        return 10;
    }
}

// ─── Subclass that DOES override mapWebsocketPayload ─────────────────────────

const FIXED_ENTITIES = [makeEntity("override-1"), makeEntity("override-2")];

class OverridingIncidentPlugin extends MinimalIncidentPlugin {
    id = "overriding-incident-plugin";

    mapWebsocketPayload(_payload: unknown, _existingEntities?: GeoEntity[]): GeoEntity[] {
        return FIXED_ENTITIES;
    }
}

// ─── Helpers that mimic WsClient.handleDataMessage branching logic ────────────
// We test the plugin method in isolation (unit test), not the full WsClient,
// because WsClient has DOM/Zustand/DataBus dependencies. This mirrors the exact
// logic from WsClient lines 172-182.

function simulateWsClientDispatch(
    plugin: BaseIncidentPlugin,
    rawPayload: unknown
): GeoEntity[] | null {
    if (typeof (plugin as any).mapWebsocketPayload === "function") {
        return (plugin as any).mapWebsocketPayload(rawPayload, []);
    }
    if (!Array.isArray(rawPayload)) {
        // This is the silent-drop branch — return null to signal "dropped"
        return null;
    }
    return (rawPayload as GeoEntity[]).map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp || Date.now()),
    }));
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("BaseIncidentPlugin — WebSocket payload contract", () => {

    describe("scheduler-wrapped payload { source, fetchedAt, items, totalCount }", () => {
        it(
            "unwraps { source, fetchedAt, items, totalCount } and returns items as GeoEntity[]",
            () => {
                const plugin = new MinimalIncidentPlugin();
                const entity1 = makeEntity("eq-1");
                const entity2 = makeEntity("eq-2");

                const wrappedPayload = {
                    source: "usgs-earthquake-feed",
                    fetchedAt: "2025-01-01T00:00:00Z",
                    items: [entity1, entity2],
                    totalCount: 2,
                };

                // After the fix: mapWebsocketPayload should exist and return both entities
                const result = simulateWsClientDispatch(plugin, wrappedPayload);

                expect(result).not.toBeNull();
                expect(Array.isArray(result)).toBe(true);
                expect(result).toHaveLength(2);
                expect(result![0].id).toBe("eq-1");
                expect(result![1].id).toBe("eq-2");
            }
        );

    });

    describe("flat GeoEntity[] payload", () => {
        /**
         * Flat arrays bypass mapWebsocketPayload entirely in WsClient — they work today.
         * This test MUST stay green before and after the fix.
         */
        it("passes flat GeoEntity[] through unchanged (current working behaviour)", () => {
            const plugin = new MinimalIncidentPlugin();
            const entities = [makeEntity("eq-flat-1"), makeEntity("eq-flat-2")];

            const result = simulateWsClientDispatch(plugin, entities);

            expect(result).not.toBeNull();
            expect(result).toHaveLength(2);
            expect(result![0].id).toBe("eq-flat-1");
            expect(result![1].id).toBe("eq-flat-2");
        });

        it("normalises timestamp strings to Date objects for flat array payloads", () => {
            const plugin = new MinimalIncidentPlugin();
            const raw = [{
                ...makeEntity("eq-ts-1"),
                // Simulate a timestamp that arrives over the wire as a string
                timestamp: "2025-06-01T12:00:00Z" as unknown as Date,
            }];

            const result = simulateWsClientDispatch(plugin, raw);

            expect(result).not.toBeNull();
            expect(result![0].timestamp).toBeInstanceOf(Date);
        });
    });

    describe("GeoJSON { features: [...] } payload", () => {
        it(
            "normalises a GeoJSON FeatureCollection into GeoEntity[]",
            () => {
                const plugin = new MinimalIncidentPlugin();

                const geojsonPayload = {
                    type: "FeatureCollection",
                    features: [
                        {
                            type: "Feature",
                            geometry: { type: "Point", coordinates: [139.65, 35.68] },
                            properties: { id: "gj-1", magnitude: 4.5 },
                        },
                        {
                            type: "Feature",
                            geometry: { type: "Point", coordinates: [135.50, 34.69] },
                            properties: { id: "gj-2", magnitude: 3.1 },
                        },
                    ],
                };

                const result = simulateWsClientDispatch(plugin, geojsonPayload);

                expect(result).not.toBeNull();
                expect(Array.isArray(result)).toBe(true);
                expect(result).toHaveLength(2);
                // Each feature should have been converted to a GeoEntity with lat/lon
                expect(result![0].latitude).toBeCloseTo(35.68, 2);
                expect(result![0].longitude).toBeCloseTo(139.65, 2);
            }
        );

    });

    describe("subclass override of mapWebsocketPayload", () => {
        /**
         * A subclass that implements mapWebsocketPayload is handled correctly TODAY.
         * This covers the "conflict-events" / "iranwarlive" pattern and must stay green.
         */
        it("calls the subclass override and returns its result regardless of payload shape", () => {
            const plugin = new OverridingIncidentPlugin();

            // Even if the payload is an object (which would normally be dropped), the
            // subclass override is respected.
            const wrappedPayload = {
                source: "conflict-api",
                fetchedAt: "2025-01-01T00:00:00Z",
                items: [makeEntity("conflict-1")],
                totalCount: 1,
            };

            const result = simulateWsClientDispatch(plugin, wrappedPayload);

            // Should return the overriding subclass's fixed result, not the raw items
            expect(result).toStrictEqual(FIXED_ENTITIES);
        });

        it("override is also called for flat array payloads, taking precedence over default handling", () => {
            const plugin = new OverridingIncidentPlugin();
            const flatPayload = [makeEntity("flat-1"), makeEntity("flat-2"), makeEntity("flat-3")];

            const result = simulateWsClientDispatch(plugin, flatPayload);

            // The override always wins — result is FIXED_ENTITIES, not the 3-element flat array
            expect(result).toStrictEqual(FIXED_ENTITIES);
            expect(result).toHaveLength(2);
        });
    });

    describe("BaseIncidentPlugin structural contract", () => {
        it("has mapWebsocketPayload defined", () => {
            const plugin = new MinimalIncidentPlugin();
            expect(typeof (plugin as any).mapWebsocketPayload).toBe("function");
        });

        it("implements the required WorldPlugin lifecycle methods", () => {
            const plugin = new MinimalIncidentPlugin();
            expect(typeof plugin.initialize).toBe("function");
            expect(typeof plugin.destroy).toBe("function");
            expect(typeof plugin.fetch).toBe("function");
            expect(typeof plugin.getPollingInterval).toBe("function");
            expect(typeof plugin.getLayerConfig).toBe("function");
            expect(typeof plugin.renderEntity).toBe("function");
        });

        it("returns polling interval of 0 (WebSocket-only mode)", () => {
            const plugin = new MinimalIncidentPlugin();
            expect(plugin.getPollingInterval()).toBe(0);
        });

        it("returns default layer config with clustering enabled", () => {
            const plugin = new MinimalIncidentPlugin();
            const config = plugin.getLayerConfig();
            expect(config.clusterEnabled).toBe(true);
            expect(config.color).toBe("#ef4444");
            expect(typeof config.clusterDistance).toBe("number");
        });
    });
});
