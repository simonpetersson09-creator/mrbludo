import { updateProfileInput, createMatchInput, joinByCodeInput, quickMatchInput, startMatchInput, leaveMatchInput, actInput, heartbeatInput, sendFriendRequestInput, respondFriendInput, inviteFriendInput, respondInviteInput, getLeaderboardInput, logEventInput, setAvatarInput, getAvatarsInput } from "./online-inputs";
import type { GameState } from "@/lib/ludo/engine";
import {
  BOT_SECONDS, CODE_TTL_MS, MatchError, autoStep, codeExpired, makeCode, giveUpState, performAction, secureRoll, startState, statDeltas, tickDecision,
  type Action,
} from "./match-logic";

// The service-role client is only loaded inside handlers, after the caller is authenticated.
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
type Admin = Awaited<ReturnType<typeof admin>>;

// ---------- Push notifications (iOS, visible alerts only) ----------
type PushJob = import("@/lib/push/push-server").NotifyJob;
async function push(db: Admin, job: PushJob) {
  try { const { notify } = await import("@/lib/push/push-server"); await notify(db, job); }
  catch (e) { console.error("push skipped", job.kind, e instanceof Error ? e.message : "unknown"); }
}
/** Notifies only players who are not looking at the match right now. */
async function pushIfAway(db: Admin, matchId: string, userIds: string[], job: (uid: string) => PushJob) {
  const humans = userIds.filter((u) => !u.startsWith("bot:"));
  if (!humans.length) return;
  const { isWatching } = await import("@/lib/push/policy");
  const { data } = await db.from("match_players").select("user_id, last_seen, left_at").eq("match_id", matchId).in("user_id", humans);
  const now = Date.now();
  await Promise.all((data ?? []).filter((r) => !r.left_at && !isWatching(r.last_seen, now)).map((r) => push(db, job(r.user_id))));
}

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
  // The database starts the match only if the seats are exactly these at that instant; otherwise re-read and retry.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (seats.length < 1) return;
    const state = startState(seats, total, variant === "fia" ? "fia" : "classic");
    const { data: res, error } = await db.rpc("start_match", { _id: matchId, _version: version, _state: state as never, _user_ids: seats.map((s) => s.user_id) });
    if (error) throw error;
    if (res === "ok") {
      await logEventRow(db, { kind: "match_started", detail: { match_id: matchId, players: seats.length } });
      const { pushKey } = await import("@/lib/push/policy");
      await pushIfAway(db, matchId, seats.map((s) => s.user_id), (uid) => ({ kind: "ready", userId: uid, key: pushKey.ready(matchId, uid), path: `/online/${matchId}`, collapseId: `m:${matchId}` }));
      return;
    }
    if (res !== "changed") return;
    const [{ data: m }, { data: fresh }] = await Promise.all([
      db.from("matches").select("version, status").eq("id", matchId).single(),
      db.from("match_players").select("user_id, seat, display_name").eq("match_id", matchId),
    ]);
    if (!m || m.status !== "waiting") return;
    version = m.version; seats = fresh ?? [];
    if (total == null && seats.length < 2) return;
  }
}

/** Optimistic-concurrency write: fails with `conflict` if someone else changed the match first. */
async function commit(db: Admin, matchId: string, version: number, prev: GameState, next: GameState) {
  const finished = next.phase === "finished";
  const now = new Date().toISOString();
  // Match state and every stat increment are written in one database transaction: all or nothing.
  const { data: ok, error } = await db.rpc("commit_match", {
    _id: matchId, _version: version, _state: next as never, _finished: finished,
    _verified: next.players.length >= 2, _deltas: statDeltas(prev, next) as never,
  });
  if (error) throw error;
  if (!ok) throw new MatchError("conflict");
  void now;
  if (next.lastEvent?.kind === "forfeit" && next.lastEvent !== prev.lastEvent)
    await logEventRow(db, { user_id: next.players[next.lastEvent.player].id, kind: "forfeit", detail: { match_id: matchId } });
  if (finished) await logEventRow(db, { kind: "match_finished", detail: { match_id: matchId, winner: next.winner == null ? null : next.players[next.winner]?.id, turns: next.turnCount } });
  const { turnRecipient, pushKey } = await import("@/lib/push/policy");
  const turnOf = turnRecipient(prev, next);
  if (turnOf) await pushIfAway(db, matchId, [turnOf], (uid) => ({ kind: "turn", userId: uid, key: pushKey.turn(matchId, next.turnCount, uid), path: `/online/${matchId}`, collapseId: `m:${matchId}` }));
}

