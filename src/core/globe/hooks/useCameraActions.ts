import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Cartesian3, Ellipsoid, Math as CesiumMath, Transforms, Matrix4 } from "cesium";
import { dataBus } from "@/core/data/DataBus";

export function useCameraActions(viewer: CesiumViewer | null, isReady: boolean) {
    useEffect(() => {
        if (!viewer || !isReady) return;

        const unsubFace = dataBus.on("cameraFaceTowards", ({ lat, lon, alt }) => {
            if (!viewer || viewer.isDestroyed()) return;
            console.log("[GlobeView] Native faceTowards", lat, lon, alt);
            const target = Cartesian3.fromDegrees(lon, lat, alt);
            const offset = Cartesian3.subtract(
                viewer.camera.positionWC,
                target,
                new Cartesian3()
            );
            // lookAt sets the view relative to the target's ENU frame
            viewer.camera.lookAt(target, offset);
            // Immediately release the transform to allow free camera movement again
            // while preserving the orientation
            viewer.camera.lookAtTransform(Matrix4.IDENTITY);
        });

        const unsubGoTo = dataBus.on("cameraGoTo", ({ lat, lon, alt, distance, maxPitch, heading }) => {
            // Add a slight delay to avoid any immediate state-change cancellations from React
            setTimeout(() => {
                if (!viewer || viewer.isDestroyed()) return;
                const targetPosition = Cartesian3.fromDegrees(lon, lat, alt || 0);
                const cameraPosition = viewer.camera.positionWC;

                // Calculate direction from camera to the target object
                const direction = Cartesian3.subtract(targetPosition, cameraPosition, new Cartesian3());
                Cartesian3.normalize(direction, direction);

                // Enforce maximum pitch (default -30 degrees)
                const targetLocalUp = Ellipsoid.WGS84.geodeticSurfaceNormal(targetPosition, new Cartesian3());
                const pitchDot = Cartesian3.dot(direction, targetLocalUp);
                let pitch = Math.asin(pitchDot);
                const maxPitchRad = CesiumMath.toRadians(maxPitch !== undefined ? maxPitch : -30);

                if (pitch > maxPitchRad) {
                    pitch = maxPitchRad;
                    // Extract the horizontal component of the direction to reconstruct it
                    const vertComponent = Cartesian3.multiplyByScalar(targetLocalUp, pitchDot, new Cartesian3());
                    const horiz = Cartesian3.subtract(direction, vertComponent, new Cartesian3());

                    if (Cartesian3.magnitude(horiz) > 0.0001) {
                        Cartesian3.normalize(horiz, horiz);
                        const cosP = Math.cos(pitch);
                        const sinP = Math.sin(pitch);
                        const newHoriz = Cartesian3.multiplyByScalar(horiz, cosP, new Cartesian3());
                        const newVert = Cartesian3.multiplyByScalar(targetLocalUp, sinP, new Cartesian3());
                        Cartesian3.add(newHoriz, newVert, direction);
                        Cartesian3.normalize(direction, direction);
                    }
                }

                const viewDistance = distance !== undefined ? distance : Math.max(10000, (alt || 0) * 2 + 20000);

                let destination: Cartesian3;
                let orientation: any;

                if (heading !== undefined) {
                    const headingRad = CesiumMath.toRadians(heading);

                    // Offset in ENU frame at the target
                    const x_dir = Math.cos(pitch) * Math.sin(headingRad);
                    const y_dir = Math.cos(pitch) * Math.cos(headingRad);
                    const z_dir = Math.sin(pitch);

                    const offsetENU = new Cartesian3(
                        -x_dir * viewDistance,
                        -y_dir * viewDistance,
                        -z_dir * viewDistance
                    );

                    const enuTransform = Transforms.eastNorthUpToFixedFrame(targetPosition);
                    const offsetWC = Matrix4.multiplyByPointAsVector(enuTransform, offsetENU, new Cartesian3());
                    destination = Cartesian3.add(targetPosition, offsetWC, new Cartesian3());

                    orientation = {
                        heading: headingRad,
                        pitch: pitch,
                        roll: 0
                    };
                } else {
                    // Offset backwards by its looking direction
                    const offset = Cartesian3.multiplyByScalar(direction, -viewDistance, new Cartesian3());
                    destination = Cartesian3.add(targetPosition, offset, new Cartesian3());

                    // Keep roll at 0 by using the Earth's local normal to force a horizontal right vector
                    const localUp = Ellipsoid.WGS84.geodeticSurfaceNormal(destination, new Cartesian3());
                    const right = Cartesian3.cross(direction, localUp, new Cartesian3());
                    Cartesian3.normalize(right, right);

                    // The new 'up' vector will be perpendicular to both, ensuring 0 roll
                    const up = Cartesian3.cross(right, direction, new Cartesian3());
                    Cartesian3.normalize(up, up);

                    orientation = {
                        direction: direction,
                        up: up,
                    };
                }

                viewer.camera.flyTo({
                    destination: destination,
                    orientation: orientation,
                    duration: 1.5,
                });
            }, 50);
        });

        return () => {
            unsubFace();
            unsubGoTo();
        };
    }, [viewer, isReady]);
}
