# Phase 4: License Keys & Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement RSA-signed JWT license keys to gate Pro and Enterprise features on both Local and Cloud editions.

**Architecture:** A hardcoded public key verifies the JWT. The JWT payload dictates the tier (`free`, `pro`, `enterprise`) and expiration. The `uiSlice` state provides easy access to the active tier.

**Tech Stack:** `jose` for JWT verification.

---

### Task 1: License Verification Module

**Files:**
- Create: `src/core/license/verifyLicense.ts`
- Create: `src/core/license/tiers.ts`

- [ ] **Step 1: Create Tier Definitions**

```typescript
// src/core/license/tiers.ts
export type LicenseTier = "free" | "pro" | "team" | "enterprise";

export interface TierFeatures {
    maxUsers: number;
    storageQuotaBytes: number;
    historyEnabled: boolean;
    snapshotCapture: boolean;
    customDomains: boolean;
}

export const TIER_FEATURES: Record<LicenseTier, TierFeatures> = {
    free: { maxUsers: 3, storageQuotaBytes: 500 * 1024 * 1024, historyEnabled: false, snapshotCapture: false, customDomains: false },
    pro: { maxUsers: 20, storageQuotaBytes: 5 * 1024 * 1024 * 1024, historyEnabled: true, snapshotCapture: true, customDomains: false },
    team: { maxUsers: -1, storageQuotaBytes: -1, historyEnabled: true, snapshotCapture: true, customDomains: false },
    enterprise: { maxUsers: -1, storageQuotaBytes: -1, historyEnabled: true, snapshotCapture: true, customDomains: true },
};
```

- [ ] **Step 2: Create JWT Verification**

```typescript
// src/core/license/verifyLicense.ts
import * as jose from "jose";

// Public key is safe to hardcode/ship to client
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu... (generate real one)
-----END PUBLIC KEY-----`;

export interface LicensePayload {
    tier: "pro" | "team" | "enterprise";
    exp: number;
    org: string;
}

export async function verifyLicenseKey(token: string): Promise<LicensePayload | null> {
    try {
        const publicKey = await jose.importSPKI(PUBLIC_KEY_PEM, "RS256");
        const { payload } = await jose.jwtVerify(token, publicKey);
        return payload as unknown as LicensePayload;
    } catch {
        return null;
    }
}
```

### Task 2: State Integration

**Files:**
- Modify: `src/core/state/configSlice.ts`
- Modify: `src/components/panels/SettingsPanel.tsx`

- [ ] **Step 1: Add license to configSlice**

```typescript
// src/core/state/configSlice.ts
// Add to DataConfig:
export interface DataConfig {
    // ... existing ...
    licenseKey: string | null;
    activeTier: "free" | "pro" | "team" | "enterprise";
}

// Add to initial state:
// licenseKey: null, activeTier: "free"
```

- [ ] **Step 2: Add License input UI**

Add a text input in `SettingsPanel` for users to paste their license key, dispatching an action to verify and save it to the DB and Zustand store.

- [ ] **Step 3: Commit**

```bash
git add src/core/license/ src/core/state/configSlice.ts src/components/panels/
git commit -m "feat: rsa jwt license key verification"
```
