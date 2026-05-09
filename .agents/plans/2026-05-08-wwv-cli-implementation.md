# WorldWideView CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@worldwideview/cli`, a standalone CLI tool that scaffolds, hot-reloads, and packages WWV plugins using the Chrome Extension model, completely decoupled from the main monorepo build pipeline.

**Architecture:** A Node.js CLI built with `commander`. It uses `vite` programmatically to serve and build plugins. For dev mode, it attaches a `ws` WebSocket server to the Vite dev server to broadcast hot-reload events to the running WWV web app, and communicates with `/api/dev/load-unpacked` to inject the plugin. Publishing creates a `.wwvpkg` ZIP archive via `archiver`.

**Tech Stack:** Node.js, TypeScript, Commander, Vite, WebSocket (`ws`), Archiver, Vitest.

---

### Task 1: Initialize Package & CLI Entry Point

**Files:**
- Create: `packages/wwv-cli/package.json`
- Create: `packages/wwv-cli/tsconfig.json`
- Create: `packages/wwv-cli/bin/wwv.js`
- Create: `packages/wwv-cli/src/index.ts`
- Create: `packages/wwv-cli/tests/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/wwv-cli/tests/index.test.ts
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

describe("wwv cli", () => {
    it("should print help information", () => {
        const binPath = path.resolve(__dirname, "../bin/wwv.js");
        const output = execSync(`node ${binPath} --help`).toString();
        expect(output).toContain("Usage: wwv [options] [command]");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/wwv-cli && pnpm test`
Expected: FAIL (File not found or missing package.json setup)

- [ ] **Step 3: Write minimal implementation**

```json
// packages/wwv-cli/package.json
{
  "name": "@worldwideview/cli",
  "version": "1.0.0",
  "bin": { "wwv": "./bin/wwv.js" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "commander": "^11.1.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

```json
// packages/wwv-cli/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

```javascript
// packages/wwv-cli/bin/wwv.js
#!/usr/bin/env node
require('../dist/index.js');
```

```typescript
// packages/wwv-cli/src/index.ts
import { Command } from "commander";

const program = new Command();

program
  .name("wwv")
  .description("WorldWideView Plugin CLI")
  .version("1.0.0");

program.parse();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/wwv-cli && pnpm install && pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/wwv-cli
git commit -m "feat(wwv-cli): initialize cli package and entry point"
```

---

### Task 2: Implement `wwv create` (Scaffolding)

**Files:**
- Create: `packages/wwv-cli/src/commands/create.ts`
- Create: `packages/wwv-cli/tests/create.test.ts`
- Modify: `packages/wwv-cli/src/index.ts:10-15`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/wwv-cli/tests/create.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { createPlugin } from "../src/commands/create";
import fs from "fs";
import path from "path";

