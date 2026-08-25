import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { getServerSession, requireSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { isDemo } from "@/core/edition";
import { validateCondition, validateRuleName } from "@/lib/alerts/validation";

// ---------------------------------------------------------------------------
// PATCH /api/alerts/[id] — update own rule (enable/disable, rename, condition)
// ---------------------------------------------------------------------------

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const auth = requireSession(await getServerSession());
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Prisma.AlertRuleUpdateManyMutationInput = {};

    if ("enabled" in body) {
        if (typeof body.enabled !== "boolean") {
            return NextResponse.json(
                { error: "invalid_enabled", message: "enabled must be a boolean" },
                { status: 422 },
            );
        }
        data.enabled = body.enabled;
    }
    if ("name" in body) {
        const nameError = validateRuleName(body.name);
        if (nameError) {
            return NextResponse.json({ error: "invalid_name", message: nameError }, { status: 422 });
        }
        data.name = (body.name as string).trim();
    }
    if ("condition" in body) {
        const conditionError = validateCondition(body.condition);
        if (conditionError) {
            return NextResponse.json(
                { error: "invalid_condition", message: conditionError },
                { status: 422 },
            );
        }
        data.condition = body.condition as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json(
            { error: "empty_update", message: "Provide at least one of enabled, name, condition" },
            { status: 422 },
        );
    }

    try {
        // Ownership-scoped updateMany — a foreign id yields count 0 (404), no TOCTOU.
        const updated = await prisma.alertRule.updateMany({
            where: { id, userId: auth.userId },
            data,
        });
        if (updated.count === 0) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const row = await prisma.alertRule.findFirst({
            where: { id, userId: auth.userId },
        });
        if (!row) {
            // Row vanished between update and read (concurrent delete).
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        return NextResponse.json({
            rule: {
                id: row.id,
                pluginId: row.pluginId,
                name: row.name,
                condition: row.condition,
                enabled: row.enabled,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            },
        });
    } catch (err) {
        console.error("[alerts] PATCH error:", err);
        return NextResponse.json({ error: "Failed to update alert rule" }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/alerts/[id] — remove own rule (cascades to its events)
// ---------------------------------------------------------------------------

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const auth = requireSession(await getServerSession());
    if (auth instanceof NextResponse) return auth;

    try {
        const deleted = await prisma.alertRule.deleteMany({
            where: { id, userId: auth.userId },
        });
        if (deleted.count === 0) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[alerts] DELETE error:", err);
        return NextResponse.json({ error: "Failed to delete alert rule" }, { status: 500 });
    }
}

export const runtime = "nodejs";