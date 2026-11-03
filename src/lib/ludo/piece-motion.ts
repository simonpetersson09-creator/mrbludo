import { pieceCenter } from "./board";
import { GOAL, LAST_TRACK, YARD, type Color } from "./engine";

/** Visual waypoints only; the authoritative move is never split into actions. */
export function pieceWaypoints(color: Color, from: number, to: number, piece: number): [number, number][] {
  // Fia bounce: walk into the goal, then back the extra steps.
  if (from > LAST_TRACK && from < GOAL && to < from) {
    const steps = [...Array.from({ length: GOAL - from + 1 }, (_, i) => from + i), ...Array.from({ length: GOAL - to }, (_, i) => GOAL - 1 - i)];
    return steps.map((p) => pieceCenter(color, p, piece));
  }
  if (from === YARD || to <= from || to > GOAL) return [pieceCenter(color, from, piece), pieceCenter(color, to, piece)];
  return Array.from({ length: to - from + 1 }, (_, index) => pieceCenter(color, from + index, piece));
}