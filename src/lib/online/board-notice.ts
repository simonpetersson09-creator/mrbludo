/** What this phone last saw of "Månadens flitigaste": the month and the top-10 order. */
export interface BoardMemory { month: string; ids: string[] }

/**
 * Name of a player who has passed `me` since last time, or null.
 * Only within the same month, only if `me` was on the list, and only someone who was below (or absent) before.
 */
export function passedBy(prev: BoardMemory | null, now: BoardMemory, me: string, names: Record<string, string>): string | null {
  if (!prev || prev.month !== now.month) return null;
  const before = prev.ids.indexOf(me);
  if (before < 0) return null;
  const after = now.ids.indexOf(me);
  if (after >= 0 && after <= before) return null;
  const aboveNow = after >= 0 ? now.ids.slice(0, after) : now.ids;
  const aboveBefore = new Set(prev.ids.slice(0, before));
  const who = aboveNow.find((id) => id !== me && !aboveBefore.has(id));
  return who ? names[who] ?? null : null;
}
