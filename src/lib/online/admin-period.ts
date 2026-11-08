/** A statistics reset starts a new reporting period without erasing game data or diagnostics. */
export function adminPeriodStart(now: number, resetAt: string | null): number {
  const windowStart = now - 30 * 86_400_000;
  const reset = resetAt === null ? NaN : Date.parse(resetAt);
  return Number.isFinite(reset) ? Math.max(windowStart, Math.min(now, reset)) : windowStart;
}