import { targetOf, variantOf, type GameState } from "./engine";
import { pieceCenter } from "./board";

/** Presentation only: use the engine's exact targets without applying a move. */
export function movePreviews(state: GameState, legal: number[]) {
  const player = state.players[state.current];
  if (!player || state.phase !== "move" || state.dice == null) return [];
  const seen = new Set<string>();
  return legal.flatMap((piece) => {
    const progress = state.pieces[state.current]?.[piece];
    if (progress == null) return [];
    const variant = variantOf(state);
    const target = targetOf(progress, state.dice ?? 0, variant);
    if (target == null) return [];
    const [x, y] = pieceCenter(player.color, target, piece, variant);
    const key = `${x},${y}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ x, y, color: player.color, piece }];
  });
}