/** Only seated players may poll or drive a match (heartbeat, quick-play status). */
async function isMember(db: Admin, matchId: string, userId: string) {
  const { data } = await db.from("match_players").select("user_id").eq("match_id", matchId).eq("user_id", userId).maybeSingle();
  return !!data;
}

/** Yatzy's invite rules: invites live 6 hours; invites and friend requests are spaced at least 10 seconds apart. */
export const INVITE_TTL_MS = CODE_TTL_MS;
export const SEND_COOLDOWN_MS = 10_000;
async function rateLimit(db: Admin, table: "friendships" | "match_invites", _col: "requester" | "from_user", userId: string) {
  // Atomic counter in the database; a database error blocks the send instead of letting it through.
  const { data: ok, error } = await db.rpc("rate_hit", { _key: `${table}:${userId}`, _max: 1, _window_seconds: SEND_COOLDOWN_MS / 1000 });
  if (error || ok !== true) throw new Error("err:rate_limited");
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
    // Private code lobby: nothing starts by itself — only the host's start button does.
    return { id: m.id };
  };

/** Quick play: only searches active within the last 6 seconds count; older seats are dropped as ghosts. */
const QUICK_STALE_MS = 6_000;
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
    // Private matches are humans only: exactly the seated players, never computer seats.
    await doStart(db, m.id, m.version, seats ?? [], undefined, m.variant);
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
        const next = giveUpState(prev, context.userId, m.is_private);
        await commit(db, m.id, m.version, prev, next);
        // The leaver's seat is closed either way: no more pushes, and "everyone gone" cleanup can see it.
        await db.from("match_players").update({ left_at: new Date().toISOString() }).eq("match_id", m.id).eq("user_id", context.userId);
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
    if (m) await tickMatch(db, m, now);
    return { ok: true };
  };

type MatchRow = { id: string; status: string; version: number; state: unknown; turn_started_at: string | null; is_private: boolean };
/**
 * Server-side turn clock (quick play only): computers move after BOT_SECONDS; an idle human's step
 * is played after TURN_SECONDS — never a forfeit, a temporary disconnect just lets the computer
 * play until the player returns. Private matches are never touched: they pause and wait.
 * Runs from any heartbeat and from the scheduled maintenance tick, so no opponent needs to be connected.
 */
export async function tickMatch(db: Admin, m: MatchRow, now = Date.now()): Promise<boolean> {
  if (m.status !== "playing" || !m.turn_started_at) return false;
  const state = m.state as GameState;
  const idle = (now - new Date(m.turn_started_at).getTime()) / 1000;
  if (tickDecision(state, m.is_private, idle) !== "auto") return false;
  const next = autoStep(state, secureRoll);
  try { await commit(db, m.id, m.version, state, next); return true; } catch { return false; /* someone advanced it first */ }
}

/** Scheduled job: close dead matches, then advance idle turns in every running quick match. */
export async function runMaintenance() {
  const db = await admin();
  const { data: cleaned } = await db.rpc("cleanup_stale_matches");
  const { data: rows } = await db.from("matches").select("id, status, version, state, turn_started_at, is_private").eq("status", "playing").eq("is_private", false)
    .order("turn_started_at", { ascending: true }).lt("turn_started_at", new Date(Date.now() - BOT_SECONDS * 1000).toISOString()).limit(200);
  let advanced = 0;
  for (const m of rows ?? []) if (await tickMatch(db, m)) advanced++;
  return { cleaned, advanced };
}

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
    const { data: created, error: insErr } = await db.from("friendships").insert({ requester: context.userId, addressee: data.userId }).select("id").single();
    if (!insErr && created) {
      const { pushKey } = await import("@/lib/push/policy");
      const me = await myProfile(db, context.userId);
      await push(db, { kind: "friend", userId: data.userId, key: pushKey.friend(created.id), path: "/friends", name: me.display_name });
    }
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
    else {
      await db.from("friendships").delete().eq("id", f.id);
      // No friendship, no invites: pending invites between the two are withdrawn.
      await db.from("match_invites").delete().eq("status", "pending")
        .or(`and(from_user.eq.${f.requester},to_user.eq.${f.addressee}),and(from_user.eq.${f.addressee},to_user.eq.${f.requester})`);
    }
    return { ok: true };
  };
