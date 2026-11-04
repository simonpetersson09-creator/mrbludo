/** Pure helpers for the offline report queue (no DOM/network) so they can be tested. */
export type QueuedReport = { kind: "error" | "ad"; detail: Record<string, unknown>; at: number };

export const REPORT_QUEUE_MAX = 30;
/** Older reports are dropped: they no longer help and must not pile up forever. */
export const REPORT_QUEUE_MAX_AGE_MS = 7 * 24 * 3600_000;

export function parseQueue(raw: string | null, now: number): QueuedReport[] {
  try {
    const list = JSON.parse(raw ?? "[]") as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((r): r is QueuedReport =>
      !!r && (r.kind === "error" || r.kind === "ad") && typeof r.at === "number" && typeof r.detail === "object" && now - r.at < REPORT_QUEUE_MAX_AGE_MS,
    ).slice(-REPORT_QUEUE_MAX);
  } catch { return []; }
}

export function enqueue(queue: QueuedReport[], item: QueuedReport): QueuedReport[] {
  return [...queue, item].slice(-REPORT_QUEUE_MAX);
}
