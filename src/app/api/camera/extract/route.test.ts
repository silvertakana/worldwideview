import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/ba-session", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("@/lib/security/ssrf", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/security/ssrf")>();
    return { ...original, safeFetch: vi.fn() };
});

import { getServerSession } from "@/lib/ba-session";
import { safeFetch } from "@/lib/security/ssrf";

/** Minimal fake Response: jsdom cannot read Response bodies, so the route's
 *  `.text()` calls need a small object that resolves directly. */
function htmlResponse(body: string): Response {
    return { text: () => Promise.resolve(body) } as unknown as Response;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function mockGetRequest(urlParam?: string): NextRequest {
    const url = new URL("http://localhost/api/camera/extract");
    if (urlParam !== undefined) url.searchParams.set("url", urlParam);
    return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as never);
});

describe("GET /api/camera/extract", () => {
    it("returns 401 when unauthenticated", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null as never);
        const res = await GET(mockGetRequest("https://balticlivecam.com/camera/1"));
        expect(res.status).toBe(401);
        expect(safeFetch).not.toHaveBeenCalled();
    });

    it("returns 400 when url is missing", async () => {
        const res = await GET(mockGetRequest());
        expect(res.status).toBe(400);
        expect(safeFetch).not.toHaveBeenCalled();
    });

    it("rejects a host that merely contains the allowed string in its path", async () => {
        const res = await GET(mockGetRequest("https://evil.com/balticlivecam.com/cam"));
        expect(res.status).toBe(400);
        expect(safeFetch).not.toHaveBeenCalled();
    });

    it("rejects a lookalike host with the allowed string as a prefix", async () => {
        const res = await GET(mockGetRequest("https://balticlivecam.com.evil.com/cam"));
        expect(res.status).toBe(400);
        expect(safeFetch).not.toHaveBeenCalled();
    });

    it("rejects non-web protocols even with a matching hostname", async () => {
        const res = await GET(mockGetRequest("ftp://balticlivecam.com/cam"));
        expect(res.status).toBe(400);
        expect(safeFetch).not.toHaveBeenCalled();
    });

    it("allows a real balticlivecam URL and strips userinfo before fetching", async () => {
        vi.mocked(safeFetch).mockResolvedValueOnce(
            htmlResponse("<html>var id: 123;</html>"),
        );
        vi.mocked(safeFetch).mockResolvedValueOnce(
            htmlResponse("<html>var src: 'https://balticlivecam.com/live/cam.m3u8?token=abc';</html>"),
        );

        const res = await GET(mockGetRequest("https://user:pass@balticlivecam.com/camera/1"));
        expect(res.status).toBe(200);

        // The URL actually fetched must never contain the userinfo credentials.
        const firstCallUrl = vi.mocked(safeFetch).mock.calls[0][0];
        expect(firstCallUrl).not.toContain("user:pass");
        expect(firstCallUrl.startsWith("https://balticlivecam.com/")).toBe(true);

        const body = await res.json();
        expect(body.streamUrl).toBe("https://balticlivecam.com/live/cam.m3u8?token=abc");
    });

    it("rejects an extracted m3u8 whose host is not balticlivecam", async () => {
        vi.mocked(safeFetch).mockResolvedValueOnce(
            htmlResponse("<html>var id: 123;</html>"),
        );
        vi.mocked(safeFetch).mockResolvedValueOnce(
            htmlResponse("<html>var src: 'https://evil.com/live/cam.m3u8?token=abc';</html>"),
        );

        const res = await GET(mockGetRequest("https://balticlivecam.com/camera/1"));
        expect(res.status).toBe(400);
    });
});
