import { describe, expect, it } from "vitest";
import { FIA_CELL, FIA_HOME_COLUMN, FIA_TRACK, TRACK, pieceCenter } from "./board";
import { PATHS, absSquare, applyMove, applyRoll, createGame, goalOf, startSquare, targetOf, type Color } from "./engine";
import { pieceWaypoints } from "./piece-motion";
import { performAction } from "@/lib/online/match-logic";
import { chooseMove } from "./ai";

const COLORS: Color[] = [0, 1, 2, 3];
const gridCell = ([x, y]: [number, number]) => [Math.round(x / FIA_CELL), Math.round(y / FIA_CELL)];

describe("Fia geometry verified against the supplied photograph", () => {
  it("has 40 outer positions, four lane positions per color and one separate goal", () => {
    expect(PATHS.fia).toEqual({ trackLen: 40, startOffset: 0, lastTrack: 39, laneLen: 4, goal: 44 });
    expect(FIA_TRACK).toHaveLength(40);
    const cells = [...FIA_TRACK, ...COLORS.flatMap(c => FIA_HOME_COLUMN[c]), [5 * FIA_CELL, 5 * FIA_CELL] as [number, number]];
    expect(new Set(cells.map(p => String(gridCell(p)))).size).toBe(57);
    for (const c of COLORS) expect(FIA_HOME_COLUMN[c]).toHaveLength(4);
  });

  it("preserves Classic geometry", () => {
    expect(PATHS.classic).toEqual({ trackLen: 52, startOffset: 0, lastTrack: 50, laneLen: 5, goal: 56 });
    expect(TRACK).toHaveLength(52);
    for (const c of COLORS) expect(startSquare(c)).toBe(c * 13);
  });

  it("starts at the marked outer corner beside each yard", () => {
    const starts = [[0, 4], [6, 0], [10, 6], [4, 10]];
    for (const c of COLORS) {
      expect(startSquare(c, "fia")).toBe(c * 10);
      expect(gridCell(FIA_TRACK[startSquare(c, "fia")])).toEqual(starts[c]);
    }
  });

  it("has the photograph's four-position lanes without overlapping the central goal", () => {
    expect(FIA_HOME_COLUMN[0].map(gridCell)).toEqual([[1, 5], [2, 5], [3, 5], [4, 5]]);
    expect(FIA_HOME_COLUMN[1].map(gridCell)).toEqual([[5, 1], [5, 2], [5, 3], [5, 4]]);
    expect(FIA_HOME_COLUMN[2].map(gridCell)).toEqual([[9, 5], [8, 5], [7, 5], [6, 5]]);
    expect(FIA_HOME_COLUMN[3].map(gridCell)).toEqual([[5, 9], [5, 8], [5, 7], [5, 6]]);
  });

  for (const c of COLORS) {
    it(`color ${c}: full lap and lane have no duplicates, shortcuts or asymmetric steps`, () => {
      const positions = Array.from({ length: 44 }, (_, p) => pieceCenter(c, p, 0, "fia"));
      expect(new Set(positions.map(String)).size).toBe(44);
      for (let p = 0; p < 40; p++) expect(absSquare(c, p, "fia")).toBe((c * 10 + p) % 40);
      expect(absSquare(c, 40, "fia")).toBeNull();
      const firstLane = positions[40];
      expect(firstLane[0]).toBeCloseTo(FIA_HOME_COLUMN[c][0][0] + FIA_CELL / 2);
      expect(firstLane[1]).toBeCloseTo(FIA_HOME_COLUMN[c][0][1] + FIA_CELL / 2);
      for (let p = 1; p < 44; p++) {
        const [ax, ay] = positions[p - 1];
        const [bx, by] = positions[p];
        expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by))).toBeCloseTo(FIA_CELL);
      }
      for (let p = 0; p < 44; p++) {
        let [x, y] = pieceCenter(0, p, 0, "fia");
        for (let k = 0; k < c; k++) [x, y] = [15 - y, x];
        expect(positions[p][0]).toBeCloseTo(x);
        expect(positions[p][1]).toBeCloseTo(y);
      }
    });

    it(`color ${c}: local AI and authoritative online actions follow the same path from yard to goal`, () => {
      let local = createGame([
        { id: "a", name: "A", color: c, isBot: true },
        { id: "b", name: "B", color: ((c + 2) % 4) as Color, isBot: false },
      ], "fia");
      local = { ...local, pieces: [[-1, 44, 44, 44], [-1, -1, -1, -1]] };
      let online = structuredClone(local);
      for (const roll of [6, 6, 6, 6, 6, 6, 6, 6, 2]) {
        local = applyRoll(local, roll);
        online = performAction(online, "a", { kind: "roll" }, () => roll);
        expect(chooseMove(local, () => 0)).toBe(0);
        local = applyMove(local, 0);
        online = performAction(online, "a", { kind: "move", piece: 0 }, () => roll);
        expect(online).toEqual(local);
      }
      expect(local.pieces[0][0]).toBe(44);
      expect(local.winner).toBe(0);
    });

    it(`color ${c}: overshoot walks into the separate goal then back`, () => {
      expect(goalOf("fia")).toBe(44);
      expect(targetOf(41, 5, "fia")).toBe(42);
      const points = pieceWaypoints(c, 41, 42, 0, 5, "fia");
      expect(points).toEqual([41, 42, 43, 44, 43, 42].map(p => pieceCenter(c, p, 0, "fia")));
    });
  }

  it("captures on the corrected start position", () => {
    let s = createGame([{ id: "a", name: "A", color: 0, isBot: false }, { id: "b", name: "B", color: 1, isBot: false }], "fia");
    expect(absSquare(1, 30, "fia")).toBe(startSquare(0, "fia"));
    s = { ...s, pieces: [[-1, -1, -1, -1], [30, -1, -1, -1]] };
    s = applyMove(applyRoll(s, 1), 0);
    expect(s.pieces[1][0]).toBe(-1);
  });
});