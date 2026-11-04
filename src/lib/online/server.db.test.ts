/**
 * Database integration tests for the server/database changes in commit 49ab836 (review points 6, 7, 9, 12, 15).
 * Run with `bun run test:db`: a throwaway local PostgreSQL + PostgREST is created with every migration applied,
 * and deleted afterwards. These tests refuse to run against anything that is not on this machine.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const DB_URL = process.env["LUDO_TEST_DATABASE_URL"] ?? "";
const REST_URL = process.env["LUDO_TEST_REST_URL"] ?? "";
// Safety: only a local socket database and a loopback REST server are ever accepted.
const isLocal = /@localhost:\d+\/ludo_test\?host=\/tmp\/ludo-testdb\./.test(DB_URL) && /^http:\/\/127\.0\.0\.1:\d+$/.test(REST_URL);
if (!isLocal) throw new Error("Refusing to run database tests: no throwaway local test database (use `bun run test:db`).");

import { testClient as client } from "../../test/db-admin-client";

const A = await import("./online-actions");
const { startState, TURN_SECONDS } = await import("./match-logic");
const I = await import("./online-inputs");

const u = new URL(DB_URL);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test rows are read loosely
const sql: any = postgres({ host: u.searchParams.get("host")!, port: Number(u.port), database: "ludo_test", username: "ludo_test", max: 30, onnotice: () => {} });
afterAll(async () => { await sql.end(); });

type Ctx = Parameters<typeof A.getAvatarsAction>[0]["context"];
const ctx = (userId: string) => ({ userId, supabase: client({ role: "authenticated", sub: userId }) }) as unknown as Ctx;

let n = 0;
async function user(name = `P${++n}`) {
  const id = randomUUID();
  await sql`insert into auth.users (id, raw_user_meta_data) values (${id}, ${sql.json({ display_name: name })})`;
  return id;
}
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
/** A match with seats; seats are added while waiting (the seat guard only allows that), then the status is set. */
async function match(o: { status?: string; isPrivate?: boolean; players: string[]; createdAgo?: string; updatedAgo?: string; turnAgo?: string | null; seenAgo?: string; max?: number }) {
  const [m] = await sql`insert into matches (code, is_private, max_players, host_id) values (${code()}, ${o.isPrivate ?? false}, ${o.max ?? 4}, ${o.players[0]}) returning id`;
  for (const [i, uid] of o.players.entries())
    await sql`insert into match_players (match_id, user_id, seat, color, display_name) values (${m.id}, ${uid}, ${i}, ${i}, ${"P" + i})`;
  const status = o.status ?? "playing";
  const state = status === "playing" ? startState(o.players.map((u, i) => ({ user_id: u, seat: i, display_name: "P" + i })), o.players.length) : null;
  await sql`update matches set status = ${status}, state = ${state ? sql.json(state as never) : null},
    created_at = now() - ${o.createdAgo ?? "0 seconds"}::interval, updated_at = now() - ${o.updatedAgo ?? "0 seconds"}::interval,
    turn_started_at = ${o.turnAgo === null ? null : sql`now() - ${o.turnAgo ?? "0 seconds"}::interval`} where id = ${m.id}`;
  if (o.seenAgo) await sql`update match_players set last_seen = now() - ${o.seenAgo}::interval where match_id = ${m.id}`;
  return m.id as string;
}
const statusOf = async (id: string) => (await sql`select status from matches where id = ${id}`)[0]!["status"];
const friends = async (a: string, b: string) => { await sql`insert into friendships (requester, addressee, status) values (${a}, ${b}, 'accepted')`; };
const cleanup = async () => (await sql`select public.cleanup_stale_matches() r`)[0].r;

beforeEach(async () => { await sql`delete from rate_limit_hits`; });

