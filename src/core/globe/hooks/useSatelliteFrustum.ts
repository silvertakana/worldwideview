import { useEffect, useRef } from "react";
import { Viewer as CesiumViewer, Entity as CesiumEntity, Color, CallbackProperty, CallbackPositionProperty, Cartesian3, Math as CesiumMath, Matrix4, Matrix3, Transforms, Quaternion } from "cesium";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import type { AnimatableItem } from "../EntityRenderer";

const FOV_ANGLE_DEG = 60;

/**
 * Renders a downward-pointing cone (sensor footprint) when a satellite is selected.
 */
export function useSatelliteFrustum(
    viewer: CesiumViewer | null,
    isReady: boolean,
    selectedEntity: GeoEntity | null,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>
) {
    const frustumEntityRef = useRef<CesiumEntity | null>(null);

    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        // Cleanup previous
        if (frustumEntityRef.current && !viewer.isDestroyed()) {
            viewer.entities.remove(frustumEntityRef.current);
            frustumEntityRef.current = null;
        }

        // Only render for satellites
        if (!selectedEntity || selectedEntity.pluginId !== "satellite") return;

        // Ensure we have altitude (fallback to 400km if missing)
        const altitude = selectedEntity.altitude || 400000;
        
        // Calculate the bottom radius based on FOV and altitude
        // tan(FOV/2) = radius / altitude  =>  radius = tan(FOV/2) * altitude
        const radius = Math.tan(CesiumMath.toRadians(FOV_ANGLE_DEG / 2)) * altitude;

        frustumEntityRef.current = viewer.entities.add({
            id: `satellite-frustum-${selectedEntity.id}`,
            // We use CallbackPositionProperty for position since the satellite is moving
            position: new CallbackPositionProperty(() => {
                const item = animatablesMapRef.current.get(selectedEntity.id);
                // Fallback to static selection coordinate if not currently animated bounding to view
                const basePosition = item?.posRef || Cartesian3.fromDegrees(selectedEntity.longitude, selectedEntity.latitude, altitude);
                
                // A Cesium cylinder's position is its center, not its apex.
                // We must shift it halfway down the Nadir vector (towards the Earth center).
                // Cartesian3 magnitudes represent distance from center of Earth.
                const mag = Cartesian3.magnitude(basePosition);
                if (mag === 0) return basePosition; // safeguard

                // We want to scale the vector back towards Cartesian3.ZERO by half the altitude
                const scale = (mag - (altitude / 2)) / mag;
                return Cartesian3.multiplyByScalar(basePosition, scale, new Cartesian3());
            }, false),
            
            // To point it Nadir, the standard Cylinder geometry without orientation 
            // points "up" along the Z axis of the globe context natively when placed at position.
            // Wait, Cesium cylinder geometry aligns its local Z axis with the global Z (North Pole)
            // if NO orientation is provided. 
            // To align it with the surface normal (up/down radially), we need an orientation.
            // Transforms.eastNorthUpToFixedFrame produces a matrix where Z is UP.
            // We can convert this to a Quaternion.
            orientation: new CallbackProperty(() => {
                const item = animatablesMapRef.current.get(selectedEntity.id);
                const basePosition = item?.posRef || Cartesian3.fromDegrees(selectedEntity.longitude, selectedEntity.latitude, altitude);
                
                // Get the local frame where Z is "up" (away from Earth)
                const enuMatrix = Transforms.eastNorthUpToFixedFrame(basePosition);
                
                // Cylinder's local Z axis goes from top to bottom (-Z to +Z).
                // Wait, Cesium's cylinder defaults its Z axis along the local Z.
                // Since our topRadius is 0, the top is at +Z and bottom is at -Z (Wait, actually it depends).
                // According to Cesium source, Cylinder runs along Z axis.
                // If Z is "Up" (away from Earth), and we want the point (apex, topRadius=0) to be at the satellite,
                // and the base (bottomRadius) to be at Earth, then:
                // The cone tip MUST be at the top of the cylinder (+Z) pointing away? 
                // Let's orient it so local Z points Up. The top of the cylinder is near the satellite.
                return Quaternion.fromRotationMatrix(Matrix4.getMatrix3(enuMatrix, new Matrix3()));
            }, false),

            cylinder: {
                length: altitude,
                topRadius: 0.0,
                bottomRadius: radius,
                material: Color.fromCssColorString("#00fff7").withAlpha(0.15),
                outline: true,
                outlineColor: Color.fromCssColorString("#00fff7").withAlpha(0.4),
                // Number of slices around the circular base for performance
                slices: 32,
            }
        });

        // Cleanup on unmount or selection change
        return () => {
            if (frustumEntityRef.current && !viewer.isDestroyed()) {
                viewer.entities.remove(frustumEntityRef.current);
                frustumEntityRef.current = null;
            }
        };
    }, [viewer, isReady, selectedEntity, animatablesMapRef]);
}
