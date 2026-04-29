import type { ServerPluginConfig } from "@worldwideview/wwv-plugin-sdk";

export default {
    // This is optional if you want the Data Engine to poll for data automatically
    pollingIntervalMs: 60_000,
    
    // Add custom Fastify API routes here
    // Used by the Data Engine to mount your scraper/plugin API
    registerRoutes(server: any) {
        server.get("/api/iss-tracker", async (request: any, reply: any) => {
            return { items: [] };
        });
    }
};
