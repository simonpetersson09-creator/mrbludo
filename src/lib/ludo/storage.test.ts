import { describe, expect, it } from "vitest";
import { completedPlayed } from "./storage";

describe("played counts completed matches only", () => {
  it("excludes given-up matches", () => {
    expect(completedPlayed({ played: 10, forfeits: 3 })).toBe(7);
  });
  it("never goes below zero", () => {
    expect(completedPlayed({ played: 1, forfeits: 2 })).toBe(0);
  });
});
