import { PATHS, YARD, startSquare, type Color, type Variant } from "./engine";

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

/** Photo-confirmed 11x11 Fia grid, fitted into the existing 15-unit canvas. */
export const FIA_CELL = 15 / 11;
export const FIA_TRACK: [number, number][] = (() => {
  const t: [number, number][] = [];
  for (let c = 0; c <= 4; c++) t.push([c, 4]);
  for (let r = 3; r >= 0; r--) t.push([4, r]);
  t.push([5, 0]);
  for (let r = 0; r <= 4; r++) t.push([6, r]);
  for (let c = 7; c <= 10; c++) t.push([c, 4]);
  t.push([10, 5]);
  for (let c = 10; c >= 6; c--) t.push([c, 6]);
  for (let r = 7; r <= 10; r++) t.push([6, r]);
  t.push([5, 10]);
  for (let r = 10; r >= 6; r--) t.push([4, r]);
  for (let c = 3; c >= 0; c--) t.push([c, 6]);
  t.push([0, 5]);
  return t.map(([x, y]) => [x * FIA_CELL, y * FIA_CELL]);
})();
export const trackOf = (variant: Variant = "classic") => variant === "fia" ? FIA_TRACK : TRACK;
export const cellSizeOf = (variant: Variant = "classic") => variant === "fia" ? FIA_CELL : 1;

export const FIA_HOME_COLUMN: Record<Color, [number, number][]> = {
  0: [1, 2, 3, 4].map((c) => [c * FIA_CELL, 5 * FIA_CELL]),
  1: [1, 2, 3, 4].map((r) => [5 * FIA_CELL, r * FIA_CELL]),
  2: [9, 8, 7, 6].map((c) => [c * FIA_CELL, 5 * FIA_CELL]),
  3: [9, 8, 7, 6].map((r) => [5 * FIA_CELL, r * FIA_CELL]),
};

export const homeColumnOf = (variant: Variant = "classic") => (variant === "fia" ? FIA_HOME_COLUMN : HOME_COLUMN);

/** Yard origin (top-left of the 6x6 yard). */
export const YARD_ORIGIN: Record<Color, [number, number]> = { 0: [0, 0], 1: [9, 0], 2: [9, 9], 3: [0, 9] };

/** Top yards (red, green) keep their player card at the top edge; bottom yards at the bottom edge. */
export const yardIsTop = (color: Color) => color === 0 || color === 1;

/** Center of the compact 2x2 piece nest inside a yard; the rest of the yard holds the player card. */
export function yardNestCenter(color: Color, variant: Variant = "classic"): [number, number] {
  if (variant === "fia") {
    const [x, y] = YARD_ORIGIN[color];
    return [(x === 0 ? 2 : 9) * FIA_CELL, (y === 0 ? 2 : 9) * FIA_CELL];
  }
  const [x, y] = YARD_ORIGIN[color];
  return [x + 3, y + 3];
}

export const YARD_SPOT_GAP = 0.95;

export function yardSpot(color: Color, piece: number, variant: Variant = "classic"): [number, number] {
  const [cx, cy] = yardNestCenter(color, variant);
  const g = YARD_SPOT_GAP;
  const offs: [number, number][] = [[-g, -g], [g, -g], [-g, g], [g, g]];
  return [cx + offs[piece][0], cy + offs[piece][1]];
}

/** Direction (degrees) each color enters the center from: red left, green top, yellow right, blue bottom. */
const GOAL_ANGLE: Record<Color, number> = { 0: 180, 1: 270, 2: 0, 3: 90 };

/** Finished pieces fan out in a tidy arc on their own side of the goal, one fixed slot per piece. */
export function goalSpot(color: Color, piece: number, variant: Variant = "classic"): [number, number] {
  const fia = variant === "fia";
  const r = fia ? 0.4 : 1.02;
  const step = fia ? 30 : 27;
  const a = ((GOAL_ANGLE[color] + (piece - 1.5) * step) * Math.PI) / 180;
  return [7.5 + Math.cos(a) * r, 7.5 + Math.sin(a) * r];
}

/** Center of the cell a piece occupies (grid units). */
export function pieceCenter(color: Color, progress: number, piece: number, variant: Variant = "classic"): [number, number] {
  const path = PATHS[variant];
  if (progress === YARD) return yardSpot(color, piece, variant);
  if (progress === path.goal) return goalSpot(color, piece, variant);
  if (progress <= path.lastTrack) {
    const [c, r] = trackOf(variant)[(startSquare(color, variant) + progress) % path.trackLen];
    return [c + cellSizeOf(variant) / 2, r + cellSizeOf(variant) / 2];
  }
  const [c, r] = homeColumnOf(variant)[color][progress - path.lastTrack - 1];
  return [c + cellSizeOf(variant) / 2, r + cellSizeOf(variant) / 2];
}
