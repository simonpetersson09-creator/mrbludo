import type { getMe } from "./online.functions";
type Me = Awaited<ReturnType<typeof getMe>>;
const PROFILE_KEY = "mrb-ludo:v1:profile-snapshot";
const MATCH_KEY = "mrb-ludo:v1:online-match";

/** Display cache only. Never use this to authorize, assign roles or write leaderboard results. */
export function saveProfileSnapshot(me: Me) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...me, isAdmin: false })); } catch { /* optional display cache */ }
}
export function loadProfileSnapshot(): Me | null {
  try { const raw = localStorage.getItem(PROFILE_KEY); return raw ? { ...JSON.parse(raw), isAdmin: false } : null; } catch { return null; }
}
export function rememberOnlineMatch(id: string | null) {
  try { if (id) localStorage.setItem(MATCH_KEY, id); else localStorage.removeItem(MATCH_KEY); } catch { /* optional shortcut */ }
}
export function lastOnlineMatch(): string | null {
  try { return localStorage.getItem(MATCH_KEY); } catch { return null; }
}