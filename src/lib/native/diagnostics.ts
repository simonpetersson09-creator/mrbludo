import { Capacitor } from "@capacitor/core";

export type DiagnosticEvent = "startup" | "session" | "network" | "lifecycle" | "webview" | "runtime";
export type DiagnosticStatus = "started" | "ready" | "failed" | "online" | "offline" | "active" | "background" | "script-error" | "resource-error" | "unhandled-rejection";
const events = new Set<string>(["startup", "session", "network", "lifecycle", "webview", "runtime"]);
const statuses = new Set<string>(["started", "ready", "failed", "online", "offline", "active", "background", "script-error", "resource-error", "unhandled-rejection"]);
const records: { event: DiagnosticEvent; status: DiagnosticStatus; elapsedMs: number }[] = [];
let enabled = false;
let startedAt = 0;

/** Only allowlisted labels enter diagnostics. No Error, URL, ID, token or request payload is accepted. */
export function nativeDiagnostic(event: DiagnosticEvent, status: DiagnosticStatus) {
  if (!enabled || !events.has(event) || !statuses.has(status)) return;
  const record = { event, status, elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)) };
  records.push(record);
  if (records.length > 100) records.shift();
  console.info("[mrb-ludo:native]", JSON.stringify(record));
}

export function nativeDiagnosticSnapshot() { return records.map(record => ({ ...record })); }

/** Build-time opt-in, native only, memory only; disabling the flag removes listeners and collection. */
export function installNativeDiagnostics() {
  if (!Capacitor.isNativePlatform() || import.meta.env['VITE_MRB_LUDO_NATIVE_DIAGNOSTICS'] !== "1") return () => {};
  enabled = true;
  startedAt = performance.now();
  records.length = 0;
  nativeDiagnostic("startup", "started");
  nativeDiagnostic("network", navigator.onLine ? "online" : "offline");
  const error = (event: Event) => nativeDiagnostic("webview", event instanceof ErrorEvent ? "script-error" : "resource-error");
  const rejection = () => nativeDiagnostic("webview", "unhandled-rejection");
  const online = () => nativeDiagnostic("network", "online");
  const offline = () => nativeDiagnostic("network", "offline");
  window.addEventListener("error", error, true);
  window.addEventListener("unhandledrejection", rejection);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    enabled = false;
    records.length = 0;
    window.removeEventListener("error", error, true);
    window.removeEventListener("unhandledrejection", rejection);
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}