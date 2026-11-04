import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, HeadContent, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AndroidBackButton } from "@/components/AndroidBackButton";
import { NativeDeepLinks } from "@/components/NativeDeepLinks";
import { SwipeBack } from "@/components/SwipeBack";
import { AppPresence } from "@/components/AppPresence";
import { logEvent } from "@/lib/online/online.functions";
import { deviceId, platform } from "@/lib/online/telemetry";
import { reportAppError } from "@/lib/online/report";
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
      ensurePlayerSession().then(() => {
        nativeDiagnostic("session", "ready");
        // Counts this phone as an app device for today in the admin panel (was missing in the app build).
        void logEvent({ data: { kind: "session", deviceId: deviceId(), platform: platform() } }).catch(() => {});
        return router.invalidate();
      }).catch(() => nativeDiagnostic("session", "failed"));
    };
    connect();
    const onError = (e: ErrorEvent) => reportAppError(e.error ?? e.message, "onerror");
    const onRejection = (e: PromiseRejectionEvent) => reportAppError(e.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    startNativeRuntime(() => { void router.navigate({ to: "/" }); }).then(fn => { if (stopped) fn(); else cleanup = fn; }).catch(() => nativeDiagnostic("runtime", "failed"));
    let pushCleanup: (() => void) | undefined;
    import("@/lib/native/push").then(({ startPush }) => startPush((path) => { void router.navigate({ href: path }); }))
      .then((fn) => { if (stopped) fn(); else pushCleanup = fn; }).catch(() => {});
    window.addEventListener("online", connect);
    window.addEventListener(RESUME_EVENT, connect);
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => { stopped = true; cleanup?.(); pushCleanup?.(); viewportCleanup(); data.subscription.unsubscribe(); window.removeEventListener("online", connect); window.removeEventListener(RESUME_EVENT, connect); window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, [router, queryClient]);
  return <QueryClientProvider client={queryClient}><HeadContent /><AndroidBackButton /><SwipeBack /><NativeDeepLinks /><AppPresence /><Outlet /><Toaster position="top-center" /></QueryClientProvider>;
}