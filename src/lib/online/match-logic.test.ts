import { describe, expect, it } from "vitest";
import { GOAL } from "@/lib/ludo/engine";
import { MatchError, performAction, startState, statDeltas, secureRoll } from "./match-logic";

const seats = [{ user_id: "A", seat: 0, display_name: "Anna" }, { user_id: "B", seat: 1, display_name: "Bo" }];
const fixed = (v: number) => () => v;

describe("online match logic", () => {
  it("two players sit opposite (red vs yellow)", () => {
    expect(startState(seats).players.map((p) => p.color)).toEqual([0, 2]);
  });
  it("rejects a roll from the player whose turn it is not", () => {
    expect(() => performAction(startState(seats), "B", { kind: "roll" }, fixed(6))).toThrow(MatchError);
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
    expect(d.A).toMatchObject({ played: 1, wins: 1, forfeits: 0 });
    expect(d.B).toMatchObject({ played: 1, wins: 0, forfeits: 1 });
  });
  it("finishing by reaching goal counts a win and a piece home", () => {
    const prev = startState(seats);
    prev.pieces[0] = [GOAL, GOAL, GOAL, 55];
    prev.phase = "move"; prev.dice = 1;
    const next = performAction(prev, "A", { kind: "move", piece: 3 }, fixed(1));
    expect(next.winner).toBe(0);
    expect(statDeltas(prev, next).A).toMatchObject({ played: 1, wins: 1, pieces_home: 1 });
  });
  it("server dice are always 1..6", () => {
    for (let i = 0; i < 2000; i++) { const v = secureRoll(); expect(v >= 1 && v <= 6).toBe(true); }
  });
});
