import { possessive } from "@/lib/i18n/possessive";
import { memo, useId, useLayoutEffect, useRef } from "react";
import { Bot, Globe, Trophy } from "lucide-react";
import { goalOf, startSquare, variantOf, type Color, type GameState } from "@/lib/ludo/engine";
import { homeColumnOf, trackOf, cellSizeOf, YARD_ORIGIN, YARD_SPOT_GAP, pieceCenter, yardNestCenter } from "@/lib/ludo/board";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
import { movePreviews } from "@/lib/ludo/move-preview";
import { pieceWaypoints, STEP_MS } from "@/lib/ludo/piece-motion";

const COLOR_NAME_KEYS: TranslationKey[] = ["colorRed", "colorGreen", "colorYellow", "colorBlue"];

const FILL: Record<Color, string> = {
  0: "var(--ludo-red)", 1: "var(--ludo-green)", 2: "var(--ludo-yellow)", 3: "var(--ludo-blue)",
};

// Board inks are independent of piece colors: never recolor the pieces here.
const BOARD_FILL: Record<Color, string> = {
  0: "var(--board-red)", 1: "var(--board-green)", 2: "var(--board-yellow)", 3: "var(--board-blue)",
};

/** Presentation-only info for the round player card drawn in each yard. */
export interface SeatInfo {
  name: string;
  kind: "human" | "bot" | "online";
  flag?: string | undefined;
  image?: string | null;
  emoji?: string | undefined;
  away?: boolean;
}

interface Props {
  state: GameState;
  legal: number[];
  onPick: (piece: number, walkOut?: boolean) => void;
  captureAt?: [number, number] | null;
  seats?: (SeatInfo | undefined)[];
}


