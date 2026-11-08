/** Never show app-start attempts before the new reporting start (UTC). */
export function appOpenDiagnosticsSince(now: number): string {
  return new Date(Math.max(Date.parse("2026-11-08T00:00:00.000Z"), now - 30 * 86_400_000)).toISOString();
}

export function isAppOpenDiagnostic(row: { platform: string | null; detail: unknown }): boolean {
  return row.platform === "ios" && !!row.detail && typeof row.detail === "object"
    && "name" in row.detail && row.detail.name === "ios_app_open_diag";
}