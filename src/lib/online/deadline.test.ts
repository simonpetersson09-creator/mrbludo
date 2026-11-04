import { describe, it, expect } from "vitest";
import { withDeadline, sendOnce, isRetryable } from "./deadline";

describe("online deadlines", () => {
  it("gives up after the deadline", async () => {
    await expect(withDeadline(new Promise(() => {}), 20)).rejects.toThrow("err:timeout");
  });
  it("retries once after a lost answer", async () => {
    let n = 0;
    const r = await sendOnce(async () => { n++; if (n === 1) throw new Error("Failed to fetch"); return "ok"; }, 50);
    expect([r, n]).toEqual(["ok", 2]);
  });
  it("never retries a server refusal", async () => {
    let n = 0;
    await expect(sendOnce(async () => { n++; throw new Error("err:not_your_turn"); }, 50)).rejects.toThrow("err:not_your_turn");
    expect(n).toBe(1);
  });
  it("a retry refused as conflict means the first try landed", async () => {
    let n = 0;
    const r = await sendOnce(async () => { n++; throw new Error(n === 1 ? "err:timeout" : "err:conflict"); }, 50);
    expect([r, n]).toEqual([null, 2]);
  });
  it("classifies errors", () => {
    expect(isRetryable(new Error("err:timeout"))).toBe(true);
    expect(isRetryable(new Error("err:illegal"))).toBe(false);
  });
});