/** Finished online matches this player shared with each friend: played together, won, lost (Yatzy's "inbördes möten"). */
export async function headToHead(db: Admin, userId: string, others: string[]) {
  const out: Record<string, { played: number; won: number; lost: number }> = {};
  if (!others.length) return out;
  const { data: mine } = await db.from("match_players").select("match_id").eq("user_id", userId).limit(1000);
  const ids = [...new Set((mine ?? []).map((r) => r.match_id))];
  const pairs: { match_id: string; user_id: string }[] = [];
  const done: { id: string; state: unknown }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [{ data: p }, { data: m }] = await Promise.all([
      db.from("match_players").select("match_id, user_id").in("match_id", chunk).in("user_id", others),
      db.from("matches").select("id, state").in("id", chunk).eq("status", "finished"),
    ]);
    pairs.push(...(p ?? [])); done.push(...(m ?? []));
  }
  const winnerOf = new Map(done.map((m) => {
    const st = m.state as { winner?: number | null; players?: { id: string }[] } | null;
    return [m.id, st && st.winner != null ? st.players?.[st.winner]?.id ?? null : null] as const;
  }));
  for (const p of pairs) {
    if (!winnerOf.has(p.match_id)) continue; // not finished
    const r = (out[p.user_id] ??= { played: 0, won: 0, lost: 0 });
    r.played++;
    const w = winnerOf.get(p.match_id);
    if (w === userId) r.won++; else if (w === p.user_id) r.lost++;
  }
  return out;
}

