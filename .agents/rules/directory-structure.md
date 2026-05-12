# Directory Structure & Repositories

## Directory Structure

```
worldwideview/
├── src/
│   ├── app/               # Next.js App Router (pages, API routes, layouts)
│   │   ├── api/           # Server-side API routes (auth, aviation, camera, etc.)
│   │   ├── login/         # Login page
│   │   ├── setup/         # First-time setup page
│   │   └── globals.css    # Root stylesheet
│   ├── components/
│   │   ├── common/        # Shared UI: BootOverlay, FloatingWindow, PluginIcon
│   │   ├── layout/        # AppShell, Header, SearchBar, DataBusSubscriber
│   │   ├── panels/        # LayerPanel, EntityInfoCard, FilterPanel, GraphicsSettings
│   │   ├── timeline/      # Timeline component
│   │   ├── marketplace/   # Plugin install/unverified dialogs
│   │   ├── ui/            # Tooltip, ReloadToast
│   │   └── video/         # Floating video manager
│   ├── core/
│   │   ├── data/          # DataBus, PollingManager, CacheLayer, SmartFetcher
│   │   ├── filters/       # filterEngine (applies plugin filters to entities)
│   │   ├── globe/         # GlobeView, EntityRenderer, AnimationLoop, StackManager,
│   │   │   │                CameraController, InteractionHandler, SelectionHandler,
│   │   │   │                ModelManager, ImageryProviderFactory
│   │   │   └── hooks/     # useCameraActions, useEntityRendering, useModelRendering, etc.
│   │   ├── hooks/         # useBootSequence, useIsMobile, useMarketplaceSync
│   │   ├── plugins/       # PluginManager, PluginRegistry, PluginManifest,
│   │   │   │                loadPluginFromManifest, validateManifest, InstalledPluginsLoader
│   │   │   └── loaders/   # mapJsonToEntities (Legacy loaders like DeclarativePlugin are deprecated)
│   │   └── state/         # Zustand store + slices (config, data, globe, layers, timeline, ui, etc.)
│   ├── lib/               # auth, db, rateLimit, analytics, AIS stream, marketplace APIs
│   ├── plugins/           # GeoJSON plugin registrations
│   ├── styles/            # HUD animations CSS
│   ├── types/             # GeoJSON types, Umami types
│   └── generated/         # Prisma generated client (gitignored)
├── local-plugins/         # Local sandbox for developing plugins (gitignored)
├── packages/              # pnpm monorepo workspace packages
│   ├── wwv-plugin-sdk/    # Plugin SDK: type definitions, manifest schema
│   ├── wwv-plugin-aviation/
│   ├── wwv-plugin-maritime/
│   ├── wwv-plugin-wildfire/
│   ├── wwv-plugin-borders/
│   ├── wwv-plugin-camera/
│   ├── wwv-plugin-military-aviation/
│   ├── wwv-plugin-satellite/
│   ├── wwv-plugin-iranwarlive/   # Standalone plugin with custom endpoints
│   └── wwv-plugin-{airports,embassies,lighthouses,nuclear,seaports,spaceports,volcanoes}/
├── prisma/                # schema.prisma, migrations/
├── public/                # Static assets, Cesium workers, plugin GeoJSON data
├── scripts/               # Build scripts (copy-cesium, scaffold-osm-plugin, setup)
├── data/                  # PostgreSQL data volume (gitignored)
├── Dockerfile             # Multi-stage production build
├── docker-compose.yml     # Main app + data engine runner + local seeders
└── .agents/               # Agent documentation, rules, skills, workflows
```

## Related Repositories

| Repo | Purpose |
|---|---|
| `worldwideview` | Main application (this repo) |
| `wwv-data-engine` | Generic data engine runner (PUBLIC, runs via Docker) |
| `wwv-seeders-community` | Open-source community seeders (PUBLIC) |
| `wwv-seeders-private` | Proprietary seeder scripts (PRIVATE, downloaded in prod) |
| `worldwideview-marketplace` | Plugin marketplace web app |
| `worldwideview-plugins` | Published npm plugin packages (frontend source) |
| `worldwideview-web` | Marketing / landing page |
