import { stockholmDays } from "./activity-stats";
/** Filter reporting only, never delete collected diagnostics or affect player results. */
export function adminActivityEvents<T extends { user_id: string | null; device_id: string | null }>(
  events: T[], exclusions: { user_id: string; device_id: string | null }[],
): T[] {
  const users = new Set(exclusions.map((e) => e.user_id));
  const devices = new Set(exclusions.flatMap((e) => e.device_id ? [e.device_id] : []));
  return events.filter((e) => !(e.user_id && users.has(e.user_id)) && !(e.device_id && devices.has(e.device_id)));
}

/** A statistics reset starts a new reporting period without erasing game data or diagnostics. */
export function appPlayerIds(events: { platform: string | null; user_id: string | null; created_at: string }[], since: string): Set<string> {
  return new Set(events.filter((e) => (e.platform === "ios" || e.platform === "android") && e.created_at >= since)
    .flatMap((e) => e.user_id ? [e.user_id] : []));
}

export function adminPeriodStart(now: number, resetAt: string | null): number {
  const windowStart = now - 30 * 86_400_000;
  const reset = resetAt === null ? NaN : Date.parse(resetAt);
  return Number.isFinite(reset) ? Math.max(windowStart, Math.min(now, reset)) : windowStart;
}

/** Only return Stockholm calendar rows within the reporting period, never pre-reset zero rows. */
export function adminReportingDays(now: number, periodStart: number): string[] {
  return stockholmDays(now, periodStart);
}
