import { WALK_OUT_TARGET, canWalkOut, targetOf, variantOf, type GameState } from "./engine";
import { pieceCenter } from "./board";

/** Presentation only: use the engine's exact targets without applying a move. */
export function movePreviews(state: GameState, legal: number[]) {
  const player = state.players[state.current];
  if (!player || state.phase !== "move" || state.dice == null) return [];
  const seen = new Set<string>();
  const variant = variantOf(state);
  const out: { x: number; y: number; color: typeof player.color; piece: number; walkOut: boolean }[] = [];
  const add = (piece: number, target: number, walkOut: boolean) => {
    const [x, y] = pieceCenter(player.color, target, piece, variant);
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y, color: player.color, piece, walkOut });
  };
  for (const piece of legal) {
    const progress = state.pieces[state.current]?.[piece];
    if (progress == null) continue;
    const target = targetOf(progress, state.dice ?? 0, variant);
    if (target != null) add(piece, target, false);
    // Fia six: a second marker on the sixth square lets one piece come out and walk.
    if (canWalkOut(state, piece)) add(piece, WALK_OUT_TARGET, true);
  }
  return out;
}