export const listFriendsAction = async ({ context }: { context: OnlineContext }) => {
  const { supabase, userId } = context;
  const { data: rows } = await supabase.from("friendships").select("*").or(`requester.eq.${userId},addressee.eq.${userId}`);
  const ids = [...new Set((rows ?? []).map((r) => (r.requester === userId ? r.addressee : r.requester)))];
  // last_seen is not readable by other players directly; it is shown only to friends, read here on the server.
  const { data: profs } = ids.length ? await (await admin()).from("profiles").select("id, display_name, avatar, country, last_seen").in("id", ids) : { data: [] };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  const friendIds = (rows ?? []).filter((r) => r.status === "accepted").map((r) => (r.requester === userId ? r.addressee : r.requester));
  const h2h = await headToHead(await admin(), userId, friendIds).catch(() => ({} as Awaited<ReturnType<typeof headToHead>>));
  const { data: invites } = await supabase.from("match_invites").select("id, match_id, from_user, created_at").eq("to_user", userId).eq("status", "pending").gte("created_at", new Date(Date.now() - INVITE_TTL_MS).toISOString()).order("created_at", { ascending: false }).limit(10);
  return {
    friends: (rows ?? []).map((r) => {
      const other = r.requester === userId ? r.addressee : r.requester;
      return { id: r.id, status: r.status, incoming: r.addressee === userId, h2h: r.status === "accepted" ? h2h[other] ?? null : null, user: byId.get(other) ?? { id: other, display_name: "?", avatar: "🎲", country: "SE", last_seen: null } };
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
    const { data: target } = await db.from("matches").select("status").eq("id", data.matchId).maybeSingle();
    if (target?.status !== "waiting") throw new Error("err:already_started");
    await rateLimit(db, "match_invites", "from_user", context.userId);
    // One live invite per friend and match: a repeat replaces the old one.
    await db.from("match_invites").delete().eq("match_id", data.matchId).eq("to_user", data.userId).eq("status", "pending");
    const { data: inv } = await db.from("match_invites").insert({ match_id: data.matchId, from_user: context.userId, to_user: data.userId }).select("id").single();
    if (inv) {
      const { pushKey } = await import("@/lib/push/policy");
      const me = await myProfile(db, context.userId);
      await push(db, { kind: "invite", userId: data.userId, key: pushKey.invite(inv.id), path: "/online", name: me.display_name });
    }
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
    if (!data.accept) {
      await db.from("match_invites").update({ status: "declined" }).eq("id", inv.id);
      return { matchId: null };
    }
    const { data: still } = await db.from("friendships").select("id").eq("status", "accepted")
      .or(`and(requester.eq.${inv.from_user},addressee.eq.${context.userId}),and(requester.eq.${context.userId},addressee.eq.${inv.from_user})`).maybeSingle();
    const { data: m } = await db.from("matches").select("*").eq("id", inv.match_id).single();
    if (!still || !m || m.status !== "waiting") {
      await db.from("match_invites").update({ status: "expired" }).eq("id", inv.id);
      throw new Error(!still ? "err:not_friends" : "err:already_started");
    }
    if (!(await seatUser(db, m.id, m.max_players, context.userId))) throw new Error("err:match_full");
    await db.from("match_invites").update({ status: "accepted" }).eq("id", inv.id);
    // An accepted friend invite starts the match at once — no start button, no computer seats.
    const { data: seats } = await db.from("match_players").select("user_id, seat, display_name").eq("match_id", m.id);
    if ((seats?.length ?? 0) >= 2) await doStart(db, m.id, m.version, seats ?? [], undefined, m.variant);
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
  const days: { date: string; finished: number; started: number; forfeits: number; appDevices: number; webDevices: number; appSessions: number; avgMinutes: number | null }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day).toISOString().slice(0, 10);
    const dayEv = ev.filter((e) => e.created_at.startsWith(d));
    const devs = (p: (x: string | null) => boolean) => new Set(dayEv.filter((e) => e.kind === "session" && e.device_id && p(e.platform)).map((e) => e.device_id)).size;
    const visits = dayEv.filter((e) => e.kind === "session_end" && (e.platform === "ios" || e.platform === "android"))
      .map((e) => Number((e.detail as { seconds?: number } | null)?.seconds) || 0).filter((x) => x > 0);
    days.push({
      date: d,
      appSessions: visits.length,
      avgMinutes: visits.length ? Math.round((visits.reduce((a, b) => a + b, 0) / visits.length / 60) * 10) / 10 : null,
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
    const db = await admin();
    const me = context.userId;
    // Pictures are shown only to yourself, friends and players you have shared an online match with.
    const [{ data: fr }, { data: myMatches }] = await Promise.all([
      db.from("friendships").select("requester, addressee").or(`requester.eq.${me},addressee.eq.${me}`),
      db.from("match_players").select("match_id").eq("user_id", me).order("joined_at", { ascending: false }).limit(200),
    ]);
    const allowed = new Set<string>([me]);
    for (const f of fr ?? []) allowed.add(f.requester === me ? f.addressee : f.requester);
    const want = data.userIds.filter((id) => !allowed.has(id));
    const matchIds = (myMatches ?? []).map((r) => r.match_id);
    if (want.length && matchIds.length) {
      const { data: shared } = await db.from("match_players").select("user_id").in("match_id", matchIds).in("user_id", want);
      for (const r of shared ?? []) allowed.add(r.user_id);
    }
    const ids = data.userIds.filter((id) => allowed.has(id));
    const { data: rows } = ids.length ? await db.from("profiles").select("id, avatar_image").in("id", ids) : { data: [] };
    const out: Record<string, string | null> = {};
    for (const r of rows ?? []) out[r.id] = r.avatar_image;
    return out;
  };

/** Erase the caller's player identity and personal data (Yatzy's "delete player data"). */
export const deletePlayerDataAction = async ({ context }: { data?: unknown; context: OnlineContext }) => {
    const db = await admin();
    const uid = context.userId;
    // Running matches: forfeit first, so the board goes on without this player.
    const { data: seats } = await db.from("match_players").select("match_id, matches(status)").eq("user_id", uid);
    const active = (seats ?? []).filter((r) => (r.matches as { status?: string } | null)?.status === "playing").map((r) => r.match_id);
    for (const id of active) {
      for (let i = 0; i < 3; i++) {
        const { data: m } = await db.from("matches").select("version, status, state").eq("id", id).single();
        if (!m || m.status !== "playing") break;
        const prev = m.state as unknown as GameState;
        const p = prev.players.find((x) => x.id === uid);
        if (!p || p.forfeited) break;
        try { await commit(db, id, m.version, prev, performAction(prev, uid, { kind: "forfeit" }, secureRoll)); break; } catch { /* retry on conflict */ }
      }
    }
    // Every saved match (seats, board state, host, event log) loses the id and name for good.
    const { error: scrubErr } = await db.rpc("scrub_player", { _uid: uid });
    if (scrubErr) throw new Error("err:delete_failed");
    const results = await Promise.all([
      db.from("player_stats").delete().eq("user_id", uid),
      db.from("friendships").delete().or(`requester.eq.${uid},addressee.eq.${uid}`),
      db.from("match_invites").delete().or(`from_user.eq.${uid},to_user.eq.${uid}`),
      db.from("app_events").delete().eq("user_id", uid),
      db.from("push_tokens").delete().eq("user_id", uid),
      db.from("push_sent").delete().eq("user_id", uid),
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

async function sha256(s: string) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
/** Constant-time comparison of the two hashes, so timing reveals nothing about the PIN. */
export async function pinMatches(input: string, expected: string) {
  const [a, b] = await Promise.all([sha256(input), sha256(expected)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export const PIN_LIMITS = { perUser: 5, perIp: 10, windowSeconds: 15 * 60, global: 300, globalWindowSeconds: 3600 };
async function callerIp(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const raw = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0];
    const ip = raw?.trim();
    return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
  } catch { return null; }
}
/** Owner-only admin access: the right PIN (server secret ADMIN_PIN) makes the caller's own player identity an admin. Failed tries are limited per player and in total. */
export const adminPinLoginAction = async ({ data, context }: { data: { pin: string }; context: OnlineContext }) => {
  const expected = process.env['ADMIN_PIN'];
  if (!expected) throw new Error("err:forbidden");
  const db = await admin();
  const ip = await callerIp();
  // Atomic counters that survive deleting player data (keyed by network address as well as identity).
  // A global ceiling exists only against mass attacks; it is high enough that ordinary noise cannot lock the owner out.
  const keys = [
    { key: `pin:user:${context.userId}`, max: PIN_LIMITS.perUser, win: PIN_LIMITS.windowSeconds },
    ...(ip ? [{ key: `pin:ip:${ip}`, max: PIN_LIMITS.perIp, win: PIN_LIMITS.windowSeconds }] : []),
    { key: "pin:all", max: PIN_LIMITS.global, win: PIN_LIMITS.globalWindowSeconds },
  ];
  // Every attempt is counted atomically BEFORE the PIN is compared, so simultaneous requests cannot
  // get more guesses than the limit (a peek-then-count check let every parallel request through).
  const hits = await Promise.all(keys.map((k) => db.rpc("rate_hit", { _key: k.key, _max: k.max, _window_seconds: k.win })));
  if (hits.some((r) => r.error || r.data !== true)) throw new Error("err:rate_limited");
  if (!(await pinMatches(data.pin, expected))) {
    await logEventRow(db, { user_id: context.userId, kind: "admin_pin_fail" });
    throw new Error("err:forbidden");
  }
  const { data: has } = await db.from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (!has) {
    const { error } = await db.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error("err:forbidden");
  }
  return { ok: true };
};

/** Saves this phone's push address for the caller. A token always belongs to the latest player who registered it. */
export const registerPushTokenAction = async ({ data, context }: { data: { token: string; locale: string }; context: OnlineContext }) => {
  const db = await admin();
  const { defaultEnv } = await import("@/lib/push/push-server");
  const { data: existing } = await db.from("push_tokens").select("environment").eq("token", data.token).maybeSingle();
  const { error } = await db.from("push_tokens").upsert({
    token: data.token, user_id: context.userId, platform: "ios", locale: data.locale,
    environment: existing?.environment ?? defaultEnv(), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("err:bad_action");
  return { ok: true };
};

/** Removes the push address, only if it belongs to the caller. */
export const unregisterPushTokenAction = async ({ data, context }: { data: { token: string }; context: OnlineContext }) => {
  const db = await admin();
  await db.from("push_tokens").delete().eq("token", data.token).eq("user_id", context.userId);
  return { ok: true };
};

/** Admin only: a test notification to the caller's own devices, with Apple's answer summarised. */
export const adminTestPushAction = async ({ context }: { context: OnlineContext }) => {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("err:forbidden");
  const db = await admin();
  const { notify } = await import("@/lib/push/push-server");
  const r = await notify(db, { kind: "test", userId: context.userId, path: "/online" });
  if (!r) return { configured: false, devices: 0, sent: 0, removed: 0, failed: 0, reasons: [] as string[] };
  return { configured: true, devices: r.devices, sent: r.sent, removed: r.removed, failed: r.failed, reasons: r.reasons.slice(0, 5) };
};
