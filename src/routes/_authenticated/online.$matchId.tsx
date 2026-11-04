import { sendOnce, withDeadline } from "@/lib/online/deadline";
import type React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Play, Share2, UserPlus, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { matchQrValue } from "@/lib/online/match-code";
import { PUBLISHED_LUDO_ORIGIN } from "@/lib/native/origin";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/auth/client";
import { LudoBoard, SeatCardRow } from "@/components/ludo/LudoBoard";
import { MatchInfoBar } from "@/components/ludo/MatchInfoBar";
import { LudoDie } from "@/components/ludo/LudoDie";
import { useDieColor } from "@/components/ludo/useDieColor";
import type { DiceValue } from "@/components/dice-engine/types";
import { goalOf, legalMoves, variantOf, type GameState } from "@/lib/ludo/engine";
import { RollLabel } from "@/components/ludo/RollLabel";
import { ExtraRollBanner } from "@/components/ludo/ExtraRollBanner";
import { QuickChat } from "@/components/ludo/QuickChat";
import { pieceCenter } from "@/lib/ludo/board";
import { act, getPlayerCard, heartbeat, inviteFriend, leaveMatch, listFriends, sendFriendRequest, startMatch } from "@/lib/online/online.functions";
import { useAvatarImages } from "@/lib/ludo/avatar";
import { PlayerAvatar } from "@/components/ludo/PlayerAvatar";
import { flag } from "@/lib/online/profile-options";
import { TURN_SECONDS, type MarkedState } from "@/lib/online/match-logic";
import { rememberOnlineMatch } from "@/lib/online/snapshot";
import { RESUME_EVENT } from "@/lib/native/runtime";
import { playDiceLandHaptic, playLightHaptic, playSuccessHaptic, playTurnHaptic } from "@/lib/native/haptics";
import { errorMessage, useTranslation } from "@/lib/i18n";
import { AppOpenGameGate } from "@/components/AppOpenGameGate";
import { usePostMatchExit } from "@/lib/ads/usePostMatchExit";
import { markOnlineMatchFinished } from "@/lib/ads/local-stats";
import { recordOnlineCaptures, recordOnlineFinish } from "@/lib/ludo/storage";

export const Route = createFileRoute("/_authenticated/online/$matchId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Onlinematch – Mr. B Ludo" },
      { name: "description", content: "Väntrum och onlinematch i Mr. B Ludo." },
      { property: "og:title", content: "Onlinematch – Mr. B Ludo" },
      { property: "og:description", content: "Spela Ludo online i realtid." },
    ],
  }),
  component: () => <AppOpenGameGate><OnlineMatchPage /></AppOpenGameGate>,
});

const ROLL_MS = 1150;
const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];

interface MatchRow { id: string; code: string; status: string; is_private: boolean; max_players: number; host_id: string; state: unknown; version: number; turn_started_at: string | null; variant?: string }
interface SeatRow { user_id: string; seat: number; display_name: string; avatar: string; country: string; last_seen: string }

function OnlineMatchPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const pics = useAvatarImages(seats.map((s) => s.user_id));
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<DiceValue>(6);
  const [pending, setPending] = useState(false);
  const [offline, setOffline] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [missing, setMissing] = useState(false);
  const animatedVersion = useRef(-1);
  const rollStart = useRef(0);
  const autoShown = useRef(0);
  const backShown = useRef(0);

  // Coalesced like Yatzy: a burst of realtime events while a read is running causes exactly one more read.
  const loading = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const load = useCallback(async (): Promise<void> => {
    if (loading.current) { again.current = true; return loading.current; }
    loading.current = (async () => { do { again.current = false; await loadNow(); } while (again.current); })().finally(() => { loading.current = null; });
    return loading.current;
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadNow = useCallback(async () => {
    const [{ data: m, error }, { data: s }] = await Promise.all([
      supabase.from("matches").select("*").eq("id", matchId).maybeSingle(),
      supabase.from("match_players").select("user_id, seat, display_name, avatar, country, last_seen").eq("match_id", matchId).order("seat"),
    ]);
    if (error) { setOffline(true); return; }
    setOffline(false);
    if (!m) { setMissing(true); rememberOnlineMatch(null); return; }
    if (m.status === "finished" || m.status === "abandoned") rememberOnlineMatch(null);
    setMatch((prev) => (prev && prev.version > m.version ? prev : (m as MatchRow)));
    setSeats((s ?? []) as SeatRow[]);
  }, [matchId]);

  // Realtime channel: rebuilt from scratch whenever the app returns, the network comes back or the player taps reconnect (Yatzy).
  const [channelGen, setChannelGen] = useState(0);
  const reconnect = useCallback(() => {
    setChannelGen((g) => g + 1);
    withDeadline(heartbeat({ data: { matchId } })).then(() => { setOffline(false); return load(); }).catch(() => setOffline(true));
  }, [matchId, load]);
  useEffect(() => {
    const ch = supabase.channel(`match-${matchId}-${channelGen}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` }, () => { void load(); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void load(); if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setOffline(true); });
    return () => { void supabase.removeChannel(ch); };
  }, [matchId, channelGen, load]);

  // Initial load + reconnection on resume/online.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    rememberOnlineMatch(matchId);
    void load();
    const onBack = () => { if (document.visibilityState !== "hidden") reconnect(); };
    const onOffline = () => setOffline(true);
    window.addEventListener(RESUME_EVENT, onBack);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => { window.removeEventListener(RESUME_EVENT, onBack); window.removeEventListener("offline", onOffline); window.removeEventListener("online", onBack); document.removeEventListener("visibilitychange", onBack); };
  }, [matchId, load, reconnect]);

  // Heartbeat: keeps my seat alive and lets the server advance idle turns. Also a polling fallback.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      withDeadline(heartbeat({ data: { matchId } })).then(() => { setOffline(false); return load(); }).catch(() => setOffline(true));
    }, 5000);
    heartbeat({ data: { matchId } }).catch(() => {});
    return () => window.clearInterval(t);
  }, [matchId, load]);

  const state = (match?.state ?? null) as GameState | null;
  // The die keeps the colour of the player who just moved until their piece has finished walking.
  const dieColor = useDieColor(state ? COLOR_VAR[state.players[state.current]?.color ?? 0] ?? "" : "", state);

  // Computer seats (quick play) are played by the server; nudge it quickly on their turn.
  const botTurn = !!state && state.phase !== "finished" && !!state.players[state.current]?.isBot;
  useEffect(() => {
    if (!botTurn) return;
    const t = window.setTimeout(() => { heartbeat({ data: { matchId } }).then(load).catch(() => {}); }, 1300);
    return () => window.clearTimeout(t);
  }, [botTurn, match?.version, matchId, load]);

  // Animate the die whenever a new roll arrives (mine or an opponent's).
  useEffect(() => {
    if (!match || !state) return;
    if (animatedVersion.current === -1) { animatedVersion.current = match.version; return; }
    if (match.version <= animatedVersion.current) return;
    animatedVersion.current = match.version;
    const ev = state.lastEvent;
    // Yatzy-style clarity: when the server plays a step for someone who was away, say so.
    const mark = (state as MarkedState).auto;
    if (mark && mark.at !== autoShown.current) {
      autoShown.current = mark.at;
      const who = state.players[mark.seat];
      // A mark from a device that was away when it happened is not worth a late notice.
      if (who && Date.now() - mark.at < 90_000) {
        const mine = who.id === userId;
        toast.info(t(mine ? "autoPlayedMine" : "autoPlayedOther", { name: who.name }));
      }
    }
    // Quick play: a player who acts again after the computer played for them is back.
    const back = (state as MarkedState).back;
    if (back && back.at !== backShown.current) {
      backShown.current = back.at;
      const who = state.players[back.seat];
      if (who && Date.now() - back.at < 90_000 && who.id !== userId) toast.info(t("playerBack", { name: who.name }));
    }
    // Like Yatzy: only my own actions vibrate (opponents/bots don't buzz my phone).
    const mineEv = !!ev && "player" in ev && state.players[ev.player]?.id === userId;
    if (ev?.kind === "moved" && mineEv) void ((ev.captured.length || ev.reachedGoal) ? playSuccessHaptic() : playLightHaptic());
    if (ev?.kind !== "rolled") return;
    setFace(ev.value as DiceValue);
    const remaining = Math.max(350, ROLL_MS - (Date.now() - rollStart.current));
    setRolling(true);
    const timer = window.setTimeout(() => { setRolling(false); if (mineEv) void playDiceLandHaptic(); }, rollStart.current ? remaining : ROLL_MS);
    rollStart.current = 0;
    return () => window.clearTimeout(timer);
  }, [match?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Online matches count in the same yearly statistics as local games (home + statistics pages).
  const capKey = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !userId) return;
    const mine = state.players.findIndex((p) => p.id === userId);
    if (mine < 0) return;
    const ev = state.lastEvent;
    const key = ev ? `${state.turnCount}:${JSON.stringify(ev)}` : null;
    if (capKey.current === null) capKey.current = key; // never count events that happened before this screen opened
    else if (key && key !== capKey.current) {
      capKey.current = key;
      if (ev?.kind === "moved" && ev.player === mine) recordOnlineCaptures(ev.captured.length);
    }
    if (state.phase === "finished") recordOnlineFinish(matchId, state, mine, state.pieces[mine].filter((x) => x === goalOf(variantOf(state))).length);
  }, [state, userId, matchId]);

  // Haptics for turn handover and win (same events as Yatzy's TurnTransition / success pulse).
  const prevTurn = useRef(-1);
  const [turnBanner, setTurnBanner] = useState(false);
  const [cardSeat, setCardSeat] = useState<number | null>(null);
  useEffect(() => {
    if (!state || !userId) return;
    const mine = state.players.findIndex((p) => p.id === userId);
    if (state.phase === "finished") { if (prevTurn.current >= 0 && state.winner === mine) void playSuccessHaptic(); prevTurn.current = -2; return; }
    const becameMine = prevTurn.current >= 0 && prevTurn.current !== state.current && state.current === mine;
    prevTurn.current = state.current;
    if (!becameMine) return;
    void playTurnHaptic();
    setTurnBanner(true);
    const tm = window.setTimeout(() => setTurnBanner(false), 1500);
    return () => window.clearTimeout(tm);
  }, [state?.current, state?.phase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (action: { kind: "roll" } | { kind: "move"; piece: number; walkOut?: boolean }) => {
    if (!match || pending || offline) return;
    setPending(true);
    if (action.kind === "roll") { rollStart.current = Date.now(); setRolling(true); void playLightHaptic(); }
    try {
      const version = match.version;
      const r = await sendOnce(() => act({ data: { matchId, version, action } }));
      if (!r) { setRolling(false); await load(); }
      if (r) setMatch((m) => (m && m.version < r.version ? { ...m, version: r.version, state: r.state, status: r.state.phase === "finished" ? "finished" : m.status } : m));
    } catch (e) {
      setRolling(false);
      if (e instanceof Error && e.message === "err:timeout") setOffline(true);
      else toast.error(errorMessage(e, t));
      void load();
    } finally { setPending(false); }
  }, [match, matchId, pending, offline, load, t]);

  if (missing) return <main className="app-screen"><div className="home-stack"><p>{t("matchMissing")}</p><button className="home-action mt-3" onClick={() => navigate({ to: "/online" })}>{t("toOnline")}</button></div></main>;
  if (!match || !userId) return <div className="game-screen" />;
  if (match.status === "waiting" || match.status === "abandoned") return <WaitingRoom match={match} seats={seats} userId={userId} onLeave={async () => { await leaveMatch({ data: { matchId } }).catch(() => {}); navigate({ to: "/online" }); }} />;
  if (!state) return <div className="game-screen" />;

  const me = state.players[state.current];
  const mySeat = state.players.findIndex((p) => p.id === userId);
  const myTurn = state.current === mySeat && state.phase !== "finished" && !state.players[mySeat]?.forfeited;
  const legal = myTurn && state.phase === "move" && !rolling ? legalMoves(state) : [];
  const handover = dieColor !== (COLOR_VAR[state.players[state.current]?.color ?? 0] ?? "");
  const canRoll = myTurn && state.phase === "roll" && !rolling && !pending && !offline && !handover;
  const ev = state.lastEvent;
  const captureAt = ev?.kind === "moved" && ev.captured.length ? (pieceCenter(state.players[ev.player].color, ev.to, ev.piece, variantOf(state)) as [number, number]) : null;
  const seatOf = (id: string) => seats.find((s) => s.user_id === id);

  const seatInfo = state.players.map((p) => { const s = seatOf(p.id); return { name: p.name, kind: p.isBot ? "bot" as const : "online" as const, flag: s ? flag(s.country) : undefined, image: s ? pics[s.user_id] : null, emoji: s?.avatar, away: !!s && Date.now() - new Date(s.last_seen).getTime() > 20_000 && !p.forfeited }; });

  return (
    <main className="game-screen">
      <MatchInfoBar state={state} gameKey={matchId} />
      <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div className="game-board-stack flex flex-col">
        <SeatCardRow state={state} seats={seatInfo} edge="top" ownSeat={mySeat} onSeatTap={setCardSeat} />
        <div className="aspect-square w-full rounded-xl shadow-2xl">
          <LudoBoard state={state} legal={legal} onPick={(piece, walkOut) => send({ kind: "move", piece, ...(walkOut ? { walkOut: true } : {}) })} captureAt={captureAt} seats={seatInfo} />
        </div>
        <SeatCardRow state={state} seats={seatInfo} edge="bottom" ownSeat={mySeat} onSeatTap={setCardSeat} />

       </div>
      </div>

      <div className="text-center" aria-live="polite">
        <p className="h-4 text-xs text-muted-foreground">{offline ? <button type="button" className="underline underline-offset-2" onClick={reconnect}>{t("reconnecting")} · {t("tryAgain")}</button> : (!match.is_private && state.phase !== "finished" ? <TurnClock since={match.turn_started_at} /> : "")}</p>
      </div>

      <div className="game-bottom-controls game-bottom-controls-chat">
        <div className="game-throw-area">
          <LudoDie value={face} rolling={rolling} onTap={() => send({ kind: "roll" })} disabled={!canRoll} pipColor={dieColor} />
        </div>
        <div className="game-command-area">
          <QuickChat matchId={matchId} myName={mySeat >= 0 ? state.players[mySeat].name : ""} myColor={mySeat >= 0 ? state.players[mySeat].color : null} />
          <button className={`game-roll-btn font-display${canRoll ? " kasta-pulse" : ""}${!canRoll ? " game-roll-btn-locked" : ""}`} style={dieColor ? ({ ["--roll-c" as string]: dieColor } as React.CSSProperties) : undefined} onClick={() => send({ kind: "roll" })} disabled={!canRoll}>
            <RollLabel state={state} canRoll={canRoll} myTurn={myTurn} handover={handover} />
          </button>
          <div className="flex items-center justify-center gap-2">
            <button className="game-nav-btn" onClick={() => navigate({ to: "/online" })}>{t("home")}</button>
            <button className="game-nav-btn game-nav-btn-danger" onClick={() => setConfirmForfeit(true)} disabled={state.phase === "finished" || mySeat < 0 || state.players[mySeat].forfeited}>{t("forfeit")}</button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmForfeit} onOpenChange={setConfirmForfeit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("forfeitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("forfeitBodyOnline")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepPlaying")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => leaveMatch({ data: { matchId } }).then(load).catch((e) => toast.error(errorMessage(e, t)))}>{t("forfeit")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cardSeat != null && state.players[cardSeat] && (() => {
        const p = state.players[cardSeat]; const s = seatOf(p.id);
        return <PlayerCardDialog matchId={match.id} userId={p.id} name={p.name} color={COLOR_VAR[p.color]} flagText={s ? flag(s.country) : ""} image={s ? pics[s.user_id] ?? null : null} emoji={s?.avatar ?? "🎲"} onClose={() => setCardSeat(null)} />;
      })()}
      <ExtraRollBanner state={state} />
      {turnBanner && (
        <div className="turn-banner" aria-hidden="true" style={{ "--pc": COLOR_VAR[state.players[mySeat]?.color ?? 0] } as React.CSSProperties}>
          <span className="font-display text-[13px] font-bold" style={{ color: COLOR_VAR[state.players[mySeat]?.color ?? 0] }}>{t("yourTurn")}</span>
        </div>
      )}

      {state.phase === "finished" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-2xl border bg-card p-5 text-center shadow-2xl">
            <p className="text-4xl">🏆</p>
            <h2 className="brand-title mt-1 text-2xl">{t("playerWon", { name: state.players[state.winner!].name })}</h2>
            <ol className="mt-4 space-y-1.5 text-left text-sm">
              {(state.ranking ?? state.players.map((_, i) => i)).map((seat, place) => {
                const p = state.players[seat];
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="w-5 font-bold text-gold">{place + 1}.</span>
                    <span className="h-3 w-3 rounded-full" style={{ background: COLOR_VAR[p.color] }} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.forfeited ? t("gaveUp") : t("inGoal", { n: state.pieces[seat].filter((x) => x === goalOf(variantOf(state))).length })}</span>
                    {!p.isBot && p.id !== userId && seatOf(p.id) && (
                      <AddFriendButton matchId={match.id} userId={p.id} />
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">{t("countsOnLeaderboard")}</p>
            <div className="home-stack mt-4">
              <OnlineResultButtons matchId={match.id} completed={!state.players.some((p) => p.forfeited)} onAgain={() => navigate({ to: "/online" })} onHome={() => navigate({ to: "/" })} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Result exits run Yatzy's post-match interstitial only for fully played matches (no forfeits). */
function OnlineResultButtons({ matchId, completed, onAgain, onHome }: { matchId: string; completed: boolean; onAgain: () => void; onHome: () => void }) {
  const { t } = useTranslation();
  useEffect(() => { if (completed) markOnlineMatchFinished(matchId); }, [completed, matchId]);
  const { leaving, leave } = usePostMatchExit(`online:${matchId}`, completed, onHome);
  return (
    <>
      <button className="home-action home-action-gold" disabled={leaving} onClick={() => void leave(onAgain)}>{t("playAgain")}</button>
      <button className="home-action home-action-ghost" disabled={leaving} onClick={() => void leave()}>{t("home")}</button>
    </>
  );
}

/** Tap an opponent's seat card: their total online matches and wins, plus "Lägg till vän" like Yatzy. */
function PlayerCardDialog({ matchId, userId, name, color, flagText, image, emoji, onClose }: { matchId: string; userId: string; name: string; color: string; flagText: string; image: string | null; emoji: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [card, setCard] = useState<Awaited<ReturnType<typeof getPlayerCard>> | null>(null);
  useEffect(() => { getPlayerCard({ data: { matchId, userId } }).then(setCard).catch(() => setCard({ played: 0, wins: 0, friend: "none" })); }, [matchId, userId]);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[300px] rounded-2xl p-5 text-center">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-3xl" style={{ boxShadow: `0 0 0 3px ${color}` }}>
          <PlayerAvatar emoji={emoji} image={image} className="h-full w-full text-3xl" />
        </div>
        <p className="font-display text-lg font-bold">{flagText} {name}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface py-2"><p className="font-display text-xl font-bold">{card ? card.played : "–"}</p><p className="text-[11px] text-muted-foreground">{t("statPlayed")}</p></div>
          <div className="rounded-xl bg-surface py-2"><p className="font-display text-xl font-bold text-gold">{card ? card.wins : "–"}</p><p className="text-[11px] text-muted-foreground">{t("statWins")}</p></div>
        </div>
        <div className="flex justify-center">
          {!card ? null : card.friend === "friends" ? <span className="flex items-center gap-1 text-sm text-primary"><Check size={14} /> {t("alreadyFriends")}</span>
            : card.friend === "sent" ? <span className="flex items-center gap-1 text-sm text-primary"><Check size={14} /> {t("friendRequestSent")}</span>
            : <AddFriendButton matchId={matchId} userId={userId} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Yatzy's result-screen "Lägg till vän": requests go only to players you just played with. */
function AddFriendButton({ matchId, userId }: { matchId: string; userId: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const send = async () => {
    setState("busy");
    try { await sendFriendRequest({ data: { matchId, userId } }); setState("sent"); toast.success(t("friendRequestSent")); }
    catch (e) { setState("idle"); toast.error(errorMessage(e, t)); }
  };
  if (state === "sent") return <span className="flex items-center gap-1 text-[11px] text-primary"><Check size={12} /> {t("friendRequestSent")}</span>;
  return (
    <button type="button" disabled={state === "busy"} onClick={send} aria-label={t("addFriendBtn")}
      className="flex shrink-0 items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary active:bg-primary/25 disabled:opacity-60">
      <UserPlus size={12} /> {t("addFriendBtn")}
    </button>
  );
}

function TurnClock({ since }: { since: string | null }) {
  const { t } = useTranslation();
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t); }, []);
  if (!since) return null;
  const left = Math.max(0, TURN_SECONDS - Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  return <>{left > 0 ? t("turnTimeLeft", { s: left }) : t("turnTimeOut")}</>;
}

function WaitingRoom({ match, seats, userId, onLeave }: { match: MatchRow; seats: SeatRow[]; userId: string; onLeave: () => void }) {
  const { t } = useTranslation();
  const [friends, setFriends] = useState<Awaited<ReturnType<typeof listFriends>>["friends"]>([]);
  const isHost = match.host_id === userId;
  const pics = useAvatarImages([...seats.map((s) => s.user_id), ...friends.map((f) => f.user.id)]);
  useEffect(() => { listFriends().then((r) => setFriends(r.friends.filter((f) => f.status === "accepted"))).catch(() => {}); }, []);
  const start = () => startMatch({ data: { matchId: match.id } }).catch((e) => toast.error(errorMessage(e, t)));
  const invite = (uid: string) => inviteFriend({ data: { matchId: match.id, userId: uid } }).then(() => toast.success(t("inviteSent"))).catch((e) => toast.error(errorMessage(e, t)));
  // Like Yatzy's "Dela inbjudan": the phone's share sheet (Messenger, WhatsApp …), or copy when sharing is unavailable.
  const share = async () => {
    const url = `${PUBLISHED_LUDO_ORIGIN}/join?code=${match.code}`;
    const text = t("shareInviteText", { code: match.code });
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title: "Mr. B Ludo", text, url, dialogTitle: t("shareInvite") });
        return;
      }
      if (navigator.share) { await navigator.share({ title: "Mr. B Ludo", text, url }); return; }
    } catch (e) {
      const msg = String((e as { name?: string; message?: string })?.name ?? "") + String((e as { message?: string })?.message ?? "");
      if (/abort|cancel/i.test(msg)) return;
    }
    try { await navigator.clipboard?.writeText(`${text}\n${url}`); toast.success(t("codeCopied")); } catch { /* nothing to do */ }
  };
  if (match.status === "abandoned") return <main className="app-screen"><div className="home-stack"><p>{t("matchAbandoned")}</p><button className="home-action mt-3" onClick={onLeave}>{t("back")}</button></div></main>;
  return (
    <main className="app-screen">
      <div className="home-stack">
        <h1 className="brand-title text-3xl">{t("waitingRoom")}</h1>
        <p className="text-sm text-muted-foreground">{match.is_private ? t("privateMatch") : t("quickMatch")} · {t(match.variant === "fia" ? "modeFia" : "modeClassic")} · {t("playersCount", { n: seats.length, max: match.max_players })}</p>
        <button className="mt-3 flex items-center justify-center gap-2 rounded-[10px] border border-gold bg-card py-3" onClick={() => { navigator.clipboard?.writeText(match.code); toast.success(t("codeCopied")); }}>
          <span className="text-xs text-muted-foreground">{t("matchCode")}</span>
          <span className="font-display text-[13px] font-bold tracking-[0.3em] text-gold">{match.code}</span>
          <Copy size={14} />
        </button>
        {match.is_private && (
          <>
            <button className="home-action home-action-ghost mt-[7px]" onClick={share}><Share2 size={16} /> {t("shareInvite")}</button>
            <div className="mx-auto mt-3 rounded-xl bg-foreground p-3" aria-label={t("scanQR")}>
              <QRCodeSVG value={matchQrValue(match.code)} size={140} />
            </div>
            <p className="mt-1 text-center text-xs text-muted-foreground">{t("scanQR")}</p>
          </>
        )}
        <div className="mt-3 flex flex-col gap-[7px]">
          {Array.from({ length: match.max_players }, (_, i) => {
            const s = seats[i];
            return (
              <div key={i} className="flex h-[52px] items-center gap-2 rounded-[10px] border bg-card px-3 text-sm">
                {s ? <><PlayerAvatar emoji={s.avatar} image={pics[s.user_id]} className="h-7 w-7 text-lg" /><span className="flex-1 truncate font-semibold">{s.display_name} {flag(s.country)}</span>{s.user_id === match.host_id && <span className="text-xs text-gold">{t("host")}</span>}</>
                  : <span className="flex-1 text-muted-foreground">{t("waitingForPlayers")}</span>}
              </div>
            );
          })}
        </div>
        {isHost ? (
          <button className="home-action home-action-success mt-4" disabled={seats.length < 2} onClick={start}><Play size={16} /> {t("startNow", { n: seats.length })}</button>
        ) : <p className="mt-4 text-center text-sm text-muted-foreground">{t("hostStarts")}</p>}
        {friends.length > 0 && <>
          <h2 className="mt-4 text-sm font-semibold">{t("inviteFriends")}</h2>
          {friends.filter((f) => !seats.some((s) => s.user_id === f.user.id)).map((f) => (
            <div key={f.id} className="mt-[7px] flex items-center gap-2 rounded-[10px] bg-surface px-3 py-2 text-sm">
              <PlayerAvatar emoji={f.user.avatar} image={pics[f.user.id]} className="h-6 w-6 text-base" /><span className="flex-1 truncate">{f.user.display_name}</span>
              <button className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-background" onClick={() => invite(f.user.id)}>{t("invite")}</button>
            </div>
          ))}
        </>}
        <button className="home-action home-action-ghost mt-4" onClick={onLeave}>{t("leaveWaiting")}</button>
      </div>
    </main>
  );
}
