import { extractMatchCode } from "@/lib/online/match-code";

const LUDO_HOSTS = new Set(["mrbludo.lovable.app"]);

/** Maps a Universal Link or mrbludo:// link to an in-app path; anything foreign is ignored. */
export function deepLinkPath(raw: string): string | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const custom = url.protocol === "mrbludo:";
  if (!custom && !(url.protocol === "https:" && LUDO_HOSTS.has(url.hostname))) return null;
  const path = custom ? "/" + (url.hostname + url.pathname).replace(/^\/+/, "") : url.pathname;
  const code = extractMatchCode(url.searchParams.get("code") ?? "");
  if ((path === "/join" || path === "/online" || path === "/online/") && code) return `/online?code=${code}`;
  if (/^\/online\/[A-Za-z0-9-]+$/.test(path)) return path;
  return null;
}
