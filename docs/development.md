<!-- Generated: 2026-04-19 15:23:00 UTC -->
# Development

Development on WorldWideView leverages modern, rigid structural constraints to ensure cross-plugin consistency, extreme browser optimization, and a minimal global footprint. 

New features are designed within isolated workspaces, using SDK structures rather than forcing logic into the core engine.

## Code Style
- **TypeScript Strictness:** Strict types are enforced across all domains (`tsconfig.json` lines 4-20). Any use of `any` inside platform routers is forbidden.
- **Styling constraints:** All CSS is strictly limited to Vanilla CSS via CSS Modules (`.module.css`). Tailwind is prohibited to prevent styling collisions natively with dynamically loaded elements from third-party plugins. (`src/app/globals.css`).

## Common Patterns
- **Env Variable Injection:** Plugins read remote contexts generically instantiated via the SDK.
```typescript
// From wwv-plugin-aviation/src/index.ts:60-70
let engineBase = this.context?.env?.DATA_ENGINE_URL || "https://dataengine.worldwideview.dev";
```
- **Zustand Slices:** The store is heavily splintered based on structural domain, keeping the hook listeners granular so mapping updates don't aggressively trigger `AppShell` root rerenders. (`src/core/state/globeSlice.ts`).

## Workflows
- **Local Database Setup:** Run `pnpm db:reset` to nuke and redeploy the standard Prisma schema across `data/wwv.db`.
- **Generating Plugins:** Use the global CLI `npx @worldwideview/create-plugin@latest <name>` to initialize a decoupled plugin outside of the monorepo.
- **Linking Plugins:** Use `npm run link` in the plugin directory after setting `npx wwv config set wwv-path <path>`.

## Reference
File size is constrained to a 150-line soft cap. Hooks and computational math helpers must be rigorously offloaded (e.g. `src/core/globe/hooks/useModelRendering.ts`).
