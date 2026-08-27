/**
 * Client-side alert-rule API (P2, v1). Thin fetch wrappers over the alerts
 * REST surface; consumed by the alerts store slice. All endpoints require a
 * session (the app's own cookie).
 */

import type { AlertCondition } from "@worldwideview/wwv-plugin-sdk";

export interface AlertRuleRecord {
    id: string;
    pluginId: string;
    name: string;
    condition: AlertCondition;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AlertMutationResult {
    ok: boolean;
    status: number;
    error?: string;
    rule?: AlertRuleRecord;
}

async function parseError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as { message?: string; error?: string };
        return body.message ?? body.error ?? `Request failed (${res.status})`;
    } catch {
        return `Request failed (${res.status})`;
    }
}

export async function fetchAlertRules(): Promise<AlertRuleRecord[]> {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    if (!res.ok) throw new Error(await parseError(res));
    const data = (await res.json()) as { rules?: AlertRuleRecord[] };
    return data.rules ?? [];
}

export async function createAlertRule(input: {
    pluginId: string;
    name: string;
    condition: AlertCondition;
}): Promise<AlertMutationResult> {
    const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status, error: await parseError(res) };
    const data = (await res.json()) as { rule?: AlertRuleRecord };
    return { ok: true, status: res.status, rule: data.rule };
}

export async function updateAlertRule(
    id: string,
    patch: { enabled?: boolean; name?: string; condition?: AlertCondition },
): Promise<AlertMutationResult> {
    const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
    });
    if (!res.ok) return { ok: false, status: res.status, error: await parseError(res) };
    const data = (await res.json()) as { rule?: AlertRuleRecord };
    return { ok: true, status: res.status, rule: data.rule };
}

export async function deleteAlertRule(id: string): Promise<AlertMutationResult> {
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) return { ok: false, status: res.status, error: await parseError(res) };
    return { ok: true, status: res.status };
}