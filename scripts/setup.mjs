#!/usr/bin/env node
/**
 * @file setup.mjs
 * @description One-command local setup utility.
 * Generates a .env file from .env.example and auto-fills sensitive 
 * secrets (like AUTH_SECRET) with secure random values.
 * @module scripts
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const EXAMPLE = resolve(ROOT, ".env.example");
const TARGET = resolve(ROOT, ".env.local");

if (existsSync(TARGET)) {
    console.log("✅ .env.local already exists — skipping setup.");
    console.log("   Delete it and re-run if you want to regenerate.");
    process.exit(0);
}

if (!existsSync(EXAMPLE)) {
    console.error("❌ .env.example not found. Are you in the right directory?");
    process.exit(1);
}

const secret = randomBytes(32).toString("hex");
const encryptionKey = randomBytes(32).toString("hex");
let content = readFileSync(EXAMPLE, "utf8");

// Fill in the AUTH_SECRET line
if (content.includes("AUTH_SECRET=")) {
    content = content.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`);
} else {
    content += `\nAUTH_SECRET=${secret}\n`;
}

// Fill in the ENCRYPTION_MASTER_KEY line
if (content.includes("ENCRYPTION_MASTER_KEY=")) {
    content = content.replace(/^ENCRYPTION_MASTER_KEY=.*$/m, `ENCRYPTION_MASTER_KEY=${encryptionKey}`);
} else {
    content += `\nENCRYPTION_MASTER_KEY=${encryptionKey}\n`;
}

// Strip comment-only sections (keep values)
content = content
    .split("\n")
    .map((line) => {
        // Un-comment AUTH_SECRET if it was commented out
        if (line.trim().startsWith("# AUTH_SECRET=")) return line.replace("# ", "");
        return line;
    })
    .join("\n");

writeFileSync(TARGET, content, "utf8");

console.log("✅ .env.local created with generated AUTH_SECRET and ENCRYPTION_MASTER_KEY.");
console.log("   Fill in any optional API keys (Cesium, Bing, OpenSky, etc.)");
console.log("   then run: pnpm dev");
