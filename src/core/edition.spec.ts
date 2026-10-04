import { describe, it, expect, vi, afterEach } from "vitest";
import { ticketAuthEnabledForPlugin, ticketAuthRequired, marketplaceCredentialRequired } from "./edition";

describe("ticketAuthEnabledForPlugin", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns false when env var is empty (dormant default)", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", "");
        expect(ticketAuthEnabledForPlugin("aviation")).toBe(false);
        expect(ticketAuthEnabledForPlugin("maritime")).toBe(false);
    });

    it("returns true only for plugin IDs in the comma-separated list", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", "aviation,maritime");
        expect(ticketAuthEnabledForPlugin("aviation")).toBe(true);
        expect(ticketAuthEnabledForPlugin("maritime")).toBe(true);
        expect(ticketAuthEnabledForPlugin("wildfire")).toBe(false);
    });

    it("trims whitespace around plugin IDs", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", " aviation , maritime ");
        expect(ticketAuthEnabledForPlugin("aviation")).toBe(true);
        expect(ticketAuthEnabledForPlugin("maritime")).toBe(true);
    });

    it("returns false for a partial match (no substring matching)", () => {
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", "aviation");
        expect(ticketAuthEnabledForPlugin("avi")).toBe(false);
    });
});

/** Both env names are stubbed: the runtime one wins, the baked one is the fallback. */
function useEdition(value: string) {
    vi.stubEnv("WWV_EDITION", value);
    vi.stubEnv("NEXT_PUBLIC_WWV_EDITION", value);
}

describe("ticketAuthRequired", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("requires a ticket in the cloud and demo editions with no plugin opted in", () => {
        useEdition("cloud");
        expect(ticketAuthRequired([])).toBe(true);
        useEdition("demo");
        expect(ticketAuthRequired([])).toBe(true);
    });

    it("does not require one for a local instance with no plugin opted in", () => {
        useEdition("local");
        expect(ticketAuthRequired(["aviation"])).toBe(false);
    });

    it("honours the per-plugin list on a local instance", () => {
        useEdition("local");
        vi.stubEnv("NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS", "aviation");
        expect(ticketAuthRequired(["maritime"])).toBe(false);
        expect(ticketAuthRequired(["maritime", "aviation"])).toBe(true);
    });
});

describe("marketplaceCredentialRequired", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("is true only for the editions that stream from a hosted engine", () => {
        useEdition("cloud");
        expect(marketplaceCredentialRequired()).toBe(true);
        useEdition("demo");
        expect(marketplaceCredentialRequired()).toBe(true);
        useEdition("local");
        expect(marketplaceCredentialRequired()).toBe(false);
    });
});

