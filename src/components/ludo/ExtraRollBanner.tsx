import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/ludo/engine";
import { useTranslation } from "@/lib/i18n";

const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];

/** Short "Slå igen!" banner when a six (or goal/capture) gives the same player another roll. */
export function ExtraRollBanner({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const [color, setColor] = useState<number | null>(null);
  const seen = useRef(state.lastEvent);
  useEffect(() => {
    const ev = state.lastEvent;
    if (ev === seen.current) return;
    seen.current = ev;
    if (!ev || ev.kind !== "moved" || !ev.extraRoll || state.phase !== "roll" || state.current !== ev.player) return;
    setColor(state.players[ev.player].color);
    const tm = window.setTimeout(() => setColor(null), 1300);
    return () => window.clearTimeout(tm);
  }, [state]);
  if (color == null) return null;
  return (
    <div className="turn-banner" aria-hidden="true" style={{ "--pc": COLOR_VAR[color] } as React.CSSProperties}>
      <span className="font-display text-[13px] font-bold" style={{ color: COLOR_VAR[color] }}>🎲 {t("extraRoll")}</span>
    </div>
  );
}
