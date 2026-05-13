/**
 * @file BootOverlay.tsx
 * @description A high-fidelity loading overlay displayed during application initialization.
 * Features animated orbital rings and brand identity.
 * @module src/components/common
 */

"use client";

import "./BootOverlay.css";

/**
 * Props for the BootOverlay component.
 */
interface BootOverlayProps {
    /** Whether the overlay is currently visible on top of the application. */
    visible: boolean;
}

/**
 * @component BootOverlay
 * @description Animated splash screen for initial system boot.
 * 
 * @param {BootOverlayProps} props - Component properties.
 */
export function BootOverlay({ visible }: BootOverlayProps) {
    return (
        <div className={`boot-overlay ${visible ? "" : "boot-overlay--hidden"}`}>
            {/* Orbital rings */}
            <div className="boot-overlay__rings">
                <div className="boot-overlay__ring boot-overlay__ring--1" />
                <div className="boot-overlay__ring boot-overlay__ring--2" />
                <div className="boot-overlay__ring boot-overlay__ring--3" />
                <div className="boot-overlay__core" />
            </div>

            {/* Brand + status */}
            <div className="boot-overlay__title">WorldWideView</div>
            <div className="boot-overlay__status">Initializing Systems...</div>
        </div>
    );
}
