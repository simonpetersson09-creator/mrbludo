import { useEffect, useState } from "react";
import type { Variant } from "@/lib/ludo/engine";
import { loadVariant, saveVariant } from "@/lib/ludo/storage";
import { useTranslation } from "@/lib/i18n";

/** Remembers the last chosen rule variant (Classic by default), read after mount. */
export function useVariant(): [Variant, (v: Variant) => void] {
  const [variant, setVariant] = useState<Variant>("classic");
  useEffect(() => setVariant(loadVariant()), []);
  return [variant, (v) => { setVariant(v); saveVariant(v); }];
}

/** Classic / Svenska Fia choice with a short rule summary for the selected mode. */
export function VariantPicker({ value, onChange, compact = false }: { value: Variant; onChange: (v: Variant) => void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className={compact ? "mb-1 text-left text-[11px] font-semibold text-foreground" : "mb-3 text-center text-sm text-muted-foreground"}>{t("gameMode")}</p>
      <div className={`grid grid-cols-2 ${compact ? "gap-1.5" : "gap-[7px]"}`} role="radiogroup" aria-label={t("gameMode")}>
        {(["classic", "fia"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={v === value} onClick={() => onChange(v)}
            className={`${compact ? "min-h-9 text-xs" : "min-h-10 text-sm"} rounded-xl border-2 px-2 font-display font-bold leading-tight transition active:scale-95 ${v === value ? "border-primary bg-primary text-primary-foreground shadow-md" : "border-transparent bg-secondary text-secondary-foreground opacity-80"}`}>
            <span className="block">{v === value && <span aria-hidden="true">✓ </span>}{t(v === "classic" ? "modeClassic" : "modeFia")}</span>
            {v === "fia" && <span className={`block font-medium opacity-75 ${compact ? "text-[9px]" : "text-[10px]"}`}>{t("modeFiaRules")}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
