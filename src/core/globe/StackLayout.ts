import type { EntityStack, SpiderOffset } from "./StackTypes";

// ── Ring offset assignment ──────────────────────────────────
export function assignRingOffsets(stack: EntityStack, spiderOffsets: Map<string, SpiderOffset>): void {
    const count = stack.children.length;
    let outerRadius = 0;

    // Scale down spacing for mobile to match reduced icon size
    const spacingScale = (typeof window !== "undefined" && window.innerWidth <= 768) ? 0.7 : 1.0;

    // Use a single perfect circle for up to 18 items
    if (count <= 18) {
        // Dynamically scale radius based on count so they don't overlap.
        // Base circumference ~ 45 pixels per item
        const circumference = count * (45 * spacingScale);
        // Min radius 55 to avoid overlapping the central hub icon
        const radius = Math.max(55 * spacingScale, circumference / (2 * Math.PI));
        outerRadius = radius;

        for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count - Math.PI / 2; // start from top
            const childItem = stack.children[i];
            spiderOffsets.set(childItem.entity.id, {
                targetX: radius * Math.cos(angle),
                targetY: radius * Math.sin(angle),
                currentX: 0, currentY: 0,
            });
        }
    } else {
        // For large clusters, use a Fermat's spiral (sunflower) which packs evenly
        const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
        for (let i = 0; i < count; i++) {
            // i + 1 so we don't put the first item exactly at radius 0 (which is the hub)
            const n = i + 1;
            // Radius scales with sqrt of count to preserve uniform area/spacing
            const radius = (35 * spacingScale) * Math.sqrt(n);
            const angle = n * GOLDEN_ANGLE - Math.PI / 2;
            
            if (radius > outerRadius) outerRadius = radius;

            const childItem = stack.children[i];
            spiderOffsets.set(childItem.entity.id, {
                targetX: radius * Math.cos(angle),
                targetY: radius * Math.sin(angle),
                currentX: 0, currentY: 0,
            });
        }
    }

    stack.outerRadius = outerRadius;
}
