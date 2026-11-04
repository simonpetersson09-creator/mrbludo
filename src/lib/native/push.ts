import { Capacitor } from "@capacitor/core";
import { registerPushToken, unregisterPushToken } from "@/lib/online/online.functions";
import { getLanguage, subscribeLanguageChanges } from "@/lib/i18n/language";
import { safePushPath } from "@/lib/push/policy";

const TOKEN_KEY = "mrb-ludo:v1:push-token";
const isIos = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
const plugin = async () => (await import("@capacitor/push-notifications")).PushNotifications;

async function sendToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage full */ }
  try { await registerPushToken({ data: { token, locale: getLanguage() } }); } catch { /* retried on next launch */ }
}

/**
 * Listens for the device token and for taps on notifications. Registers silently only
 * when the player already allowed notifications; the question itself is asked by askPushPermission.
 */
export async function startPush(navigate: (path: string) => void): Promise<() => void> {
  if (!isIos()) return () => {};
  const Push = await plugin();
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

/** Asks once, at a moment that makes sense (entering online play). iOS shows its own dialog only the first time. */
export async function askPushPermission(): Promise<void> {
  if (!isIos()) return;
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
  if (token) { try { await unregisterPushToken({ data: { token } }); } catch { /* server also deletes on erase */ } }
  try { await (await plugin()).unregister(); } catch { /* unavailable */ }
}
