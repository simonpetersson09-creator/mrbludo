import { createServerFn } from "@tanstack/react-start";
import { timed } from "./server-timing";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { updateProfileInput, createMatchInput, joinByCodeInput, quickMatchInput, startMatchInput, leaveMatchInput, actInput, heartbeatInput, sendFriendRequestInput, respondFriendInput, inviteFriendInput, respondInviteInput, getLeaderboardInput, logEventInput, setAvatarInput, getAvatarsInput, deleteDataInput, adminPinInput, registerPushInput, unregisterPushInput, setRemindersInput } from "./online-inputs";

export const getMe = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { getMeAction } = await import("./online-actions");
  return timed("getMe", () => getMeAction({ context }));
});

export const updateProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(updateProfileInput).handler(async ({ data, context }) => {
  const { updateProfileAction } = await import("./online-actions");
  return timed("updateProfile", () => updateProfileAction({ data, context }));
});

export const createMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(createMatchInput).handler(async ({ data, context }) => {
  const { createMatchAction } = await import("./online-actions");
  return timed("createMatch", () => createMatchAction({ data, context }));
});

export const joinByCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(joinByCodeInput).handler(async ({ data, context }) => {
  const { joinByCodeAction } = await import("./online-actions");
  return timed("joinByCode", () => joinByCodeAction({ data, context }));
});

export const quickMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(quickMatchInput).handler(async ({ data, context }) => {
  const { quickMatchAction } = await import("./online-actions");
  return timed("quickMatch", () => quickMatchAction({ data, context }));
});

export const startMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(startMatchInput).handler(async ({ data, context }) => {
  const { startMatchAction } = await import("./online-actions");
  return timed("startMatch", () => startMatchAction({ data, context }));
});

export const leaveMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(leaveMatchInput).handler(async ({ data, context }) => {
  const { leaveMatchAction } = await import("./online-actions");
  return timed("leaveMatch", () => leaveMatchAction({ data, context }));
});

export const act = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(actInput).handler(async ({ data, context }) => {
  const { actAction } = await import("./online-actions");
  return timed("act", () => actAction({ data, context }));
});

export const heartbeat = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(heartbeatInput).handler(async ({ data, context }) => {
  const { heartbeatAction } = await import("./online-actions");
  return timed("heartbeat", () => heartbeatAction({ data, context }));
});

export const sendFriendRequest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(sendFriendRequestInput).handler(async ({ data, context }) => {
  const { sendFriendRequestAction } = await import("./online-actions");
  return timed("sendFriendRequest", () => sendFriendRequestAction({ data, context }));
});

export const getPlayerCard = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(sendFriendRequestInput).handler(async ({ data, context }) => {
  const { getPlayerCardAction } = await import("./online-actions");
  return timed("getPlayerCard", () => getPlayerCardAction({ data, context }));
});

export const respondFriend = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(respondFriendInput).handler(async ({ data, context }) => {
  const { respondFriendAction } = await import("./online-actions");
  return timed("respondFriend", () => respondFriendAction({ data, context }));
});

export const listFriends = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { listFriendsAction } = await import("./online-actions");
  return timed("listFriends", () => listFriendsAction({ context }));
});

export const inviteFriend = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(inviteFriendInput).handler(async ({ data, context }) => {
  const { inviteFriendAction } = await import("./online-actions");
  return timed("inviteFriend", () => inviteFriendAction({ data, context }));
});

export const respondInvite = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(respondInviteInput).handler(async ({ data, context }) => {
  const { respondInviteAction } = await import("./online-actions");
  return timed("respondInvite", () => respondInviteAction({ data, context }));
});

export const getLeaderboard = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(getLeaderboardInput).handler(async ({ data, context }) => {
  const { getLeaderboardAction } = await import("./online-actions");
  return timed("getLeaderboard", () => getLeaderboardAction({ data, context }));
});

export const logEvent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(logEventInput).handler(async ({ data, context }) => {
  const { logEventAction } = await import("./online-actions");
  return timed("logEvent", () => logEventAction({ data, context }));
});

export const adminOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { adminOverviewAction } = await import("./online-actions");
  return timed("adminOverview", () => adminOverviewAction({ context }));
});

export const getMyRanks = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { getMyRanksAction } = await import("./online-actions");
  return timed("getMyRanks", () => getMyRanksAction({ context }));
});

export const quickFinalize = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(startMatchInput).handler(async ({ data, context }) => {
  const { quickFinalizeAction } = await import("./online-actions");
  return timed("quickFinalize", () => quickFinalizeAction({ data, context }));
});

export const quickStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(startMatchInput).handler(async ({ data, context }) => {
  const { quickStatusAction } = await import("./online-actions");
  return timed("quickStatus", () => quickStatusAction({ data, context }));
});

export const setAvatar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(setAvatarInput).handler(async ({ data, context }) => {
  const { setAvatarAction } = await import("./online-actions");
  return timed("setAvatar", () => setAvatarAction({ data, context }));
});

export const getAvatars = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(getAvatarsInput).handler(async ({ data, context }) => {
  const { getAvatarsAction } = await import("./online-actions");
  return timed("getAvatars", () => getAvatarsAction({ data, context }));
});

export const deletePlayerData = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(deleteDataInput).handler(async ({ data, context }) => {
  const { deletePlayerDataAction } = await import("./online-actions");
  return timed("deletePlayerData", () => deletePlayerDataAction({ data, context }));
});

export const getStatsBoards = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { getStatsBoardsAction } = await import("./online-actions");
  return timed("getStatsBoards", () => getStatsBoardsAction({ context }));
});

export const adminPinLogin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(adminPinInput).handler(async ({ data, context }) => {
  const { adminPinLoginAction } = await import("./online-actions");
  return timed("adminPinLogin", () => adminPinLoginAction({ data, context }));
});

export const registerPushToken = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(registerPushInput).handler(async ({ data, context }) => {
  const { registerPushTokenAction } = await import("./online-actions");
  return timed("registerPushToken", () => registerPushTokenAction({ data, context }));
});

export const unregisterPushToken = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(unregisterPushInput).handler(async ({ data, context }) => {
  const { unregisterPushTokenAction } = await import("./online-actions");
  return timed("unregisterPushToken", () => unregisterPushTokenAction({ data, context }));
});

export const adminTestPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { adminTestPushAction } = await import("./online-actions");
  return timed("adminTestPush", () => adminTestPushAction({ context }));
});

export const lobbyNotices = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { lobbyNoticesAction } = await import("./online-actions");
  return timed("lobbyNotices", () => lobbyNoticesAction({ context }));
});

export const sentInvites = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(startMatchInput).handler(async ({ data, context }) => {
  const { sentInvitesAction } = await import("./online-actions");
  return timed("sentInvites", () => sentInvitesAction({ data, context }));
});

export const setReminders = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(setRemindersInput).handler(async ({ data, context }) => {
  const { setRemindersAction } = await import("./online-actions");
  return timed("setReminders", () => setRemindersAction({ data, context }));
});
