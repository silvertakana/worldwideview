import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * GET /api/build
 *
 * Lightweight build identification — lets you confirm exactly which build
 * the running browser tab is talking to. Pair with the `[wwv build] ...`
 * client-side console log so a refresh mismatch (browser holding stale
 * chunks) becomes obvious instead of looking like a feature regression.
 *
 * Public — no secrets here, just a build stamp + a few public flags useful
 * for diagnostics.
 */

function readMaybe(p: string): string | null {
    try {
        return fs.readFileSync(p, "utf-8").trim();
    } catch {
        return null;
    }
}

const BUILD_ID =
    process.env.NEXT_PUBLIC_WWV_BUILD_ID ??
    readMaybe(path.join(process.cwd(), ".build-id")) ??
    "dev";
const BUILD_AT =
    process.env.NEXT_PUBLIC_WWV_BUILD_AT ??
    readMaybe(path.join(process.cwd(), ".build-at")) ??
    null;

export async function GET() {
    return NextResponse.json({
        build_id: BUILD_ID,
        built_at: BUILD_AT,
        public_flags: {
            agent_bus_enabled:
                process.env.NEXT_PUBLIC_WWV_AGENT_BUS_ENABLED === "true",
            edition: process.env.NEXT_PUBLIC_WWV_EDITION ?? null,
        },
    });
}
