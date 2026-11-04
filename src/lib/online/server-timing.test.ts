import { describe, expect, it } from "vitest";
import { healthAlerts, isRealFailure, shouldRecord } from "./server-timing";

const at = (min: number) => new Date(Date.UTC(2026, 10, 4, 12, 0) + min * 60_000).toISOString();

describe("server timing", () => {
  it("stores only calls of 1 second or more, or failures", () => {
    expect(shouldRecord(999, true)).toBe(false);
    expect(shouldRecord(1000, true)).toBe(true);
    expect(shouldRecord(10, false)).toBe(true);
  });
  it("game refusals are not failures", () => {
    expect(isRealFailure(new Error("err:rate_limited"))).toBe(false);
    expect(isRealFailure(new Error("fetch failed"))).toBe(true);
  });
  it("alerts on 3 slow calls within 5 minutes", () => {
    const ev = [0, 1, 2].map((m) => ({ at: at(m), op: "act", ms: 1500, ok: true }));
    expect(healthAlerts(ev)).toHaveLength(1);
    expect(healthAlerts(ev.slice(0, 2))).toHaveLength(0);
  });
  it("alerts on 2 failures but not when spread over more than 5 minutes", () => {
    expect(healthAlerts([{ at: at(0), op: "a", ms: 5, ok: false }, { at: at(4), op: "a", ms: 5, ok: false }])).toHaveLength(1);
    expect(healthAlerts([{ at: at(0), op: "a", ms: 5, ok: false }, { at: at(6), op: "a", ms: 5, ok: false }])).toHaveLength(0);
  });
  it("raises at most one alert per 5 minutes", () => {
    const ev = [0, 1, 2, 3].map((m) => ({ at: at(m), op: "a", ms: 5, ok: false }));
    expect(healthAlerts(ev)).toHaveLength(1);
  });
});
