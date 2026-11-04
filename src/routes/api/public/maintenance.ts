import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduled every minute: closes dead matches and plays idle turns by the normal server rules.
 * Only the managed scheduler may call it: its bearer secret is checked before anything runs.
 */
export const Route = createFileRoute("/api/public/maintenance")({ server: { handlers: {
  POST: async ({ request }) => {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
    const { runMaintenance } = await import("@/lib/online/online-actions");
    try {
      const r = await runMaintenance();
      return Response.json({ ok: true, advanced: r.advanced, cleaned: r.cleaned }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ ok: false }, { status: 500 });
    }
  },
} } });
