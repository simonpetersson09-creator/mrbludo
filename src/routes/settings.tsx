import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { loadSettings, saveSettings, type Settings } from "@/lib/ludo/storage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Inställningar – Mr. B Ludo" },
      { name: "description", content: "Spelarnamn, datorns tempo och vibration." },
      { property: "og:title", content: "Inställningar – Mr. B Ludo" },
      { property: "og:description", content: "Spelarnamn, datorns tempo och vibration." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => setS(loadSettings()), []);
  if (!s) return <main className="app-screen" />;
  const update = (patch: Partial<Settings>) => { const n = { ...s, ...patch }; setS(n); saveSettings(n); };
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title mb-3 text-3xl">Inställningar</h1>
        <label className="text-xs text-muted-foreground" htmlFor="name">Ditt namn</label>
        <input id="name" maxLength={16} className="h-11 rounded-[10px] border bg-card px-3 text-sm outline-none focus:border-gold" value={s.name} onChange={(e) => update({ name: e.target.value })} />
        <p className="mt-3 text-xs text-muted-foreground">Datorns tempo</p>
        <div className="grid grid-cols-3 gap-[7px]">
          {(["slow", "normal", "fast"] as const).map((v) => (
            <button key={v} className={`home-action ${s.botSpeed === v ? "home-action-gold" : "home-action-ghost"}`} onClick={() => update({ botSpeed: v })}>
              {v === "slow" ? "Lugnt" : v === "normal" ? "Normalt" : "Snabbt"}
            </button>
          ))}
        </div>
        <div className="mt-3 flex h-11 items-center justify-between rounded-[10px] border bg-card px-3 text-sm">
          <span>Vibration</span>
          <Switch checked={s.haptics} onCheckedChange={(v) => update({ haptics: v })} />
        </div>
      </div>
    </main>
  );
}
