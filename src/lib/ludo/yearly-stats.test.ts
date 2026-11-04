import { describe, it, expect } from "vitest";
import { statsForYear } from "./storage";
describe("yearly statistics", () => {
  it("keeps this year's numbers", () => {
    expect(statsForYear({ played: 5, wins: 2, year: 2026 }, 2026).played).toBe(5);
  });
  it("starts at zero when a new year begins", () => {
    const s = statsForYear({ played: 5, wins: 2, captures: 9, year: 2026, lifetimePlayed: 7 }, 2027);
    expect([s.played, s.wins, s.captures, s.year, s.lifetimePlayed]).toEqual([0, 0, 0, 2027, 7]);
  });
  it("saves from before the year existed count as this year", () => {
    const s = statsForYear({ played: 4 }, 2026);
    expect([s.played, s.year, s.lifetimePlayed]).toEqual([4, 2026, 4]);
  });
});
