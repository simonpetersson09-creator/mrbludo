import { updateProfileInput, createMatchInput, joinByCodeInput, quickMatchInput, startMatchInput, leaveMatchInput, actInput, heartbeatInput, sendFriendRequestInput, respondFriendInput, inviteFriendInput, respondInviteInput, getLeaderboardInput, logEventInput, setAvatarInput, getAvatarsInput } from "./online-inputs";
import type { GameState } from "@/lib/ludo/engine";
import {
  BOT_SECONDS, CODE_TTL_MS, DROP_SECONDS, MatchError, TURN_SECONDS, autoStep, codeExpired, makeCode, performAction, secureRoll, startState, statDeltas,
  type Action,
} from "./match-logic";

// The service-role client is only loaded inside handlers, after the caller is authenticated.
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
type Admin = Awaited<ReturnType<typeof admin>>;

async function logEventRow(db: Admin, row: { user_id?: string | null; kind: string; detail?: unknown; device_id?: string | null; platform?: string | null }) {
  await db.from("app_events").insert({ ...row, detail: (row.detail ?? null) as never });
}

async function myProfile(db: Admin, userId: string) {
  const { data } = await db.from("profiles").select("display_name, avatar, country").eq("id", userId).single();
  return data ?? { display_name: "Spelare", avatar: "🎲", country: "SE" };
}

async function freeSeat(db: Admin, matchId: string, max: number): Promise<number | null> {
  const { data } = await db.from("match_players").select("seat").eq("match_id", matchId);
  const taken = new Set((data ?? []).map((r) => r.seat));
  for (let s = 0; s < max; s++) if (!taken.has(s)) return s;
  return null;
}

async function seatUser(db: Admin, matchId: string, max: number, userId: string): Promise<boolean> {
  const { data: existing } = await db.from("match_players").select("seat").eq("match_id", matchId).eq("user_id", userId).maybeSingle();
  if (existing) return true;
  const prof = await myProfile(db, userId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const seat = await freeSeat(db, matchId, max);
    if (seat == null) return false;
    const { error } = await db.from("match_players").insert({ match_id: matchId, user_id: userId, seat, color: seat, ...prof });
    if (!error) return true;
  }
  return false;
}

async function maybeAutostart(db: Admin, matchId: string) {
  const { data: m } = await db.from("matches").select("*").eq("id", matchId).single();
  if (!m || m.status !== "waiting") return;
  const { data: seats } = await db.from("match_players").select("user_id, seat, display_name").eq("match_id", matchId);
  if ((seats?.length ?? 0) >= m.max_players) await doStart(db, m.id, m.version, (seats ?? []), undefined, m.variant);
}

