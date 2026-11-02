import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getLeaderboard } from "@/lib/online/online.functions";
import { flag } from "@/lib/online/profile-options";
import { useTranslation, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Topplista – Mr. B Ludo" },
      { name: "description", content: "Flest vinster, matcher och utslagna pjäser i verifierade onlinematcher." },
      { property: "og:title", content: "Topplista – Mr. B Ludo" },
      { property: "og:description", content: "Topplistor från verifierade onlinematcher." },
    ],
  }),
  component: LeaderboardPage,
});

const TABS: [string, TranslationKey][] = [["wins", "tabWins"], ["played", "tabPlayed"], ["captures", "tabCaptures"]];
type Rows = Awaited<ReturnType<typeof getLeaderboard>>;

function LeaderboardPage() {
  const { t } = useTranslation();
  const [sort, setSort] = useState<"wins" | "played" | "captures">("wins");
  const [rows, setRows] = useState<Rows | null>(null);
  useEffect(() => { setRows(null); getLeaderboard({ data: { sort } }).then(setRows).catch(() => setRows([])); }, [sort]);
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/online" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        <h1 className="brand-title text-3xl">{t("leaderboardTitle")}</h1>
        <p className="mb-3 text-xs text-muted-foreground">{t("leaderboardNote")}</p>
        <div className="grid grid-cols-3 gap-[7px]">
          {TABS.map(([k, l]) => <button key={k} className={`home-action ${k === sort ? "home-action-gold" : "home-action-ghost"}`} onClick={() => setSort(k as typeof sort)}>{t(l)}</button>)}
        </div>
        <ol className="mt-3 space-y-1.5 text-sm">
          {rows == null && <li className="text-muted-foreground">{t("loading")}</li>}
          {rows?.length === 0 && <li className="text-muted-foreground">{t("noOnlineMatches")}</li>}
          {rows?.map((r, i) => (
            <li key={r.user_id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
              <span className="w-6 font-bold text-gold">{i + 1}.</span>
              <span>{r.profile?.avatar}</span>
              <span className="flex-1 truncate font-semibold">{r.profile?.display_name ?? "?"} {flag(r.profile?.country ?? "")}</span>
              <span className="font-bold">{r[sort]}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
