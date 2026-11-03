import { Star } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/** Small overlay card asking the player to rate the app (Yatzy design). */
export function RateAppPrompt({ onRate, onLater }: { onRate: () => void; onLater: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 px-5 pb-8 backdrop-blur-sm sm:items-center" onClick={onLater}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-gold/30 bg-secondary p-5 text-center shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        <div className="relative flex flex-col items-center gap-3">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-5 w-5 fill-gold text-gold" />)}
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">{t("rateTitle")}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("rateBody")}</p>
          <div className="mt-1 flex w-full flex-col gap-2">
            <button type="button" onClick={onRate} className="min-h-11 w-full rounded-2xl bg-primary py-3 font-display text-sm font-bold text-primary-foreground active:scale-[0.97]">{t("rateNow")}</button>
            <button type="button" onClick={onLater} className="min-h-11 w-full rounded-2xl py-2.5 text-xs font-semibold text-muted-foreground active:scale-[0.97]">{t("rateLater")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
