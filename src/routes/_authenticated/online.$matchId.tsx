import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Play, Share2, UserPlus, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { matchQrValue } from "@/lib/online/match-code";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/auth/client";
import { LudoBoard, SeatCardRow } from "@/components/ludo/LudoBoard";
import { LudoDie } from "@/components/ludo/LudoDie";
import type { DiceValue } from "@/components/dice-engine/types";
import { goalOf, legalMoves, variantOf, type GameState } from "@/lib/ludo/engine";
import { RollLabel } from "@/components/ludo/RollLabel";
import { QuickChat } from "@/components/ludo/QuickChat";
import { pieceCenter } from "@/lib/ludo/board";
import { act, heartbeat, inviteFriend, leaveMatch, listFriends, sendFriendRequest, startMatch } from "@/lib/online/online.functions";
import { useAvatarImages } from "@/lib/ludo/avatar";
import { PlayerAvatar } from "@/components/ludo/PlayerAvatar";
import { flag } from "@/lib/online/profile-options";
import { TURN_SECONDS } from "@/lib/online/match-logic";
import { rememberOnlineMatch } from "@/lib/online/snapshot";
import { RESUME_EVENT } from "@/lib/native/runtime";
import { playDiceLandHaptic, playLightHaptic, playSuccessHaptic, playTurnHaptic } from "@/lib/native/haptics";
import { errorMessage, useTranslation } from "@/lib/i18n";
import { AppOpenGameGate } from "@/components/AppOpenGameGate";
import { usePostMatchExit } from "@/lib/ads/usePostMatchExit";
import { markOnlineMatchFinished } from "@/lib/ads/ludo-ad-context";

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

  const load = useCallback(async () => {
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

  // Initial load + realtime + reconnection.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    rememberOnlineMatch(matchId);
    load();
    const ch = supabase.channel(`match-${matchId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` }, load)
      .subscribe((status) => { if (status === "SUBSCRIBED") load(); if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setOffline(true); });
    const onBack = () => { if (document.visibilityState !== "hidden") { heartbeat({ data: { matchId } }).then(load).catch(() => setOffline(true)); } };
    const onOffline = () => setOffline(true);
    window.addEventListener(RESUME_EVENT, onBack);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => { window.removeEventListener(RESUME_EVENT, onBack); window.removeEventListener("offline", onOffline); supabase.removeChannel(ch); window.removeEventListener("online", onBack); document.removeEventListener("visibilitychange", onBack); };
  }, [matchId, load]);

  // Heartbeat: keeps my seat alive and lets the server advance idle turns. Also a polling fallback.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      heartbeat({ data: { matchId } }).then(() => { setOffline(false); load(); }).catch(() => setOffline(true));
    }, 5000);
    heartbeat({ data: { matchId } }).catch(() => {});
    return () => window.clearInterval(t);
  }, [matchId, load]);

  const state = (match?.state ?? null) as GameState | null;

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
    // Like Yatzy: only my own actions vibrate (opponents/bots don't buzz my phone).
    const mineEv = !!ev && "player" in ev && state.players[ev.player]?.id === userId;
    if (ev?.kind === "moved" && mineEv) void ((ev.captured.length || ev.reachedGoal) ? playSuccessHaptic() : playLightHaptic());
    if (ev?.kind !== "rolled") return;
    setFace(ev.value as DiceValue);
    const remaining = Math.max(350, ROLL_MS - (Date.now() - rollStart.current));
    setRolling(true);
    const t = window.setTimeout(() => { setRolling(false); if (mineEv) void playDiceLandHaptic(); }, rollStart.current ? remaining : ROLL_MS);
    rollStart.current = 0;
    return () => window.clearTimeout(t);
  }, [match?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Haptics for turn handover and win (same events as Yatzy's TurnTransition / success pulse).
  const prevTurn = useRef(-1);
  const [turnBanner, setTurnBanner] = useState(false);
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
      const r = await act({ data: { matchId, version: match.version, action } });
      if (r) setMatch((m) => (m && m.version < r.version ? { ...m, version: r.version, state: r.state, status: r.state.phase === "finished" ? "finished" : m.status } : m));
    } catch (e) {
      setRolling(false);
      toast.error(errorMessage(e, t));
      load();
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
  const canRoll = myTurn && state.phase === "roll" && !rolling && !pending && !offline;
  const ev = state.lastEvent;
  const captureAt = ev?.kind === "moved" && ev.captured.length ? (pieceCenter(state.players[ev.player].color, ev.to, ev.piece, variantOf(state)) as [number, number]) : null;
  const seatOf = (id: string) => seats.find((s) => s.user_id === id);

  const seatInfo = state.players.map((p) => { const s = seatOf(p.id); return { name: p.name, kind: p.isBot ? "bot" as const : "online" as const, flag: s ? flag(s.country) : undefined, image: s ? pics[s.user_id] : null, emoji: s?.avatar, away: !!s && Date.now() - new Date(s.last_seen).getTime() > 20_000 && !p.forfeited }; });

  return (
    <main className="game-screen">
      <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div className="game-board-stack flex flex-col">
        <SeatCardRow state={state} seats={seatInfo} edge="top" ownSeat={mySeat} />
        <div className="aspect-square w-full rounded-xl shadow-2xl">
          <LudoBoard state={state} legal={legal} onPick={(piece, walkOut) => send({ kind: "move", piece, ...(walkOut ? { walkOut: true } : {}) })} captureAt={captureAt} seats={seatInfo} />
        </div>
        <SeatCardRow state={state} seats={seatInfo} edge="bottom" ownSeat={mySeat} />

       </div>
      </div>

      <div className="text-center" aria-live="polite">
        <p className="h-4 text-xs text-muted-foreground">{offline ? t("reconnecting") : (state.phase !== "finished" ? <TurnClock since={match.turn_started_at} /> : "")}</p>
      </div>

      <div className="game-bottom-controls game-bottom-controls-chat">
        <div className="game-throw-area">
          <LudoDie value={face} rolling={rolling} onTap={() => send({ kind: "roll" })} disabled={!canRoll} pipColor={COLOR_VAR[me.color]} />
        </div>
        <div className="game-command-area">
          <QuickChat matchId={matchId} myName={mySeat >= 0 ? state.players[mySeat].name : ""} myColor={mySeat >= 0 ? state.players[mySeat].color : null} />
          <button className={`game-roll-btn font-display${canRoll ? " kasta-pulse" : ""}`} onClick={() => send({ kind: "roll" })} disabled={!canRoll}>
            <RollLabel state={state} canRoll={canRoll} myTurn={myTurn} />
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

      {turnBanner && (
        <div className="turn-banner" aria-hidden="true" style={{ "--pc": COLOR_VAR[state.players[mySeat]?.color ?? 0] } as React.CSSProperties}>
          <span className="font-display text-2xl font-bold" style={{ color: COLOR_VAR[state.players[mySeat]?.color ?? 0] }}>{t("yourTurn")}</span>
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
  // Like Yatzy's "Dela inbjudan": the phone's share sheet, or copy when sharing is unavailable.
  const share = async () => {
    const text = t("shareInviteText", { code: match.code });
    try {
      if (navigator.share) { await navigator.share({ title: "Mr. B Ludo", text }); return; }
    } catch (e) { if ((e as { name?: string })?.name === "AbortError") return; }
    try { await navigator.clipboard?.writeText(text); toast.success(t("codeCopied")); } catch { /* nothing to do */ }
  };
  if (match.status === "abandoned") return <main className="app-screen"><div className="home-stack"><p>{t("matchAbandoned")}</p><button className="home-action mt-3" onClick={onLeave}>{t("back")}</button></div></main>;
  return (
    <main className="app-screen">
      <div className="home-stack">
        <h1 className="brand-title text-3xl">{t("waitingRoom")}</h1>
        <p className="text-sm text-muted-foreground">{match.is_private ? t("privateMatch") : t("quickMatch")} · {t(match.variant === "fia" ? "modeFia" : "modeClassic")} · {t("playersCount", { n: seats.length, max: match.max_players })}</p>
        <button className="mt-3 flex items-center justify-center gap-2 rounded-[10px] border border-gold bg-card py-3" onClick={() => { navigator.clipboard?.writeText(match.code); toast.success(t("codeCopied")); }}>
          <span className="text-xs text-muted-foreground">{t("matchCode")}</span>
          <span className="font-display text-2xl font-bold tracking-[0.3em] text-gold">{match.code}</span>
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
