/**
 * Only one pop-up question at a time (Yatzy's home prompt arbitration): the rating question
 * and our notification explanation never stack. A prompt that loses waits until the screen is free.
 */
let active: string | null = null;
const waiting = new Set<() => void>();

export function claimPrompt(id: string): boolean {
  if (active && active !== id) return false;
  active = id;
  return true;
}

export function releasePrompt(id: string): void {
  if (active !== id) return;
  active = null;
  for (const f of [...waiting]) { waiting.delete(f); f(); if (active) break; }
}

/** Runs `show` as soon as `id` may own the screen. Returns a cancel function. */
export function whenPromptFree(id: string, show: () => void): () => void {
  const attempt = () => { if (claimPrompt(id)) show(); else waiting.add(attempt); };
  attempt();
  return () => { waiting.delete(attempt); };
}

export function activePrompt(): string | null { return active; }
