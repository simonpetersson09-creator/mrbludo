import { YARD, absSquare, goalOf, lastTrackOf, isSafeSquare as safeIn, legalMoves, targetOf, variantOf, type GameState } from "./engine";

/** Squares (abs) an opponent could reach with one roll of 1..6. */
function threatened(state: GameState, abs: number): boolean {
  const me = state.current;
  const variant = variantOf(state);
  const LAST_TRACK = lastTrackOf(variant);
  return state.players.some((op, oi) => {
    if (oi === me || op.forfeited) return false;
    return state.pieces[oi].some((pr) => {
      if (pr < 0 || pr > LAST_TRACK) return false;
      for (let r = 1; r <= 6; r++) {
        const t = pr + r;
        if (t <= LAST_TRACK && absSquare(op.color, t, variant) === abs) return true;
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
  const GOAL = goalOf(variant);
  const LAST_TRACK = lastTrackOf(variant);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const i of moves) {
    const from = state.pieces[me][i];
    const to = targetOf(from, roll, variant)!;
    let score = 0;
    const abs = absSquare(color, to, variant);
    if (to === GOAL) score += 60;
    if (from === YARD) score += 45;
    if (abs != null && !isSafeSquare(abs)) {
      const victims = state.players.some((op, oi) =>
        oi !== me && !op.forfeited && state.pieces[oi].some((pr) => absSquare(op.color, pr, variant) === abs),
      );
      if (victims) score += 80;
    }
    if (to > LAST_TRACK) score += 25; // into home column = safe
    if (abs != null && isSafeSquare(abs)) score += 15;
    const fromAbs = absSquare(color, from, variant);
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

/**
 * Full bot decision. In Fia a six may take one yard piece out alone six steps;
 * the bot prefers that when it knocks someone on square 6 and nothing better exists.
 */
export function chooseBotAction(state: GameState, rng: () => number = Math.random): { piece: number; walkOut: boolean } {
  const piece = chooseMove(state, rng);
  const me = state.current;
  const variant = variantOf(state);
  const yardPiece = state.pieces[me].findIndex((p) => p === YARD);
  if (yardPiece < 0 || !canWalkOut(state, yardPiece)) return { piece, walkOut: false };
  const abs = absSquare(state.players[me].color, 6, variant);
  const knocks = abs != null && state.players.some((op, oi) =>
    oi !== me && !op.forfeited && state.pieces[oi].some((pr) => absSquare(op.color, pr, variant) === abs));
  if (!knocks) return { piece, walkOut: false };
  // A capture elsewhere with the normal move is as good; otherwise walk out and knock.
  const from = state.pieces[me][piece];
  const to = targetOf(from, state.dice!, variant);
  const normalAbs = to == null ? null : absSquare(state.players[me].color, to, variant);
  const normalKnocks = from !== YARD && normalAbs != null && state.players.some((op, oi) =>
    oi !== me && !op.forfeited && state.pieces[oi].some((pr) => absSquare(op.color, pr, variant) === normalAbs));
  return normalKnocks ? { piece, walkOut: false } : { piece: yardPiece, walkOut: true };
}
