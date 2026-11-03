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

/** Board walk speed: one square per STEP_MS (shared by the board and the die colour change). */
export const STEP_MS = 185;

/**
 * How long the board's walk animation for one move lasts, so the rest of the screen can wait for
 * the piece to land before treating the turn as passed over. Mirrors the board's own arithmetic:
 * one square per STEP_MS, and a drawn-out final step when the move knocks someone out.
 */
export function walkDurationMs(from: number, to: number, variant: Variant = "classic", captured = false): number {
  const { goal: GOAL, lastTrack: LAST } = PATHS[variant];
  let steps: number;
  if (from === YARD) steps = to + 1;
  else if (to < from && from > LAST && from < GOAL) steps = (GOAL - from) + (GOAL - to); // Fia bounce off the goal
  else steps = Math.max(1, to - from);
  return steps * STEP_MS + (captured ? STEP_MS * 2.4 : 0);
}
