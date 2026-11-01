/* eslint-disable react-hooks/immutability -- Cesium scene objects are mutated in place by design */
/**
 * @file useSceneBackdrop.ts
 * @description Matches the Cesium scene backdrop to the UI theme. Light themes
 * drop the star field and atmosphere so the globe sits on a flat light-grey
 * field, the way Foundry's map does; dark themes keep the space backdrop.
 */

import { useEffect } from "react";
import { Color, type Viewer as CesiumViewer } from "cesium";

/** Muted grey-blue "ocean" field, matching the Light Gray Canvas water tone. */
const LIGHT_BACKDROP = "#ced5db";

export function useSceneBackdrop(
    viewer: CesiumViewer | null,
    viewerReady: boolean,
    theme: string,
) {
    useEffect(() => {
        if (!viewer || !viewerReady || viewer.isDestroyed()) return;
        const { scene } = viewer;
        const flat = theme === "light";

        if (scene.skyBox) scene.skyBox.show = !flat;
        if (scene.skyAtmosphere) scene.skyAtmosphere.show = !flat;
        if (scene.sun) scene.sun.show = !flat;
        if (scene.moon) scene.moon.show = !flat;
        // Fog and the ground-atmosphere haze wash a light basemap out to near
        // white; Foundry's map is crisp and flat, so drop both on light themes.
        scene.fog.enabled = !flat;
        scene.globe.showGroundAtmosphere = !flat;
        scene.backgroundColor = flat ? Color.fromCssColorString(LIGHT_BACKDROP) : Color.BLACK;
        scene.requestRender();
    }, [viewer, viewerReady, theme]);
}
