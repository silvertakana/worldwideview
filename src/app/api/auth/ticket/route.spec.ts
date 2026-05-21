import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getTicket } from "@/lib/auth/ticketClient";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/ticketClient", () => ({ getTicket: vi.fn() }));
vi.mock("@/core/edition", () => ({ isAuthEnabled: true }));

describe("GET /api/auth/ticket", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when no session exists", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(auth).mockResolvedValue(null as any);
        const req = new NextRequest("http://localhost/api/auth/ticket?pluginId=aviation");
        const res = await GET(req);
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when pluginId query param is missing", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as any);
        const req = new NextRequest("http://localhost/api/auth/ticket");
        const res = await GET(req);
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Missing pluginId" });
    });

    it("returns 500 when getTicket throws", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as any);
        vi.mocked(getTicket).mockRejectedValue(new Error("Marketplace unreachable"));
        const req = new NextRequest("http://localhost/api/auth/ticket?pluginId=aviation");
        const res = await GET(req);
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "Failed to obtain plugin ticket" });
    });

    it("returns 200 with token on success", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(getTicket).mockResolvedValue("plugin-ticket-abc" as any);
        const req = new NextRequest("http://localhost/api/auth/ticket?pluginId=aviation");
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ token: "plugin-ticket-abc" });
    });
});
