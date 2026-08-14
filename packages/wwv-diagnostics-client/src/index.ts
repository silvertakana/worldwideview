declare global {
    interface Window {
        ENV?: {
            NEXT_PUBLIC_DIAGNOSTIC_ENGINE_URL?: string;
        };
    }
}

export interface DiagnosticReport {
    message: string;
    severity?: "debug" | "info" | "warn" | "error" | "critical" | "fatal";
    category?: string;
    stack?: string;
    metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set(["key", "token", "auth", "password", "secret", "credential"]);
const BACKOFF_DURATION_MS = 60000;
let lastFailureTime = 0;

function generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `wwv-${timestamp}-${random}`;
}

function redactSensitiveKeys(obj: Record<string, unknown>): Record<string, unknown> {
    if (!obj || typeof obj !== "object") return {};
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
    }
    return result;
}

function redactString(str: string): string {
    if (typeof str !== "string") return str;
    return str
        .replace(/[?&]([a-z_]*(?:token|key|secret|password|auth|credential)[a-z_]*)=[^&\s]+/gi, "$1=[REDACTED]")
        .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
        .replace(/Basic\s+[^\s]+/gi, "Basic [REDACTED]");
}

/** Fire-and-forget. Never throws. No-ops when DIAGNOSTIC_ENGINE_URL is unset. */
export function reportToDiagnosticEngine(report: DiagnosticReport, source: string): void {
    const url = typeof window !== "undefined"
        ? window.ENV?.NEXT_PUBLIC_DIAGNOSTIC_ENGINE_URL
        : process.env.DIAGNOSTIC_ENGINE_URL;
    if (!url) return;
    if (Date.now() - lastFailureTime < BACKOFF_DURATION_MS) return;

    const entry = {
        id: generateId(),
        timestamp: Date.now(),
        severity: report.severity || "error",
        category: report.category || "runtime",
        message: redactString(report.message),
        stack: report.stack ? redactString(report.stack) : undefined,
        source,
        metadata: report.metadata ? redactSensitiveKeys(report.metadata) : undefined,
        sanitized: true,
    };

    try {
        const payload = JSON.stringify(entry);
        if (typeof window !== "undefined") {
            navigator.sendBeacon?.(`${url}/api/diagnostics/ingest`, payload);
        } else {
            fetch(`${url}/api/diagnostics/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
            }).catch(() => {
                lastFailureTime = Date.now();
            });
        }
    } catch {
        lastFailureTime = Date.now();
    }
}
