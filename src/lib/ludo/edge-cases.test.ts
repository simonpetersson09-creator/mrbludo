import { describe, expect, it } from "vitest";
import { YARD, absSquare, applyRoll, createGame, forfeit, legalMoves, rankPlayers, type Color, type GameState, type Variant } from "./engine";
import { chooseBotAction } from "./ai";
import { performAction, statDeltas } from "@/lib/online/match-logic";

const game = (variant: Variant, colors: Color[]): GameState =>
  createGame(colors.map((color, i) => ({ id: `p${i}`, name: `P${i}`, color, isBot: false })), variant);

describe("Fia bot: one out + six steps", () => {
  it("walks one piece out when that knocks an opponent on its sixth square", () => {
    let s = game("fia", [0, 2]);
    const target = absSquare(0, 5, "fia");
    let victim = -1;
    for (let p = 0; p < 40 && victim < 0; p++) if (absSquare(2, p, "fia") === target) victim = p;
    s = { ...s, pieces: [[YARD, YARD, YARD, YARD], [victim, YARD, YARD, YARD]] };
    const a = chooseBotAction(applyRoll(s, 6), () => 0);
    expect(a.walkOut).toBe(true);
  });
  it("keeps the double exit when nobody can be knocked", () => {
    const a = chooseBotAction(applyRoll(game("fia", [0, 2]), 6), () => 0);
    expect(a.walkOut).toBe(false);
  });
});

describe("edge cases", () => {
  it("a six with no legal move passes no move but keeps the turn rules intact", () => {
    // Classic: all pieces home already except none movable — every piece in goal-1 cannot move 6.
    const s = { ...game("classic", [0, 2]), pieces: [[55, 55, 55, 55], [YARD, YARD, YARD, YARD]] };
    expect(legalMoves(applyRoll(s, 6))).toEqual([]);
  });

  it("in a 4-player game one forfeit continues the match for the other three", () => {
    const s = forfeit(game("classic", [0, 1, 2, 3]), 1);
    expect(s.phase).not.toBe("finished");
    expect(s.players[1].forfeited).toBe(true);
  });

  it("three forfeits in a 4-player game end the match with the last player as winner", () => {
    let s = game("classic", [0, 1, 2, 3]);
    for (const p of [0, 1, 3]) s = forfeit(s, p);
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(2);
    expect(s.ranking?.[0]).toBe(2);
  });

  it("forfeiting twice counts only once", () => {
    const s = game("classic", [0, 1, 2]);
    const once = performAction(s, "p1", { kind: "forfeit" }, () => 1);
    let twice = once;
    try { twice = performAction(once, "p1", { kind: "forfeit" }, () => 1); } catch { /* rejected is fine */ }
    expect(twice.players.filter((p) => p.forfeited)).toHaveLength(1);
    expect(Object.values(statDeltas(once, twice)).every((d) => d.forfeits === 0)).toBe(true);
  });

  it("ties in pieces home are broken by progress, then by seat", () => {
    const s = { ...game("classic", [0, 1, 2]), pieces: [[10, YARD, YARD, YARD], [20, YARD, YARD, YARD], [20, YARD, YARD, YARD]] };
    expect(rankPlayers(s)).toEqual([1, 2, 0]);
  });

  it("a finished match gives each human exactly one played game", () => {
    let s = game("classic", [0, 1]);
    const prev = s;
    s = forfeit(s, 1);
    const d = statDeltas(prev, s);
    expect(d['p0']?.played).toBe(1);
    expect(d['p0']?.wins).toBe(1);
    expect(d['p1']?.forfeits).toBe(1);
    expect(statDeltas(s, s)).toEqual({});
  });
});
