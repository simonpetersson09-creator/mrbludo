const DEVICE_KEY = "mrb-ludo:v1:device-id";

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return "unknown"; }
}

/** "ios"/"android" only inside a native app shell; browsers count as "web". */
export function platform(): "ios" | "android" | "web" {
  const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };
  const p = w.Capacitor?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}
