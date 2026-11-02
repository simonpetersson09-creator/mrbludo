import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GameState } from "@/lib/ludo/engine";
import {
  DROP_SECONDS, MatchError, TURN_SECONDS, autoStep, makeCode, performAction, secureRoll, startState, statDeltas,
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
  if ((seats?.length ?? 0) >= m.max_players) await doStart(db, m.id, m.version, seats!);
}

async function doStart(db: Admin, matchId: string, version: number, seats: { user_id: string; seat: number; display_name: string }[]) {
  const state = startState(seats);
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
  if (!data?.length) throw new MatchError("conflict", "Matchen ändrades samtidigt – försök igen");
  const deltas = statDeltas(prev, next);
  for (const [uid, d] of Object.entries(deltas)) {
    const { data: s } = await db.from("player_stats").select("*").eq("user_id", uid).maybeSingle();
    const base = s ?? { user_id: uid, played: 0, wins: 0, captures: 0, pieces_home: 0, forfeits: 0 };
    await db.from("player_stats").upsert({
      user_id: uid, played: base.played + d.played, wins: base.wins + d.wins, captures: base.captures + d.captures,
      pieces_home: base.pieces_home + d.pieces_home, forfeits: base.forfeits + d.forfeits, updated_at: now,
    });
  }
  if (next.lastEvent?.kind === "forfeit" && next.lastEvent !== prev.lastEvent)
    await logEventRow(db, { user_id: next.players[next.lastEvent.player].id, kind: "forfeit", detail: { match_id: matchId } });
  if (finished) await logEventRow(db, { kind: "match_finished", detail: { match_id: matchId, winner: next.players[next.winner!]?.id, turns: next.turnCount } });
}

function fail(e: unknown): never {
  if (e instanceof MatchError) throw new Error(e.message);
  throw e;
}

// ---------- Profile ----------

export const getMe = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const [{ data: profile }, { data: stats }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("player_stats").select("*").eq("user_id", userId).maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId);
  return { userId, profile, stats, isAdmin: !!isAdmin };
});

export const updateProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { display_name: string; avatar: string; country: string }) => {
    const name = String(d.display_name ?? "").trim().slice(0, 20);
    if (name.length < 2) throw new Error("Namnet måste ha minst 2 tecken");
    const country = String(d.country ?? "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) throw new Error("Ogiltigt land");
    return { display_name: name, avatar: String(d.avatar ?? "🎲").slice(0, 8), country };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update(data).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Matches ----------

export const createMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { isPrivate: boolean; maxPlayers: number }) => ({ isPrivate: !!d.isPrivate, maxPlayers: Math.min(4, Math.max(2, Math.round(Number(d.maxPlayers) || 4))) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    for (let i = 0; i < 5; i++) {
      const { data: m, error } = await db.from("matches")
        .insert({ code: makeCode(), is_private: data.isPrivate, max_players: data.maxPlayers, host_id: context.userId }).select("id, code").single();
      if (!error && m) {
        await seatUser(db, m.id, data.maxPlayers, context.userId);
        return m;
      }
    }
    throw new Error("Kunde inte skapa match");
  });

export const joinByCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: String(d.code ?? "").trim().toUpperCase().slice(0, 8) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("id, status, max_players").eq("code", data.code).maybeSingle();
    if (!m) throw new Error("Ingen match med den koden");
    const { data: mine } = await db.from("match_players").select("seat").eq("match_id", m.id).eq("user_id", context.userId).maybeSingle();
    if (mine) return { id: m.id };
    if (m.status !== "waiting") throw new Error("Matchen har redan börjat");
    if (!(await seatUser(db, m.id, m.max_players, context.userId))) throw new Error("Matchen är full");
    await maybeAutostart(db, m.id);
    return { id: m.id };
  });

export const quickMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { maxPlayers: number }) => ({ maxPlayers: Math.min(4, Math.max(2, Math.round(Number(d.maxPlayers) || 2))) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: open } = await db.from("matches").select("id, max_players, host_id")
      .eq("status", "waiting").eq("is_private", false).eq("max_players", data.maxPlayers)
      .gte("updated_at", since).order("created_at").limit(10);
    for (const m of open ?? []) {
      if (await seatUser(db, m.id, m.max_players, context.userId)) {
        await db.from("matches").update({ updated_at: new Date().toISOString() }).eq("id", m.id);
        await maybeAutostart(db, m.id);
        return { id: m.id };
      }
    }
    const { data: m } = await db.from("matches")
      .insert({ code: makeCode(), is_private: false, max_players: data.maxPlayers, host_id: context.userId }).select("id").single();
    await seatUser(db, m!.id, data.maxPlayers, context.userId);
    return { id: m!.id };
  });

