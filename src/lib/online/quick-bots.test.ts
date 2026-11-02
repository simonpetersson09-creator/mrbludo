import { describe, expect, it } from "vitest";
import { autoStep, startState, statDeltas } from "./match-logic";
import { forfeit } from "@/lib/ludo/engine";

const seats = [{ user_id: "a", seat: 0, display_name: "A" }, { user_id: "b", seat: 1, display_name: "B" }];

describe("quick play computer seats", () => {
  it("fills empty seats up to the chosen size with computer players", () => {
    const s = startState(seats, 4);
    expect(s.players.map((p) => p.isBot)).toEqual([false, false, true, true]);
  });
  it("computer seats never get statistics", () => {
    let s = startState(seats, 3);
    s = forfeit(s, 0);
    const prev = s; const next = forfeit(s, 1);
    const d = statDeltas(prev, next);
    expect(Object.keys(d).sort()).toEqual(["a", "b"]);
    expect(autoStep(next, () => 3)).toBe(next);
  });
});
