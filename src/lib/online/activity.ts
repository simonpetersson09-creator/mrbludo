/**
 * App activity for the admin panel, like Yatzy: one id per visit, a start report, a heartbeat
 * every minute while the app is in front, and an end report when it is hidden or closed.
 * After 30 minutes in the background a new visit starts. Only the visit id, foreground seconds
 * and app version are sent.
 */
import { randomId } from "@/lib/random-id";
import { logEvent } from "./online.functions";
import { deviceId, platform } from "./telemetry";
import { appVersion } from "./report";

export const HEARTBEAT_MS = 60_000;
export const NEW_VISIT_AFTER_MS = 30 * 60_000;
const MAX_SECONDS = 4 * 3600;

export function startActivityTracking() {
  let sid: string | null = null;
  let activeMs = 0;
  let visibleSince: number | null = null;
  let hiddenAt = 0;
  let started = false; // start report delivered for this visit

  const seconds = () => Math.min(MAX_SECONDS, Math.round((activeMs + (visibleSince ? Date.now() - visibleSince : 0)) / 1000));
  const send = async (kind: "session" | "heartbeat" | "session_end") => {
    if (!sid) return;
    const v = await appVersion();
    await logEvent({ data: { kind, deviceId: deviceId(), platform: platform(), detail: { sid, seconds: seconds(), v } } });
  };
  const begin = () => { sid = randomId(); activeMs = 0; visibleSince = Date.now(); started = false; };
  const sendStart = () => { if (started || !sid) return; send("session").then(() => { started = true; }).catch(() => {}); };

  const onVisible = () => {
    if (visibleSince !== null) return;
    if (!sid || Date.now() - hiddenAt > NEW_VISIT_AFTER_MS) begin();
    else visibleSince = Date.now();
    if (!started) sendStart(); else void send("heartbeat").catch(() => {});
  };
  const onHidden = () => {
    if (visibleSince === null) return;
    activeMs += Date.now() - visibleSince;
    visibleSince = null;
    hiddenAt = Date.now();
    if (seconds() >= 5) void send("session_end").catch(() => {});
  };
  const onVisibility = () => (document.visibilityState === "visible" ? onVisible() : onHidden());
  const timer = window.setInterval(() => {
    if (visibleSince === null) return;
    if (!started) sendStart(); else void send("heartbeat").catch(() => {});
  }, HEARTBEAT_MS);

  if (document.visibilityState === "visible") begin();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onHidden);
  return {
    /** Call when the player identity is ready (start, network back, resume). */
    ready: () => { if (!sid && document.visibilityState === "visible") begin(); sendStart(); },
    stop: () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("pagehide", onHidden); },
  };
}
