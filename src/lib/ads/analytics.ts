/** Ludo has no analytics backend: ad diagnostics go to the native console only (no identities or consent choices). */
export function trackEvent(name: string, data: Record<string, unknown> = {}): void {
  try { console.info(`[ads] ${name}`, data); } catch { /* never affect ads */ }
}
