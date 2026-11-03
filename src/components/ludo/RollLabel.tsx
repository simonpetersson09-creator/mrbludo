import { useTranslation } from "@/lib/i18n";
import type { GameState } from "@/lib/ludo/engine";
import { COLOR_VAR } from "@/lib/ludo/board";

/** Yatzy-style Kasta label: "Din tur" + Kasta on your turn, otherwise whose turn with a pulsing color dot. */
export function RollLabel({ state, canRoll, myTurn }: { state: GameState; canRoll: boolean; myTurn: boolean }) {
  const { t } = useTranslation();
  const cur = state.players[state.current];
  if (!myTurn && cur && state.phase !== "finished") {
    const color = COLOR_VAR[cur.color];
    return (
      <span className="pointer-events-none flex flex-col items-center gap-1 px-1 leading-none">
        <span className="max-w-[72px] truncate text-[10px] font-medium opacity-80">{cur.name}</span>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: color }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        </span>
      </span>
    );
  }
  return (
    <span className="pointer-events-none px-1 text-center leading-tight">
      {canRoll && <span className="mb-1 block text-[9px] font-medium leading-tight">{t("yourTurnLabel")}</span>}
      {t("roll")}
    </span>
  );
}