function LudoBoardImpl({ state, legal, onPick, captureAt, seats }: Props) {
  const { t } = useTranslation();
  const boardId = useId().replace(/:/g, "");
  const previousState = useRef(state);
  const pieceElements = useRef(new Map<string, SVGGElement>());
  const trailRef = useRef<SVGGElement>(null);

  useLayoutEffect(() => {
    const previous = previousState.current;
    previousState.current = state;
    if (previous === state || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ev = state.lastEvent;
    if (ev?.kind !== "moved") return;
    const player = state.players[ev.player];
    const from = previous.pieces[ev.player]?.[ev.piece];
    if (!player || from == null || from === ev.to) return;
    const element = pieceElements.current.get(`${ev.player}-${ev.piece}`);
    if (!element) return;
    const animations: Animation[] = [];
    const waypoints = pieceWaypoints(player.color, from, ev.to, ev.piece, previous.dice, variantOf(state));
    const walk = (waypoints.length - 1) * STEP_MS;
    // Soft footsteps: a pair of prints in the player's own colour appears on each square the piece
    // leaves, lingers a few squares, then fades from the back — oldest first.
    const trail = trailRef.current;
    if (trail && waypoints.length > 2) {
      const fill = FILL[player.color];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const [x0, y0] = waypoints[i], [x1, y1] = waypoints[i + 1];
        const deg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI + 90;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("transform", `translate(${x0 + (x1 - x0) * 0.35} ${y0 + (y1 - y0) * 0.35}) rotate(${deg})`);
        g.setAttribute("opacity", "0");
        for (const side of [-1, 1]) {
          const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
          e.setAttribute("cx", String(side * 0.16)); e.setAttribute("cy", String(side * 0.09));
          e.setAttribute("rx", "0.11"); e.setAttribute("ry", "0.17");
          // Inline style so the colour variable always resolves; a thin dark rim keeps the print
          // readable on white squares and on the player's own coloured lane.
          e.style.fill = fill;
          e.style.stroke = "var(--board-ink)";
          e.style.strokeWidth = "0.02";
          e.style.strokeOpacity = "0.55";
          g.appendChild(e);
        }
        trail.appendChild(g);
        // A print fades once the piece is about three squares ahead of it, so the trail is always
        // strongest right behind the piece and thins out behind it; the last prints fade out just
        // after the piece lands.
        const total = walk + 260;
        const appear = (i + 0.5) * STEP_MS;
        const shown = Math.min(appear + 60, total - 2);
        const fadeStart = Math.max(shown + 40, Math.min(appear + 3 * STEP_MS, total - 200));
        const gone = Math.max(fadeStart + 1, Math.min(fadeStart + 320, total));
        const a = g.animate([
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: appear / total },
          { opacity: 0.86, offset: shown / total },
          { opacity: 0, offset: gone / total },
          { opacity: 0, offset: gone / total },
          ...(gone < total ? [{ opacity: 0, offset: 1 }] : []),
        ], { duration: total, easing: "ease-in-out" });
        a.onfinish = a.oncancel = () => g.remove();
        animations.push(a);
      }
    }
    // Knock slow motion: the final step onto a victim is drawn out, so the hit lands with weight.
    const knock = ev.captured.length > 0 && waypoints.length > 1;
    const lastStep = knock ? STEP_MS * 3.4 : STEP_MS;
    const walkTotal = walk - STEP_MS + lastStep;
    animations.push(element.animate(waypoints.map(([x, y], index) => {
      const n = waypoints.length - 1;
      const offset = index === n ? 1 : (index * STEP_MS) / walkTotal;
      return {
        transform: index === n ? element.style.transform : `translate(${x}px, ${y}px)`,
        offset,
        ...(knock && index === n - 1 ? { easing: "cubic-bezier(.55,0,.85,.35)" } : {}),
      };
    }), { duration: walkTotal, easing: "linear" }));
    // Landing bounce.
    const pawn = element.querySelector<SVGGElement>(".pawn");
    if (pawn) animations.push(pawn.animate([
      { transform: "translate(0px, 0px)" }, { transform: "translate(0px, -0.24px)" }, { transform: "translate(0px, 0px)" },
      { transform: "translate(0px, -0.08px)" }, { transform: "translate(0px, 0px)" },
    ], { duration: 420, delay: walkTotal, easing: "ease-out" }));
    // Knocked-out pieces get launched: a high spinning arc home, then a dizzy, squashed landing.
    for (const c of ev.captured) {
      const victim = pieceElements.current.get(`${c.player}-${c.piece}`);
      const vColor = state.players[c.player]?.color;
      const vFrom = previous.pieces[c.player]?.[c.piece];
      if (!victim || vColor == null || vFrom == null) continue;
      const [x, y] = pieceCenter(vColor, vFrom, c.piece, variantOf(state));
      const [hx, hy] = pieceCenter(vColor, -1, c.piece, variantOf(state));
      const mx = (x + hx) / 2;
      const peak = Math.min(y, hy) - 3.2;
      const spin = hx < x ? -1 : 1;
      const end = victim.style.transform;
      animations.push(victim.animate([
        { transform: `translate(${x}px, ${y}px)` },
        { transform: `translate(${x}px, ${y + 0.12}px) scale(1.25, .6)`, offset: 0.1 },
        { transform: `translate(${(x + mx) / 2}px, ${(y + peak) / 2}px) rotate(${spin * 260}deg) scale(1.15)`, offset: 0.32 },
        { transform: `translate(${mx}px, ${peak}px) rotate(${spin * 540}deg) scale(1.3)`, offset: 0.5 },
        { transform: `translate(${(mx + hx) / 2}px, ${(peak + hy) / 2}px) rotate(${spin * 900}deg) scale(1.1)`, offset: 0.7 },
        { transform: `${end} rotate(${spin * 1080}deg) scale(1.35, .55)`, offset: 0.84 },
        { transform: `${end} rotate(${spin * 1080 - spin * 14}deg) scale(.92, 1.08)`, offset: 0.9 },
        { transform: `${end} rotate(${spin * 1080 + spin * 10}deg)`, offset: 0.95 },
        { transform: end },
      ], { duration: 1500, delay: walkTotal + 80, easing: "ease-in-out", fill: "backwards" }));
      const vPawn = victim.querySelector<SVGGElement>(".pawn");
      if (vPawn) animations.push(vPawn.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 400, delay: walkTotal + 1580 }));
    }
    return () => animations.forEach((a) => a.cancel());
  }, [state]);

  const variant = variantOf(state);
  const goal = goalOf(variant);
  const fia = variant === "fia";
  const cell = cellSizeOf(variant);
  const yardSize = fia ? 4 * cell : 6;
  // Group pieces by spot so stacked pieces get a small offset.
  const spots = new Map<string, number>();
  const pieces: { key: string; x: number; y: number; color: Color; seat: number; idx: number; legal: boolean; done: boolean }[] = [];
  state.players.forEach((pl, seat) => {
    if (pl.forfeited) return;
    state.pieces[seat].forEach((pr, idx) => {
      let [x, y] = pieceCenter(pl.color, pr, idx, variant);
      const k = `${x.toFixed(2)},${y.toFixed(2)}`;
      const n = spots.get(k) ?? 0;
      spots.set(k, n + 1);
      if (n > 0 && pr !== goal) { x += (n % 2 ? 0.18 : -0.18); y -= 0.14 * n; }
      pieces.push({ key: `${seat}-${idx}`, x, y, color: pl.color, seat, idx, done: pr === goal, legal: seat === state.current && legal.includes(idx) });
    });
  });

  // A piece just reached the goal: gold sparkles burst from the center as it lands.
  const lastEv = state.lastEvent;
  const celebrate = lastEv?.kind === "moved" && lastEv.reachedGoal && state.players[lastEv.player]
    ? { color: state.players[lastEv.player]!.color, delay: Math.max(0, Math.min(lastEv.to - lastEv.from, 12)) * STEP_MS }
    : null;
  const seatByColor = new Map<Color, number>(state.players.map((p, i) => [p.color, i]));
  const turnColor = state.phase !== "finished" ? state.players[state.current]?.color : undefined;

  return (
    <svg viewBox="0 0 15 15" className="ludo-board h-full w-full select-none" overflow="visible" role="img" aria-label={t("boardAria")}>
      <defs>
        <clipPath id={`${boardId}-edge`}>
          <rect x="0" y="0" width="15" height="15" rx="0.4" />
        </clipPath>
        <path id={`${boardId}-safe`} d="M 0,-0.25 Q 0.045,-0.045 0.25,0 Q 0.045,0.045 0,0.25 Q -0.045,0.045 -0.25,0 Q -0.045,-0.045 0,-0.25 Z" />
        <linearGradient id={`${boardId}-pawn-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--board-mark-line)" stopOpacity="0.5" />
          <stop offset="30%" stopColor="var(--board-mark)" stopOpacity="0.45" />
          <stop offset="55%" stopColor="var(--board-mark)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--board-mark-line)" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${boardId}-pawn-head`} cx="32%" cy="25%" r="75%">
          <stop offset="0%" stopColor="var(--board-mark)" stopOpacity="0.6" />
          <stop offset="45%" stopColor="var(--board-mark)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--board-mark-line)" stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id={`${boardId}-gold`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="var(--board-gold-light)" />
          <stop offset="100%" stopColor="var(--board-gold)" />
        </radialGradient>
        <radialGradient id={`${boardId}-yard`} cx="50%" cy="50%" r="72%">
          <stop offset="0%" stopColor="var(--board-mark)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--board-ink)" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id={`${boardId}-plate`} cx="40%" cy="32%" r="75%">
          <stop offset="0%" stopColor="var(--board-mark)" stopOpacity="0.28" />
          <stop offset="70%" stopColor="var(--board-mark)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--board-ink)" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id={`${boardId}-pit`} cx="50%" cy="62%" r="60%">
          <stop offset="0%" stopColor="var(--board-ink)" stopOpacity="0.08" />
          <stop offset="75%" stopColor="var(--board-ink)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--board-ink)" stopOpacity="0.42" />
        </radialGradient>
        <pattern id={`${boardId}-yard-dots`} width="0.5" height="0.5" patternUnits="userSpaceOnUse">
          <circle cx="0.25" cy="0.25" r="0.045" fill="var(--board-mark)" fillOpacity="0.16" />
        </pattern>
        <pattern id={`${boardId}-checker`} x="6" y="6" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
          <rect width="0.5" height="0.5" fill="var(--board-mark)" />
          <rect width="0.25" height="0.25" fill="var(--board-ink)" />
          <rect x="0.25" y="0.25" width="0.25" height="0.25" fill="var(--board-ink)" />
        </pattern>
        <path id={`${boardId}-pawn-body`} d="M-.13,-.26 C-.14,-.08 -.21,.03 -.29,.13 Q-.34,.19 -.3,.25 Q0,.38 .3,.25 Q.34,.19 .29,.13 C.21,.03 .14,-.08 .13,-.26 Z" />
      </defs>
      <g clipPath={`url(#${boardId}-edge)`} pointerEvents="none">
      <rect x="0" y="0" width="15" height="15" rx="0.4" fill="var(--board)" />

      {/* Yards: fully colored, compact piece nest + player card. */}
      {([0, 1, 2, 3] as Color[]).map((c) => {
        const [ox, oy] = YARD_ORIGIN[c];
        const x = ox === 0 ? 0 : 15 - yardSize;
        const y = oy === 0 ? 0 : 15 - yardSize;
        const seat = seatByColor.get(c);
        const active = seat != null;
        const isTurn = turnColor === c;
        const [nx, ny] = yardNestCenter(c, variant);
        const half = YARD_SPOT_GAP * Math.SQRT2 + 0.78;
        return (
          <g key={c} opacity={active ? 1 : 0.35}>
            <rect x={x} y={y} width={yardSize} height={yardSize} fill={BOARD_FILL[c]} />
            <rect x={x} y={y} width={yardSize} height={yardSize} fill={`url(#${boardId}-yard)`} />
            {isTurn && <rect x={x} y={y} width={yardSize} height={yardSize} fill={BOARD_FILL[c]} className="base-turn-glow" />}
            <rect x={x} y={y} width={yardSize} height={yardSize} fill={`url(#${boardId}-yard-dots)`} />
            <circle cx={nx} cy={ny} r={half} fill="var(--board-ink)" fillOpacity="0.16" />
            <circle cx={nx} cy={ny + 0.06} r={half} fill={BOARD_FILL[c]} />
            <circle cx={nx} cy={ny + 0.06} r={half} fill={`url(#${boardId}-plate)`} stroke="var(--board-mark)" strokeOpacity="0.55" strokeWidth="0.06" />
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => (
              <g key={i}>
                <circle cx={nx + dx * YARD_SPOT_GAP} cy={ny + dy * YARD_SPOT_GAP} r="0.6" fill={BOARD_FILL[c]} />
                <circle cx={nx + dx * YARD_SPOT_GAP} cy={ny + dy * YARD_SPOT_GAP} r="0.6" fill={`url(#${boardId}-pit)`} />
                <circle cx={nx + dx * YARD_SPOT_GAP} cy={ny + dy * YARD_SPOT_GAP} r="0.6" fill="none" stroke="var(--board-mark)" strokeOpacity="0.6" strokeWidth="0.04" />
              </g>
            ))}
          </g>
        );
      })}

      {trackOf(variant).map(([c, r], i) => {
        const startColor = ([0, 1, 2, 3] as Color[]).find((c) => startSquare(c, variant) === i) ?? null;
        return (
          <g key={i}>
            <rect x={c} y={r} width={cell} height={cell} fill="var(--board)" stroke="var(--board-grid)" strokeWidth="0.026" />
            {startColor != null && <>
              <circle cx={c + cell / 2} cy={r + cell / 2} r="0.37" fill={BOARD_FILL[startColor]} fillOpacity="0.18" stroke={BOARD_FILL[startColor]} strokeWidth="0.06" />
              <use href={`#${boardId}-safe`} x={c + cell / 2} y={r + cell / 2} fill={BOARD_FILL[startColor]} stroke="var(--board-mark-line)" strokeWidth="0.014" strokeLinejoin="round" />
            </>}
          </g>
        );
      })}
      {([0, 1, 2, 3] as Color[]).map((c) =>
        homeColumnOf(variant)[c].map(([x, y], i) => (
          <g key={`${c}-${i}`}>
            <rect x={x} y={y} width={cell} height={cell} fill={BOARD_FILL[c]} stroke="var(--board-grid)" strokeWidth="0.026" />
            <circle cx={x + cell / 2} cy={y + cell / 2} r="0.37" fill="none" stroke="var(--board-mark)" strokeOpacity="0.45" strokeWidth="0.04" />
          </g>
        )),
      )}

      {/* Finish: a clear checkered goal with a gold center. */}
      {fia ? <>
        {/* Four lane positions lead to a gold medallion goal with a star rosette. */}
        <rect x={5 * cell} y={5 * cell} width={cell} height={cell} fill="var(--board)" stroke="var(--board-grid)" strokeWidth="0.026" />
        {([0, 1, 2, 3] as Color[]).map((c) => {
          const [lx, ly] = homeColumnOf(variant)[c][homeColumnOf(variant)[c].length - 1];
          const ax = lx + cell / 2 - 7.5, ay = ly + cell / 2 - 7.5;
          const len = Math.hypot(ax, ay) || 1;
          const ux = ax / len, uy = ay / len, r0 = 0.5 * cell, r1 = 0.3 * cell, w = 0.2 * cell;
          return <polygon key={c} points={`${7.5 + ux * r0 - uy * w},${7.5 + uy * r0 + ux * w} ${7.5 + ux * r0 + uy * w},${7.5 + uy * r0 - ux * w} ${7.5 + ux * r1},${7.5 + uy * r1}`} fill={BOARD_FILL[c]} stroke="var(--board-mark-line)" strokeWidth="0.02" strokeLinejoin="round" />;
        })}
        <circle cx="7.5" cy="7.5" r={0.42 * cell} fill="var(--board-ink)" fillOpacity="0.14" />
        <circle cx="7.5" cy="7.53" r={0.4 * cell} fill={`url(#${boardId}-checker)`} stroke="var(--board-gold)" strokeWidth="0.07" />
        <polygon points={Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8 - Math.PI / 2; const r = (i % 2 ? 0.17 : 0.31) * cell; return `${7.5 + Math.cos(a) * r},${7.5 + Math.sin(a) * r}`; }).join(" ")} fill={`url(#${boardId}-gold)`} stroke="var(--board-mark)" strokeWidth="0.035" strokeLinejoin="round" />
        <circle cx="7.5" cy="7.5" r={0.15 * cell} fill={`url(#${boardId}-gold)`} stroke="var(--board-gold-ink)" strokeOpacity="0.5" strokeWidth="0.025" />
        <Trophy x={7.5 - 0.1 * cell} y={7.5 - 0.1 * cell} width={0.2 * cell} height={0.2 * cell} color="var(--board-gold-ink)" strokeWidth={2.4} />
      </> : <>
      <rect x="6" y="6" width="3" height="3" fill="var(--board)" stroke="var(--board-grid)" strokeWidth="0.026" />
      <circle cx="7.5" cy="7.5" r="1.22" fill={`url(#${boardId}-checker)`} stroke="var(--board-ink)" strokeWidth="0.05" />
      <circle cx="7.5" cy="7.5" r="0.86" fill={`url(#${boardId}-gold)`} stroke="var(--board-mark)" strokeWidth="0.08" />
      <Trophy x={7.21} y={7.21} width={0.58} height={0.58} color="var(--board-gold-ink)" strokeWidth={2.2} />
      <polygon points="6,7.12 6,7.88 6.26,7.5" fill={BOARD_FILL[0]} />
      <polygon points="7.12,6 7.88,6 7.5,6.26" fill={BOARD_FILL[1]} />
      <polygon points="9,7.12 9,7.88 8.74,7.5" fill={BOARD_FILL[2]} />
      <polygon points="7.12,9 7.88,9 7.5,8.74" fill={BOARD_FILL[3]} />
      </>}

      </g>

      <g className="move-destinations">
        {movePreviews(state, legal).map(({ x, y, color, piece, walkOut }) => (
          <g key={`${x},${y}`} className="cursor-pointer" role="button" tabIndex={0}
            aria-label={t("movePieceAria", { color: t(COLOR_NAME_KEYS[color]), n: piece + 1 })}
            onClick={() => onPick(piece, walkOut)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(piece, walkOut); } }}>
            <circle cx={x} cy={y} r="0.39" fill={FILL[color]} fillOpacity="0.18" stroke="var(--board-mark)" strokeWidth="0.12" />
            <circle cx={x} cy={y} r="0.39" fill="none" stroke={FILL[color]} strokeWidth="0.055" />
            <circle cx={x} cy={y} r="0.1" fill={FILL[color]} />
            <circle cx={x} cy={y} r="0.55" fill="transparent" />
          </g>
        ))}
      </g>

      {captureAt && (
        <circle key={`cap-${captureAt.join()}-${state.turnCount}`} cx={captureAt[0]} cy={captureAt[1]} r="0.6" fill="none" stroke="var(--destructive)" strokeWidth="0.12" className="capture-flash" style={{ transformOrigin: `${captureAt[0]}px ${captureAt[1]}px` }} />
      )}

      <g ref={trailRef} pointerEvents="none" />
      {celebrate && (
        <g key={`goal-${state.turnCount}`} className="goal-burst" pointerEvents="none" style={{ ["--d" as string]: `${celebrate.delay}ms`, ["--bc" as string]: FILL[celebrate.color] }}>
          <circle className="goal-burst-ring" cx="7.5" cy="7.5" r={fia ? 0.5 : 1.1} fill="none" stroke="var(--game-gold)" strokeWidth="0.09" />
          <circle className="goal-burst-ring goal-burst-ring-2" cx="7.5" cy="7.5" r={fia ? 0.5 : 1.1} fill="none" stroke="var(--bc)" strokeWidth="0.06" />
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const far = (i % 2 ? 1.5 : 2.1) * (fia ? 0.75 : 1);
            return (
              <g key={i} transform={`translate(7.5 7.5) rotate(${(a * 180) / Math.PI})`}>
                <path className="goal-burst-spark" style={{ ["--far" as string]: `${far}px`, ["--i" as string]: i % 3 }}
                  d="M 0,-0.13 L 0.035,-0.035 L 0.13,0 L 0.035,0.035 L 0,0.13 L -0.035,0.035 L -0.13,0 L -0.035,-0.035 Z"
                  fill={i % 3 === 0 ? "var(--bc)" : "var(--game-gold)"} />
              </g>
            );
          })}
        </g>
      )}
      {pieces.map((p) => (
        <g
          key={p.key}
          ref={(element) => { if (element) pieceElements.current.set(p.key, element); else pieceElements.current.delete(p.key); }}
          className={`piece ${p.legal ? "piece-legal cursor-pointer" : ""}`}
          style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          onClick={p.legal ? () => onPick(p.idx) : undefined}
          role={p.legal ? "button" : undefined}
          aria-label={p.legal ? t("movePieceAria", { color: t(COLOR_NAME_KEYS[p.color]), n: p.idx + 1 }) : undefined}
        >
          {p.legal && <circle className="piece-ring" r="0.5" fill="none" stroke="var(--game-gold)" strokeWidth="0.1" />}
          {p.done && <circle className="piece-done-glow" r="0.36" fill="var(--game-gold)" fillOpacity="0.35" stroke="var(--game-gold)" strokeWidth="0.06" pointerEvents="none" />}
          <g className="pawn" pointerEvents="none">
          <g transform={p.done ? (fia ? "translate(0 0.06) scale(0.48)" : "translate(0 0.08) scale(0.6)") : "translate(0 0.1)"}>
            <ellipse cx="0.05" cy="0.3" rx="0.36" ry="0.13" fill="var(--board-mark-line)" opacity="0.4" />
            <ellipse cy="0.23" rx="0.32" ry="0.12" fill={FILL[p.color]} stroke="var(--board-mark-line)" strokeWidth="0.035" />
            <use href={`#${boardId}-pawn-body`} fill={FILL[p.color]} stroke="var(--board-mark-line)" strokeWidth="0.035" />
            <use href={`#${boardId}-pawn-body`} fill={`url(#${boardId}-pawn-shine)`} />
            <ellipse cy="0.18" rx="0.28" ry="0.09" fill="none" stroke="var(--board-mark)" strokeOpacity="0.25" strokeWidth="0.025" />
            <circle cy="-0.39" r="0.21" fill={FILL[p.color]} stroke="var(--board-mark-line)" strokeWidth="0.035" />
            <circle cy="-0.39" r="0.21" fill={`url(#${boardId}-pawn-head)`} />
            {p.done && <circle cy="-0.39" r="0.21" fill="none" stroke="var(--game-gold)" strokeWidth="0.06" />}
          </g>
          </g>
          {/* larger invisible tap target */}
          {p.legal && <circle r="0.75" fill="transparent" />}
        </g>
      ))}
    </svg>
  );
}

