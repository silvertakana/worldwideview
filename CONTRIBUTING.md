# Contributing to WorldWideView

Thank you for your interest in contributing to **WorldWideView** — a modular, real-time geospatial intelligence engine!

This project is licensed under the [Elastic License 2.0](./LICENSE). By submitting a contribution, you agree that your code will be made available under those same terms.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Plugin Contributions](#plugin-contributions)
- [Code Standards](#code-standards)
- [Commit & Branch Conventions](#commit--branch-conventions)
- [Pull Request Process](#pull-request-process)
- [Running Tests](#running-tests)

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/worldwideview.git
   cd worldwideview
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Generate environment file** (auto-creates `.env.local` with `AUTH_SECRET`):
   ```bash
   pnpm run setup
   ```
5. **Start the dev server**:
   ```bash
   pnpm run dev:all
   ```

Visit `http://localhost:3000` to confirm everything is running.

---

## Development Setup

| Requirement | Version |
|-------------|---------|
| Node.js     | 18+     |
| pnpm        | 8+      |

See [`docs/SETUP.md`](docs/SETUP.md) for detailed environment setup, including Cesium Ion token configuration.

---

## Project Structure

```
src/
  core/         # Core engine: state, data bus, plugin registry
  plugins/      # Data source plugins (ADS-B, AIS, satellites, etc.)
  components/   # React UI components
  hooks/        # Custom React hooks
docs/           # Architecture and user guides
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deep dive into the rendering pipeline and plugin lifecycle.

---

## How to Contribute

Ways you can help:

- 🐛 **Bug fixes** — Check the [issue tracker](https://github.com/silvertakana/worldwideview/issues)
- 🧩 **New plugins** — Add a new data source layer (see below)
- 📖 **Documentation** — Improve guides or add examples
- ⚡ **Performance** — Cesium primitive optimizations, GPU stall reduction
- 🧪 **Tests** — Expand Vitest coverage

For large features, **open an issue first** to discuss the design before writing code.

---

## Plugin Contributions

The core extension point of WorldWideView is its **plugin system**. Each plugin is a self-contained data layer that:

1. Fetches or subscribes to a data source
2. Transforms raw data into Cesium-ready primitives
3. Registers itself with the `PluginRegistry`

See [`docs/PLUGIN_GUIDE.md`](docs/PLUGIN_GUIDE.md) for a full walkthrough. New plugins are very welcome — if you have access to a live geospatial data feed, a plugin is the best way to contribute.

---

## Code Standards

This project follows these principles:

- **Single Responsibility Principle** — each file/module does one thing
- **DRY & SOLID** — avoid duplication, favour composition
- **Clean Architecture** — UI, logic, and data are separate concerns
- **Defensive Programming** — validate inputs, handle edge cases explicitly
- **File size** — keep files under 150 lines; split into modules if needed

Use TypeScript strictly. Avoid `any` unless absolutely unavoidable.

---

## Commit & Branch Conventions

**Branch naming:**
```
feat/short-description
fix/short-description
docs/short-description
refactor/short-description
```

**Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add maritime AIS plugin
fix: resolve camera snap on globe reset
docs: update plugin guide with lifecycle diagram
refactor: extract billboard factory from CesiumMap
```

---

## Pull Request Process

1. Ensure your branch is up to date with `main`.
2. Run tests and confirm they pass: `pnpm test`
3. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md) completely.
4. Request a review — PRs need at least one approval before merging.
5. Squash commits on merge if the history is noisy.

---

## Running Tests

```bash
pnpm test         # Run all tests via Vitest
```

Tests live alongside source files in `__tests__/` directories or as `.test.ts` files.
