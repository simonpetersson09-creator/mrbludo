import { pieceCenter } from "./board";
import { GOAL, YARD, type Color } from "./engine";

/** Visual waypoints only; the authoritative move is never split into actions. */
export function pieceWaypoints(color: Color, from: number, to: number, piece: number): [number, number][] {
  if (from === YARD || to <= from || to > GOAL) return [pieceCenter(color, from, piece), pieceCenter(color, to, piece)];
  return Array.from({ length: to - from + 1 }, (_, index) => pieceCenter(color, from + index, piece));
}