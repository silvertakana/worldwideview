import { Landmark } from "lucide-react";
import { BaseFacilityPlugin } from "@worldwideview/wwv-lib-facilities";

export class EmbassiesConsulatesPlugin extends BaseFacilityPlugin {
    id = "embassies";
    name = "Embassies & Consulates";
    description = "Global embassies, consulates, and diplomatic missions from OpenStreetMap";
    icon = Landmark;
    category = "infrastructure" as const;
    version = "1.0.3";
    
    protected defaultLayerColor = "#a855f7";
    protected maxEntities = 1000;
}
