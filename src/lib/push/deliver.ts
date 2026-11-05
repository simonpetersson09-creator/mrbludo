import { otherEnv, sendApns, type ApnsCreds, type ApnsEnv, type PushMessage } from "./apns";
import { sendFcm, type FcmCreds } from "./fcm";

export type PushPlatform = "ios" | "android";
/** `platform` missing = iOS (rows saved before Android existed). */
export interface PushDevice { token: string; environment: ApnsEnv; locale: string; platform?: PushPlatform }
/** Storage the sender needs; the server uses the database, tests use memory. */
export interface PushStore {
  tokensFor(userId: string, pref?: "turns" | "nudges" | "reminders"): Promise<PushDevice[]>;
  /** Records the event key; false when it was already sent (duplicate). */
  claim(key: string, userId: string): Promise<boolean>;
  remove(token: string): Promise<void>;
  setEnv(token: string, env: ApnsEnv): Promise<void>;
}
export interface DeliverResult { devices: number; sent: number; removed: number; failed: number; duplicate: boolean; reasons: string[] }

/** Each device goes to its own service: iPhones to Apple, Android phones to Firebase. A missing service is skipped. */
export async function deliver(
  store: PushStore, fetchFn: typeof fetch, creds: ApnsCreds | null,
  job: { userId: string; key?: string | undefined; pref?: "turns" | "nudges" | "reminders" | undefined; message: (locale: string) => PushMessage },
  fcm: FcmCreds | null = null,
): Promise<DeliverResult> {
  const r: DeliverResult = { devices: 0, sent: 0, removed: 0, failed: 0, duplicate: false, reasons: [] };
  const devices = (await store.tokensFor(job.userId, job.pref)).filter((d) => ((d.platform ?? "ios") === "android" ? !!fcm : !!creds));
  r.devices = devices.length;
  if (!devices.length) return r;
  if (job.key && !(await store.claim(job.key, job.userId))) { r.duplicate = true; return r; }
  for (const d of devices) {
    const msg = job.message(d.locale);
    try {
      let res;
      if ((d.platform ?? "ios") === "android") {
        res = await sendFcm(fetchFn, fcm!, d.token, msg);
      } else {
        res = await sendApns(fetchFn, creds!, d.environment, d.token, msg);
        if (res.outcome === "wrong_env") {
          // A token from an Xcode build only works on the sandbox host and vice versa: try the other once.
          const alt = otherEnv(d.environment);
          res = await sendApns(fetchFn, creds!, alt, d.token, msg);
          if (res.outcome === "sent") await store.setEnv(d.token, alt);
          else if (res.outcome === "wrong_env") res = { ...res, outcome: "invalid_token" as const };
        }
      }
      if (res.outcome === "sent") r.sent++;
      else if (res.outcome === "invalid_token") { await store.remove(d.token); r.removed++; }
      else { r.failed++; r.reasons.push(res.reason ?? String(res.status)); }
    } catch {
      r.failed++; r.reasons.push("network");
    }
  }
  return r;
}
