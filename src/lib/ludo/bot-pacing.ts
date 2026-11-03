import type { GameState } from "./engine";

export type BotSpeed = "normal" | "fast";

/** Pause before a computer acts, and how long its die tumbles. */
export const BOT_DELAY = { normal: 1600, fast: 250 } as const;
export const BOT_ROLL_MS = { normal: 1250, fast: 500 } as const;

/**
 * Extra pause when one computer's turn follows another computer's, so a row of
 * bots doesn't blur together. Never added to a bot's own extra roll after a six.
 */
export const BOT_CHAIN_EXTRA = { normal: 900, fast: 150 } as const;

/** How long the computer waits before acting in this state. */
export function botWaitMs(state: GameState, speed: BotSpeed): number {
  const last = state.lastEvent;
  const previous = last && last.player !== state.current ? state.players[last.player] : undefined;
  return BOT_DELAY[speed] + (previous?.isBot ? BOT_CHAIN_EXTRA[speed] : 0);
}
