import { randomId } from "@/lib/random-id";
const DEVICE_KEY = "mrb-ludo:v1:device-id";
let cached: string | null = null;

/**
 * Random app-only number for this phone (never a hardware ID). Kept in memory, mirrored to
 * local storage and, in the app, to Keychain/Keystore so cleared web storage does not look like a new phone.
 */
export function deviceId(): string {
  if (cached) return cached;
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = randomId(); localStorage.setItem(DEVICE_KEY, id); }
    cached = id;
  } catch { cached = randomId(); }
  return cached;
}

/** Native only: adopt the durable copy if one exists, otherwise store the current number durably. */
export async function initDeviceId(): Promise<string> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return deviceId();
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    const { value: keys } = await SecureStoragePlugin.keys();
    if (keys.includes(DEVICE_KEY)) {
      const { value } = await SecureStoragePlugin.get({ key: DEVICE_KEY });
      if (value) {
        cached = value;
        try { localStorage.setItem(DEVICE_KEY, value); } catch { /* memory copy is enough */ }
        return value;
      }
    }
    await SecureStoragePlugin.set({ key: DEVICE_KEY, value: deviceId() });
  } catch { /* fall back to the local copy */ }
  return deviceId();
}

/** "ios"/"android" only inside a native app shell; browsers count as "web". */
export function platform(): "ios" | "android" | "web" {
  const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };
  const p = w.Capacitor?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}
