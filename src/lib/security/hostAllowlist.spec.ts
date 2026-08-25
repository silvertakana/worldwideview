import { describe, it, expect } from "vitest";
import { isHostAllowlisted } from "./hostAllowlist";

const BALTIC = ["balticlivecam.com"];

describe("isHostAllowlisted", () => {
    it("allows the exact allowed host", () => {
        expect(isHostAllowlisted("https://balticlivecam.com/camera/1", BALTIC)).toBe(true);
    });

    it("allows subdomains of the allowed host", () => {
        expect(isHostAllowlisted("https://camera.balticlivecam.com/live", BALTIC)).toBe(true);
    });

    it("rejects a host that merely contains the allowed string in its path", () => {
        expect(isHostAllowlisted("https://evil.com/balticlivecam.com/cam", BALTIC)).toBe(false);
    });

    it("rejects a lookalike host with the allowed string as a prefix", () => {
        expect(isHostAllowlisted("https://balticlivecam.com.evil.com/cam", BALTIC)).toBe(false);
    });

    it("rejects a host that embeds the allowed string without a dot boundary", () => {
        expect(isHostAllowlisted("https://notbalticlivecam.com/cam", BALTIC)).toBe(false);
    });

    it("matches on the parsed hostname, ignoring userinfo", () => {
        expect(isHostAllowlisted("https://user:pass@balticlivecam.com/cam", BALTIC)).toBe(true);
        expect(isHostAllowlisted("https://user:pass@balticlivecam.com.evil.com/cam", BALTIC)).toBe(false);
    });

    it("rejects non-web protocols even with a matching hostname", () => {
        expect(isHostAllowlisted("ftp://balticlivecam.com/cam", BALTIC)).toBe(false);
        expect(isHostAllowlisted("file:///etc/passwd", BALTIC)).toBe(false);
    });

    it("rejects unparseable input", () => {
        expect(isHostAllowlisted("", BALTIC)).toBe(false);
        expect(isHostAllowlisted("not a url at all", BALTIC)).toBe(false);
    });

    it("accepts schemeless host strings via https resolution", () => {
        expect(isHostAllowlisted("balticlivecam.com/live", BALTIC)).toBe(true);
    });
});