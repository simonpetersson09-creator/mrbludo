import { describe, expect, it } from "vitest";
import { activityByDay, stockholmDate, stockholmDays } from "./activity-stats";
import { logEventInput } from "./online-inputs";

describe("admin activity", () => {
  it("buckets days in Stockholm time, not UTC", () => {
    expect(stockholmDate("2026-11-09T23:30:00Z")).toBe("2026-11-10");
    expect(stockholmDays(Date.parse("2026-11-09T23:30:00Z"), Date.parse("2026-11-08T09:43:00Z"))).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
  });
  it("counts a visit without an end report and uses the longest heartbeat", () => {
    const e = (kind: string, at: string, detail: object, platform = "ios", device_id = "d1") => ({ kind, platform, device_id, detail, created_at: at });
    const m = activityByDay([
      e("session", "2026-11-09T10:00:00Z", { sid: "a", seconds: 0 }),
      e("heartbeat", "2026-11-09T10:02:00Z", { sid: "a", seconds: 120 }),
      e("session", "2026-11-09T11:00:00Z", { sid: "b", seconds: 0 }, "android", "d2"),
      e("session_end", "2026-11-09T11:01:00Z", { sid: "b", seconds: 60 }, "android", "d2"),
      e("session", "2026-11-09T12:00:00Z", { sid: "w" }, "web", "d3"),
      e("session", "2026-11-09T12:00:00Z", { sid: "u" }, "android", "unknown"),
      e("local_game", "2026-11-09T12:00:00Z", { phase: "start" }),
      e("local_game", "2026-11-09T12:20:00Z", { phase: "finish" }),
    ], ["2026-11-09"]).get("2026-11-09")!;
    expect(m.appDevices).toBe(2);
    expect(m.appSessions).toBe(3);
    expect(m.localStarted).toBe(1);
    expect(m.localFinished).toBe(1);
  });
  it("accepts heartbeat and local game reports with only allowed fields", () => {
    expect(logEventInput({ kind: "heartbeat", platform: "ios", detail: { sid: "abc", seconds: 61.2, v: "1.0 (5)", x: 1 } }).detail).toEqual({ sid: "abc", seconds: 61, v: "1.0 (5)" });
    expect(logEventInput({ kind: "local_game", platform: "android", detail: { phase: "finish", variant: "fia", humans: 1, bots: 3, v: "1.0", name: "x" } }).detail)
      .toEqual({ phase: "finish", variant: "fia", humans: 1, bots: 3, v: "1.0" });
  });
});

import { activityByDay as abd } from "./activity-stats";
test("counts iPhone and Android devices separately per day", () => {
  const ev = [
    { kind: "session", device_id: "a1", platform: "android", detail: {}, created_at: "2026-11-19T11:00:00Z" },
    { kind: "session", device_id: "i1", platform: "ios", detail: {}, created_at: "2026-11-19T12:00:00Z" },
    { kind: "session", device_id: "i2", platform: "ios", detail: {}, created_at: "2026-11-19T13:00:00Z" },
  ];
  const r = abd(ev, ["2026-11-19"]).get("2026-11-19")!;
  expect([r.appDevices, r.iosDevices, r.androidDevices]).toEqual([3, 2, 1]);
});

import { extrasByDay } from "./activity-stats";
test("players, returning and new players per day", () => {
  const e = (device: string, at: string, kind = "local_game", detail: object = { phase: "start" }) => ({ kind, device_id: device, user_id: "u" + device, platform: "android", detail, created_at: at });
  const ev = [e("a", "2026-11-18T10:00:00Z"), e("a", "2026-11-19T10:00:00Z"), e("b", "2026-11-19T11:00:00Z"),
    e("b", "2026-11-19T11:05:00Z", "error", { v: "1.2 (1)" })];
  const r = extrasByDay(ev, [], new Map([["ua", "2026-11-17T12:00:00Z"]]), ["2026-11-18", "2026-11-19"]).get("2026-11-19")!;
  expect([r.played, r.returning, r.newPlayers, r.issues, r.avgAppAge]).toEqual([2, 1, 1, 1, 2]);
});

import { isPushError as _isPushError } from "./activity-stats";
import { test as _t, expect as _e } from "vitest";
_t("push plugin errors are not admin problem events", () => {
  _e(_isPushError({ message: 'Error: "PushNotifications.then()" is not implemented on android' })).toBe(true);
  _e(_isPushError({ message: "TypeError: x is undefined" })).toBe(false);
});
