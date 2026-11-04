/**
 * Pure helpers for local (same-device) games: giving up, result counts, save validation and
 * stat de-duplication. No React, no storage.
 */
import { goalOf, isVariant, variantOf, YARD, type GameState } from "./engine";

/** Pieces a seat has in its goal, using the game's own variant (Fia's goal differs from Classic's). */
export const piecesInGoal = (state: GameState, seat: number) =>
  state.pieces[seat].filter((x) => x === goalOf(variantOf(state))).length;

/** Total progress of a seat: pieces in goal count most, then distance walked. */
const progress = (state: GameState, seat: number) =>
  state.pieces[seat].reduce((sum, x) => sum + (x === YARD ? 0 : x + 1), 0);

/**
 * "Give up" on this device: every human here gives up. Whoever is still playing is ranked by
 * progress (goal pieces first, then distance, then seat order) and the best one wins; players who
 * gave up are always ranked last.
 */
export function localGiveUp(state: GameState): GameState {
  if (state.phase === "finished") return state;
  // Mark every human here as given up in one step (the engine's one-by-one forfeit would end the
  // game early and leave the others in play).
  const s: GameState = { ...state, players: state.players.map((p) => (p.isBot ? { ...p } : { ...p, forfeited: true })), lastEvent: { kind: "forfeit", player: state.current } };
  const byProgress = (a: number, b: number) => piecesInGoal(s, b) - piecesInGoal(s, a) || progress(s, b) - progress(s, a) || a - b;
  const seats = s.players.map((_, i) => i);
  const active = seats.filter((i) => !s.players[i].forfeited).sort(byProgress);
  const out = seats.filter((i) => s.players[i].forfeited).sort(byProgress);
  // Only humans on this device: the game simply ends, the one furthest ahead is named first.
  const ranking = [...active, ...out];
  return { ...s, phase: "finished", winner: ranking[0], ranking, dice: null };
}

const isInt = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** True only for a structurally sound, unfinished saved game that the engine can safely continue. */
export function isValidSave(g: unknown): g is GameState {
  if (!g || typeof g !== "object") return false;
  type Loose = { version?: unknown; variant?: unknown; players?: unknown; pieces?: unknown; phase?: unknown; current?: unknown; dice?: unknown; sixesInRow?: unknown; turnCount?: unknown; winner?: unknown; ranking?: unknown; lastEvent?: unknown };
  const s = g as Loose;
  if (s.version !== 1 || (s.variant !== undefined && !isVariant(s.variant))) return false;
  const goal = goalOf(variantOf(s as { variant?: "classic" | "fia" }));
  const players = s.players, pieces = s.pieces;
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) return false;
  const colors = new Set<number>();
  for (const p of players) {
    if (!p || typeof p !== "object") return false;
    const q = p as { id?: unknown; name?: unknown; color?: unknown; isBot?: unknown; forfeited?: unknown };
    if (typeof q.id !== "string" || q.id.length > 80 || typeof q.name !== "string" || q.name.length > 40) return false;
    if (!isInt(q.color, 0, 3) || colors.has(q.color as number) || typeof q.isBot !== "boolean") return false;
    if (q.forfeited !== undefined && typeof q.forfeited !== "boolean") return false;
    colors.add(q.color as number);
  }
  if (!Array.isArray(pieces) || pieces.length !== players.length) return false;
  for (const row of pieces) if (!Array.isArray(row) || row.length !== 4 || !row.every((x) => isInt(x, YARD, goal))) return false;
  if (s.phase !== "roll" && s.phase !== "move") return false;
  if (!isInt(s.current, 0, players.length - 1) || (players[s.current as number] as { forfeited?: boolean }).forfeited) return false;
  if (s.phase === "move" ? !isInt(s.dice, 1, 6) : !(s.dice === null || isInt(s.dice, 1, 6))) return false;
  if (!isInt(s.sixesInRow, 0, 1000) || !isInt(s.turnCount, 0, 1_000_000)) return false;
  if (s.winner !== null || s.ranking !== null) return false;
  if (s.lastEvent !== null && (typeof s.lastEvent !== "object" || !["rolled", "moved", "forfeit"].includes((s.lastEvent as { kind?: string }).kind ?? ""))) return false;
  return true;
}

/** Identity of the latest event; equal before and after a save/reload, so a resumed game never counts it twice. */
export const eventKey = (state: GameState | null) => (state?.lastEvent ? `${state.turnCount}:${JSON.stringify(state.lastEvent)}` : "");

/** Local statistics may only hold non-negative whole numbers; anything else becomes 0. */
export function cleanCount(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 1_000_000) : 0;
}
