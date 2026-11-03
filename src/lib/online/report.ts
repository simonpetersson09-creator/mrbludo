/**
 * Sends app errors and ad events to the admin logs (app_events). Fire-and-forget,
 * capped per session, only short allowlisted fields: no URLs with queries, identities or consent choices.
 */
const MAX_PER_SESSION = { error: 10, ad: 60 } as const;
const sent = { error: 0, ad: 0 };
const seenErrors = new Set<string>();

function clean(data: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(data).slice(0, 12)) {
    if (typeof v === "number" || typeof v === "boolean") out[k.slice(0, 40)] = v;
    else if (typeof v === "string") out[k.slice(0, 40)] = v.slice(0, 120);
  }
  return out;
}

async function send(kind: "error" | "ad", detail: Record<string, unknown>) {
  if (typeof window === "undefined" || sent[kind] >= MAX_PER_SESSION[kind]) return;
  sent[kind]++;
  try {
    const [{ logEvent }, { deviceId, platform }] = await Promise.all([import("./online.functions"), import("./telemetry")]);
    await logEvent({ data: { kind, deviceId: deviceId(), platform: platform(), detail } });
  } catch { /* logging must never affect the app */ }
}

export function reportAppError(error: unknown, source: string): void {
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300);
  if (seenErrors.has(message)) return;
  seenErrors.add(message);
  const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 4).join(" | ").slice(0, 600) : undefined;
  void send("error", { source, message, ...(stack ? { stack } : {}), route: typeof location !== "undefined" ? location.pathname : "" });
}

export function reportAdEvent(name: string, data: Record<string, unknown> = {}): void {
  void send("ad", { name: name.slice(0, 60), ...clean(data) });
}
