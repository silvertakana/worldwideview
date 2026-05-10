# Phase 6: Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Stripe subscriptions for the cloud edition, generating license keys upon payment.

**Architecture:** Use Stripe Checkout Sessions for upgrades. Use Stripe Webhooks to listen for `checkout.session.completed` and `customer.subscription.updated` to update the user's tier in the database and generate their JWT license key.

**Tech Stack:** Stripe Node SDK, Next.js API Routes.

---

### Task 1: Stripe Integration

**Files:**
- Modify: `package.json`
- Create: `src/lib/stripe/client.ts`
- Create: `src/app/api/billing/webhook/route.ts`
- Create: `src/app/api/billing/checkout/route.ts`

- [ ] **Step 1: Install SDK**

Run: `pnpm add stripe`

- [ ] **Step 2: Create Stripe Client**

```typescript
// src/lib/stripe/client.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-04-10",
});
```

- [ ] **Step 3: Create Checkout Route**

```typescript
// src/app/api/billing/checkout/route.ts
import { stripe } from "@/lib/stripe/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { priceId } = await req.json();

    const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,
        client_reference_id: session.user.id,
    });

    return NextResponse.json({ url: checkoutSession.url });
}
```

- [ ] **Step 4: Create Webhook Handler**

```typescript
// src/app/api/billing/webhook/route.ts
import { stripe } from "@/lib/stripe/client";
import { NextResponse } from "next/server";
// ... basic webhook payload verification and logging ...
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/stripe/ src/app/api/billing/
git commit -m "feat: stripe checkout and webhook integration"
```
