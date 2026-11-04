import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { adminOverview, adminTestPush } from "@/lib/online/online.functions";
import { useTranslation } from "@/lib/i18n";

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
  useEffect(() => { adminOverview().then(setD).catch(() => setErr("noAdmin")); }, []);
  const Stat = ({ l, v }: { l: string; v: number | string | null }) => (
    <div className="rounded-[10px] bg-surface py-2 text-center"><p className="text-lg font-bold text-gold">{v ?? "–"}</p><p className="text-xs text-muted-foreground">{l}</p></div>
  );
  return (
    <main className="app-screen">
      <div className="mx-auto w-full max-w-[640px]">
        <Link to="/online" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        <h1 className="brand-title mb-3 text-3xl">{t("adminTitle")}</h1>
        {err && <><p className="text-sm text-destructive">{t("noAdmin")}</p><Link to="/admin-login" className="home-action">{t("signIn")}</Link></>}
        {!d && !err && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {d && (<>
          <div className="grid grid-cols-3 gap-[7px]">
            <Stat l={t("adminPlayers")} v={d.totals.players} />
            <Stat l={t("adminInMatch")} v={d.totals.activeNow} />
            <Stat l={t("adminActive24")} v={d.totals.active24h} />
            <Stat l={t("adminPlaying")} v={d.totals.playing} />
            <Stat l={t("adminWaiting")} v={d.totals.waiting} />
            <Stat l={t("adminFinished30")} v={d.totals.finished30} />
            <Stat l={t("adminRetD1")} v={d.retention.d1} />
            <Stat l={t("adminRetD7")} v={d.retention.d7} />
            <Stat l={t("adminRetD30")} v={d.retention.d30} />
          </div>
          <PushTest />
          <Chart title={t("adminChartDevices")} values={d.days.map((r) => r.appDevices)} dates={d.days.map((r) => r.date)} />
          <Chart title={t("adminChartMinutes")} note={t("adminChartMinutesNote")} values={d.days.map((r) => r.avgMinutes ?? 0)} dates={d.days.map((r) => r.date)} extra={d.days.map((r) => r.appSessions)} extraLabel={t("adminSessions")} />
          <h2 className="mt-5 font-display text-lg font-bold">{t("last30Days")}</h2>
          <p className="text-xs text-muted-foreground">{t("appDevicesNote")}</p>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th>{t("colDate")}</th><th>{t("colAppDevices")}</th><th>{t("colWeb")}</th><th>{t("colStarted")}</th><th>{t("colFinished")}</th><th>{t("colForfeits")}</th></tr></thead>
            <tbody>
              {[...d.days].reverse().map((r) => (
                <tr key={r.date} className="border-t border-border"><td className="py-1">{r.date}</td><td>{r.appDevices}</td><td className="text-muted-foreground">{r.webDevices}</td><td>{r.started}</td><td>{r.finished}</td><td>{r.forfeits}</td></tr>
              ))}
            </tbody>
          </table>
          <h2 className="mt-5 font-display text-lg font-bold">{t("techErrors")}</h2>
          {d.errors.length === 0 && <p className="text-sm text-muted-foreground">{t("noErrors")}</p>}
          {d.errors.map((e, i) => <pre key={i} className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[10px]">{e.at} [{e.platform}] {JSON.stringify(e.detail)}</pre>)}
          <h2 className="mt-5 font-display text-lg font-bold">{t("adEvents")}</h2>
          {d.ads.length === 0 && <p className="text-sm text-muted-foreground">{t("noAdEvents")}</p>}
          {d.ads.map((e, i) => <pre key={i} className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[10px]">{e.at} [{e.platform}] {JSON.stringify(e.detail)}</pre>)}
        </>)}
      </div>
    </main>
  );
}

/** Simple 30-day bar chart (app devices or average visit minutes per day); tap a bar to read its value. */
function Chart({ title, note, values, dates, extra, extraLabel }: { title: string; note?: string; values: number[]; dates: string[]; extra?: number[]; extraLabel?: string }) {
  const [pick, setPick] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const i = pick ?? values.length - 1;
  return (
    <section className="mt-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <p className="mt-1 text-xs text-muted-foreground">{dates[i]}: <span className="font-bold text-gold">{values[i]}</span>{extra && extraLabel ? ` · ${extraLabel}: ${extra[i]}` : ""}</p>
      <div className="mt-2 flex h-28 items-end gap-[3px] rounded-[10px] bg-surface p-2">
        {values.map((v, k) => (
          <button key={dates[k]} type="button" aria-label={`${dates[k]}: ${v}`} onClick={() => setPick(k)}
            className={`min-w-0 flex-1 rounded-t-[3px] ${k === i ? "bg-gold" : "bg-primary/70"}`} style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{dates[0]?.slice(5)}</span><span>{dates[dates.length - 1]?.slice(5)}</span></div>
    </section>
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
      <button type="button" className="home-action mt-2" disabled={busy} onClick={send}>{t("adminPushSend")}</button>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}
