import { memo } from "react";
import { COLOR_KEYS, GOAL, type Color, type GameState } from "@/lib/ludo/engine";
import { HOME_COLUMN, TRACK, YARD_ORIGIN, pieceCenter } from "@/lib/ludo/board";

const FILL: Record<Color, string> = {
  0: "var(--ludo-red)", 1: "var(--ludo-green)", 2: "var(--ludo-yellow)", 3: "var(--ludo-blue)",
};

interface Props {
  state: GameState;
  legal: number[];
  onPick: (piece: number) => void;
  captureAt?: [number, number] | null;
}

function LudoBoardImpl({ state, legal, onPick, captureAt }: Props) {
  const seatColors = new Set(state.players.map((p) => p.color));

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
    <svg viewBox="0 0 15 15" className="h-full w-full select-none" role="img" aria-label="Ludo-bräde">
      <defs>
        <radialGradient id="pieceShine" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="0.75" />
          <stop offset="45%" stopColor="white" stopOpacity="0.1" />
          <stop offset="100%" stopColor="black" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="15" height="15" rx="0.4" fill="var(--board)" />
      {([0, 1, 2, 3] as Color[]).map((c) => {
        const [x, y] = YARD_ORIGIN[c];
        const active = seatColors.has(c);
        return (
          <g key={c} opacity={active ? 1 : 0.35}>
            <rect x={x} y={y} width="6" height="6" fill={FILL[c]} />
            <rect x={x + 0.8} y={y + 0.8} width="4.4" height="4.4" rx="0.5" fill="var(--board)" />
            {[[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]].map(([dx, dy], i) => (
              <circle key={i} cx={x + dx + 0.5} cy={y + dy + 0.5} r="0.55" fill={FILL[c]} opacity="0.3" />
            ))}
          </g>
        );
      })}
      {TRACK.map(([c, r], i) => {
        const startColor = i % 13 === 0 ? ((i / 13) as Color) : null;
        return (
          <g key={i}>
            <rect x={c} y={r} width="1" height="1" fill={startColor != null ? FILL[startColor] : "var(--board)"} stroke="var(--board-line)" strokeWidth="0.04" />
            {startColor != null && <text x={c + 0.5} y={r + 0.68} textAnchor="middle" fontSize="0.5" fill="var(--board)">★</text>}
          </g>
        );
      })}
      {([0, 1, 2, 3] as Color[]).map((c) =>
        HOME_COLUMN[c].map(([x, y], i) => (
          <rect key={`${c}-${i}`} x={x} y={y} width="1" height="1" fill={FILL[c]} stroke="var(--board-line)" strokeWidth="0.04" />
        )),
      )}
      <polygon points="6,6 9,6 7.5,7.5" fill={FILL[1]} />
      <polygon points="9,6 9,9 7.5,7.5" fill={FILL[2]} />
      <polygon points="9,9 6,9 7.5,7.5" fill={FILL[3]} />
      <polygon points="6,9 6,6 7.5,7.5" fill={FILL[0]} />

      {captureAt && (
        <circle key={`cap-${captureAt.join()}-${state.turnCount}`} cx={captureAt[0]} cy={captureAt[1]} r="0.6" fill="none" stroke="var(--destructive)" strokeWidth="0.12" className="capture-flash" style={{ transformOrigin: `${captureAt[0]}px ${captureAt[1]}px` }} />
      )}

      {pieces.map((p) => (
        <g
          key={p.key}
          className={`piece ${p.legal ? "piece-legal cursor-pointer" : ""}`}
          style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          onClick={p.legal ? () => onPick(p.idx) : undefined}
          role={p.legal ? "button" : undefined}
          aria-label={p.legal ? `Flytta ${COLOR_KEYS[p.color]} pjäs ${p.idx + 1}` : undefined}
        >
          {p.legal && <circle className="piece-ring" r="0.5" fill="none" stroke="var(--game-gold)" strokeWidth="0.1" />}
          <ellipse cx="0.04" cy="0.16" rx="0.34" ry="0.16" fill="black" opacity="0.25" />
          <circle r={p.done ? 0.26 : 0.34} fill={FILL[p.color]} stroke="hsl(195 50% 10%)" strokeWidth="0.05" />
          <circle r={p.done ? 0.26 : 0.34} fill="url(#pieceShine)" />
          {/* larger invisible tap target */}
          {p.legal && <circle r="0.75" fill="transparent" />}
        </g>
      ))}
    </svg>
  );
}

export const LudoBoard = memo(LudoBoardImpl);
