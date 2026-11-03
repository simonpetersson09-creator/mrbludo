import { describe, expect, it } from "vitest";
import { createGame, legalMoves } from "./engine";
import { pieceCenter } from "./board";
import { movePreviews } from "./move-preview";

describe("legal destination previews", () => {
  it("shows the destination five steps ahead without moving a piece", () => {
    const state = createGame([{ id: "a", name: "A", color: 0, isBot: false }, { id: "b", name: "B", color: 1, isBot: false }]);
    state.phase = "move"; state.dice = 5; state.pieces[0] = [0, -1, 54, 56];
    const before = JSON.stringify(state);
    const [x, y] = pieceCenter(0, 5, 0);
    expect(movePreviews(state, legalMoves(state))).toEqual([{ x, y, color: 0 }]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("deduplicates the shared starting square after a six", () => {
    const state = createGame([{ id: "a", name: "A", color: 0, isBot: false }, { id: "b", name: "B", color: 1, isBot: false }]);
    state.phase = "move"; state.dice = 6;
    expect(movePreviews(state, legalMoves(state))).toEqual([{ x: 1.5, y: 6.5, color: 0 }]);
    state.phase = "roll";
    expect(movePreviews(state, [0])).toEqual([]);
  });
});