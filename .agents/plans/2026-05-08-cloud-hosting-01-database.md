# Phase 1: Database Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify Prisma schema and client initialization to support both SQLite (local/demo) and PostgreSQL (cloud).

**Architecture:** We use a pre-generation script to swap the Prisma provider based on `NEXT_PUBLIC_WWV_EDITION`. Abstract `src/lib/db.ts` to inject the correct adapter (better-sqlite3 vs pg) based on the edition.

**Tech Stack:** Prisma, PostgreSQL, SQLite.

---

### Task 1: Create Schema Swap Script

**Files:**
- Create: `scripts/prepare-schema.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create a schema swap script**

```javascript
// scripts/prepare-schema.mjs
import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

if (process.env.NEXT_PUBLIC_WWV_EDITION === 'cloud') {
  schema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  console.log("Swapped Prisma provider to PostgreSQL for cloud edition.");
} else {
  // Revert back to sqlite just in case it was swapped
  schema = schema.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
}

fs.writeFileSync(schemaPath, schema);
```

- [ ] **Step 2: Update package.json scripts**

Modify `package.json` to run the prepare script before prisma generate:
```json
    "pregenerate": "node scripts/prepare-schema.mjs",
    "generate": "prisma generate"
```

### Task 2: Create DB Adapter Factory

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/core/adapters/db.ts`

- [ ] **Step 1: Create the adapter factory**

```typescript
// src/core/adapters/db.ts
import { isCloud } from "@/core/edition";
import { PrismaClient } from "../../generated/prisma/client";

export function createPrismaClient(): PrismaClient {
    if (isCloud) {
        // Cloud uses native pg driver or connection pool via standard url
        return new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });
    } else {
        // Local uses better-sqlite3 adapter (already set up)
        const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
        const adapter = new PrismaBetterSqlite3({
            url: process.env.DATABASE_URL || "file:./data/wwv.db",
        });
        return new PrismaClient({ adapter });
    }
}
```

- [ ] **Step 2: Refactor `src/lib/db.ts`**

```typescript
// src/lib/db.ts
import { PrismaClient } from "../generated/prisma/client";
import { createPrismaClient } from "@/core/adapters/db";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json scripts/ src/lib/ src/core/adapters/
git commit -m "feat: multi-provider database adapter for cloud"
```
