import { GOAL, LAST_TRACK, YARD, absSquare, isSafeSquare as safeIn, legalMoves, targetOf, variantOf, type GameState } from "./engine";

/** Squares (abs) an opponent could reach with one roll of 1..6. */
function threatened(state: GameState, abs: number): boolean {
  const me = state.current;
  return state.players.some((op, oi) => {
    if (oi === me || op.forfeited) return false;
    return state.pieces[oi].some((pr) => {
      if (pr < 0 || pr > LAST_TRACK) return false;
      for (let r = 1; r <= 6; r++) {
        const t = pr + r;
        if (t <= LAST_TRACK && absSquare(op.color, t) === abs) return true;
      }
      return false;
    });
  });
}

/** Rule-based bot. Only ever returns a legal piece index. */
export function chooseMove(state: GameState, rng: () => number = Math.random): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal moves");
  const me = state.current;
  const color = state.players[me].color;
  const roll = state.dice!;
  const variant = variantOf(state);
  const isSafeSquare = (abs: number) => safeIn(abs, variant);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const i of moves) {
    const from = state.pieces[me][i];
    const to = targetOf(from, roll, variant)!;
    let score = 0;
    const abs = absSquare(color, to);
    if (to === GOAL) score += 60;
    if (from === YARD) score += 45;
    if (abs != null && !isSafeSquare(abs)) {
      const victims = state.players.some((op, oi) =>
        oi !== me && !op.forfeited && state.pieces[oi].some((pr) => absSquare(op.color, pr) === abs),
      );
      if (victims) score += 80;
    }
    if (to > LAST_TRACK) score += 25; // into home column = safe
    if (abs != null && isSafeSquare(abs)) score += 15;
    const fromAbs = absSquare(color, from);
    if (fromAbs != null && !isSafeSquare(fromAbs) && threatened(state, fromAbs)) score += 20;
    if (abs != null && !isSafeSquare(abs) && threatened(state, abs)) score -= 30;
    score += to * 0.3;
    score += rng() * 6; // reasonable variation
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
