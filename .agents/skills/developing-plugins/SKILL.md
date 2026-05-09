---
name: developing-plugins
description: Use when modifying existing plugins, creating new plugins, or troubleshooting why plugin UI/fetch changes are not showing up in the local development environment
---

# Developing Plugins

## Overview
This skill defines the modern `wwv-cli` based workflow for developing plugins in WorldWideView. It completely replaces the legacy methods of manual database syncing, manually patching SQLite, and editing `next.config.ts`. The modern workflow uses hot-reloading Vite bundlers and automated database linking via the `dev-link` API.

## When to Use
- You are writing or modifying code inside `packages/wwv-plugin-*`
- You need to test your plugin changes on the main `localhost:3000` engine
- You are debugging why a plugin UI component (Sidebar, Overlay, fetch logic) is not updating after you changed the code

## Core Pattern: The Sync Workflow

**DO NOT edit Next.js configurations or manually patch SQLite for local plugin dev.**

Instead, use the `link` workflow.

1. **Start the Main Engine:**
   In your engine directory (e.g., `c:\dev\worldwideview`):
   ```bash
   pnpm run dev
   ```

2. **Start the Plugin Watcher:**
   In your plugins directory (e.g., `c:\dev\worldwideview-plugins`):
   ```bash
   pnpm run sync:all
   ```
   *Alternatively, if working inside a single plugin package, run:*
   ```bash
   node ../wwv-cli/dist/index.mjs link
   ```

3. **How it Works:**
   The `link` command automates two critical steps:
   - Starts a Vite bundler in watch mode that recompiles your plugin instantly on every save.
   - Pings `/api/plugins/dev-link` on the main engine to inject the local manifest into the engine's SQLite database. This points the engine directly to your local watch bundle.

4. **Verify:**
   Because plugins are dynamically imported external bundles, Next.js Fast Refresh does not apply to them. **You MUST manually refresh your browser** at `localhost:3000` to see changes after Vite recompiles.

## Common Mistakes

| Excuse / Mistake | Reality |
|------------------|---------|
| "I ran `pnpm build` in the plugin" | The engine won't know about the new bundle unless the database is linked. Use the `link` command or `sync:all`. |
| "I'll manually update the SQLite DB to point to my local file" | The `dev-link` API handles upserting automatically during the link process. |
| "I'm waiting for Next.js to hot-reload my plugin" | External ES modules do not trigger Next.js HMR. You must refresh the browser page manually. |
| "I'll just add my plugin to `transpilePackages`" | This is the legacy declarative workflow. Modern plugins are independent dynamic bundles. |

## Red Flags - STOP and Start Over
- Modifying `next.config.ts` to add a plugin.
- Opening the SQLite database to manually change a plugin URL.
- Writing a script to copy files over without using `wwv-cli link`.

**All of these mean: Revert your manual changes. Start over with `wwv-cli link`.**
