import { ensurePlayerSession } from "@/lib/auth/player";
import { nativeOnlineOrigin } from "./origin";
import type * as Web from "@/lib/online/online.functions";

async function invoke<T>(operation: string, data?: unknown): Promise<T> {
  const origin = nativeOnlineOrigin();
  const session = await ensurePlayerSession();
  const response = await fetch(origin + "/api/public/native", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ operation, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "err:missing");
  return result as T;
}
export const getMe = () => invoke<Awaited<ReturnType<typeof Web.getMe>>>("getMe");
export const updateProfile = (args: Parameters<typeof Web.updateProfile>[0]) => invoke<Awaited<ReturnType<typeof Web.updateProfile>>>("updateProfile", args.data);
export const createMatch = (args: Parameters<typeof Web.createMatch>[0]) => invoke<Awaited<ReturnType<typeof Web.createMatch>>>("createMatch", args.data);
export const joinByCode = (args: Parameters<typeof Web.joinByCode>[0]) => invoke<Awaited<ReturnType<typeof Web.joinByCode>>>("joinByCode", args.data);
export const quickMatch = (args: Parameters<typeof Web.quickMatch>[0]) => invoke<Awaited<ReturnType<typeof Web.quickMatch>>>("quickMatch", args.data);
export const startMatch = (args: Parameters<typeof Web.startMatch>[0]) => invoke<Awaited<ReturnType<typeof Web.startMatch>>>("startMatch", args.data);
export const leaveMatch = (args: Parameters<typeof Web.leaveMatch>[0]) => invoke<Awaited<ReturnType<typeof Web.leaveMatch>>>("leaveMatch", args.data);
export const act = (args: Parameters<typeof Web.act>[0]) => invoke<Awaited<ReturnType<typeof Web.act>>>("act", args.data);
export const heartbeat = (args: Parameters<typeof Web.heartbeat>[0]) => invoke<Awaited<ReturnType<typeof Web.heartbeat>>>("heartbeat", args.data);
export const sendFriendRequest = (args: Parameters<typeof Web.sendFriendRequest>[0]) => invoke<Awaited<ReturnType<typeof Web.sendFriendRequest>>>("sendFriendRequest", args.data);
export const respondFriend = (args: Parameters<typeof Web.respondFriend>[0]) => invoke<Awaited<ReturnType<typeof Web.respondFriend>>>("respondFriend", args.data);
export const listFriends = () => invoke<Awaited<ReturnType<typeof Web.listFriends>>>("listFriends");
export const inviteFriend = (args: Parameters<typeof Web.inviteFriend>[0]) => invoke<Awaited<ReturnType<typeof Web.inviteFriend>>>("inviteFriend", args.data);
export const respondInvite = (args: Parameters<typeof Web.respondInvite>[0]) => invoke<Awaited<ReturnType<typeof Web.respondInvite>>>("respondInvite", args.data);
export const getLeaderboard = (args: Parameters<typeof Web.getLeaderboard>[0]) => invoke<Awaited<ReturnType<typeof Web.getLeaderboard>>>("getLeaderboard", args.data);
export const logEvent = (args: Parameters<typeof Web.logEvent>[0]) => invoke<Awaited<ReturnType<typeof Web.logEvent>>>("logEvent", args.data);
export const adminOverview = () => invoke<Awaited<ReturnType<typeof Web.adminOverview>>>("adminOverview");
export const getMyRanks = () => invoke<Awaited<ReturnType<typeof Web.getMyRanks>>>("getMyRanks");
export const quickFinalize = (args: Parameters<typeof Web.quickFinalize>[0]) => invoke<Awaited<ReturnType<typeof Web.quickFinalize>>>("quickFinalize", args.data);
export const quickStatus = (args: Parameters<typeof Web.quickStatus>[0]) => invoke<Awaited<ReturnType<typeof Web.quickStatus>>>("quickStatus", args.data);
export const setAvatar = (args: Parameters<typeof Web.setAvatar>[0]) => invoke<Awaited<ReturnType<typeof Web.setAvatar>>>("setAvatar", args.data);
export const getAvatars = (args: Parameters<typeof Web.getAvatars>[0]) => invoke<Awaited<ReturnType<typeof Web.getAvatars>>>("getAvatars", args.data);
export const deletePlayerData = (args?: Parameters<typeof Web.deletePlayerData>[0]) => invoke<Awaited<ReturnType<typeof Web.deletePlayerData>>>("deletePlayerData", args?.data ?? {});
