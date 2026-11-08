import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { adminOverview, adminTestPush } from "@/lib/online/online.functions";
import { useTranslation } from "@/lib/i18n";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const { t } = useTranslation();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true); setErr(null);
    try { setD(await adminOverview()); } catch { setErr("noAdmin"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return (
    <main className="admin-screen bg-background p-4 text-foreground md:p-8">
      <div className="w-full">
        <Link to="/online" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        {err && <><p className="text-sm text-destructive">{t("noAdmin")}</p><Link to="/admin-login" className="home-action">{t("signIn")}</Link></>}
        {!d && !err && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {d && (<>
          <AdminAnalytics data={d} loading={loading} onRefresh={load} />
          <details className="mt-6 border-t border-border pt-4">
          <summary className="cursor-pointer font-semibold">{t("adminTitle")}</summary>
          <div className="grid grid-cols-3 gap-[7px]">
            {([["adminPlayers", d.totals.players], ["adminInMatch", d.totals.activeNow], ["adminActive24", d.totals.active24h], ["adminPlaying", d.totals.playing], ["adminWaiting", d.totals.waiting], ["adminFinished30", d.totals.finished30], ["adminRetD1", d.retention.d1], ["adminRetD7", d.retention.d7], ["adminRetD30", d.retention.d30]] as const).map(([label, value]) => <div key={label} className="py-2 text-center"><p className="text-lg font-bold text-gold">{value ?? "—"}</p><p className="text-xs text-muted-foreground">{t(label)}</p></div>)}
          </div>
          <PushTest />
          <p className="mt-3 text-xs text-muted-foreground">{t("adminChartDevices")} · {t("adminChartMinutes")} · {t("adminChartMinutesNote")}</p>
          <details><summary className="cursor-pointer">{t("adminSessions")}</summary>
          <h2 className="mt-5 font-display text-lg font-bold">{t("last30Days")}</h2>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th>{t("colDate")}</th><th>{t("colAppDevices")}</th><th>{t("colStarted")}</th><th>{t("colFinished")}</th><th>{t("colForfeits")}</th></tr></thead>
            <tbody>
              {[...d.days].reverse().map((r) => (
                <tr key={r.date} className="border-t border-border"><td className="py-1">{r.date}</td><td>{r.appDevices}</td><td>{r.started}</td><td>{r.finished}</td><td>{r.forfeits}</td></tr>
              ))}
            </tbody>
          </table>
          </details>
          </details>
          <details className="mt-6 border-t border-border pt-4"><summary className="cursor-pointer font-semibold">{t("techErrors")}</summary>
          <h2 className="mt-5 font-display text-lg font-bold">{t("techErrors")}</h2>
          {d.healthAlerts.map((a, i) => <pre key={"a" + i} className="mt-1 overflow-x-auto rounded border border-destructive bg-surface p-2 text-[10px] text-destructive">⚠ {a.at} slow:{a.slow} failed:{a.failed} [{a.ops.join(", ")}]</pre>)}
          {d.slowOps.map((e, i) => <pre key={"s" + i} className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[10px]">⏱ {e.at} {JSON.stringify(e.detail)}</pre>)}
          {d.errors.length === 0 && <p className="text-sm text-muted-foreground">{t("noErrors")}</p>}
          {d.errors.map((e, i) => <pre key={i} className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[10px]">{e.at} [{e.platform}] {JSON.stringify(e.detail)}</pre>)}
          </details>
          <details className="mt-6 border-t border-border pt-4"><summary className="cursor-pointer font-semibold">{t("adEvents")}</summary>
          <h2 className="mt-5 font-display text-lg font-bold">{t("adEvents")}</h2>
          {d.ads.length === 0 && <p className="text-sm text-muted-foreground">{t("noAdEvents")}</p>}
          {d.ads.map((e, i) => <pre key={i} className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[10px]">{e.at} [{e.platform}] {JSON.stringify(e.detail)}</pre>)}
          </details>
        </>)}
      </div>
    </main>
  );
}

/** Admin-only: sends a test notification to this admin's own registered iPhone(s). */
function PushTest() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await adminTestPush();
      if (!r.configured) setMsg(t("adminPushOff"));
      else if (!r.devices) setMsg(t("adminPushNone"));
      else setMsg([t("adminPushSent", { sent: r.sent, devices: r.devices }), ...(r.reasons.length ? [t("adminPushFailed", { reason: r.reasons.join(", ") })] : [])].join(" "));
    } catch { setMsg(t("noAdmin")); }
    setBusy(false);
  };
  return (
    <section className="mt-5">
      <h2 className="font-display text-lg font-bold">{t("adminPushTitle")}</h2>
      <Button className="mt-2" disabled={busy} onClick={send}>{t("adminPushSend")}</Button>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}
