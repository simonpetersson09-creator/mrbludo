import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { adminOverview } from "@/lib/online/online.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin – Mr. B Ludo" },
      { name: "description", content: "Matchstatistik, aktiva spelare, enheter, avhopp och fel." },
      { property: "og:title", content: "Admin – Mr. B Ludo" },
      { property: "og:description", content: "Adminpanel för Mr. B Ludo." },
    ],
  }),
  component: AdminPage,
});

type Data = Awaited<ReturnType<typeof adminOverview>>;

function AdminPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { adminOverview().then(setD).catch(() => setErr("Du har inte adminbehörighet.")); }, []);
  const Stat = ({ l, v }: { l: string; v: number | string | null }) => (
    <div className="rounded-[10px] bg-surface py-2 text-center"><p className="text-lg font-bold text-gold">{v ?? "–"}</p><p className="text-xs text-muted-foreground">{l}</p></div>
  );
  return (
    <main className="app-screen">
      <div className="mx-auto w-full max-w-[640px]">
        <Link to="/online" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title mb-3 text-3xl">Admin</h1>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {!d && !err && <p className="text-sm text-muted-foreground">Laddar…</p>}
        {d && (<>
          <div className="grid grid-cols-3 gap-[7px]">
            <Stat l="Spelare totalt" v={d.totals.players} />
            <Stat l="I match nu" v={d.totals.activeNow} />
            <Stat l="Aktiva 24 h" v={d.totals.active24h} />
            <Stat l="Pågående" v={d.totals.playing} />
            <Stat l="Väntrum" v={d.totals.waiting} />
            <Stat l="Avslutade 30 d" v={d.totals.finished30} />
            <Stat l="Retention D1 %" v={d.retention.d1} />
            <Stat l="Retention D7 %" v={d.retention.d7} />
            <Stat l="Retention D30 %" v={d.retention.d30} />
          </div>
          <h2 className="mt-5 font-display text-lg font-bold">Senaste 30 dagarna</h2>
          <p className="text-xs text-muted-foreground">Appenheter = iOS + Android. Webbsessioner visas separat och räknas inte som spelare.</p>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th>Datum</th><th>Appenheter</th><th>Webb</th><th>Startade</th><th>Avslutade</th><th>Avhopp</th></tr></thead>
            <tbody>
              {[...d.days].reverse().map((r) => (
                <tr key={r.date} className="border-t border-border"><td className="py-1">{r.date}</td><td>{r.appDevices}</td><td className="text-muted-foreground">{r.webDevices}</td><td>{r.started}</td><td>{r.finished}</td><td>{r.forfeits}</td></tr>
              ))}
            </tbody>
          </table>
          <h2 className="mt-5 font-display text-lg font-bold">Tekniska fel</h2>
          {d.errors.length === 0 && <p className="text-sm text-muted-foreground">Inga rapporterade fel.</p>}
          {d.errors.map((e, i) => <pre key={i} className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[10px]">{e.at} [{e.platform}] {JSON.stringify(e.detail)}</pre>)}
        </>)}
      </div>
    </main>
  );
}
