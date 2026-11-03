import { useEffect, useState } from "react";
import { variantOf, type GameState } from "@/lib/ludo/engine";
import { useTranslation } from "@/lib/i18n";

const KEY = "mrb-ludo:v1:match-start:";

/** Pure: 1-based round from completed turns. */
export function roundOf(state: GameState): number {
  return Math.floor(state.turnCount / Math.max(1, state.players.length)) + 1;
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Slim info row above the board: mode · elapsed time · round. Presentation only. */
export function MatchInfoBar({ state, gameKey }: { state: GameState; gameKey: string }) {
  const { t } = useTranslation();
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fresh = state.turnCount === 0 && state.lastEvent == null;

  useEffect(() => {
    const k = KEY + gameKey;
    let v: number | null = null;
    try {
      const raw = window.localStorage.getItem(k);
      v = raw && !fresh ? Number(raw) : null;
      if (!v || !Number.isFinite(v)) { v = Date.now(); window.localStorage.setItem(k, String(v)); }
    } catch { v = Date.now(); }
    setStart(v);
  }, [gameKey, fresh]);

  const finished = state.phase === "finished";
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [finished]);

  const mode = variantOf(state) === "fia" ? t("modeFia") : t("modeClassic");
  return (
    <div className="match-info-bar font-display" aria-label={mode}>
      <span className="match-info-chip">{mode}</span>
      <span className="match-info-chip match-info-time">{start ? formatElapsed(now - start) : "0:00"}</span>
      <span className="match-info-chip">{t("roundN", { n: roundOf(state) })}</span>
    </div>
  );
}
