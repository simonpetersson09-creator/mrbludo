import { describe, expect, it } from "vitest";
import { addOnlineResult, type Stats } from "./storage";


const base: Stats = { played: 2, wins: 1, captures: 3, piecesHome: 4, forfeits: 0, year: 2026, lifetimePlayed: 5 } as Stats;

describe("online matches count in yearly stats", () => {
  it("a won online match adds one played and one win", () => {
    const g = { phase: "finished", winner: 1, players: [{}, {}] } as never;
    const r = addOnlineResult(base, g, 1, 4);
    expect([r.played, r.wins, r.piecesHome, r.lifetimePlayed]).toEqual([3, 2, 8, 6]);
  });
  it("a lost online match adds a played match but no win", () => {
    const g = { phase: "finished", winner: 0, players: [{}, {}] } as never;
    const r = addOnlineResult(base, g, 1, 0);
    expect([r.played, r.wins]).toEqual([3, 1]);
  });
});
