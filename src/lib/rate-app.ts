/**
 * In-app rating prompt (port of Mr. B Yatzy's schedule, Ludo storage keys).
 * - First asked after 5 finished games (local + online), regardless of outcome.
 * - "Senare" waits 10, then 20 more finished games; after 3 "Senare" it stops.
 * - "Ge betyg" ends it for good and opens the native store review sheet.
 */
import { Capacitor } from "@capacitor/core";

const ASKED_AT_KEY = "mrb-ludo:v1:rate-asked-at";
const DONE_KEY = "mrb-ludo:v1:rate-done";
const LATER_COUNT_KEY = "mrb-ludo:v1:rate-later-count";

export const RATE_PROMPT_THRESHOLD = 5;
const SNOOZE_STEPS = [10, 20];
const MAX_LATER = 3;

const num = (k: string) => parseInt(localStorage.getItem(k) || "0", 10) || 0;

export function shouldShowRatePrompt(gamesPlayed: number): boolean {
  try {
    if (localStorage.getItem(DONE_KEY) === "1") return false;
    const laters = num(LATER_COUNT_KEY);
    if (laters >= MAX_LATER) return false;
    if (laters === 0) return gamesPlayed >= RATE_PROMPT_THRESHOLD;
    const step = SNOOZE_STEPS[laters - 1];
    return step !== undefined && gamesPlayed >= num(ASKED_AT_KEY) + step;
  } catch {
    return false;
  }
}

export function snoozeRatePrompt(gamesPlayed: number): void {
  try {
    localStorage.setItem(ASKED_AT_KEY, String(gamesPlayed));
    localStorage.setItem(LATER_COUNT_KEY, String(num(LATER_COUNT_KEY) + 1));
  } catch { /* storage off */ }
}

export function completeRatePrompt(): void {
  try { localStorage.setItem(DONE_KEY, "1"); } catch { /* storage off */ }
}

/** Opens the native review sheet. Returns false when not available (web). */
export async function requestAppReview(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    await InAppReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
