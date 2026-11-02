import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { loadStats, resetStats, type Stats } from "@/lib/ludo/storage";

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
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => setS(loadStats()), []);
  const rows: [string, number | string][] = s ? [
    ["Spelade matcher", s.played],
    ["Vinster", s.wins],
    ["Vinstprocent", s.played ? `${Math.round((s.wins / s.played) * 100)} %` : "–"],
    ["Utslagningar", s.captures],
    ["Pjäser i mål", s.piecesHome],
    ["Uppgivna matcher", s.forfeits],
  ] : [];
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title mb-3 text-3xl">Statistik</h1>
        {rows.map(([k, v]) => (
          <div key={k} className="flex h-11 items-center justify-between rounded-[10px] border bg-card px-3 text-sm">
            <span className="text-muted-foreground">{k}</span><span className="font-bold">{v}</span>
          </div>
        ))}
        <button className="home-action home-action-ghost mt-4" onClick={() => { resetStats(); setS(loadStats()); }}>Nollställ statistik</button>
      </div>
    </main>
  );
}
