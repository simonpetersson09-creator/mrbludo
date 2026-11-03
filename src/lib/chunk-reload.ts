/**
 * After an app update the old code files are gone, so a lazy route import can fail with
 * "Importing a module script failed." The router catches that and shows an error screen,
 * so the reload has to happen there too. This module is pure (no DOM at import time) so it
 * can be unit tested and used from both the boot script path and the error screen.
 */

export const STALE_CHUNK_RE =
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Failed to load module script|Unable to preload CSS/i;

export const CHUNK_RELOAD_KEY = "mrb-ludo:v1:chunk-reload";
export const MAX_CHUNK_RELOADS = 3;

/** True when the thrown value (or one of its causes) looks like a missing code file. */
export function isStaleChunkError(value: unknown): boolean {
  const seen = new Set<unknown>();
  const collect = (v: unknown, out: string[]): void => {
    if (v == null || seen.has(v)) return;
    seen.add(v);
    if (typeof v === "string") { out.push(v); return; }
    if (v instanceof Error) {
      out.push(v.message);
      collect((v as { cause?: unknown }).cause, out);
      return;
    }
    if (typeof v === "object") {
      const o = v as { message?: unknown; cause?: unknown };
      if (typeof o.message === "string") out.push(o.message);
      collect(o.cause, out);
    }
  };
  const messages: string[] = [];
  collect(value, messages);
  return messages.some((m) => STALE_CHUNK_RE.test(m));
}

/** One try is not enough while an update is still writing files: wait longer every try. */
export function chunkReloadDelayMs(tries: number): number {
  return 250 + Math.max(0, tries) * 500;
}

export type ChunkReloadDeps = {
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  schedule?: (run: () => void, ms: number) => void;
  reload?: () => void;
  key?: string;
};

/**
 * Schedule a bounded number of reloads after a stale-code failure.
 * Returns true when a reload was scheduled, false when out of tries or storage is unavailable.
 */
export function tryStaleChunkReload(deps: ChunkReloadDeps = {}): boolean {
  const key = deps.key ?? CHUNK_RELOAD_KEY;
  const storage = deps.storage === undefined
    ? (typeof window !== "undefined" ? window.sessionStorage : null)
    : deps.storage;
  if (!storage) return false;
  const schedule = deps.schedule ?? ((run, ms) => { setTimeout(run, ms); });
  const reload = deps.reload ?? (() => window.location.reload());

  let tries = 0;
  try { tries = Number.parseInt(storage.getItem(key) ?? "0", 10) || 0; } catch { return false; }
  if (tries >= MAX_CHUNK_RELOADS) return false;
  try { storage.setItem(key, String(tries + 1)); } catch { return false; }
  schedule(() => reload(), chunkReloadDelayMs(tries));
  return true;
}

/** Forget the tries once the app has clearly been running for a while. */
export function clearChunkReloadTries(key: string = CHUNK_RELOAD_KEY): void {
  try { window.sessionStorage.removeItem(key); } catch { /* private mode: nothing to clear */ }
}

/** Marker used when the code file never came back: the home screen then shows a notice. */
export const STALE_PARAM = "stale";

/** True when the current address carries the "we could not load the new version" marker. */
export function isStaleNotice(search: string): boolean {
  try { return new URLSearchParams(search).get(STALE_PARAM) === "1"; } catch { return false; }
}

/**
 * Where to go when the reloads are used up: the home screen with a marker, so the app can say
 * what happened instead of leaving a blank screen. The screen that failed is skipped on purpose –
 * its file is the one that is missing. The fresh number asks the browser for a brand new copy of
 * the page instead of one it kept from before the update. Null when already there (never loop).
 */
export function staleGiveUpHref(href: string, now: number = Date.now()): string | null {
  try {
    const u = new URL(href);
    if (u.searchParams.get(STALE_PARAM) === "1") return null;
    return `/?${STALE_PARAM}=1&fresh=${Math.floor(now)}`;
  } catch {
    return null;
  }
}
