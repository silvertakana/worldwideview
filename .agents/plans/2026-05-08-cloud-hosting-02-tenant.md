# Phase 2: Tenant System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement single-container multi-tenancy using PostgreSQL Row-Level Security (RLS) and Next.js middleware to resolve subdomains.

**Architecture:** Middleware extracts the subdomain (e.g., `acme.app.worldwideview.dev`) and sets an `x-tenant-id` header. Prisma extension wraps all queries to `SET LOCAL app.tenant_id = '...'` to enforce RLS in PostgreSQL.

**Tech Stack:** Next.js Middleware, Prisma Client Extensions, PostgreSQL RLS.

---

### Task 1: Database Schema Tenant Column

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add tenant columns to models**

Add `tenantId String?` to all relevant models (`InstalledPlugin`, `Favorite`, `Setting`).
For local SQLite, `tenantId` is ignored (null). For cloud, it's enforced via RLS.

```prisma
model InstalledPlugin {
  id          String   @id @default(uuid())
  tenantId    String?  // NULL for local, UUID for cloud
  pluginId    String
  version     String
  config      String   @default("{}")
  enabled     Boolean  @default(true)
  installedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, pluginId]) // Replaces @@unique([pluginId])
  @@map("installed_plugins")
}

model Setting {
  id       String  @id @default(uuid())
  tenantId String? 
  key      String
  value    String

  @@unique([tenantId, key])
  @@map("settings")
}
```

- [ ] **Step 2: Update primary keys if needed**

Ensure `Setting` uses `id` as `@id` instead of `key` since `key` is no longer globally unique (it's unique per tenant).

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add tenantId columns to schema"
```

### Task 2: Subdomain Middleware

**Files:**
- Modify: `src/middleware.ts` (or create if doesn't exist)

- [ ] **Step 1: Create Next.js middleware**

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const hostname = req.headers.get("host") || "";
    
    // Extract subdomain if on cloud
    if (process.env.NEXT_PUBLIC_WWV_EDITION === "cloud") {
        const isApp = hostname.includes(".app.worldwideview.dev");
        if (isApp) {
            const subdomain = hostname.replace(".app.worldwideview.dev", "");
            if (subdomain && subdomain !== "app") {
                const res = NextResponse.next();
                res.headers.set("x-tenant-subdomain", subdomain);
                return res;
            }
        }
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

### Task 3: Prisma RLS Extension

**Files:**
- Modify: `src/core/adapters/db.ts`

- [ ] **Step 1: Wrap Prisma with RLS extension for Cloud**

Modify `createPrismaClient` to wrap the client if in cloud mode:

```typescript
// src/core/adapters/db.ts
import { isCloud } from "@/core/edition";
import { PrismaClient } from "../../generated/prisma/client";
import { headers } from "next/headers";

export function createPrismaClient() {
    if (isCloud) {
        const client = new PrismaClient({
            datasources: { db: { url: process.env.DATABASE_URL } },
        });

        // Use Prisma Client Extension to inject RLS
        return client.$extends({
            query: {
                $allModels: {
                    async $allOperations({ args, query }) {
                        const headersList = await headers();
                        const tenantSubdomain = headersList.get("x-tenant-subdomain");
                        
                        if (tenantSubdomain) {
                            const [, result] = await client.$transaction([
                                client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantSubdomain}, TRUE)`,
                                query(args),
                            ]);
                            return result;
                        }
                        return query(args);
                    },
                },
            },
        });
    } else {
        const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
        const adapter = new PrismaBetterSqlite3({
            url: process.env.DATABASE_URL || "file:./data/wwv.db",
        });
        return new PrismaClient({ adapter });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts src/core/adapters/db.ts
git commit -m "feat: multi-tenant middleware and RLS prisma extension"
```
