import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { updateProfileInput, createMatchInput, joinByCodeInput, quickMatchInput, startMatchInput, leaveMatchInput, actInput, heartbeatInput, sendFriendRequestInput, respondFriendInput, inviteFriendInput, respondInviteInput, getLeaderboardInput, logEventInput, setAvatarInput, getAvatarsInput, deleteDataInput } from "./online-inputs";

export const getMe = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { getMeAction } = await import("./online-actions");
  return getMeAction({ context });
});

export const updateProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(updateProfileInput).handler(async ({ data, context }) => {
  const { updateProfileAction } = await import("./online-actions");
  return updateProfileAction({ data, context });
});

export const createMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(createMatchInput).handler(async ({ data, context }) => {
  const { createMatchAction } = await import("./online-actions");
  return createMatchAction({ data, context });
});

export const joinByCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(joinByCodeInput).handler(async ({ data, context }) => {
  const { joinByCodeAction } = await import("./online-actions");
  return joinByCodeAction({ data, context });
});

export const quickMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(quickMatchInput).handler(async ({ data, context }) => {
  const { quickMatchAction } = await import("./online-actions");
  return quickMatchAction({ data, context });
});

export const startMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(startMatchInput).handler(async ({ data, context }) => {
  const { startMatchAction } = await import("./online-actions");
  return startMatchAction({ data, context });
});

export const leaveMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(leaveMatchInput).handler(async ({ data, context }) => {
  const { leaveMatchAction } = await import("./online-actions");
  return leaveMatchAction({ data, context });
});

export const act = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(actInput).handler(async ({ data, context }) => {
  const { actAction } = await import("./online-actions");
  return actAction({ data, context });
});

export const heartbeat = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(heartbeatInput).handler(async ({ data, context }) => {
  const { heartbeatAction } = await import("./online-actions");
  return heartbeatAction({ data, context });
});

export const sendFriendRequest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(sendFriendRequestInput).handler(async ({ data, context }) => {
  const { sendFriendRequestAction } = await import("./online-actions");
  return sendFriendRequestAction({ data, context });
});

export const respondFriend = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(respondFriendInput).handler(async ({ data, context }) => {
  const { respondFriendAction } = await import("./online-actions");
  return respondFriendAction({ data, context });
});

export const listFriends = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { listFriendsAction } = await import("./online-actions");
  return listFriendsAction({ context });
});

export const inviteFriend = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(inviteFriendInput).handler(async ({ data, context }) => {
  const { inviteFriendAction } = await import("./online-actions");
  return inviteFriendAction({ data, context });
});

export const respondInvite = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(respondInviteInput).handler(async ({ data, context }) => {
  const { respondInviteAction } = await import("./online-actions");
  return respondInviteAction({ data, context });
});

export const getLeaderboard = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(getLeaderboardInput).handler(async ({ data, context }) => {
  const { getLeaderboardAction } = await import("./online-actions");
  return getLeaderboardAction({ data, context });
});

export const logEvent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(logEventInput).handler(async ({ data, context }) => {
  const { logEventAction } = await import("./online-actions");
  return logEventAction({ data, context });
});

export const adminOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { adminOverviewAction } = await import("./online-actions");
  return adminOverviewAction({ context });
});

export const getMyRanks = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { getMyRanksAction } = await import("./online-actions");
  return getMyRanksAction({ context });
});

export const quickFinalize = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(startMatchInput).handler(async ({ data, context }) => {
  const { quickFinalizeAction } = await import("./online-actions");
  return quickFinalizeAction({ data, context });
});

export const quickStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(startMatchInput).handler(async ({ data, context }) => {
  const { quickStatusAction } = await import("./online-actions");
  return quickStatusAction({ data, context });
});

export const setAvatar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(setAvatarInput).handler(async ({ data, context }) => {
  const { setAvatarAction } = await import("./online-actions");
  return setAvatarAction({ data, context });
});

export const getAvatars = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(getAvatarsInput).handler(async ({ data, context }) => {
  const { getAvatarsAction } = await import("./online-actions");
  return getAvatarsAction({ data, context });
});

export const deletePlayerData = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(deleteDataInput).handler(async ({ data, context }) => {
  const { deletePlayerDataAction } = await import("./online-actions");
  return deletePlayerDataAction({ data, context });
});

export const getStatsBoards = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { getStatsBoardsAction } = await import("./online-actions");
  return getStatsBoardsAction({ context });
});
