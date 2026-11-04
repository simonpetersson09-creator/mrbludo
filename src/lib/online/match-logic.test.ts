import { describe, expect, it } from "vitest";
import { GOAL } from "@/lib/ludo/engine";
import { MatchError, autoStep, performAction, startState, statDeltas, secureRoll, type MarkedState } from "./match-logic";

const seats = [{ user_id: "A", seat: 0, display_name: "Anna" }, { user_id: "B", seat: 1, display_name: "Bo" }];
const fixed = (v: number) => () => v;

describe("online match logic", () => {
  it("two players sit opposite (red vs yellow)", () => {
    expect(startState(seats).players.map((p) => p.color)).toEqual([0, 2]);
  });
  it("rejects a roll from the player whose turn it is not", () => {
    expect(() => performAction(startState(seats), "B", { kind: "roll" }, fixed(6))).toThrow(MatchError);
  });
  it("an opponent can never move a piece on someone else's turn", () => {
    const s = performAction(startState(seats), "A", { kind: "roll" }, fixed(6));
    expect(() => performAction(s, "B", { kind: "move", piece: 0 }, fixed(1))).toThrow("not_your_turn");
  });
  it("rejects a non-member", () => {
    expect(() => performAction(startState(seats), "X", { kind: "roll" }, fixed(6))).toThrow("not_member");
  });
  it("a second roll before moving is rejected (double roll)", () => {
    const s = performAction(startState(seats), "A", { kind: "roll" }, fixed(6));
    expect(s.phase).toBe("move");
    expect(() => performAction(s, "A", { kind: "roll" }, fixed(6))).toThrow("bad_phase");
  });
  it("illegal move is rejected", () => {
    const s = performAction(startState(seats), "A", { kind: "roll" }, fixed(6));
    expect(() => performAction(s, "A", { kind: "move", piece: 7 }, fixed(1))).toThrow("illegal");
  });
  it("no-move roll passes the turn to the next player", () => {
    const s = performAction(startState(seats), "A", { kind: "roll" }, fixed(3));
    expect(s.current).toBe(1);
  });
  it("forfeit in a 2-player match ends it and counts played/win/forfeit", () => {
    const prev = startState(seats);
    const next = performAction(prev, "B", { kind: "forfeit" }, fixed(1));
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe(0);
    const d = statDeltas(prev, next);
    expect(d["A"]).toMatchObject({ played: 1, wins: 1, forfeits: 0 });
    expect(d["B"]).toMatchObject({ played: 1, wins: 0, forfeits: 1 });
  });
  it("finishing by reaching goal counts a win and a piece home", () => {
    const prev = startState(seats);
    prev.pieces[0] = [GOAL, GOAL, GOAL, 55];
    prev.phase = "move"; prev.dice = 1;
    const next = performAction(prev, "A", { kind: "move", piece: 3 }, fixed(1));
    expect(next.winner).toBe(0);
    expect(statDeltas(prev, next)["A"]).toMatchObject({ played: 1, wins: 1, pieces_home: 1 });
  });
  it("server dice are always 1..6", () => {
    for (let i = 0; i < 2000; i++) { const v = secureRoll(); expect(v >= 1 && v <= 6).toBe(true); }
  });
  it("a step played for an idle human is marked, so the app can tell them", () => {
    const next = autoStep(startState(seats), fixed(3)) as MarkedState;
    expect(next.auto?.seat).toBe(0);
    expect(Math.abs(Date.now() - (next.auto?.at ?? 0)) < 5000).toBe(true);
  });
  it("a computer seat leaves no notice (nobody was away)", () => {
    const s = startState(seats, 3);
    s.current = 2; s.phase = "roll";
    expect((autoStep(s, fixed(3)) as MarkedState).auto).toBeUndefined();
  });
  it("the player's own action clears the notice", () => {
    const marked = autoStep(startState(seats), fixed(3));
    const own = performAction(marked, "B", { kind: "roll" }, fixed(4)) as MarkedState;
    expect(own.auto).toBeUndefined();
  });
  it("a following computer step keeps the pending notice alive", () => {
    const marked = autoStep(startState(seats, 3), fixed(3)) as MarkedState;
    marked.current = 2; marked.phase = "roll";
    expect((autoStep(marked, fixed(3)) as MarkedState).auto?.seat).toBe(0);
  });
});
