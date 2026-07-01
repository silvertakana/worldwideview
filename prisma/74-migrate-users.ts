/**
 * One-time data migration: copy users from NextAuth `users` table to
 * Better Auth `user` + `account` tables.
 *
 * Run: npx tsx prisma/74-migrate-users.ts
 *
 * Preserves UUIDs so logical FK references (Workspace.ownerId) stay valid.
 * Password hashes are copied directly -- both NextAuth and Better Auth use bcrypt.
 */
import { prisma } from "../src/lib/db";

async function migrateUsers() {
  const legacyUsers = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      email: string;
      name: string;
      hashedPassword: string;
      role: string;
      createdAt: Date;
    }>
  >(
    `SELECT id, email, name, "hashedPassword", role, "createdAt" FROM "users"`
  );

  console.log(`Found ${legacyUsers.length} legacy users to migrate.`);

  let migrated = 0;
  let skipped = 0;

  for (const user of legacyUsers) {
    const exists = await prisma.betterAuthUser.findUnique({
      where: { id: user.id },
    });
    if (exists) {
      console.log(`  SKIP ${user.email} -- already in BetterAuthUser`);
      skipped++;
      continue;
    }

    await prisma.$transaction([
      prisma.betterAuthUser.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: true,
          role: user.role || "user",
          createdAt: user.createdAt,
        },
      }),
      prisma.betterAuthAccount.create({
        data: {
          id: crypto.randomUUID(),
          accountId: user.email,
          providerId: "credential",
          userId: user.id,
          password: user.hashedPassword,
        },
      }),
    ]);

    console.log(`  OK  ${user.email} (role: ${user.role || "user"})`);
    migrated++;
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped.`);
}

migrateUsers()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
