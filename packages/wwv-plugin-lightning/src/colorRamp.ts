/**
 * @file colorRamp.ts
 * @description Maps a strike's age to a colour, decoupled from Cesium so it stays
 * pure and unit-testable. A fresh strike is white-hot and cools through yellow and
 * orange while fading to fully transparent — like the after-image of a real flash.
 */

export interface Rgba {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

interface Stop {
    at: number;
    r: number;
    g: number;
    b: number;
}

/** Colour stops across a strike's lifetime (t = 0 fresh → t = 1 expired). */
const STOPS: Stop[] = [
    { at: 0.0, r: 1, g: 1.0, b: 1.0 },   // white-hot
    { at: 0.25, r: 1, g: 0.95, b: 0.3 }, // bright yellow
    { at: 0.6, r: 1, g: 0.55, b: 0.1 },  // orange
    { at: 1.0, r: 1, g: 0.35, b: 0.0 },  // deep orange (fully faded)
];

/**
 * Returns the colour for a strike at life-fraction `t` (clamped to [0, 1]).
 * RGB follows the white→yellow→orange ramp; alpha eases out to 0 as the strike ages.
 */
export function strikeColor(t: number): Rgba {
    const x = t <= 0 ? 0 : t >= 1 ? 1 : t;

    let lo = STOPS[0];
    let hi = STOPS[STOPS.length - 1];
    for (let i = 0; i < STOPS.length - 1; i++) {
        if (x >= STOPS[i].at && x <= STOPS[i + 1].at) {
            lo = STOPS[i];
            hi = STOPS[i + 1];
            break;
        }
    }

    const span = hi.at - lo.at || 1;
    const k = (x - lo.at) / span;
    return {
        red: lo.r + (hi.r - lo.r) * k,
        green: lo.g + (hi.g - lo.g) * k,
        blue: lo.b + (hi.b - lo.b) * k,
        alpha: Math.pow(1 - x, 1.4),
    };
}
