# Local Plugins

This directory is a **pnpm workspace** for developing plugins locally without committing them to the main repository.

## Quick Start

```bash
# Scaffold a new plugin
node packages/wwv-cli/dist/index.js create

# Start dev server (auto-discovers local plugins)
pnpm dev
```

## How It Works

1. Plugins here get full SDK type support via `workspace:*` linking
2. The pre-dev script auto-builds each plugin with Vite
3. Built bundles are copied to `public/plugins-local/`
4. The marketplace load API auto-discovers them in dev mode
5. Everything in this directory is gitignored

## Publishing to NPM

When your plugin is ready to share, you can publish it directly to NPM from the root directory:

```bash
node packages/wwv-cli/dist/index.js publish <plugin-name> [--org <your-org>]
```
