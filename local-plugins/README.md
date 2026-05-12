# Local Plugins

This directory is a **pnpm workspace** for developing plugins locally without committing them to the main repository.

## Quick Start

```bash
# Scaffold a new plugin
pnpm wwv create my-plugin --local

# Start dev server (auto-discovers local plugins)
pnpm dev
```

## How It Works

1. Plugins here get full SDK type support via `workspace:*` linking
2. The pre-dev script auto-builds each plugin with Vite
3. Built bundles are copied to `public/plugins-local/`
4. The marketplace load API auto-discovers them in dev mode
5. Everything in this directory is gitignored

## Promoting to a Package

When your plugin is ready to share:

```bash
pnpm wwv link my-plugin
```

This moves it to `packages/` and adds it to version control.
