import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { deepLinkPath } from "@/lib/native/deep-link";

/** Opens invite links in the app, both while running and from a cold start. */
export function NativeDeepLinks() {
  const router = useRouter();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    const open = (url: string | undefined) => { const to = url ? deepLinkPath(url) : null; if (to) void router.navigate({ href: to }); };
    (async () => {
      const { App } = await import("@capacitor/app");
      const launch = await App.getLaunchUrl();
      if (!cancelled) open(launch?.url);
      const sub = await App.addListener("appUrlOpen", (e) => open(e.url));
      if (cancelled) void sub.remove(); else remove = () => void sub.remove();
    })();
    return () => { cancelled = true; remove?.(); };
  }, [router]);
  return null;
}
