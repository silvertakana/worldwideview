"use server";

import { compareSync } from "bcryptjs";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";

const DEMO_ADMIN_EMAIL = "admin@worldwideview.local";

export async function migrateLegacyUserIfNeeded(
  email: string,
  password: string,
): Promise<{ id: string } | null> {
  // Short-circuit: never migrate the demo admin (always seeded via Better Auth)
  if (email === DEMO_ADMIN_EMAIL) return null;

  // Check if a BetterAuthUser already exists for this email (idempotent)
  const existingBetterUser = await prisma.betterAuthUser.findUnique({
    where: { email },
  });
  if (existingBetterUser) return null;

  // Query the legacy users table
  const legacyUser = await prisma.user.findUnique({
    where: { email },
  });
  if (!legacyUser) return null;

  // Verify password against the old bcrypt hash (NextAuth used bcryptjs)
  if (!compareSync(password, legacyUser.hashedPassword)) return null;

  // Password verified — create a BetterAuthUser + BetterAuthAccount
  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  await prisma.$transaction([
    prisma.betterAuthUser.create({
      data: {
        id: userId,
        email: legacyUser.email,
        name: legacyUser.name,
        emailVerified: true,
        role: legacyUser.role,
      },
    }),
    prisma.betterAuthAccount.create({
      data: {
        id: crypto.randomUUID(),
        accountId: legacyUser.email,
        providerId: "credential",
        userId,
        password: hashedPassword,
      },
    }),
  ]);

  return { id: userId };
}
