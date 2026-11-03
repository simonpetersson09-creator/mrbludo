import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/auth/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Local session check only (no network round trip per page change); the server verifies every private request.
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth", search: { redirect: location.href } });
  },
  component: () => <Outlet />,
});
