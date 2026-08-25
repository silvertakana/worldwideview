import { NextResponse } from "next/server";
import { getServerSession, requireSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { isDemo } from "@/core/edition";
import { MAX_SUMMARY_LENGTH, PLUGIN_ID_RE } from "@/lib/alerts/validation";

export const DEDUPE_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// POST /api/alerts/events — persist a fired alert (fire-and-forget from the
// client alert engine; dedupes same rule+entity within 60s).
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const auth = requireSession(await getServerSession());
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.ruleId !== "string" || body.ruleId.trim() === "") {
        return NextResponse.json({ error: "invalid_rule", message: "ruleId is required" }, { status: 422 });
    }
    if (typeof body.pluginId !== "string" || !PLUGIN_ID_RE.test(body.pluginId)) {
        return NextResponse.json({ error: "invalid_plugin", message: "pluginId is invalid" }, { status: 422 });
    }
    if (typeof body.summary !== "string" || body.summary.trim() === "") {
        return NextResponse.json({ error: "invalid_summary", message: "summary is required" }, { status: 422 });
    }
    if (body.summary.length > MAX_SUMMARY_LENGTH) {
        return NextResponse.json(
            { error: "invalid_summary", message: `summary must be ${MAX_SUMMARY_LENGTH} characters or fewer` },
            { status: 422 },
        );
    }
    const entityId = typeof body.entityId === "string" && body.entityId !== ""
        ? body.entityId
        : null;

    try {
        // The rule must exist and belong to this user (BOLA guard).
        const rule = await prisma.alertRule.findFirst({
            where: { id: body.ruleId, userId: auth.userId },
            select: { id: true },
        });
        if (!rule) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        // Idempotency: skip when the same rule+entity already fired within the window.
        const recent = await prisma.alertEvent.findFirst({
            where: {
                ruleId: body.ruleId,
                entityId,
                matchedAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
            },
            select: { id: true },
        });
        if (recent) {
            return NextResponse.json({ deduped: true });
        }

        const event = await prisma.alertEvent.create({
            data: {
                ruleId: body.ruleId,
                pluginId: body.pluginId,
                entityId,
                summary: body.summary,
            },
        });
        return NextResponse.json({
            event: { id: event.id, ruleId: event.ruleId, pluginId: event.pluginId, matchedAt: event.matchedAt },
        }, { status: 201 });
    } catch (err) {
        console.error("[alerts] events POST error:", err);
        return NextResponse.json({ error: "Failed to persist alert event" }, { status: 500 });
    }
}

export const runtime = "nodejs";