// Characters that don't decompose to a base ASCII letter via NFD normalization.
const SUPPLEMENTAL_MAP: Record<string, string> = {
    "Đ": "D", "đ": "d", // Đ đ
    "Ø": "O", "ø": "o", // Ø ø
    "Ł": "L", "ł": "l", // Ł ł
    "Ð": "D", "ð": "d", // Ð ð
    "Þ": "Th", "þ": "th", // Þ þ
    "ß": "ss",               // ß
    "Æ": "AE", "æ": "ae", // Æ æ
    "Œ": "OE", "œ": "oe", // Œ œ
};

/**
 * Replaces diacritical characters with their closest ASCII equivalents so that
 * place and airport names remain readable even in environments where the font
 * or encoding does not support the original glyphs (e.g. Š→S, Č→C, Ž→Z).
 */
export function transliterate(text: string): string {
    return (
        text
            // Decompose characters like Š into base letter + combining mark (e.g. S + caron)
            .normalize("NFD")
            // Strip all Unicode combining diacritical marks (U+0300–U+036F)
            .replace(/[̀-ͯ]/g, "")
            // Replace any remaining non-ASCII characters using the supplemental map
            .replace(/[^\x00-\x7F]/g, (ch) => SUPPLEMENTAL_MAP[ch] ?? ch)
    );
}
