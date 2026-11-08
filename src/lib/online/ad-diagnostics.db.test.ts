import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { testClient } from "../../test/db-admin-client";
import { adminAdDiagnosticsAction } from "./online-actions";

const url = process.env["LUDO_TEST_DATABASE_URL"] ?? "";
if (!/@localhost:\d+\/ludo_test\?host=\/tmp\/ludo-testdb\./.test(url)) throw new Error("Requires isolated test database");
const u = new URL(url);
const sql = postgres({ host: u.searchParams.get("host") ?? "", port: Number(u.port), database: "ludo_test", username: "ludo_test" });
afterAll(() => sql.end());

it("denies ordinary players and returns only recent iPhone diagnostics to an admin", async () => {
  const id = randomUUID();
  await sql`insert into auth.users (id) values (${id})`;
  const context = { userId: id, supabase: testClient({ role: "authenticated", sub: id }) } as unknown as Parameters<typeof adminAdDiagnosticsAction>[0]["context"];
  await expect(adminAdDiagnosticsAction({ context })).rejects.toThrow("err:forbidden");
  await sql`insert into user_roles (user_id, role) values (${id}, 'admin')`;
  await sql`insert into app_events (kind, platform, detail, created_at) values
    ('ad', 'ios', '{"name":"ios_app_open_diag","phase":"test-admin"}', now()),
    ('ad', 'android', '{"name":"ios_app_open_diag","phase":"not-ios"}', now()),
    ('ad', 'ios', '{"name":"ad_result"}', now()),
    ('ad', 'ios', '{"name":"ios_app_open_diag","phase":"too-old"}', now()-interval '31 days')`;
  const data = await adminAdDiagnosticsAction({ context });
  expect(data.diagnostics.some((r) => (r.detail as { phase?: string })?.phase === "test-admin")).toBe(true);
  expect(data.diagnostics.every((r) => r.platform === "ios")).toBe(true);
  expect(data.diagnostics.some((r) => (r.detail as { phase?: string })?.phase === "too-old")).toBe(false);
  expect(data.diagnostics.every((r) => !('user_id' in r) && !('device_id' in r))).toBe(true);
});