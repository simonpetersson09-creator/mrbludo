/**
 * Server health measurement (ported from Yatzy's timing helper): only slow (≥ 1 s) or failed
 * server operations are stored as `server_timing` admin events. Expected game refusals (`err:*`)
 * are not failures. Pure rules are exported for tests; recording never throws.
 */
export const SLOW_MS = 1000;
export const ALERT_WINDOW_MS = 5 * 60_000;
export const ALERT_SLOW = 3;
export const ALERT_FAILED = 2;

export function isRealFailure(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return !msg.startsWith("err:");
}

export function shouldRecord(ms: number, ok: boolean): boolean {
  return !ok || ms >= SLOW_MS;
}

export type TimingEvent = { at: string; op: string; ms: number; ok: boolean };
export type HealthAlert = { at: string; slow: number; failed: number; ops: string[] };

/** Yatzy's alert rule: ≥3 slow calls or ≥2 failures within five minutes; one alert per five minutes. */
export function healthAlerts(events: TimingEvent[]): HealthAlert[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const out: HealthAlert[] = [];
  let lastAlert = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const end = new Date(sorted[i].at).getTime();
    if (end - lastAlert < ALERT_WINDOW_MS) continue;
    const win = sorted.filter((e) => { const t = new Date(e.at).getTime(); return t <= end && t > end - ALERT_WINDOW_MS; });
    const failed = win.filter((e) => !e.ok).length;
    const slow = win.filter((e) => e.ok && e.ms >= SLOW_MS).length;
    if (slow >= ALERT_SLOW || failed >= ALERT_FAILED) {
      out.push({ at: sorted[i].at, slow, failed, ops: [...new Set(win.map((e) => e.op))] });
      lastAlert = end;
    }
  }
  return out.reverse();
}

async function record(op: string, ms: number, ok: boolean) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_events").insert({ kind: "server_timing", platform: "server", detail: { op, ms: Math.round(ms), ok } as never });
  } catch { /* measuring must never break the game */ }
}

/** Runs a server operation and stores its duration only when it was slow or failed. */
export async function timed<T>(op: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - start;
    if (shouldRecord(ms, true)) await record(op, ms, true);
    return r;
  } catch (e) {
    if (isRealFailure(e)) await record(op, Date.now() - start, false);
    throw e;
  }
}
