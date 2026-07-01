import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAdminAccount } from "./actions";
import { evaluatePasswordStrength } from "@/lib/password-strength";
import { prisma } from "@/lib/db";

vi.mock("@/lib/password-strength", () => ({
    evaluatePasswordStrength: vi.fn(() => ({ score: 3, feedback: "Password is strong." })),
    MIN_PASSWORD_SCORE: 2,
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        betterAuthUser: {
            count: vi.fn(),
            create: vi.fn(),
        },
        betterAuthAccount: {
            create: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
});

function makeFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("name", overrides.name ?? "Admin");
    fd.set("email", overrides.email ?? "admin@example.com");
    fd.set("password", overrides.password ?? "password123");
    fd.set("confirm", overrides.confirm ?? "password123");
    return fd;
}

describe("createAdminAccount", () => {
    it("creates both user and account records in a transaction", async () => {
        vi.mocked(prisma.betterAuthUser.count).mockResolvedValue(0);
        vi.mocked(prisma.$transaction).mockImplementation(
            (cb: unknown) => typeof cb === "function" ? cb(prisma) : Promise.resolve([]),
        );

        const result = await createAdminAccount(makeFormData());

        expect(result.success).toBe(true);
        expect(prisma.betterAuthUser.create).toHaveBeenCalled();
        expect(prisma.betterAuthAccount.create).toHaveBeenCalled();
        expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("rejects when a user already exists", async () => {
        vi.mocked(prisma.betterAuthUser.count).mockResolvedValue(1);

        const result = await createAdminAccount(makeFormData());

        expect(result.success).toBe(false);
        expect(result.error).toBe("Admin account already exists.");
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("validates password length", async () => {
        const result = await createAdminAccount(
            makeFormData({ password: "short", confirm: "short" }),
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Password must be at least 8 characters.");
    });

    it("validates password match", async () => {
        const result = await createAdminAccount(
            makeFormData({ password: "password123", confirm: "different" }),
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Passwords do not match.");
    });

    it("rejects passwords below minimum strength", async () => {
        vi.mocked(evaluatePasswordStrength).mockReturnValueOnce(
            { score: 1, feedback: "Password is too weak." },
        );

        const result = await createAdminAccount(makeFormData());

        expect(result.success).toBe(false);
        expect(result.error).toBe("Password is too weak.");
    });
});
