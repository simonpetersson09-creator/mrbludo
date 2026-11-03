import { describe, expect, it } from "vitest";
import { applyMove, applyRoll, createGame } from "@/lib/ludo/engine";
import { walkDurationMs } from "@/lib/ludo/piece-motion";
import { dieColorHoldMs } from "./useDieColor";

const two = () => createGame([
  { id: "a", name: "A", color: 0, isBot: false },
  { id: "b", name: "B", color: 2, isBot: true },
]);

describe("die colour handover", () => {
  it("does not hold the colour when nobody has moved", () => {
    expect(dieColorHoldMs(applyRoll(two(), 6))).toBe(0);
  });

  it("holds the previous colour for exactly the walk of the piece that just moved", () => {
    const s = applyMove(applyRoll(two(), 6), 0);
    const ev = s.lastEvent;
    if (ev?.kind !== "moved") throw new Error("expected a move");
    expect(dieColorHoldMs(s)).toEqual(walkDurationMs(s.players[ev.player].color, ev.from, ev.to, ev.piece, ev.roll, "classic", ev.captured.length > 0) + 150);
    expect(dieColorHoldMs(s)).toBeGreaterThan(0);
  });
});
