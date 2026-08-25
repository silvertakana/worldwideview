/**
 * @file uuid.ts
 * @description Cross-environment RFC 4122 compliant UUID v4 generator.
 * Works seamlessly in Secure Contexts (HTTPS, localhost), Insecure Contexts
 * (LAN HTTP where crypto.randomUUID is undefined), and non-browser runtimes.
 * Never degrades to Math.random: session identifiers built from a
 * cryptographically insecure PRNG are guessable, so when no Web Crypto
 * source is available the function throws instead.
 */

/**
 * Generates an RFC 4122 compliant UUID v4 string.
 *
 * Strategy:
 * 1. `crypto.randomUUID()` (Native, fast, available in Secure Contexts & Node.js).
 * 2. `crypto.getRandomValues()` (Cryptographically secure, available in insecure contexts in modern browsers).
 * 3. Throw when neither exists -- a security-relevant identifier must never
 *    be derived from a non-cryptographic PRNG.
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
            // Fall through to the throw below; a broken Web Crypto must never
            // degrade to an insecure PRNG.
        }
    }

    throw new Error(
        "generateUUID: Web Crypto unavailable (crypto.randomUUID and crypto.getRandomValues are both missing); refusing to generate an insecure UUID.",
    );
}