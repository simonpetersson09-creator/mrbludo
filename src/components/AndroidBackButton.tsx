import { useEffect, useRef } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { t } from "@/lib/i18n";
import { backAction } from "@/lib/native/back-policy";

/** Closes an open Radix dialog/sheet by simulating Escape (from Yatzy). */
function closeOpenRadixDialog(): boolean {
  const open = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
  if (!open) return false;
  open.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return true;
}

/**
 * Android hardware back / back gesture, ported from Mr. B Yatzy:
 * 1. close the open dialog, 2. in a match ask before leaving (local games are
 * saved and online matches can be resumed — leaving never forfeits),
 * 3. go back a page, 4. on the home screen minimize instead of closing.
 */
export function AndroidBackButton() {
  const router = useRouter();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("backButton", () => {
        if (closeOpenRadixDialog()) return;
        const idx = (window.history.state as { __TSR_index?: number; idx?: number } | null);
        const canGoBack = ((idx?.__TSR_index ?? idx?.idx ?? 0) > 0);
        const action = backAction(pathRef.current, canGoBack);
        if (action === "minimize") void App.minimizeApp();
        else if (action === "confirm-leave") { if (window.confirm(t("leaveMatchConfirm"))) void router.navigate({ to: pathRef.current.startsWith("/online") ? "/online" : "/" }); }
        else if (action === "back") router.history.back();
        else void router.navigate({ to: "/", replace: true });
      });
      if (cancelled) void sub.remove();
      else remove = () => void sub.remove();
    })();
    return () => { cancelled = true; remove?.(); };
  }, [router]);

  return null;
}
