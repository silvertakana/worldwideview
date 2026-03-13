/**
 * Resolves a dot-path (with optional bracket notation) on an object.
 *
 * @example
 * getNestedValue({ a: { b: [10, 20] } }, "a.b[1]") // → 20
 * getNestedValue({ x: 1 }, "y.z")                   // → undefined
 */
export function getNestedValue(obj: unknown, path: string): unknown {
    if (obj == null || !path) return undefined;

    // Split "a.b[0].c" → ["a", "b", "0", "c"]
    const segments = path
        .replace(/\[(\d+)]/g, ".$1")
        .split(".")
        .filter(Boolean);

    let current: unknown = obj;
    for (const segment of segments) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
}
