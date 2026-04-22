<div align="center">

<!-- Generated: 2026-04-19 02:20:00 UTC -->
# WorldWideView 🌍

**The Open-Source, Plugin-Driven Geospatial Intelligence Engine**

[![License: Elastic 2.0](https://img.shields.io/badge/License-Elastic%202.0-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*A modular situational awareness platform designed to ingest live data streams and render them as interactive, cinematic layers on a high-fidelity CesiumJS 3D globe.*

<!-- 📸 Replace with a high-res GIF or screenshot of the platform running with multiple layers enabled -->
![WorldWideView Interface](docs/assets/screenshot.png)

</div>

---

WorldWideView is a real-time geospatial engine visualizing live global data on an interactive 3D globe. Utilizing a dynamic "All-Bundle" plugin architecture, independent data sources—like live aircraft, satellites, or OSINT news clusters—are ingested and rendered decoupled from the core 3D viewer.

---

## 🐋 Self-Hosting & Production Deployment (Docker)

WorldWideView uses a multi-stage Dockerfile designed for standalone output, natively supporting deployment via Coolify or standard Docker Compose. 

### Instant Self-Hosting (Recommended)
Get the platform running on your own server instantly using our automated Docker Compose deployment scripts:

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

### Manual Docker Deployment
If you prefer to deploy manually:
```bash
# Start the core app, Redis cache, and Data Engine microservice in production mode
docker compose up -d
```

**Persistent Storage Requirements:**
When deploying to production, ensure you mount the following volumes to prevent data loss:
- Mount `/app/data` to persist the core SQLite database.
- Mount `/app/packages/wwv-data-engine/data` to persist the custom plugin microservices SQLite layer.
- Mount `/data` to persist the standalone Redis container.

---

## 🚀 Installation & Setup (Local Development)

Get the source code running locally for contributing or modifying the core platform.

### Quick Start Scripts
**Mac/Linux:**
```bash
git clone https://github.com/silvertakana/worldwideview.git
cd worldwideview
bash local-dev.sh
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/silvertakana/worldwideview.git
cd worldwideview
.\local-dev.ps1
```

### Manual Setup
```bash
git clone https://github.com/silvertakana/worldwideview.git
cd worldwideview
pnpm install
pnpm run setup   # generates .env.local with AUTH_SECRET
pnpm run dev:all # boots the UI, cache layers, and the marketplace engine
```
Visit `http://localhost:3000` to see the live globe.

---

## ⚡ Plugin Development Quick Start

WorldWideView’s architecture means **everything is a plugin**. The core engine is completely data-agnostic. Rather than touching complex 3D rendering code, you can build a plugin that simply pipes a REST API into GeoJSON, and the engine handles the rest!

You can build your own WorldWideView plugins without cloning the main repository using the officially supported CLI toolchain.

```bash
# 1. Scaffold a new WWV plugin anywhere on your machine
npx @worldwideview/create-plugin my-custom-layer

# 2. Navigate into your new plugin directory
cd my-custom-layer
npm install

# 3. Stream your local plugin directly into a running WorldWideView instance!
npm run link ../worldwideview

# 4. Check that your configuration is completely valid before publishing
npm run validate
```

📖 **[Read the Full Plugin Guide](docs/PLUGIN_GUIDE.md)** for a deep dive into hooking up websockets or static datasets.

---

## 🧠 Core Architecture & Philosophies

- **Dynamic, Decentralized Plugins**: The plugin ecosystem uses a decentralized architecture fetching ES module CDN bundles (e.g., from unpkg) at runtime. The core engine is a lightweight shell that loads data providers dynamically via the marketplace.
- **High-Performance Rendering**: Engineered for scale using raw Cesium primitives to smoothly handle upwards of 100,000+ objects simultaneously without GPU stalls.
- **Cinematic Situational Awareness**: Implements horizon culling, smooth camera tracking, orientation-locked billboarding, and stack spiderification for dense locations.

### Key Entry Points
- UI Loader: `src/components/layout/AppShell.tsx` 
- Dynamic Plugin Ingestion: `src/core/plugins/loadPluginFromManifest.ts`
- Global WebSocket Event Loop: `src/core/data/DataBus.ts`
- Environment Config: `.env.local` alongside `src/core/edition.ts`

---

## 📚 Documentation Index

- **[Setup & Installation Guide](docs/SETUP.md)**: Detailed environment and local development setup.
- **[Architecture (Engineering Depth)](docs/ARCHITECTURE.md)**: Deep dive into the Cesium rendering pipeline, event data bus, and performance optimizations.
- **[Contributions Guide](CONTRIBUTING.md)**: How to help out, coding standards, and commit conventions.
- **[User Guide](docs/USER_GUIDE.md)**: Application features and navigation tips.

### Internal Engineering Docs
- **[Build System](docs/build-system.md)**: Find compile targets for UI bundles and internal `wwvStaticCompiler` plugin bundling.
- **[Testing Overview](docs/testing.md)**: Understanding Vitest strategies and isolated typing execution targets.
- **[Development Patterns](docs/development.md)**: View standard hook approaches, Zustand architecture rules, and snippet targets.
- **[Deployment Workflows](docs/deployment.md)**: Detailed insights on Next.js standalone execution and persistent database volume arrays.
- **[Source File Catalog](docs/files.md)**: High-level mappings of core ingestion controllers to rendering context interfaces.

---

## 🤝 Contributing & Community

We are actively looking for contributors to help build new data plugins and optimize the core 3D engine!
- Found a bug or have an idea? Search the [Issue Tracker](https://github.com/silvertakana/worldwideview/issues) and submit a report.
- Want to build something? Check out our **[Pinned Plugin Wishlist](https://github.com/silvertakana/worldwideview/issues)** for great first issues!

> **Fair-Use Notice:** This application may contain copyrighted material the use of which has not always been specifically authorized by the copyright owner. Such material is made available for educational purposes, situational awareness, and to advance understanding of global events under "fair use" (Section 107 of the US Copyright Law).
