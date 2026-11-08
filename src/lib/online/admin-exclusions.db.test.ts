import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { testClient } from "../../test/db-admin-client";
import { adminAdDiagnosticsAction, adminOverviewAction } from "./online-actions";

const url = process.env["LUDO_TEST_DATABASE_URL"] ?? "";
if (!/@localhost:\d+\/ludo_test\?host=\/tmp\/ludo-testdb\./.test(url)) throw new Error("Requires isolated test database");
const u = new URL(url);
const sql = postgres({ host: u.searchParams.get("host") ?? "", port: Number(u.port), database: "ludo_test", username: "ludo_test" });
afterAll(() => sql.end());

it("omits an excluded phone's activity while retaining its diagnostics and locking exclusion writes", async () => {
  const id = randomUUID();
  const device = randomUUID();
  await sql`insert into auth.users (id) values (${id})`;
  await sql`insert into user_roles (user_id, role) values (${id}, 'admin')`;
  await sql`insert into app_events (user_id, device_id, platform, kind, detail) values
    (${id}, ${device}, 'ios', 'session', '{}'),
    (${id}, ${device}, 'ios', 'ad', '{"name":"ios_app_open_diag","phase":"excluded-phone"}')`;
  const client = testClient({ role: "authenticated", sub: id });
  const context = { userId: id, supabase: client } as unknown as Parameters<typeof adminOverviewAction>[0]["context"];
  const before = await adminOverviewAction({ context });
  await sql`insert into admin_activity_exclusions (user_id, device_id) values (${id}, ${device})`;
  const after = await adminOverviewAction({ context });
  expect(after.totals.active24h).toBe(before.totals.active24h - 1);
  expect(after.days.at(-1)?.appDevices).toBe((before.days.at(-1)?.appDevices ?? 0) - 1);
  expect((await adminAdDiagnosticsAction({ context })).diagnostics.some((r) => (r.detail as { phase?: string })?.phase === "excluded-phone")).toBe(true);
  for (const role of ["anon", "authenticated"]) {
    const [grants] = await sql`select has_table_privilege(${role}, 'public.admin_activity_exclusions', 'SELECT') as read,
      has_table_privilege(${role}, 'public.admin_activity_exclusions', 'INSERT') as write`;
    expect(grants).toEqual({ read: false, write: false });
  }
});