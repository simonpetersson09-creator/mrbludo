import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/** iOS-style edge swipe: drag from the left edge to go to the previous page. Not on home or the game board. */
export function SwipeBack() {
  const router = useRouter();
  useEffect(() => {
    let sx = 0, sy = 0, active = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      const path = router.state.location.pathname;
      active = !!t && t.clientX < 28 && path !== "/" && path !== "/play" && !path.startsWith("/match");
      if (t) { sx = t.clientX; sy = t.clientY; }
    };
    const end = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
      if (dx > 70 && dy < dx * 0.6) {
        if (window.history.length > 1) router.history.back();
        else void router.navigate({ to: "/" });
      }
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, [router]);
  return null;
}