describe("create command", () => {
    const testDir = path.join(__dirname, "test-plugin");

    afterEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("should scaffold a new plugin folder with manifest and index.ts", async () => {
        await createPlugin("test-plugin", __dirname);
        expect(fs.existsSync(path.join(testDir, "wwv-manifest.json"))).toBe(true);
        expect(fs.existsSync(path.join(testDir, "src", "index.ts"))).toBe(true);
        
        const manifest = JSON.parse(fs.readFileSync(path.join(testDir, "wwv-manifest.json"), "utf-8"));
        expect(manifest.id).toBe("test-plugin");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/wwv-cli && pnpm test tests/create.test.ts`
Expected: FAIL ("createPlugin is not defined")

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/wwv-cli/src/commands/create.ts
import fs from "fs";
import path from "path";

export async function createPlugin(name: string, basePath: string = process.cwd()) {
    const targetDir = path.join(basePath, name);
    if (fs.existsSync(targetDir)) {
        throw new Error(`Directory ${name} already exists`);
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });

    const manifest = {
        manifest_version: 1,
        id: name,
        name: name,
        version: "1.0.0",
        description: "A WorldWideView plugin",
        type: "data-layer",
        category: "custom",
        icon: "Box",
        capabilities: ["data:own"],
        entry: "dist/frontend.mjs",
        dev_entry: "src/index.ts"
    };

    fs.writeFileSync(
        path.join(targetDir, "wwv-manifest.json"),
        JSON.stringify(manifest, null, 2)
    );

    const indexContent = `export default class MyPlugin {
    id = "${name}";
    name = "${name}";
    version = "1.0.0";
    category = "custom";
    icon = "Box";

    async initialize(ctx) {
        console.log("Initialized", this.id);
    }
    
    destroy() {}
    
    async fetch(timeRange) {
        return [];
    }
    
    getPollingInterval() {
        return 5000;
    }
    
    getLayerConfig() {
        return { color: "#3b82f6", clusterEnabled: true, clusterDistance: 50 };
    }
    
    renderEntity(entity) {
        return { type: "point", color: "#3b82f6", size: 6 };
    }
}
`;
    fs.writeFileSync(path.join(targetDir, "src", "index.ts"), indexContent);
    console.log(`Plugin ${name} scaffolded successfully in ./${name}`);
}
```

```typescript
// Modify packages/wwv-cli/src/index.ts (add this before program.parse())
import { createPlugin } from "./commands/create";

program
  .command("create <name>")
  .description("Scaffold a new WorldWideView plugin")
  .action(async (name) => {
      try {
          await createPlugin(name);
      } catch (err: any) {
          console.error("Error:", err.message);
          process.exit(1);
      }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/wwv-cli && pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/wwv-cli
git commit -m "feat(wwv-cli): implement create command for scaffolding"
```

---

### Task 3: Implement `wwv dev` (Vite Server + WebSocket)

**Files:**
- Create: `packages/wwv-cli/src/commands/dev.ts`
- Create: `packages/wwv-cli/tests/dev.test.ts`
- Modify: `packages/wwv-cli/src/index.ts:25-30`
- Modify: `packages/wwv-cli/package.json:13-15` (Add vite, ws)

- [ ] **Step 1: Write the failing test**

```typescript
// packages/wwv-cli/tests/dev.test.ts
import { describe, it, expect, vi } from "vitest";
import { startDevServer } from "../src/commands/dev";

// Mock vite and ws
vi.mock("vite", () => ({
    createServer: vi.fn().mockResolvedValue({
        listen: vi.fn(),
        httpServer: { on: vi.fn() },
        ws: { on: vi.fn() }
    })
}));

describe("dev command", () => {
    it("should export startDevServer function", () => {
        expect(typeof startDevServer).toBe("function");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/wwv-cli && pnpm test tests/dev.test.ts`
Expected: FAIL ("startDevServer is not defined")

- [ ] **Step 3: Write minimal implementation**

Add `vite` and `ws` to dependencies in `packages/wwv-cli/package.json` and run `pnpm install`:
```json
  "dependencies": {
    "commander": "^11.1.0",
    "vite": "^5.0.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10"
  }
```

```typescript
// packages/wwv-cli/src/commands/dev.ts
import fs from "fs";
import path from "path";
import { createServer } from "vite";
import { WebSocketServer } from "ws";

export async function startDevServer(targetUrl: string = "http://localhost:3000") {
    const cwd = process.cwd();
    const manifestPath = path.join(cwd, "wwv-manifest.json");
    
    if (!fs.existsSync(manifestPath)) {
        throw new Error("No wwv-manifest.json found in current directory");
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const port = 24601;

    // Start Vite Dev Server
    const vite = await createServer({
        root: cwd,
        server: { port, cors: true, hmr: false }, // We handle HMR via custom WS
        plugins: [{
            name: 'wwv-hmr',
            handleHotUpdate({ server }) {
                // When Vite detects file changes, broadcast to our custom WS
                wss.clients.forEach(client => {
                    client.send(JSON.stringify({ type: "plugin:updated", pluginId: manifest.id }));
                });
                return []; // Prevent default Vite HMR
            }
        }]
    });

    await vite.listen();

    // Attach custom WebSocket server for WWV DevModeSubscriber
    const wss = new WebSocketServer({ server: vite.httpServer as any, path: "/__wwv_dev__" });
    
    wss.on("connection", (ws) => {
        console.log(`[WWV CLI] Connected to WorldWideView instance`);
        ws.send(JSON.stringify({ type: "plugin:added", manifest }));
    });

    // Notify WorldWideView via API
    try {
        const fetch = (await import('node-fetch')).default || globalThis.fetch;
        await fetch(`${targetUrl}/api/dev/load-unpacked`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...manifest,
                entry: `http://localhost:${port}/${manifest.dev_entry || "src/index.ts"}`
            })
        });
        console.log(`[WWV CLI] Registered with WorldWideView at ${targetUrl}`);
    } catch (err: any) {
        console.error(`[WWV CLI] Failed to connect to ${targetUrl}: ${err.message}`);
        console.log(`Waiting for WorldWideView to connect via WebSocket...`);
    }

    console.log(`\n🚀 Dev server running on http://localhost:${port}`);
    console.log(`Watching for file changes in ${cwd}...\n`);
}
```

```typescript
// Modify packages/wwv-cli/src/index.ts (add this before program.parse())
import { startDevServer } from "./commands/dev";

