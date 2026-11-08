import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChartLine, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminAdDiagnostics from "@/components/AdminAdDiagnostics";
import AdminLineChart from "./AdminLineChart";
import { adminRecordIndexes, adminReturningShare, adminRollingMean, adminValueIncomplete, buildRibbon, type AdminColumnKey, type AdminDayRow as DayRow, type StarPoint } from "@/lib/online/admin-records";
import type { adminOverview } from "@/lib/online/online.functions";

const COLUMNS: { key: AdminColumnKey; label: string }[] = [
  { key: "devices", label: "Aktiva enheter" },
  { key: "played", label: "Enheter som spelade" },
  { key: "returning_played", label: "Spelade även igår (antal / andel)" },
  { key: "new_players", label: "Nya spelare (första registrerade spel)" },
  { key: "referral_new_players", label: "Varav via inbjudan" },
  { key: "ios", label: "iPhone / Android" },
  { key: "avg_app_age_days", label: "Medelappålder (dagar)" },
  { key: "total", label: "Färdiga matcher totalt" },
  { key: "cpu_finished", label: "Mot datorn" },
  { key: "online_finished", label: "Online (inkl. Snabbspel)" },
  { key: "forfeits", label: "Avhopp online" },
  { key: "issues", label: "Problemhändelser (2 senaste versionerna)" },
  { key: "post_match_shown", label: "Matchannonser visade / tillfällen" },
];

/** Columns where the highest number is a bad day rather than an achievement. */
const WORST_COLUMNS: AdminColumnKey[] = ["forfeits", "issues"];

