import { useEffect, useRef, useState } from "react";
import { variantOf, type GameState } from "@/lib/ludo/engine";
import { walkDurationMs } from "@/lib/ludo/piece-motion";

/**
 * How long the die should keep the previous player's colour. The board is still walking that
 * player's piece, so the turn has not gone over yet — the die must not run ahead of the board.
 */
export function dieColorHoldMs(state: GameState): number {
  const ev = state.lastEvent;
  if (ev?.kind !== "moved") return 0;
  // With animations turned down there is no walk to wait for.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const player = state.players[ev.player];
  if (!player) return 0;
  // A short beat after the piece lands, so the handover reads as one moment.
  return walkDurationMs(player.color, ev.from, ev.to, ev.piece, ev.roll, variantOf(state), ev.captured.length > 0) + 150;
}

/**
 * The die colour to show: the current player's colour, but only once the previous move has
 * finished walking. Until then the die keeps the colour of the player who just moved.
 */
export function useDieColor(target: string, state: GameState | null): string {
  const [shown, setShown] = useState(target);
  const latest = useRef(target);
  latest.current = target;
  const waiting = target !== shown;
  useEffect(() => {
    if (!waiting) return;
    const hold = state ? dieColorHoldMs(state) : 0;
    if (hold <= 0) { setShown(latest.current); return; }
    const timer = setTimeout(() => setShown(latest.current), hold);
    return () => clearTimeout(timer);
  }, [waiting, state]);
  return shown;
}
