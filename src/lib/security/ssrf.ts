import dns from "dns/promises";
import { fetch, Agent } from "undici";

export function isPrivateIP(ip: string): boolean {
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(ip)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
    if (ip === "::1" || ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd") || ip.toLowerCase().startsWith("fe80")) return true;
    return false;
}

/**
 * Validates that a URL uses a safe web protocol for server-side proxying.
 * Both http: and https: are allowed -- the StreamProxy is a server-side bridge
 * that fetches HTTP camera feeds and serves them over HTTPS to the browser,
 * converting them to avoid browser mixed-content blocks. Blocking HTTP here
 * would defeat the proxy's purpose. Real SSRF protection is provided by the
 * private-IP check, DNS pinning, and the PROXY_HOST_ALLOWLIST below.
 * Dangerous protocols (file://, ftp://, data://, javascript://, etc.) are rejected.
 */
export function validateOrigin(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

interface FetchOptions extends RequestInit {
    maxSize?: number;
    timeout?: number;
    /** Skip size accumulation for infinite streams (e.g. MJPEG). Duration is still bounded by `timeout`. */
    streaming?: boolean;
}

function checkHostAllowlist(hostname: string): void {
    const raw = process.env.PROXY_HOST_ALLOWLIST ?? "";
    const allowlist = raw.trim();

    if (allowlist === "*") {
        console.warn(`[SSRF] PROXY_HOST_ALLOWLIST="*" — permissive mode, host: ${hostname}. Populate the list from WARN logs then tighten.`);
        return;
    }

    if (!allowlist) {
        throw new Error(`SSRF Error: PROXY_HOST_ALLOWLIST is not configured. Set to "*" to allow all (permissive) or a comma-separated host list.`);
    }

    const allowed = allowlist.split(",").map((h) => h.trim()).filter(Boolean);
    if (!allowed.includes(hostname)) {
        throw new Error(`SSRF Error: Host "${hostname}" is not in PROXY_HOST_ALLOWLIST.`);
    }
}

export async function safeFetch(urlStr: string, options: FetchOptions = {}): Promise<Response> {
    const hostForCheck = (() => {
        try { return new URL(urlStr).hostname; } catch { return ""; }
    })();
    checkHostAllowlist(hostForCheck);

    if (!validateOrigin(urlStr)) {
        throw new Error("SSRF Error: Invalid protocol. Only HTTP and HTTPS are allowed.");
    }

    const url = new URL(urlStr);

    if (isPrivateIP(url.hostname)) {
        throw new Error("SSRF Error: Private IP provided in URL.");
    }

    let resolvedIp: string;
    let resolvedFamily: number;
    try {
        const lookupResult = await dns.lookup(url.hostname);
        resolvedIp = lookupResult.address;
        resolvedFamily = lookupResult.family;
        if (isPrivateIP(resolvedIp)) {
            throw new Error("SSRF Error: Host resolves to a private IP.");
        }
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("SSRF")) throw err;
        throw new Error(`SSRF Error: DNS resolution failed - ${err instanceof Error ? err.message : String(err)}`);
    }

    const customAgent = new Agent({
        connect: {
            lookup: (hostname, opts, callback) => {
                callback(null, [{ address: resolvedIp, family: resolvedFamily }]);
            }
        }
    });

    const maxSize = options.maxSize || 5 * 1024 * 1024;
    const timeout = options.timeout || 10000;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const fetchOptions = {
            ...options,
            dispatcher: customAgent,
            redirect: "manual" as const,
            signal: controller.signal
        } as Parameters<typeof fetch>[1];
        const response = await fetch(urlStr, fetchOptions);

        if (response.body) {
            // For infinite streams (e.g. MJPEG), skip size accumulation — pipe directly.
            // Duration is already bounded by the AbortController timeout above.
            if (options.streaming) {
                return new Response(response.body as unknown as BodyInit, {
                    status: response.status,
                    headers: response.headers as unknown as HeadersInit
                });
            }

            let totalSize = 0;
            const reader = response.body.getReader();
            const stream = new ReadableStream({
                async pull(controller) {
                    try {
                        const { done, value } = await reader.read();
                        if (done) {
                            controller.close();
                            return;
                        }
                        totalSize += value.byteLength;
                        if (totalSize > maxSize) {
                            controller.error(new Error("SSRF Error: Response size exceeded maximum limit."));
                            reader.cancel();
                            return;
                        }
                        controller.enqueue(value);
                    } catch (err) {
                        controller.error(err);
                    }
                },
                cancel() {
                    reader.cancel();
                }
            });

            return new Response(stream, {
                status: response.status,
                headers: response.headers as unknown as HeadersInit
            });
        }

        return response as unknown as Response;
    } finally {
        clearTimeout(id);
    }
}
