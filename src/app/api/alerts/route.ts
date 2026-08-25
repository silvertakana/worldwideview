import { NextResponse } from "next/server";
import type { AlertCondition } from "@worldwideview/wwv-plugin-sdk";
import type { Prisma } from "@/generated/prisma";
import { getServerSession, requireSession } from "@/lib/ba-session";
import { prisma } from "@/lib/db";
import { isDemo } from "@/core/edition";
import { isKnownPluginId } from "@/lib/alerts/knownPlugins";
import { PLUGIN_ID_RE, validateCondition, validateRuleName } from "@/lib/alerts/validation";

interface RuleRecord {
    id: string;
    pluginId: string;
    name: string;
    condition: AlertCondition;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function toRuleRecord(row: {
    id: string;
    pluginId: string;
    name: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    condition: unknown;
}): RuleRecord {
    return {
        id: row.id,
        pluginId: row.pluginId,
        name: row.name,
        condition: row.condition as AlertCondition,
        enabled: row.enabled,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

// ---------------------------------------------------------------------------
// GET /api/alerts — list the current user's rules, newest first
// ---------------------------------------------------------------------------

export async function GET() {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const auth = requireSession(await getServerSession());
    if (auth instanceof NextResponse) return auth;

    try {
        const rows = await prisma.alertRule.findMany({
            where: { userId: auth.userId },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ rules: rows.map(toRuleRecord) });
    } catch (err) {
        console.error("[alerts] GET error:", err);
        return NextResponse.json({ error: "Failed to fetch alert rules" }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// POST /api/alerts — create a rule
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    if (isDemo) {
        return NextResponse.json({ error: "Not available in demo edition" }, { status: 403 });
    }

    const auth = requireSession(await getServerSession());
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.pluginId !== "string" || !PLUGIN_ID_RE.test(body.pluginId)) {
        return NextResponse.json(
            { error: "invalid_plugin", message: "pluginId must be a valid plugin channel id" },
            { status: 422 },
        );
    }

    const nameError = validateRuleName(body.name);
    if (nameError) {
        return NextResponse.json({ error: "invalid_name", message: nameError }, { status: 422 });
    }

    const conditionError = validateCondition(body.condition);
    if (conditionError) {
        return NextResponse.json(
            { error: "invalid_condition", message: conditionError },
            { status: 422 },
        );
    }

    try {
        if (!(await isKnownPluginId(body.pluginId))) {
            return NextResponse.json(
                { error: "unknown_plugin", message: `No known channel named "${body.pluginId}"` },
                { status: 422 },
            );
        }
    } catch {
        return NextResponse.json(
            { error: "unknown_plugin", message: "Could not verify plugin channel" },
            { status: 422 },
        );
    }

    try {
        const created = await prisma.alertRule.create({
            data: {
                userId: auth.userId,
                pluginId: body.pluginId,
                name: (body.name as string).trim(),
                condition: body.condition as Prisma.InputJsonValue,
            },
        });
        return NextResponse.json({ rule: toRuleRecord(created) }, { status: 201 });
    } catch (err) {
        console.error("[alerts] POST error:", err);
        return NextResponse.json({ error: "Failed to create alert rule" }, { status: 500 });
    }
}

export const runtime = "nodejs";