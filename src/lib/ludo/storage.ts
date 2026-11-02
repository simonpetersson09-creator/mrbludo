import type { GameState } from "./engine";

/** All Ludo keys live in their own namespace; never shared with Yatzy. */
const NS = "mrb-ludo:v1:";
const GAME = NS + "active-game";
const STATS = NS + "stats";
const SETTINGS = NS + "settings";

export interface Settings { name: string; botSpeed: "slow" | "normal" | "fast"; haptics: boolean }
export interface Stats { played: number; wins: number; captures: number; piecesHome: number; forfeits: number }

const DEFAULT_SETTINGS: Settings = { name: "Spelare", botSpeed: "normal", haptics: true };
const DEFAULT_STATS: Stats = { played: 0, wins: 0, captures: 0, piecesHome: 0, forfeits: 0 };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
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
    const g = raw ? (JSON.parse(raw) as GameState) : null;
    return g && g.version === 1 && g.phase !== "finished" ? g : null;
  } catch { return null; }
};
export const saveGame = (g: GameState) => write(GAME, g);
export const clearGame = () => { try { localStorage.removeItem(GAME); } catch { /* noop */ } };

export const loadSettings = () => read(SETTINGS, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => write(SETTINGS, s);
export const loadStats = () => read(STATS, DEFAULT_STATS);
export const saveStats = (s: Stats) => write(STATS, s);
export const resetStats = () => write(STATS, DEFAULT_STATS);

// Notification choices (Yatzy's three toggles). Saved now; no push is sent until push is approved.
export interface NotificationPrefs { turnNotifications: boolean; reminderNotifications: boolean; playReminders: boolean }
const NOTIFS = NS + "notifications";
const DEFAULT_NOTIFS: NotificationPrefs = { turnNotifications: true, reminderNotifications: true, playReminders: false };
export const loadNotificationPrefs = () => read(NOTIFS, DEFAULT_NOTIFS);
export const saveNotificationPrefs = (p: NotificationPrefs) => write(NOTIFS, p);
