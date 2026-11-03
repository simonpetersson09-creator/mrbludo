import { memo, useId, useLayoutEffect, useRef } from "react";
import { Bot, Globe, Trophy } from "lucide-react";
import { GOAL, type Color, type GameState } from "@/lib/ludo/engine";
import { HOME_COLUMN, TRACK, YARD_ORIGIN, YARD_SPOT_GAP, pieceCenter, yardIsTop, yardNestCenter } from "@/lib/ludo/board";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
import { movePreviews } from "@/lib/ludo/move-preview";
import { pieceWaypoints } from "@/lib/ludo/piece-motion";

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
  onPick: (piece: number) => void;
  captureAt?: [number, number] | null;
  seats?: (SeatInfo | undefined)[];
}

const STEP_MS = 150;
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function LudoBoardImpl({ state, legal, onPick, captureAt, seats }: Props) {
  const { t } = useTranslation();
  const boardId = useId().replace(/:/g, "");
  const previousState = useRef(state);
  const pieceElements = useRef(new Map<string, SVGGElement>());

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
    const waypoints = pieceWaypoints(player.color, from, ev.to, ev.piece);
    const walk = (waypoints.length - 1) * STEP_MS;
    animations.push(element.animate(waypoints.map(([x, y], index) => ({
      transform: index === waypoints.length - 1 ? element.style.transform : `translate(${x}px, ${y}px)`,
      offset: index / (waypoints.length - 1),
    })), { duration: walk, easing: "linear" }));
    // Landing bounce.
    const pawn = element.querySelector<SVGGElement>(".pawn");
    if (pawn) animations.push(pawn.animate([
      { transform: "translate(0px, 0px)" }, { transform: "translate(0px, -0.24px)" }, { transform: "translate(0px, 0px)" },
      { transform: "translate(0px, -0.08px)" }, { transform: "translate(0px, 0px)" },
    ], { duration: 420, delay: walk, easing: "ease-out" }));
    // Knocked-out pieces get bumped, then slide back to their yard.
    for (const c of ev.captured) {
      const victim = pieceElements.current.get(`${c.player}-${c.piece}`);
      const vColor = state.players[c.player]?.color;
      const vFrom = previous.pieces[c.player]?.[c.piece];
      if (!victim || vColor == null || vFrom == null) continue;
      const [x, y] = pieceCenter(vColor, vFrom, c.piece);
      const dx = x < 7.5 ? -0.35 : 0.35;
      animations.push(victim.animate([
        { transform: `translate(${x}px, ${y}px)` },
        { transform: `translate(${x + dx}px, ${y - 0.45}px) rotate(${dx > 0 ? 28 : -28}deg) scale(1.15)`, offset: 0.3 },
        { transform: victim.style.transform },
      ], { duration: 620, delay: walk, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" }));
    }
    return () => animations.forEach((a) => a.cancel());
  }, [state]);

  // Group pieces by spot so stacked pieces get a small offset.
  const spots = new Map<string, number>();
  const pieces: { key: string; x: number; y: number; color: Color; seat: number; idx: number; legal: boolean; done: boolean }[] = [];
  state.players.forEach((pl, seat) => {
    if (pl.forfeited) return;
    state.pieces[seat].forEach((pr, idx) => {
      let [x, y] = pieceCenter(pl.color, pr, idx);
      const k = `${x.toFixed(2)},${y.toFixed(2)}`;
      const n = spots.get(k) ?? 0;
      spots.set(k, n + 1);
      if (n > 0) { x += (n % 2 ? 0.18 : -0.18); y -= 0.14 * n; }
      pieces.push({ key: `${seat}-${idx}`, x, y, color: pl.color, seat, idx, done: pr === GOAL, legal: seat === state.current && legal.includes(idx) });
    });
  });

  const seatByColor = new Map<Color, number>(state.players.map((p, i) => [p.color, i]));
  const turnColor = state.phase !== "finished" ? state.players[state.current]?.color : undefined;

  return (
    <svg viewBox="0 0 15 15" className="ludo-board h-full w-full select-none" role="img" aria-label={t("boardAria")}>
      <defs>
        <clipPath id={`${boardId}-edge`}>
          <rect x="0" y="0" width="15" height="15" rx="0.4" />
        </clipPath>
        <path id={`${boardId}-safe`} d="M 0,-0.25 L 0.074,-0.102 L 0.238,-0.077 L 0.12,0.039 L 0.147,0.202 L 0,0.125 L -0.147,0.202 L -0.12,0.039 L -0.238,-0.077 L -0.074,-0.102 Z" />
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
        const [x, y] = YARD_ORIGIN[c];
        const seat = seatByColor.get(c);
        const active = seat != null;
        const isTurn = turnColor === c;
        const [nx, ny] = yardNestCenter(c);
        const half = YARD_SPOT_GAP + 0.68;
        return (
          <g key={c} opacity={active ? 1 : 0.35}>
            <rect x={x} y={y} width="6" height="6" fill={BOARD_FILL[c]} />
            <rect x={x} y={y} width="6" height="6" fill={`url(#${boardId}-yard)`} />
            {isTurn && <rect x={x} y={y} width="6" height="6" fill={BOARD_FILL[c]} className="base-turn-glow" />}
            <rect x={nx - half} y={ny - half} width={half * 2} height={half * 2} rx="0.5" fill="var(--board-ink)" fillOpacity="0.14" stroke="var(--board-mark)" strokeOpacity="0.45" strokeWidth="0.04" />
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => (
              <g key={i}>
                <circle cx={nx + dx * YARD_SPOT_GAP} cy={ny + dy * YARD_SPOT_GAP} r="0.42" fill="var(--board-ink)" fillOpacity="0.16" />
                <circle cx={nx + dx * YARD_SPOT_GAP} cy={ny + dy * YARD_SPOT_GAP} r="0.42" fill="none" stroke="var(--board-mark)" strokeOpacity="0.85" strokeWidth="0.05" />
              </g>
            ))}
          </g>
        );
      })}

      {TRACK.map(([c, r], i) => {
        const startColor = i % 13 === 0 ? ((i / 13) as Color) : null;
        return (
          <g key={i}>
            <rect x={c} y={r} width="1" height="1" fill="var(--board)" stroke="var(--board-grid)" strokeWidth="0.026" />
            {startColor != null && <>
              <circle cx={c + 0.5} cy={r + 0.5} r="0.37" fill={BOARD_FILL[startColor]} fillOpacity="0.18" stroke={BOARD_FILL[startColor]} strokeWidth="0.06" />
              <use href={`#${boardId}-safe`} x={c + 0.5} y={r + 0.5} fill={BOARD_FILL[startColor]} stroke="var(--board-mark-line)" strokeWidth="0.014" strokeLinejoin="round" />
            </>}
          </g>
        );
      })}
      {([0, 1, 2, 3] as Color[]).map((c) =>
        HOME_COLUMN[c].map(([x, y], i) => (
          <g key={`${c}-${i}`}>
            <rect x={x} y={y} width="1" height="1" fill={BOARD_FILL[c]} stroke="var(--board-grid)" strokeWidth="0.026" />
            <circle cx={x + 0.5} cy={y + 0.5} r="0.37" fill="none" stroke="var(--board-mark)" strokeOpacity="0.8" strokeWidth="0.05" />
          </g>
        )),
      )}

      {/* Finish: a clear checkered goal with a gold center. */}
      <rect x="6" y="6" width="3" height="3" fill="var(--board)" stroke="var(--board-grid)" strokeWidth="0.026" />
      <circle cx="7.5" cy="7.5" r="1.22" fill={`url(#${boardId}-checker)`} stroke="var(--board-ink)" strokeWidth="0.05" />
      <circle cx="7.5" cy="7.5" r="0.86" fill={`url(#${boardId}-gold)`} stroke="var(--board-mark)" strokeWidth="0.08" />
      <Trophy x={7.21} y={7.21} width={0.58} height={0.58} color="var(--board-gold-ink)" strokeWidth={2.2} />
      <polygon points="6,7.12 6,7.88 6.26,7.5" fill={BOARD_FILL[0]} />
      <polygon points="7.12,6 7.88,6 7.5,6.26" fill={BOARD_FILL[1]} />
      <polygon points="9,7.12 9,7.88 8.74,7.5" fill={BOARD_FILL[2]} />
      <polygon points="7.12,9 7.88,9 7.5,8.74" fill={BOARD_FILL[3]} />

      {/* Player cards. */}
      {([0, 1, 2, 3] as Color[]).map((c) => {
        const seat = seatByColor.get(c);
        if (seat == null) return null;
        const pl = state.players[seat];
        const info = seats?.[seat];
        const [x, y] = YARD_ORIGIN[c];
        const py = y + (yardIsTop(c) ? 0.45 : 4.45);
        const ax = x + 1.02, ay = py + 0.55;
        const isTurn = turnColor === c;
        const kind = info?.kind ?? (pl.isBot ? "bot" : "human");
        const name = info?.name ?? pl.name;
        const home = state.pieces[seat].filter((p) => p === GOAL).length;
        return (
          <g key={`card-${c}`} opacity={pl.forfeited ? 0.45 : 1} className={isTurn ? "player-card-turn" : undefined}>
            <rect x={x + 0.42} y={py} width="5.16" height="1.1" rx="0.55" fill="var(--board-mark)" fillOpacity="0.96"
              stroke={isTurn ? "var(--game-gold)" : "var(--board-ink)"} strokeOpacity={isTurn ? 1 : 0.18} strokeWidth={isTurn ? 0.09 : 0.04} />
            <circle cx={ax} cy={ay} r="0.43" fill={FILL[c]} stroke="var(--board-mark)" strokeWidth="0.06" />
            {kind === "bot" ? (
              <Bot x={ax - 0.27} y={ay - 0.27} width={0.54} height={0.54} color="var(--board-mark)" strokeWidth={2.2} />
            ) : info?.image ? (
              <>
                <clipPath id={`${boardId}-av-${c}`}><circle cx={ax} cy={ay} r="0.4" /></clipPath>
                <image href={info.image} x={ax - 0.4} y={ay - 0.4} width="0.8" height="0.8" clipPath={`url(#${boardId}-av-${c})`} preserveAspectRatio="xMidYMid slice" />
              </>
            ) : info?.emoji ? (
              <text x={ax} y={ay + 0.17} textAnchor="middle" fontSize="0.48">{info.emoji}</text>
            ) : (
              <text x={ax} y={ay + 0.16} textAnchor="middle" fontSize="0.44" fontWeight="800" fill="var(--board-mark)">{name.slice(0, 1).toUpperCase()}</text>
            )}
            {kind === "online" && (
              <g>
                <circle cx={ax + 0.33} cy={ay + 0.3} r="0.19" fill="var(--board-ink)" stroke="var(--board-mark)" strokeWidth="0.04" />
                <Globe x={ax + 0.2} y={ay + 0.17} width={0.26} height={0.26} color={info?.away ? "var(--board-red)" : "var(--board-mark)"} strokeWidth={2.4} />
              </g>
            )}
            <text x={x + 1.62} y={py + 0.68} fontSize="0.4" fontWeight="700" fill="var(--board-ink)" className="font-display">
              {short(name, info?.flag ? 10 : 12)}{info?.flag ? ` ${info.flag}` : ""}
            </text>
            <text x={x + 5.32} y={py + 0.67} textAnchor="end" fontSize="0.3" fontWeight="700" fill="var(--board-ink)" fillOpacity="0.6">{home}/4</text>
          </g>
        );
      })}
      </g>

      <g className="move-destinations">
        {movePreviews(state, legal).map(({ x, y, color, piece }) => (
          <g key={`${x},${y}`} className="cursor-pointer" role="button" tabIndex={0}
            aria-label={t("movePieceAria", { color: t(COLOR_NAME_KEYS[color]), n: piece + 1 })}
            onClick={() => onPick(piece)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(piece); } }}>
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
          <g transform={p.done ? "scale(0.76)" : undefined}>
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
