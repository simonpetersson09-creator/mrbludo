import { reportAdEvent } from "@/lib/online/report";

/** Ad diagnostics: native console plus the admin logs (short fields only, no identities or consent choices). */
export function trackEvent(name: string, data: Record<string, unknown> = {}): void {
  try { console.info(`[ads] ${name}`, data); } catch { /* never affect ads */ }
  try { reportAdEvent(name, data); } catch { /* never affect ads */ }
}
