/**
 * Mr. B Ludo – pure rules engine. No React, no DOM, no network.
 *
 * Variants: "classic" (below, default) and "fia" (Svenska Fia med knuff, see RULES.fia):
 * out on 1 or 6, a six brings two pieces out, no three-sixes limit, no safe squares,
 * own pieces can't be passed or shared, overshooting the goal bounces back.
 *
 * Classic rule choices (version 1):
 * - 2–4 players, 4 pieces each, one die per roll.
 * - A 6 is required to move a piece out of the yard onto its start square.
 * - A 6 gives an extra roll. A third consecutive 6 ends the turn unused.
 * - Landing on an opponent on a non-safe square sends ALL opponent pieces
 *   on that square back to their yard. Capturing gives no extra roll.
 * - Safe squares: the four start squares only. No blockades: any number of
 *   pieces may share a square.
 * - Exact roll required to reach the goal; overshooting moves are illegal.
 * - No legal move -> turn passes automatically (a 6 still grants the re-roll).
 * - First player with all four pieces in goal wins (place 1). The match then
 *   ends; remaining players are ranked by pieces in goal, then by total
 *   progress, then by seat order. A forfeiting player is ranked last.
 */

export type Color = 0 | 1 | 2 | 3; // red, green, yellow, blue (clockwise)
export const COLOR_KEYS = ["red", "green", "yellow", "blue"] as const;

/** Piece progress: -1 yard, 0..50 shared track, 51..55 home column, 56 goal. */
export const YARD = -1;
export const LAST_TRACK = 50;
export const GOAL = 56;
export const TRACK_LEN = 52;

/** Rule variants share one engine; each is a small rule configuration. */
export type Variant = "classic" | "fia";
export const VARIANTS: Variant[] = ["classic", "fia"];

export interface RuleConfig {
  /** Die values that bring a piece out of the yard. */
  exitRolls: number[];
  /** Consecutive sixes that end the turn unused (Infinity = no limit). */
  maxSixes: number;
  /** Start squares protect pieces from being knocked. */
  safeStarts: boolean;
  /** Own pieces may not be passed or shared (except putting out on a six). */
  blockOwn: boolean;
  /** Overshooting the goal walks back the extra steps instead of being illegal. */
  bounce: boolean;
  /** A six out of the yard brings two pieces when at least two are home. */
  doubleExitOnSix: boolean;
}

export const RULES: Record<Variant, RuleConfig> = {
  classic: { exitRolls: [6], maxSixes: 3, safeStarts: true, blockOwn: false, bounce: false, doubleExitOnSix: false },
  fia: { exitRolls: [1, 6], maxSixes: Infinity, safeStarts: false, blockOwn: true, bounce: true, doubleExitOnSix: true },
};

/** Track geometry per variant: where a color starts and how long its path is. */
export interface PathConfig {
  trackLen: number;
  /** Shift of each color's start square along the track (-1 = one step earlier). */
  startOffset: number;
  /** Last progress value on the shared track. */
  lastTrack: number;
  /** Colored home-column squares before the goal. */
  laneLen: number;
  /** Progress value of the goal (lastTrack + laneLen + 1). */
  goal: number;
}

export const PATHS: Record<Variant, PathConfig> = {
  classic: { trackLen: 52, startOffset: 0, lastTrack: 50, laneLen: 5, goal: 56 },
  // User-confirmed photograph: 40 outer circles, four lane circles, separate goal.
  fia: { trackLen: 40, startOffset: 0, lastTrack: 39, laneLen: 4, goal: 44 },
};

export const goalOf = (variant: Variant = "classic") => PATHS[variant].goal;
export const lastTrackOf = (variant: Variant = "classic") => PATHS[variant].lastTrack;
/** Absolute track index of a color's start square. */
export const startSquare = (color: Color, variant: Variant = "classic") =>
  (color * (PATHS[variant].trackLen / 4) + PATHS[variant].startOffset + PATHS[variant].trackLen) % PATHS[variant].trackLen;


export const variantOf = (state: { variant?: Variant }): Variant => (state.variant === "fia" ? "fia" : "classic");
export const isVariant = (v: unknown): v is Variant => v === "classic" || v === "fia";

