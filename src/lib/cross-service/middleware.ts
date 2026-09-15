import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { CrossServiceFailureReason } from "./types";
import { verifyCrossServiceSignature } from "./verify";

/**
 * Every cross-service rejection returns this exact response.
 *
 * A missing header, a malformed header, an expired timestamp, a bad signature
 * and a replayed nonce are indistinguishable to the caller: same status, same
 * body, no extra headers. The reason is reported to Sentry instead, where
 * operators can see it and a caller cannot probe the verifier with it.
 */
function unauthorized(): NextResponse {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Report why a request was rejected.
 *
 * Only the reason, method and pathname travel: the query string can carry an
 * email address and the headers carry the signature, and neither belongs in an
 * error report. A missing secret is an operator fault rather than a rejected
 * caller, so it is escalated to error level.
 *
 * `reason` is optional only because the success case shares the same flat
 * result type; verifyCrossServiceSignature sets one on every failure path.
 */
function reportRejection(reason: CrossServiceFailureReason | undefined, request: Request): void {
    const failure = reason ?? "unspecified";

    Sentry.captureMessage(`[cross-service] request rejected: ${failure}`, {
        level: failure === "server_configuration_error" ? "error" : "warning",
        extra: {
            reason: failure,
            method: request.method,
            path: new URL(request.url).pathname,
        },
    });
}

export async function crossServiceAuth(request: Request): Promise<NextResponse | null> {
    const sigHeader = request.headers.get("X-Service-Signature");
    if (!sigHeader) {
        reportRejection("missing_header", request);
        return unauthorized();
    }

    const rawBody = await request.clone().text();
    const result = await verifyCrossServiceSignature(request, rawBody);
    if (!result.valid) {
        reportRejection(result.reason, request);
        return unauthorized();
    }

    return null;
}
