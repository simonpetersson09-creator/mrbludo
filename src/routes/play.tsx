import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LudoBoard, SeatCardRow } from "@/components/ludo/LudoBoard";
import { LudoDie } from "@/components/ludo/LudoDie";
import type { DiceValue } from "@/components/dice-engine/types";
import { applyMove, canWalkOut, applyRoll, forfeit, legalMoves, rollDie, absSquare, variantOf, COLOR_KEYS, type Color, type GameState } from "@/lib/ludo/engine";
import { chooseMove } from "@/lib/ludo/ai";
import { playDiceLandHaptic, playLightHaptic, playSuccessHaptic, playTurnHaptic } from "@/lib/native/haptics";
import { pieceCenter } from "@/lib/ludo/board";
import { clearGame, loadGame, loadSettings, loadStats, saveGame, saveStats } from "@/lib/ludo/storage";
import { RollLabel } from "@/components/ludo/RollLabel";
import { useOwnAvatar } from "@/lib/ludo/avatar";
import { flag } from "@/lib/online/profile-options";
import { useTranslation, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Spela – Mr. B Ludo" },
      { name: "description", content: "Spela Ludo mot datorn eller vänner på samma enhet." },
      { property: "og:title", content: "Spela – Mr. B Ludo" },
      { property: "og:description", content: "Spela Ludo mot datorn eller vänner på samma enhet." },
    ],
  }),
  component: PlayPage,
});

const ROLL_MS = 1150;
// Bot pacing: pause before each bot action, and how long the bot's die tumbles.
const BOT_DELAY = { slow: 2500, normal: 1600, fast: 250 } as const;
const BOT_ROLL_MS = { slow: 1500, normal: 1250, fast: 500 } as const;
const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];
const COLOR_NAME_KEYS: TranslationKey[] = ["colorRed", "colorGreen", "colorYellow", "colorBlue"];


function PlayPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, setState] = useState<GameState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<DiceValue>(6);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const ownAvatar = useOwnAvatar();
  const [ownFlag, setOwnFlag] = useState<string | undefined>();
  useEffect(() => {
    const region = navigator.language.split("-")[1]?.toUpperCase();
    if (region) setOwnFlag(flag(region));
  }, []);
  const busy = useRef(false);
  const statsDone = useRef(false);
  const settings = useMemo(() => loadSettings(), []);

  useEffect(() => {
    const g = loadGame();
    if (!g) navigate({ to: "/setup" });
    else setState(g);
  }, [navigate]);

  useEffect(() => { if (state && state.phase !== "finished") saveGame(state); }, [state]);

  const me = state?.players[state.current];
  const legal = state && state.phase === "move" ? legalMoves(state) : [];
  const humanTurn = !!me && !me.isBot && state!.phase !== "finished";

  const doRoll = useCallback(() => {
    if (!state || state.phase !== "roll" || busy.current) return;
    busy.current = true;
    // Like Yatzy: only the player's own actions vibrate, never the computer's.
    const human = !state.players[state.current].isBot;
    const value = rollDie();
    setFace(value as DiceValue);
    setRolling(true);
    if (human) void playLightHaptic();
    window.setTimeout(() => {
      setRolling(false);
      if (human) void playDiceLandHaptic();
      setState((s) => (s && s.phase === "roll" ? applyRoll(s, value) : s));
      busy.current = false;
    }, human ? ROLL_MS : BOT_ROLL_MS[settings.botSpeed]);
  }, [state, settings.botSpeed]);

  const doMove = useCallback((piece: number, walkOut = false) => {
    if (busy.current || !state || state.phase !== "move" || !legalMoves(state).includes(piece)) return;
    if (walkOut && !canWalkOut(state, piece)) return;
    const next = applyMove(state, piece, walkOut);
    const ev = next.lastEvent;
    if (ev?.kind === "moved" && !state.players[ev.player].isBot) void ((ev.captured.length || ev.reachedGoal) ? playSuccessHaptic() : playLightHaptic());
    setState(next);
  }, [state]);

  // Bot driver
  useEffect(() => {
    if (!state || !me?.isBot || state.phase === "finished" || rolling) return;
    const t = window.setTimeout(() => {
      if (state.phase === "roll") doRoll();
      else if (state.phase === "move") doMove(chooseMove(state));
    }, BOT_DELAY[settings.botSpeed]);
    return () => window.clearTimeout(t);
  }, [state, me, rolling, doRoll, doMove, settings.botSpeed]);

  // "Your turn" pulse when control returns to a human player (Yatzy TurnTransition)
  const prevCurrent = useRef(-1);
  const [turnBanner, setTurnBanner] = useState<Color | null>(null);
  useEffect(() => {
    if (!state || state.phase === "finished") return;
    const becameHuman = prevCurrent.current !== -1 && prevCurrent.current !== state.current && !state.players[state.current].isBot;
    prevCurrent.current = state.current;
    if (!becameHuman) return;
    void playTurnHaptic();
    setTurnBanner(state.players[state.current].color);
    const tm = window.setTimeout(() => setTurnBanner(null), 1500);
    return () => window.clearTimeout(tm);
  }, [state?.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats on finish (human player 0 is the device owner)
  useEffect(() => {
    if (!state || state.phase !== "finished" || statsDone.current) return;
    statsDone.current = true;
    if (state.winner === 0) void playSuccessHaptic();
    clearGame();
    const st = loadStats();
    st.played++;
    if (state.winner === 0) st.wins++;
    if (state.players[0].forfeited) st.forfeits++;
    saveStats(st);
  }, [state]);

  // Track captures / goals for the device owner
  useEffect(() => {
    const ev = state?.lastEvent;
    if (!ev || ev.kind !== "moved" || ev.player !== 0 || state!.players[0].isBot) return;
    if (ev.captured.length || ev.reachedGoal) {
      const st = loadStats();
      st.captures += ev.captured.length;
      if (ev.reachedGoal) st.piecesHome++;
      saveStats(st);
    }
  }, [state?.lastEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !me) return <div className="game-screen" />;

  const ev = state.lastEvent;
  const captureAt = ev?.kind === "moved" && ev.captured.length
    ? (pieceCenter(state.players[ev.player].color, ev.to, ev.piece, variantOf(state)) as [number, number])
    : null;
  void absSquare;

  const canRoll = humanTurn && state.phase === "roll" && !rolling;

  const seatInfo = state.players.map((p) => ({ name: p.name, kind: p.isBot ? "bot" as const : "human" as const, image: p.isBot ? null : ownAvatar, flag: p.isBot ? undefined : ownFlag }));
  // "Din tur" only reads clearly when this device has exactly one human; otherwise the card names the player.
  const ownSeat = state.players.filter((p) => !p.isBot).length === 1 ? state.players.findIndex((p) => !p.isBot) : undefined;

  return (
    <main className="game-screen">
      <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
       <div className="game-board-stack flex flex-col">
        <SeatCardRow state={state} seats={seatInfo} edge="top" ownSeat={ownSeat} />
        <div className="aspect-square w-full rounded-xl shadow-2xl">
          <LudoBoard state={state} legal={humanTurn ? legal : []} onPick={doMove} captureAt={captureAt} seats={seatInfo} />
        </div>
        <SeatCardRow state={state} seats={seatInfo} edge="bottom" ownSeat={ownSeat} />

       </div>
      </div>

      <div className="game-bottom-controls">
        <div className="game-throw-area">
          <LudoDie value={face} rolling={rolling} onTap={doRoll} disabled={!canRoll} pipColor={COLOR_VAR[me.color]} />
        </div>
        <div className="game-command-area">
          <button className={`game-roll-btn font-display${canRoll ? " kasta-pulse" : ""}`} onClick={doRoll} disabled={!canRoll}>
            <RollLabel state={state} canRoll={canRoll} myTurn={humanTurn} />
          </button>
          <div className="flex items-center justify-center gap-2">
            <button className="game-nav-btn" onClick={() => navigate({ to: "/" })}>{t("home")}</button>
            <button className="game-nav-btn game-nav-btn-danger" onClick={() => setConfirmForfeit(true)} disabled={state.phase === "finished"}>{t("forfeit")}</button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmForfeit} onOpenChange={setConfirmForfeit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("forfeitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("forfeitBodyLocal")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepPlaying")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                let s = state;
                // Forfeit every human on this device; bots keep playing only if 2+ remain.
                s.players.forEach((p, i) => { if (!p.isBot) s = forfeit(s, i); });
                if (s.phase !== "finished") {
                  const left = s.players.findIndex((p) => !p.forfeited);
                  s = { ...s, phase: "finished", winner: left, ranking: null };
                }
                setState(s);
              }}
            >
              {t("forfeit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {turnBanner != null && (
        <div className="turn-banner" aria-hidden="true" style={{ "--pc": COLOR_VAR[turnBanner] } as React.CSSProperties}>
          <span className="font-display text-2xl font-bold" style={{ color: COLOR_VAR[turnBanner] }}>{t("yourTurn")}</span>
        </div>
      )}

      {state.phase === "finished" && <ResultOverlay state={state} onAgain={() => navigate({ to: "/setup" })} onHome={() => navigate({ to: "/" })} />}
    </main>
  );
}

function ResultOverlay({ state, onAgain, onHome }: { state: GameState; onAgain: () => void; onHome: () => void }) {
  const { t } = useTranslation();
  const ranking = state.ranking ?? state.players.map((_, i) => i);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[360px] rounded-2xl border bg-card p-5 text-center shadow-2xl">
        <p className="text-4xl">🏆</p>
        <h2 className="brand-title mt-1 text-2xl">{t("playerWon", { name: state.players[state.winner!].name })}</h2>
        <ol className="mt-4 space-y-1.5 text-left text-sm">
          {ranking.map((seat, place) => {
            const p = state.players[seat];
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                <span className="w-5 font-bold text-gold">{place + 1}.</span>
                <span className="h-3 w-3 rounded-full" style={{ background: COLOR_VAR[p.color] }} />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.forfeited ? t("gaveUp") : t("inGoal", { n: state.pieces[seat].filter((x) => x === 56).length })}</span>
              </li>
            );
          })}
        </ol>
        <div className="home-stack mt-4">
          <button className="home-action home-action-gold" onClick={onAgain}>{t("playAgain")}</button>
          <button className="home-action home-action-ghost" onClick={onHome}>{t("home")}</button>
        </div>
      </div>
    </div>
  );
}

export { COLOR_NAME_KEYS, COLOR_KEYS };
