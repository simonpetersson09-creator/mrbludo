import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { applyMove, applyRoll, createGame, type GameState } from "@/lib/ludo/engine";
import { walkDurationMs } from "@/lib/ludo/piece-motion";
import { dieColorHoldMs, useDieColor } from "./useDieColor";

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

describe("useDieColor", () => {
  const COLORS = ["red", "green", "yellow", "blue"];
  const game = () => createGame([
    { id: "a", name: "A", color: 0, isBot: false },
    { id: "b", name: "B", color: 1, isBot: true },
  ]);
  // Red on square 8 with a five rolled: the walk to square 13 takes five squares.
  const ready = (): GameState => ({ ...game(), phase: "move", dice: 5, pieces: [[8, -1, -1, -1], [-1, -1, -1, -1]] });

  it("keeps the mover's colour while the piece walks, then hands over", async () => {
    vi.useFakeTimers();
    try {
      const before = ready();
      const after = applyMove(before, 0);
      const { result, rerender } = renderHook(
        ({ s }: { s: ReturnType<typeof ready> }) => useDieColor(COLORS[s.players[s.current].color] ?? "", s),
        { initialProps: { s: before } },
      );
      expect(result.current).toBe("red");
      rerender({ s: after });
      expect(result.current).toBe("red"); // the turn has not gone over yet
      await act(async () => { await vi.advanceTimersByTimeAsync(900); });
      expect(result.current).toBe("red");
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(result.current).toBe("green");
    } finally {
      vi.useRealTimers();
      }
  });

  it("does not restart the wait when the same position is re-fetched", async () => {
    vi.useFakeTimers();
    try {
      const before = ready();
      const after = applyMove(before, 0);
      const { result, rerender } = renderHook(
        ({ s }: { s: GameState }) => useDieColor(COLORS[s.players[s.current].color] ?? "", s),
        { initialProps: { s: before } },
      );
      rerender({ s: after });
      // The server sends the same position again a moment later: the die must still change on
      // schedule, not wait another full walk from now.
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      rerender({ s: { ...after } });
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(result.current).toBe("green");
    } finally {
      vi.useRealTimers();
    }
});
});
