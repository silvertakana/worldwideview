import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
const mockSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams(key),
    }),
}));

// The page module uses async import for the default export
// We test the content by controlling search params
async function renderPage() {
    const { default: Page } = await import("./page");
    return render(<Page />);
}

describe("ConnectStatusPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should show success message when connected=true", async () => {
        mockSearchParams.mockImplementation((key: string) => {
            if (key === "connected") return "true";
            return null;
        });

        await renderPage();

        expect(await screen.findByText("Successfully Connected!")).toBeDefined();
        expect(
            await screen.findByText(/your globe is now linked/i)
        ).toBeDefined();
    });

    it("should show state_mismatch error", async () => {
        mockSearchParams.mockImplementation((key: string) => {
            if (key === "error") return "state_mismatch";
            return null;
        });

        await renderPage();

        expect(await screen.findByText("Security Check Failed")).toBeDefined();
        expect(
            await screen.findByText(/could not be verified/)
        ).toBeDefined();
    });

    it("should show token_exchange_failed error", async () => {
        mockSearchParams.mockImplementation((key: string) => {
            if (key === "error") return "token_exchange_failed";
            return null;
        });

        await renderPage();

        expect(await screen.findByText("Connection Failed")).toBeDefined();
        expect(
            await screen.findByText(/marketplace may be temporarily/)
        ).toBeDefined();
    });

    it("should show encryption_failed error", async () => {
        mockSearchParams.mockImplementation((key: string) => {
            if (key === "error") return "encryption_failed";
            return null;
        });

        await renderPage();

        expect(await screen.findByText("Configuration Error")).toBeDefined();
        expect(
            await screen.findByText(/ENCRYPTION_MASTER_KEY/)
        ).toBeDefined();
    });

    it("should show unknown error for unrecognized error codes", async () => {
        mockSearchParams.mockImplementation((key: string) => {
            if (key === "error") return "some_unknown_error";
            return null;
        });

        await renderPage();

        expect(await screen.findByText("Something Went Wrong")).toBeDefined();
    });

    it("should show unknown error when no params present", async () => {
        mockSearchParams.mockImplementation(() => null);

        await renderPage();

        expect(await screen.findByText("Something Went Wrong")).toBeDefined();
    });
});
