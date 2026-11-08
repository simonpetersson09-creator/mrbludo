import { expect, it } from "vitest";
import { isAppOpenDiagnostic } from "./ad-diagnostics";
it("selects only iPhone app-open diagnostics, not Android or other ad events", () => {
  expect(isAppOpenDiagnostic({ platform: "ios", detail: { name: "ios_app_open_diag" } })).toBe(true);
  expect(isAppOpenDiagnostic({ platform: "android", detail: { name: "ios_app_open_diag" } })).toBe(false);
  expect(isAppOpenDiagnostic({ platform: "ios", detail: { name: "ad_result" } })).toBe(false);
  expect(isAppOpenDiagnostic({ platform: "ios", detail: null })).toBe(false);
});