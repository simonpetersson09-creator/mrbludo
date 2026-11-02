import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Dice5, Flag, Home, Play, WifiOff } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { LudoBoard } from "@/components/ludo/LudoBoard";
import { LudoDie } from "@/components/ludo/LudoDie";
import type { DiceValue } from "@/components/dice-engine/types";
import { GOAL, legalMoves, type GameState } from "@/lib/ludo/engine";
import { pieceCenter } from "@/lib/ludo/board";
import { act, heartbeat, inviteFriend, leaveMatch, listFriends, startMatch } from "@/lib/online/online.functions";
import { flag } from "@/lib/online/profile-options";
import { TURN_SECONDS } from "@/lib/online/match-logic";

export const Route = createFileRoute("/_authenticated/online/$matchId")({
  head: () => ({
    meta: [
      { title: "Onlinematch – Mr. B Ludo" },
      { name: "description", content: "Väntrum och onlinematch i Mr. B Ludo." },
      { property: "og:title", content: "Onlinematch – Mr. B Ludo" },
      { property: "og:description", content: "Spela Ludo online i realtid." },
    ],
  }),
  component: OnlineMatchPage,
});

const ROLL_MS = 1150;
const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];

interface MatchRow { id: string; code: string; status: string; is_private: boolean; max_players: number; host_id: string; state: unknown; version: number; turn_started_at: string | null }
interface SeatRow { user_id: string; seat: number; display_name: string; avatar: string; country: string; last_seen: string }

function OnlineMatchPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
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
    if (!m) { setMissing(true); return; }
    setMatch((prev) => (prev && prev.version > m.version ? prev : (m as MatchRow)));
    setSeats((s ?? []) as SeatRow[]);
  }, [matchId]);

  // Initial load + realtime + reconnection.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
    const ch = supabase.channel(`match-${matchId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` }, load)
      .subscribe((status) => { if (status === "SUBSCRIBED") load(); if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setOffline(true); });
    const onBack = () => { if (document.visibilityState !== "hidden") load(); };
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => { supabase.removeChannel(ch); window.removeEventListener("online", onBack); document.removeEventListener("visibilitychange", onBack); };
  }, [matchId, load]);

  // Heartbeat: keeps my seat alive and lets the server advance idle turns. Also a polling fallback.
  useEffect(() => {
    const t = window.setInterval(() => {
      heartbeat({ data: { matchId } }).then(() => { setOffline(false); load(); }).catch(() => setOffline(true));
    }, 5000);
    heartbeat({ data: { matchId } }).catch(() => {});
    return () => window.clearInterval(t);
  }, [matchId, load]);

  const state = (match?.state ?? null) as GameState | null;

  // Animate the die whenever a new roll arrives (mine or an opponent's).
  useEffect(() => {
    if (!match || !state) return;
    if (animatedVersion.current === -1) { animatedVersion.current = match.version; return; }
    if (match.version <= animatedVersion.current) return;
    animatedVersion.current = match.version;
    const ev = state.lastEvent;
    if (ev?.kind !== "rolled") return;
    setFace(ev.value as DiceValue);
    const remaining = Math.max(350, ROLL_MS - (Date.now() - rollStart.current));
    setRolling(true);
    const t = window.setTimeout(() => setRolling(false), rollStart.current ? remaining : ROLL_MS);
    rollStart.current = 0;
    return () => window.clearTimeout(t);
  }, [match?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (action: { kind: "roll" } | { kind: "move"; piece: number }) => {
    if (!match || pending) return;
    setPending(true);
    if (action.kind === "roll") { rollStart.current = Date.now(); setRolling(true); }
    try {
      const r = await act({ data: { matchId, version: match.version, action } });
      if (r) setMatch((m) => (m && m.version < r.version ? { ...m, version: r.version, state: r.state, status: r.state.phase === "finished" ? "finished" : m.status } : m));
    } catch (e) {
      setRolling(false);
      toast.error(e instanceof Error ? e.message : "Nätverksfel – försök igen");
      load();
    } finally { setPending(false); }
  }, [match, matchId, pending, load]);

  if (missing) return <main className="app-screen"><div className="home-stack"><p>Matchen finns inte eller så är du inte med i den.</p><button className="home-action mt-3" onClick={() => navigate({ to: "/online" })}>Till online</button></div></main>;
  if (!match || !userId) return <div className="game-screen" />;
  if (match.status === "waiting" || match.status === "abandoned") return <WaitingRoom match={match} seats={seats} userId={userId} onLeave={async () => { await leaveMatch({ data: { matchId } }).catch(() => {}); navigate({ to: "/online" }); }} />;
  if (!state) return <div className="game-screen" />;

  const me = state.players[state.current];
  const mySeat = state.players.findIndex((p) => p.id === userId);
  const myTurn = state.current === mySeat && state.phase !== "finished" && !state.players[mySeat]?.forfeited;
  const legal = myTurn && state.phase === "move" && !rolling ? legalMoves(state) : [];
  const canRoll = myTurn && state.phase === "roll" && !rolling && !pending;
  const ev = state.lastEvent;
  const captureAt = ev?.kind === "moved" && ev.captured.length ? (pieceCenter(state.players[ev.player].color, ev.to, ev.piece) as [number, number]) : null;
  const seatOf = (id: string) => seats.find((s) => s.user_id === id);

  let status = "";
  if (state.phase === "finished") status = `${state.players[state.winner!].name} vann!`;
  else if (rolling) status = "Kastar…";
  else if (!myTurn) status = `${me.name}s tur`;
  else if (state.phase === "move") status = legal.length === 1 ? "Tryck på den markerade pjäsen" : "Välj en pjäs";
  else if (ev?.kind === "moved" && ev.extraRoll && ev.player === state.current) status = "Extra kast!";
  else status = "Din tur – kasta tärningen";
  let sub = "";
  if (rolling) sub = "";
  else if (ev?.kind === "rolled" && ev.noMoves && ev.value !== 6) sub = `${state.players[ev.player].name} slog ${ev.value} – inga möjliga drag`;
  else if (ev?.kind === "rolled" && ev.threeSixes) sub = `${state.players[ev.player].name} slog tre sexor`;
  else if (ev?.kind === "moved" && ev.captured.length) sub = `${state.players[ev.player].name} slog ut ${ev.captured.map((c) => state.players[c.player].name).join(", ")}!`;
  else if (ev?.kind === "moved" && ev.reachedGoal) sub = `${state.players[ev.player].name} fick en pjäs i mål`;
  else if (ev?.kind === "forfeit") sub = `${state.players[ev.player].name} lämnade matchen`;

  return (
    <main className="game-screen">
      <div className="flex gap-1.5">
        {state.players.map((p, i) => {
          const s = seatOf(p.id);
          const away = s && Date.now() - new Date(s.last_seen).getTime() > 20_000 && !p.forfeited;
          return (
            <div key={p.id} className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition ${i === state.current && state.phase !== "finished" ? "border-gold bg-card" : "border-transparent bg-surface opacity-70"} ${p.forfeited ? "line-through opacity-40" : ""}`}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLOR_VAR[p.color] }} />
              <span className="truncate font-semibold">{s?.avatar} {p.name}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">{away ? <WifiOff size={11} className="inline" /> : s ? flag(s.country) : ""} {state.pieces[i].filter((x) => x === GOAL).length}/4</span>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
        <div className="h-[min(100cqw,100cqh)] w-[min(100cqw,100cqh)] overflow-hidden rounded-xl shadow-2xl">
          <LudoBoard state={state} legal={legal} onPick={(piece) => send({ kind: "move", piece })} captureAt={captureAt} />
        </div>
      </div>

      <div className="text-center" aria-live="polite">
        <p className="font-display text-base font-bold" style={{ color: COLOR_VAR[me.color] }}>{offline ? "Återansluter…" : status}</p>
        <p className="h-4 text-xs text-muted-foreground">{sub || (state.phase !== "finished" ? <TurnClock since={match.turn_started_at} /> : "")}</p>
      </div>

      <div className="flex h-[132px] shrink-0 gap-2.5">
        <div className="w-[132px] shrink-0">
          <LudoDie value={face} rolling={rolling} onTap={() => send({ kind: "roll" })} disabled={!canRoll} pipColor={COLOR_VAR[me.color]} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-[7px]">
          <button className="home-action home-action-gold" onClick={() => send({ kind: "roll" })} disabled={!canRoll}>
            <Dice5 size={16} /> Kasta
          </button>
          <div className="grid grid-cols-2 gap-[7px]">
            <button className="home-action home-action-ghost" onClick={() => navigate({ to: "/online" })}><Home size={16} /> Hem</button>
            <button className="home-action home-action-danger" onClick={() => setConfirmForfeit(true)} disabled={state.phase === "finished" || mySeat < 0 || state.players[mySeat].forfeited}><Flag size={16} /> Ge upp</button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmForfeit} onOpenChange={setConfirmForfeit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ge upp matchen?</AlertDialogTitle>
            <AlertDialogDescription>Du lämnar matchen och den räknas som en förlust. Det går inte att ångra.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fortsätt spela</AlertDialogCancel>
            <AlertDialogAction onClick={() => leaveMatch({ data: { matchId } }).then(load).catch((e) => toast.error(e.message))}>Ge upp</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {state.phase === "finished" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-2xl border bg-card p-5 text-center shadow-2xl">
            <p className="text-4xl">🏆</p>
            <h2 className="brand-title mt-1 text-2xl">{state.players[state.winner!].name} vann!</h2>
            <ol className="mt-4 space-y-1.5 text-left text-sm">
              {(state.ranking ?? state.players.map((_, i) => i)).map((seat, place) => {
                const p = state.players[seat];
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="w-5 font-bold text-gold">{place + 1}.</span>
                    <span className="h-3 w-3 rounded-full" style={{ background: COLOR_VAR[p.color] }} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.forfeited ? "Gav upp" : `${state.pieces[seat].filter((x) => x === GOAL).length}/4 i mål`}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">Resultatet räknas på topplistan.</p>
            <div className="home-stack mt-4">
              <button className="home-action home-action-gold" onClick={() => navigate({ to: "/online" })}>Spela igen</button>
              <button className="home-action home-action-ghost" onClick={() => navigate({ to: "/" })}>Hem</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TurnClock({ since }: { since: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t); }, []);
  if (!since) return null;
  const left = Math.max(0, TURN_SECONDS - Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  return <>{left > 0 ? `${left} s kvar på draget` : "Tiden är ute – servern spelar draget"}</>;
}

function WaitingRoom({ match, seats, userId, onLeave }: { match: MatchRow; seats: SeatRow[]; userId: string; onLeave: () => void }) {
  const [friends, setFriends] = useState<Awaited<ReturnType<typeof listFriends>>["friends"]>([]);
  const isHost = match.host_id === userId;
  useEffect(() => { listFriends().then((r) => setFriends(r.friends.filter((f) => f.status === "accepted"))).catch(() => {}); }, []);
  const start = () => startMatch({ data: { matchId: match.id } }).catch((e) => toast.error(e.message));
  const invite = (uid: string) => inviteFriend({ data: { matchId: match.id, userId: uid } }).then(() => toast.success("Inbjudan skickad")).catch((e) => toast.error(e.message));
  if (match.status === "abandoned") return <main className="app-screen"><div className="home-stack"><p>Matchen avbröts.</p><button className="home-action mt-3" onClick={onLeave}>Tillbaka</button></div></main>;
  return (
    <main className="app-screen">
      <div className="home-stack">
        <h1 className="brand-title text-3xl">Väntrum</h1>
        <p className="text-sm text-muted-foreground">{match.is_private ? "Privat match" : "Snabbmatch"} · {seats.length}/{match.max_players} spelare</p>
        <button className="mt-3 flex items-center justify-center gap-2 rounded-[10px] border border-gold bg-card py-3" onClick={() => { navigator.clipboard?.writeText(match.code); toast.success("Koden kopierad"); }}>
          <span className="text-xs text-muted-foreground">Matchkod</span>
          <span className="font-display text-2xl font-bold tracking-[0.3em] text-gold">{match.code}</span>
          <Copy size={14} />
        </button>
        <div className="mt-3 flex flex-col gap-[7px]">
          {Array.from({ length: match.max_players }, (_, i) => {
            const s = seats[i];
            return (
              <div key={i} className="flex h-[52px] items-center gap-2 rounded-[10px] border bg-card px-3 text-sm">
                {s ? <><span className="text-lg">{s.avatar}</span><span className="flex-1 truncate font-semibold">{s.display_name} {flag(s.country)}</span>{s.user_id === match.host_id && <span className="text-xs text-gold">Värd</span>}</>
                  : <span className="flex-1 text-muted-foreground">Väntar på spelare…</span>}
              </div>
            );
          })}
        </div>
        {isHost ? (
          <button className="home-action home-action-success mt-4" disabled={seats.length < 2} onClick={start}><Play size={16} /> Starta nu ({seats.length} spelare)</button>
        ) : <p className="mt-4 text-center text-sm text-muted-foreground">Värden startar matchen. Den startar automatiskt när alla platser är fyllda.</p>}
        {friends.length > 0 && <>
          <h2 className="mt-4 text-sm font-semibold">Bjud in vänner</h2>
          {friends.filter((f) => !seats.some((s) => s.user_id === f.user.id)).map((f) => (
            <div key={f.id} className="mt-[7px] flex items-center gap-2 rounded-[10px] bg-surface px-3 py-2 text-sm">
              <span>{f.user.avatar}</span><span className="flex-1 truncate">{f.user.display_name}</span>
              <button className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-background" onClick={() => invite(f.user.id)}>Bjud in</button>
            </div>
          ))}
        </>}
        <button className="home-action home-action-ghost mt-4" onClick={onLeave}>Lämna väntrummet</button>
      </div>
    </main>
  );
}
