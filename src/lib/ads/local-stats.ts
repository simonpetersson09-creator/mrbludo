/** Yatzy waits for one finished match before any App Open ad; Ludo counts finished local games plus finished online matches. */
import { loadStats } from "@/lib/ludo/storage";

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
