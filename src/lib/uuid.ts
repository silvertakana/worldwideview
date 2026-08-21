/**
 * @file uuid.ts
 * @description Cross-environment RFC 4122 compliant UUID v4 generator.
 * Works seamlessly in Secure Contexts (HTTPS, localhost), Insecure Contexts
 * (LAN HTTP where crypto.randomUUID is undefined), and non-browser runtimes.
 * @module src/lib
 */

/**
 * Generates an RFC 4122 compliant UUID v4 string.
 *
 * Fallback strategy:
 * 1. `crypto.randomUUID()` (Native, fast, available in Secure Contexts & Node.js).
 * 2. `crypto.getRandomValues()` (Cryptographically secure, available in insecure contexts in modern browsers).
 * 3. Pseudo-random fallback using `Math.random` (Guarantees execution even if Web Crypto is unavailable).
 */
export function generateUUID(): string {
    // 1. Native crypto.randomUUID (Secure Contexts / Node.js)
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        try {
            return crypto.randomUUID();
        } catch {
            // Fall through if native call fails unexpectedly
        }
    }

    // 2. crypto.getRandomValues (Available on window.crypto in insecure contexts in modern browsers)
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        try {
            const buf = new Uint8Array(16);
            crypto.getRandomValues(buf);
            // Per RFC 4122 section 4.4:
            // Set version to 4 (0100)
            buf[6] = (buf[6] & 0x0f) | 0x40;
            // Set variant to 10xx (RFC 4122)
            buf[8] = (buf[8] & 0x3f) | 0x80;

            const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        } catch {
            // Fall through to Math.random fallback
        }
    }

    // 3. Fallback for environments lacking Web Crypto API
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}