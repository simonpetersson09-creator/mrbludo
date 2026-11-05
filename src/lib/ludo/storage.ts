import type { GameState, Variant } from "./engine";
import { cleanCount, isValidSave } from "./local-result";

/** All Ludo keys live in their own namespace; never shared with Yatzy. */
const NS = "mrb-ludo:v1:";
const GAME = NS + "active-game";
const STATS = NS + "stats";
const SETTINGS = NS + "settings";

export interface Settings { name: string; botSpeed: "normal" | "fast"; haptics: boolean }
export interface Stats { played: number; wins: number; captures: number; piecesHome: number; forfeits: number; year?: number; lifetimePlayed?: number }

const DEFAULT_SETTINGS: Settings = { name: "Spelare", botSpeed: "normal", haptics: true };
/** "Played" shown to players counts completed matches only: give-ups are excluded. */
export const completedPlayed = (s: Pick<Stats, "played" | "forfeits">) => Math.max(0, s.played - s.forfeits);
const DEFAULT_STATS: Stats = { played: 0, wins: 0, captures: 0, piecesHome: 0, forfeits: 0 };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    if (v && typeof v === "object" && (v as { botSpeed?: string }).botSpeed === "slow") (v as { botSpeed: string }).botSpeed = "normal";
    return v;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full/blocked */ }
}

export const loadGame = (): GameState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GAME);
    if (!raw) return null;
    const g: unknown = JSON.parse(raw);
    if (isValidSave(g)) return g;
    // A damaged or altered save is removed instead of crashing the home or game screen.
    clearGame();
    return null;
  } catch { clearGame(); return null; }
};
export const saveGame = (g: GameState) => write(GAME, g);
export const clearGame = () => { try { localStorage.removeItem(GAME); } catch { /* noop */ } };

export const loadSettings = () => read(SETTINGS, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => write(SETTINGS, s);
/** Statistics are per calendar year: a saved row from an earlier year starts over at zero (lifetime count kept for ad/rating timing). */
export function statsForYear(raw: Partial<Stats>, year: number): Stats {
  // Stored numbers are cleaned first: no negative, fractional or non-number counts.
  const saved: Partial<Stats> = { ...raw };
  for (const k of ["played", "wins", "captures", "piecesHome", "forfeits"] as const) saved[k] = cleanCount(raw[k]);
  saved.wins = Math.min(saved.wins ?? 0, saved.played ?? 0);
  saved.forfeits = Math.min(saved.forfeits ?? 0, saved.played ?? 0);
  if (raw.year !== undefined && !Number.isInteger(raw.year)) delete saved.year;
  const lifetimePlayed = Math.max(cleanCount(raw.lifetimePlayed ?? raw.played), saved.played ?? 0);
  if ((saved.year ?? year) === year) return { ...DEFAULT_STATS, ...saved, year, lifetimePlayed };
  return { ...DEFAULT_STATS, year, lifetimePlayed };
}
export const loadStats = (now = new Date()) => statsForYear(read<Partial<Stats>>(STATS, {}), now.getFullYear());
export const saveStats = (s: Stats) => write(STATS, s);
export const resetStats = () => { const s = loadStats(); write(STATS, { ...DEFAULT_STATS, year: s.year, lifetimePlayed: s.lifetimePlayed }); };

// Notification choices (Yatzy's three toggles), mirrored to the server for this phone's push address.
export interface NotificationPrefs { turnNotifications: boolean; reminderNotifications: boolean; playReminders: boolean }
const NOTIFS = NS + "notifications";
const DEFAULT_NOTIFS: NotificationPrefs = { turnNotifications: true, reminderNotifications: true, playReminders: true };
export const loadNotificationPrefs = () => read(NOTIFS, DEFAULT_NOTIFS);
export const saveNotificationPrefs = (p: NotificationPrefs) => write(NOTIFS, p);

/** Last chosen rule variant; Classic is the default. */
const VARIANT = NS + "variant";
export const loadVariant = (): Variant => {
  if (typeof window === "undefined") return "classic";
  try { return localStorage.getItem(VARIANT) === "fia" ? "fia" : "classic"; } catch { return "classic"; }
};
export const saveVariant = (v: Variant) => { try { localStorage.setItem(VARIANT, v); } catch { /* noop */ } };

// Online matches also count in the yearly statistics; each match id is counted once per device.
const ONLINE_COUNTED = NS + "online-counted";
/** Pure: adds a finished online match to the stats for the given seat. */
export function addOnlineResult(st: Stats, state: GameState, seat: number, piecesHome: number): Stats {
  const p = state.players[seat];
  return {
    ...st,
    played: st.played + 1,
    lifetimePlayed: (st.lifetimePlayed ?? 0) + 1,
    wins: st.wins + (state.winner === seat ? 1 : 0),
    forfeits: st.forfeits + (p?.forfeited ? 1 : 0),
    piecesHome: st.piecesHome + piecesHome,
  };
}
export function recordOnlineFinish(matchId: string, state: GameState, seat: number, piecesHome: number) {
  if (seat < 0) return;
  const done = read<string[]>(ONLINE_COUNTED, []);
  const list = Array.isArray(done) ? done : [];
  if (list.includes(matchId)) return;
  saveStats(addOnlineResult(loadStats(), state, seat, piecesHome));
  write(ONLINE_COUNTED, [...list, matchId].slice(-200));
}
export function recordOnlineCaptures(n: number) {
  if (n <= 0) return;
  const st = loadStats(); st.captures += n; saveStats(st);
}
