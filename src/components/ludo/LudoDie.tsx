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
    const token = pipColor?.match(/^var\((--[^)]+)\)$/)?.[1]?.replace(/^--ludo-/, "--board-");
    const raw = token ? getComputedStyle(document.documentElement).getPropertyValue(token).trim() : pipColor ?? "";
    setBodyColor(toRgb(raw));
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
          <DiceScene className={`throw-die ${rolling ? "throw-die-enter" : ""}`} values={[value]} rolling={rolling} fill={0.68} entryFrom="center" skin={bodyColor ? { id: `ludo-${bodyColor}`, body: bodyColor, pip: toRgb(getComputedStyle(document.documentElement).getPropertyValue("--board-mark").trim()) } : undefined} />
        </Suspense>
      )}
    </button>
  );
}

/** Three.js cannot parse oklch(); let the browser convert any CSS color to rgb hex. */
function toRgb(color: string): string {
  if (!color) return "";
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return color;
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("")}`;
}
