// Safety net for database integration tests: any request that is not to the local test server fails,
// so a test can never reach the live backend even if a module mock were bypassed.
const allowed = process.env["LUDO_TEST_REST_URL"] ?? "";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(allowed)) throw new Error("db-guard: no local test server configured");
for (const k of Object.keys(process.env)) if (/SUPABASE|DATABASE_URL/.test(k) && k !== "LUDO_TEST_DATABASE_URL") delete process.env[k];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(allowed + "/")) throw new Error(`db-guard: blocked network call to ${new URL(url).host}`);
  return realFetch(input, init);
}) as typeof fetch;
