import { describe, expect, it } from "vitest";
import { matchQrValue, parseMatchCode } from "./match-code";

describe("match QR code", () => {
  it("reads back the code the waiting room shows", () => {
    expect(parseMatchCode(matchQrValue("AB23CD"))).toBe("AB23CD");
  });
  it("accepts a typed or raw 6-character code", () => {
    expect(parseMatchCode(" ab23cd ")).toBe("AB23CD");
  });
  it("ignores QR codes that are not match codes", () => {
    expect(parseMatchCode("https://example.com")).toBeNull();
    expect(parseMatchCode("ABC")).toBeNull();
  });
});
