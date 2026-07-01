import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Header } from "./Header";

const mockSignOut = vi.fn();

vi.mock("@/lib/auth-client", () => ({
    authClient: {
        signOut: (...args: unknown[]) => mockSignOut(...args),
    },
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
    DEMO_ADMIN_ROLE: "admin",
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/core/hooks/useIsMobile", () => ({
    useIsMobile: () => false,
}));

// Mock store dependencies
vi.mock("@/core/state/store", () => ({
    useStore: vi.fn((sel) => {
        if (typeof sel === "function") {
            return sel({
                timeWindow: "24h",
                setTimeWindow: vi.fn(),
                theme: "dark",
                setTheme: vi.fn(),
            });
        }
        return {};
    }),
}));

// Mock other dependencies
vi.mock("@/core/data/DataBus", () => ({
    dataBus: { emit: vi.fn() },
}));

vi.mock("@/core/plugins/PluginManager", () => ({
    pluginManager: { updateTimeRange: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({
    trackEvent: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Header signout", () => {
    it("renders signout button when not in demo edition", () => {
        render(<Header />);
        expect(screen.getByTitle("Sign Out")).toBeDefined();
    });

    it("does not render signout button in demo edition", async () => {
        const mod = await import("@/core/edition");
        const original = mod.isDemo;
        Object.defineProperty(mod, "isDemo", { get: () => true });

        render(<Header />);

        const buttons = screen.queryAllByTitle("Sign Out");
        expect(buttons.length).toBe(0);

        Object.defineProperty(mod, "isDemo", { get: () => original });
    });

    it("renders signout button on mobile when not in demo", async () => {
        const mobileMod = await import("@/core/hooks/useIsMobile");
        const original = mobileMod.useIsMobile;
        Object.defineProperty(mobileMod, "useIsMobile", { get: () => () => true });

        render(<Header />);
        expect(screen.getByTitle("Sign Out")).toBeDefined();

        Object.defineProperty(mobileMod, "useIsMobile", { get: () => original });
    });

    it("does not render signout button on mobile in demo edition", async () => {
        const mobileMod = await import("@/core/hooks/useIsMobile");
        const mobileOriginal = mobileMod.useIsMobile;
        Object.defineProperty(mobileMod, "useIsMobile", { get: () => () => true });

        const mod = await import("@/core/edition");
        const demoOriginal = mod.isDemo;
        Object.defineProperty(mod, "isDemo", { get: () => true });

        render(<Header />);

        const buttons = screen.queryAllByTitle("Sign Out");
        expect(buttons.length).toBe(0);

        Object.defineProperty(mobileMod, "useIsMobile", { get: () => mobileOriginal });
        Object.defineProperty(mod, "isDemo", { get: () => demoOriginal });
    });

    it("calls authClient.signOut when signout button is clicked", async () => {
        render(<Header />);
        const button = screen.getByTitle("Sign Out");
        fireEvent.click(button);
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(mockSignOut).toHaveBeenCalledWith({
            fetchOptions: {
                onSuccess: expect.any(Function),
            },
        });
    });
});