export const LudoBoard = memo(LudoBoardImpl);

/** Round player cards placed outside the board, in the corner next to each yard. */
export function SeatCardRow({ state, seats, edge, ownSeat, onSeatTap }: { state: GameState; seats?: (SeatInfo | undefined)[]; edge: "top" | "bottom"; ownSeat?: number | undefined; onSeatTap?: ((seat: number) => void) | undefined }) {
  const { t } = useTranslation();
  const left: Color = edge === "top" ? 0 : 3;

  const right: Color = edge === "top" ? 1 : 2;
  const turnColor = state.phase !== "finished" ? state.players[state.current]?.color : undefined;
  const card = (c: Color) => {
    const seat = state.players.findIndex((p) => p.color === c);
    if (seat < 0) return <span />;
    const pl = state.players[seat];
    const info = seats?.[seat];
    const kind = info?.kind ?? (pl.isBot ? "bot" : "human");
    const name = info?.name ?? pl.name;
    const home = state.pieces[seat].filter((p) => p === goalOf(variantOf(state))).length;
    const isTurn = turnColor === c;
    const tappable = !!onSeatTap && kind === "online" && seat !== ownSeat;
    return (
      <div role={tappable ? "button" : undefined} tabIndex={tappable ? 0 : undefined} onClick={tappable ? () => onSeatTap(seat) : undefined}
        onKeyDown={tappable ? (e) => { if (e.key === "Enter" || e.key === " ") onSeatTap(seat); } : undefined}
        className={`seat-card${tappable ? " cursor-pointer active:scale-[0.97]" : ""}${isTurn ? " seat-card-turn" : ""}${c === right ? " flex-row-reverse text-right" : ""}`} style={{ opacity: pl.forfeited ? 0.45 : 1, ["--pc" as string]: FILL[c] }}>
        {isTurn && (
          <span className={`seat-card-bubble seat-card-bubble-${edge} seat-card-bubble-in-${c === right ? "right" : "left"}${ownSeat === seat ? " seat-card-bubble-me" : ""}`} aria-hidden="true">
            <span className="seat-card-bubble-text">{seat === ownSeat ? t("yourTurnLabel") : possessive(t("theirTurn", { name }), name)}</span>
          </span>
        )}



        <span className="seat-card-avatar">
          {kind === "bot" ? <span className="seat-card-bot"><Bot className="h-[16px] w-[16px]" strokeWidth={2} /></span>
            : info?.image ? <img src={info.image} alt="" className="h-full w-full object-cover" />
            : info?.flag ? <span className="seat-card-flag" aria-hidden="true">{info.flag}</span>
            : info?.emoji ? <span className="text-base leading-none">{info.emoji}</span>
            : <span className="text-sm font-extrabold">{name.slice(0, 1).toUpperCase()}</span>}
        </span>
        {kind === "online" && <span className="seat-card-globe" aria-hidden="true"><Globe className="h-3 w-3" strokeWidth={2.4} /></span>}
        <span className="min-w-0 leading-tight">
          <span className={`flex items-center gap-1 ${c === right ? "justify-end" : ""}`}>
            <span className="truncate font-display text-[12px] font-bold">{name}</span>
            {kind === "online" && <span className={`seat-card-presence${info?.away ? " seat-card-presence-away" : ""}`} />}
          </span>
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold opacity-60 ${c === right ? "justify-end" : ""}`}><Trophy className="h-2.5 w-2.5" strokeWidth={2.4} />{home}/4</span>
        </span>
      </div>
    );
  };
  return <div className={`seat-card-row seat-card-row-${edge}`}>{card(left)}{card(right)}</div>;
}
