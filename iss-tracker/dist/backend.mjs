const s = {
  // This is optional if you want the Data Engine to poll for data automatically
  pollingIntervalMs: 6e4,
  // Add custom Fastify API routes here
  // Used by the Data Engine to mount your scraper/plugin API
  registerRoutes(e) {
    e.get("/api/iss-tracker", async (t, r) => ({ items: [] }));
  }
};
export {
  s as default
};
