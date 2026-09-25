import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveInstanceBaseUrl } from "./instanceUrl";

describe("resolveInstanceBaseUrl", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
        vi.stubEnv("NEXT_PUBLIC_WWV_TENANT_DOMAIN", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("prefers the tenant subdomain over the pinned app URL", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TENANT_DOMAIN", "cloud-wwv.dev");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cloud-wwv.dev");

        expect(resolveInstanceBaseUrl({ subdomain: "acme" })).toBe("https://acme.cloud-wwv.dev");
    });

    it("normalizes an uppercase subdomain and a leading-dot tenant domain", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TENANT_DOMAIN", ".cloud-wwv.dev");

        expect(resolveInstanceBaseUrl({ subdomain: "  ACME " })).toBe("https://acme.cloud-wwv.dev");
    });

    it("falls back to the pinned app URL and strips a trailing slash", () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://globe.example.com/");

        expect(resolveInstanceBaseUrl({ subdomain: "acme" })).toBe("https://globe.example.com");
    });

    it("ignores a subdomain when no tenant domain is configured to hang it on", () => {
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://globe.example.com");

        expect(resolveInstanceBaseUrl({ subdomain: "acme" })).toBe("https://globe.example.com");
    });

    it("uses the proxy-reported host when nothing is configured", () => {
        expect(
            resolveInstanceBaseUrl({ forwardedHost: "acme.cloud-wwv.dev", forwardedProto: "https" }),
        ).toBe("https://acme.cloud-wwv.dev");
    });

    it("takes the first value of a comma-separated proxy header", () => {
        expect(
            resolveInstanceBaseUrl({
                forwardedHost: "acme.cloud-wwv.dev, inner:3000",
                forwardedProto: "https, http",
            }),
        ).toBe("https://acme.cloud-wwv.dev");
    });

    it("keeps http for a loopback host so local dev is not addressed over TLS", () => {
        expect(resolveInstanceBaseUrl({ forwardedHost: "127.0.0.1:3001" })).toBe("http://127.0.0.1:3001");
    });

    it("falls back to the request origin rather than returning a relative path", () => {
        expect(resolveInstanceBaseUrl({ requestUrl: "https://acme.cloud-wwv.dev/api/instance" })).toBe(
            "https://acme.cloud-wwv.dev",
        );
    });

    it("returns an empty string only when there is nothing at all to go on", () => {
        expect(resolveInstanceBaseUrl({ requestUrl: "not a url" })).toBe("");
    });
});
