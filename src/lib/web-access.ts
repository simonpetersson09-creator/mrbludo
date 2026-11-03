/**
 * Yatzy's web rules: the published website is a download page, never a playable
 * client. Only the invite landing, the admin panel and the app's own API stay
 * reachable there. Local dev, the Lovable preview and the native apps (served
 * from "localhost") are never gated.
 */
export const WEB_OPEN_PATHS = ["/join", "/auth", "/admin", "/admin-login", "/api", "/.well-known"];
/** Files the host must still hand out: app-ads.txt, favicons, robots.txt … */
const STATIC_FILE = /\.[a-z0-9]{1,10}$/i;

/** Dev servers and Lovable previews must stay playable. */
export function isPreviewHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("id-preview--") ||
    hostname.endsWith(".lovableproject.com")
  );
}

/** True when this visitor should only ever be shown the download page. */
export function webPlayBlocked(opts: {
  hostname: string;
  pathname: string;
  isNative?: boolean;
  isDev?: boolean;
}): boolean {
  if (opts.isNative || opts.isDev) return false;
  if (isPreviewHost(opts.hostname)) return false;
  if (STATIC_FILE.test(opts.pathname)) return false;
  return !WEB_OPEN_PATHS.some((path) => opts.pathname === path || opts.pathname.startsWith(`${path}/`));
}

/** Read the native flag without importing Capacitor into the web bundle. */
export function isNativeWindow(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
}

/**
 * A plain browser on the published site only ever sees the download page, so it
 * must never be turned into a player or a device record.
 */
export function isDownloadOnlyVisitor(opts: { hostname: string; isNative?: boolean; isDev?: boolean }): boolean {
  if (opts.isNative || opts.isDev) return false;
  return !isPreviewHost(opts.hostname);
}
