import { describe, expect, it } from "vitest";
import { combineHomeStats } from "./home-stats";

const local = { played: 5, wins: 2, captures: 7, piecesHome: 0, forfeits: 1 };

describe("home stats", () => {
  it("does not count forfeited local matches as played", () => {
    expect(combineHomeStats(local, null).played).toBe(4);
  });
  it("adds verified online numbers", () => {
    const s = combineHomeStats(local, { played: 3, wins: 1, captures: 4, country: "SE", worldRank: 9, countryRank: 2 });
    expect([s.played, s.wins, s.captures, s.worldRank, s.countryRank]).toEqual([7, 3, 11, 9, 2]);
  });
  it("shows no placement without server data", () => {
    const s = combineHomeStats(local, null);
    expect([s.worldRank, s.countryRank]).toEqual([null, null]);
  });
});
