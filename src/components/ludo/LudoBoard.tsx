import { memo, useId, useLayoutEffect, useRef } from "react";
import { GOAL, type Color, type GameState } from "@/lib/ludo/engine";
import { HOME_COLUMN, TRACK, YARD_ORIGIN, pieceCenter } from "@/lib/ludo/board";
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

interface Props {
  state: GameState;
  legal: number[];
  onPick: (piece: number) => void;
  captureAt?: [number, number] | null;
}

function LudoBoardImpl({ state, legal, onPick, captureAt }: Props) {
  const { t } = useTranslation();
  const boardId = useId().replace(/:/g, "");
  const seatColors = new Set(state.players.map((p) => p.color));
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
    const waypoints = pieceWaypoints(player.color, from, ev.to, ev.piece);
    const animation = element.animate(waypoints.map(([x, y], index) => ({
      transform: index === waypoints.length - 1 ? element.style.transform : `translate(${x}px, ${y}px)`,
      offset: index / (waypoints.length - 1),
    })), { duration: (waypoints.length - 1) * 150, easing: "linear" });
    return () => animation.cancel();
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

  return (
    <svg viewBox="0 0 15 15" className="ludo-board h-full w-full select-none" role="img" aria-label={t("boardAria")}>
      <defs>
        <clipPath id={`${boardId}-edge`}>
          <rect x="0" y="0" width="15" height="15" rx="0.4" />
        </clipPath>
        <linearGradient id={`${boardId}-frame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--board-frame-light)" />
          <stop offset="100%" stopColor="var(--board-frame-dark)" />
        </linearGradient>
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
        <path id={`${boardId}-pawn-body`} d="M-.13,-.26 C-.14,-.08 -.21,.03 -.29,.13 Q-.34,.19 -.3,.25 Q0,.38 .3,.25 Q.34,.19 .29,.13 C.21,.03 .14,-.08 .13,-.26 Z" />
      </defs>
      <g clipPath={`url(#${boardId}-edge)`} pointerEvents="none">
      <rect x="0" y="0" width="15" height="15" rx="0.4" fill="var(--board)" />
      {([0, 1, 2, 3] as Color[]).map((c) => {
        const [x, y] = YARD_ORIGIN[c];
        const active = seatColors.has(c);
        return (
          <g key={c} opacity={active ? 1 : 0.35}>
            <rect x={x} y={y} width="6" height="6" fill={BOARD_FILL[c]} />
            <rect x={x + 0.8} y={y + 0.8} width="4.4" height="4.4" rx="0.32" fill="var(--board)" stroke="var(--board-base-line)" strokeWidth="0.035" />
            {[[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]].map(([dx, dy], i) => (
              <circle key={i} cx={x + dx + 0.5} cy={y + dy + 0.5} r="0.55" fill={BOARD_FILL[c]} fillOpacity="0.12" stroke={BOARD_FILL[c]} strokeOpacity="0.6" strokeWidth="0.035" />
            ))}
          </g>
        );
      })}
      {TRACK.map(([c, r], i) => {
        const startColor = i % 13 === 0 ? ((i / 13) as Color) : null;
        return (
          <g key={i}>
            <rect x={c} y={r} width="1" height="1" fill={startColor != null ? BOARD_FILL[startColor] : "var(--board)"} stroke="var(--board-grid)" strokeWidth="0.026" />
            {startColor != null && <use href={`#${boardId}-safe`} x={c + 0.5} y={r + 0.5} fill="var(--board-mark)" stroke="var(--board-mark-line)" strokeWidth="0.018" strokeLinejoin="round" />}
          </g>
        );
      })}
      {([0, 1, 2, 3] as Color[]).map((c) =>
        HOME_COLUMN[c].map(([x, y], i) => (
          <rect key={`${c}-${i}`} x={x} y={y} width="1" height="1" fill={BOARD_FILL[c]} stroke="var(--board-grid)" strokeWidth="0.026" />
        )),
      )}
      <polygon points="6,6 9,6 7.5,7.5" fill={BOARD_FILL[1]} />
      <polygon points="9,6 9,9 7.5,7.5" fill={BOARD_FILL[2]} />
      <polygon points="9,9 6,9 7.5,7.5" fill={BOARD_FILL[3]} />
      <polygon points="6,9 6,6 7.5,7.5" fill={BOARD_FILL[0]} />
      <path d="M6,6 H9 V9 H6 Z M6,6 L9,9 M9,6 L6,9" fill="none" stroke="var(--board-grid)" strokeWidth="0.026" strokeLinejoin="round" />
      <rect x="0.045" y="0.045" width="14.91" height="14.91" rx="0.36" fill="none" stroke={`url(#${boardId}-frame)`} strokeWidth="0.09" />
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
          <g transform={p.done ? "scale(0.76)" : undefined} pointerEvents="none">
            <ellipse cx="0.05" cy="0.3" rx="0.36" ry="0.13" fill="var(--board-mark-line)" opacity="0.4" />
            <ellipse cy="0.23" rx="0.32" ry="0.12" fill={FILL[p.color]} stroke="var(--board-mark-line)" strokeWidth="0.035" />
            <use href={`#${boardId}-pawn-body`} fill={FILL[p.color]} stroke="var(--board-mark-line)" strokeWidth="0.035" />
            <use href={`#${boardId}-pawn-body`} fill={`url(#${boardId}-pawn-shine)`} />
            <ellipse cy="0.18" rx="0.28" ry="0.09" fill="none" stroke="var(--board-mark)" strokeOpacity="0.25" strokeWidth="0.025" />
            <circle cy="-0.39" r="0.21" fill={FILL[p.color]} stroke="var(--board-mark-line)" strokeWidth="0.035" />
            <circle cy="-0.39" r="0.21" fill={`url(#${boardId}-pawn-head)`} />
          </g>
          {/* larger invisible tap target */}
          {p.legal && <circle r="0.75" fill="transparent" />}
        </g>
      ))}
    </svg>
  );
}

export const LudoBoard = memo(LudoBoardImpl);
