import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dice5, Flag, Home } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LudoBoard } from "@/components/ludo/LudoBoard";
import { LudoDie } from "@/components/ludo/LudoDie";
import type { DiceValue } from "@/components/dice-engine/types";
import { applyMove, applyRoll, forfeit, legalMoves, rollDie, absSquare, COLOR_KEYS, type GameState } from "@/lib/ludo/engine";
import { chooseMove } from "@/lib/ludo/ai";
import { playDiceLandHaptic, playLightHaptic, playSuccessHaptic, playTurnHaptic } from "@/lib/native/haptics";
import { pieceCenter } from "@/lib/ludo/board";
import { clearGame, loadGame, loadSettings, loadStats, saveGame, saveStats } from "@/lib/ludo/storage";
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
const BOT_DELAY = { slow: 1100, normal: 650, fast: 300 } as const;
const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];
const COLOR_NAME_KEYS: TranslationKey[] = ["colorRed", "colorGreen", "colorYellow", "colorBlue"];


function PlayPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, setState] = useState<GameState | null>(null);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<DiceValue>(6);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
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
    const value = rollDie();
    setFace(value as DiceValue);
    setRolling(true);
    void playLightHaptic();
    window.setTimeout(() => {
      setRolling(false);
      void playDiceLandHaptic();
      setState((s) => (s && s.phase === "roll" ? applyRoll(s, value) : s));
      busy.current = false;
    }, ROLL_MS);
  }, [state]);

  const doMove = useCallback((piece: number) => {
    if (busy.current) return;
    setState((s) => {
      if (!s || s.phase !== "move" || !legalMoves(s).includes(piece)) return s;
      const next = applyMove(s, piece);
      const ev = next.lastEvent;
      if (ev?.kind === "moved") void ((ev.captured.length || ev.reachedGoal) ? playSuccessHaptic() : playLightHaptic());
      return next;
    });
  }, []);

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
  useEffect(() => {
    if (!state || state.phase === "finished") return;
    if (prevCurrent.current !== -1 && prevCurrent.current !== state.current && !state.players[state.current].isBot) void playTurnHaptic();
    prevCurrent.current = state.current;
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
    ? (pieceCenter(state.players[ev.player].color, ev.to, ev.piece) as [number, number])
    : null;
  void absSquare;

  let status = "";
  if (state.phase === "finished") status = t("playerWon", { name: state.players[state.winner!].name });
  else if (rolling) status = t("statusRolling");
  else if (me.isBot) status = t("statusThinking", { name: me.name });
  else if (state.phase === "move") status = legal.length === 1 ? t("tapPiece") : t("choosePiece");
  else if (ev?.kind === "rolled" && ev.threeSixes && state.players[ev.player] === me) status = t("threeSixesTurn");
  else if (ev?.kind === "rolled" && ev.noMoves && ev.player === state.current && ev.value === 6) status = t("noMovesExtra");
  else if (ev?.kind === "moved" && ev.extraRoll && ev.player === state.current) status = t("extraRoll");
  else status = t("yourTurn");
  let sub = "";
  if (ev?.kind === "rolled" && ev.noMoves && ev.value !== 6) sub = t("subNoMoves", { name: state.players[ev.player].name, value: ev.value });
  else if (ev?.kind === "rolled" && ev.threeSixes) sub = t("subThreeSixes", { name: state.players[ev.player].name });
  else if (ev?.kind === "moved" && ev.captured.length) sub = t("subCapture", { name: state.players[ev.player].name, names: ev.captured.map((c) => state.players[c.player].name).join(", ") });
  else if (ev?.kind === "moved" && ev.reachedGoal) sub = t("subGoal", { name: state.players[ev.player].name });
  else if (ev?.kind === "forfeit") sub = t("subForfeit", { name: state.players[ev.player].name });

  const canRoll = humanTurn && state.phase === "roll" && !rolling;

  return (
    <main className="game-screen">
      <div className="flex gap-1.5">
        {state.players.map((p, i) => (
          <div
            key={p.id}
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition ${i === state.current && state.phase !== "finished" ? "border-gold bg-card" : "border-transparent bg-surface opacity-70"} ${p.forfeited ? "line-through opacity-40" : ""}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLOR_VAR[p.color] }} />
            <span className="truncate font-semibold">{p.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">{p.isBot ? "🤖" : ""}{state.pieces[i].filter((x) => x === 56).length}/4</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
        <div className="h-[min(100cqw,100cqh)] w-[min(100cqw,100cqh)] overflow-hidden rounded-xl shadow-2xl">
          <LudoBoard state={state} legal={humanTurn ? legal : []} onPick={doMove} captureAt={captureAt} />
        </div>
      </div>

      <div className="text-center" aria-live="polite">
        <p className="font-display text-base font-bold" style={{ color: COLOR_VAR[me.color] }}>{status}</p>
        <p className="h-4 text-xs text-muted-foreground">{sub}</p>
      </div>

      <div className="flex h-[132px] shrink-0 gap-2.5">
        <div className="w-[132px] shrink-0">
          <LudoDie value={face} rolling={rolling} onTap={doRoll} disabled={!canRoll} pipColor={COLOR_VAR[me.color]} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2">
          <button className={`game-roll-btn font-display${canRoll ? " kasta-pulse" : ""}`} onClick={doRoll} disabled={!canRoll}>
            {t("roll")}
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
