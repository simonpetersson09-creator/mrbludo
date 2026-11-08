import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { testClient } from "../../test/db-admin-client";

const url = process.env["LUDO_TEST_DATABASE_URL"] ?? "";
if (!/@localhost:\d+\/ludo_test\?host=\/tmp\/ludo-testdb\./.test(url)) throw new Error("Requires isolated test database");
const u = new URL(url);
const sql = postgres({ host: u.searchParams.get("host") ?? "", port: Number(u.port), database: "ludo_test", username: "ludo_test" });
afterAll(() => sql.end());

it("resets monthly competition at November 8 13:00:01 UTC without deleting matches or personal totals", async () => {
  const id = randomUUID();
  await sql`insert into auth.users (id) values (${id})`;
  await sql`update profiles set display_name = 'Simon p' where id = ${id}`;
  await sql`update player_stats set played = 7, wins = 3 where user_id = ${id}`;
  const matchId = randomUUID();
  await sql`insert into matches (id, code, host_id) values (${matchId}, ${randomUUID().slice(0, 6)}, ${id})`;
  await sql`insert into match_players (match_id, user_id, seat, color, display_name) values (${matchId}, ${id}, 0, 0, 'old name')`;
  await sql`update matches set status = 'finished', verified = true, finished_at = '2026-11-08T13:00:00Z' where id = ${matchId}`;
  const client = testClient({ role: "authenticated", sub: id });
  const before = await client.rpc("get_weekly_most_active", { _limit: 50 });
  expect(before.error).toBeNull();
  expect(before.data?.some((r: { user_id: string }) => r.user_id === id)).toBe(false);
  await sql`update matches set finished_at = greatest(now(), timestamptz '2026-11-08T13:00:01Z') where id = ${matchId}`;
  const after = await client.rpc("get_weekly_most_active", { _limit: 50 });
  expect(after.data?.find((r: { user_id: string }) => r.user_id === id)).toMatchObject({ games: 1, display_name: "Simon p" });
  expect((await sql`select played, wins from player_stats where user_id = ${id}`)[0]).toEqual({ played: 7, wins: 3 });
  expect((await sql`select count(*)::int as n from matches where id = ${matchId}`)[0]?.["n"]).toBe(1);
});