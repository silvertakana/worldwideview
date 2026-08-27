// Vitest setup file — intentionally empty after auth clean-up.
// The vi.mock("@/lib/auth") line was removed along with auth.ts.

/**
 * jsdom in this vitest setup provides `localStorage` as an inert object with
 * no methods; the UI store slice reads it at module init. Install a working
 * in-memory implementation before any store import so store-backed component
 * tests can run without a stubbed URL.
 */
if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.getItem !== "function") {
    const memory = new Map<string, string>();
    const storage: Storage = {
        get length() { return memory.size; },
        clear: () => memory.clear(),
        getItem: (key: string) => (memory.has(key) ? memory.get(key) as string : null),
        key: (index: number) => Array.from(memory.keys())[index] ?? null,
        removeItem: (key: string) => { memory.delete(key); },
        setItem: (key: string, value: string) => { memory.set(key, String(value)); },
    };
    Object.defineProperty(globalThis, "localStorage", {
        value: storage,
        configurable: true,
        writable: true,
    });
}
