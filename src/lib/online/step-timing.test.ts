import { describe, expect, it, vi } from "vitest";
import { withStepTiming, type StepReport } from "./step-timing";

describe("step timing", () => {
  it("records exact slow steps without response data", async () => {
    const clock = vi.spyOn(performance, "now");
    let now = 0; clock.mockImplementation(() => now);
    const reports: StepReport[] = [];
    try {
      const result = await withStepTiming("getMe", async (step) => {
        await step("profile", async () => { now += 1200; return { data: "private profile" }; });
        return 42;
      }, async (r) => { reports.push(r); });
      expect(result).toBe(42);
      expect(reports).toEqual([{ op: "getMe", ms: 1200, ok: true, steps: [{ step: "profile", ms: 1200, calls: 1, failed: 0 }] }]);
    } finally { clock.mockRestore(); }
  });
  it("records returned database errors but never their contents", async () => {
    const sink = vi.fn();
    await withStepTiming("listFriends", (step) => step("friends", async () => ({ error: { message: "secret" } })), sink);
    expect(sink.mock.calls[0]?.[0].steps[0]).toMatchObject({ step: "friends", failed: 1 });
    expect(JSON.stringify(sink.mock.calls)).not.toContain("secret");
  });
  it("preserves thrown errors when logging also fails", async () => {
    const error = new Error("original");
    await expect(withStepTiming("quickMatch", (step) => step("search", async () => { throw error; }), async () => { throw new Error("log unavailable"); })).rejects.toBe(error);
  });
  it("does not write fast successful calls", async () => {
    const sink = vi.fn();
    await withStepTiming("getMe", (step) => step("stats", async () => ({ error: null })), sink);
    expect(sink).not.toHaveBeenCalled();
  });
});