async function doStart(db: Admin, matchId: string, version: number, seats: { user_id: string; seat: number; display_name: string }[], total?: number, variant?: string) {
  const state = startState(seats, total, variant === "fia" ? "fia" : "classic");
  const { data } = await db.from("matches")
    .update({ status: "playing", state: state as never, version: version + 1, turn_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", matchId).eq("version", version).eq("status", "waiting").select("id");
  if (data?.length) await logEventRow(db, { kind: "match_started", detail: { match_id: matchId, players: seats.length } });
}

/** Optimistic-concurrency write: fails with `conflict` if someone else changed the match first. */
async function commit(db: Admin, matchId: string, version: number, prev: GameState, next: GameState) {
  const finished = next.phase === "finished";
  const now = new Date().toISOString();
  const { data, error } = await db.from("matches").update({
    state: next as never, version: version + 1, updated_at: now, turn_started_at: now,
    ...(finished ? { status: "finished", finished_at: now, verified: next.players.length >= 2 } : {}),
  }).eq("id", matchId).eq("version", version).eq("status", "playing").select("id");
  if (error) throw error;
  if (!data?.length) throw new MatchError("conflict");
  const deltas = statDeltas(prev, next);
  // One atomic increment per player in the database, so concurrent matches never overwrite each other.
  for (const [uid, d] of Object.entries(deltas)) {
    const { error: statErr } = await db.rpc("add_player_stats", {
      _uid: uid, _played: d.played, _wins: d.wins, _captures: d.captures, _pieces_home: d.pieces_home, _forfeits: d.forfeits,
    });
    if (statErr) console.error("add_player_stats failed", uid, statErr.message);
  }
  if (next.lastEvent?.kind === "forfeit" && next.lastEvent !== prev.lastEvent)
    await logEventRow(db, { user_id: next.players[next.lastEvent.player].id, kind: "forfeit", detail: { match_id: matchId } });
  if (finished) await logEventRow(db, { kind: "match_finished", detail: { match_id: matchId, winner: next.winner == null ? null : next.players[next.winner]?.id, turns: next.turnCount } });
}

/** Only seated players may poll or drive a match (heartbeat, quick-play status). */
async function isMember(db: Admin, matchId: string, userId: string) {
  const { data } = await db.from("match_players").select("user_id").eq("match_id", matchId).eq("user_id", userId).maybeSingle();
  return !!data;
}

/** Yatzy's invite rules: invites live 6 hours; invites and friend requests are spaced at least 10 seconds apart. */
export const INVITE_TTL_MS = CODE_TTL_MS;
export const SEND_COOLDOWN_MS = 10_000;
async function rateLimit(db: Admin, table: "friendships" | "match_invites", col: "requester" | "from_user", userId: string) {
  const since = new Date(Date.now() - SEND_COOLDOWN_MS).toISOString();
  const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq(col as never, userId as never).gte("created_at", since);
  if ((count ?? 0) > 0) throw new Error("err:rate_limited");
}

function fail(e: unknown): never {
  if (e instanceof MatchError) throw new Error("err:" + e.code);
  throw e;
}

// ---------- Profile ----------


import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export interface OnlineContext { supabase: SupabaseClient<Database>; userId: string }
export const getMeAction = async ({ context }: { context: OnlineContext }) => {
  const { supabase, userId } = context;
  const [{ data: profile }, { data: stats }, { data: isAdmin }] = await Promise.all([
    // Own row incl. private columns (friend code, sign-up time): read with the server client after auth.
    admin().then((db) => db.from("profiles").select("*").eq("id", userId).maybeSingle()),
    supabase.from("player_stats").select("user_id, played, wins, captures, pieces_home, forfeits").eq("user_id", userId).maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId);
  return { userId, profile, stats, isAdmin: !!isAdmin };
};

export const updateProfileAction = async ({ data, context }: { data: ReturnType<typeof updateProfileInput>; context: OnlineContext }) => {
    const { error } = await context.supabase.from("profiles").update(data).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  };

export const createMatchAction = async ({ data, context }: { data: ReturnType<typeof createMatchInput>; context: OnlineContext }) => {
    const db = await admin();
    for (let i = 0; i < 5; i++) {
      const { data: m, error } = await db.from("matches")
        .insert({ code: makeCode(), is_private: data.isPrivate, max_players: data.maxPlayers, variant: data.variant, host_id: context.userId }).select("id, code").single();
      if (!error && m) {
        await seatUser(db, m.id, data.maxPlayers, context.userId);
        return m;
      }
    }
    throw new Error("err:create_failed");
  };

export const joinByCodeAction = async ({ data, context }: { data: ReturnType<typeof joinByCodeInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("id, status, max_players, created_at").eq("code", data.code).maybeSingle();
    if (!m) throw new Error("err:no_match_code");
    const { data: mine } = await db.from("match_players").select("seat").eq("match_id", m.id).eq("user_id", context.userId).maybeSingle();
    if (mine) return { id: m.id };
    if (m.status !== "waiting") throw new Error("err:already_started");
    // A code that has been waiting 6 hours is dead: close the match and say so.
    if (m.created_at == null || codeExpired(m.created_at)) {
      await db.from("matches").update({ status: "abandoned" }).eq("id", m.id);
      throw new Error("err:invite_expired");
    }
    if (!(await seatUser(db, m.id, m.max_players, context.userId))) throw new Error("err:match_full");
    await maybeAutostart(db, m.id);
    return { id: m.id };
  };

/** Quick play: drop seats whose searcher stopped polling (reload/closed app) so nobody is matched with a ghost. */
const QUICK_STALE_MS = 10_000;
async function pruneQuickSeats(db: Admin, matchId: string) {
  const cutoff = new Date(Date.now() - QUICK_STALE_MS).toISOString();
  await db.from("match_players").delete().eq("match_id", matchId).lt("last_seen", cutoff);
  const { data: rest } = await db.from("match_players").select("user_id").eq("match_id", matchId).order("joined_at");
  if (!rest?.length) await db.from("matches").update({ status: "abandoned" }).eq("id", matchId).eq("status", "waiting");
  else await db.from("matches").update({ host_id: rest[0].user_id }).eq("id", matchId).eq("status", "waiting");
  return rest ?? [];
}

export const quickMatchAction = async ({ data, context }: { data: ReturnType<typeof quickMatchInput>; context: OnlineContext }) => {
    const db = await admin();
    // One search at a time per player: a parallel request waits briefly instead of seating the player twice.
    const stale = new Date(Date.now() - 15_000).toISOString();
    await db.from("quick_search_locks").delete().eq("user_id", context.userId).lt("locked_at", stale);
    let locked = false;
    for (let i = 0; i < 20 && !locked; i++) {
      const { error } = await db.from("quick_search_locks").insert({ user_id: context.userId });
      if (!error) locked = true; else await new Promise((r) => setTimeout(r, 250));
    }
    if (!locked) throw new Error("err:conflict");
    try { return await quickMatchInner(db, data, context); }
    finally { await db.from("quick_search_locks").delete().eq("user_id", context.userId); }
  };

async function quickMatchInner(db: Admin, data: ReturnType<typeof quickMatchInput>, context: OnlineContext) {
    // A new search replaces any earlier unfinished search by this player (double tap, reload).
    const { data: mineWaiting } = await db.from("match_players").select("match_id, matches!inner(status, is_private)")
      .eq("user_id", context.userId).eq("matches.status", "waiting").eq("matches.is_private", false);
    for (const r of mineWaiting ?? []) await leaveMatchAction({ data: { matchId: r.match_id }, context });
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: open } = await db.from("matches").select("id, max_players, host_id")
      .eq("status", "waiting").eq("is_private", false).eq("max_players", data.maxPlayers).eq("variant", data.variant)
      .gte("updated_at", since).order("created_at").limit(10);
    for (const m of open ?? []) {
      if (!(await pruneQuickSeats(db, m.id)).length) continue;
      if (await seatUser(db, m.id, m.max_players, context.userId)) {
        await db.from("matches").update({ updated_at: new Date().toISOString() }).eq("id", m.id);
        await maybeAutostart(db, m.id);
        return { id: m.id };
      }
    }
    const { data: m } = await db.from("matches")
      .insert({ code: makeCode(), is_private: false, max_players: data.maxPlayers, variant: data.variant, host_id: context.userId }).select("id").single();
    if (!m) throw new Error("err:create_failed");
    await seatUser(db, m.id, data.maxPlayers, context.userId);
    return { id: m.id };
}

/**
 * Yatzy's finalize step: after the search window, start with the humans found and
 * computer seats for the rest; alone → leave so the client starts a local bot game.
 */
export const quickFinalizeAction = async ({ data, context }: { data: ReturnType<typeof startMatchInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m) return { status: "none" as const };
    const { data: seats } = await db.from("match_players").select("user_id, seat, display_name").eq("match_id", m.id);
    if (!(seats ?? []).some((s) => s.user_id === context.userId)) return { status: "none" as const };
    if (m.status === "playing") return { status: "started" as const };
    if (m.status !== "waiting" || m.is_private) return { status: "none" as const };
    await db.from("match_players").update({ last_seen: new Date().toISOString() }).eq("match_id", m.id).eq("user_id", context.userId);
    const live = new Set((await pruneQuickSeats(db, m.id)).map((r) => r.user_id));
    const liveSeats = (seats ?? []).filter((s) => live.has(s.user_id));
    if (liveSeats.length < 2) {
      await leaveMatchAction({ data: { matchId: m.id }, context });
      return { status: "none" as const };
    }
    await doStart(db, m.id, m.version, liveSeats, m.max_players, m.variant);
    return { status: "started" as const };
  };

export const quickStatusAction = async ({ data, context }: { data: ReturnType<typeof startMatchInput>; context: OnlineContext }) => {
    const db = await admin();
    if (!(await isMember(db, data.matchId, context.userId))) return { status: "abandoned", count: 0, others: [] as string[] };
    await db.from("match_players").update({ last_seen: new Date().toISOString() }).eq("match_id", data.matchId).eq("user_id", context.userId);
    const { data: m } = await db.from("matches").select("status").eq("id", data.matchId).single();
    const { data: seats } = await db.from("match_players").select("user_id, display_name").eq("match_id", data.matchId);
    return {
      status: m?.status ?? "abandoned",
      count: seats?.length ?? 0,
      others: (seats ?? []).filter((s) => s.user_id !== context.userId).map((s) => s.display_name),
    };
  };

export const startMatchAction = async ({ data, context }: { data: ReturnType<typeof startMatchInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m || m.host_id !== context.userId) throw new Error("err:host_only");
    if (m.status !== "waiting") return { ok: true };
    const { data: seats } = await db.from("match_players").select("user_id, seat, display_name").eq("match_id", m.id);
    if ((seats?.length ?? 0) < 2) throw new Error("err:min_players");
    // Empty seats of the chosen size are filled with server-played computers (as in quick play).
    await doStart(db, m.id, m.version, seats ?? [], m.max_players, m.variant);
    return { ok: true };
  };

export const leaveMatchAction = async ({ data, context }: { data: ReturnType<typeof leaveMatchInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m) return { ok: true };
    if (m.status === "waiting") {
      await db.from("match_players").delete().eq("match_id", m.id).eq("user_id", context.userId);
      const { data: rest } = await db.from("match_players").select("user_id").eq("match_id", m.id).order("joined_at");
      if (!rest?.length) await db.from("matches").update({ status: "abandoned" }).eq("id", m.id);
      else if (m.host_id === context.userId) await db.from("matches").update({ host_id: rest[0].user_id }).eq("id", m.id);
      return { ok: true };
    }
    if (m.status === "playing") {
      const prev = m.state as unknown as GameState;
      try {
        const next = performAction(prev, context.userId, { kind: "forfeit" }, secureRoll);
        await commit(db, m.id, m.version, prev, next);
      } catch (e) { fail(e); }
    }
    return { ok: true };
  };

export const actAction = async ({ data, context }: { data: ReturnType<typeof actInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m || m.status !== "playing") throw new Error("err:not_playing");
    if (m.version !== data.version) throw new Error("err:conflict");
    const prev = m.state as unknown as GameState;
    try {
      const next = performAction(prev, context.userId, data.action, secureRoll);
      await commit(db, m.id, m.version, prev, next);
      return { version: m.version + 1, state: next };
    } catch (e) { fail(e); }
  };

export const heartbeatAction = async ({ data, context }: { data: ReturnType<typeof heartbeatInput>; context: OnlineContext }) => {
    const db = await admin();
    const now = Date.now();
    if (!(await isMember(db, data.matchId, context.userId))) throw new Error("err:not_in_match");
    await db.from("match_players").update({ last_seen: new Date(now).toISOString() }).eq("match_id", data.matchId).eq("user_id", context.userId);
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m || m.status !== "playing" || !m.turn_started_at) return { ok: true };
    const state = m.state as unknown as GameState;
    const cur = state.players[state.current];
    if (cur.id === context.userId) return { ok: true };
    const idle = (now - new Date(m.turn_started_at).getTime()) / 1000;
    if (cur.isBot) {
      if (idle < BOT_SECONDS) return { ok: true };
      try { await commit(db, m.id, m.version, state, autoStep(state, secureRoll)); } catch { /* another client advanced it first */ }
      return { ok: true };
    }
    if (idle < TURN_SECONDS) return { ok: true };
    const { data: seat } = await db.from("match_players").select("last_seen").eq("match_id", m.id).eq("user_id", cur.id).single();
    const dropped = !seat || (now - new Date(seat.last_seen).getTime()) / 1000 > DROP_SECONDS;
    const next = dropped ? performAction(state, cur.id, { kind: "forfeit" }, secureRoll) : autoStep(state, secureRoll);
    try { await commit(db, m.id, m.version, state, next); } catch { /* another client advanced it first */ }
    return { ok: true };
  };

export const sendFriendRequestAction = async ({ data, context }: { data: ReturnType<typeof sendFriendRequestInput>; context: OnlineContext }) => {
    const db = await admin();
    if (data.userId === context.userId) throw new Error("err:own_code");
    // Yatzy's rule: only players who sat in the same online match can become friends.
    const { data: seats } = await db.from("match_players").select("user_id").eq("match_id", data.matchId).in("user_id", [context.userId, data.userId]);
    if ((seats ?? []).length !== 2) throw new Error("err:not_in_match");
    const { data: shared } = await db.from("matches").select("status").eq("id", data.matchId).maybeSingle();
    // Allowed from the seat card during play and from the result screen afterwards; never from a waiting room.
    if (shared?.status !== "finished" && shared?.status !== "playing") throw new Error("err:not_in_match");
    await rateLimit(db, "friendships", "requester", context.userId);
    const { data: existing } = await db.from("friendships").select("*")
      .or(`and(requester.eq.${context.userId},addressee.eq.${data.userId}),and(requester.eq.${data.userId},addressee.eq.${context.userId})`).maybeSingle();
    if (existing) {
      // One request per pair; a crossing request simply accepts the other one.
      if (existing.status === "pending" && existing.addressee === context.userId)
        await db.from("friendships").update({ status: "accepted" }).eq("id", existing.id);
      return { ok: true, already: true };
    }
    const { error: insErr } = await db.from("friendships").insert({ requester: context.userId, addressee: data.userId });
    if (insErr) {
      // A crossing request won the race (unique pair index): accept theirs instead of creating a second one.
      await db.from("friendships").update({ status: "accepted" }).eq("requester", data.userId).eq("addressee", context.userId).eq("status", "pending");
      return { ok: true, already: true };
    }
    return { ok: true, already: false };
  };

/** Seat-card popup: another player's total online matches/wins and whether you are already friends. */
export const getPlayerCardAction = async ({ data, context }: { data: ReturnType<typeof sendFriendRequestInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: seats } = await db.from("match_players").select("user_id").eq("match_id", data.matchId).in("user_id", [context.userId, data.userId]);
    if ((seats ?? []).length !== 2) throw new Error("err:not_in_match");
    const [{ data: st }, { data: fr }] = await Promise.all([
      db.from("player_stats").select("played, wins").eq("user_id", data.userId).maybeSingle(),
      db.from("friendships").select("status, requester")
        .or(`and(requester.eq.${context.userId},addressee.eq.${data.userId}),and(requester.eq.${data.userId},addressee.eq.${context.userId})`).maybeSingle(),
    ]);
    const friend = !fr ? "none" : fr.status === "accepted" ? "friends" : fr.requester === context.userId ? "sent" : "incoming";
    return { played: st?.played ?? 0, wins: st?.wins ?? 0, friend: friend as "none" | "friends" | "sent" | "incoming" };
  };

export const respondFriendAction = async ({ data, context }: { data: ReturnType<typeof respondFriendInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: f } = await db.from("friendships").select("*").eq("id", data.id).single();
    if (!f || (f.addressee !== context.userId && f.requester !== context.userId)) throw new Error("err:missing");
    if (data.accept && f.addressee === context.userId) await db.from("friendships").update({ status: "accepted" }).eq("id", f.id);
    else await db.from("friendships").delete().eq("id", f.id);
    return { ok: true };
  };
export const listFriendsAction = async ({ context }: { context: OnlineContext }) => {
  const { supabase, userId } = context;
  const { data: rows } = await supabase.from("friendships").select("*").or(`requester.eq.${userId},addressee.eq.${userId}`);
  const ids = [...new Set((rows ?? []).map((r) => (r.requester === userId ? r.addressee : r.requester)))];
  const { data: profs } = ids.length ? await supabase.from("profiles").select("id, display_name, avatar, country, last_seen").in("id", ids) : { data: [] };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  const { data: invites } = await supabase.from("match_invites").select("id, match_id, from_user, created_at").eq("to_user", userId).eq("status", "pending").gte("created_at", new Date(Date.now() - INVITE_TTL_MS).toISOString()).order("created_at", { ascending: false }).limit(10);
  return {
    friends: (rows ?? []).map((r) => {
      const other = r.requester === userId ? r.addressee : r.requester;
      return { id: r.id, status: r.status, incoming: r.addressee === userId, user: byId.get(other) ?? { id: other, display_name: "?", avatar: "🎲", country: "SE", last_seen: null } };
    }),
    invites: (invites ?? []).map((i) => ({ ...i, from: byId.get(i.from_user) ?? null })),
  };
};

export const inviteFriendAction = async ({ data, context }: { data: ReturnType<typeof inviteFriendInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: f } = await db.from("friendships").select("id").eq("status", "accepted")
      .or(`and(requester.eq.${context.userId},addressee.eq.${data.userId}),and(requester.eq.${data.userId},addressee.eq.${context.userId})`).maybeSingle();
    if (!f) throw new Error("err:not_friends");
    const { data: me } = await db.from("match_players").select("seat").eq("match_id", data.matchId).eq("user_id", context.userId).maybeSingle();
    if (!me) throw new Error("err:not_in_match");
    await rateLimit(db, "match_invites", "from_user", context.userId);
    // One live invite per friend and match: a repeat replaces the old one.
    await db.from("match_invites").delete().eq("match_id", data.matchId).eq("to_user", data.userId).eq("status", "pending");
    await db.from("match_invites").insert({ match_id: data.matchId, from_user: context.userId, to_user: data.userId });
    return { ok: true };
  };

export const respondInviteAction = async ({ data, context }: { data: ReturnType<typeof respondInviteInput>; context: OnlineContext }) => {
    const db = await admin();
    const { data: inv } = await db.from("match_invites").select("*").eq("id", data.id).single();
    if (!inv || inv.to_user !== context.userId || inv.status !== "pending") throw new Error("err:missing");
    if (Date.now() - new Date(inv.created_at).getTime() > INVITE_TTL_MS) {
      await db.from("match_invites").update({ status: "expired" }).eq("id", inv.id);
      throw new Error("err:missing");
    }
    await db.from("match_invites").update({ status: data.accept ? "accepted" : "declined" }).eq("id", inv.id);
    if (!data.accept) return { matchId: null };
    const { data: m } = await db.from("matches").select("id, status, max_players").eq("id", inv.match_id).single();
    if (!m || m.status !== "waiting") throw new Error("err:already_started");
    if (!(await seatUser(db, m.id, m.max_players, context.userId))) throw new Error("err:match_full");
    await maybeAutostart(db, m.id);
    return { matchId: m.id };
  };

export const getLeaderboardAction = async ({ data, context }: { data: ReturnType<typeof getLeaderboardInput>; context: OnlineContext }) => {
    const { data: rows } = await context.supabase.from("player_stats").select("user_id, played, wins, captures, pieces_home, forfeits").gt("played", 0).order(data.sort, { ascending: false }).order("played").limit(50);
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length ? await context.supabase.from("profiles").select("id, display_name, avatar, country").in("id", ids) : { data: [] };
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  };

export const logEventAction = async ({ data, context }: { data: ReturnType<typeof logEventInput>; context: OnlineContext }) => {
    const db = await admin();
    await logEventRow(db, { user_id: context.userId, kind: data.kind, device_id: data.deviceId, platform: data.platform, detail: data.detail });
    return { ok: true };
  };
export const adminOverviewAction = async ({ context }: { context: OnlineContext }) => {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("err:forbidden");
  const db = await admin();
  const day = 86_400_000;
  const now = Date.now();
  const since30 = new Date(now - 30 * day).toISOString();
  const [matches, events, profiles, liveSeats] = await Promise.all([
    db.from("matches").select("status, created_at, finished_at, max_players").gte("created_at", since30).limit(5000),
    db.from("app_events").select("kind, user_id, device_id, platform, detail, created_at").gte("created_at", since30).order("created_at", { ascending: false }).limit(10000),
    db.from("profiles").select("id, created_at, last_seen").limit(10000),
    db.from("match_players").select("user_id, last_seen").gte("last_seen", new Date(now - 2 * 60_000).toISOString()),
  ]);
  const ev = events.data ?? [];
  const days: { date: string; finished: number; started: number; forfeits: number; appDevices: number; webDevices: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day).toISOString().slice(0, 10);
    const dayEv = ev.filter((e) => e.created_at.startsWith(d));
    const devs = (p: (x: string | null) => boolean) => new Set(dayEv.filter((e) => e.kind === "session" && e.device_id && p(e.platform)).map((e) => e.device_id)).size;
    days.push({
      date: d,
      started: dayEv.filter((e) => e.kind === "match_started").length,
      finished: dayEv.filter((e) => e.kind === "match_finished").length,
      forfeits: dayEv.filter((e) => e.kind === "forfeit").length,
      appDevices: devs((x) => x === "ios" || x === "android"),
      webDevices: devs((x) => x === "web"),
    });
  }
  const profs = profiles.data ?? [];
  const retention = (n: number) => {
    const cohort = profs.filter((p) => now - new Date(p.created_at).getTime() > n * day);
    if (!cohort.length) return null;
    const kept = cohort.filter((p) => new Date(p.last_seen).getTime() - new Date(p.created_at).getTime() >= n * day).length;
    return Math.round((kept / cohort.length) * 100);
  };
  const m = matches.data ?? [];
  return {
    totals: {
      players: profs.length,
      activeNow: new Set((liveSeats.data ?? []).map((s) => s.user_id)).size,
      active24h: profs.filter((p) => now - new Date(p.last_seen).getTime() < day).length,
      playing: m.filter((x) => x.status === "playing").length,
      waiting: m.filter((x) => x.status === "waiting").length,
      finished30: m.filter((x) => x.status === "finished").length,
      abandoned30: m.filter((x) => x.status === "abandoned").length,
    },
    retention: { d1: retention(1), d7: retention(7), d30: retention(30) },
    days,
    errors: ev.filter((e) => e.kind === "error").slice(0, 30).map((e) => ({ at: e.created_at, platform: e.platform, detail: e.detail })),
    ads: ev.filter((e) => e.kind === "ad").slice(0, 40).map((e) => ({ at: e.created_at, platform: e.platform, detail: e.detail })),
  };
};

/** All-time numbers + Yatzy-style country/world placement (ranked by completed, non-forfeited verified matches). */
export const getMyRanksAction = async ({ context }: { context: OnlineContext }) => {
  const [{ data: stats }, { data: ranks }] = await Promise.all([
    context.supabase.from("player_stats").select("played, wins, captures, forfeits").eq("user_id", context.userId).maybeSingle(),
    context.supabase.rpc("get_my_ranks"),
  ]);
  const r = (ranks ?? {}) as { found?: boolean; country?: string | null; world_rank?: number | null; country_rank?: number | null };
  return {
    played: Math.max(0, (stats?.played ?? 0) - (stats?.forfeits ?? 0)),
    wins: stats?.wins ?? 0,
    captures: stats?.captures ?? 0,
    country: r.country || null,
    worldRank: r.found ? r.world_rank ?? null : null,
    countryRank: r.found ? r.country_rank ?? null : null,
  };
};

/** Own profile picture. Written with the player's own session (RLS allows only own rows). */
export const setAvatarAction = async ({ data, context }: { data: ReturnType<typeof setAvatarInput>; context: OnlineContext }) => {
    const { error } = await context.supabase.from("profiles").update({ avatar_image: data.image }).eq("id", context.userId);
    if (error) throw new Error("err:bad_image");
    return { ok: true };
  };

/** Pictures for the players a screen is about to show, so list reads stay light. */
export const getAvatarsAction = async ({ data, context }: { data: ReturnType<typeof getAvatarsInput>; context: OnlineContext }) => {
    const { data: rows } = await context.supabase.from("profiles").select("id, avatar_image").in("id", data.userIds);
    const out: Record<string, string | null> = {};
    for (const r of rows ?? []) out[r.id] = r.avatar_image;
    return out;
  };

/** Erase the caller's player identity and personal data (Yatzy's "delete player data"). */
export const deletePlayerDataAction = async ({ context }: { data?: unknown; context: OnlineContext }) => {
    const db = await admin();
    const uid = context.userId;
    const { data: seats } = await db.from("match_players").select("match_id, matches(status)").eq("user_id", uid);
    const active = (seats ?? []).filter((r) => (r.matches as { status?: string } | null)?.status === "playing").map((r) => r.match_id);
    // In a running match the seat stays (the board needs it) but loses the name and is treated as left.
    if (active.length) await db.from("match_players").update({ display_name: "—", avatar: "🎲", left_at: new Date().toISOString() }).eq("user_id", uid).in("match_id", active);
    let seatDelete = db.from("match_players").delete().eq("user_id", uid);
    if (active.length) seatDelete = seatDelete.not("match_id", "in", `(${active.join(",")})`);
    const results = await Promise.all([
      seatDelete,
      db.from("player_stats").delete().eq("user_id", uid),
      db.from("friendships").delete().or(`requester.eq.${uid},addressee.eq.${uid}`),
      db.from("match_invites").delete().or(`from_user.eq.${uid},to_user.eq.${uid}`),
      db.from("app_events").delete().eq("user_id", uid),
    ]);
    if (results.some((r) => r.error)) throw new Error("err:delete_failed");
    const { error } = await db.auth.admin.deleteUser(uid); // removes profile and roles too
    if (error) throw new Error("err:delete_failed");
    return { ok: true };
  };

/** Yatzy's "Veckans flitigaste" and top 10 countries, from verified online matches only. */
export const getStatsBoardsAction = async ({ context }: { context: OnlineContext }) => {
    const [{ data: weekly }, { data: countries }] = await Promise.all([
      context.supabase.rpc("get_weekly_most_active", { _limit: 10 }),
      context.supabase.rpc("get_top_countries", { _limit: 10 }),
    ]);
    return { me: context.userId, weekly: weekly ?? [], countries: countries ?? [] };
  };
