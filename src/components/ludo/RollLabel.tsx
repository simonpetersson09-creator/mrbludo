import { Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { GameState } from "@/lib/ludo/engine";

/** Yatzy-style Kasta label: "Din tur" + Kasta on your turn, otherwise a lock and who is throwing. */
export function RollLabel({ state, canRoll, myTurn }: { state: GameState; canRoll: boolean; myTurn: boolean }) {
  const { t } = useTranslation();
  const cur = state.players[state.current];
  if (!myTurn && cur && state.phase !== "finished") {
    return (
      <span className="pointer-events-none flex flex-col items-center gap-1.5 px-1 leading-none">
        <Lock className="h-3.5 w-3.5 opacity-80" strokeWidth={2.2} aria-hidden />
        <span className="max-w-[72px] truncate text-[9px] font-semibold opacity-95">{t("nameThrowing", { name: cur.name })}</span>
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
