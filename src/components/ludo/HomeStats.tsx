import { useEffect, useState } from "react";
import { ChevronDown, Gamepad2, Swords, Trophy } from "lucide-react";
import { supabase } from "@/lib/auth/client";
import { getMyRanks } from "@/lib/online/online.functions";
import { flag } from "@/lib/online/profile-options";
import { loadStats } from "@/lib/ludo/storage";
import { useTranslation } from "@/lib/i18n";
import { combineHomeStats, type OnlineRanks } from "@/lib/ludo/home-stats";

const CACHE = "mrb-ludo:v1:rank-cache";

function readCache(): OnlineRanks | null {
  try { const raw = localStorage.getItem(CACHE); return raw ? (JSON.parse(raw) as OnlineRanks) : null; } catch { return null; }
}

function countryName(code: string, lang: string) {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code; } catch { return code; }
}

/** Port of Yatzy's home "Dina siffror – all time" section, with Ludo's three numbers. */
export function HomeStats() {
  const { t, lang } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState(() => ({ played: 0, wins: 0, captures: 0, forfeits: 0, piecesHome: 0 }));
  const [online, setOnline] = useState<OnlineRanks | null>(null);

  useEffect(() => {
    setLocal(loadStats());
    setOnline(readCache());
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session || cancelled) return;
      return getMyRanks().then((r) => {
        if (cancelled) return;
        setOnline(r);
        try { localStorage.setItem(CACHE, JSON.stringify(r)); } catch { /* ignore */ }
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const s = combineHomeStats(local, online);
  const card = "flex flex-col items-center gap-0.5 py-2 sm:py-2.5 px-1.5 rounded-2xl bg-secondary/60 border border-border/50";
  const rankCard = "relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border border-border/50 bg-secondary/60 px-2 py-2.5";

  return (
    <div className="relative w-full max-w-md space-y-2.5 px-5 pb-6 pt-4">
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="mb-1 flex w-full items-center justify-center gap-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{t("homeStatsTitle")}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t("statGamesShort"), value: s.played, icon: Gamepad2 },
          { label: t("statWins"), value: s.wins, icon: Trophy },
          { label: t("statKnockedOut"), value: s.captures, icon: Swords },
        ].map((stat) => (
          <div key={stat.label} className={card}>
            <stat.icon className="h-3 w-3 text-primary/70" />
            <span className="font-display text-lg font-black leading-none tabular-nums text-foreground sm:text-xl">{stat.value}</span>
            <span className="max-w-full truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-2">
          <div className={rankCard}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent" />
            <div className="relative z-10 flex items-center gap-1.5">
              <span className="text-xl leading-none" aria-hidden>{s.country ? flag(s.country) : "🏳️"}</span>
              <span className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.country ? t("countryRankLabelFull", { country: countryName(s.country, lang) }) : t("countryRankLabel")}
              </span>
            </div>
            <div className="relative z-10 mt-0.5 flex items-baseline justify-center">
              <span className="mr-0.5 select-none font-display text-base font-medium leading-none text-muted-foreground/50 sm:text-lg">#</span>
              <span className="bg-gradient-to-br from-gold-light via-primary to-gold-dark bg-clip-text font-display text-xl font-black leading-none tracking-tighter tabular-nums text-transparent sm:text-2xl">
                {s.countryRank ?? "–"}
              </span>
            </div>
            <div className="relative z-10 h-0.5 w-8 rounded-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          </div>
          <div className={rankCard}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 to-transparent" />
            <div className="relative z-10 flex items-center gap-1.5">
              <span className="text-xl leading-none" aria-hidden>🌍</span>
              <span className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{t("worldRankLabelFull")}</span>
            </div>
            <div className="relative z-10 mt-0.5 flex items-baseline justify-center">
              <span className="mr-0.5 select-none font-display text-base font-medium leading-none text-muted-foreground/50 sm:text-lg">#</span>
              <span className="bg-gradient-to-br from-info-light via-info to-info-dark bg-clip-text font-display text-xl font-black leading-none tracking-tighter tabular-nums text-transparent sm:text-2xl">
                {s.worldRank ?? "–"}
              </span>
            </div>
            <div className="relative z-10 h-0.5 w-8 rounded-full bg-gradient-to-r from-transparent via-info/50 to-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
