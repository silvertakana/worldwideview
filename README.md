# WorldWideView

WorldWideView is a real-time geospatial intelligence engine that visualizes live global data on an interactive 3D globe. It leverages a modern Next.js 16 frontend and a decoupled, dynamic plugin architecture to render high-density datasets synchronously.

## Self-Hosting (Docker)
Get the platform running on your own server instantly using Docker Compose:
```bash
mkdir worldwideview && cd worldwideview
curl -fsSL https://raw.githubusercontent.com/silvertakana/worldwideview/main/setup.sh | bash
```

## Local Development
```bash
pnpm install
pnpm run setup
pnpm dev
```

## Key Files
- Main App Layout: `src/app/layout.tsx`
- Globe Visualizer: `src/core/globe/GlobeView.tsx`
- Plugin Registry: `src/core/plugins/PluginManager.ts`
- Environment Config: `.env.local`

## Documentation Links
- [Project Overview](docs/project-overview.md) - High-level goals, tech stack, and core value proposition.
- [Architecture](docs/architecture.md) - Deep dive into event systems, state management, and the plugin ecosystem.
- [Build System](docs/build-system.md) - Production building requirements, monorepo paths, workspace configurations.
- [Testing](docs/testing.md) - Vitest framework usage and automated workflow examples.
- [Development](docs/development.md) - Recommended styles, standard paradigms, and code-formatting limitations.
- [Deployment](docs/deployment.md) - Server orchestration mechanics regarding Coolify and Docker volumes.
- [Files Catalog](docs/files.md) - Directory structures mapped strictly to functional application requirements.
