import { describe, expect, it } from "vitest";
import { activePrompt, claimPrompt, releasePrompt, whenPromptFree } from "./home-prompt";
import { enqueue, parseQueue, REPORT_QUEUE_MAX, REPORT_QUEUE_MAX_AGE_MS } from "./online/report-queue";

describe("one prompt at a time", () => {
  it("the notification question waits while the rating question is open", () => {
    expect(claimPrompt("rate")).toBe(true);
    let shown = false;
    whenPromptFree("push", () => { shown = true; });
    expect(shown).toBe(false);
    releasePrompt("rate");
    expect(shown).toBe(true);
    expect(activePrompt()).toBe("push");
    expect(claimPrompt("rate")).toBe(false);
    releasePrompt("push");
    expect(activePrompt()).toBe(null);
  });
});

describe("offline report queue", () => {
  it("keeps at most 30 reports, newest last", () => {
    let q = parseQueue(null, 0);
    for (let i = 0; i < 35; i++) q = enqueue(q, { kind: "error", detail: { i }, at: i });
    expect(q).toHaveLength(REPORT_QUEUE_MAX);
    expect(q[0].detail["i"]).toBe(5);
  });
  it("drops reports older than 7 days and junk", () => {
    const now = REPORT_QUEUE_MAX_AGE_MS + 10;
    const raw = JSON.stringify([{ kind: "error", detail: {}, at: 0 }, { kind: "ad", detail: {}, at: now - 1 }, { kind: "x", detail: {}, at: now }]);
    expect(parseQueue(raw, now)).toHaveLength(1);
    expect(parseQueue("not json", now)).toEqual([]);
  });
});
