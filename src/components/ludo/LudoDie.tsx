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
  useEffect(() => setMounted(true), []);
  return (
    <button
      type="button"
      aria-label={t("rollDiceAria")}
      onClick={disabled ? undefined : onTap}
      aria-disabled={disabled}
      className="relative h-full w-full overflow-hidden rounded-xl bg-transparent"
    >
      {mounted && (
        <Suspense fallback={null}>
          <DiceScene className="absolute inset-0" values={[value]} rolling={rolling} fill={0.7} pipColor={pipColor} />
        </Suspense>
      )}
    </button>
  );
}
