import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { supabase } from "@/lib/auth/client";

export const RESUME_EVENT = "mrb-ludo:resume";
export async function startNativeRuntime(goHome: () => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const [{ App }, { Network }, { StatusBar, Style }] = await Promise.all([
    import("@capacitor/app"), import("@capacitor/network"), import("@capacitor/status-bar"),
  ]);
  const handles: PluginListenerHandle[] = [];
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  const resume = () => {
    supabase.auth.startAutoRefresh();
    window.dispatchEvent(new Event(RESUME_EVENT));
  };
  handles.push(await App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) resume();
    else { supabase.auth.stopAutoRefresh(); window.dispatchEvent(new Event("mrb-ludo:pause")); }
  }));
  handles.push(await Network.addListener("networkStatusChange", ({ connected }) => {
    window.dispatchEvent(new Event(connected ? "online" : "offline"));
    if (connected) resume();
  }));
  handles.push(await App.addListener("backButton", () => {
    if (document.querySelector('[role="alertdialog"], [role="dialog"]')) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } else if (window.location.pathname !== "/") goHome();
    else App.exitApp();
  }));
  return () => { handles.forEach(handle => { void handle.remove(); }); };
}