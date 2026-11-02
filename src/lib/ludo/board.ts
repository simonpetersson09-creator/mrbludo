import { GOAL, LAST_TRACK, YARD, type Color } from "./engine";

/** 15x15 grid coordinates [col,row]. Track index 0 = red start square. */
export const TRACK: [number, number][] = (() => {
  const t: [number, number][] = [];
  for (let c = 1; c <= 5; c++) t.push([c, 6]);
  for (let r = 5; r >= 0; r--) t.push([6, r]);
  t.push([7, 0]);
  for (let r = 0; r <= 5; r++) t.push([8, r]);
  for (let c = 9; c <= 14; c++) t.push([c, 6]);
  t.push([14, 7]);
  for (let c = 14; c >= 9; c--) t.push([c, 8]);
  for (let r = 9; r <= 14; r++) t.push([8, r]);
  t.push([7, 14]);
  for (let r = 14; r >= 9; r--) t.push([6, r]);
  for (let c = 5; c >= 0; c--) t.push([c, 8]);
  t.push([0, 7]);
  t.push([0, 6]);
  // The list above starts at (1,6) and wraps through (0,6): 52 squares.
  return t;
})();

export const HOME_COLUMN: Record<Color, [number, number][]> = {
  0: [1, 2, 3, 4, 5].map((c) => [c, 7] as [number, number]),
  1: [1, 2, 3, 4, 5].map((r) => [7, r] as [number, number]),
  2: [13, 12, 11, 10, 9].map((c) => [c, 7] as [number, number]),
  3: [13, 12, 11, 10, 9].map((r) => [7, r] as [number, number]),
};

/** Yard origin (top-left of the 6x6 yard). */
export const YARD_ORIGIN: Record<Color, [number, number]> = { 0: [0, 0], 1: [9, 0], 2: [9, 9], 3: [0, 9] };

export function yardSpot(color: Color, piece: number): [number, number] {
  const [x, y] = YARD_ORIGIN[color];
  const offs: [number, number][] = [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]];
  return [x + offs[piece][0] + 0.5, y + offs[piece][1] + 0.5];
}

const GOAL_SPOT: Record<Color, [number, number]> = { 0: [6.85, 7.5], 1: [7.5, 6.85], 2: [8.15, 7.5], 3: [7.5, 8.15] };

/** Center of the cell a piece occupies (grid units). */
export function pieceCenter(color: Color, progress: number, piece: number): [number, number] {
  if (progress === YARD) return yardSpot(color, piece);
  if (progress === GOAL) return GOAL_SPOT[color];
  if (progress <= LAST_TRACK) {
    const [c, r] = TRACK[(color * 13 + progress) % 52];
    return [c + 0.5, r + 0.5];
  }
  const [c, r] = HOME_COLUMN[color][progress - LAST_TRACK - 1];
  return [c + 0.5, r + 0.5];
}
