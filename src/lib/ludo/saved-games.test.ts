// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createGame, type Player } from "./engine";
import { clearGame, listGames, loadGame, selectGame, startNewGame } from "./storage";

const players = (name: string): Player[] => [
  { id: "p0", color: 0, isBot: false, name },
  { id: "p1", color: 2, isBot: true, name: "Bot" },
] as Player[];

describe("several unfinished local matches", () => {
  beforeEach(() => localStorage.clear());
  it("starting a new match keeps the earlier one", () => {
    startNewGame(createGame(players("A")));
    startNewGame(createGame(players("B")));
    expect(listGames()).toHaveLength(2);
    expect(loadGame()?.players[0].name).toBe("B");
  });
  it("finishing one match removes only that one", () => {
    startNewGame(createGame(players("A")));
    const a = listGames()[0].id;
    startNewGame(createGame(players("B")));
    selectGame(a);
    expect(loadGame()?.players[0].name).toBe("A");
    clearGame();
    expect(listGames().map((e) => e.game.players[0].name)).toEqual(["B"]);
  });
});
