// Yatzy-style "show saved copy first, refresh in background" cache for list pages.
const NS = "mrb-ludo:v1:cache:";

export function readPageCache<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(NS + name);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

export function writePageCache(name: string, value: unknown): void {
  try { localStorage.setItem(NS + name, JSON.stringify(value)); } catch { /* full or blocked storage: cache is optional */ }
}

/** Warms the lazy 3D die chunk while the phone is idle, so the first roll does not stutter (as in Yatzy). */
let diePreloaded = false;
export function preloadDie(): void {
  if (diePreloaded || typeof window === "undefined") return;
  diePreloaded = true;
  const run = () => { void import("@/components/dice-engine/DiceScene").catch(() => { diePreloaded = false; }); };
  const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(run, { timeout: 1500 }); else window.setTimeout(run, 300);
}
