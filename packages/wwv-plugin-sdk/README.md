# @worldwideview/wwv-plugin-sdk

Plugin SDK for building [WorldWideView](https://github.com/silvertakana/worldwideview) globe plugins. Provides TypeScript types, interfaces, and utilities that all plugins depend on.

## Installation

```bash
npm install @worldwideview/wwv-plugin-sdk
```

## Core Interfaces

| Interface | Purpose |
|---|---|
| `WorldPlugin` | Main plugin contract — lifecycle, data fetching, rendering |
| `GeoEntity` | A positioned object on the globe (lat/lon/alt + properties) |
| `PluginContext` | Host app context injected into every plugin at init |
| `LayerConfig` | Visual layer settings (color, clustering, limits) |
| `CesiumEntityOptions` | Per-entity Cesium rendering options (point, model, etc.) |
| `SelectionBehavior` | Optional trail / fly-to behavior on entity selection |
| `FilterDefinition` | Declarative filter UI (text, select, range, boolean) |
| `ServerPluginConfig` | Server-side API routing and polling config |

## Quick Example

```ts
import type { WorldPlugin, GeoEntity, TimeRange, PluginContext, LayerConfig, CesiumEntityOptions } from "@worldwideview/wwv-plugin-sdk";

export class MyPlugin implements WorldPlugin {
  id = "my-plugin";
  name = "My Plugin";
  description = "A custom WorldWideView plugin";
  icon = "🌍";
  category = "custom";
  version = "1.0.0";

  async initialize(ctx: PluginContext) { /* setup */ }
  destroy() { /* cleanup */ }

  async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
    // Return geo-positioned entities
    return [];
  }

  getPollingInterval() { return 30000; }
  getLayerConfig(): LayerConfig {
    return { color: "#3b82f6", clusterEnabled: true, clusterDistance: 40 };
  }
  renderEntity(entity: GeoEntity): CesiumEntityOptions {
    return { type: "point", color: "#3b82f6", size: 6 };
  }
}
```

## Property Tag Helpers

Wrap entity property values with these helpers so the WorldWideView Intel panel renders them as rich UI elements instead of plain text.

```ts
import { dtProp, urlProp, imageProp, videoProp } from "@worldwideview/wwv-plugin-sdk";
```

| Helper | Wraps | Panel renders as |
|---|---|---|
| `dtProp(iso: string \| null)` | ISO 8601 date string | Expandable datetime row — local time collapsed, UTC + relative time expanded |
| `urlProp(href: string \| null)` | Any URL | Clickable link with external-link icon |
| `imageProp(src: string \| null)` | Image URL | Inline thumbnail |
| `videoProp(href: string \| null)` | Video/stream URL | "Watch" link with play icon |

All helpers are **null-safe**: passing `null`, `undefined`, or `""` returns `null`, which the panel skips cleanly.

```ts
// In your entity mapper:
properties: {
    last_seen:   dtProp(item.timestamp ?? null),
    source_url:  urlProp(item.url ?? null),
    preview:     imageProp(item.image_url ?? null),
    live_stream: videoProp(item.stream ?? null),
    // Plain values need no wrapper
    name: item.name,
    severity: item.severity,
}
```

Values without a tag prefix fall back to plain-text rendering, so existing plugins continue to work unchanged.

## Changelog

- **v1.0.3** — Added README with core interfaces and usage docs.
- **v1.0.2** — Package metadata updates.
- **v1.0.1** — Package configuration fixes.
- **v1.0.0** — Initial release with core types and interfaces.

## License

ISC
