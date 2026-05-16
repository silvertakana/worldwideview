// This file is loaded by the plugin manager in the E2E test environment.
// It bypasses the build step and directly uses the host's injected React instance.

export default {
    id: "e2e-mock-bottom-panel",
    name: "E2E Bottom Panel Mock",
    description: "A mock plugin for Bottom Panel E2E testing.",
    icon: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", // Empty SVG as fallback
    category: "custom",
    version: "1.0.0",
    
    // Lifecycle
    initialize: async (ctx) => {
        console.log("[e2e-mock-bottom-panel] Initialized");
    },
    destroy: () => {
        console.log("[e2e-mock-bottom-panel] Destroyed");
    },

    // Data
    fetch: async (timeRange) => {
        return []; // No entities for this mock
    },
    getPollingInterval: () => {
        return 60000;
    },

    // Rendering
    getLayerConfig: () => {
        return {
            color: "#0000FF",
            clusterEnabled: false,
            clusterDistance: 50
        };
    },
    renderEntity: (entity) => {
        return {
            type: "point",
            color: "#0000FF",
            size: 5
        };
    },

    // Provide a bottom panel UI component using the host's React instance
    getBottomPanelComponent: () => {
        // Access React from the global host object injected by WorldWideView
        const React = globalThis.__WWV_HOST__.React;
        
        if (!React) {
            console.error("[e2e-mock-bottom-panel] Failed to resolve React from __WWV_HOST__");
            return null;
        }

        // Return a component function
        return function MockBottomPanel() {
            return React.createElement(
                "div",
                { 
                  "data-testid": "e2e-bottom-panel-content", 
                  style: { 
                    padding: "16px", 
                    background: "rgba(0, 0, 255, 0.1)", 
                    border: "1px solid blue",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  } 
                },
                "Mock Bottom Panel Active"
            );
        };
    }
};
