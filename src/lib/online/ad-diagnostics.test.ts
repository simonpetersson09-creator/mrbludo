import { expect, it } from "vitest";
import { appOpenDiagnosticsSince, isAppOpenDiagnostic } from "./ad-diagnostics";
it("starts app-open diagnostics on November 8, 2026, excluding earlier attempts", () => {
  expect(appOpenDiagnosticsSince(Date.parse("2026-11-08T10:25:00Z"))).toBe("2026-11-08T00:00:00.000Z");
});
it("keeps the rolling 30-day limit after the new reporting start", () => {
  expect(appOpenDiagnosticsSince(Date.parse("2026-12-20T00:00:00Z"))).toBe("2026-11-20T00:00:00.000Z");
});
it("selects only iPhone app-open diagnostics, not Android or other ad events", () => {
  expect(isAppOpenDiagnostic({ platform: "ios", detail: { name: "ios_app_open_diag" } })).toBe(true);
  expect(isAppOpenDiagnostic({ platform: "android", detail: { name: "ios_app_open_diag" } })).toBe(false);
  expect(isAppOpenDiagnostic({ platform: "ios", detail: { name: "ad_result" } })).toBe(false);
  expect(isAppOpenDiagnostic({ platform: "ios", detail: null })).toBe(false);
});