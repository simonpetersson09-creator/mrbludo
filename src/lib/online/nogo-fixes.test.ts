import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyRoll, createGame, type GameState } from "@/lib/ludo/engine";
import { AWAY_SECONDS, TURN_SECONDS, autoStep, giveUpState, isAway, markReturn, performAction, startState, tickDecision, type MarkedState } from "./match-logic";
import { actInput, joinByCodeInput, MATCH_CODE_RE } from "./online-inputs";
import { PIN_LIMITS } from "./online-actions";
import { localGiveUp, piecesInGoal, isValidSave, eventKey, cleanCount } from "@/lib/ludo/local-result";
import { statsForYear } from "@/lib/ludo/storage";

const seats = [{ user_id: "u1", seat: 0, display_name: "Anna" }, { user_id: "u2", seat: 1, display_name: "Bo" }];
const fixed = (v: number) => () => v;

describe("1. no forfeit shortcut through the act endpoint", () => {
  it("act rejects forfeit; giving up only goes through leaveMatch", () => {
    expect(() => actInput({ matchId: "m", version: 1, action: { kind: "forfeit" } })).toThrow("err:bad_action");
    expect(actInput({ matchId: "m", version: 1, action: { kind: "roll" } }).action.kind).toBe("roll");
  });
  it("early quick-play give-up becomes a computer seat, private is a forfeit", () => {
    const s = startState(seats, 2);
    const quick = giveUpState(s, "u1", false);
    expect(quick.players[0].isBot).toBe(true);
    expect(quick.players[0].forfeited).toBeFalsy();
    const priv = giveUpState(s, "u1", true);
    expect(priv.players[0].forfeited).toBe(true);
  });
});

describe("11/12. continuous AI takeover and return notices", () => {
  it("after the first 60 s takeover the seat keeps being played without a new 60 s wait", () => {
    const s = startState(seats, 2);
    expect(tickDecision(s, false, TURN_SECONDS - 1)).toBe("none");
    const taken = autoStep(s, fixed(3));
    expect(isAway(taken, 0)).toBe(true);
    const again = { ...taken, current: 0, phase: "roll" } as GameState;
    expect(tickDecision(again, false, AWAY_SECONDS)).toBe("auto");
    expect(tickDecision(again, false, AWAY_SECONDS - 1)).toBe("none");
  });
  it("the takeover notice is raised once, not on every computer step", () => {
    const first = autoStep(startState(seats, 2), fixed(3)) as MarkedState;
    const second = autoStep({ ...first, current: 0, phase: "roll" } as GameState, fixed(3)) as MarkedState;
    expect(second.auto?.at).toBe(first.auto?.at);
  });
  it("returning gives control back and a back notice that survives the next own move", () => {
    const taken = { ...autoStep(startState(seats, 2), fixed(3)), current: 0, phase: "roll" } as GameState;
    const back = performAction(taken, "u1", { kind: "roll" }, fixed(3)) as MarkedState;
    expect(isAway(back, 0)).toBe(false);
    expect(back.back?.seat).toBe(0);
    expect((markReturn(back, 0) as MarkedState).back?.at).toBe(back.back?.at);
  });
  it("giving up is not announced as a return", () => {
    const taken = autoStep(startState(seats, 2), fixed(3));
    const gone = performAction(taken, "u1", { kind: "forfeit" }, fixed(1)) as MarkedState;
    expect(gone.back).toBeUndefined();
  });
});

describe("13. match code validation", () => {
  it("accepts only six characters from the code alphabet", () => {
    expect(joinByCodeInput({ code: " ab2cde " }).code).toBe("AB2CDE");
    for (const bad of ["", "ABC", "ABCDEFG", "ABCDE0", "ABCDEI", "AB'DE;", "ÅÄÖABC"]) expect(() => joinByCodeInput({ code: bad })).toThrow("err:no_match_code");
    expect(MATCH_CODE_RE.test("ABCDEF")).toBe(true);
  });
});

describe("8. PIN limits", () => {
  it("per player 5 and per network 10 per 15 min; the global ceiling is far above that", () => {
    expect(PIN_LIMITS.perUser).toBe(5);
    expect(PIN_LIMITS.perIp).toBe(10);
    expect(PIN_LIMITS.windowSeconds).toBe(900);
    expect(PIN_LIMITS.global).toBeGreaterThanOrEqual(300);
  });
});

