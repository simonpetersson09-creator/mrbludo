import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Flame } from "lucide-react";
import { supabase } from "@/lib/auth/client";
import { getStatsBoards } from "@/lib/online/online.functions";
import { readPageCache, writePageCache } from "@/lib/page-cache";
import { flag } from "@/lib/online/profile-options";
import { useAvatarImages } from "@/lib/ludo/avatar";
import { PlayerAvatar } from "@/components/ludo/PlayerAvatar";
import { loadStats, type Stats } from "@/lib/ludo/storage";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Statistik – Mr. B Ludo" },
      { name: "description", content: "Dina Ludo-matcher, vinster och utslagningar." },
      { property: "og:title", content: "Statistik – Mr. B Ludo" },
      { property: "og:description", content: "Dina Ludo-matcher, vinster och utslagningar." },
    ],
  }),
  component: StatsPage,
});

type Boards = Awaited<ReturnType<typeof getStatsBoards>>;

function countryName(code: string, lang: string) {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function StatsPage() {
  const { t, lang } = useTranslation();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => setS(loadStats()), []);
  const [boards, setBoards] = useState<Boards | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const cached = readPageCache<Boards>("stats-boards");
    if (cached) { setBoards(cached); setLoading(false); }
    void supabase.auth.getSession().then(({ data }) => (data.session ? getStatsBoards() : null))
      .then((b) => { if (alive && b) { setBoards(b); writePageCache("stats-boards", b); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const rows: [string, number | string][] = s ? [
    [t("statPlayed"), s.played],
    [t("statWins"), s.wins],
    [t("statWinrate"), s.played ? `${Math.round((s.wins / s.played) * 100)} %` : "–"],
    [t("statCaptures"), s.captures],
    [t("statPiecesHome"), s.piecesHome],
  ] : [];
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        <h1 className="brand-title mb-3 text-3xl">{t("statsTitle")} {s?.year ?? new Date().getFullYear()}</h1>
        {rows.map(([k, v]) => (
          <div key={k} className="flex h-11 items-center justify-between rounded-[10px] border bg-card px-3 text-sm">
            <span className="text-muted-foreground">{k}</span><span className="font-bold">{v}</span>
          </div>
        ))}
        <WeeklyMostActive boards={boards} loading={loading} />
        <TopCountries boards={boards} loading={loading} lang={lang} />
      </div>
    </main>
  );
}

// Ported from Yatzy's StatsPage "Månadens flitigaste" list (without XP prizes, which Ludo does not have).
function WeeklyMostActive({ boards, loading }: { boards: Boards | null; loading: boolean }) {
  const { t, lang } = useTranslation();
  const rows = boards?.weekly ?? [];
  const pics = useAvatarImages(rows.map((r) => r.user_id));
  return (
    <section className="mt-5 space-y-2">
      <div className="flex items-center gap-1.5 px-2">
        <Flame className="h-4 w-4 text-gold" />
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">{t("hofGamesTitle")}</p>
      </div>
      <p className="-mt-1 px-2 text-[11px] text-muted-foreground/70">{t("hofGamesSubtitle")}</p>
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-secondary/50">
        <div className="flex justify-end gap-3 px-3 pb-1 pt-2 text-[10px] text-muted-foreground">
          <span className="w-14 text-right">24h</span>
          <span className="w-12 text-right">{t("hofMatches")}</span>
        </div>
        {loading && <div className="p-4 text-sm text-muted-foreground">{t("loading")}</div>}
        {!loading && rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">{t("hofEmpty")}</div>}
        {rows.map((p, i) => (
          <div key={p.user_id} className={`flex items-center gap-2.5 px-3 py-2 ${i > 0 ? "border-t border-border/20" : ""} ${p.user_id === boards?.me ? "bg-primary/10" : i < 3 ? "bg-gold/5" : ""}`}>
            <span className="w-7 shrink-0 text-center font-display font-bold tabular-nums text-muted-foreground">
              {i < 3 ? <span className="text-2xl" aria-hidden="true">{["🥇", "🥈", "🥉"][i]}</span> : i + 1}
            </span>
            <PlayerAvatar emoji={p.avatar} image={pics[p.user_id]} className="h-7 w-7 bg-secondary text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.display_name} {flag(p.country)}</p>
            </div>
            <p className="w-14 shrink-0 text-right font-display text-base font-bold tabular-nums text-gold">{p.games_24h ? `+ ${p.games_24h.toLocaleString(lang)}` : "—"}</p>
            <p className="w-12 shrink-0 text-right font-display text-lg font-bold tabular-nums text-primary">{p.games.toLocaleString(lang)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Collapsed by default; tap the title to expand (same as Yatzy). */
function TopCountries({ boards, loading, lang }: { boards: Boards | null; loading: boolean; lang: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rows = boards?.countries ?? [];
  return (
    <section className="mt-3 space-y-2">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between rounded-2xl border border-border/40 bg-secondary/50 px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">{t("topCountriesYearTitle", { year: new Date().getFullYear() })}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-secondary/50">
          {loading && <div className="p-4 text-sm text-muted-foreground">{t("loading")}</div>}
          {!loading && rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">—</div>}
          {rows.map((c, i) => (
            <div key={c.country} className={`flex items-center justify-center gap-3 px-4 py-2 ${i > 0 ? "border-t border-border/30" : ""}`}>
              <div className="flex w-48 min-w-0 items-center gap-3">
                <span className={`w-6 text-center font-display font-bold tabular-nums ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
                <span className="text-lg">{flag(c.country)}</span>
                <p className="truncate text-sm font-semibold">{countryName(c.country, lang)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
