import { describe, it, expect } from "vitest";
import { evaluatePasswordStrength, MIN_PASSWORD_SCORE } from "./password-strength";

describe("evaluatePasswordStrength", () => {
    it("returns score 0 for empty password", () => {
        const result = evaluatePasswordStrength("");
        expect(result.score).toBe(0);
        expect(result.feedback).toBe("Password is empty.");
    });

    it("returns score < MIN_PASSWORD_SCORE for a very weak password", () => {
        const result = evaluatePasswordStrength("abc123");
        expect(result.score).toBeLessThan(MIN_PASSWORD_SCORE);
    });

    it("returns score < MIN_PASSWORD_SCORE for a common password", () => {
        const result = evaluatePasswordStrength("password123");
        expect(result.score).toBeLessThan(MIN_PASSWORD_SCORE);
    });

    it("returns score >= 3 for a strong passphrase", () => {
        const result = evaluatePasswordStrength("CorrectHorseBatteryStaple!1");
        expect(result.score).toBeGreaterThanOrEqual(3);
        expect(result.feedback).toBe("Password is strong.");
    });

    it("returns acceptable feedback for moderate password (score = 2)", () => {
        const result = evaluatePasswordStrength("th3M0n3y!");
        expect(result.score).toBe(MIN_PASSWORD_SCORE);
        expect(result.feedback).toBe("Password is acceptable.");
    });

    it("returns warning fallback when zxcvbn returns no warning", () => {
        const result = evaluatePasswordStrength("x!");
        expect(result.score).toBeLessThan(MIN_PASSWORD_SCORE);
        expect(result.feedback).toContain("Password is too weak.");
    });

    it("returns feedback string for weak passwords with suggestions", () => {
        const result = evaluatePasswordStrength("123");
        expect(result.feedback.length).toBeGreaterThan(0);
    });
});