// ---------------------------------------------------------------- 6
describe("6. maintenance job: selection and priority", () => {
  beforeAll(async () => { await sql`update matches set status = 'abandoned' where status in ('waiting','playing')`; });

  it("advances only quick matches whose turn has run out, oldest first, at most 200 per run; private matches are never touched", async () => {
    const humans = [await user(), await user()];
    const old: string[] = [];
    // 201 overdue quick matches, the first one the most overdue.
    for (let i = 0; i < 201; i++) old.push(await match({ players: humans, turnAgo: `${600 - i} seconds` }));
    const fresh = await match({ players: humans, turnAgo: "5 seconds" });
    const priv = await match({ players: humans, isPrivate: true, turnAgo: "3 hours" });
    await sql`update match_players set last_seen = now()`;
    const before = new Map<string, number>((await sql`select id, version from matches where status = 'playing'`).map((r: { id: string; version: number }) => [r.id, r.version]));

    const r = await A.runMaintenance();
    const after = new Map<string, { version: number; status: string }>((await sql`select id, version, status from matches`).map((x: { id: string; version: number; status: string }) => [x.id, x]));
    expect(r.advanced).toBe(200);
    expect(after.get(old[0])!.version).toBe(before.get(old[0])! + 1); // most overdue is taken
    expect(after.get(old[199])!.version).toBe(before.get(old[199])! + 1);
    expect(after.get(old[200])!.version).toBe(before.get(old[200])); // the 201st waits for the next run
    expect(after.get(fresh)!.version).toBe(before.get(fresh)); // turn not over yet
    expect(after.get(priv)!.version).toBe(before.get(priv)); // private matches pause, never auto-played
    expect(after.get(priv)!.status).toBe("playing");
    await sql`update matches set status = 'abandoned' where status = 'playing'`;
  }, 120_000);

  it("a quick match whose turn is not yet over is not advanced even when the job runs", async () => {
    const humans = [await user(), await user()];
    const id = await match({ players: humans, turnAgo: `${TURN_SECONDS - 10} seconds` });
    await sql`update match_players set last_seen = now() where match_id = ${id}`;
    const v = (await sql`select version from matches where id = ${id}`)[0].version;
    await A.runMaintenance();
    expect((await sql`select version from matches where id = ${id}`)[0].version).toBe(v);
  });

  it("two maintenance runs at the same time never advance one turn twice (version lock)", async () => {
    const humans = [await user(), await user()];
    const id = await match({ players: humans, turnAgo: "5 minutes" });
    await sql`update match_players set last_seen = now() where match_id = ${id}`;
    const v = (await sql`select version from matches where id = ${id}`)[0].version;
    const runs = await Promise.all([A.runMaintenance(), A.runMaintenance(), A.runMaintenance()]);
    expect(runs.reduce((s, r) => s + r.advanced, 0)).toBe(1);
    expect((await sql`select version from matches where id = ${id}`)[0].version).toBe(v + 1);
  });
});

