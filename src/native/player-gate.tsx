import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ensurePlayerSession } from "@/lib/auth/player";
import { loadProfileSnapshot } from "@/lib/online/snapshot";

// Offline display of a previously saved profile is not authorization for online actions.
// Every online request still requires a server-verified bearer token.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!navigator.onLine && loadProfileSnapshot() && location.pathname === "/profile") return;
    try { await ensurePlayerSession(); }
    catch { throw redirect({ to: "/auth", search: { redirect: location.pathname } }); }
  }, component: () => <Outlet />,
});