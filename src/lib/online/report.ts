/**
 * Sends app errors and ad events to the admin logs (app_events). Fire-and-forget,
 * capped per session, only short allowlisted fields: no URLs with queries, identities or consent choices.
 * Every report carries the app version; reports that cannot be delivered (offline, server down)
 * are kept on the device (max 30, 7 days) and sent on the next start or when the network returns.
 */
import { enqueue, parseQueue, type QueuedReport } from "./report-queue";

const MAX_PER_SESSION = { error: 10, ad: 60, local_game: 40 } as const;
const QUEUE_KEY = "mrb-ludo:v1:report-queue";
const sent = { error: 0, ad: 0, local_game: 0 };
const seenErrors = new Set<string>();

function clean(data: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(data).slice(0, 12)) {
    if (typeof v === "number" || typeof v === "boolean") out[k.slice(0, 40)] = v;
    else if (typeof v === "string") out[k.slice(0, 40)] = v.slice(0, 120);
  }
  return out;
}

let versionPromise: Promise<string> | null = null;
export function appVersion(): Promise<string> {
  versionPromise ??= (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return "web";
      const { App } = await import("@capacitor/app");
      const i = await App.getInfo();
      return `${i.version} (${i.build})`.slice(0, 30);
    } catch { return "unknown"; }
  })();
  return versionPromise;
}

const readQueue = (): QueuedReport[] => { try { return parseQueue(localStorage.getItem(QUEUE_KEY), Date.now()); } catch { return []; } };
const writeQueue = (q: QueuedReport[]) => { try { if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); else localStorage.removeItem(QUEUE_KEY); } catch { /* full */ } };

async function deliver(item: QueuedReport): Promise<void> {
  const [{ logEvent }, { deviceId, platform }, v] = await Promise.all([import("./online.functions"), import("./telemetry"), appVersion()]);
  const late = Date.now() - item.at > 60_000;
  await logEvent({ data: { kind: item.kind, deviceId: deviceId(), platform: platform(), detail: { ...item.detail, v, ...(late ? { queued: new Date(item.at).toISOString() } : {}) } } });
}

let flushing = false;
/** Sends reports saved while offline. Safe to call often. */
export async function flushQueuedReports(): Promise<void> {
  if (typeof window === "undefined" || flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  try {
    let q = readQueue();
    while (q.length) {
      try { await deliver(q[0]); } catch { break; }
      q = q.slice(1);
      writeQueue(q);
    }
  } finally { flushing = false; }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushQueuedReports(); });
  window.setTimeout(() => { void flushQueuedReports(); }, 5000);
}

async function send(kind: QueuedReport["kind"], detail: Record<string, unknown>) {
  if (typeof window === "undefined" || sent[kind] >= MAX_PER_SESSION[kind]) return;
  sent[kind]++;
  const item: QueuedReport = { kind, detail, at: Date.now() };
  try { await deliver(item); }
  catch { writeQueue(enqueue(readQueue(), item)); /* logging must never affect the app */ }
}

export function reportAppError(error: unknown, source: string): void {
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300);
  if (seenErrors.has(message)) return;
  seenErrors.add(message);
  const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 4).join(" | ").slice(0, 600) : undefined;
  void send("error", { source, message, ...(stack ? { stack } : {}), route: typeof location !== "undefined" ? location.pathname : "" });
}

export function reportAdEvent(name: string, data: Record<string, unknown> = {}): void {
  // Consent and tracking-permission answers stay on the device.
  if (/consent|att_|privacy/i.test(name)) return;
  void send("ad", { name: name.slice(0, 60), ...clean(data) });
}

/** A local game started or finished on this phone (admin counts all play, not only online). */
export function reportLocalGame(phase: "start" | "finish", state: { variant?: string; players: { isBot: boolean }[] }): void {
  const bots = state.players.filter((p) => p.isBot).length;
  void send("local_game", { phase, variant: state.variant === "fia" ? "fia" : "classic", humans: state.players.length - bots, bots });
}
