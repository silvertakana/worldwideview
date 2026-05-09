# Prisma 7 Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the Prisma 7 adapter architecture by removing legacy `url` parameters from the schema, syncing the local database, and validating the end-to-end connection.

**Architecture:** Prisma 7 strictly separates connection logic from the schema. The schema only defines the provider (`postgresql`), while connection strings for CLI commands like `db push` are handled by `prisma.config.ts`, and runtime connections are handled by the explicit `@prisma/adapter-pg` driver instance passed to the `PrismaClient` constructor.

**Tech Stack:** Prisma 7, PostgreSQL, Next.js, Node.js

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:5-8`

- [ ] **Step 1: Remove the legacy `url` property from the datasource block**

```prisma
datasource db {
  provider = "postgresql"
}
```

### Task 2: Push Schema to Local Database

- [ ] **Step 1: Execute Prisma db push to create the tables in the newly running Docker Postgres container**

Run: `npx dotenv-cli -e .env.local -- npx prisma db push`
Expected: PASS with "Your database is now in sync with your schema."

### Task 3: Generate Prisma Client

- [ ] **Step 1: Regenerate the Prisma Client types to ensure they match the schema**

Run: `npx dotenv-cli -e .env.local -- npx prisma generate`
Expected: PASS with "Generated Prisma Client"

### Task 4: Verify End-to-End Connection

- [ ] **Step 1: Run the user management script to prove the `adapter-pg` runtime can connect and query the new tables**

Run: `npx tsx --env-file=.env.local scripts/manage-users.ts list`
Expected: PASS with no errors (it should just exit silently if there are no users, rather than throwing a `P2021 TableDoesNotExist` or `P1001` error).

### Task 5: Restart the Development Server

- [ ] **Step 1: Restart the Next.js dev server**
Because the server has been running while we were debugging the `PrismaClientInitializationError`, Webpack may have cached the broken client. We need to kill the current `pnpm run dev` and start it fresh so we can test the API routes in the browser.

Run: Terminate the current `pnpm run dev` terminal, then run: `pnpm run dev`
Expected: Next.js starts successfully without any Prisma instantiation crashes.