// ---------------------------------------------------------------- 7
describe("7. abandoned quick matches are cleaned up even while the computer keeps playing", () => {
  it("every human gone 10+ minutes: closed, although computer moves just refreshed the turn clock", async () => {
    const humans = [await user(), await user()];
    const id = await match({ players: humans, createdAgo: "40 minutes", turnAgo: "2 seconds", updatedAgo: "2 seconds", seenAgo: "11 minutes" });
    expect((await cleanup()).quick_empty).toBeGreaterThanOrEqual(1);
    expect(await statusOf(id)).toBe("abandoned");
  });

  it("AI takeover through the real maintenance job does not keep a deserted match alive", async () => {
    const humans = [await user(), await user()];
    const id = await match({ players: humans, createdAgo: "30 minutes", turnAgo: "5 minutes", seenAgo: "12 minutes" });
    // First run: the computer plays the idle seat (refreshing the turn clock) ...
    await A.runMaintenance();
    // ... the next run must still see that nobody is there.
    await A.runMaintenance();
    expect(await statusOf(id)).toBe("abandoned");
  });

  it("one human still connected keeps the match", async () => {
    const [a, b] = [await user(), await user()];
    const id = await match({ players: [a, b], createdAgo: "40 minutes", turnAgo: "1 seconds", seenAgo: "20 minutes" });
    await sql`update match_players set last_seen = now() - interval '1 minute' where match_id = ${id} and user_id = ${a}`;
    await cleanup();
    expect(await statusOf(id)).toBe("playing");
  });

  it("a player who left counts as gone even with a recent heartbeat", async () => {
    const [a, b] = [await user(), await user()];
    const id = await match({ players: [a, b], createdAgo: "40 minutes", seenAgo: "20 minutes" });
    await sql`update match_players set last_seen = now(), left_at = now() where match_id = ${id} and user_id = ${a}`;
    await cleanup();
    expect(await statusOf(id)).toBe("abandoned");
  });

  it("a just-started quick match is not closed before 10 minutes have passed", async () => {
    const humans = [await user(), await user()];
    const id = await match({ players: humans, createdAgo: "3 minutes", seenAgo: "11 minutes" });
    await cleanup();
    expect(await statusOf(id)).toBe("playing");
  });

  it("private matches rest up to 14 days, then close", async () => {
    const humans = [await user(), await user()];
    const resting = await match({ players: humans, isPrivate: true, createdAgo: "13 days", updatedAgo: "13 days", turnAgo: "13 days", seenAgo: "13 days" });
    const dead = await match({ players: humans, isPrivate: true, createdAgo: "15 days", updatedAgo: "14 days 1 hour", turnAgo: "14 days 1 hour", seenAgo: "14 days" });
    await cleanup();
    expect(await statusOf(resting)).toBe("playing");
    expect(await statusOf(dead)).toBe("abandoned");
  });

  it("waiting rooms close after 6 hours (boundary), finished matches are left alone", async () => {
    const h = [await user()];
    const young = await match({ status: "waiting", players: h, createdAgo: "5 hours 59 minutes" });
    const old = await match({ status: "waiting", players: h, createdAgo: "6 hours 1 minute" });
    const done = await match({ status: "finished", players: h, createdAgo: "30 days", updatedAgo: "30 days" });
    await cleanup();
    expect(await statusOf(young)).toBe("waiting");
    expect(await statusOf(old)).toBe("abandoned");
    expect(await statusOf(done)).toBe("finished");
  });

  it("old pending invites expire without breaking the clean-up run", async () => {
    const [a, b] = [await user(), await user()];
    const id = await match({ status: "waiting", players: [a] });
    const [inv] = await sql`insert into match_invites (match_id, from_user, to_user, created_at) values (${id}, ${a}, ${b}, now() - interval '7 hours') returning id`;
    await cleanup();
    expect((await sql`select status from match_invites where id = ${inv.id}`)[0]!["status"]).toBe("expired");
  });

  it("clean-up runs at the same time do not fail or double count", async () => {
    const humans = [await user(), await user()];
    await match({ players: humans, createdAgo: "1 hour", seenAgo: "1 hour" });
    const results = await Promise.all(Array.from({ length: 5 }, () => cleanup()));
    expect(results.reduce((s, r) => s + r.quick_empty, 0)).toBe(1);
  });
});

