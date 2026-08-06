import { describe, it, expect } from "vitest";
import { hasMinimumPlan } from "./planGating";

describe("hasMinimumPlan", () => {
  it("free meets free minimum", () => {
    expect(hasMinimumPlan("free", "free")).toBe(true);
  });

  it("free does not meet pro minimum", () => {
    expect(hasMinimumPlan("free", "pro")).toBe(false);
  });

  it("free does not meet enterprise minimum", () => {
    expect(hasMinimumPlan("free", "enterprise")).toBe(false);
  });

  it("pro meets free minimum", () => {
    expect(hasMinimumPlan("pro", "free")).toBe(true);
  });

  it("pro meets pro minimum", () => {
    expect(hasMinimumPlan("pro", "pro")).toBe(true);
  });

  it("pro does not meet enterprise minimum", () => {
    expect(hasMinimumPlan("pro", "enterprise")).toBe(false);
  });

  it("team meets free and pro minimums", () => {
    expect(hasMinimumPlan("team", "free")).toBe(true);
    expect(hasMinimumPlan("team", "pro")).toBe(true);
  });

  it("team does not meet enterprise minimum", () => {
    expect(hasMinimumPlan("team", "enterprise")).toBe(false);
  });

  it("team is above pro in hierarchy", () => {
    expect(hasMinimumPlan("team", "team")).toBe(true);
    expect(hasMinimumPlan("pro", "team")).toBe(false);
  });

  it("enterprise meets all minimums", () => {
    expect(hasMinimumPlan("enterprise", "free")).toBe(true);
    expect(hasMinimumPlan("enterprise", "pro")).toBe(true);
    expect(hasMinimumPlan("enterprise", "enterprise")).toBe(true);
  });

  it("handles unknown plan as rank 0", () => {
    expect(hasMinimumPlan("unknown", "free")).toBe(true);
    expect(hasMinimumPlan("free", "unknown")).toBe(true);
  });
});