const bots = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `B${i}`, color: (i + 1) as 1 | 2 | 3, isBot: true }));
const human = { id: "me", name: "Me", color: 0 as const, isBot: false };

describe("3. local give-up", () => {
  it("the computer furthest ahead wins and the human is ranked last", () => {
    const g = createGame([human, ...bots(3)]);
    g.pieces[1] = [0, -1, -1, -1];
    g.pieces[2] = [20, 56, -1, -1];
    g.pieces[3] = [30, -1, -1, -1];
    const r = localGiveUp(g);
    expect(r.phase).toBe("finished");
    expect(r.winner).toBe(2);
    expect(r.ranking).toEqual([2, 3, 1, 0]);
    expect(r.players[0].forfeited).toBe(true);
  });
  it("two humans on one device both give up together", () => {
    const g = createGame([human, { ...human, id: "me2", name: "Two", color: 1 }, ...bots(1).map((b) => ({ ...b, color: 2 as const }))]);
    const r = localGiveUp(g);
    expect(r.winner).toBe(2);
    expect(r.players[0].forfeited && r.players[1].forfeited).toBe(true);
  });
});

describe("4. Fia goal count", () => {
  it("counts Fia's goal (44), not Classic's (56)", () => {
    const g = createGame([human, ...bots(1)], "fia");
    g.pieces[0] = [44, 44, 10, -1];
    expect(piecesInGoal(g, 0)).toBe(2);
    const c = createGame([human, ...bots(1)]);
    c.pieces[0] = [56, 44, -1, -1];
    expect(piecesInGoal(c, 0)).toBe(1);
  });
});

describe("5. save validation", () => {
  it("accepts a real game and rejects damaged or altered saves", () => {
    const g = createGame([human, ...bots(1)]);
    expect(isValidSave(JSON.parse(JSON.stringify(g)))).toBe(true);
    expect(isValidSave(null)).toBe(false);
    expect(isValidSave({ ...g, players: [] })).toBe(false);
    expect(isValidSave({ ...g, pieces: [[99, -1, -1, -1], [-1, -1, -1, -1]] })).toBe(false);
    expect(isValidSave({ ...g, current: 5 })).toBe(false);
    expect(isValidSave({ ...g, phase: "move", dice: null })).toBe(false);
    expect(isValidSave({ ...g, phase: "finished" })).toBe(false);
    expect(isValidSave({ ...g, variant: "x" })).toBe(false);
    const fia = createGame([human, ...bots(1)], "fia");
    expect(isValidSave({ ...fia, pieces: [[56, -1, -1, -1], [-1, -1, -1, -1]] })).toBe(false);
  });
  it("cleans impossible statistics", () => {
    const s = statsForYear({ played: -3, wins: 10, captures: 1.7, piecesHome: "x" as never, forfeits: NaN, year: 2026 }, 2026);
    expect(s).toMatchObject({ played: 0, wins: 0, captures: 1, piecesHome: 0, forfeits: 0 });
    expect(cleanCount(Infinity)).toBe(0);
  });
});

describe("10. resumed games do not count the last event twice", () => {
  it("the event key is the same after saving and reloading", () => {
    const g = applyRoll(createGame([human, ...bots(1)]), 6);
    expect(eventKey(JSON.parse(JSON.stringify(g)))).toBe(eventKey(g));
    expect(eventKey(g)).not.toBe("");
  });
});

describe("2. iOS privacy manifest", () => {
  it("exists and is registered in the Xcode project resources", () => {
    const manifest = readFileSync("ios/App/App/PrivacyInfo.xcprivacy", "utf8");
    expect(manifest).toContain("NSPrivacyAccessedAPICategoryUserDefaults");
    expect(manifest).toContain("CA92.1");
    const pbx = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    expect(pbx).toContain("PrivacyInfo.xcprivacy in Resources */,");
  });
});

describe("14. maintenance endpoint", () => {
  it("checks the scheduler's secret before running", () => {
    const src = readFileSync("src/routes/api/public/maintenance.ts", "utf8");
    expect(src.indexOf("authenticateCronRequest(request)")).toBeGreaterThan(-1);
    expect(src.indexOf("authenticateCronRequest(request)")).toBeLessThan(src.indexOf("runMaintenance()"));
  });
});
