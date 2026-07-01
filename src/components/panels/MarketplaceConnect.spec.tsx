import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketplaceConnect } from "./MarketplaceConnect";

// Mock edition module — default to non-demo
vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("MarketplaceConnect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should show loading state initially", () => {
        // Keep fetch unresolved to see loading state
        mockFetch.mockReturnValue(new Promise(() => {}));
        render(<MarketplaceConnect />);
        expect(screen.getByText("Checking connection...")).toBeDefined();
    });

    it("should show connect button when not connected", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                connected: false,
                encryptionMasterKeyConfigured: true,
            }),
        });

        render(<MarketplaceConnect />);

        // Wait for the connect button to appear
        const btn = await screen.findByTestId("marketplace-connect-btn");
        expect(btn).toBeDefined();
        expect(btn.getAttribute("href")).toBe("/api/marketplace/connect");
    });

    it("should show connected state when credential exists", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                connected: true,
                connectedAt: "2026-06-01T12:00:00Z",
                lastUpdated: "2026-06-01T12:00:00Z",
                encryptionMasterKeyConfigured: true,
            }),
        });

        render(<MarketplaceConnect />);

        const connectedLabel = await screen.findByText(/Connected/);
        expect(connectedLabel).toBeDefined();
    });

    it("should show unavailable when encryption key is missing", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                connected: false,
                encryptionMasterKeyConfigured: false,
            }),
        });

        render(<MarketplaceConnect />);

        const msg = await screen.findByText(/ENCRYPTION_MASTER_KEY/);
        expect(msg).toBeDefined();
    });

    it("should show unavailable on fetch error", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        render(<MarketplaceConnect />);

        const msg = await screen.findByText(/Could not reach server/);
        expect(msg).toBeDefined();
    });
});