function fmtDay(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default function AdminAnalytics({ data, loading, onRefresh }: { data: Awaited<ReturnType<typeof adminOverview>>; loading: boolean; onRefresh: () => Promise<void> }) {
  const [diagram, setDiagram] = useState(false);
  const rows = useMemo<DayRow[]>(() => [...data.days].reverse().map((r) => ({ day: r.date, devices: r.appDevices, ios: null, android: null, played: null, total: r.finished, cpu_finished: null, online_finished: null, forfeits: r.forfeits, issues: 0, incomplete_columns: ["issues"] })), [data.days]);
  const [collapsedColumns, setCollapsedColumns] = useState<AdminColumnKey[]>([]);
  const records = useMemo(() => adminRecordIndexes(rows, COLUMNS.map((c) => c.key)), [rows]);
  const meanText = (day: string, key: AdminColumnKey) => {
    const value = adminRollingMean(rows, day, key);
    return value == null ? "—" : value.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  };
  const wrapRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ gold: StarPoint[]; red: StarPoint[]; w: number; h: number }>({
    gold: [],
    red: [],
    w: 0,
    h: 0,
  });

  // Connect stars in table-column order, always left to right.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const table = wrap.querySelector("table");
    if (!table) return;
    const order = COLUMNS.map((c) => c.key);
    const measure = () => {
      const box = wrap.getBoundingClientRect();
      const stars = Array.from(wrap.querySelectorAll<HTMLElement>("[data-star]")).map((el) => {
        const b = el.getBoundingClientRect();
        const row = el.closest("tr");
        const rb = row ? row.getBoundingClientRect() : b;
        return {
          key: el.dataset["star"] as AdminColumnKey,
          day: el.dataset["day"] ?? "",
          x: b.left - box.left - wrap.clientLeft + wrap.scrollLeft + b.width / 2,
          y: b.top - box.top - wrap.clientTop + wrap.scrollTop + b.height / 2,
          lane: rb.top - box.top - wrap.clientTop + wrap.scrollTop + 3,
        };
      });
      const byColumn = (a: StarPoint, b: StarPoint) => order.indexOf(a.key) - order.indexOf(b.key);
      setLines({
        gold: stars.filter((s) => !WORST_COLUMNS.includes(s.key)).sort(byColumn),
        red: stars.filter((s) => WORST_COLUMNS.includes(s.key)).sort(byColumn),
        w: table.offsetWidth,
        h: table.offsetHeight,
      });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(table);
    let active = true;
    void document.fonts?.ready.then(() => { if (active) measure(); });
    window.addEventListener("resize", measure);
    return () => {
      active = false;
      observer?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [rows, diagram, collapsedColumns]);

  const sum = (k: keyof DayRow): number | string => rows.some((r) => adminValueIncomplete(r, k)) ? "—" : k === "total" ? rows.reduce((a,r) => a + r.total, 0) : rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{diagram ? "Linjediagram" : "Statistik per dag"}{data.days[0] ? ` – från ${fmtDay(data.days[0].date)}` : ""}</h1>
          <p className="text-sm text-muted-foreground">
            Bara appen (iPhone/Android). Datum enligt befintliga loggar (UTC). Dagens rad är inte komplett. Parentes: dagsmedel för 30 dagar till och med radens datum; — när ett helt underlag saknas.
          </p>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setDiagram(!diagram)}>
          {diagram ? <ArrowLeft /> : <ChartLine />}{diagram ? "Till tabellen" : "Diagram"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void onRefresh()} disabled={loading}>
          <RefreshCw />{loading ? "Uppdaterar…" : "Uppdatera"}
        </Button>
        <Button asChild variant="outline" size="sm"><Link to="/online"><ArrowLeft />Tillbaka</Link></Button>
        </div>
      </div>
      <AdminAdDiagnostics />
      <p className="my-3 text-sm text-muted-foreground">Mätningen är nollställd. Saknat underlag visas som —.</p>
      {diagram ? <AdminLineChart rows={rows} /> : <>
      <div ref={wrapRef} className="relative overflow-x-auto rounded-lg border border-border">
        <svg
          className="pointer-events-none absolute left-0 top-0 z-0"
          width={lines.w}
          height={lines.h}
          aria-hidden="true"
        >
          <path
            d={buildRibbon(lines.gold)}
            fill="none"
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1}
            style={{ stroke: "var(--primary)" }}
          />
          <path
            d={buildRibbon(lines.red)}
            fill="none"
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1}
            style={{ stroke: "var(--destructive)" }}
          />
          {lines.gold.map((p, i) => (
            <circle key={`g${i}`} cx={p.x} cy={p.y} r={2.5} style={{ fill: "var(--primary)" }} />
          ))}
          {lines.red.map((p, i) => (
            <circle key={`r${i}`} cx={p.x} cy={p.y} r={2.5} style={{ fill: "var(--destructive)" }} />
          ))}
        </svg>
        <table className="relative z-10 w-full text-sm">
          <thead className="bg-card">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium align-bottom">Datum</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`${collapsedColumns.includes(c.key) ? "px-1" : "px-2"} py-1.5 font-medium align-bottom leading-tight max-w-[7.5rem]`}>
                  <span className="flex items-end justify-end gap-0.5 text-right">
                    {collapsedColumns.includes(c.key) ? (c.key === "devices" ? "Aktiva" : "iOS/Android") : c.label}
                    {(c.key === "devices" || c.key === "ios") && <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 self-center"
                      aria-label={`${collapsedColumns.includes(c.key) ? "Fäll ut" : "Minimera"} ${c.label}`}
                      aria-expanded={!collapsedColumns.includes(c.key)}
                      title={`${collapsedColumns.includes(c.key) ? "Fäll ut" : "Minimera"} ${c.label}`}
                      onClick={() => setCollapsedColumns((keys) => keys.includes(c.key) ? keys.filter((key) => key !== c.key) : [...keys, c.key])}
                    >
                      {collapsedColumns.includes(c.key) ? <ChevronRight /> : <ChevronLeft />}
                    </Button>}
                    {!collapsedColumns.includes(c.key) && <span className="w-0" aria-hidden="true" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.day} className="border-t border-border">
                <td className="px-2 py-1 whitespace-nowrap">{fmtDay(r.day)}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`${collapsedColumns.includes(c.key) ? "px-1" : "px-2"} py-1 whitespace-nowrap`}>
                    {!collapsedColumns.includes(c.key) &&
                    <span className="flex items-baseline justify-end gap-1 tabular-nums">
                      <span className="text-right">
                        {c.key === "ios" ? <>{r.ios ?? "—"} <span className="text-muted-foreground">({meanText(r.day, "ios")})</span> / {r.android ?? "—"} <span className="text-muted-foreground">({meanText(r.day, "android")})</span></> : <>
                          {c.key === "avg_app_age_days" ? r[c.key] == null ? "—" : Number(r[c.key]).toLocaleString("sv-SE", { maximumFractionDigits: 0 }) : c.key === "total" ? r.total : adminValueIncomplete(r, c.key) ? "—" : r[c.key] ?? "—"}
                          
                          {" "}<span className="text-muted-foreground">({meanText(r.day, c.key)})</span>
                          {c.key === "issues" && <><br /><span className="text-muted-foreground">{r.issue_devices ?? "—"} enheter ({meanText(r.day, "issue_devices")})</span></>}
                          {c.key === "returning_played" && <><br /><span className="text-muted-foreground">{adminReturningShare(r) == null ? "—" : `${adminReturningShare(r)?.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`} av {r.played ?? "—"}</span></>}
                          {c.key === "post_match_shown" && <> / {r.post_match_opportunities ?? "—"} <span className="text-muted-foreground">({meanText(r.day, "post_match_opportunities")})</span></>}
                          {c.key === "forfeits" && <><br /><span className="text-muted-foreground">av — · —</span></>}
                        </>}
                      </span>
                      <span className="w-7 h-5 flex items-center justify-center" aria-hidden="true">
                        {records[c.key] === i && (
                          <span
                            data-star={c.key}
                            data-day={r.day}
                            title={WORST_COLUMNS.includes(c.key) ? "Flest i visad period" : "Rekord i visad period"}
                            className={`inline-block leading-none text-xl scale-150 ${WORST_COLUMNS.includes(c.key) ? "text-destructive" : "text-primary"}`}
                          >
                            ★
                          </span>
                        )}
                      </span>
                    </span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-card font-medium">
            <tr className="border-t border-border">
              <td className="px-3 py-2">Summa</td>
              {COLUMNS.map((c) => (
                <td key={c.key} className={`${collapsedColumns.includes(c.key) ? "px-1" : "px-2"} py-1.5 whitespace-nowrap`}>
                  {!collapsedColumns.includes(c.key) &&
                  <span className="flex items-baseline justify-end gap-1 tabular-nums">
                    <span className="text-right">
                      {c.key === "devices" || c.key === "ios" || c.key === "played" || c.key === "returning_played" || c.key === "avg_app_age_days" ? "—" : c.key === "post_match_shown" ? `${sum(c.key)} / ${sum("post_match_opportunities")}` : c.key === "forfeits" ? `${sum(c.key)} av —` : sum(c.key)}
                    </span>
                    <span className="w-0" aria-hidden="true" />
                  </span>}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">★ = högsta kända värdet i visad period. Avhopp och problem markeras med röd stjärna. Enheter summeras inte mellan dagar. Parenteser visar dagsmedel när fullständigt underlag finns.</p>
      </>}
    </section>
  );
}