program
  .command("dev")
  .description("Start the plugin development server with hot-reload")
  .option("-t, --target <url>", "Target WorldWideView URL", "http://localhost:3000")
  .action(async (options) => {
      try {
          await startDevServer(options.target);
      } catch (err: any) {
          console.error("Error:", err.message);
          process.exit(1);
      }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/wwv-cli && pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/wwv-cli
git commit -m "feat(wwv-cli): implement dev command with vite and websockets"
```

---

### Task 4: Implement `wwv publish` (.wwvpkg creation)

**Files:**
- Create: `packages/wwv-cli/src/commands/publish.ts`
- Create: `packages/wwv-cli/tests/publish.test.ts`
- Modify: `packages/wwv-cli/src/index.ts:40-45`
- Modify: `packages/wwv-cli/package.json:16-17` (Add archiver)

- [ ] **Step 1: Write the failing test**

```typescript
// packages/wwv-cli/tests/publish.test.ts
import { describe, it, expect } from "vitest";
import { buildPackage } from "../src/commands/publish";

describe("publish command", () => {
    it("should export buildPackage function", () => {
        expect(typeof buildPackage).toBe("function");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/wwv-cli && pnpm test tests/publish.test.ts`
Expected: FAIL ("buildPackage is not defined")

- [ ] **Step 3: Write minimal implementation**

Add `archiver` to dependencies in `packages/wwv-cli/package.json` and run `pnpm install`:
```json
  "dependencies": {
    "archiver": "^7.0.1"
  },
  "devDependencies": {
    "@types/archiver": "^6.0.2"
  }
```

```typescript
// packages/wwv-cli/src/commands/publish.ts
import fs from "fs";
import path from "path";
import { build } from "vite";
import archiver from "archiver";

export async function buildPackage() {
    const cwd = process.cwd();
    const manifestPath = path.join(cwd, "wwv-manifest.json");
    
    if (!fs.existsSync(manifestPath)) {
        throw new Error("No wwv-manifest.json found in current directory");
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    
    console.log(`[WWV CLI] Building production bundle...`);
    await build({
        root: cwd,
        build: {
            lib: {
                entry: path.resolve(cwd, manifest.dev_entry || "src/index.ts"),
                name: 'WWVPlugin',
                formats: ['es'],
                fileName: () => 'frontend.mjs'
            },
            outDir: 'dist',
            emptyOutDir: true
        }
    });

    const pkgName = `${manifest.id}-${manifest.version}.wwvpkg`;
    const outputPath = path.join(cwd, pkgName);
    
    console.log(`[WWV CLI] Creating archive ${pkgName}...`);
    
    await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        
        output.on("close", () => resolve());
        archive.on("error", (err) => reject(err));
        
        archive.pipe(output);
        
        archive.file(manifestPath, { name: "wwv-manifest.json" });
        archive.directory(path.join(cwd, "dist"), "dist");
        
        if (fs.existsSync(path.join(cwd, "data"))) {
            archive.directory(path.join(cwd, "data"), "data");
        }
        
        archive.finalize();
    });

    console.log(`\n🎉 Success! Package created at ${outputPath}`);
    console.log(`You can now upload this file to the WorldWideView Marketplace.`);
}
```

```typescript
// Modify packages/wwv-cli/src/index.ts (add this before program.parse())
import { buildPackage } from "./commands/publish";

program
  .command("publish")
  .description("Build and package the plugin into a .wwvpkg file")
  .action(async () => {
      try {
          await buildPackage();
      } catch (err: any) {
          console.error("Error:", err.message);
          process.exit(1);
      }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/wwv-cli && pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/wwv-cli
git commit -m "feat(wwv-cli): implement publish command for wwvpkg creation"
```
