import { vi } from "vitest";

// Global mock for @/lib/auth — prevents next-auth from importing next/server in jsdom.
// Individual test files that need auth behavior override this with their own vi.mock() call.
vi.mock("@/lib/auth", () => ({
    auth: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));
