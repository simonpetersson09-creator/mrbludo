import { describe, expect, it } from "vitest";
import { FIA_HOME_COLUMN, HOME_COLUMN, TRACK, pieceCenter } from "./board";
import { PATHS, absSquare, applyMove, applyRoll, createGame, goalOf, startSquare, targetOf, type Color, type GameState } from "./engine";
import { pieceWaypoints } from "./piece-motion";

const COLORS: Color[] = [0, 1, 2, 3];
const cell = (p: [number, number]) => `${p[0] - 0.5},${p[1] - 0.5}`;

describe("Fia board geometry", () => {
  it("has 52 track squares and 6 lane squares per color (76 total), classic keeps 52 + 5", () => {
    expect(PATHS.fia).toEqual({ startOffset: -1, lastTrack: 51, laneLen: 6, goal: 58 });
    expect(PATHS.classic).toEqual({ startOffset: 0, lastTrack: 50, laneLen: 5, goal: 56 });
    const all = new Set([...TRACK.map(String), ...COLORS.flatMap((c) => FIA_HOME_COLUMN[c].map(String))]);
    expect(all.size).toBe(76);
  });

  it("the new 6th lane square sits right next to the center cell", () => {
    expect(FIA_HOME_COLUMN[0][5]).toEqual([6, 7]);
    expect(FIA_HOME_COLUMN[1][5]).toEqual([7, 6]);
    expect(FIA_HOME_COLUMN[2][5]).toEqual([8, 7]);
    expect(FIA_HOME_COLUMN[3][5]).toEqual([7, 8]);
    for (const c of COLORS) expect(FIA_HOME_COLUMN[c].slice(0, 5)).toEqual(HOME_COLUMN[c]);
  });

  it("each color starts exactly one step earlier than in classic", () => {
    for (const c of COLORS) {
      expect(startSquare(c, "classic")).toBe(c * 13);
      expect(startSquare(c, "fia")).toBe((c * 13 + 51) % 52);
    }
    expect(TRACK[startSquare(0, "fia")]).toEqual([0, 6]);
    expect(TRACK[startSquare(1, "fia")]).toEqual([8, 0]);
    expect(TRACK[startSquare(2, "fia")]).toEqual([14, 8]);
    expect(TRACK[startSquare(3, "fia")]).toEqual([6, 14]);
  });

  it("every color walks a full lap, turns in from the square before its start, then 6 lane squares to goal", () => {
    for (const c of COLORS) {
      const cells: string[] = [];
      for (let p = 0; p < 58; p++) cells.push(String(pieceCenter(c, p, 0, "fia").map((v) => v - 0.5)));
      expect(new Set(cells).size).toBe(58); // no square visited twice
      // track part covers all 52 squares
      expect(new Set(cells.slice(0, 52)).size).toBe(52);
      expect(absSquare(c, 51, "fia")).toBe((startSquare(c, "fia") + 51) % 52);
      expect(absSquare(c, 52, "fia")).toBeNull();
      // each step is to an orthogonally adjacent square (no shortcuts)
      for (let p = 1; p < 58; p++) {
        const [ax, ay] = pieceCenter(c, p - 1, 0, "fia");
        const [bx, by] = pieceCenter(c, p, 0, "fia");
        // one square at a time (the track's corner turns are diagonal, as in Classic)
        expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by))).toBe(1);
      }
      expect(cells.slice(52).map((s) => s)).toEqual(FIA_HOME_COLUMN[c].map(String));
      void cell;
    }
  });

  it("symmetric: rotating color 0's path by 90° gives each other color's path", () => {
    const rot = ([x, y]: [number, number]): [number, number] => [15 - y, x];
    for (const c of COLORS) {
      for (let p = 0; p <= 58; p++) {
        let q = pieceCenter(0, p, 0, "fia");
        for (let k = 0; k < c; k++) q = rot(q);
        const r = pieceCenter(c, p, 0, "fia");
        expect(q[0]).toBeCloseTo(r[0]);
        expect(q[1]).toBeCloseTo(r[1]);
      }
    }
  });

  it("goal needs an exact 58 steps and overshoot bounces back from 58", () => {
    expect(goalOf("fia")).toBe(58);
    expect(targetOf(55, 3, "fia")).toBe(58);
    expect(targetOf(55, 5, "fia")).toBe(56);
    expect(pieceWaypoints(0, 55, 56, 0, 5, "fia").length).toBe(6);
  });

  it("every color reaches goal in a played game from the yard", () => {
    for (const c of COLORS) {
      let s: GameState = createGame([
        { id: "a", name: "A", color: c, isBot: false },
        { id: "b", name: "B", color: ((c + 2) % 4) as Color, isBot: false },
      ], "fia");
      s = { ...s, pieces: [[-1, 58, 58, 58], [58, 58, 58, -1]] };
      s = applyMove(applyRoll(s, 6), 0); // out (six keeps the turn)
      expect(s.pieces[0][0]).toBe(0);
      // walk 57 more steps with sixes (extra rolls keep the turn) and a final 3
      for (let i = 0; i < 9; i++) s = applyMove(applyRoll(s, 6), 0);
      expect(s.pieces[0][0]).toBe(54);
      s = applyMove(applyRoll(s, 4), 0);
      expect(s.winner).toBe(0);
    }
  });

  it("knocks an opponent standing on the new start square", () => {
    let s = createGame([
      { id: "a", name: "A", color: 0, isBot: false },
      { id: "b", name: "B", color: 1, isBot: false },
    ], "fia");
    // green piece standing on red's Fia start square (abs 51) = green progress 51 - 12 = 39
    expect(absSquare(1, 39, "fia")).toBe(startSquare(0, "fia"));
    s = { ...s, pieces: [[-1, -1, -1, -1], [39, -1, -1, -1]] };
    s = applyMove(applyRoll(s, 1), 0);
    expect(s.pieces[1][0]).toBe(-1);
  });
});
