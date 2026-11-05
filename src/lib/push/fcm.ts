/**
 * Android delivery through Firebase Cloud Messaging (HTTP v1), via the Lovable connector
 * gateway: the service account never reaches app code. Pure apart from the injected fetch.
 */
import type { PushMessage, Outcome } from "./apns";

export interface FcmCreds { lovableKey: string; connectionKey: string }
export const FCM_URL = "https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send";
/** Android channel the app creates at start; Firebase falls back to its own if missing. */
export const ANDROID_CHANNEL = "mrb-ludo";

/** Both keys exist only once Ludo's own Firebase connection is linked; otherwise Android sending stays off. */
export function readFcmCreds(env: Record<string, string | undefined>): FcmCreds | null {
  const lovableKey = env["LOVABLE_API_KEY"]?.trim(), connectionKey = env["FIREBASE_MESSAGING_API_KEY"]?.trim();
  return lovableKey && connectionKey ? { lovableKey, connectionKey } : null;
}

/** Visible notification only (no data-only/background work); `path` rides along for the tap. */
export function fcmPayload(token: string, m: PushMessage) {
  return {
    message: {
      token,
      notification: { title: m.title, body: m.body },
      data: { path: m.path },
      android: {
        priority: "HIGH",
        ttl: "3600s",
        ...(m.collapseId ? { collapse_key: m.collapseId.slice(0, 64) } : {}),
        notification: { channel_id: ANDROID_CHANNEL, sound: "default", ...(m.collapseId ? { tag: m.collapseId.slice(0, 64) } : {}) },
      },
    },
  };
}

/** UNREGISTERED / bad token → delete it; 401/403 → our credentials; anything else retries next event. */
export function classifyFcm(status: number, body: string): Outcome {
  if (status === 200) return "sent";
  if (status === 404 || /UNREGISTERED/.test(body)) return "invalid_token";
  if (status === 400 && /registration token|INVALID_ARGUMENT/i.test(body) && /token/i.test(body)) return "invalid_token";
  if (status === 401 || status === 403) return "auth_error";
  return "error";
}

export async function sendFcm(fetchFn: typeof fetch, creds: FcmCreds, token: string, message: PushMessage): Promise<{ outcome: Outcome; status: number; reason?: string | undefined }> {
  const res = await fetchFn(FCM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.lovableKey}`, "X-Connection-Api-Key": creds.connectionKey, "Content-Type": "application/json" },
    body: JSON.stringify(fcmPayload(token, message)),
  });
  if (res.status === 200) return { outcome: "sent", status: 200 };
  let body = "";
  try { body = await res.text(); } catch { /* empty */ }
  const reason = /"status"\s*:\s*"([A-Z_]+)"/.exec(body)?.[1] ?? /"errorCode"\s*:\s*"([A-Z_]+)"/.exec(body)?.[1];
  return { outcome: classifyFcm(res.status, body), status: res.status, reason: reason ? `fcm:${reason}` : `fcm:${res.status}` };
}
