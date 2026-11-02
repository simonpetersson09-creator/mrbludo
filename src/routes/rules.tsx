import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Regler – Mr. B Ludo" },
      { name: "description", content: "Så spelar du Ludo i Mr. B Ludo." },
      { property: "og:title", content: "Regler – Mr. B Ludo" },
      { property: "og:description", content: "Så spelar du Ludo i Mr. B Ludo." },
    ],
  }),
  component: RulesPage,
});

const RULES = [
  "2–4 spelare med fyra pjäser var. Först med alla fyra i mål vinner.",
  "Du behöver en sexa för att flytta ut en pjäs till din startruta.",
  "En sexa ger ett extra kast. Tre sexor i rad avslutar turen.",
  "Landar du på en motståndare skickas den tillbaka till start.",
  "Startrutorna (★) är säkra – där kan ingen slås ut.",
  "Du måste slå exakt för att gå i mål.",
  "Finns inga möjliga drag går turen automatiskt vidare.",
  "När någon vunnit rangordnas övriga efter antal pjäser i mål och hur långt de kommit.",
];

function RulesPage() {
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title mb-3 text-3xl">Regler</h1>
        {RULES.map((r, i) => (
          <div key={i} className="flex gap-3 rounded-[10px] border bg-card p-3 text-sm">
            <span className="font-bold text-gold">{i + 1}</span><span>{r}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
