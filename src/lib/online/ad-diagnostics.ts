export function isAppOpenDiagnostic(row: { platform: string | null; detail: unknown }): boolean {
  return row.platform === "ios" && !!row.detail && typeof row.detail === "object"
    && "name" in row.detail && row.detail.name === "ios_app_open_diag";
}