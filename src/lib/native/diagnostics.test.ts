import { afterEach, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { installNativeDiagnostics, nativeDiagnostic, nativeDiagnosticSnapshot } from "./diagnostics";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("collects nothing by default or on web even with the native flag enabled", () => {
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  let stop = installNativeDiagnostics();
  nativeDiagnostic("session", "ready");
  expect(log).not.toHaveBeenCalled();
  stop();
  vi.stubEnv("VITE_MRB_LUDO_NATIVE_DIAGNOSTICS", "1");
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  stop = installNativeDiagnostics();
  nativeDiagnostic("session", "ready");
  expect(nativeDiagnosticSnapshot()).toEqual([]);
  expect(log).not.toHaveBeenCalled();
  stop();
});

it("records only safe categories, caps memory, and clears everything on removal", () => {
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  vi.stubEnv("VITE_MRB_LUDO_NATIVE_DIAGNOSTICS", "1");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const stop = installNativeDiagnostics();
  const sensitive = "private-test-token@example.test";
  window.dispatchEvent(new ErrorEvent("error", { message: sensitive, filename: "https://example.test/?token=" + sensitive }));
  expect(nativeDiagnosticSnapshot().some(r => r.status === "script-error")).toBe(true);
  expect(JSON.stringify(log.mock.calls)).not.toContain(sensitive);
  expect(nativeDiagnosticSnapshot()[0]).toHaveProperty("event", "startup");
  for (let i = 0; i < 110; i++) nativeDiagnostic("session", "ready");
  expect(nativeDiagnosticSnapshot()).toHaveLength(100);
  expect(Object.keys(nativeDiagnosticSnapshot()[0]).sort()).toEqual(["elapsedMs", "event", "status"]);
  stop();
  log.mockClear();
  window.dispatchEvent(new ErrorEvent("error", { message: sensitive }));
  expect(nativeDiagnosticSnapshot()).toEqual([]);
  expect(log).not.toHaveBeenCalled();
});