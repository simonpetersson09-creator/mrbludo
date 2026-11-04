import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled every minute: closes dead matches and plays idle turns by the normal server rules.
 * Public but harmless: it takes no input, applies only server-side rules and returns counts only.
 */
export const Route = createFileRoute("/api/public/maintenance")({ server: { handlers: {
  POST: async () => {
    const { runMaintenance } = await import("@/lib/online/online-actions");
    try {
      const r = await runMaintenance();
      return Response.json({ ok: true, advanced: r.advanced, cleaned: r.cleaned }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ ok: false }, { status: 500 });
    }
  },
} } });
