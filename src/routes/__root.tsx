import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { isDownloadOnlyVisitor, isNativeWindow, webPlayBlocked } from "@/lib/web-access";
import { parseMatchCode } from "@/lib/online/match-code";
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
import { reportAppError } from "@/lib/online/report";

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
  const { t } = useTranslation();
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    reportAppError(error, "error_page");
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("errorPageTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("errorPageBody")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("tryAgain")}
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

/** The server needs the address it was asked for to know whether it may serve the game. */
async function serverRequestTarget() {
  const { getRequestUrl } = await import("@tanstack/react-start/server");
  const url = getRequestUrl({ xForwardedHost: true });
  return { hostname: url.hostname, pathname: url.pathname };
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Yatzy's rule: the published website never plays the game, it points to the app.
  beforeLoad: async ({ location }) => {
    const target = import.meta.env.SSR
      ? await serverRequestTarget()
      : { hostname: window.location.hostname, pathname: window.location.pathname, isNative: isNativeWindow(), isDev: import.meta.env.DEV };
    if (!webPlayBlocked(target)) return;
    const code = parseMatchCode(new URL(location.href, "http://localhost").searchParams.get("code") ?? "");
    throw redirect({ to: "/join", search: code ? { code } : {} });
  },
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
  // Uncaught app errors go to the admin logs (deduplicated and capped per session).
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportAppError(e.error ?? e.message, "onerror");
    const onRejection = (e: PromiseRejectionEvent) => reportAppError(e.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  useEffect(() => {
    // A plain browser on the published site is a visitor, not a player: no identity, no usage log.
    if (isDownloadOnlyVisitor({ hostname: window.location.hostname, isNative: isNativeWindow(), isDev: import.meta.env.DEV })) return;
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
