# WorldWideView

**WorldWideView** is a modular, real-time geospatial intelligence engine built on top of a CesiumJS 3D globe. It is designed to ingest live data streams, transform them through a generalized plugin system, and render them as high-performance visual layers.

As a real-time situational awareness platform, it turns raw geospatial signals—such as aircraft positions, maritime AIS, or satellite orbits—into interactive, cinematic layers on a high-fidelity 3D globe.

## Key Philosophies

- **Modular Intelligence**: Every data source is a plugin. The core engine is data-agnostic.
- **High-Performance Rendering**: Engineered for scale using Cesium primitives to handle 100,000+ objects smoothly.
- **Situational Awareness**: Designed for real-time updates and cinematic visualization (orientated icons, smooth tracking).
- **Extensible & Open**: Add new intelligence layers without touching the core architecture.

## Quick Start

```bash
git clone https://github.com/silvertakana/worldwideview.git
cd worldwideview
pnpm install
pnpm run setup   # generates .env.local with AUTH_SECRET
pnpm run dev:all # starts the app, data engine, and marketplace concurrently
```

Visit `http://localhost:3000` to see the live globe.

## Fair-Use Notice

This application may contain copyrighted material the use of which has not always been specifically authorized by the copyright owner. Such material is made available for educational purposes, situational awareness, and to advance understanding of global events. It is believed that this constitutes a "fair use" of any such copyrighted material as provided for in section 107 of the US Copyright Law.

## Key Documentation Sections

- **[Setup & Installation Guide](docs/SETUP.md)**: Detailed environment and local development setup.
- **[Architecture (Engineering Depth)](docs/ARCHITECTURE.md)**: Deep dive into the Cesium rendering pipeline, event data bus, and performance optimizations.
- **[Plugin System Guide](docs/PLUGIN_GUIDE.md)**: How to build and register custom data layers.
- **[User Guide](docs/USER_GUIDE.md)**: Application features and navigation tips.

---

For a full list of resources, see the **[Documentation Index](docs/index.md)**.
