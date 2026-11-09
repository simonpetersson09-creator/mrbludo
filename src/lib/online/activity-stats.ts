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

export type DayActivity = { appDevices: number; appSessions: number; avgMinutes: number | null; localStarted: number; localFinished: number };

export function activityByDay(events: ActivityEvent[], days: string[]): Map<string, DayActivity> {
  const out = new Map<string, DayActivity>(days.map((d) => [d, { appDevices: 0, appSessions: 0, avgMinutes: null, localStarted: 0, localFinished: 0 }]));
  const devices = new Map<string, Set<string>>();
  // visit key -> first day and longest reported foreground time
  const visits = new Map<string, { day: string; at: string; seconds: number }>();
  events.forEach((e, i) => {
    if (!APP(e.platform)) return;
    const day = stockholmDate(e.created_at);
    const row = out.get(day);
    if (!row) return;
    if (e.device_id && e.device_id !== "unknown") (devices.get(day) ?? devices.set(day, new Set()).get(day)!).add(e.device_id);
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
  for (const [day, set] of devices) out.get(day)!.appDevices = set.size;
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
