// Mock plugin declaring alert definitions, used by the alerts E2E suite.
// The test drives payloads through the global hook and asks PluginManager to
// refetch, which flows through the real dataBus -> alert engine path.

let payload = [];

globalThis.__setE2eAlertMockPayload = (entities) => {
    payload = Array.isArray(entities) ? entities : [];
};

export default {
    id: "e2e-alert-mock",
    name: "E2E Alert Mock",
    description: "Mock plugin declaring alert definitions for alerts E2E tests.",
    icon: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    category: "custom",
    version: "1.0.0",

    initialize: async () => {},
    destroy: () => {},

    fetch: async () => payload,
    getPollingInterval: () => 60000,

    getLayerConfig: () => ({
        color: "#38bdf8",
        clusterEnabled: false,
        clusterDistance: 50,
    }),

    renderEntity: () => ({
        type: "point",
        color: "#38bdf8",
        size: 5,
    }),

    getAlertDefinitions: () => [
        { key: "magnitude", label: "Magnitude", type: "number" },
        { key: "place", label: "Place", type: "string" },
        { key: "felt", label: "Felt", type: "boolean" },
    ],
};