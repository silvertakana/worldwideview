/**
 * Built-in plugin registration.
 * Importing this module registers all 12 built-in plugins into the PluginRegistry
 * as a module-level side effect.
 *
 * Import ONCE from AppShell before pluginRegistry.getAll() is called.
 */
import { pluginRegistry } from "@/core/plugins/PluginRegistry";

import { flightsPlugin }    from "./flights";
import { weatherPlugin }    from "./weather";
import { newsPlugin }       from "./news";
import { earthquakesPlugin } from "./earthquakes";
import { capitalsPlugin }   from "./capitals";
import { shipsPlugin }      from "./ships";
import { warZonesPlugin }   from "./warzones";
import { stocksPlugin }     from "./stocks";
import { issPlugin }        from "./iss";
import { volcanoesPlugin }  from "./volcanoes";
import { disastersPlugin }  from "./disasters";
import { lightningPlugin }  from "./lightning";

// Register all built-in plugins with the registry.
// Order determines display order in the sidebar.
pluginRegistry.register(flightsPlugin);
pluginRegistry.register(weatherPlugin);
pluginRegistry.register(newsPlugin);
pluginRegistry.register(earthquakesPlugin);
pluginRegistry.register(capitalsPlugin);
pluginRegistry.register(shipsPlugin);
pluginRegistry.register(warZonesPlugin);
pluginRegistry.register(stocksPlugin);
pluginRegistry.register(issPlugin);
pluginRegistry.register(volcanoesPlugin);
pluginRegistry.register(disastersPlugin);
pluginRegistry.register(lightningPlugin);
