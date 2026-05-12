<!-- Generated: 2026-04-23 06:11:00 UTC -->
# Quickstart: Creating Your First Plugin

Welcome to WorldWideView plugin development! This tutorial will guide you through creating your first custom data layer on the 3D globe. 

By the end of this guide, you will have a working plugin that plots real-time data on the WorldWideView map.

## 1. Prerequisites

Before you start, ensure you have:
- Node.js ≥ 18
- `npm` or `pnpm` installed
- A running instance of WorldWideView on your local machine (running at `http://localhost:3000`).

## 2. Scaffold Your Plugin

WorldWideView plugins are built as standard packages within the monorepo workspace. To generate a new plugin sandbox, use the official interactive CLI from the root of your `worldwideview` repository:

```bash
node packages/wwv-cli/dist/index.js create --local
```

The CLI will launch an interactive survey to configure your plugin:
1. **Unique ID**: `my-first-plugin`
2. **Display Name**: `My First Data Layer`
3. **Description**: `A simple example plugin.`
4. **Category**: `Custom`
5. **Data Architecture**: `REST Polling / Static Data (Frontend only)`
6. **Globe Rendering**: `Map Point`

This automatically creates a lightweight Vite-based project pre-configured with the `@worldwideview/wwv-plugin-sdk` inside the `local-plugins/wwv-plugin-my-first-plugin/` directory.

Once the scaffolding completes, install the dependencies:
```bash
pnpm install
```

## 3. Develop Your Plugin

Because your plugin is created inside the `local-plugins/` directory, it is automatically recognized by the pnpm workspace.

To see your plugin live on the globe while you develop, simply start the standard development servers from the repository root:

```bash
pnpm dev:all
```

The `dev:all` command automatically starts the frontend, the data engine, and the `dev:plugins` watcher. This watcher will automatically rebuild your plugin whenever you save a file in `local-plugins/`.

> [!TIP]
> **Debugging Registration Issues:** If your plugin doesn't appear in the WorldWideView "Installed Plugins" list, check your `package.json` inside your local plugin folder. Ensure `id`, `name`, and `version` are populated correctly. Also verify that you ran `pnpm install` from the workspace root.

## 4. Explore the Code

Open `src/index.ts` in your text editor. You'll see a class that implements the `WorldPlugin` interface:

```typescript
import type { WorldPlugin, GeoEntity, PluginContext, LayerConfig, CesiumEntityOptions } from "@worldwideview/wwv-plugin-sdk";

export class MyFirstPlugin implements WorldPlugin {
  id = "my-first-plugin";
  name = "My First Data Layer";
  description = "A simple example plugin.";
  icon = "MapPin"; 
  category = "custom" as const;
  version = "1.0.0";

  async initialize(ctx: PluginContext): Promise<void> {
    console.log("Plugin initialized!");
  }

  destroy(): void { }

  async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
    // Generate a single dummy point over Paris
    return [{
      id: "test-point-1",
      pluginId: this.id,
      latitude: 48.8566,
      longitude: 2.3522,
      timestamp: new Date(),
      properties: { name: "Hello World" },
    }];
  }

  getPollingInterval(): number {
    return 60_000; // Fetch every 60 seconds
  }

  getLayerConfig(): LayerConfig {
    return {
      color: "#ff0000",
      clusterEnabled: false,
      clusterDistance: 40,
    };
  }

  renderEntity(entity: GeoEntity): CesiumEntityOptions {
    return {
      type: "point",
      color: "#ff0000",
      size: 15,
      outlineColor: "#ffffff",
      outlineWidth: 2
    };
  }
}
```

## 5. View Your Plugin

1. Ensure your WorldWideView main application is running (`pnpm dev` or `pnpm dev:all` in the main repo).
2. Open your browser to `http://localhost:3000`.
3. Open the **Layers** panel on the left sidebar.
4. Locate "My First Data Layer" and toggle it on.
5. The globe will fly to Paris, and you should see a red dot!

> [!WARNING]
> **Debugging Missing Points:** If the layer is toggled on but you don't see the point:
> 1. Check your browser's Developer Console (F12) for any `DataBus` errors.
> 2. Ensure your `fetch()` method returns an array of `GeoEntity` objects with valid `latitude` and `longitude` properties.
> 3. Verify that your `renderEntity()` function returns a valid type (`point`, `billboard`, etc.).

## Next Steps

Congratulations! You've successfully built and linked your first plugin.

For advanced features—like real-time WebSocket streaming, creating backend seeders using the `local-seeders` sandbox, or publishing your plugin to the global Marketplace—proceed to the **[Advanced Plugin Guide](docs/plugin-advanced.md)**.
