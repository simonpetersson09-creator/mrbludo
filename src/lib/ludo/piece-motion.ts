import { pieceCenter } from "./board";
import { PATHS, YARD, type Color, type Variant } from "./engine";

/** Visual waypoints only; the authoritative move is never split into actions. */
export function pieceWaypoints(color: Color, from: number, to: number, piece: number, roll?: number | null, variant: Variant = "classic"): [number, number][] {
  const { goal: GOAL, lastTrack: LAST_TRACK } = PATHS[variant];
  const at = (p: number) => pieceCenter(color, p, piece, variant);
  // Fia bounce: walk into the goal, then back the extra steps.
  if (from > LAST_TRACK && from < GOAL && roll != null && from + roll > GOAL) {
    const steps = [...Array.from({ length: GOAL - from + 1 }, (_, i) => from + i), ...Array.from({ length: GOAL - to }, (_, i) => GOAL - 1 - i)];
    return steps.map(at);
  }
  if (from === YARD && to > 0) return [at(YARD), ...Array.from({ length: to + 1 }, (_, i) => at(i))];
  if (from === YARD || to <= from || to > GOAL) return [at(from), at(to)];
  return Array.from({ length: to - from + 1 }, (_, index) => at(from + index));
}
