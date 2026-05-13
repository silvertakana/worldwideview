import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "./analytics";

describe("analytics", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { umami: { track: vi.fn() } });
  });

  it("should call window.umami.track if available", () => {
    trackEvent("test-event", { key: "val" });
    expect(window.umami!.track).toHaveBeenCalledWith("test-event", { key: "val" });
  });

  it("should not throw if umami is missing", () => {
    vi.stubGlobal("window", {});
    expect(() => trackEvent("test")).not.toThrow();
  });

  it("should not throw if track fails", () => {
    vi.stubGlobal("window", {
      umami: {
        track: () => { throw new Error("Blocked"); }
      }
    });
    expect(() => trackEvent("test")).not.toThrow();
  });
});
