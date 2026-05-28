import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockUndiciF, mockDnsLookup } = vi.hoisted(() => ({
    mockUndiciF: vi.fn(),
    mockDnsLookup: vi.fn(),
}));

vi.mock("dns/promises", () => ({
    default: { lookup: mockDnsLookup },
}));

vi.mock("undici", async (importOriginal) => {
    const original = await importOriginal<typeof import("undici")>();
    return { ...original, fetch: mockUndiciF };
});

import { safeFetch, validateOrigin, isPrivateIP } from "./ssrf";

describe("SSRF Protection Utility", () => {
    describe("isPrivateIP", () => {
        it("should return true for local and private IPs", () => {
            expect(isPrivateIP("127.0.0.1")).toBe(true);
            expect(isPrivateIP("10.0.0.1")).toBe(true);
            expect(isPrivateIP("192.168.1.1")).toBe(true);
            expect(isPrivateIP("172.16.0.1")).toBe(true);
            expect(isPrivateIP("::1")).toBe(true);
            expect(isPrivateIP("0.0.0.0")).toBe(true);
        });

        it("should return true for AWS/GCP metadata IPs", () => {
            expect(isPrivateIP("169.254.169.254")).toBe(true);
        });

        it("should return false for public IPs", () => {
            expect(isPrivateIP("8.8.8.8")).toBe(false);
            expect(isPrivateIP("1.1.1.1")).toBe(false);
        });
    });

    describe("validateOrigin", () => {
        it("should allow https origins", () => {
            expect(validateOrigin("https://api.github.com/v1")).toBe(true);
        });

        it("should allow http origins (StreamProxy fetches HTTP camera feeds server-side)", () => {
            expect(validateOrigin("http://camera.example.com/stream")).toBe(true);
        });

        it("should reject dangerous non-web protocols", () => {
            expect(validateOrigin("ftp://api.github.com")).toBe(false);
            expect(validateOrigin("file:///etc/passwd")).toBe(false);
            expect(validateOrigin("data:text/html,<h1>xss</h1>")).toBe(false);
            expect(validateOrigin("javascript:alert(1)")).toBe(false);
        });
    });

    describe("checkHostAllowlist via safeFetch", () => {
        const originalAllowlist = process.env.PROXY_HOST_ALLOWLIST;

        afterEach(() => {
            if (originalAllowlist === undefined) {
                delete process.env.PROXY_HOST_ALLOWLIST;
            } else {
                process.env.PROXY_HOST_ALLOWLIST = originalAllowlist;
            }
        });

        it("denies all when PROXY_HOST_ALLOWLIST is unset", async () => {
            delete process.env.PROXY_HOST_ALLOWLIST;
            await expect(safeFetch("https://camera.example.com/feed")).rejects.toThrow(/SSRF.*PROXY_HOST_ALLOWLIST/);
        });

        it("denies all when PROXY_HOST_ALLOWLIST is empty string", async () => {
            process.env.PROXY_HOST_ALLOWLIST = "";
            await expect(safeFetch("https://camera.example.com/feed")).rejects.toThrow(/SSRF.*PROXY_HOST_ALLOWLIST/);
        });

        it("rejects a host not in the concrete allowlist", async () => {
            process.env.PROXY_HOST_ALLOWLIST = "allowed.example.com";
            await expect(safeFetch("https://blocked.example.com/feed")).rejects.toThrow(/not in PROXY_HOST_ALLOWLIST/);
        });

        it("passes the allowlist check for '*' but still rejects private IPs", async () => {
            process.env.PROXY_HOST_ALLOWLIST = "*";
            // Private IP clears the allowlist but the post-DNS private-IP check still fires
            await expect(safeFetch("https://127.0.0.1/data")).rejects.toThrow(/SSRF/);
        });
    });

    describe("safeFetch", () => {
        const PUBLIC_IP = "93.184.216.34";

        beforeEach(() => {
            vi.clearAllMocks();
            process.env.PROXY_HOST_ALLOWLIST = "*";
        });

        afterEach(() => {
            delete process.env.PROXY_HOST_ALLOWLIST;
        });

        it("should reject private IPs immediately", async () => {
            await expect(safeFetch("https://127.0.0.1/data")).rejects.toThrow(/SSRF/);
            await expect(safeFetch("https://169.254.169.254/latest/meta-data")).rejects.toThrow(/SSRF/);
        });

        it("should reject dangerous protocols (ftp, file, etc.)", async () => {
            await expect(safeFetch("ftp://camera.example.com/stream")).rejects.toThrow(/SSRF.*protocol/i);
            await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/SSRF.*protocol/i);
        });

        it("should accept HTTP URLs (StreamProxy use case — camera feeds)", async () => {
            mockDnsLookup.mockResolvedValue({ address: PUBLIC_IP, family: 4 });
            mockUndiciF.mockResolvedValueOnce(new Response("stream-data", { status: 200 }));

            const response = await safeFetch("http://camera.example.com/stream");
            expect(response.status).toBe(200);
        });

        it("enforces maxSize — responses exceeding the limit error on body read", async () => {
            mockDnsLookup.mockResolvedValue({ address: PUBLIC_IP, family: 4 });
            const oversized = new Uint8Array(11); // 11 bytes > 10-byte limit
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(oversized);
                    controller.close();
                },
            });
            mockUndiciF.mockResolvedValueOnce(new Response(stream, { status: 200 }));

            const response = await safeFetch("https://example.com/feed", { maxSize: 10 });
            await expect(response.text()).rejects.toThrow(/size exceeded/);
        });

        it("uses undici dispatcher pinned to the resolved IP and does not follow redirects", async () => {
            mockDnsLookup.mockResolvedValue({ address: PUBLIC_IP, family: 4 });
            // safeFetch uses redirect:"manual" -- this 301 must not be followed
            mockUndiciF.mockResolvedValueOnce(
                new Response(null, { status: 301, headers: { Location: "https://evil-rebind.example.com" } })
            );

            const response = await safeFetch("https://example.com/feed");

            // DNS resolved exactly once; redirect was NOT followed (fetch still once)
            expect(mockDnsLookup).toHaveBeenCalledOnce();
            expect(mockUndiciF).toHaveBeenCalledOnce();
            expect(response.status).toBe(301);

            // fetch was called with a dispatcher (undici Agent) and redirect:"manual"
            const callOpts = mockUndiciF.mock.calls[0][1] as Record<string, unknown>;
            expect(callOpts.dispatcher).toBeDefined();
            expect(callOpts.redirect).toBe("manual");
        });
    });
});
