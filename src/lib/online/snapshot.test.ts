import { beforeEach, expect, it } from "vitest";
import { lastOnlineMatch, loadProfileSnapshot, rememberOnlineMatch, saveProfileSnapshot } from "./snapshot";

beforeEach(() => localStorage.clear());
it("retains the same active online match shortcut after restart", () => {
  rememberOnlineMatch("ludo-match-123");
  expect(lastOnlineMatch()).toBe("ludo-match-123");
  rememberOnlineMatch(null);
  expect(lastOnlineMatch()).toBeNull();
});
it("never restores administrator privileges from the offline display cache", () => {
  saveProfileSnapshot({ userId: "player", profile: null, stats: null, isAdmin: true });
  expect(loadProfileSnapshot()?.isAdmin).toBe(false);
  expect(loadProfileSnapshot()?.userId).toBe("player");
});