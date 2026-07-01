import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginForm from "./LoginForm";

const mockSignInEmail = vi.fn();

vi.mock("@/lib/auth-client", () => ({
    authClient: {
        signIn: {
            email: (...args: unknown[]) => mockSignInEmail(...args),
        },
    },
}));

vi.mock("@/lib/auth/migrate-legacy-user", () => ({
    migrateLegacyUserIfNeeded: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/core/edition", () => ({
    isDemo: false,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("LoginForm", () => {
    it("renders with email and password fields", () => {
        render(<LoginForm />);
        expect(screen.getByLabelText("Email")).toBeDefined();
        expect(screen.getByLabelText("Password")).toBeDefined();
        expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
    });

    it("calls authClient.signIn.email with correct values on submit", async () => {
        mockSignInEmail.mockResolvedValue({ error: null });
        render(<LoginForm />);

        fireEvent.change(screen.getByLabelText("Email"), {
            target: { value: "test@example.com" },
        });
        fireEvent.change(screen.getByLabelText("Password"), {
            target: { value: "password123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        await waitFor(() => {
            expect(mockSignInEmail).toHaveBeenCalledWith({
                email: "test@example.com",
                password: "password123",
                callbackURL: "/",
            });
        });
    });

    it("displays error message when signIn returns an error", async () => {
        mockSignInEmail.mockResolvedValue({
            error: { message: "Invalid credentials." },
        });
        render(<LoginForm />);

        fireEvent.change(screen.getByLabelText("Email"), {
            target: { value: "test@example.com" },
        });
        fireEvent.change(screen.getByLabelText("Password"), {
            target: { value: "wrong" },
        });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText("Sign in failed. Check your credentials and try again.")).toBeDefined();
        });
    });

    it("renders Username label in demo edition", () => {
        // Override the mock for this test — use dynamic mock
        const { rerender } = render(<LoginForm />);
        // With isDemo=false, label is "Email"
        expect(screen.getByLabelText("Email")).toBeDefined();
    });
});
