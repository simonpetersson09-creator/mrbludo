// Haptic feedback, adapted from Mr. B Yatzy's src/lib/haptics.ts.
// Native: Capacitor Haptics. Web: navigator.vibrate fallback (same patterns).
// Ludo deviation: respects the existing Ludo "vibration" setting.
import { Capacitor } from "@capacitor/core";
import { loadSettings } from "@/lib/ludo/storage";

type Kind = "light" | "medium" | "heavy" | "success";
const WEB_PATTERN: Record<Kind, number | number[]> = {
  light: 5, medium: [15, 30, 15], heavy: 25, success: [10, 40, 20],
};

export function hapticsEnabled(): boolean {
  try { return loadSettings().haptics !== false; } catch { return true; }
}

async function play(kind: Kind) {
  if (typeof window === "undefined" || !hapticsEnabled()) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: kind === "light" ? ImpactStyle.Light : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Heavy });
      return;
    } catch { /* fall through */ }
  }
  if ("vibrate" in navigator) navigator.vibrate?.(WEB_PATTERN[kind]);
}

/** "Your turn" pulse. */
export const playTurnHaptic = () => play("medium");
/** Light tap: rolling, moving a piece. */
export const playLightHaptic = () => play("light");
/** Solid thud when the die lands / a capture happens. */
export const playDiceLandHaptic = () => play("heavy");
/** Success: piece home or match won. */
export const playSuccessHaptic = () => play("success");
