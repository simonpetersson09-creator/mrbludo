import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { loadStats, resetStats, type Stats } from "@/lib/ludo/storage";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Statistik – Mr. B Ludo" },
      { name: "description", content: "Dina Ludo-matcher, vinster och utslagningar." },
      { property: "og:title", content: "Statistik – Mr. B Ludo" },
      { property: "og:description", content: "Dina Ludo-matcher, vinster och utslagningar." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { t } = useTranslation();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => setS(loadStats()), []);
  const rows: [string, number | string][] = s ? [
    [t("statPlayed"), s.played],
    [t("statWins"), s.wins],
    [t("statWinrate"), s.played ? `${Math.round((s.wins / s.played) * 100)} %` : "–"],
    [t("statCaptures"), s.captures],
    [t("statPiecesHome"), s.piecesHome],
    [t("statForfeits"), s.forfeits],
  ] : [];
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        <h1 className="brand-title mb-3 text-3xl">{t("statsTitle")}</h1>
        {rows.map(([k, v]) => (
          <div key={k} className="flex h-11 items-center justify-between rounded-[10px] border bg-card px-3 text-sm">
            <span className="text-muted-foreground">{k}</span><span className="font-bold">{v}</span>
          </div>
        ))}
        <button className="home-action home-action-ghost mt-4" onClick={() => { resetStats(); setS(loadStats()); }}>{t("resetStats")}</button>
      </div>
    </main>
  );
}
