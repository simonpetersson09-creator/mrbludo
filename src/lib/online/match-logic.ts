import { randomBotNames } from "@/lib/ludo/bot-names";
/**
 * Online match rules on top of the shared local engine. Pure: no DB, no network.
 * Server functions call these after loading a match row; the same engine rules
 * apply to local and online games.
 */
import { applyMove, canWalkOut, applyRoll, createGame, forfeit, goalOf, isVariant, variantOf, legalMoves, type Color, type GameState, type Variant } from "@/lib/ludo/engine";
import { chooseBotAction } from "@/lib/ludo/ai";

export const SEAT_COLORS: Record<number, Color[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
/** Seconds a quick-play player has for one step (roll or move) before the server's computer plays it. Private matches never auto-play. */
export const TURN_SECONDS = 60;
/** Yatzy's invite rules: a shared match code stops working 6 hours after the match was made. */
export const CODE_TTL_MS = 6 * 3600_000;
/** True once a match code is older than its lifetime (or its creation time is unusable). */
export function codeExpired(createdAtIso: string, now = Date.now(), ttlMs = CODE_TTL_MS): boolean {
  const created = Date.parse(createdAtIso);
  return !Number.isFinite(created) || now - created > ttlMs;
}

export interface SeatInfo { user_id: string; seat: number; display_name: string }

export type Action = { kind: "roll" } | { kind: "move"; piece: number; walkOut?: boolean } | { kind: "forfeit" };

export class MatchError extends Error {
  constructor(public code: "not_member" | "not_your_turn" | "bad_phase" | "illegal" | "finished" | "conflict", msg?: string) {
    super(msg ?? code);
  }
}

/** Seconds the server waits before playing a computer seat's step. */
export const BOT_SECONDS = 1;
export const isBotId = (id: string) => id.startsWith("bot:");

/** Humans sorted by seat; `total` > humans fills the rest with server-played computer seats (quick play). */
export function startState(seats: SeatInfo[], total = seats.length, variant: Variant = "classic"): GameState {
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  const n = Math.max(total, sorted.length);
  const colors = SEAT_COLORS[n];
  if (!colors || sorted.length < 1) throw new Error("2–4 players required");
  const humans = sorted.map((s, i) => ({ id: s.user_id, name: s.display_name, color: colors[i], isBot: false }));
  const botNames = randomBotNames(n - sorted.length);
  const bots = Array.from({ length: n - sorted.length }, (_, k) => ({ id: `bot:${k + 1}`, name: botNames[k], color: colors[sorted.length + k], isBot: true }));
  return createGame([...humans, ...bots], isVariant(variant) ? variant : "classic");
}

export function seatOf(state: GameState, userId: string): number {
  return state.players.findIndex((p) => p.id === userId);
}

/** Marks a step the server played for a player who was away, so the app can say so afterwards. */
export interface AutoMark { seat: number; at: number }
export type MarkedState = GameState & { auto?: AutoMark; back?: AutoMark };

/**
 * A step the player took themselves is never "played for you". The mark belongs to the marked
 * seat: it survives other players' actions, and when the marked player acts again it becomes a
 * "back" mark so the app can say they returned. A back mark is dropped when its player acts on.
 */
export function markReturn(state: GameState, seat: number): GameState {
  const m = state as MarkedState;
  if (m.auto === undefined && m.back === undefined) return state;
  if (m.auto && m.auto.seat === seat) {
    const { auto: _auto, back: _back, ...rest } = m;
    return { ...rest, back: { seat, at: Date.now() } } as GameState;
  }
  if (m.back && m.back.seat === seat) {
    const { back: _back, ...rest } = m;
    return rest as GameState;
  }
  return state;
}

/** Apply one player action. `roll` is the server-generated die value. */
export function performAction(state: GameState, userId: string, action: Action, roll: () => number): GameState {
  const seat = seatOf(state, userId);
  if (seat < 0) throw new MatchError("not_member");
  if (state.phase === "finished") throw new MatchError("finished");
  if (action.kind === "forfeit") return markReturn(forfeit(state, seat), seat);
  if (state.players[seat].forfeited) throw new MatchError("not_member");
  if (state.current !== seat) throw new MatchError("not_your_turn");
  if (action.kind === "roll") {
    if (state.phase !== "roll") throw new MatchError("bad_phase");
    return markReturn(applyRoll(state, roll()), seat);
  }
  if (state.phase !== "move") throw new MatchError("bad_phase");
  if (!legalMoves(state).includes(action.piece)) throw new MatchError("illegal");
  if (action.walkOut && !canWalkOut(state, action.piece)) throw new MatchError("illegal");
  return markReturn(applyMove(state, action.piece, !!action.walkOut), seat);
}

/** Server auto-step for an idle/absent current player (roll, or best legal move). */
export function autoStep(state: GameState, roll: () => number): GameState {
  if (state.phase === "finished") return state;
  const seat = state.current;
  const next = state.phase === "roll"
    ? applyRoll(state, roll())
    : (() => { const a = chooseBotAction(state); return applyMove(state, a.piece, a.walkOut); })();
  // Computer seats need no notice; only a human who was away is told the server moved for them.
  return state.players[seat]?.isBot ? next : ({ ...next, auto: { seat, at: Date.now() } } as MarkedState);
}

/**
 * What the server clock does with a match whose current player has been idle for `idleSeconds`.
 * Private matches never auto-play or auto-forfeit: they simply wait until the player returns.
 * Quick play: computers move after BOT_SECONDS, an idle human's step is played after TURN_SECONDS
 * (even while still connected), and a temporary disconnect is never treated as giving up.
 */
export function tickDecision(state: GameState, isPrivate: boolean, idleSeconds: number): "none" | "auto" {
  if (state.phase === "finished" || isPrivate) return "none";
  const cur = state.players[state.current];
  if (!cur || cur.forfeited) return "none";
  return idleSeconds >= (cur.isBot ? BOT_SECONDS : TURN_SECONDS) ? "auto" : "none";
}

/** True while the match is still in its first two rounds (everyone's first two turns). */
export function earlyRounds(state: GameState): boolean {
  return state.turnCount < 2 * state.players.length;
}

/**
 * Quick play, early give-up: the seat becomes a permanent server-played computer. The player's
 * id and name leave the state, so no later capture/goal/result can ever be counted for them.
 */
export function replaceWithBot(state: GameState, seat: number): GameState {
  const p = state.players[seat];
  if (!p || p.isBot || state.phase === "finished") return state;
  // A takeover name that differs from the leaver's, so nobody mistakes the computer for them.
  const name = randomBotNames(4).find((n) => n !== p.name) ?? randomBotNames(1)[0];
  const players = state.players.map((pl, i) => (i === seat ? { ...pl, id: `bot:takeover:${seat}`, name, isBot: true } : pl));
  const next = { ...state, players } as MarkedState;
  delete next.auto;
  delete next.back;
  return next as GameState;
}

export interface StatDelta { played: number; wins: number; captures: number; pieces_home: number; forfeits: number }
const zero = (): StatDelta => ({ played: 0, wins: 0, captures: 0, pieces_home: 0, forfeits: 0 });

/** Per-user stat changes caused by moving from `prev` to `next`. */
export function statDeltas(prev: GameState, next: GameState): Record<string, StatDelta> {
  const out: Record<string, StatDelta> = {};
  const get = (id: string) => (out[id] ??= zero());
  const ev = next.lastEvent;
  if (ev && ev !== prev.lastEvent && ev.kind === "moved") {
    const id = next.players[ev.player].id;
    // A computer's move gives no capture/goal stats, but the match result below still counts for the humans.
    if (!next.players[ev.player].isBot) {
      if (ev.captured.length) get(id).captures += ev.captured.length;
      if (ev.reachedGoal) get(id).pieces_home += 1;
    }
  }
  if (prev.phase !== "finished" && next.phase === "finished") {
    next.players.forEach((p, i) => {
      if (p.isBot) return;
      const d = get(p.id);
      d.played = 1;
      if (next.winner === i) d.wins = 1;
      if (p.forfeited) d.forfeits = 1;
    });
  }
  return out;
}

export const piecesHome = (state: GameState, seat: number) => state.pieces[seat].filter((x) => x === goalOf(variantOf(state))).length;

export function secureRoll(): number {
  const buf = new Uint32Array(1);
  // Rejection sampling for an unbiased 1..6.
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < 4294967292) return (buf[0] % 6) + 1;
  }
}

export function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join("");
}
