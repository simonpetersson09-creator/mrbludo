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