export interface Player {
  id: string;
  name: string;
  color: Color;
  isBot: boolean;
  forfeited?: boolean;
}

export type Phase = "roll" | "move" | "finished";

export interface GameState {
  version: 1;
  /** Missing = classic (games saved before variants existed). */
  variant?: Variant;
  players: Player[];
  pieces: number[][]; // per player, 4 progress values
  current: number; // index into players
  phase: Phase;
  dice: number | null;
  sixesInRow: number;
  winner: number | null;
  ranking: number[] | null;
  lastEvent: GameEvent | null;
  turnCount: number;
}

export type GameEvent =
  | { kind: "rolled"; player: number; value: number; noMoves: boolean; threeSixes: boolean }
  | { kind: "moved"; player: number; piece: number; from: number; to: number; captured: { player: number; piece: number }[]; reachedGoal: boolean; extraRoll: boolean; alsoOut?: number }
  | { kind: "forfeit"; player: number };

export function createGame(players: Player[], variant: Variant = "classic"): GameState {
  if (players.length < 2 || players.length > 4) throw new Error("2–4 players required");
  return {
    version: 1,
    ...(variant === "fia" ? { variant } : {}),
    players,
    pieces: players.map(() => [YARD, YARD, YARD, YARD]),
    current: 0,
    phase: "roll",
    dice: null,
    sixesInRow: 0,
    winner: null,
    ranking: null,
    lastEvent: null,
    turnCount: 0,
  };
}

/** Absolute track square (0..51) for a piece on the shared track, else null. */
export function absSquare(color: Color, progress: number, variant: Variant = "classic"): number | null {
  if (progress < 0 || progress > PATHS[variant].lastTrack) return null;
  return (startSquare(color, variant) + progress) % PATHS[variant].trackLen;
}

export function isSafeSquare(abs: number, variant: Variant = "classic"): boolean {
  return RULES[variant].safeStarts && abs % 13 === 0;
}

export function targetOf(progress: number, roll: number, variant: Variant = "classic"): number | null {
  const rules = RULES[variant];
  if (progress === YARD) return rules.exitRolls.includes(roll) ? 0 : null;
  const goal = goalOf(variant);
  if (progress === goal) return null;
  const t = progress + roll;
  if (t <= goal) return t;
  return rules.bounce ? 2 * goal - t : null;
}

/** Every progress value a piece steps on, in order, ending on its target (bounce included). */
export function pathOf(progress: number, roll: number, variant: Variant = "classic"): number[] {
  const target = targetOf(progress, roll, variant);
  if (target == null) return [];
  if (progress === YARD) return [0];
  const goal = goalOf(variant);
  const out: number[] = [];
  for (let k = 1; k <= roll; k++) {
    const p = progress + k;
    out.push(p > goal ? 2 * goal - p : p);
  }
  return out;
}

function pieceCanMove(pieces: number[], i: number, roll: number, variant: Variant): boolean {
  const from = pieces[i];
  const path = pathOf(from, roll, variant);
  if (!path.length) return false;
  if (!RULES[variant].blockOwn) return true;
  // Putting out on a six may share the start square (Fia exception).
  if (from === YARD && roll === 6) return true;
  return !pieces.some((other, j) => j !== i && other !== YARD && other !== goalOf(variant) && path.includes(other));
}

export function legalMoves(state: GameState, roll = state.dice): number[] {
  if (roll == null || state.phase === "finished") return [];
  const variant = variantOf(state);
  const own = state.pieces[state.current];
  const out: number[] = [];
  own.forEach((_, i) => {
    if (pieceCanMove(own, i, roll, variant)) out.push(i);
  });
  return out;
}

function activeSeats(state: GameState): number[] {
  return state.players.map((_, i) => i).filter((i) => !state.players[i].forfeited);
}

function nextPlayer(state: GameState, from: number): number {
  const n = state.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (!state.players[i].forfeited) return i;
  }
  return from;
}

function passTurn(s: GameState): void {
  s.current = nextPlayer(s, s.current);
  s.sixesInRow = 0;
  s.phase = "roll";
  s.dice = null;
  s.turnCount++;
}

