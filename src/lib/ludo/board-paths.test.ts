import { describe, expect, it } from "vitest";
import { GOAL, LAST_TRACK, YARD, absSquare, applyMove, applyRoll, createGame, type Color, type GameState } from "./engine";
import { HOME_COLUMN, TRACK, pieceCenter } from "./board";

const COLORS: Color[] = [0, 1, 2, 3];
const key = ([c, r]: [number, number]) => `${c},${r}`;
// Neighbouring squares; the four inner corners of the cross are crossed diagonally, as on a classic board.
const adjacent = (a: [number, number], b: [number, number]) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;
// Rotate a grid cell 90° clockwise around the board center.
const rot = ([c, r]: [number, number]): [number, number] => [14 - r, c];

describe("board geometry", () => {
  it("outer track has 52 unique squares that form one closed loop", () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map(key)).size).toBe(52);
    TRACK.forEach((sq, i) => expect(adjacent(sq, TRACK[(i + 1) % 52])).toBe(true));
  });

  it("start squares are track 0, 13, 26, 39 and every color gets the same layout rotated 90°", () => {
    expect(TRACK[0]).toEqual([1, 6]);
    expect(TRACK[13]).toEqual([8, 1]);
    expect(TRACK[26]).toEqual([13, 8]);
    expect(TRACK[39]).toEqual([6, 13]);
    for (const c of [0, 1, 2] as Color[]) {
      expect(rot(TRACK[c * 13])).toEqual(TRACK[(c + 1) * 13]);
      HOME_COLUMN[c].forEach((sq, i) => expect(rot(sq)).toEqual(HOME_COLUMN[(c + 1) as Color][i]));
    }
  });

  it("every color has exactly five home-column squares off the outer track", () => {
    const track = new Set(TRACK.map(key));
    for (const c of COLORS) {
      expect(HOME_COLUMN[c]).toHaveLength(5);
      HOME_COLUMN[c].forEach((sq) => expect(track.has(key(sq))).toBe(false));
    }
  });
});

describe("each color's full path", () => {
  for (const c of COLORS) {
    it(`color ${c} walks 51 track squares clockwise, then its own 5 lane squares, then goal`, () => {
      const cells: [number, number][] = [];
      for (let p = 0; p <= GOAL - 1; p++) {
        const [x, y] = pieceCenter(c, p, 0);
        cells.push([x - 0.5, y - 0.5]);
      }
      // Track part: starts at own start square and covers 51 distinct squares in track order.
      for (let p = 0; p <= LAST_TRACK; p++) expect(absSquare(c, p)).toBe((c * 13 + p) % 52);
      expect(cells[0]).toEqual(TRACK[c * 13]);
      // The square right before its own start is never visited: it enters the lane instead.
      expect(cells.slice(0, LAST_TRACK + 1).map(key)).not.toContain(key(TRACK[(c * 13 + 51) % 52]));
      // Lane part: exactly its own home column, in order.
      expect(cells.slice(LAST_TRACK + 1)).toEqual(HOME_COLUMN[c]);
      // Every step is to a neighbouring square.
      for (let i = 0; i + 1 < cells.length; i++) expect(adjacent(cells[i], cells[i + 1])).toBe(true);
    });
  }
});

describe("from yard to goal", () => {
  for (const c of COLORS) {
    it(`color ${c} leaves only on a 6, walks the whole board and finishes exactly on goal`, () => {
      let s: GameState = createGame([
        { id: "a", name: "A", color: c, isBot: false },
        { id: "b", name: "B", color: ((c + 2) % 4) as Color, isBot: false },
      ]);
      s = applyRoll(s, 5); // a 5 cannot leave the yard
      expect(s.current).toBe(1);
      s = applyRoll(s, 3); // opponent stays home
      s = applyMove(applyRoll(s, 6), 0);
      expect(s.pieces[0][0]).toBe(0);
      expect(s.current).toBe(0); // the 6 gives an extra roll
      while (s.pieces[0][0] !== GOAL) {
        const left = GOAL - s.pieces[0][0];
        const roll = Math.min(5, left);
        expect(s.current).toBe(0);
        s = applyMove(applyRoll(s, roll), 0);
        if (s.phase === "finished") break;
        s = applyRoll(s, 3);
      }
      expect(s.pieces[0][0]).toBe(GOAL);
    });
  }
});
