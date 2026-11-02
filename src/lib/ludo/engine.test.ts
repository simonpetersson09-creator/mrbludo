import { describe, expect, it } from "vitest";
import { applyMove, applyRoll, createGame, legalMoves, GOAL, YARD, type GameState } from "./engine";
import { chooseMove } from "./ai";

const two = () => createGame([
  { id: "a", name: "A", color: 0, isBot: false },
  { id: "b", name: "B", color: 2, isBot: true },
]);

describe("ludo rules", () => {
  it("needs a six to leave the yard", () => {
    const s = applyRoll(two(), 4);
    expect(s.current).toBe(1); // no moves -> turn passes
    const s6 = applyRoll(two(), 6);
    expect(legalMoves(s6)).toEqual([0, 1, 2, 3]);
    expect(applyMove(s6, 0).pieces[0][0]).toBe(0);
  });

  it("a six gives an extra roll", () => {
    const s = applyMove(applyRoll(two(), 6), 0);
    expect(s.current).toBe(0);
    expect(s.phase).toBe("roll");
  });

  it("third six in a row ends the turn unused", () => {
    let s: GameState = { ...two(), pieces: [[5, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]] };
    s = applyMove(applyRoll(s, 6), 0);
    s = applyMove(applyRoll(s, 6), 0);
    const before = s.pieces[0][0];
    s = applyRoll(s, 6);
    expect(s.current).toBe(1);
    expect(s.pieces[0][0]).toBe(before);
  });

  it("captures an opponent on a normal square", () => {
    // Red piece at 24 (abs 24), yellow piece at progress 50 -> abs (26+50)%52 = 24
    let s: GameState = { ...two(), pieces: [[20, YARD, YARD, YARD], [50, YARD, YARD, YARD]] };
    s = applyMove(applyRoll(s, 4), 0);
    expect(s.pieces[1][0]).toBe(YARD);
  });

  it("start squares are safe", () => {
    // Yellow on its start square (abs 26); red at progress 22 rolls 4 -> abs 26
    let s: GameState = { ...two(), pieces: [[22, YARD, YARD, YARD], [0, YARD, YARD, YARD]] };
    s = applyMove(applyRoll(s, 4), 0);
    expect(s.pieces[1][0]).toBe(0);
  });

  it("requires an exact roll to reach goal", () => {
    const s: GameState = { ...two(), pieces: [[54, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]] };
    expect(legalMoves(applyRoll(s, 3))).toEqual([]);
    expect(applyMove(applyRoll(s, 2), 0).pieces[0][0]).toBe(GOAL);
  });

  it("first with four pieces home wins", () => {
    const s: GameState = { ...two(), pieces: [[GOAL, GOAL, GOAL, 55], [YARD, YARD, YARD, YARD]] };
    const end = applyMove(applyRoll(s, 1), 3);
    expect(end.phase).toBe("finished");
    expect(end.winner).toBe(0);
    expect(end.ranking).toEqual([0, 1]);
  });

  it("bot never picks an illegal move", () => {
    for (let r = 1; r <= 6; r++) {
      const s = applyRoll({ ...two(), pieces: [[3, 40, YARD, 54], [YARD, YARD, YARD, YARD]] }, r);
      if (s.phase === "move") expect(legalMoves(s)).toContain(chooseMove(s));
    }
  });
});
