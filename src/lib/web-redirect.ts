import { webPlayBlocked } from "./web-access";

/**
 * Browsers on the published site are sent to the download page before any game
 * code runs (Yatzy's rule). Invite links keep their code so the landing page can
 * show it; people with the app never reach here — the OS opens the app instead.
 */
export function downloadOnlyRedirect(request: Request): Response | undefined {
  const url = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") || url.hostname).split(":")[0];
  if (!webPlayBlocked({ hostname: host, pathname: url.pathname })) return undefined;
  const target = new URL("/join", url);
  const code = url.searchParams.get("code");
  if (code) target.searchParams.set("code", code);
  return Response.redirect(target, 302);
}
