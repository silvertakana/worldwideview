# Robust Plugin Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure that when developers link local plugins using `wwv-cli link`, the main engine's database is automatically updated to prioritize the local code instead of accidentally loading the published version from the cloud CDN.

**Architecture:** We will implement a dedicated development API route in the main app (`/api/plugins/dev-link`) that allows the `wwv-cli` to safely push local plugin manifests directly into the `InstalledPlugin` database table without requiring Marketplace authentication. The CLI will be updated to make this request immediately after copying the bundle.

**Tech Stack:** Next.js API Routes, Prisma, Node.js `fetch`

---

### Task 1: Create the Dev-Link API Route

**Files:**
- Create: `c:\dev\worldwideview\src\app\api\plugins\dev-link\route.ts`

- [ ] **Step 1: Write the API Route**

```typescript
import { NextResponse } from "next/server";
import { upsertPlugin } from "@/lib/marketplace/repository";
import { validateManifest } from "@/core/plugins/validateManifest";
import { isPluginInstallEnabled } from "@/core/edition";

export async function POST(request: Request) {
    // 1. Security Check: Only allow in development mode or local editions
    if (process.env.NODE_ENV !== "development" && !isPluginInstallEnabled) {
        return NextResponse.json({ error: "Dev-link is only available in development environments" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { manifest } = body;

        if (!manifest || !manifest.id) {
            return NextResponse.json({ error: "Invalid payload. 'manifest' with an 'id' is required." }, { status: 400 });
        }

        // 2. Validate the manifest
        const validation = validateManifest(manifest);
        if (!validation.valid) {
            console.error(`[Dev-Link] Invalid manifest for ${manifest.id}:`, validation.errors);
            return NextResponse.json({ error: "Invalid manifest", details: validation.errors }, { status: 400 });
        }

        // 3. Upsert into database
        const config = JSON.stringify(manifest);
        const record = await upsertPlugin(manifest.id, manifest.version || "1.0.0", config);

        console.log(`[Dev-Link] Successfully synced local plugin config for: ${manifest.id}`);
        
        return NextResponse.json({ success: true, pluginId: record.pluginId });
    } catch (err) {
        console.error("[Dev-Link] Server Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Commit API Route**

```bash
git add src/app/api/plugins/dev-link/route.ts
git commit -m "feat(api): add dev-link route to sync local plugin manifests"
```

### Task 2: Update the CLI Link Command

**Files:**
- Modify: `c:\dev\worldwideview-plugins\packages\wwv-cli\src\commands\link.ts`

- [ ] **Step 1: Add the sync request to linkCommand**

Find the `linkCommand` function. Below the `fs.writeFileSync` that writes `plugin.json` (around line 67), add a network request to sync the database.

```typescript
    fs.writeFileSync(path.join(finalDestDir, 'plugin.json'), JSON.stringify(manifest, null, 2));
    console.log(green(`✅ Proxy manifest injected to WWV instance: ${pluginId}`));

    // --- NEW CODE: Sync with database ---
    fetch('http://localhost:3000/api/plugins/dev-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log(green(`✅ Database successfully synced to point to local files.`));
        } else {
            console.log(red(`⚠️ Warning: Database sync failed: ${data.error}`));
        }
    })
    .catch(err => {
        console.log(red(`⚠️ Warning: Could not reach dev server to sync DB. Is localhost:3000 running?`));
    });
    // --- END NEW CODE ---
```

- [ ] **Step 2: Rebuild the CLI**

```bash
cd packages/wwv-cli
pnpm build
```

- [ ] **Step 3: Commit CLI Update**

```bash
git add packages/wwv-cli/src/commands/link.ts
git commit -m "feat(cli): auto-sync local plugin manifests with engine database during link"
```

### Task 3: Test the Integration

- [ ] **Step 1: Run the Sync Command**

Run the updated sync command in the plugins repo to verify it pushes the manifest properly to the API.

```bash
cd c:\dev\worldwideview-plugins
pnpm run sync:all
```

- [ ] **Step 2: Verify Output**

Expected output in the plugins terminal should include:
`[wwv-plugin-osm-search] ✅ Database successfully synced to point to local files.`

Expected output in the main WorldWideView terminal should include:
`[Dev-Link] Successfully synced local plugin config for: osm-search`
