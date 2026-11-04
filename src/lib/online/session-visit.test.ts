import { describe, expect, it } from "vitest";
import { logEventInput } from "./online-inputs";

describe("visit length events", () => {
  it("keeps only whole seconds between 5 s and 4 h", () => {
    expect(logEventInput({ kind: "session_end", platform: "ios", detail: { seconds: 61.4, extra: "x" } }).detail).toEqual({ seconds: 61 });
    expect(() => logEventInput({ kind: "session_end", detail: { seconds: 4 } })).toThrow();
    expect(() => logEventInput({ kind: "session_end", detail: { seconds: 4 * 3600 + 1 } })).toThrow();
  });
});
