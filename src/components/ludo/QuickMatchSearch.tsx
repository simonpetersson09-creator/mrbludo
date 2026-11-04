import type { Variant } from "@/lib/ludo/engine";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dices, Users } from "lucide-react";
import { ensurePlayerSession } from "@/lib/auth/player";
import { leaveMatch, quickFinalize, quickMatch, quickStatus } from "@/lib/online/online.functions";
import { useTranslation } from "@/lib/i18n";
import { setQuickSearchActive } from "@/lib/ads/waiting-room";

/** Same timing as Yatzy's QuickMatchSearch. */
const SEARCH_MS = 15_000;
const POLL_MS = 2_000;
const FOUND_MS = 2_000;

interface Props {
  players: number;
  variant: Variant;
  onMatch: (matchId: string) => void;
  onNoMatch: () => void;
  onCancel: () => void;
}

/**
 * Port of Yatzy's quick-match search: look for online players for 15 s; full group starts at once,
 * otherwise the server fills empty seats with computer players, and nobody found → local bot game.
 */
export function QuickMatchSearch({ players, variant, onMatch, onNoMatch, onCancel }: Props) {
  const { t } = useTranslation();
  const [count, setCount] = useState(1);
  const [found, setFound] = useState<string | null>(null);
  const matchRef = useRef<string | null>(null);
  const doneRef = useRef(false);
  const cb = useRef({ onMatch, onNoMatch });
  cb.current = { onMatch, onNoMatch };

  // Online play is where notifications matter: ask for permission here, never at launch.
  useEffect(() => { void import("@/lib/native/push").then((m) => m.askPushPermission()); }, []);
  useEffect(() => { setQuickSearchActive(true); return () => setQuickSearchActive(false); }, []);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const startedAt = Date.now();
    const finish = (fn: () => void) => { if (cancelled || doneRef.current) return; doneRef.current = true; fn(); };
    const local = () => finish(() => cb.current.onNoMatch());
    const matched = (id: string, others: string[]) => finish(() => {
      if (others.length) { setFound(others.join(", ")); timer = window.setTimeout(() => cb.current.onMatch(id), FOUND_MS); }
      else cb.current.onMatch(id);
    });

    const poll = async () => {
      if (cancelled) return;
      try {
        const id = matchRef.current!;
        const s = await quickStatus({ data: { matchId: id } });
        if (cancelled) return;
        setCount(s.count);
        if (s.status === "playing") return matched(id, s.others);
        if (s.status !== "waiting") return local();
        if (Date.now() - startedAt >= SEARCH_MS) {
          const r = await quickFinalize({ data: { matchId: id } });
          if (r.status === "started") {
            const after = await quickStatus({ data: { matchId: id } });
            return matched(id, after.others);
          }
          matchRef.current = null;
          return local();
        }
      } catch { return local(); }
      timer = window.setTimeout(poll, POLL_MS);
    };

    (async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return local();
      try {
        await ensurePlayerSession();
        const r = await quickMatch({ data: { maxPlayers: players, variant } });
        if (cancelled) { void leaveMatch({ data: { matchId: r.id } }).catch(() => {}); return; }
        matchRef.current = r.id;
        void poll();
      } catch { local(); }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (!doneRef.current && matchRef.current) void leaveMatch({ data: { matchId: matchRef.current } }).catch(() => {});
    };
  }, [players, variant]);

  return createPortal(
    <div className="quick-search-screen fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="quick-search-layout">
        <div className="quick-search-status w-full max-w-sm text-center">
          {found ? (
            <div className="space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">{t("matchFoundTitle")}</h2>
              <p className="text-lg font-semibold text-primary">{t("matchFoundVs", { name: found })}</p>
            </div>
          ) : (
            <>
              <div className="quick-search-icon quick-search-spin mx-auto flex items-center justify-center rounded-xl bg-primary/15">
                <Dices className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">{t("searchingOpponent")}</h2>
              <p className="text-sm text-muted-foreground">{t("searchingOpponentHint")}</p>
              {players > 2 && <p className="text-sm font-semibold text-primary">{count} / {players}</p>}
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div className="quick-search-progress h-full bg-primary" style={{ animationDuration: `${SEARCH_MS}ms` }} />
              </div>
              <button type="button" onClick={onCancel} className="h-11 w-full rounded-[10px] bg-secondary font-semibold text-secondary-foreground transition active:scale-[0.98]">
                {t("cancelSearch")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
