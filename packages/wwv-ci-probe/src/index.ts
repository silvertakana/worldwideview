#!/usr/bin/env node
import { Command } from "commander";
import { probeSeeder } from "./seeder.js";
import { probeWs } from "./ws.js";
import { probeIdContract } from "./id-contract.js";

const program = new Command();

program
  .name("wwv-probe")
  .description("WorldWideView CI probe — asserts plugin/seeder integration health")
  .version("0.1.0");

program
  .command("seeder")
  .description("Wait for Redis key data:<name>:live to be populated and validate payload shape")
  .argument("<name>", "Canonical plugin id (kebab-case)")
  .option("--redis <url>", "Redis URL", "redis://localhost:6379")
  .option("--timeout <ms>", "Timeout in milliseconds", "60000")
  .action(async (name: string, opts: { redis: string; timeout: string }) => {
    const ok = await probeSeeder({
      name,
      redisUrl: opts.redis,
      timeoutMs: Number(opts.timeout),
    });
    process.exit(ok ? 0 : 1);
  });

program
  .command("ws")
  .description("Connect to engine /stream and wait for a data payload for the given pluginId")
  .argument("<name>", "Canonical plugin id (kebab-case)")
  .option("--url <url>", "WebSocket URL (defaults to WWV_ENGINE_URL, then local engine)", process.env.WWV_ENGINE_URL ?? "ws://localhost:5000/stream")
  .option("--timeout <ms>", "Timeout in milliseconds", "30000")
  .action(async (name: string, opts: { url: string; timeout: string }) => {
    const ok = await probeWs({
      name,
      wsUrl: opts.url,
      timeoutMs: Number(opts.timeout),
    });
    process.exit(ok ? 0 : 1);
  });

program
  .command("id-contract")
  .description("Verify seeder dist exports a kebab-case name matching the expected plugin id (ADR-0002)")
  .argument("<seederDist>", "Path to compiled seeder dist/index.mjs")
  .option("--expect <id>", "Expected plugin id (if omitted, only validates kebab-case)")
  .action(async (seederDist: string, opts: { expect?: string }) => {
    const ok = await probeIdContract({
      seederDist,
      expectId: opts.expect,
    });
    process.exit(ok ? 0 : 1);
  });

program.parseAsync().catch((err) => {
  console.error("[wwv-probe] fatal:", err);
  process.exit(2);
});
