import { NextResponse } from "next/server";
import { feedbackLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";

// demo-gate: allow — public-by-design anonymous feedback submission. Demo users
// must be able to report issues; the route validates type/description/body size,
// rate-limits (5 req/min per IP), and writes ONLY to the configured webhook —
// no DB, no platform state mutation.

const ALLOWED_TYPES = ["Bug Report", "Feature Request", "Auth and Billing", "General Feedback"] as const;
const MAX_BODY_BYTES = 100_000;

export async function POST(request: Request) {
    // 1. Rate limit (5 req/min per IP — feedback is low-volume human-only)
    const rateLimited = feedbackLimiter.check(getClientIp(request));
    if (rateLimited) return rateLimited;

    // 2. Body size check before parsing
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    // 3. Parse JSON body
    let body: {
        type?: string;
        description?: string;
        steps?: string;
        attachLogs?: boolean;
        logData?: string;
        email?: string;
        screenshots?: string[];
        timestamp?: string;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // 4. Validate required fields
    if (!body.type || !(ALLOWED_TYPES as readonly string[]).includes(body.type)) {
        return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }
    if (!body.description || typeof body.description !== "string" || body.description.length < 10) {
        return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });
    }

    // 5. Forward to configured webhook (server-side only; NOT exposed to client)
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
    if (!webhookUrl) {
        console.error("[Feedback] FEEDBACK_WEBHOOK_URL is not configured");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    try {
        const upstream = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!upstream.ok) {
            console.error(`[Feedback] Webhook returned ${upstream.status}`);
            return NextResponse.json({ error: "Failed to submit feedback" }, { status: 502 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Feedback] Upstream request failed:", err);
        return NextResponse.json({ error: "Failed to submit feedback" }, { status: 502 });
    }
}

export const runtime = "nodejs";
