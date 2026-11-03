import { lazy, Suspense, useEffect, useState } from "react";
import type { DiceValue } from "@/components/dice-engine/types";
import { useTranslation } from "@/lib/i18n";

// Yatzy's 3D die engine, rendered client-only (WebGL).
const DiceScene = lazy(() => import("@/components/dice-engine/DiceScene").then((m) => ({ default: m.DiceScene })));

interface Props {
  value: DiceValue;
  rolling: boolean;
  pipColor?: string;
  onTap: () => void;
  disabled: boolean;
}

export function LudoDie({ value, rolling, pipColor, onTap, disabled }: Props) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [bodyColor, setBodyColor] = useState("");
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const token = pipColor?.match(/^var\((--[^)]+)\)$/)?.[1];
    setBodyColor(token ? getComputedStyle(document.documentElement).getPropertyValue(token).trim() : pipColor ?? "");
  }, [pipColor]);
  return (
    <button
      type="button"
      aria-label={t("rollDiceAria")}
      onClick={disabled ? undefined : onTap}
      aria-disabled={disabled}
      disabled={disabled}
      className="throw-tray relative h-full w-full"
    >
      <span className="throw-cloth" aria-hidden="true" />
      {mounted && (
        <Suspense fallback={null}>
          <DiceScene className={`throw-die ${rolling ? "throw-die-enter" : ""}`} values={[value]} rolling={rolling} fill={0.68} entryFrom="left" skin={bodyColor ? { id: `ludo-${bodyColor}`, body: bodyColor, pip: getComputedStyle(document.documentElement).getPropertyValue("--board-mark").trim() } : undefined} />
        </Suspense>
      )}
    </button>
  );
}
