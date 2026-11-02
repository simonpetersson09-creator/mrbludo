import { describe, expect, it } from "vitest";
import { backAction } from "./back-policy";

describe("android back button", () => {
  it("minimizes on the home screen instead of closing", () => expect(backAction("/", true)).toBe("minimize"));
  it("asks before leaving a local match", () => expect(backAction("/play", true)).toBe("confirm-leave"));
  it("asks before leaving an online match", () => expect(backAction("/online/abc-123", true)).toBe("confirm-leave"));
  it("goes back from ordinary pages", () => expect(backAction("/settings", true)).toBe("back"));
  it("goes home when there is no history", () => expect(backAction("/online", false)).toBe("home"));
});
