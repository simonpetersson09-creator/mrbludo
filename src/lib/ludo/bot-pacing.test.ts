import { describe, expect, it } from "vitest";
import { createGame, type GameState, type Player } from "./engine";
import { BOT_CHAIN_EXTRA, BOT_DELAY, botWaitMs } from "./bot-pacing";

const PLAYERS: Player[] = [
  { id: "p0", name: "Simon", color: 0, isBot: false },
  { id: "p1", name: "Bottle", color: 1, isBot: true },
  { id: "p2", name: "Byte", color: 2, isBot: true },
];

const moved = (player: number, extraRoll = false): GameState["lastEvent"] => ({
  kind: "moved",
  player,
  piece: 0,
  from: 0,
  to: 5,
  captured: [],
  reachedGoal: false,
  extraRoll,
});

const at = (current: number, lastEvent: GameState["lastEvent"]): GameState => ({
  ...createGame(PLAYERS),
  current,
  lastEvent,
});

describe("computer turn pacing", () => {
  it("waits the plain pause after a human's turn", () => {
    expect(botWaitMs(at(1, moved(0)), "normal")).toBe(1600);
    expect(botWaitMs(at(1, moved(0)), "fast")).toBe(250);
  });

  it("waits longer when its turn follows another computer's", () => {
    expect(botWaitMs(at(2, moved(1)), "normal")).toBe(BOT_DELAY.normal + BOT_CHAIN_EXTRA.normal);
    expect(botWaitMs(at(2, moved(1)), "normal")).toBe(2500);
    expect(botWaitMs(at(2, moved(1)), "fast")).toBe(BOT_DELAY.fast + BOT_CHAIN_EXTRA.fast);
  });

  it("keeps a computer's own extra roll after a six snappy", () => {
    expect(botWaitMs(at(1, moved(1, true)), "normal")).toBe(BOT_DELAY.normal);
    expect(botWaitMs(at(1, moved(1, true)), "fast")).toBe(BOT_DELAY.fast);
  });

  it("waits the plain pause on the very first turn", () => {
    expect(botWaitMs(at(1, null), "normal")).toBe(BOT_DELAY.normal);
  });
});
