// Database integration tests only (aliased in vitest.db.config.ts): the server's privileged client,
// pointed at the throwaway local PostgREST with a locally signed service-role token.
import { createHmac } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";

const url = process.env["LUDO_TEST_REST_URL"] ?? "";
const secret = process.env["LUDO_TEST_JWT_SECRET"] ?? "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url) || !secret) throw new Error("test admin client: no local test server");

export function testToken(claims: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export const testClient = (claims: Record<string, unknown> | null) =>
  new PostgrestClient(url, { headers: claims ? { Authorization: `Bearer ${testToken(claims)}` } : {} });

export const supabaseAdmin = testClient({ role: "service_role" });
