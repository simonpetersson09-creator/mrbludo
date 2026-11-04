/**
 * Apple Push Notification service (APNs) client: token-based (.p8) auth over WebCrypto,
 * so it runs on the Worker runtime. Pure apart from the injected fetch.
 */
export type ApnsEnv = "development" | "production";
export interface ApnsCreds { keyId: string; teamId: string; authKey: string; bundleId: string; env: ApnsEnv }

export const apnsHost = (env: ApnsEnv) => (env === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com");
export const otherEnv = (env: ApnsEnv): ApnsEnv => (env === "production" ? "development" : "production");
/** APNS_ENV accepts "production"/"prod" or "development"/"sandbox"/"dev". */
export const normalizeEnv = (raw: string | undefined): ApnsEnv => (/^\s*prod/i.test(raw ?? "") ? "production" : "development");

/** Reads the five APNs secrets; null when any is missing so sending silently stays off. */
export function readApnsCreds(env: Record<string, string | undefined>): ApnsCreds | null {
  const keyId = env["APNS_KEY_ID"]?.trim(), teamId = env["APNS_TEAM_ID"]?.trim(), authKey = env["APNS_AUTH_KEY"], bundleId = env["APNS_BUNDLE_ID"]?.trim();
  if (!keyId || !teamId || !authKey || !bundleId || !env["APNS_ENV"]) return null;
  return { keyId, teamId, authKey, bundleId, env: normalizeEnv(env["APNS_ENV"]) };
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const textB64url = (s: string) => b64url(new TextEncoder().encode(s));

/** Accepts the .p8 file as pasted: with or without PEM lines, real or escaped newlines. */
export function p8ToDer(p8: string): Uint8Array {
  const body = p8.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** ES256 provider token. WebCrypto returns the raw r||s signature JWS expects. */
export async function providerToken(creds: Pick<ApnsCreds, "keyId" | "teamId" | "authKey">, nowSec: number): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", p8ToDer(creds.authKey) as BufferSource, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const input = `${textB64url(JSON.stringify({ alg: "ES256", kid: creds.keyId }))}.${textB64url(JSON.stringify({ iss: creds.teamId, iat: nowSec }))}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input)));
  return `${input}.${b64url(sig)}`;
}

// Apple allows reusing a provider token for up to an hour and throttles frequent refreshes.
let cached: { token: string; at: number; keyId: string } | null = null;
export async function cachedProviderToken(creds: ApnsCreds, nowMs = Date.now()) {
  if (cached && cached.keyId === creds.keyId && nowMs - cached.at < 45 * 60_000) return cached.token;
  const token = await providerToken(creds, Math.floor(nowMs / 1000));
  cached = { token, at: nowMs, keyId: creds.keyId };
  return token;
}
export const resetProviderTokenCache = () => { cached = null; };

export interface PushMessage { title: string; body: string; path: string; collapseId?: string | undefined }
export function apnsPayload(m: PushMessage) {
  // Visible alert only: no content-available, so no background mode is needed.
  return { aps: { alert: { title: m.title, body: m.body }, sound: "default" }, path: m.path };
}

export type Outcome = "sent" | "wrong_env" | "invalid_token" | "auth_error" | "error";
/** Maps Apple's reply. BadDeviceToken can also mean the token belongs to the other environment. */
export function classify(status: number, reason: string | undefined): Outcome {
  if (status === 200) return "sent";
  if (status === 410 || reason === "Unregistered" || reason === "DeviceTokenNotForTopic") return "invalid_token";
  if (reason === "BadDeviceToken") return "wrong_env";
  if (status === 403 || reason === "InvalidProviderToken" || reason === "ExpiredProviderToken" || reason === "MissingProviderToken") return "auth_error";
  return "error";
}

export async function sendApns(
  fetchFn: typeof fetch, creds: ApnsCreds, env: ApnsEnv, token: string, message: PushMessage, nowMs = Date.now(),
): Promise<{ outcome: Outcome; status: number; reason?: string | undefined }> {
  const jwt = await cachedProviderToken(creds, nowMs);
  const res = await fetchFn(`${apnsHost(env)}/3/device/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`, "apns-topic": creds.bundleId, "apns-push-type": "alert", "apns-priority": "10",
      "apns-expiration": String(Math.floor(nowMs / 1000) + 3600), "content-type": "application/json",
      ...(message.collapseId ? { "apns-collapse-id": message.collapseId.slice(0, 64) } : {}),
    },
    body: JSON.stringify(apnsPayload(message)),
  });
  let reason: string | undefined;
  if (res.status !== 200) { try { reason = ((await res.json()) as { reason?: string }).reason; } catch { /* empty body */ } }
  return { outcome: classify(res.status, reason), status: res.status, reason };
}
