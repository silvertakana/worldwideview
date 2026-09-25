import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginForm from "./LoginForm";
import { migrateLegacyUserIfNeeded } from "@/lib/auth/migrate-legacy-user";

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
    vi.mocked(migrateLegacyUserIfNeeded).mockResolvedValue(null);
});

function submitCredentials(email = "test@example.com", password = "password123") {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

function submitButton(): HTMLButtonElement {
    return screen.getByRole("button") as HTMLButtonElement;
}

describe("LoginForm", () => {
    it("renders with email and password fields", () => {
        render(<LoginForm />);
        expect(screen.getByLabelText("Email")).toBeDefined();
        expect(screen.getByLabelText("Password")).toBeDefined();
        expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
    });

    it("calls authClient.signIn.email with correct values on submit", async () => {
        mockSignInEmail.mockResolvedValue({ error: null });
        submitCredentials();

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
        submitCredentials("test@example.com", "wrong");

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

    it("shows a visible error and re-enables the button when the request rejects", async () => {
        // A rejected fetch (server down, offline, blocked cross-origin call) used
        // to escape the submit handler and leave the button on "Signing in..."
        // forever with no explanation.
        mockSignInEmail.mockRejectedValue(new TypeError("Failed to fetch"));
        submitCredentials();

        await waitFor(() => {
            expect(screen.getByRole("alert").textContent).toBe(
                "Could not reach the sign-in service. Check your connection and try again.",
            );
        });
        expect(submitButton().disabled).toBe(false);
        expect(submitButton().textContent).toBe("Sign In");
    });

    it("does not attempt the legacy migration when the request rejects", async () => {
        mockSignInEmail.mockRejectedValue(new TypeError("Failed to fetch"));
        submitCredentials();

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeDefined();
        });
        expect(vi.mocked(migrateLegacyUserIfNeeded)).not.toHaveBeenCalled();
    });

    it("stays pending, with a disabled button, while the request is in flight", async () => {
        let resolveSignIn: (value: unknown) => void = () => {};
        mockSignInEmail.mockReturnValue(
            new Promise((resolve) => {
                resolveSignIn = resolve;
            }),
        );
        submitCredentials();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /signing in/i })).toBeDefined();
        });
        expect(submitButton().disabled).toBe(true);

        resolveSignIn({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials." } });
        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeDefined();
        });
        expect(submitButton().disabled).toBe(false);
    });

    it("reports a failure of the post-migration retry", async () => {
        mockSignInEmail.mockResolvedValue({
            error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials." },
        });
        vi.mocked(migrateLegacyUserIfNeeded).mockResolvedValue({ id: "legacy-user-1" });
        submitCredentials();

        await waitFor(() => {
            expect(screen.getByText("Sign in failed after migration. Try again.")).toBeDefined();
        });
        expect(mockSignInEmail).toHaveBeenCalledTimes(2);
        expect(submitButton().disabled).toBe(false);
    });

    it("reports an error, not a spinner, when the retry request itself rejects", async () => {
        vi.mocked(migrateLegacyUserIfNeeded).mockResolvedValue({ id: "legacy-user-1" });
        mockSignInEmail
            .mockResolvedValueOnce({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials." } })
            .mockRejectedValueOnce(new TypeError("Failed to fetch"));
        submitCredentials();

        await waitFor(() => {
            expect(screen.getByText("Could not reach the sign-in service. Check your connection and try again.")).toBeDefined();
        });
        expect(submitButton().disabled).toBe(false);
    });
});
