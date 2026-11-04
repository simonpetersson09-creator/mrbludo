/** Bounded waits for online calls (Yatzy: 8 s per try, one safe retry). Pure helpers, no network. */
export const ACTION_DEADLINE_MS = 8000;

export function withDeadline<T>(p: Promise<T>, ms = ACTION_DEADLINE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("err:timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Only a lost answer (timeout/network) is retried; any server verdict (err:*) is final. */
export function isRetryable(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e ?? "");
  return m === "err:timeout" || !m.startsWith("err:");
}

/**
 * Sends a game action at most twice. The retry reuses the same match version, so if the first
 * try did reach the server, the second is refused as a conflict instead of being applied twice.
 */
export async function sendOnce<T>(call: () => Promise<T>, ms = ACTION_DEADLINE_MS): Promise<T | null> {
  try { return await withDeadline(call(), ms); }
  catch (e) {
    if (!isRetryable(e)) throw e;
    try { return await withDeadline(call(), ms); }
    catch (e2) {
      // The first try already landed: the fresh state comes from the reload instead.
      if (e2 instanceof Error && (e2.message === "err:conflict" || e2.message === "err:not_playing")) return null;
      throw e2;
    }
  }
}
