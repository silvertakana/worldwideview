# @worldwideview/wwv-ci-probe

CI probe — asserts plugin/seeder integration health for the WorldWideView ecosystem.

Used by the smoke-test workflows in [`wwv-plugins`](https://github.com/silvertakana/wwv-plugins) and [`wwv-seeders-community`](https://github.com/silvertakana/wwv-seeders-community), and by internal seeders that are not public.

## Install

```bash
# Via npx (recommended in CI)
npx --yes @worldwideview/wwv-ci-probe <subcommand>

# Or as a dev dependency
pnpm add -D @worldwideview/wwv-ci-probe
```

## Subcommands

### `seeder <name>`

Polls Redis for `data:<name>:live` and validates the payload shape. Accepts `GeoEntity[]`, `{ items: [...] }`, or `{ <key>: [...] }`. Use this in seeder CI after booting the data engine against a mock upstream.

```bash
wwv-probe seeder aviation --redis redis://localhost:6379 --timeout 60000
```

### `ws <name>`

Connects to the data engine's `/stream` WebSocket and waits for a `data` message matching the given `pluginId`. Validates the same payload shapes as `seeder`. Use this when you want to assert the engine is broadcasting (not just persisting).

```bash
wwv-probe ws aviation --url ws://localhost:5000/stream --timeout 30000
```

### `id-contract <seederDist>`

Statically validates that a compiled seeder exports a kebab-case `name` (ADR-0002). Optionally checks the name matches an expected id.

```bash
wwv-probe id-contract ./dist/index.mjs --expect aviation
```

## Plugin smoke testing — not in this probe

The probe deliberately does **not** include a `plugin` subcommand. Plugin smoke tests need to exercise the full Next.js + Cesium frontend (plugin bundle loading, `mapWebsocketPayload`, DataBus wiring), which requires a real browser via Playwright.

The `wwv-plugins` repo writes its own Playwright spec for that — it reuses the auth bootstrap pattern from `worldwideview/tests/global.setup.ts` (insert test user + `InstalledPlugin` row, UI login to capture `storageState.json`, then run the plugin-toggle smoke).

Keeping that logic inside `wwv-plugins` avoids coupling this probe to `@playwright/test` and to the specific UI structure of the Next.js frontend.

## Exit codes

- `0` — assertion passed within the timeout
- `1` — assertion failed (timeout exceeded, invalid payload shape, or contract violation)
- `2` — fatal probe error (unhandled exception)
