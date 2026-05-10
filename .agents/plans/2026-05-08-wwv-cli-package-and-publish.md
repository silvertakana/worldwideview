# Split CLI Publish into Package and Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the CLI publish command into `package` (for local .wwvpkg zip creation) and `publish` (for NPM distribution and marketplace registry updates).

**Architecture:** 
The current `publish` command creates a `.wwvpkg` file. We will rename this functionality to the `package` command. Then, we will create a true `publish` command that handles building the plugin, automatically generating a valid `package.json` from the `wwv-manifest.json`, running `npm publish` via a child process, and finally notifying the marketplace of the new release.

**Tech Stack:** TypeScript, Vite, Node.js `child_process`, Node.js `fs`.

---

### Task 1: Rename current publish to package

We will rename the file and its internal function from `buildPackage` to `packagePlugin`.

**Files:**
- Modify: `packages/wwv-cli/src/commands/publish.ts` -> rename to `packages/wwv-cli/src/commands/package.ts`
- Modify: `packages/wwv-cli/tests/publish.test.ts` -> rename to `packages/wwv-cli/tests/package.test.ts`

- [ ] **Step 1: Rename the command file and update function name**

```typescript
// packages/wwv-cli/src/commands/package.ts
import fs from "fs";
import path from "path";
import { build } from "vite";
import archiver from "archiver";

export async function packagePlugin() {
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
    console.log(`You can use this file to sideload the plugin into your WWV instance.`);
}
```

- [ ] **Step 2: Rename and update the test**

```typescript
// packages/wwv-cli/tests/package.test.ts
import { describe, it, expect } from "vitest";
import { packagePlugin } from "../src/commands/package";

describe("package command", () => {
    it("should export packagePlugin function", () => {
        expect(typeof packagePlugin).toBe("function");
    });
});
```

- [ ] **Step 3: Remove old files**

Run: `git rm packages/wwv-cli/src/commands/publish.ts packages/wwv-cli/tests/publish.test.ts`
Expected: Files deleted.

- [ ] **Step 4: Commit**

```bash
git add packages/wwv-cli/src/commands/package.ts packages/wwv-cli/tests/package.test.ts
git commit -m "refactor(wwv-cli): rename publish to package for wwvpkg creation"
```

---

### Task 2: Implement true NPM Publish command

**Files:**
- Create: `packages/wwv-cli/src/commands/publish.ts`
- Create: `packages/wwv-cli/tests/publish.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/wwv-cli/tests/publish.test.ts
import { describe, it, expect, vi } from "vitest";
import { publishToNpm } from "../src/commands/publish";

vi.mock("child_process", () => ({
    execSync: vi.fn()
}));
vi.mock("vite", () => ({
    build: vi.fn().mockResolvedValue({})
}));

describe("publish command", () => {
    it("should export publishToNpm function", () => {
        expect(typeof publishToNpm).toBe("function");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/publish.test.ts` inside `packages/wwv-cli`
Expected: FAIL because `publishToNpm` does not exist.

- [ ] **Step 3: Write the publish implementation**

```typescript
// packages/wwv-cli/src/commands/publish.ts
import fs from "fs";
import path from "path";
import { build } from "vite";
import { execSync } from "child_process";

export async function publishToNpm() {
    const cwd = process.cwd();
    const manifestPath = path.join(cwd, "wwv-manifest.json");
    
    if (!fs.existsSync(manifestPath)) {
        throw new Error("No wwv-manifest.json found in current directory");
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    
    console.log(`[WWV CLI] Compiling bundle for NPM...`);
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

    console.log(`[WWV CLI] Generating package.json...`);
    // Create a temporary package.json required for NPM publish
    const packageJsonPath = path.join(cwd, "package.json");
    const packageJson = {
        name: manifest.id, // e.g. @username/my-plugin
        version: manifest.version,
        description: manifest.description,
        main: "dist/frontend.mjs",
        type: "module",
        files: ["dist", "wwv-manifest.json", "data"],
        keywords: ["worldwideview", "plugin", manifest.category],
        author: manifest.author || ""
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log(`[WWV CLI] Publishing to NPM...`);
    try {
        execSync(`npm publish --access public`, { stdio: "inherit", cwd });
    } catch (err) {
        console.error(`[WWV CLI] NPM publish failed. Please ensure you are logged in via 'npm login'.`);
        throw err;
    } finally {
        // Clean up the generated package.json so it doesn't clutter the dev's repo
        fs.unlinkSync(packageJsonPath);
    }

    console.log(`[WWV CLI] Notifying WorldWideView Marketplace...`);
    try {
        const targetUrl = process.env.WWV_MARKETPLACE_URL || "https://marketplace.worldwideview.dev";
        await fetch(`${targetUrl}/api/webhooks/npm-publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pluginId: manifest.id, version: manifest.version })
        });
        console.log(`[WWV CLI] Marketplace notified.`);
    } catch (err: any) {
        console.warn(`[WWV CLI] Could not notify marketplace: ${err.message}. It will be indexed on the next sweep.`);
    }

    console.log(`\n🚀 Success! Version ${manifest.version} published globally to NPM.`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/publish.test.ts` inside `packages/wwv-cli`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/wwv-cli/src/commands/publish.ts packages/wwv-cli/tests/publish.test.ts
git commit -m "feat(wwv-cli): implement npm publish and marketplace webhook ping"
```

---

### Task 3: Update CLI Entry Point

**Files:**
- Modify: `packages/wwv-cli/src/index.ts:36-50`

- [ ] **Step 1: Write the updated entry point logic**

Replace the existing `publish` command logic with both `package` and `publish`:

```typescript
// Edit packages/wwv-cli/src/index.ts
import { Command } from "commander";
import { createPlugin } from "./commands/create";
import { startDevServer } from "./commands/dev";
import { packagePlugin } from "./commands/package";
import { publishToNpm } from "./commands/publish";

const program = new Command();

program
  .name("wwv")
  .description("WorldWideView Plugin CLI")
  .version("1.0.0");

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

program
  .command("package")
  .description("Build and package the plugin into a .wwvpkg file for sideloading")
  .action(async () => {
      try {
          await packagePlugin();
      } catch (err: any) {
          console.error("Error:", err.message);
          process.exit(1);
      }
  });

program
  .command("publish")
  .description("Publish the plugin to NPM and notify the WWV Marketplace")
  .action(async () => {
      try {
          await publishToNpm();
      } catch (err: any) {
          console.error("Error:", err.message);
          process.exit(1);
      }
  });

program.parse();
```

- [ ] **Step 2: Build to verify no TypeScript errors**

Run: `pnpm run build` inside `packages/wwv-cli`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add packages/wwv-cli/src/index.ts
git commit -m "feat(wwv-cli): register package and npm publish commands"
```
