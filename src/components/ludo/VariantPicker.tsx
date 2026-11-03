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
export function VariantPicker({ value, onChange }: { value: Variant; onChange: (v: Variant) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{t("gameMode")}</p>
      <div className="grid grid-cols-2 gap-[7px]" role="radiogroup" aria-label={t("gameMode")}>
        {(["classic", "fia"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={v === value} onClick={() => onChange(v)}
            className={`min-h-10 rounded-xl px-2 font-display text-sm font-bold leading-tight transition active:scale-95 ${v === value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            {t(v === "classic" ? "modeClassic" : "modeFia")}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t(value === "classic" ? "modeClassicRules" : "modeFiaRules")}</p>
    </div>
  );
}
