/** MrB. Admin hub token: "<exp>.<hex(HMAC-SHA256(secret, "mrb-hub:" + exp))>", exp in ms since epoch. */
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function signHubToken(secret: string, exp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`mrb-hub:${exp}`));
  return `${exp}.${hex(sig)}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function verifyHubToken(
  token: unknown,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!secret || typeof token !== "string" || token.length > 200) return false;
  const m = /^(\d{1,16})\.([0-9a-f]{64})$/i.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  const expected = (await signHubToken(secret, exp)).split(".")[1] ?? "";
  const ok = constantTimeEqual(m[2]!.toLowerCase(), expected);
  return ok && exp > now;
}
