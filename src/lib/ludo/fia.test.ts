import { describe, expect, it } from "vitest";
import { GOAL, YARD, absSquare, goalOf, startSquare, applyMove, applyRoll, canWalkOut, createGame, legalMoves, targetOf, type Color, type GameState, type Variant } from "./engine";
import { chooseMove } from "./ai";
import { pieceWaypoints } from "./piece-motion";
import { performAction, startState } from "@/lib/online/match-logic";
import { createMatchInput, quickMatchInput } from "@/lib/online/online-inputs";

const game = (variant: Variant, colors: Color[] = [0, 2]): GameState =>
  createGame(colors.map((color, i) => ({ id: `p${i}`, name: `P${i}`, color, isBot: false })), variant);
const withPieces = (s: GameState, pieces: number[][]): GameState => ({ ...s, pieces });

const F = goalOf("fia");

describe("Svenska Fia med knuff", () => {
  it("Classic stays the default and leaves only on a 6", () => {
    const s = createGame([{ id: "a", name: "A", color: 0, isBot: false }, { id: "b", name: "B", color: 2, isBot: false }]);
    expect(s.variant).toBeUndefined();
    expect(legalMoves(applyRoll(s, 1))).toEqual([]);
  });

  it("a 1 brings one piece out onto the start square", () => {
    const s = applyMove(applyRoll(game("fia"), 1), 0);
    expect(s.pieces[0]).toEqual([0, YARD, YARD, YARD]);
    expect(s.current).toBe(1); // a 1 gives no extra roll
  });

  it("a 6 out of the yard brings two pieces when two or more are home", () => {
    const s = applyMove(applyRoll(game("fia"), 6), 2);
    expect(s.pieces[0].filter((p) => p === 0)).toHaveLength(2);
    expect(s.pieces[0][2]).toBe(0);
    expect(s.lastEvent).toMatchObject({ kind: "moved", alsoOut: 0 });
    expect(s.current).toBe(0); // 6 = extra roll
  });

  it("a 6 can instead bring one piece out alone and walk it six steps", () => {
    let s = applyRoll(game("fia"), 6);
    expect(canWalkOut(s, 1)).toBe(true);
    s = applyMove(s, 1, true);
    expect(s.pieces[0]).toEqual([YARD, 6, YARD, YARD]);
    expect(s.lastEvent).not.toHaveProperty("alsoOut");
    expect(s.current).toBe(0);
  });

  it("walking out alone is not allowed in Classic, on other rolls, or past an own piece", () => {
    expect(canWalkOut(applyRoll(game("classic"), 6), 0)).toBe(false);
    expect(canWalkOut(applyRoll(game("fia"), 1), 0)).toBe(false);
    const s = applyRoll(withPieces(game("fia"), [[4, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]), 6);
    expect(canWalkOut(s, 1)).toBe(false);
    expect(() => applyMove(s, 1, true)).toThrow();
    expect(() => performAction(s, "p0", { kind: "move", piece: 1, walkOut: true }, () => 1)).toThrow();
  });

  it("a 6 can instead move a piece on the board six steps", () => {
    let s = withPieces(game("fia"), [[10, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    s = applyRoll(s, 6);
    expect(legalMoves(s)).toEqual([0, 1, 2, 3]);
    s = applyMove(s, 0);
    expect(s.pieces[0]).toEqual([16, YARD, YARD, YARD]);
  });

  it("with only one piece home a 6 brings just that piece out", () => {
    const s = applyMove(applyRoll(withPieces(game("fia"), [[20, 30, 40, YARD], [YARD, YARD, YARD, YARD]]), 6), 3);
    expect(s.pieces[0]).toEqual([20, 30, 40, 0]);
  });

  it("putting out on a 6 may share the start square with an own piece; a 1 may not", () => {
    const base = withPieces(game("fia"), [[0, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    expect(legalMoves(applyRoll(base, 1))).toEqual([0]);
    const six = applyMove(applyRoll(base, 6), 1);
    expect(six.pieces[0]).toEqual([0, 0, 0, YARD]);
  });

  it("all four own pieces may stand together on the start square (agreed rule)", () => {
    const base = withPieces(game("fia"), [[0, 0, YARD, YARD], [YARD, YARD, YARD, YARD]]);
    const six = applyMove(applyRoll(base, 6), 2);
    expect(six.pieces[0]).toEqual([0, 0, 0, 0]);
    const lastOne = applyMove(applyRoll(withPieces(game("fia"), [[0, 0, 0, YARD], [YARD, YARD, YARD, YARD]]), 6), 3);
    expect(lastOne.pieces[0]).toEqual([0, 0, 0, 0]);
  });

  it("has no three-sixes limit", () => {
    let s = withPieces(game("fia"), [[10, F, F, F], [YARD, YARD, YARD, YARD]]);
    for (let i = 0; i < 4; i++) s = applyMove(applyRoll(s, 6), 0);
    expect(s.current).toBe(0);
    expect(s.pieces[0][0]).toBe(34);
    let c = withPieces(game("classic"), [[10, GOAL, GOAL, GOAL], [YARD, YARD, YARD, YARD]]);
    for (let i = 0; i < 2; i++) c = applyMove(applyRoll(c, 6), 0);
    c = applyRoll(c, 6);
    expect(c.current).toBe(1);
  });

  it("knocks opponents on start squares too (no safe squares), Classic keeps them safe", () => {
    // Blue (3) stands on red's start square (abs 0 = blue progress 13).
    for (const [variant, knocked] of [["fia", true], ["classic", false]] as const) {
      const progress = variant === "fia" ? 10 : 13;
      let s = withPieces(game(variant, [0, 3]), [[YARD, YARD, YARD, YARD], [progress, YARD, YARD, YARD]]);
      expect(absSquare(3, progress, variant)).toBe(startSquare(0, variant));
      s = applyMove(applyRoll(s, 6), 0);
      expect(s.pieces[1][0] === YARD).toBe(knocked);
    }
  });

  it("knocks only by landing, never by passing", () => {
    let s = withPieces(game("fia", [0, 3]), [[0, F, F, F], [11, YARD, YARD, YARD]]); // blue 11 = abs 1, passed by red 0→5
    s = applyMove(applyRoll(s, 5), 0);
    expect(s.pieces[1][0]).toBe(11);
  });

  it("own pieces can't be passed or shared", () => {
    const s = applyRoll(withPieces(game("fia"), [[10, 13, F, F], [YARD, YARD, YARD, YARD]]), 4);
    expect(legalMoves(s)).toEqual([1]); // 10+4 passes 13
    const land = applyRoll(withPieces(game("fia"), [[10, 13, F, F], [YARD, YARD, YARD, YARD]]), 3);
    expect(legalMoves(land)).toEqual([1]); // 10+3 lands on 13
    const classic = applyRoll(withPieces(game("classic"), [[10, 13, GOAL, GOAL], [YARD, YARD, YARD, YARD]]), 4);
    expect(legalMoves(classic)).toEqual([0, 1]);
  });

  it("overshooting the goal bounces back the extra steps", () => {
    expect(targetOf(F - 3, 5, "fia")).toBe(F - 2);
    expect(targetOf(53, 5, "classic")).toBeNull();
    const s = applyMove(applyRoll(withPieces(game("fia"), [[F - 3, F, F, F], [YARD, YARD, YARD, YARD]]), 5), 0);
    expect(s.pieces[0][0]).toBe(F - 2);
    expect(pieceWaypoints(0, F - 3, F - 2, 0, 5, "fia")).toHaveLength(6);
  });

  it("a bounce may not pass or land on an own piece", () => {
    const s = applyRoll(withPieces(game("fia"), [[F - 2, F - 4, F, F], [YARD, YARD, YARD, YARD]]), 6);
    // 56 → 57,58,57,56,55,54 lands on own piece at 54
    expect(legalMoves(s)).not.toContain(0);
    const pass = applyRoll(withPieces(game("fia"), [[F - 1, F - 2, F, F], [YARD, YARD, YARD, YARD]]), 4);
    // 57 → 58,57,56,55 passes own piece at 56
    expect(legalMoves(pass)).not.toContain(0);
  });

  for (const c of [0, 1, 2, 3] as Color[]) {
    it(`color ${c} goes from yard to goal under Fia rules`, () => {
      let s = game("fia", [c, ((c + 2) % 4) as Color]);
      s = applyMove(applyRoll(s, 1), 0);
      expect(absSquare(c, s.pieces[0][0], "fia")).toBe(startSquare(c, "fia"));
      s = applyRoll(s, 2); // opponent can't leave on a 2
      while (s.pieces[0][0] !== F) {
        s = applyMove(applyRoll(s, Math.min(5, F - s.pieces[0][0])), 0);
        if (s.phase !== "finished") s = applyRoll(s, 2);
      }
      expect(s.pieces[0][0]).toBe(F);
    });
  }

  it("the computer only picks legal Fia moves", () => {
    let rng = 7;
    const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
    let s = game("fia", [0, 1, 2, 3]);
    for (let step = 0; step < 4000 && s.phase !== "finished"; step++) {
      if (s.phase === "roll") s = applyRoll(s, Math.floor(rand() * 6) + 1);
      else {
        const m = chooseMove(s, rand);
        expect(legalMoves(s)).toContain(m);
        s = applyMove(s, m);
      }
      // Fia: own pieces never share a square except stacked on the start square.
      s.pieces.forEach((own) => {
        const spots = own.filter((p) => p > 0 && p !== F);
        expect(new Set(spots).size).toBe(spots.length);
      });
    }
    expect(s.phase).toBe("finished");
  });

  it("online matches start with the chosen variant and the server applies its rules", () => {
    const seats = [{ user_id: "u1", seat: 0, display_name: "A" }, { user_id: "u2", seat: 1, display_name: "B" }];
    const fia = startState(seats, 2, "fia");
    expect(fia.variant).toBe("fia");
    expect(startState(seats, 2).variant).toBeUndefined();
    const rolled = performAction(fia, "u1", { kind: "roll" }, () => 1);
    expect(legalMoves(rolled)).toEqual([0, 1, 2, 3]);
    const classic = performAction(startState(seats, 2), "u1", { kind: "roll" }, () => 1);
    expect(classic.current).toBe(1);
  });

  it("server inputs default to Classic and reject unknown variants", () => {
    expect(quickMatchInput({ maxPlayers: 2 }).variant).toBe("classic");
    expect(quickMatchInput({ maxPlayers: 2, variant: "fia" }).variant).toBe("fia");
    expect(createMatchInput({ isPrivate: true, maxPlayers: 2, variant: "x" as never }).variant).toBe("classic");
  });
});
