import type {
  WorldPlugin, PluginContext, GeoEntity,
  CesiumEntityOptions, TimeRange, LayerConfig, PluginCategory
} from "@worldwideview/wwv-plugin-sdk";
import { Satellite } from "lucide-react";
import pkg from "./package.json";

export default class IssPlugin implements WorldPlugin {
  id = "iss";
  name = "ISS Tracker";
  description = "Real-time International Space Station tracking";
  icon = Satellite;
  category: PluginCategory = "space";
  version = pkg.version;

  async initialize(ctx: PluginContext): Promise<void> {}

  destroy(): void {}

  async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
    return []; // WS-only plugin
  }

  getPollingInterval(): number {
    return 0; // WS-only
  }

  getLayerConfig(): LayerConfig {
    return {
      color: "#ffffff",
      clusterEnabled: false,
      maxEntities: 1,
    };
  }

  renderEntity(entity: GeoEntity): CesiumEntityOptions {
    return {
      type: "point",
      color: "#ffffff",
      size: 10,
      outlineColor: "#3b82f6",
      outlineWidth: 2,
    };
  }
}