export function rankPlayers(state: GameState): number[] {
  const seats = state.players.map((_, i) => i);
  const goal = goalOf(variantOf(state));
  const goals = (i: number) => state.pieces[i].filter((x) => x === goal).length;
  const prog = (i: number) => state.pieces[i].reduce((a, x) => a + (x < 0 ? 0 : x), 0);
  return seats.sort((a, b) => {
    if (a === state.winner) return -1;
    if (b === state.winner) return 1;
    const fa = state.players[a].forfeited ? 1 : 0;
    const fb = state.players[b].forfeited ? 1 : 0;
    if (fa !== fb) return fa - fb;
    return goals(b) - goals(a) || prog(b) - prog(a) || a - b;
  });
}

function finish(s: GameState, winner: number): void {
  s.winner = winner;
  s.phase = "finished";
  s.dice = null;
  s.ranking = rankPlayers(s);
}

/** Apply a die result (value 1..6). Value comes from caller (local RNG or server). */
export function applyRoll(state: GameState, value: number): GameState {
  if (state.phase !== "roll") throw new Error("Not in roll phase");
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error("Bad die value");
  const s = clone(state);
  const player = s.current;
  s.dice = value;
  if (value === 6) s.sixesInRow++;
  if (value === 6 && s.sixesInRow >= RULES[variantOf(s)].maxSixes) {
    s.lastEvent = { kind: "rolled", player, value, noMoves: false, threeSixes: true };
    passTurn(s);
    return s;
  }
  const moves = legalMoves(s, value);
  if (moves.length === 0) {
    s.lastEvent = { kind: "rolled", player, value, noMoves: true, threeSixes: false };
    if (value === 6) {
      s.phase = "roll";
      s.dice = null;
    } else passTurn(s);
    return s;
  }
  s.phase = "move";
  s.lastEvent = { kind: "rolled", player, value, noMoves: false, threeSixes: false };
  return s;
}

export function applyMove(state: GameState, piece: number): GameState {
  if (state.phase !== "move" || state.dice == null) throw new Error("Not in move phase");
  if (!legalMoves(state).includes(piece)) throw new Error("Illegal move");
  const s = clone(state);
  const p = s.current;
  const roll = s.dice!;
  const from = s.pieces[p][piece];
  const variant = variantOf(s);
  const to = targetOf(from, roll, variant)!;
  s.pieces[p][piece] = to;
  // Fia: a six out of the yard brings a second home piece along.
  let alsoOut: number | undefined;
  if (from === YARD && roll === 6 && RULES[variant].doubleExitOnSix) {
    const second = s.pieces[p].findIndex((x, j) => j !== piece && x === YARD);
    if (second >= 0) { s.pieces[p][second] = 0; alsoOut = second; }
  }
  const captured: { player: number; piece: number }[] = [];
  const abs = absSquare(s.players[p].color, to, variant);
  if (abs != null && !isSafeSquare(abs, variant)) {
    s.players.forEach((op, oi) => {
      if (oi === p || op.forfeited) return;
      s.pieces[oi].forEach((pr, pi) => {
        if (absSquare(op.color, pr, variant) === abs) {
          s.pieces[oi][pi] = YARD;
          captured.push({ player: oi, piece: pi });
        }
      });
    });
  }
  const goal = goalOf(variant);
  const reachedGoal = to === goal;
  const extraRoll = roll === 6;
  s.lastEvent = { kind: "moved", player: p, piece, from, to, captured, reachedGoal, extraRoll, ...(alsoOut != null ? { alsoOut } : {}) };
  if (s.pieces[p].every((x) => x === goal)) {
    finish(s, p);
    return s;
  }
  if (extraRoll) {
    s.phase = "roll";
    s.dice = null;
  } else passTurn(s);
  return s;
}

export function forfeit(state: GameState, player: number): GameState {
  if (state.phase === "finished") return state;
  const s = clone(state);
  s.players[player].forfeited = true;
  s.lastEvent = { kind: "forfeit", player };
  const left = activeSeats(s);
  if (left.length === 1) {
    finish(s, left[0]);
    return s;
  }
  if (s.current === player) passTurn(s);
  return s;
}

function clone(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p })),
    pieces: s.pieces.map((a) => [...a]),
    ranking: s.ranking ? [...s.ranking] : null,
  };
}

export function rollDie(rng: () => number = Math.random): number {
  return Math.floor(rng() * 6) + 1;
}
