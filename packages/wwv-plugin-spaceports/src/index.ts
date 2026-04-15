import { Rocket } from "lucide-react";
import { BaseFacilityPlugin } from "@worldwideview/wwv-lib-facilities";

export class SpaceportsPlugin extends BaseFacilityPlugin {
    id = "spaceports";
    name = "Spaceports";
    description = "Space launch sites worldwide from OSM";
    icon = Rocket;
    category = "space" as const;
    version = "1.0.2";
    
    protected defaultLayerColor = "#7c3aed";
    protected maxEntities = 1000;
}
