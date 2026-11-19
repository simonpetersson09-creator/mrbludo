/**
 * Pure admin activity maths (no DB/DOM): Stockholm calendar days, app devices, visits and
 * local games. Visits are linked by a per-visit id, so a visit whose end report is lost still counts.
 */
const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar date (YYYY-MM-DD) in Stockholm, like Yatzy's admin. */
export const stockholmDate = (t: number | string) => fmt.format(new Date(t));

/** The last 30 Stockholm dates, oldest first, never before the period start. */
export function stockholmDays(now: number, periodStart: number): string[] {
  const [y, m, d] = stockholmDate(now).split("-").map(Number);
  const first = stockholmDate(periodStart);
  return Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(y, m - 1, d - (29 - i))).toISOString().slice(0, 10))
    .filter((date) => date >= first);
}

export type ActivityEvent = { kind: string; device_id: string | null; platform: string | null; detail: unknown; created_at: string };
const APP = (p: string | null) => p === "ios" || p === "android";
const VISIT_KINDS = new Set(["session", "heartbeat", "session_end"]);
const det = (e: ActivityEvent) => (e.detail && typeof e.detail === "object" ? e.detail : {}) as { sid?: unknown; seconds?: unknown; phase?: unknown };

export type DayActivity = { appDevices: number; iosDevices: number; androidDevices: number; appSessions: number; avgMinutes: number | null; localStarted: number; localFinished: number };

export function activityByDay(events: ActivityEvent[], days: string[]): Map<string, DayActivity> {
  const out = new Map<string, DayActivity>(days.map((d) => [d, { appDevices: 0, iosDevices: 0, androidDevices: 0, appSessions: 0, avgMinutes: null, localStarted: 0, localFinished: 0 }]));
  const devices = new Map<string, Set<string>>();
  // visit key -> first day and longest reported foreground time
  const visits = new Map<string, { day: string; at: string; seconds: number }>();
  events.forEach((e, i) => {
    if (!APP(e.platform)) return;
    const day = stockholmDate(e.created_at);
    const row = out.get(day);
    if (!row) return;
    if (e.device_id && e.device_id !== "unknown") {
      (devices.get(day) ?? devices.set(day, new Set()).get(day)!).add(e.device_id);
      const pk = `${e.platform}:${day}`;
      (devices.get(pk) ?? devices.set(pk, new Set()).get(pk)!).add(e.device_id);
    }
    const x = det(e);
    if (e.kind === "local_game") {
      if (x.phase === "start") row.localStarted++;
      else if (x.phase === "finish") row.localFinished++;
      return;
    }
    if (!VISIT_KINDS.has(e.kind)) return;
    const sid = typeof x.sid === "string" && x.sid ? `${e.device_id}:${x.sid}` : e.kind === "session_end" ? `legacy:${i}` : null;
    if (!sid) return;
    const seconds = Number(x.seconds) || 0;
    const v = visits.get(sid);
    if (!v) visits.set(sid, { day, at: e.created_at, seconds });
    else {
      v.seconds = Math.max(v.seconds, seconds);
      if (e.created_at < v.at) { v.at = e.created_at; v.day = day; }
    }
  });
  for (const [key, set] of devices) {
    const [plat, day] = key.includes(":") ? key.split(":") : [null, key];
    const row = out.get(day!);
    if (!row) continue;
    if (plat === "ios") row.iosDevices = set.size;
    else if (plat === "android") row.androidDevices = set.size;
    else row.appDevices = set.size;
  }
  const perDay = new Map<string, number[]>();
  for (const v of visits.values()) (perDay.get(v.day) ?? perDay.set(v.day, []).get(v.day)!).push(v.seconds);
  for (const [day, secs] of perDay) {
    const row = out.get(day);
    if (!row) continue;
    row.appSessions = secs.length;
    const timed = secs.filter((s) => s > 0);
    row.avgMinutes = timed.length ? Math.round((timed.reduce((a, b) => a + b, 0) / timed.length / 60) * 10) / 10 : null;
  }
  return out;
}

export type ExtraEvent = ActivityEvent & { user_id: string | null };
export type DayExtras = { played: number; returning: number; newPlayers: number; avgAppAge: number | null; issues: number; postShown: number; postOpportunities: number; onlineFinished: number };

const prevDay = (d: string) => new Date(Date.parse(d + "T12:00:00Z") - 86_400_000).toISOString().slice(0, 10);

/**
 * Per-day "who played" maths. A player is a device (or the account when no device id is known);
 * local games come from local_game reports, online games from the player's own match seats.
 */
export function extrasByDay(
  events: ExtraEvent[],
  seats: { user_id: string; joined_at: string }[],
  profileCreated: Map<string, string>,
  days: string[],
): Map<string, DayExtras> {
  const app = events.filter((e) => APP(e.platform));
  const deviceOf = new Map<string, string>();
  for (const e of app) if (e.user_id && e.device_id && e.device_id !== "unknown") deviceOf.set(e.user_id, e.device_id);
  const keyOf = (user: string | null, device: string | null) => (device && device !== "unknown" ? device : user ? deviceOf.get(user) ?? `u:${user}` : null);
  const appUsers = new Set(app.map((e) => e.user_id).filter(Boolean) as string[]);
  const played = new Map<string, Set<string>>();
  const add = (day: string, k: string | null) => { if (k) (played.get(day) ?? played.set(day, new Set()).get(day)!).add(k); };
  for (const e of app) if (e.kind === "local_game") add(stockholmDate(e.created_at), keyOf(e.user_id, e.device_id));
  for (const s of seats) if (appUsers.has(s.user_id)) add(stockholmDate(s.joined_at), keyOf(s.user_id, null));
  const firstPlay = new Map<string, string>();
  for (const [day, set] of [...played].sort(([a], [b]) => a.localeCompare(b))) for (const k of set) if (!firstPlay.has(k)) firstPlay.set(k, day);
  // Two newest app versions for problem counts.
  const versions = [...new Set(app.map((e) => (det(e) as { v?: unknown }).v).filter((v): v is string => typeof v === "string" && v !== "web"))]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).slice(0, 2);
  const out = new Map<string, DayExtras>();
  for (const day of days) {
    const today = played.get(day) ?? new Set<string>();
    const yesterday = played.get(prevDay(day)) ?? new Set<string>();
    const dayEv = app.filter((e) => stockholmDate(e.created_at) === day);
    const ages = [...new Set(dayEv.map((e) => e.user_id).filter(Boolean) as string[])]
      .map((u) => profileCreated.get(u)).filter(Boolean)
      .map((c) => Math.max(0, (Date.parse(day + "T12:00:00Z") - Date.parse(c!)) / 86_400_000));
    const post = dayEv.filter((e) => e.kind === "ad" && (det(e) as { name?: unknown }).name === "post_match_exit") as ExtraEvent[];
    const pd = (e: ExtraEvent) => det(e) as { result?: unknown; completed?: unknown; matchKey?: unknown };
    out.set(day, {
      played: today.size,
      returning: [...today].filter((k) => yesterday.has(k)).length,
      newPlayers: [...today].filter((k) => firstPlay.get(k) === day).length,
      avgAppAge: ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null,
      issues: dayEv.filter((e) => e.kind === "error" && versions.includes(String((det(e) as { v?: unknown }).v))).length,
      postShown: post.filter((e) => pd(e).result === "shown").length,
      postOpportunities: new Set(post.filter((e) => pd(e).result === "clicked" && pd(e).completed === true).map((e) => String(pd(e).matchKey))).size,
      onlineFinished: 0,
    });
  }
  return out;
}
