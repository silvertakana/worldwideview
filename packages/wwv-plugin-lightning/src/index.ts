/**
 * @file index.ts
 * @description Bundle entry for the Lightning Strikes plugin. The host loader
 * (`loadPluginFromManifest`) instantiates the default export, so it must be the
 * WorldPlugin class. Named exports are provided for tests and direct host imports.
 */

import { LightningPlugin } from "./LightningPlugin";

export default LightningPlugin;
export { LightningPlugin };
export type { LightningStrike } from "./types";
export { STRIKE_EVENT } from "./types";