export const startMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string }) => ({ matchId: String(d.matchId) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m || m.host_id !== context.userId) throw new Error("Bara värden kan starta");
    if (m.status !== "waiting") return { ok: true };
    const { data: seats } = await db.from("match_players").select("user_id, seat, display_name").eq("match_id", m.id);
    if ((seats?.length ?? 0) < 2) throw new Error("Minst 2 spelare krävs");
    await doStart(db, m.id, m.version, seats!);
    return { ok: true };
  });

export const leaveMatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string }) => ({ matchId: String(d.matchId) }))
  .handler(async ({ data, context }) => {
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
  });

/** Roll / move. The die value is generated here on the server, never by the client. */
export const act = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; version: number; action: Action }) => {
    const a = d.action;
    if (!a || !["roll", "move", "forfeit"].includes(a.kind)) throw new Error("Bad action");
    const action: Action = a.kind === "move" ? { kind: "move", piece: Math.trunc(Number(a.piece)) } : { kind: a.kind };
    return { matchId: String(d.matchId), version: Math.trunc(Number(d.version)), action };
  })
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m || m.status !== "playing") throw new Error("Matchen är inte igång");
    if (m.version !== data.version) throw new Error("Matchen ändrades samtidigt – försök igen");
    const prev = m.state as unknown as GameState;
    try {
      const next = performAction(prev, context.userId, data.action, secureRoll);
      await commit(db, m.id, m.version, prev, next);
      return { version: m.version + 1, state: next };
    } catch (e) { fail(e); }
  });

/**
 * Heartbeat every few seconds from each client in the match. Also advances
 * the turn clock: idle players are auto-played, dropped players forfeit.
 */
export const heartbeat = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string }) => ({ matchId: String(d.matchId) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const now = Date.now();
    await db.from("match_players").update({ last_seen: new Date(now).toISOString() }).eq("match_id", data.matchId).eq("user_id", context.userId);
    const { data: m } = await db.from("matches").select("*").eq("id", data.matchId).single();
    if (!m || m.status !== "playing" || !m.turn_started_at) return { ok: true };
    const state = m.state as unknown as GameState;
    const cur = state.players[state.current];
    if (cur.id === context.userId) return { ok: true };
    const idle = (now - new Date(m.turn_started_at).getTime()) / 1000;
    if (idle < TURN_SECONDS) return { ok: true };
    const { data: seat } = await db.from("match_players").select("last_seen").eq("match_id", m.id).eq("user_id", cur.id).single();
    const dropped = !seat || (now - new Date(seat.last_seen).getTime()) / 1000 > DROP_SECONDS;
    const next = dropped ? performAction(state, cur.id, { kind: "forfeit" }, secureRoll) : autoStep(state, secureRoll);
    try { await commit(db, m.id, m.version, state, next); } catch { /* another client advanced it first */ }
    return { ok: true };
  });

// ---------- Friends ----------

export const sendFriendRequest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { friendCode: string }) => ({ friendCode: String(d.friendCode ?? "").trim().toUpperCase().slice(0, 8) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: target } = await db.from("profiles").select("id").eq("friend_code", data.friendCode).maybeSingle();
    if (!target) throw new Error("Hittade ingen spelare med den koden");
    if (target.id === context.userId) throw new Error("Det är din egen kod");
    const { data: existing } = await db.from("friendships").select("*")
      .or(`and(requester.eq.${context.userId},addressee.eq.${target.id}),and(requester.eq.${target.id},addressee.eq.${context.userId})`).maybeSingle();
    if (existing) {
      if (existing.status === "pending" && existing.addressee === context.userId)
        await db.from("friendships").update({ status: "accepted" }).eq("id", existing.id);
      return { ok: true };
    }
    await db.from("friendships").insert({ requester: context.userId, addressee: target.id });
    return { ok: true };
  });

