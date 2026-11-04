import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { getStatsBoards, lobbyNotices } from "@/lib/online/online.functions";
import { RESUME_EVENT } from "@/lib/native/runtime";
import { PUSH_ASK_EVENT } from "@/lib/native/push";
import { t as translate, useTranslation } from "@/lib/i18n";
import { passedBy, type BoardMemory } from "@/lib/online/board-notice";

const JOIN_SEEN = "mrb-ludo:v1:seen-lobby-joins";
const BOARD_KEY = "mrb-ludo:v1:monthly-board";
const readJson = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? "") as T; } catch { return d; } };
const writeJson = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };

/**
 * Yatzy's app-wide notices: a friend joined your waiting room, someone passed you on
 * "Månadens flitigaste", and our own explanation before Apple's notification question.
 */
export function AppNotices({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [ask, setAsk] = useState<((yes: boolean) => void) | null>(null);

  useEffect(() => {
    const onAsk = (e: Event) => { const answer = (e as CustomEvent<(yes: boolean) => void>).detail; setAsk(() => answer); };
    window.addEventListener(PUSH_ASK_EVENT, onAsk);
    return () => window.removeEventListener(PUSH_ASK_EVENT, onAsk);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let poll: number | null = null;
    const checkJoins = async () => {
      try {
        const { joins, rooms } = await lobbyNotices();
        if (stopped) return;
        const seen = readJson<string[]>(JOIN_SEEN, []);
        const fresh = joins.filter((j) => !seen.includes(`${j.matchId}:${j.userId}`));
        writeJson(JOIN_SEEN, [...seen, ...fresh.map((j) => `${j.matchId}:${j.userId}`)].slice(-100));
        for (const j of fresh.slice(0, 3)) {
          if (window.location.pathname === `/online/${j.matchId}`) continue; // the waiting room shows it already
          toast(translate("lobbyJoinToast", { name: j.name }), { duration: 10_000, action: { label: translate("openWaitingRoom"), onClick: () => { void router.navigate({ to: "/online/$matchId", params: { matchId: j.matchId } }); } } });
        }
        // Keep listening only while a waiting room is actually open.
        if (poll == null && rooms > 0) poll = window.setInterval(() => { void checkJoins(); }, 8000);
        else if (poll != null && rooms === 0) { window.clearInterval(poll); poll = null; }
      } catch { /* offline */ }
    };
    let lastBoard = 0;
    const checkBoard = async () => {
      if (Date.now() - lastBoard < 10 * 60_000) return;
      lastBoard = Date.now();
      try {
        const { me, weekly } = await getStatsBoards();
        if (stopped) return;
        const now: BoardMemory = { month: new Date().toISOString().slice(0, 7), ids: weekly.map((r) => r.user_id) };
        const name = passedBy(readJson<BoardMemory | null>(BOARD_KEY, null), now, me, Object.fromEntries(weekly.map((r) => [r.user_id, r.display_name])));
        writeJson(BOARD_KEY, now);
        if (name) {
          const rank = now.ids.indexOf(me) + 1;
          toast(rank > 0 ? translate("passedToast", { name, n: rank }) : translate("passedOutToast", { name }), {
            duration: 10_000, action: { label: translate("seeList"), onClick: () => { void router.navigate({ to: "/stats" }); } },
          });
        }
      } catch { /* offline */ }
    };
    const run = () => { void checkJoins(); void checkBoard(); };
    const timer = window.setTimeout(run, 2500);
    window.addEventListener(RESUME_EVENT, run);
    return () => { stopped = true; window.clearTimeout(timer); if (poll != null) window.clearInterval(poll); window.removeEventListener(RESUME_EVENT, run); };
  }, [enabled, router]);

  if (!ask) return null;
  const answer = (yes: boolean) => { ask(yes); setAsk(null); };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-background/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="push-ask-title">
      <div className="w-full max-w-sm rounded-2xl border border-gold/40 bg-card p-5 text-center shadow-xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15"><Bell className="h-6 w-6 text-gold" /></div>
        <h2 id="push-ask-title" className="font-display text-lg font-bold">{t("pushAskTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("pushAskBody")}</p>
        <button type="button" className="home-action home-action-success mt-4" onClick={() => answer(true)}>{t("pushAskYes")}</button>
        <button type="button" className="home-action home-action-ghost mt-2" onClick={() => answer(false)}>{t("pushAskLater")}</button>
      </div>
    </div>
  );
}
