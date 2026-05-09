# Phase 3: Auth Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Supabase Auth for the cloud edition while maintaining the existing Credentials provider for the local edition.

**Architecture:** Use the NextAuth adapter pattern. Modify `src/lib/auth.ts` to dynamically include the Supabase provider and Supabase Adapter if `isCloud` is true.

**Tech Stack:** NextAuth v5, Supabase Auth.

---

### Task 1: Supabase Adapter Integration

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Supabase NextAuth Adapter**

Run: `pnpm add @auth/supabase-adapter`

- [ ] **Step 2: Update `src/lib/auth.ts` to branch providers**

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { isDemo, isCloud, getDemoAdminSecret, DEMO_ADMIN_ROLE } from "@/core/edition";
import { authConfig } from "@/lib/auth.config";
import { SupabaseAdapter } from "@auth/supabase-adapter";

// Extract local credentials logic to a helper
const localCredentialsProvider = Credentials({
    credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
        // ... existing credentials logic ...
        return null;
    }
});

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    session: { strategy: "jwt" },
    adapter: isCloud ? SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    }) : undefined,
    providers: isCloud 
        ? [] // If using standard GoTrue via custom logic, or add providers here if using NextAuth OAuth
        : [localCredentialsProvider],
    callbacks: {
        ...authConfig.callbacks,
        // ... existing callbacks ...
    },
});
```

### Task 2: Login Form Cloud Adaptation

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/login/actions.ts`

- [ ] **Step 1: Update Login Form for Cloud Mode**

```typescript
// src/app/login/actions.ts
import { signIn } from "@/lib/auth";
import { isCloud } from "@/core/edition";
import { createClient } from "@supabase/supabase-js";

export async function loginAction(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (isCloud) {
        // Use Supabase GoTrue
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        
        if (error) return { success: false, error: error.message };
        return { success: true };
    } else {
        // Use NextAuth Credentials
        try {
            await signIn("credentials", {
                email,
                password,
                redirect: false,
            });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: "Invalid credentials" };
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/auth.ts src/app/login/actions.ts
git commit -m "feat: supabase auth adapter for cloud edition"
```
