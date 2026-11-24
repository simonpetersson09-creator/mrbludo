import { describe, expect, it } from "vitest";
import { isTestBuildReport } from "./build-channel";
import { logEventInput } from "./online-inputs";

describe("test builds mark themselves", () => {
  it("TestFlight/debug iPhone visit is a test report", () => {
    expect(isTestBuildReport(logEventInput({ kind: "session", platform: "ios", detail: { sid: "a", seconds: 0, ch: "test" } }))).toBe(true);
  });
  it("App Store / Google Play visit is not", () => {
    expect(isTestBuildReport(logEventInput({ kind: "session", platform: "android", detail: { sid: "a", seconds: 0, ch: "store" } }))).toBe(false);
  });
  it("old builds without channel are not", () => {
    expect(isTestBuildReport(logEventInput({ kind: "session", platform: "ios", detail: { sid: "a", seconds: 0 } }))).toBe(false);
  });
  it("web never marks", () => {
    expect(isTestBuildReport(logEventInput({ kind: "session", platform: "web", detail: { ch: "test" } }))).toBe(false);
  });
});
