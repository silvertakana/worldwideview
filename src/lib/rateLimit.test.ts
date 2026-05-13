import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RateLimiter, getClientIp } from "./rateLimit";
import fc from "fast-check";

describe("RateLimiter", () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 });
    });

    afterEach(() => {
        limiter.destroy();
    });

    it("allows requests within the limit", () => {
        expect(limiter.check("ip-1")).toBeNull();
        expect(limiter.check("ip-1")).toBeNull();
        expect(limiter.check("ip-1")).toBeNull();
    });

    it("blocks requests exceeding the limit", () => {
        limiter.check("ip-1");
        limiter.check("ip-1");
        limiter.check("ip-1");
        const blocked = limiter.check("ip-1");
        expect(blocked).not.toBeNull();
        expect(blocked!.status).toBe(429);
    });

    it("tracks different IPs independently", () => {
        limiter.check("ip-1");
        limiter.check("ip-1");
        limiter.check("ip-1");
        // ip-1 is at the limit
        expect(limiter.check("ip-1")).not.toBeNull();
        // ip-2 should still be allowed
        expect(limiter.check("ip-2")).toBeNull();
    });

    it("includes Retry-After header on 429", async () => {
        limiter.check("ip-1");
        limiter.check("ip-1");
        limiter.check("ip-1");
        const blocked = limiter.check("ip-1");
        expect(blocked!.headers.get("Retry-After")).toBeTruthy();
    });

    it("resets after the window expires", () => {
        // Create a limiter with a very short window
        const fast = new RateLimiter({ windowMs: 50, maxRequests: 1 });
        fast.check("ip-1");
        expect(fast.check("ip-1")).not.toBeNull(); // blocked

        // Wait for window to expire
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                expect(fast.check("ip-1")).toBeNull(); // allowed again
                fast.destroy();
                resolve();
            }, 60);
        });
    });

    it("cleans up expired entries", () => {
        const localLimiter = new RateLimiter({ windowMs: 100, maxRequests: 5 });
        localLimiter.check("ip-cleanup");
        
        // Force the store resetAt to be in the past
        const entry = (localLimiter as any).store.get("ip-cleanup");
        entry.resetAt = Date.now() - 1000;
        
        (localLimiter as any).cleanup();
        
        expect((localLimiter as any).store.has("ip-cleanup")).toBe(false);
        localLimiter.destroy();
    });
});

describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for (first entry)", () => {
        const req = new Request("http://localhost", {
            headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
        });
        expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("falls back to x-real-ip", () => {
        const req = new Request("http://localhost", {
            headers: { "x-real-ip": "9.8.7.6" },
        });
        expect(getClientIp(req)).toBe("9.8.7.6");
    });

    it("returns 'unknown' when no IP headers present", () => {
        const req = new Request("http://localhost");
        expect(getClientIp(req)).toBe("unknown");
    });

    it("property test: x-forwarded-for always returns the first IP in a list", () => {
        fc.assert(
            fc.property(
                fc.array(fc.ipV4(), { minLength: 1, maxLength: 10 }),
                (ips) => {
                    const headerValue = ips.join(", ");
                    const req = new Request("http://localhost", {
                        headers: { "x-forwarded-for": headerValue },
                    });
                    expect(getClientIp(req)).toBe(ips[0]);
                }
            )
        );
    });

    it("property test: x-real-ip is used when x-forwarded-for is absent", () => {
        fc.assert(
            fc.property(
                fc.ipV4(),
                (ip) => {
                    const req = new Request("http://localhost", {
                        headers: { "x-real-ip": ip },
                    });
                    expect(getClientIp(req)).toBe(ip);
                }
            )
        );
    });
});
