<div align="center">

# WorldWideView 🌍

**The Open-Source, Plugin-Driven Geospatial Intelligence Engine**

[![License: Elastic 2.0](https://img.shields.io/badge/License-Elastic%202.0-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*A modular situational awareness platform designed to ingest live data streams and render them as interactive, cinematic layers on a high-fidelity CesiumJS 3D globe.*

<!-- 📸 Replace with a high-res GIF or screenshot of the platform running with multiple layers enabled -->
![WorldWideView Interface](docs/assets/screenshot.png)

</div>

---

## ⚡ Build a Plugin in 5 Minutes

WorldWideView’s architecture means **everything is a plugin**. The core engine is completely data-agnostic. Rather than touching complex 3D rendering code, you can build a plugin that simply pipes a REST API into GeoJSON, and the engine handles the rest!

Ready to add a new intelligence layer (like Earthquakes, Weather, or Satellites)? We have a scaffold generator ready for you:

```bash
# 1. Generate the boilerplate plugin from a template
pnpm exec create-wwv-plugin my-new-data-source

# 2. Add your data fetching logic in the generated files
# 3. Reload the dev server and watch it map on the globe!
```

📖 **[Read the Full Plugin Guide](docs/PLUGIN_GUIDE.md)** for a deep dive into hooking up websockets or static datasets.

---

## 🚀 Installation & Setup (Local Development)

```bash
git clone https://github.com/silvertakana/worldwideview.git
cd worldwideview
pnpm install
pnpm run setup   # generates .env.local with AUTH_SECRET
pnpm run dev:all # starts the app, data engine, and marketplace concurrently
```

Visit `http://localhost:3000` to see the live globe.

---

## 🐋 Production Deployment (Docker & Coolify)

WorldWideView uses a multi-stage Dockerfile designed for standalone output, natively supporting deployment via Coolify or standard Docker Compose. The `docker-compose.yml` spins up the front-end application alongside the high-performance Data Engine and Redis cache.

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

## 🧠 Core Architecture & Philosophies

- **Modular Intelligence**: Independent plugins supply the data. The core engine remains lightweight and isolated.
- **High-Performance Rendering**: Engineered for scale using raw Cesium primitives to smoothly handle upwards of 100,000+ objects simultaneously without GPU stalls.
- **Cinematic Situational Awareness**: Implements horizon culling, smooth camera tracking, orientation-locked billboarding, and stack spiderification for dense locations.

---

## 📚 Documentation Index

- **[Setup & Installation Guide](docs/SETUP.md)**: Detailed environment and local development setup.
- **[Architecture (Engineering Depth)](docs/ARCHITECTURE.md)**: Deep dive into the Cesium rendering pipeline, event data bus, and performance optimizations.
- **[Plugin Guide](docs/PLUGIN_GUIDE.md)**: Full walkthrough for building custom data layer plugins.
- **[API Reference](docs/API_REFERENCE.md)**: Technical reference for internal services (DataBus, PluginRegistry, CacheLayer).
- **[Contributions Guide](CONTRIBUTING.md)**: How to help out, coding standards, and commit conventions.
- **[User Guide](docs/USER_GUIDE.md)**: Application features and navigation tips.

---

## 🤝 Contributing & Community

We are actively looking for contributors to help build new data plugins and optimize the core 3D engine!
- Found a bug or have an idea? Search the [Issue Tracker](https://github.com/silvertakana/worldwideview/issues) and submit a report.
- Want to build something? Check out our **[Pinned Plugin Wishlist](https://github.com/silvertakana/worldwideview/issues)** for great first issues!

> **Fair-Use Notice:** This application may contain copyrighted material the use of which has not always been specifically authorized by the copyright owner. Such material is made available for educational purposes, situational awareness, and to advance understanding of global events under "fair use" (Section 107 of the US Copyright Law).
