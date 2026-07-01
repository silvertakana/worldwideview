/**
 * Password strength evaluation using zxcvbn-ts v4.
 *
 * Provides a reusable validator for Better Auth's password validation hooks.
 * Rejects passwords scoring below MIN_PASSWORD_SCORE (2) at sign-up and
 * password reset.
 */
import { ZxcvbnFactory, Options } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary as commonDictionary } from "@zxcvbn-ts/language-common";
import { dictionary as enDictionary, translations } from "@zxcvbn-ts/language-en";

// Load the English language dictionary and common passwords adjacency graphs.
// These are required by zxcvbn-ts for accurate password scoring.
const options = new Options({
    translations,
    graphs: adjacencyGraphs,
    dictionary: {
        ...commonDictionary,
        ...enDictionary,
    },
});

const zxcvbn = new ZxcvbnFactory(options);

/** Minimum score required for a password to be accepted (0-4 scale). */
export const MIN_PASSWORD_SCORE = 2;

export interface PasswordStrengthResult {
    score: number; // 0-4, where 0=too guessable, 4=very unguessable
    feedback: string; // human-readable feedback message
}

/**
 * Evaluate password strength and return a score + feedback.
 * Returns score 0-4. Score < MIN_PASSWORD_SCORE (2) means the password
 * is too weak and should be rejected.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
    if (!password || password.length === 0) {
        return { score: 0, feedback: "Password is empty." };
    }

    const result = zxcvbn.check(password);

    let feedback: string;
    if (result.score >= 3) {
        feedback = "Password is strong.";
    } else if (result.score >= MIN_PASSWORD_SCORE) {
        feedback = "Password is acceptable.";
    } else {
        const warning = result.feedback.warning || "Password is too weak.";
        const suggestions = result.feedback.suggestions.length > 0
            ? " " + result.feedback.suggestions.join(" ")
            : "";
        feedback = warning + suggestions;
    }

    return { score: result.score, feedback };
}
