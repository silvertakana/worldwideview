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

## Property Conventions

Use the SDK property tag helpers to give the Intel panel rich rendering for dates, URLs, images, and video. Without them, values display as plain text.

```ts
import { dtProp, urlProp, imageProp, videoProp } from "@worldwideview/wwv-plugin-sdk";

properties: {
    // Dates — pass ISO 8601 strings
    updated_at:  dtProp(item.timestamp ?? null),
    // External links
    source_url:  urlProp(item.url ?? null),
    // Images
    preview:     imageProp(item.image_url ?? null),
    // Video/streams
    live_stream: videoProp(item.stream_url ?? null),
    // Plain values — no helper needed
    name:  item.name,
    count: item.count,
}
```

All helpers are null-safe — passing `null` or `undefined` returns `null`, which the panel skips.

See the [SDK README](../packages/wwv-plugin-sdk/README.md) for the full reference.

## Publishing to NPM

When your plugin is ready to share, you can publish it directly to NPM from the root directory:

```bash
node packages/wwv-cli/dist/index.js publish <plugin-name> [--org <your-org>]
```
