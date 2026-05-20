# ADR-0002: Source-of-truth for plugin identity and registration

## Status
Accepted

## Date
2026-05-20

## Context

Two related problems in the plugin system surfaced in the same period, and both have the same root cause: canonical plugin information was being derived in middleware translation layers (folder names, hard-coded lists) rather than at its proper source. Each problem is fixed by pushing the canonical truth back to its rightful owner and removing the static translation in the middle. Documenting them together makes the shared principle explicit and discourages future regressions of the same shape.

### Problem 1 — Engine seeder ID derived from folder name

The WorldWideView local data engine discovers seeders by scanning the filesystem under `/app/seeders`. Historically, the engine assigned each seeder an ID equal to its **folder name** (e.g., the folder `gpsjam/` became plugin ID `"gpsjam"`).

The frontend, however, identifies plugins by a separate **`id` field** declared in each plugin class (e.g., `"gps-jamming"`). The engine's `/manifest` endpoint listed available plugins using folder-derived IDs, and the frontend's `localEngineHasPlugin(pluginId)` performed an exact string match against that list.

This created a silent failure mode: six seeders had folder names that did not match their corresponding frontend plugin IDs:

| Folder name | Frontend plugin `id` |
|---|---|
| `gpsjam/` | `gps-jamming` |
| `sanctions/` | `international-sanctions` |
| `wildfires/` | `wildfire` |
| `civilUnrest/` | `civil-unrest` |
| `conflictEvents/` | `conflict-events` |
| `cyberAttacks/` | `cyber-attacks` |

When `localEngineHasPlugin('gps-jamming')` returned `false` (because the manifest listed `"gpsjam"`), the frontend silently fell through to the production cloud engine, bypassing the local engine entirely. The bug was invisible — no error, just incorrect routing.

A short-term patch introduced `SEEDER_ID_ALIASES` in `src/core/data/engineManifest.ts` — a frontend translation map from folder names to plugin IDs. This was explicitly a band-aid: it duplicated knowledge in a consumer rather than fixing the contract at the source, and would go stale as new seeders were added.

The engine's TypeScript source (`seeder-loader.ts`) also had a `toKebabCase()` helper intended to normalize camelCase folder names (e.g., `civilUnrest` → `civil-unrest`), but its compiled `dist/` was stale (the production image had not been rebuilt to include it), and `toKebabCase` alone cannot resolve abbreviation mismatches like `gpsjam` → `gps-jamming`.

### Problem 2 — Fresh-install plugin set hard-coded

The marketplace auto-seeder ([src/lib/marketplace/seedDefaultPlugins.ts](../../../src/lib/marketplace/seedDefaultPlugins.ts)) writes a starter set of plugins to the database on first boot so the globe isn't empty on day one. The list of plugins to seed lived in a hard-coded constant `DEFAULT_PLUGIN_IDS` ([src/lib/marketplace/defaultPlugins.ts](../../../src/lib/marketplace/defaultPlugins.ts)).

Two failure modes followed from the static list:

1. **Drift**: ten plugins were published to npm under `@worldwideview/*` and verified — surveillance-satellites, military-bases, embassies, seaports, lighthouses, spaceports, iranwarlive, undersea-cables, mineral-mines, nuclear-facilities — but never added to `DEFAULT_PLUGIN_IDS`. Fresh installs missed them silently.
2. **Phantom 404s**: two entries in the list (`fortiguard`, `nz-traffic-cameras`) were dev-only sandboxes in `local-plugins/`, never published to npm. Every fresh boot hit `https://marketplace.worldwideview.dev/api/plugins/fortiguard` → 404, logged a warning, and continued. The branch `fix/diagnose-plugins-404` was opened to diagnose those.

A separate, signed verified-plugins registry already existed at `marketplace.worldwideview.dev/api/registry`, loaded by [registryClient.ts](../../../src/lib/marketplace/registryClient.ts) with Ed25519 verification. It was used for trust-stamping installed plugins but not for selecting which plugins to seed. That registry is the authoritative list of plugins that have been reviewed and verified — exactly the list a starter set should come from.

### Shared shape

