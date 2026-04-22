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

## 🛠 Prerequisites

Before starting, ensure you have the required tools installed based on how you want to use WorldWideView:
- **For Self-Hosting:** You only need Docker.
- **For Local Development/Contributing:** You need Node.js and `pnpm`.

### Installing Docker (For Self-Hosting)
- **Windows / Mac:** Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/). *(Windows users: Ensure WSL 2 integration is enabled in Settings > Resources > WSL Integration).*
- **Linux (Ubuntu/Debian):**
  ```bash
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  ```

### Installing pnpm (For Developers)
If you want to contribute to the code, you'll need the `pnpm` package manager:
- **Windows (PowerShell):** `iwr https://get.pnpm.io/install.ps1 -useb | iex`
- **Mac / Linux:** `curl -fsSL https://get.pnpm.io/install.sh | sh -`
- **Or via npm:** `npm install -g pnpm`

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

WorldWideView’s architecture means **everything is a plugin**. The core engine is completely data-agnostic. You can build your own WorldWideView plugins using the officially supported CLI toolchain.

### 1. Scaffold your plugin
The plugin folder is pure code. It contains no Docker boilerplate.
```bash
npx @worldwideview/create-plugin my-layer
cd my-layer
npm install
```

### 2. Sideload the plugin into your platform
The CLI acts as a bridge, injecting your compiled plugin directly into your running WorldWideView instance.

**If you are running the platform via Docker:**
Ensure your Docker Compose file has a volume mount exposing the plugin directory:
`volumes: [ "./my-local-plugins:/app/public/plugins-local" ]`
And set the environment variable: `WWV_PLUGIN_DEV=true`

Then, tell the CLI where that exposed folder is:
```bash
# Save the path so you only have to type it once
npx wwv config set wwv-path /absolute/path/to/my-local-plugins

# Start the dev server and link the plugin!
npm run link
```

**If you cloned the platform repository (`pnpm dev`):**
```bash
npx wwv config set wwv-path ../worldwideview
npm run link
```

The CLI will start Vite in watch mode. Every time you save a file, it compiles in milliseconds and pushes the update directly into your WorldWideView instance. Refresh your browser to see changes!

### 3. Validate & Publish
If you are building a simple, static data layer and don't need local testing:
```bash
npm run validate
npm run build
npm publish
```

📖 **[Read the Full Plugin Guide](docs/PLUGIN_GUIDE.md)** for a deep dive into hooking up websockets or static datasets.

---

## 🧠 Core Architecture & Philosophies

- **Open-Core Data Engine**: The real-time backend data pipeline operates on a public/private split-routing model. Community seeders (like ISS tracking) live in the open-source `wwv-data-engine`, while proprietary sources seamlessly interleave via our internal cloud endpoints.
- **Dynamic, Decentralized Plugins**: The plugin ecosystem uses a decentralized architecture fetching ES module CDN bundles (e.g., from unpkg) at runtime. The core engine is a lightweight shell that loads data providers dynamically via the marketplace.
- **High-Performance Rendering**: Engineered for scale using raw Cesium primitives to smoothly handle upwards of 100,000+ objects simultaneously without GPU stalls.
- **Cinematic Situational Awareness**: Implements horizon culling, smooth camera tracking, orientation-locked billboarding, and stack spiderification for dense locations.

---

## 🏛 Repository Ecosystem

WorldWideView follows an **Open-Core** philosophy distributed across several independent, specialized repositories:

1. **[worldwideview](https://github.com/silvertakana/worldwideview)** *(This Repo)*
   The main Next.js frontend, CesiumJS rendering engine, and core plugin loading framework.
2. **[wwv-data-engine](https://github.com/silvertakana/wwv-data-engine)**
   The open-source community data backend. It polls public APIs (like ISS tracking or USGS earthquakes) and streams them to the frontend via WebSocket. 
   *(Note: The official production deployment uses a proprietary internal fork of this engine that includes additional restricted seeders like aviation and maritime).*
3. **[worldwideview-plugins](https://github.com/silvertakana/worldwideview-plugins)**
   Our first-party maintained plugins (borders, nuclear sites, military bases, etc.) developed directly by the core team.
4. **[worldwideview-marketplace](https://github.com/silvertakana/worldwideview-marketplace)**
   The web application driving the plugin directory and community submissions.
5. **[worldwideview-web](https://github.com/silvertakana/worldwideview-web)**
   The marketing, documentation, and landing site.

---

## 🏗 Development & Code Map

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
