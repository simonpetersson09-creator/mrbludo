import { Capacitor } from "@capacitor/core";
import { registerPushToken, setReminders, unregisterPushToken } from "@/lib/online/online.functions";
import { loadNotificationPrefs } from "@/lib/ludo/storage";
import { getLanguage, subscribeLanguageChanges } from "@/lib/i18n/language";
import { safePushPath } from "@/lib/push/policy";

const TOKEN_KEY = "mrb-ludo:v1:push-token";
/** iPhone (APNs) and Android (Firebase Cloud Messaging) use the same plugin and flow. */
const platform = (): "ios" | "android" | null => {
  if (!Capacitor.isNativePlatform()) return null;
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "android" ? p : null;
};
const isIos = () => platform() !== null;
const ANDROID_CHANNEL = "mrb-ludo";
const plugin = async () => (await import("@capacitor/push-notifications")).PushNotifications;

async function sendToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage full */ }
  try { await registerPushToken({ data: { token, locale: getLanguage(), platform: platform() ?? "ios" } }); await syncPushPrefs(); } catch { /* retried on next launch */ }
}

/** Sends this phone's three notification switches (Settings) to the server. */
export async function syncPushPrefs(): Promise<void> {
  if (!isIos()) return;
  const p = loadNotificationPrefs();
  try { await setReminders({ data: { turns: p.turnNotifications, nudges: p.reminderNotifications, weekly: p.playReminders } }); } catch { /* next launch */ }
}

/**
 * Listens for the device token and for taps on notifications. Registers silently only
 * when the player already allowed notifications; the question itself is asked by askPushPermission.
 */
export async function startPush(navigate: (path: string) => void): Promise<() => void> {
  if (!isIos()) return () => {};
  const Push = await plugin();
  if (platform() === "android") {
    // Android 8+ shows notifications in a named channel; matches the server's channel_id.
    try { await Push.createChannel({ id: ANDROID_CHANNEL, name: "Mr. B Ludo", importance: 4, visibility: 1, sound: "default" }); } catch { /* exists */ }
  }
  const handles = await Promise.all([
    Push.addListener("registration", ({ value }) => { void sendToken(value); }),
    Push.addListener("registrationError", () => { /* no token: nothing to save */ }),
    Push.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const path = safePushPath((notification.data as { path?: unknown } | undefined)?.path);
      navigate(path ?? "/");
    }),
  ]);
  const offLang = subscribeLanguageChanges(() => {
    let token: string | null = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch { /* none */ }
    if (token) void sendToken(token);
  });
  try { if ((await Push.checkPermissions()).receive === "granted") await Push.register(); } catch { /* unavailable */ }
  return () => { offLang(); handles.forEach((h) => void h.remove()); };
}

export const PUSH_ASK_EVENT = "mrb-ludo:push-ask";
const ASK_LATER_KEY = "mrb-ludo:v1:push-ask-later";
const ASK_LATER_MS = 3 * 86_400_000;

/** Our own explanation before Apple's one-time question; resolves true when the player wants notifications. */
function explainFirst(): Promise<boolean> {
  try { if (Date.now() - Number(localStorage.getItem(ASK_LATER_KEY) ?? 0) < ASK_LATER_MS) return Promise.resolve(false); } catch { /* none */ }
  return new Promise((resolve) => {
    const answer = (yes: boolean) => {
      if (!yes) { try { localStorage.setItem(ASK_LATER_KEY, String(Date.now())); } catch { /* full */ } }
      resolve(yes);
    };
    window.dispatchEvent(new CustomEvent(PUSH_ASK_EVENT, { detail: answer }));
  });
}

/** Entering online play: explains first, then lets iOS show its own dialog (only possible once). */
export async function askPushPermission(): Promise<void> {
  if (!isIos()) return;
  try {
    const status = (await (await plugin()).checkPermissions()).receive;
    if ((status === "prompt" || status === "prompt-with-rationale") && !(await explainFirst())) return;
  } catch { return; }
  await requestPush();
}

async function requestPush(): Promise<void> {
  try {
    const Push = await plugin();
    let status = (await Push.checkPermissions()).receive;
    if (status === "prompt" || status === "prompt-with-rationale") status = (await Push.requestPermissions()).receive;
    if (status === "granted") await Push.register();
  } catch { /* the game works without notifications */ }
}

/** Before this player's identity is erased: the phone stops receiving their notifications. */
export async function forgetPushToken(): Promise<void> {
  if (!isIos()) return;
  let token: string | null = null;
  try { token = localStorage.getItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch { /* none */ }
  if (token) { try { await unregisterPushToken({ data: { token, platform: platform() ?? "ios" } }); } catch { /* server also deletes on erase */ } }
  try { await (await plugin()).unregister(); } catch { /* unavailable */ }
}

export type PushPermission = "granted" | "denied" | "prompt" | "unsupported";

/** Current notification permission on this iPhone; other platforms report "unsupported". */
export async function pushPermission(): Promise<PushPermission> {
  if (!isIos()) return "unsupported";
  try {
    const s = (await (await plugin()).checkPermissions()).receive;
    return s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt";
  } catch { return "unsupported"; }
}

/** "Slå på": asks if iOS still may ask, otherwise opens this app's page in iOS Settings. */
export async function enablePush(): Promise<PushPermission> {
  const now = await pushPermission();
  if (now === "prompt") { await requestPush(); return pushPermission(); }
  if (now === "denied" && platform() === "ios") { try { window.location.href = "app-settings:"; } catch { /* not available */ } }
  return now;
}