Both problems wrap the same anti-pattern: a consumer (frontend, seeder) maintains a static translation/list derived from the producer's actual identity (seeder export, npm publication). The translation drifts. The fix in both cases is the same: stop translating in the consumer; let the producer declare the truth and consume it directly.

## Decisions

### Decision 1 — The seeder's exported `name` field is the canonical plugin ID

The engine reads each seeder's `dist/index.mjs` default export's `name` property and uses it as the plugin ID everywhere:

- `/manifest` endpoint `plugins` array
- WebSocket welcome message plugin list
- WebSocket data message `pluginId` field
- Redis key (`data:<name>:live`)
- Scheduler logs

The folder name is used only as a filesystem fallback if the seeder exports no `name`. The engine logs a warning at startup whenever the kebab-cased folder name differs from the seeder's exported `name`, making drift visible without blocking startup.

**Contract:** Every seeder MUST export a `name` field that exactly equals the corresponding frontend plugin's `id` field (kebab-case). This is a two-place contract: declare the same ID string in the seeder export and in the frontend plugin class.

Implementation: `seeder-loader.ts` was updated to set `id = seederConfig.name || toKebabCase(folderName)` instead of `id = toKebabCase(folderName)`. The frontend `SEEDER_ID_ALIASES` map was removed entirely. No translation layer exists between the engine's manifest and the frontend's plugin lookup.

### Decision 2 — The signed verified registry is the source-of-truth for fresh-install auto-seeding

The marketplace auto-seeder iterates the set returned by `getVerifiedPluginIds()` (the signed registry) instead of a hard-coded `DEFAULT_PLUGIN_IDS` constant. Publishing a plugin to the verified registry automatically makes it part of the fresh-install starter set on subsequent boots, with no code change.

The static `DEFAULT_PLUGIN_IDS` list is deleted. There is no fallback list in code — if the registry is unreachable on first attempt, the seeder defers without marking-seeded so the next request retries (the 5-min in-memory cache in `registryClient.ts` bounds the request rate during outages).

Trust stamping is collapsed: every plugin landed by the seeder is `verified` by definition, so the per-plugin `verified.has(pluginId)` check inside the seeder is dropped — `manifest.trust = "verified"` is set directly.

**Contract:** A plugin is part of the fresh-install starter set iff it appears in the signed verified-plugins registry. There is no other list to maintain.

## Shared principle

> **Canonical plugin truth lives at the source. Reject static translation/lookup layers in the middle.**

This is the architectural rule both decisions encode. Concrete corollaries for future contributions:

- Don't introduce a static map in a consumer to compensate for a producer that mis-labels itself. Fix the producer.
- Don't introduce a static list in code to enumerate what a registry or filesystem already enumerates. Read from the registry/filesystem.
- A translation layer that "just needs an entry added each time we publish a plugin" is a foot-gun — it will silently drift the moment someone forgets.

## Alternatives Considered

### For Decision 1

#### Folder renames (rejected as primary fix)
Rename the six mismatched folders to match their frontend plugin IDs (e.g., `gpsjam/` → `gps-jamming/`). This would make the folder name the canonical ID.

- **Rejected as primary fix** because Windows Docker Desktop holds NTFS volume mount locks on running containers, making renames impossible without a full Docker Desktop shutdown. More importantly, it makes the canonical ID fragile — any accidental folder rename breaks routing silently.
- Folder renames remain a cosmetic cleanup option, now that the seeder export is the actual source of truth.

#### Frontend alias map (`SEEDER_ID_ALIASES`)
Maintain a static mapping in `engineManifest.ts` that translates engine-reported IDs to frontend plugin IDs.

- **Rejected** because it puts translation responsibility on the consumer rather than the producer. Every new seeder with a naming mismatch requires a manual alias entry. The map goes stale silently — no warning if an alias is wrong or missing.

#### `toKebabCase()` normalization only
Apply `toKebabCase()` to folder names in the engine and rely on the convention that folder names encode the plugin ID in camelCase.

- **Rejected** because `toKebabCase` cannot resolve abbreviation mismatches (`gpsjam` → still `gpsjam`, not `gps-jamming`) or singular/plural differences (`wildfires` → still `wildfires`, not `wildfire`). It only handles camelCase-to-kebab conversion.

