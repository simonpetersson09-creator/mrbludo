import { isVariant, type Variant } from "@/lib/ludo/engine";
import type { Action } from "./match-logic";
export const updateProfileInput = (d: { display_name: string; avatar: string; country: string }) => {
    const name = String(d.display_name ?? "").trim().slice(0, 20);
    if (name.length < 2) throw new Error("err:name_short");
    const country = String(d.country ?? "").toUpperCase();
    if (!isRealCountry(country)) throw new Error("err:invalid_country");
    return { display_name: name, avatar: String(d.avatar ?? "🎲").slice(0, 8), country };
  };
const variantInput = (v: unknown): Variant => (isVariant(v) ? v : "classic");
export const createMatchInput = (d: { isPrivate: boolean; maxPlayers: number; variant?: Variant }) => ({ isPrivate: !!d.isPrivate, maxPlayers: Math.min(4, Math.max(2, Math.round(Number(d.maxPlayers) || 4))), variant: variantInput(d.variant) });
export const joinByCodeInput = (d: { code: string }) => ({ code: String(d.code ?? "").trim().toUpperCase().slice(0, 8) });
export const quickMatchInput = (d: { maxPlayers: number; variant?: Variant }) => ({ maxPlayers: Math.min(4, Math.max(2, Math.round(Number(d.maxPlayers) || 2))), variant: variantInput(d.variant) });
export const startMatchInput = (d: { matchId: string }) => ({ matchId: String(d.matchId) });
export const leaveMatchInput = (d: { matchId: string }) => ({ matchId: String(d.matchId) });
export const actInput = (d: { matchId: string; version: number; action: Action }) => {
    const a = d.action;
    if (!a || !["roll", "move", "forfeit"].includes(a.kind)) throw new Error("err:bad_action");
    const action: Action = a.kind === "move" ? { kind: "move", piece: Math.trunc(Number(a.piece)), ...(a.walkOut === true ? { walkOut: true } : {}) } : { kind: a.kind };
    return { matchId: String(d.matchId), version: Math.trunc(Number(d.version)), action };
  };
export const heartbeatInput = (d: { matchId: string }) => ({ matchId: String(d.matchId) });
// A profile picture is a small square JPEG made on the phone before it is sent.
// Same accepted shape and size limit as Yatzy's server-side avatar check.
const AVATAR_MAX_CHARS = 120000;
export const setAvatarInput = (d: { image: string | null }) => {
    if (d.image == null || d.image === "") return { image: null };
    const img = String(d.image);
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(img)) throw new Error("err:bad_image");
    if (img.length > AVATAR_MAX_CHARS) throw new Error("err:image_too_large");
    return { image: img };
  };
export const getAvatarsInput = (d: { userIds: string[] }) => {
    const ids = [...new Set((Array.isArray(d.userIds) ? d.userIds : []).map((s) => String(s)))].filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
    if (!ids.length) throw new Error("err:missing");
    return { userIds: ids.slice(0, 60) };
  };
// Like Yatzy: a friend request goes to a player you have shared an online match with.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const sendFriendRequestInput = (d: { matchId: string; userId: string }) => {
    const matchId = String(d?.matchId ?? ""), userId = String(d?.userId ?? "");
    if (!UUID.test(matchId) || !UUID.test(userId)) throw new Error("err:missing");
    return { matchId, userId };
  };
export const respondFriendInput = (d: { id: string; accept: boolean }) => ({ id: String(d.id), accept: !!d.accept });
export const inviteFriendInput = (d: { matchId: string; userId: string }) => ({ matchId: String(d.matchId), userId: String(d.userId) });
export const respondInviteInput = (d: { id: string; accept: boolean }) => ({ id: String(d.id), accept: !!d.accept });
export const getLeaderboardInput = (d: { sort: "wins" | "played" | "captures" }) => ({ sort: (["wins", "played", "captures"] as const).includes(d.sort) ? d.sort : "wins" });
export const logEventInput = (d: { kind: string; deviceId?: string; platform?: string; detail?: Record<string, unknown> }) => {
    const kind = ["session", "error", "ad"].includes(d.kind) ? d.kind : "session";
    const platform = ["ios", "android", "web"].includes(String(d.platform)) ? String(d.platform) : "web";
    const detail = JSON.parse(JSON.stringify(d.detail ?? {}).slice(0, 2000) || "{}");
    return { kind, platform, deviceId: String(d.deviceId ?? "").slice(0, 64) || null, detail };
  };
export const deleteDataInput = (_d?: unknown) => ({ confirm: true as const });

/** Only real ISO 3166 region codes (not "XX" or "ZZ") may be stored as a player's country. */
export function isRealCountry(code: string): boolean {
  if (!/^[A-Z]{2}$/.test(code)) return false;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }).of(code);
    return !!name && name !== code && name !== "Unknown Region";
  } catch { return false; }
}
export const adminPinInput = (d: { pin: string }) => {
  const pin = String(d?.pin ?? "").trim();
  if (!/^\d{4,12}$/.test(pin)) throw new Error("err:forbidden");
  return { pin };
};

import { pushTokenInput } from "@/lib/push/policy";
import { isLanguageCode } from "@/lib/i18n";
export const registerPushInput = (d: { token: string; locale?: string }) => pushTokenInput(d, isLanguageCode);
export const unregisterPushInput = (d: { token: string }) => ({ token: pushTokenInput(d, isLanguageCode).token });
