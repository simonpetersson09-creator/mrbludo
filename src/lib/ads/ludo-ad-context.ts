/**
 * Ludo-side inputs for the Yatzy-ported ad flow (`admob.ts`).
 * Ludo has no analytics backend: ad events are written to the native console only
 * (no identities, consent choices or personal data), never stored or uploaded.
 */
import { loadStats } from "@/lib/ludo/storage";

export function trackEvent(name: string, data: Record<string, unknown> = {}): void {
  try { console.info(`[ads] ${name}`, data); } catch { /* never affect ads */ }
}

/** Yatzy waits for one finished match before any App Open ad; Ludo counts finished local games. */
const ONLINE_DONE_KEY = "mrb-ludo:v1:ads-online-finished";
function onlineFinished(): string[] {
  try { const v = JSON.parse(localStorage.getItem(ONLINE_DONE_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
/** Counts a finished online match once (local games are already counted in stats). */
export function markOnlineMatchFinished(matchId: string): void {
  try { const ids = onlineFinished(); if (!ids.includes(matchId)) localStorage.setItem(ONLINE_DONE_KEY, JSON.stringify([...ids, matchId].slice(-20))); } catch { /* storage off */ }
}
export function getRankedGames(): number {
  try { return loadStats().played + onlineFinished().length; } catch { return 0; }
}

/** Quick-play search on Home acts as Yatzy's waiting room: no App Open ad on top of it. */
let searching = 0;
export function setQuickSearchActive(active: boolean): void { searching = Math.max(0, searching + (active ? 1 : -1)); }
export function waitingRoomAdBlocked(): boolean { return searching > 0; }
