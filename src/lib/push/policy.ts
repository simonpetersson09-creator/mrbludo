import type { GameState } from "@/lib/ludo/engine";

/** A player whose match screen polled within this window is looking at the game: no push. */
export const WATCHING_MS = 20_000;
export const isWatching = (lastSeenIso: string | null | undefined, nowMs: number) =>
  !!lastSeenIso && nowMs - new Date(lastSeenIso).getTime() < WATCHING_MS;

/** The human whose turn just began, or null (same player rolls again, bot, finished, gave up). */
export function turnRecipient(prev: GameState, next: GameState): string | null {
  if (next.phase === "finished") return null;
  if (prev.phase === next.phase && prev.current === next.current && prev.turnCount === next.turnCount) return null;
  const p = next.players[next.current];
  if (!p || p.isBot || p.forfeited || p.id.startsWith("bot:")) return null;
  return p.id;
}

/** One notification per event and person; the database key makes repeats impossible. */
export const pushKey = {
  turn: (matchId: string, turn: number, uid: string) => `turn:${matchId}:${turn}:${uid}`,
  ready: (matchId: string, uid: string) => `ready:${matchId}:${uid}`,
  invite: (inviteId: string) => `invite:${inviteId}`,
  friend: (friendshipId: string) => `friend:${friendshipId}`,
};

/** Where a tapped notification may lead. Anything else opens the home screen. */
export function safePushPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw === "/online" || raw === "/friends") return raw;
  if (/^\/online\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw)) return raw;
  return null;
}

/** APNs device tokens are hex (64 today, Apple allows longer). */
export function pushTokenInput(d: { token: unknown; locale?: unknown }, isLanguage: (v: string) => boolean) {
  const token = String(d?.token ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64,200}$/.test(token)) throw new Error("err:bad_action");
  const locale = typeof d?.locale === "string" && isLanguage(d.locale) ? d.locale : "sv";
  return { token, locale };
}
