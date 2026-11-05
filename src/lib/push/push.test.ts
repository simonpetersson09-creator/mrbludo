import { beforeEach, describe, expect, it, vi } from "vitest";
import { apnsHost, apnsPayload, classify, normalizeEnv, providerToken, readApnsCreds, resetProviderTokenCache, sendApns, type ApnsCreds, type ApnsEnv } from "./apns";
import { deliver, type PushDevice, type PushStore } from "./deliver";
import { FCM_URL, readFcmCreds } from "./fcm";
import { isWatching, pushKey, pushTokenInput, safePushPath, turnRecipient } from "./policy";
import { startState } from "@/lib/online/match-logic";
import { isLanguageCode, translateFor } from "@/lib/i18n";
import { adminTestPushAction } from "@/lib/online/online-actions";
import { readFileSync } from "node:fs";

async function testKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const b64 = btoa(String.fromCharCode(...der));
  return { pem: `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`, publicKey: pair.publicKey };
}
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const TOKEN = "a".repeat(64);

describe("APNs configuration", () => {
  it("reads all five secrets and stays off when one is missing", () => {
    const env = { APNS_KEY_ID: "K", APNS_TEAM_ID: "T", APNS_AUTH_KEY: "P", APNS_BUNDLE_ID: "com.simonpetersson.mrbludo", APNS_ENV: "production" };
    expect(readApnsCreds(env)).toMatchObject({ keyId: "K", teamId: "T", bundleId: "com.simonpetersson.mrbludo", env: "production" });
    for (const k of Object.keys(env)) expect(readApnsCreds({ ...env, [k]: undefined })).toBeNull();
  });
  it("uses Apple's sandbox host for development and the live host for production", () => {
    expect(normalizeEnv("development")).toBe("development");
    expect(normalizeEnv("sandbox")).toBe("development");
    expect(normalizeEnv("Production")).toBe("production");
    expect(apnsHost("development")).toBe("https://api.sandbox.push.apple.com");
    expect(apnsHost("production")).toBe("https://api.push.apple.com");
  });
});

