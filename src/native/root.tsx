import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, HeadContent, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AndroidBackButton } from "@/components/AndroidBackButton";
import { ensurePlayerSession } from "@/lib/auth/player";
import { supabase } from "@/lib/auth/client";
import { startNativeRuntime, RESUME_EVENT } from "@/lib/native/runtime";
import { installViewportSync } from "@/lib/native/viewport";
import { nativeDiagnostic } from "@/lib/native/diagnostics";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: NativeRoot });
function NativeRoot() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let stopped = false;
    const viewportCleanup = installViewportSync();
    nativeDiagnostic("startup", "ready");
    const connect = () => {
      if (!navigator.onLine) { nativeDiagnostic("session", "offline"); return; }
      nativeDiagnostic("session", "started");
      ensurePlayerSession().then(() => { nativeDiagnostic("session", "ready"); return router.invalidate(); }).catch(() => nativeDiagnostic("session", "failed"));
    };
    connect();
    startNativeRuntime(() => { void router.navigate({ to: "/" }); }).then(fn => { if (stopped) fn(); else cleanup = fn; }).catch(() => nativeDiagnostic("runtime", "failed"));
    window.addEventListener("online", connect);
    window.addEventListener(RESUME_EVENT, connect);
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => { stopped = true; cleanup?.(); viewportCleanup(); data.subscription.unsubscribe(); window.removeEventListener("online", connect); window.removeEventListener(RESUME_EVENT, connect); };
  }, [router, queryClient]);
  return <QueryClientProvider client={queryClient}><HeadContent /><AndroidBackButton /><Outlet /><Toaster position="top-center" /></QueryClientProvider>;
}