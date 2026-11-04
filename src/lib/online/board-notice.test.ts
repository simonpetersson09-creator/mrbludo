import { describe, expect, it } from "vitest";
import { passedBy } from "./board-notice";

const names = { a: "Anna", b: "Bo", me: "Jag", c: "Cia" };
describe("passed on Månadens flitigaste", () => {
  it("names the player who moved above me", () => {
    expect(passedBy({ month: "2026-11", ids: ["a", "me", "b"] }, { month: "2026-11", ids: ["a", "b", "me"] }, "me", names)).toBe("Bo");
  });
  it("names who pushed me off the top 10", () => {
    expect(passedBy({ month: "2026-11", ids: ["a", "me"] }, { month: "2026-11", ids: ["a", "c"] }, "me", names)).toBe("Cia");
  });
  it("is silent when I keep or improve my place", () => {
    expect(passedBy({ month: "2026-11", ids: ["a", "me"] }, { month: "2026-11", ids: ["me", "a"] }, "me", names)).toBeNull();
  });
  it("is silent in a new month or when I was not listed", () => {
    expect(passedBy({ month: "2026-10", ids: ["me", "a"] }, { month: "2026-11", ids: ["a", "me"] }, "me", names)).toBeNull();
    expect(passedBy({ month: "2026-11", ids: ["a"] }, { month: "2026-11", ids: ["a", "b"] }, "me", names)).toBeNull();
  });
});