// ---------------------------------------------------------------- 9
describe("9. atomic rate limits", () => {
  it("50 simultaneous hits on separate connections: exactly the allowed number pass", async () => {
    const res = await Promise.all(Array.from({ length: 50 }, () => sql`select public.rate_hit('t:burst', 5, 900) ok`));
    expect(res.filter((r) => r[0].ok).length).toBe(5);
    expect((await sql`select hits from rate_limit_hits where key = 't:burst'`)[0].hits).toBe(50);
  });

  it("peek never counts; an expired window starts again at one", async () => {
    await sql`select public.rate_hit('t:win', 2, 60)`;
    expect((await sql`select public.rate_peek('t:win', 60) n`)[0].n).toBe(1);
    expect((await sql`select public.rate_peek('t:win', 60) n`)[0].n).toBe(1);
    await sql`update rate_limit_hits set window_start = now() - interval '61 seconds' where key = 't:win'`;
    expect((await sql`select public.rate_peek('t:win', 60) n`)[0].n).toBe(0);
    expect((await sql`select public.rate_hit('t:win', 2, 60) ok`)[0].ok).toBe(true);
    expect((await sql`select hits from rate_limit_hits where key = 't:win'`)[0].hits).toBe(1);
  });

  it("players cannot call or read the counters themselves", async () => {
    const u = await user();
    const c = client({ role: "authenticated", sub: u });
    expect((await c.rpc("rate_hit", { _key: "x", _max: 1, _window_seconds: 1 })).error).not.toBeNull();
    expect((await c.rpc("rate_peek", { _key: "x", _window_seconds: 1 })).error).not.toBeNull();
    expect((await c.from("rate_limit_hits").select("*")).error).not.toBeNull();
    expect((await client(null).rpc("rate_hit", { _key: "x", _max: 1, _window_seconds: 1 })).error).not.toBeNull();
  });

  it("20 simultaneous wrong PINs from one player: only 5 are ever checked, then even the right PIN is refused", async () => {
    process.env["ADMIN_PIN"] = "481516";
    const u = await user();
    const res = await Promise.allSettled(Array.from({ length: 20 }, () => A.adminPinLoginAction({ data: { pin: "000000" }, context: ctx(u) })));
    const msgs = res.map((r) => (r.status === "rejected" ? (r.reason as Error).message : "ok"));
    expect(msgs.filter((m) => m === "err:forbidden").length).toBe(A.PIN_LIMITS.perUser);
    expect(msgs.filter((m) => m === "err:rate_limited").length).toBe(20 - A.PIN_LIMITS.perUser);
    await expect(A.adminPinLoginAction({ data: { pin: "481516" }, context: ctx(u) })).rejects.toThrow("err:rate_limited");
    expect((await sql`select count(*)::int n from user_roles where user_id = ${u}`)[0].n).toBe(0);
  });

  it("the right PIN within the limit makes only the caller an admin", async () => {
    process.env["ADMIN_PIN"] = "481516";
    const u = await user();
    await A.adminPinLoginAction({ data: { pin: "481516" }, context: ctx(u) });
    expect((await sql`select role from user_roles where user_id = ${u}`).map((r: { role: string }) => r.role)).toEqual(["admin"]);
  });

  it("the PIN limit survives deleting player data", async () => {
    process.env["ADMIN_PIN"] = "481516";
    const u = await user();
    for (let i = 0; i < 5; i++) await A.adminPinLoginAction({ data: { pin: "1" }, context: ctx(u) }).catch(() => {});
    // Deleting player data removes the identity (auth user + profile); the counter is keyed independently.
    await sql`delete from auth.users where id = ${u}`;
    await expect(A.adminPinLoginAction({ data: { pin: "481516" }, context: ctx(u) })).rejects.toThrow("err:rate_limited");
  });

  it("a database error blocks: PIN login, friend requests and invites are refused, nothing is written", async () => {
    process.env["ADMIN_PIN"] = "481516";
    const [a, b] = [await user(), await user()];
    await friends(a, b);
    const m = await match({ status: "waiting", players: [a], isPrivate: true });
    await sql`revoke execute on function public.rate_hit(text, integer, integer) from service_role`;
    await sql`revoke execute on function public.rate_peek(text, integer) from service_role`;
    try {
      await expect(A.adminPinLoginAction({ data: { pin: "481516" }, context: ctx(a) })).rejects.toThrow("err:rate_limited");
      await expect(A.inviteFriendAction({ data: I.inviteFriendInput({ matchId: m, userId: b }), context: ctx(a) })).rejects.toThrow("err:rate_limited");
    } finally {
      await sql`grant execute on function public.rate_hit(text, integer, integer) to service_role`;
      await sql`grant execute on function public.rate_peek(text, integer) to service_role`;
    }
    expect((await sql`select count(*)::int n from user_roles where user_id = ${a}`)[0].n).toBe(0);
    expect((await sql`select count(*)::int n from match_invites where match_id = ${m}`)[0].n).toBe(0);
  });

  it("simultaneous invites from one player: only one gets through the cooldown", async () => {
    const [a, b, c, d] = [await user(), await user(), await user(), await user()];
    for (const x of [b, c, d]) await friends(a, x);
    const m = await match({ status: "waiting", players: [a], isPrivate: true });
    const res = await Promise.allSettled([b, c, d].map((x) => A.inviteFriendAction({ data: I.inviteFriendInput({ matchId: m, userId: x }), context: ctx(a) })));
    expect(res.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect((await sql`select count(*)::int n from match_invites where match_id = ${m}`)[0].n).toBe(1);
  });
});

// ---------------------------------------------------------------- 12
describe("12. invites to started matches and correct acceptance", () => {
  async function setup(max = 4) {
    const [host, guest] = [await user("Host"), await user("Guest")];
    await friends(host, guest);
    const m = await match({ status: "waiting", players: [host], isPrivate: true, max });
    return { host, guest, m };
  }
  const invite = async (m: string, from: string, to: string) => { await A.inviteFriendAction({ data: I.inviteFriendInput({ matchId: m, userId: to }), context: ctx(from) }); return (await sql`select id from match_invites where match_id = ${m} and to_user = ${to} order by created_at desc limit 1`)[0].id as string; };
  const respond = (id: string, uid: string, accept = true) => A.respondInviteAction({ data: I.respondInviteInput({ id, accept }), context: ctx(uid) });

  it("cannot invite to a match that has started", async () => {
    const [a, b] = [await user(), await user()];
    await friends(a, b);
    const m = await match({ players: [a, await user()], isPrivate: true });
    await expect(A.inviteFriendAction({ data: I.inviteFriendInput({ matchId: m, userId: b }), context: ctx(a) })).rejects.toThrow("err:already_started");
    expect((await sql`select count(*)::int n from match_invites where match_id = ${m}`)[0].n).toBe(0);
  });

  it("accepting seats the guest and starts with exactly host + guest", async () => {
    const { host, guest, m } = await setup();
    const id = await invite(m, host, guest);
    expect((await respond(id, guest)).matchId).toBe(m);
    const [row] = await sql`select status, state from matches where id = ${m}`;
    expect(row["status"]).toBe("playing");
    expect(row["state"].players.map((p: { id: string }) => p.id).sort()).toEqual([host, guest].sort());
    expect((await sql`select status from match_invites where id = ${id}`)[0]!["status"]).toBe("accepted");
  });

  it("an invite to a match that started meanwhile is refused and marked expired; no seat is added", async () => {
    const { host, guest, m } = await setup();
    const id = await invite(m, host, guest);
    const other = await user();
    await sql`insert into match_players (match_id, user_id, seat, color, display_name) values (${m}, ${other}, 1, 1, 'X')`;
    await sql`update matches set status = 'playing' where id = ${m}`;
    await expect(respond(id, guest)).rejects.toThrow("err:already_started");
    expect((await sql`select status from match_invites where id = ${id}`)[0]!["status"]).toBe("expired");
    expect((await sql`select count(*)::int n from match_players where match_id = ${m} and user_id = ${guest}`)[0].n).toBe(0);
  });

  it("the database itself refuses a seat in a started match", async () => {
    const [a, b] = [await user(), await user()];
    const m = await match({ players: [a, await user()] });
    await expect(sql`insert into match_players (match_id, user_id, seat, color, display_name) values (${m}, ${b}, 2, 2, 'X')`).rejects.toThrow(/match_not_waiting/);
  });

  it("only the invited player can answer; declined and expired invites cannot be accepted", async () => {
    const { host, guest, m } = await setup();
    const id = await invite(m, host, guest);
    await expect(respond(id, host)).rejects.toThrow("err:missing");
    await respond(id, guest, false);
    await expect(respond(id, guest)).rejects.toThrow("err:missing");
    const [b2] = [await user()];
    await friends(host, b2);
    await sql`delete from rate_limit_hits`;
    const id2 = await invite(m, host, b2);
    await sql`update match_invites set created_at = now() - interval '7 hours' where id = ${id2}`;
    await expect(respond(id2, b2)).rejects.toThrow("err:missing");
    expect((await sql`select status from match_invites where id = ${id2}`)[0]!["status"]).toBe("expired");
    expect(await statusOf(m)).toBe("waiting");
  });

  it("no longer friends: accepting is refused", async () => {
    const { host, guest, m } = await setup();
    const id = await invite(m, host, guest);
    await sql`delete from friendships where requester = ${host} and addressee = ${guest}`;
    await expect(respond(id, guest)).rejects.toThrow("err:not_friends");
    expect(await statusOf(m)).toBe("waiting");
  });

  it("the same invite accepted twice at once: one seat, one start", async () => {
    const { host, guest, m } = await setup();
    const id = await invite(m, host, guest);
    await Promise.allSettled([respond(id, guest), respond(id, guest), respond(id, guest)]);
    expect((await sql`select count(*)::int n from match_players where match_id = ${m} and user_id = ${guest}`)[0].n).toBe(1);
    const [row] = await sql`select status, version, state from matches where id = ${m}`;
    expect(row["status"]).toBe("playing");
    expect(row["state"].players.length).toBe(2);
    expect(row["version"]).toBe(1);
  });

  it("two friends accept at the same moment: the started match always equals its seats, nobody is half-seated", async () => {
    const host = await user();
    const [b, c] = [await user(), await user()];
    await friends(host, b); await friends(host, c);
    const m = await match({ status: "waiting", players: [host], isPrivate: true });
    const ib = await invite(m, host, b);
    await sql`delete from rate_limit_hits`;
    const ic = await invite(m, host, c);
    await Promise.allSettled([respond(ib, b), respond(ic, c)]);
    const [row] = await sql`select status, state from matches where id = ${m}`;
    const seats = (await sql`select user_id from match_players where match_id = ${m}`).map((r: { user_id: string }) => r.user_id).sort();
    expect(row["status"]).toBe("playing");
    expect(row["state"].players.map((p: { id: string }) => p.id).sort()).toEqual(seats);
    for (const [inv, uid] of [[ib, b], [ic, c]] as const) {
      const st = (await sql`select status from match_invites where id = ${inv}`)[0]!["status"];
      expect(st === "accepted").toBe(seats.includes(uid));
    }
  });
});

// ---------------------------------------------------------------- 15
describe("15. profile picture and last-online permissions", () => {
  it("signed-in players read only their own public profile columns", async () => {
    const [me, other] = [await user(), await user()];
    const c = client({ role: "authenticated", sub: me });
    const own = await c.from("profiles").select("id, display_name, avatar, country").eq("id", me);
    expect(own.error).toBeNull();
    expect(own.data?.length).toBe(1);
    // Other players' rows are served only by server functions (owner-only policy).
    const ok = await c.from("profiles").select("id, display_name, avatar, country").eq("id", other);
    expect(ok.error).toBeNull();
    expect(ok.data?.length).toBe(0);
    for (const col of ["last_seen", "avatar_image", "friend_code", "created_at", "*"]) {
      const r = await c.from("profiles").select(col).eq("id", other);
      expect(r.error?.code, col).toBe("42501");
    }
    // Also their own row: hidden columns are read through server checks only.
    expect((await c.from("profiles").select("last_seen").eq("id", me)).error?.code).toBe("42501");
    expect((await client(null).from("profiles").select("id")).error).not.toBeNull();
  });

  it("filtering or sorting on hidden columns is also refused (no side-channel)", async () => {
    const me = await user();
    const c = client({ role: "authenticated", sub: me });
    expect((await c.from("profiles").select("id").gt("last_seen", "2000-01-01")).error?.code).toBe("42501");
    expect((await c.from("profiles").select("id").not("avatar_image", "is", null)).error?.code).toBe("42501");
  });

  it("a player can set only their own picture", async () => {
    const [me, other] = [await user(), await user()];
    const img = "data:image/jpeg;base64,AAAA";
    await A.setAvatarAction({ data: I.setAvatarInput({ image: img }), context: ctx(me) });
    expect((await sql`select avatar_image from profiles where id = ${me}`)[0]!["avatar_image"]).toBe(img);
    await ctx(me).supabase.from("profiles").update({ avatar_image: img }).eq("id", other);
    expect((await sql`select avatar_image from profiles where id = ${other}`)[0]!["avatar_image"]).toBeNull();
  });

  it("pictures are given only for yourself, friends and players you shared a match with", async () => {
    const [me, friend, mate, stranger] = [await user(), await user(), await user(), await user()];
    await sql`update profiles set avatar_image = 'data:image/jpeg;base64,QQ==' where id in ${sql([me, friend, mate, stranger])}`;
    await friends(friend, me);
    await match({ status: "finished", players: [me, mate] });
    const out = await A.getAvatarsAction({ data: I.getAvatarsInput({ userIds: [me, friend, mate, stranger] }), context: ctx(me) });
    expect(Object.keys(out).sort()).toEqual([me, friend, mate].sort());
    const theirs = await A.getAvatarsAction({ data: I.getAvatarsInput({ userIds: [me] }), context: ctx(stranger) });
    expect(theirs).toEqual({});
  });

  it("last-online time is shown only in your own friends list", async () => {
    const [me, friend, stranger] = [await user(), await user(), await user()];
    await friends(me, friend);
    const list = (await A.listFriendsAction({ context: ctx(me) })).friends;
    expect(list.map((r) => r.user.id)).toEqual([friend]);
    expect(list[0].user.last_seen).toBeTruthy();
    expect((await A.listFriendsAction({ context: ctx(stranger) })).friends).toEqual([]);
  });
});