#### Strict validation with engine startup failure
Refuse to load any seeder whose folder name doesn't match its exported `name`, blocking startup until inconsistencies are resolved.

- **Rejected** as too aggressive for a local dev environment. A warning is sufficient — startup continues, mismatches are visible, and the system keeps working.

### For Decision 2

#### Add the missing 10 IDs to `DEFAULT_PLUGIN_IDS` (rejected)
Extend the static list to include the newly-published plugins.

- **Rejected** because it ships a fix that resolves the immediate symptom while preserving the underlying drift mechanism. The list would go stale again the next time a plugin is published.

#### Hybrid: registry as default + static fallback list
Read from the registry; fall back to a hard-coded list if the registry is empty/unreachable.

- **Rejected** because it reintroduces the static list as a permanent shadow source-of-truth. Fallback lists go stale silently. The chosen "defer seeding on empty registry" behavior is safer — fresh installs retry on the next request rather than locking in a stale set.

#### Delete auto-seeding entirely (rejected)
Drop the seeder and let users install everything from the marketplace UI starting from an empty globe.

- **Rejected** because fresh installs should have something to look at on day one. The user explicitly stated this requirement: "we want the user to have something to get started with."

## Consequences

### Easier

**Decision 1 — engine seeder identity**
- Self-documenting identity. Reading any seeder's `src/index.ts` immediately tells you its plugin ID. No external registry to consult.
- Filesystem layout is irrelevant. Folders can be named for readability or organized in subdirectories without affecting routing.
- No translation layers. The frontend receives the correct ID directly from the manifest; `localEngineHasPlugin()` works with a direct string comparison.
- Drift is visible. The engine warns on startup when folder names diverge from exported names, catching mistakes during development rather than silently at runtime.
- Adding a new seeder requires only: (1) export `name: '<plugin-id>'` matching the frontend plugin's `id`, (2) no registration step, no alias map entry.

**Decision 2 — marketplace seeding**
- Publishing a plugin to the verified registry is sufficient to add it to the starter set. No code change, no PR to add an ID to a constant.
- Phantom 404s are gone. The seeder only queries IDs that exist in the verified registry, which by construction reflects what's actually published.
- Trust semantics align. "Verified" and "auto-seeded on fresh install" are now the same condition, not two near-overlapping lists that can drift.
- Registry outages no longer brick fresh installs. The deferral semantics ensure the seeder retries instead of marking-seeded with zero rows.

### Harder

**Decision 1 — engine seeder identity**
- Seeder author bears responsibility. If a seeder exports the wrong `name`, routing fails silently (same failure mode as before, but now localized to the seeder rather than the folder). The startup warning mitigates this.
- Contract validation is advisory, not enforced. There is no build-time check that the seeder's `name` matches an actual frontend plugin `id`. A validation script (`scripts/validate-seeder-ids.mjs`) is the recommended mitigation.
- Engine image must be kept up to date. The fix lives in `dist/seeder-loader.js` inside the Docker image. If the published `ghcr.io/silvertakana/wwv-data-engine:latest` image is behind the local source, the behavior reverts to folder-name-based IDs. Local changes require `docker cp` injection or an image rebuild until the fix is published.

**Decision 2 — marketplace seeding**
- The verified registry must be kept accurate. A newly-published plugin doesn't auto-seed until it's added to the registry and the registry is re-signed. Operational responsibility shifts from "remember to add the ID to a code constant" to "remember to add the ID to the registry" — a similar discipline, but now at the right layer (the marketplace, not the consumer).
- Existing instances are not back-filled. Users whose `Setting` table already has `defaults_seeded=true` will not automatically receive newly-verified plugins; they must install via the marketplace UI. This is by design — re-seeding could reinstall plugins a user explicitly uninstalled.
- Dev-only sandboxes (`local-plugins/<name>/`) no longer "tag along" via the default list. `fortiguard` and `nz-traffic-cameras` only reach users once published to npm and added to the verified registry. The local-plugins folder discovery in `/api/marketplace/load` still surfaces them in dev (`NODE_ENV=development` or `WWV_PLUGIN_DEV=true`).
