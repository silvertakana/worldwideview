<div align="center">

<!-- Generated: 2026-04-23 06:11:00 UTC -->
# WorldWideView

**The Open-Source, Plugin-Driven Geospatial Intelligence Engine**

*A modular situational awareness platform designed to ingest live data streams and render them as interactive, cinematic layers on a high-fidelity CesiumJS 3D globe.*

![WorldWideView Interface](docs/assets/screenshot.png)

</div>

---

WorldWideView is a real-time geospatial engine visualizing live global data on an interactive 3D globe. Utilizing a dynamic "All-Bundle" plugin architecture, independent data sources—like live aircraft, maritime vessels, or conflict events—are ingested and rendered decoupled from the core 3D viewer.

## Core Technologies

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5
- **3D Engine:** CesiumJS + Resium (Google Photorealistic 3D Tiles)
- **State Management:** Zustand
- **Event Bus:** Custom typed `DataBus` for high-frequency WebSocket updates
- **Database:** SQLite via Prisma (local), PostgreSQL (cloud)
- **Deployment:** Docker multi-stage build, Coolify

## Quick Start (Self-Hosting)

WorldWideView uses a multi-stage Dockerfile designed for standalone output. To deploy instantly on your own server:

**Mac/Linux:**
```bash
mkdir worldwideview && cd worldwideview
curl -fsSL https://raw.githubusercontent.com/silvertakana/worldwideview/main/setup.sh | bash
```

**Windows (PowerShell):**
```powershell
mkdir worldwideview; cd worldwideview
Invoke-WebRequest -Uri https://raw.githubusercontent.com/silvertakana/worldwideview/main/setup.ps1 -UseBasicParsing | Invoke-Expression
```

> [!NOTE]
> Ensure you mount the `/app/data` volume to persist the SQLite database across container restarts.

## Quick Start (Local Development)

To run the source code locally for contributing or developing:

```bash
git clone https://github.com/silvertakana/worldwideview.git
cd worldwideview
pnpm install
pnpm run setup   # generates .env.local with AUTH_SECRET
pnpm run dev:all # boots the UI, cache layers, and the data engine
```
Visit `http://localhost:3000` to see the live globe.

## Plugin Ecosystem

WorldWideView operates on an open-core philosophy. The platform itself is data-agnostic; all data sources are dynamically imported as plugins at runtime.

- **[Plugin Quickstart Guide](docs/plugin-quickstart.md)**: Learn how to scaffold and link your first plugin using the `@worldwideview/cli`.
- **[Advanced Plugin Guide](docs/plugin-advanced.md)**: Deep dive into microservice data seeders, WebSockets, complex 3D rendering, and Marketplace publishing.

## Repository Ecosystem

WorldWideView is distributed across several specialized repositories:

1. **`worldwideview`** (This Repo): Main frontend, CesiumJS rendering engine, and core plugin framework.
2. **`wwv-data-engine`**: Open-source community data backend for polling public APIs.
3. **`worldwideview-plugins`**: First-party maintained plugins.
4. **`worldwideview-marketplace`**: The web application driving the plugin directory.
5. **`worldwideview-web`**: Marketing and landing site.

## Documentation Index

Explore our comprehensive documentation suite for detailed engineering insights:

- **[Project Overview](docs/project-overview.md)**: High-level value proposition and technology stack.
- **[Architecture](docs/architecture.md)**: DataBus event stream and Zustand state management.
- **[Build System](docs/build-system.md)**: Monorepo structure, Next.js standalone output, and Docker builds.
- **[Development](docs/development.md)**: Coding conventions and common implementation patterns.
- **[Testing](docs/testing.md)**: Vitest setup and coverage targets.
- **[Deployment](docs/deployment.md)**: Coolify integration and persistent volumes.
- **[Files Catalog](docs/files.md)**: Comprehensive mapping of core source files.

> [!IMPORTANT]
> **Fair-Use Notice:** This application may contain copyrighted material the use of which has not always been specifically authorized by the copyright owner. Such material is made available for educational purposes, situational awareness, and to advance understanding of global events under "fair use" (Section 107 of the US Copyright Law).