describe("APNs authentication", () => {
  beforeEach(() => resetProviderTokenCache());
  it("signs a valid ES256 provider token with key id and team id", async () => {
    const { pem, publicKey } = await testKey();
    for (const authKey of [pem, pem.replace(/\n/g, "\\n")]) {
      const jwt = await providerToken({ keyId: "KEY123", teamId: "F43HQMHCAT", authKey }, 1_700_000_000);
      const [h, p, sig] = jwt.split(".");
      expect(JSON.parse(new TextDecoder().decode(fromB64url(h)))).toEqual({ alg: "ES256", kid: "KEY123" });
      expect(JSON.parse(new TextDecoder().decode(fromB64url(p)))).toEqual({ iss: "F43HQMHCAT", iat: 1_700_000_000 });
      const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, fromB64url(sig), new TextEncoder().encode(`${h}.${p}`));
      expect(ok).toBe(true);
    }
  });
  it("sends a visible alert to the configured bundle id, without background flags", async () => {
    const { pem } = await testKey();
    const creds: ApnsCreds = { keyId: "K", teamId: "T", authKey: pem, bundleId: "com.simonpetersson.mrbludo", env: "production" };
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const r = await sendApns(fetchFn as unknown as typeof fetch, creds, "development", TOKEN, { title: "Mr. B Ludo", body: "Hej", path: "/online" });
    expect(r.outcome).toBe("sent");
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.sandbox.push.apple.com/3/device/${TOKEN}`);
    const h = init.headers as Record<string, string>;
    expect(h["apns-topic"]).toBe("com.simonpetersson.mrbludo");
    expect(h["apns-push-type"]).toBe("alert");
    expect(h["authorization"]).toMatch(/^bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    const body = JSON.parse(String(init.body));
    expect(body.aps["content-available"]).toBeUndefined();
    expect(apnsPayload({ title: "a", body: "b", path: "/friends" })).toEqual({ aps: { alert: { title: "a", body: "b" }, sound: "default" }, path: "/friends" });
  });
  it("classifies Apple's answers", () => {
    expect(classify(200, undefined)).toBe("sent");
    expect(classify(410, "Unregistered")).toBe("invalid_token");
    expect(classify(400, "DeviceTokenNotForTopic")).toBe("invalid_token");
    expect(classify(400, "BadDeviceToken")).toBe("wrong_env");
    expect(classify(403, "InvalidProviderToken")).toBe("auth_error");
    expect(classify(429, "TooManyRequests")).toBe("error");
  });
});

function memoryStore(devices: PushDevice[]) {
  const claimed = new Set<string>();
  const store: PushStore & { devices: PushDevice[] } = {
    devices,
    async tokensFor() { return store.devices; },
    async claim(key) { if (claimed.has(key)) return false; claimed.add(key); return true; },
    async remove(token) { store.devices = store.devices.filter((d) => d.token !== token); },
    async setEnv(token, env) { store.devices = store.devices.map((d) => (d.token === token ? { ...d, environment: env } : d)); },
  };
  return store;
}
/** Fake Apple: knows which tokens exist in which environment. */
function fakeApple(valid: Record<string, ApnsEnv>, gone: string[] = []) {
  return vi.fn(async (url: string) => {
    const token = url.split("/").pop()!;
    const env: ApnsEnv = url.includes("sandbox") ? "development" : "production";
    if (gone.includes(token)) return Response.json({ reason: "Unregistered" }, { status: 410 });
    if (valid[token] !== env) return Response.json({ reason: "BadDeviceToken" }, { status: 400 });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
}

describe("push delivery", () => {
  let creds: ApnsCreds;
  beforeEach(async () => { resetProviderTokenCache(); creds = { keyId: "K", teamId: "T", authKey: (await testKey()).pem, bundleId: "com.simonpetersson.mrbludo", env: "production" }; });
  const msg = (locale: string) => ({ title: "Mr. B Ludo", body: translateFor(locale, "pushTurn"), path: "/online" });

  it("never sends the same event twice", async () => {
    const store = memoryStore([{ token: TOKEN, environment: "production", locale: "sv" }]);
    const apple = fakeApple({ [TOKEN]: "production" });
    expect((await deliver(store, apple, creds, { userId: "u", key: "turn:m:3:u", message: msg })).sent).toBe(1);
    expect((await deliver(store, apple, creds, { userId: "u", key: "turn:m:3:u", message: msg })).duplicate).toBe(true);
    expect(apple).toHaveBeenCalledTimes(1);
  });
  it("finds a development (Xcode) token on the sandbox host and remembers it", async () => {
    const store = memoryStore([{ token: TOKEN, environment: "production", locale: "en" }]);
    const r = await deliver(store, fakeApple({ [TOKEN]: "development" }), creds, { userId: "u", message: msg });
    expect(r.sent).toBe(1);
    expect(store.devices[0].environment).toBe("development");
  });
  it("removes tokens Apple no longer accepts and keeps sending to the others", async () => {
    const good = "b".repeat(64), dead = "c".repeat(64), junk = "d".repeat(64);
    const store = memoryStore([{ token: good, environment: "production", locale: "sv" }, { token: dead, environment: "production", locale: "sv" }, { token: junk, environment: "production", locale: "sv" }]);
    const r = await deliver(store, fakeApple({ [good]: "production" }, [dead]), creds, { userId: "u", message: msg });
    expect(r).toMatchObject({ sent: 1, removed: 2, failed: 0 });
    expect(store.devices.map((d) => d.token)).toEqual([good]);
  });
  it("keeps the token on an Apple auth or server error", async () => {
    const store = memoryStore([{ token: TOKEN, environment: "production", locale: "sv" }]);
    const r = await deliver(store, (async () => Response.json({ reason: "InvalidProviderToken" }, { status: 403 })) as unknown as typeof fetch, creds, { userId: "u", message: msg });
    expect(r).toMatchObject({ sent: 0, failed: 1, removed: 0, reasons: ["InvalidProviderToken"] });
    expect(store.devices).toHaveLength(1);
  });
  it("does nothing for a player without a registered phone", async () => {
    const apple = fakeApple({});
    expect((await deliver(memoryStore([]), apple, creds, { userId: "u", key: "k", message: msg })).devices).toBe(0);
    expect(apple).not.toHaveBeenCalled();
  });
  it("writes the text in the language saved with the phone", () => {
    expect(translateFor("sv", "pushTurn")).toBe("Det är din tur att slå!");
    expect(translateFor("en", "pushInvite", { name: "Ann" })).toBe("Ann is inviting you to a match.");
    expect(translateFor("xx", "pushTurn")).toBe("It's your turn to roll!");
  });
});

describe("who gets notified", () => {
  const s = startState([{ user_id: "alice", seat: 0, display_name: "A" }, { user_id: "bob", seat: 1, display_name: "B" }], 3, "classic");
  it("notifies the human whose turn begins, never bots or the same player rolling again", () => {
    const bobTurn = { ...s, current: 1, turnCount: s.turnCount + 1 };
    expect(turnRecipient(s, bobTurn)).toBe("bob");
    expect(turnRecipient(s, { ...s })).toBeNull();
    const botIdx = s.players.findIndex((p) => p.isBot);
    expect(botIdx).toBeGreaterThan(-1);
    expect(turnRecipient(s, { ...s, current: botIdx, turnCount: s.turnCount + 1 })).toBeNull();
    expect(turnRecipient(s, { ...bobTurn, phase: "finished" })).toBeNull();
    const gaveUp = { ...bobTurn, players: bobTurn.players.map((p, i) => (i === 1 ? { ...p, forfeited: true } : p)) };
    expect(turnRecipient(s, gaveUp)).toBeNull();
  });
  it("skips players who are looking at the match", () => {
    const now = Date.now();
    expect(isWatching(new Date(now - 5_000).toISOString(), now)).toBe(true);
    expect(isWatching(new Date(now - 60_000).toISOString(), now)).toBe(false);
    expect(isWatching(null, now)).toBe(false);
  });
  it("uses one key per event and person", () => {
    expect(pushKey.turn("m", 4, "u")).not.toBe(pushKey.turn("m", 5, "u"));
    expect(pushKey.ready("m", "a")).not.toBe(pushKey.ready("m", "b"));
  });
});

describe("registration and opening", () => {
  it("accepts only hex device tokens and known languages", () => {
    expect(pushTokenInput({ token: TOKEN.toUpperCase(), locale: "da" }, isLanguageCode)).toEqual({ token: TOKEN, locale: "da", platform: "ios" });
    expect(pushTokenInput({ token: TOKEN, locale: "xx" }, isLanguageCode).locale).toBe("sv");
    for (const token of ["", "abc", "z".repeat(64), TOKEN + "; drop"]) expect(() => pushTokenInput({ token }, isLanguageCode)).toThrow("err:bad_action");
  });
  it("only opens app screens from a notification", () => {
    expect(safePushPath("/online/0b6a1f9e-3c2d-4e5f-8a9b-0c1d2e3f4a5b")).toBe("/online/0b6a1f9e-3c2d-4e5f-8a9b-0c1d2e3f4a5b");
    expect(safePushPath("/friends")).toBe("/friends");
    for (const bad of ["https://evil.example", "//evil.example", "/admin", "/online/../admin", 42, undefined]) expect(safePushPath(bad)).toBeNull();
  });
});

describe("security", () => {
  it("only an admin can send a test notification", async () => {
    const context = { userId: "u", supabase: { rpc: vi.fn(async () => ({ data: false })) } } as never;
    await expect(adminTestPushAction({ context })).rejects.toThrow("err:forbidden");
  });
  it("device tokens are server-only: no browser access policy", () => {
    const sql = readFileSync("drizzle/migrations/0009_migration.sql", "utf8");
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/TO (anon|authenticated)/i);
  });
  it("iOS has the push hooks and no background mode", () => {
    expect(readFileSync("ios/App/App/AppDelegate.swift", "utf8")).toContain("capacitorDidRegisterForRemoteNotifications");
    expect(readFileSync("ios/App/App/Info.plist", "utf8")).not.toContain("UIBackgroundModes");
    expect(readFileSync("ios/App/CapApp-SPM/Package.swift", "utf8")).toContain("node_modules/@capacitor/push-notifications");
  });
});

describe("android push (FCM)", () => {
  const FCM_TOKEN = "fAbC123_-:" + "x".repeat(140);
  const fcm = { lovableKey: "L", connectionKey: "C" };
  const msg = () => ({ title: "Mr. B Ludo", body: "Din tur", path: "/online", collapseId: "turn-m" });
  const store = (devices: PushDevice[]) => {
    const s: PushStore & { devices: PushDevice[] } = {
      devices, async tokensFor() { return s.devices; }, async claim() { return true; },
      async remove(t) { s.devices = s.devices.filter((d) => d.token !== t); }, async setEnv() {},
    };
    return s;
  };

  it("accepts FCM tokens as-is for android and still rejects them as iOS tokens", () => {
    expect(pushTokenInput({ token: FCM_TOKEN, platform: "android" }, isLanguageCode)).toEqual({ token: FCM_TOKEN, locale: "sv", platform: "android" });
    expect(() => pushTokenInput({ token: FCM_TOKEN }, isLanguageCode)).toThrow("err:bad_action");
    expect(() => pushTokenInput({ token: "short", platform: "android" }, isLanguageCode)).toThrow("err:bad_action");
  });

  it("sends android devices through the gateway with a visible notification and tap path", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const r = await deliver(store([{ token: FCM_TOKEN, environment: "production", locale: "sv", platform: "android" }]), f, null, { userId: "u", message: msg }, fcm);
    expect(r.sent).toBe(1);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe(FCM_URL);
    const body = JSON.parse(String(init.body));
    expect(body.message.token).toBe(FCM_TOKEN);
    expect(body.message.notification).toEqual({ title: "Mr. B Ludo", body: "Din tur" });
    expect(body.message.data).toEqual({ path: "/online" });
    expect(body.message.android.notification.channel_id).toBe("mrb-ludo");
  });

  it("deletes an unregistered android token", async () => {
    const s = store([{ token: FCM_TOKEN, environment: "production", locale: "sv", platform: "android" }]);
    const f = (async () => new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 })) as unknown as typeof fetch;
    expect((await deliver(s, f, null, { userId: "u", message: msg }, fcm)).removed).toBe(1);
    expect(s.devices).toHaveLength(0);
  });

  it("routes each platform to its own service and skips one without credentials", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const s = store([{ token: FCM_TOKEN, environment: "production", locale: "sv", platform: "android" }, { token: "a".repeat(64), environment: "production", locale: "sv" }]);
    const r = await deliver(s, f, null, { userId: "u", message: msg }, fcm);
    expect(r.devices).toBe(1);
    expect((f as unknown as { mock: { calls: [string][] } }).mock.calls.every(([u]) => u === FCM_URL)).toBe(true);
    expect((await deliver(s, f, null, { userId: "u", message: msg }, null)).devices).toBe(0);
  });

  it("reads Firebase credentials only when both keys exist", () => {
    expect(readFcmCreds({ LOVABLE_API_KEY: "L", FIREBASE_MESSAGING_API_KEY: "C" })).toEqual(fcm);
    expect(readFcmCreds({ LOVABLE_API_KEY: "L" })).toBeNull();
  });
});
