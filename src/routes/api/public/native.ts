import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { allowedNativeOrigin } from "@/lib/native/origin";

function cors(request: Request) {
  const origin = request.headers.get("origin");
  return new Headers({ "Cache-Control": "no-store", "Vary": "Origin", ...(allowedNativeOrigin(origin) && origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } : {}) });
}
export const Route = createFileRoute("/api/public/native")({ server: { handlers: {
  OPTIONS: ({ request }) => new Response(null, { status: allowedNativeOrigin(request.headers.get("origin")) ? 204 : 403, headers: cors(request) }),
  POST: async ({ request }) => {
    const headers = cors(request);
    const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
    const callerOrigin = request.headers.get("origin");
    if (callerOrigin && callerOrigin !== new URL(request.url).origin && !allowedNativeOrigin(callerOrigin)) return reply({ error: "err:forbidden" }, 403);
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return reply({ error: "err:forbidden" }, 401);
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) return reply({ error: "err:missing" }, 503);
    const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error } = await db.auth.getUser(token);
    if (error || !userData.user) return reply({ error: "err:forbidden" }, 401);
    const context = { supabase: db, userId: userData.user.id };
    try {
      const raw = await request.text();
      if (raw.length > 12000) return reply({ error: "err:bad_action" }, 413);
      const body = JSON.parse(raw) as { operation?: unknown; data?: unknown };
      const actions = await import("@/lib/online/online-actions");
      const inputs = await import("@/lib/online/online-inputs");
      switch (body.operation) {
        case "getMe": return reply(await actions.getMeAction({ context }));
        case "updateProfile": return reply(await actions.updateProfileAction({ data: inputs.updateProfileInput(body.data as Parameters<typeof inputs.updateProfileInput>[0]), context }));
        case "createMatch": return reply(await actions.createMatchAction({ data: inputs.createMatchInput(body.data as Parameters<typeof inputs.createMatchInput>[0]), context }));
        case "joinByCode": return reply(await actions.joinByCodeAction({ data: inputs.joinByCodeInput(body.data as Parameters<typeof inputs.joinByCodeInput>[0]), context }));
        case "quickMatch": return reply(await actions.quickMatchAction({ data: inputs.quickMatchInput(body.data as Parameters<typeof inputs.quickMatchInput>[0]), context }));
        case "startMatch": return reply(await actions.startMatchAction({ data: inputs.startMatchInput(body.data as Parameters<typeof inputs.startMatchInput>[0]), context }));
        case "leaveMatch": return reply(await actions.leaveMatchAction({ data: inputs.leaveMatchInput(body.data as Parameters<typeof inputs.leaveMatchInput>[0]), context }));
        case "act": return reply(await actions.actAction({ data: inputs.actInput(body.data as Parameters<typeof inputs.actInput>[0]), context }));
        case "heartbeat": return reply(await actions.heartbeatAction({ data: inputs.heartbeatInput(body.data as Parameters<typeof inputs.heartbeatInput>[0]), context }));
        case "sendFriendRequest": return reply(await actions.sendFriendRequestAction({ data: inputs.sendFriendRequestInput(body.data as Parameters<typeof inputs.sendFriendRequestInput>[0]), context }));
        case "respondFriend": return reply(await actions.respondFriendAction({ data: inputs.respondFriendInput(body.data as Parameters<typeof inputs.respondFriendInput>[0]), context }));
        case "listFriends": return reply(await actions.listFriendsAction({ context }));
        case "inviteFriend": return reply(await actions.inviteFriendAction({ data: inputs.inviteFriendInput(body.data as Parameters<typeof inputs.inviteFriendInput>[0]), context }));
        case "respondInvite": return reply(await actions.respondInviteAction({ data: inputs.respondInviteInput(body.data as Parameters<typeof inputs.respondInviteInput>[0]), context }));
        case "getLeaderboard": return reply(await actions.getLeaderboardAction({ data: inputs.getLeaderboardInput(body.data as Parameters<typeof inputs.getLeaderboardInput>[0]), context }));
        case "logEvent": return reply(await actions.logEventAction({ data: inputs.logEventInput(body.data as Parameters<typeof inputs.logEventInput>[0]), context }));
        case "adminOverview": return reply(await actions.adminOverviewAction({ context }));
        default: return reply({ error: "err:bad_action" }, 400);
      }
    } catch (error) {
      const message = error instanceof Error && /^err:[a-z_]+$/.test(error.message) ? error.message : "err:bad_action";
      return reply({ error: message }, message === "err:forbidden" ? 403 : 400);
    }
  },
} } });
