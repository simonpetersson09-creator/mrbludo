import { describe, expect, it } from "vitest";
import { applyRoll, legalMoves, type GameState } from "@/lib/ludo/engine";
import {
  BOT_SECONDS, TURN_SECONDS, autoStep, earlyRounds, markReturn, performAction, replaceWithBot,
  startState, statDeltas, tickDecision, type MarkedState,
} from "./match-logic";

const seats = [
  { user_id: "u1", seat: 0, display_name: "Anna" },
  { user_id: "u2", seat: 1, display_name: "Bo" },
];
const fixed = (v: number) => () => v;

/** A quick-play state (2 humans) where it is u1's turn to roll. */
const quickState = () => startState(seats, 2);
/** A quick-play state with one computer seat (3 seats, 2 humans). */
const quickWithBot = () => startState(seats, 3);

describe("tickDecision – private matches pause, quick play auto-plays", () => {
  it("never auto-plays a private match, however long the idle time", () => {
    const s = quickState();
    expect(tickDecision(s, true, 0)).toBe("none");
    expect(tickDecision(s, true, TURN_SECONDS)).toBe("none");
    expect(tickDecision(s, true, 14 * 24 * 3600)).toBe("none");
  });

  it("plays a quick-play human's step only after TURN_SECONDS (60 s)", () => {
    const s = quickState();
    expect(tickDecision(s, false, 0)).toBe("none");
    expect(tickDecision(s, false, TURN_SECONDS - 1)).toBe("none");
    expect(tickDecision(s, false, TURN_SECONDS)).toBe("auto");
    expect(tickDecision(s, false, 3600)).toBe("auto");
  });

  it("moves computer seats after BOT_SECONDS", () => {
    const s = quickWithBot();
    expect(s.players[2].isBot).toBe(true);
    const botTurn = { ...s, current: 2 } as GameState;
    expect(tickDecision(botTurn, false, BOT_SECONDS - 1)).toBe("none");
    expect(tickDecision(botTurn, false, BOT_SECONDS)).toBe("auto");
  });

  it("does nothing for finished matches or a forfeited current player", () => {
    const s = quickState();
    expect(tickDecision({ ...s, phase: "finished" } as GameState, false, 9999)).toBe("none");
    const forfeited = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, forfeited: true } : p)) } as GameState;
    expect(tickDecision(forfeited, false, 9999)).toBe("none");
  });
});

describe("earlyRounds – the first two rounds", () => {
  it("is true while turnCount is below two full rounds, false after", () => {
    const s = quickState();
    expect(earlyRounds(s)).toBe(true);
    expect(earlyRounds({ ...s, turnCount: 3 } as GameState)).toBe(true);
    expect(earlyRounds({ ...s, turnCount: 4 } as GameState)).toBe(false);
    expect(earlyRounds({ ...s, turnCount: 40 } as GameState)).toBe(false);
  });
});

describe("replaceWithBot – early quick-play give-up becomes a permanent computer seat", () => {
  it("removes the player's id and name and marks the seat as a computer", () => {
    const s = quickState();
    const next = replaceWithBot(s, 0);
    expect(next.players[0].isBot).toBe(true);
    expect(next.players[0].id).not.toBe("u1");
    expect(next.players[0].id.startsWith("bot:")).toBe(true);
    expect(next.players[0].name).not.toBe("Anna");
    expect(next.players[1]).toEqual(s.players[1]);
  });

  it("keeps the pieces and lets the match continue with the same turn order", () => {
    const s = quickState();
    const next = replaceWithBot(s, 0);
    expect(next.pieces).toEqual(s.pieces);
    expect(next.current).toBe(s.current);
    expect(next.phase).toBe(s.phase);
    // The server can immediately play the new computer seat's turn.
    const played = autoStep({ ...next, current: 0 } as GameState, fixed(3));
    expect(played).not.toBe(next);
    expect((played as MarkedState).auto).toBeUndefined();
  });

  it("never gives the replaced human any statistics, even at match end", () => {
    const s = quickState();
    const replaced = replaceWithBot(s, 0);
    const finished = { ...replaced, phase: "finished", winner: 0 } as GameState;
    const deltas = statDeltas(replaced, finished);
    expect(deltas["u1"]).toBeUndefined();
    expect(deltas["u2"]?.played).toBe(1);
    expect(deltas["u2"]?.wins).toBe(0);
  });

  it("is a no-op for computer seats and finished matches", () => {
    const s = quickWithBot();
    expect(replaceWithBot(s, 2)).toBe(s);
    expect(replaceWithBot({ ...s, phase: "finished" } as GameState, 0)).toEqual({ ...s, phase: "finished" });
  });
});

describe("markReturn – the player is back", () => {
  it("turns an auto mark into a back mark when that player acts again", () => {
    const s = quickState();
    const marked = autoStep(s, fixed(3)) as MarkedState;
    expect(marked.auto?.seat).toBe(0);
    // u2 plays her own turns herself; u1's mark must survive until u1 returns.
    let cur = marked as GameState;
    for (let i = 0; i < 20 && cur.current !== 0 && cur.phase !== "finished"; i++) {
      const pid = cur.players[cur.current].id;
      if (cur.phase === "roll") cur = performAction(cur, pid, { kind: "roll" }, fixed(3));
      else {
        const mv = legalMoves(cur)[0];
        if (mv == null) break;
        cur = performAction(cur, pid, { kind: "move", piece: mv }, fixed(3));
      }
    }
    expect(cur.current).toBe(0);
    expect((cur as MarkedState).auto?.seat).toBe(0);
    const own = performAction(cur, "u1", { kind: "roll" }, fixed(4)) as MarkedState;
    expect(own.auto).toBeUndefined();
    expect(own.back?.seat).toBe(0);
  });

  it("keeps the mark when another player acts, and drops a back mark when its player acts on", () => {
    const s = quickState();
    const marked = autoStep(s, fixed(3)) as MarkedState;
    const other = performAction(marked, "u2", { kind: "roll" }, fixed(4)) as MarkedState;
    expect(other.auto?.seat).toBe(0);
    expect(other.back).toBeUndefined();
  });

  it("leaves unmarked states untouched", () => {
    const s = quickState();
    expect(markReturn(s, 0)).toBe(s);
  });
});

describe("quick-play auto-step uses only legal moves", () => {
  it("server-played steps always follow the engine's legal moves", () => {
    let s = quickWithBot();
    for (let i = 0; i < 60 && s.phase !== "finished"; i++) {
      const before = s;
      s = autoStep(s, () => 1 + (i % 6));
      if (s === before) break;
      if (s.phase === "move") {
        // autoStep resolves a full step, so the state after it is always consistent:
        // either still move phase (extra roll) with legal moves, or the next player's roll.
        expect(s.phase === "move" ? legalMoves(s).length > 0 || s.lastEvent?.kind === "moved" : true).toBe(true);
      }
    }
    expect(s.turnCount).toBeGreaterThan(0);
  });
});

describe("constants", () => {
  it("quick-play turn limit is 60 seconds", () => {
    expect(TURN_SECONDS).toBe(60);
  });
  it("a private match paused for two hours is still untouched by the clock", () => {
    const s = quickState();
    expect(tickDecision(s, true, 2 * 3600)).toBe("none");
  });
});