export const respondFriend = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; accept: boolean }) => ({ id: String(d.id), accept: !!d.accept }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: f } = await db.from("friendships").select("*").eq("id", data.id).single();
    if (!f || (f.addressee !== context.userId && f.requester !== context.userId)) throw new Error("Saknas");
    if (data.accept && f.addressee === context.userId) await db.from("friendships").update({ status: "accepted" }).eq("id", f.id);
    else await db.from("friendships").delete().eq("id", f.id);
    return { ok: true };
  });

export const listFriends = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const { data: rows } = await supabase.from("friendships").select("*").or(`requester.eq.${userId},addressee.eq.${userId}`);
  const ids = [...new Set((rows ?? []).map((r) => (r.requester === userId ? r.addressee : r.requester)))];
  const { data: profs } = ids.length ? await supabase.from("profiles").select("id, display_name, avatar, country, last_seen").in("id", ids) : { data: [] };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  const { data: invites } = await supabase.from("match_invites").select("id, match_id, from_user, created_at").eq("to_user", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(10);
  return {
    friends: (rows ?? []).map((r) => {
      const other = r.requester === userId ? r.addressee : r.requester;
      return { id: r.id, status: r.status, incoming: r.addressee === userId, user: byId.get(other) ?? { id: other, display_name: "?", avatar: "🎲", country: "SE", last_seen: null } };
    }),
    invites: (invites ?? []).map((i) => ({ ...i, from: byId.get(i.from_user) ?? null })),
  };
});

export const inviteFriend = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; userId: string }) => ({ matchId: String(d.matchId), userId: String(d.userId) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: f } = await db.from("friendships").select("id").eq("status", "accepted")
      .or(`and(requester.eq.${context.userId},addressee.eq.${data.userId}),and(requester.eq.${data.userId},addressee.eq.${context.userId})`).maybeSingle();
    if (!f) throw new Error("Ni är inte vänner");
    const { data: me } = await db.from("match_players").select("seat").eq("match_id", data.matchId).eq("user_id", context.userId).maybeSingle();
    if (!me) throw new Error("Du är inte med i matchen");
    await db.from("match_invites").insert({ match_id: data.matchId, from_user: context.userId, to_user: data.userId });
    return { ok: true };
  });

export const respondInvite = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; accept: boolean }) => ({ id: String(d.id), accept: !!d.accept }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: inv } = await db.from("match_invites").select("*").eq("id", data.id).single();
    if (!inv || inv.to_user !== context.userId) throw new Error("Saknas");
    await db.from("match_invites").update({ status: data.accept ? "accepted" : "declined" }).eq("id", inv.id);
    if (!data.accept) return { matchId: null };
    const { data: m } = await db.from("matches").select("id, status, max_players").eq("id", inv.match_id).single();
    if (!m || m.status !== "waiting") throw new Error("Matchen har redan börjat");
    if (!(await seatUser(db, m.id, m.max_players, context.userId))) throw new Error("Matchen är full");
    await maybeAutostart(db, m.id);
    return { matchId: m.id };
  });

// ---------- Leaderboard ----------

export const getLeaderboard = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { sort: "wins" | "played" | "captures" }) => ({ sort: (["wins", "played", "captures"] as const).includes(d.sort) ? d.sort : "wins" }))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("player_stats").select("*").gt("played", 0).order(data.sort, { ascending: false }).order("played").limit(50);
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length ? await context.supabase.from("profiles").select("id, display_name, avatar, country").in("id", ids) : { data: [] };
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  });

// ---------- Telemetry ----------

export const logEvent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: string; deviceId?: string; platform?: string; detail?: Record<string, unknown> }) => {
    const kind = ["session", "error"].includes(d.kind) ? d.kind : "session";
    const platform = ["ios", "android", "web"].includes(String(d.platform)) ? String(d.platform) : "web";
    const detail = JSON.parse(JSON.stringify(d.detail ?? {}).slice(0, 2000) || "{}");
    return { kind, platform, deviceId: String(d.deviceId ?? "").slice(0, 64) || null, detail };
  })
  .handler(async ({ data, context }) => {
    const db = await admin();
    await logEventRow(db, { user_id: context.userId, kind: data.kind, device_id: data.deviceId, platform: data.platform, detail: data.detail });
    return { ok: true };
  });

// ---------- Admin ----------

export const adminOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
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
  };
});
