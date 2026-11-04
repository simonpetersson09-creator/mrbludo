import { describe, expect, it } from "vitest";
import { gaveUpRecipients, pushKey, remindRecipient } from "./policy";
import type { GameState } from "@/lib/ludo/engine";

const st = (over: Partial<GameState> = {}) => ({
  phase: "rolling", current: 0,
  players: [{ id: "u1", isBot: false, forfeited: false }, { id: "u2", isBot: false, forfeited: false }, { id: "bot:1", isBot: true, forfeited: false }],
  ...over,
}) as unknown as GameState;
const now = Date.parse("2026-11-04T12:00:00Z");

describe("paused friend match reminder", () => {
  it("waits 30 minutes before reminding", () => {
    expect(remindRecipient(st(), new Date(now - 29 * 60_000).toISOString(), now)).toBeNull();
    expect(remindRecipient(st(), new Date(now - 31 * 60_000).toISOString(), now)).toBe("u1");
  });
  it("never reminds a computer or a finished match", () => {
    expect(remindRecipient(st({ current: 2 }), new Date(now - 3_600_000).toISOString(), now)).toBeNull();
    expect(remindRecipient(st({ phase: "finished" } as Partial<GameState>), new Date(now - 3_600_000).toISOString(), now)).toBeNull();
  });
  it("sends at most one reminder per match every 6 hours", () => {
    expect(pushKey.remind("m", "u1", now)).toBe(pushKey.remind("m", "u1", now + 60_000));
    expect(pushKey.remind("m", "u1", now)).not.toBe(pushKey.remind("m", "u1", now + 6 * 3_600_000));
  });
});

describe("gave-up notification", () => {
  it("tells the other humans when a player forfeits", () => {
    const next = st({ players: [{ id: "u1", isBot: false, forfeited: true }, { id: "u2", isBot: false, forfeited: false }, { id: "bot:1", isBot: true, forfeited: false }] } as Partial<GameState>);
    expect(gaveUpRecipients(next, "u1")).toEqual(["u2"]);
  });
  it("stays silent when a computer took the seat instead", () => {
    expect(gaveUpRecipients(st(), "u1")).toEqual([]);
  });
});
