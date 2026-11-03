import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { AndroidBackButton } from "@/components/AndroidBackButton";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/lib/auth/client";
import { ensurePlayerSession } from "@/lib/auth/player";
import { startNativeRuntime, RESUME_EVENT } from "@/lib/native/runtime";
import { logEvent } from "@/lib/online/online.functions";
import { deviceId, platform } from "@/lib/online/telemetry";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFoundTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("notFoundBody")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#123038" },
      { title: "Mr. B Ludo" },
      { name: "description", content: "Klassiskt Ludo för mobilen." },
      { property: "og:title", content: "Mr. B Ludo" },
      { property: "og:description", content: "Klassiskt Ludo för mobilen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Runs before the app's modules: if an outdated module fails to load after an update, reload once instead of a blank screen. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var K="mrb-ludo:v1:boot-reload";function f(m){m=String(m||"");if(!/Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(m))return;try{if(sessionStorage.getItem(K))return;sessionStorage.setItem(K,"1")}catch(e){return}location.reload()}addEventListener("error",function(e){f(e&&e.message)},true);addEventListener("unhandledrejection",function(e){f(e&&e.reason&&(e.reason.message||e.reason))});addEventListener("load",function(){setTimeout(function(){try{sessionStorage.removeItem(K)}catch(e){}},10000)})})();`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  // After an app update, old code chunks disappear; reload once instead of showing a blank screen.
  useEffect(() => {
    const KEY = "mrb-ludo:v1:chunk-reload";
    const onFail = (e: Event) => {
      if (sessionStorage.getItem(KEY)) return;
      e.preventDefault();
      sessionStorage.setItem(KEY, "1");
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onFail);
    const clear = window.setTimeout(() => sessionStorage.removeItem(KEY), 10_000);
    return () => { window.removeEventListener("vite:preloadError", onFail); window.clearTimeout(clear); };
  }, []);
  useEffect(() => {
    const ping = () => logEvent({ data: { kind: "session", deviceId: deviceId(), platform: platform() } }).catch(() => {});
    // Admin login has its own credentials; ordinary app launch creates a player automatically.
    if (window.location.pathname !== "/admin-login") ensurePlayerSession().then(ping).catch(() => {});
    let dispose: (() => void) | undefined;
    let stopped = false;
    startNativeRuntime(() => { void router.navigate({ to: "/" }); }).then(cleanup => { if (stopped) cleanup(); else dispose = cleanup; }).catch(() => {});
    const resume = () => { router.invalidate(); queryClient.invalidateQueries(); };
    window.addEventListener(RESUME_EVENT, resume);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event === "SIGNED_IN") ping();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => { stopped = true; dispose?.(); window.removeEventListener(RESUME_EVENT, resume); data.subscription.unsubscribe(); };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <AndroidBackButton />
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
