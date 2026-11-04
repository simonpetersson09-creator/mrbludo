import { describe, it, expect } from "vitest";
import { adminPinInput } from "./online-inputs";
import { pinMatches } from "./online-actions";
describe("admin PIN", () => {
  it("only the exact PIN matches", async () => {
    expect(await pinMatches("482913", "482913")).toBe(true);
    expect(await pinMatches("482914", "482913")).toBe(false);
    expect(await pinMatches("48291", "482913")).toBe(false);
  });
  it("accepts only 4–12 digits", () => {
    expect(adminPinInput({ pin: " 1234 " }).pin).toBe("1234");
    expect(() => adminPinInput({ pin: "123" })).toThrow("err:forbidden");
    expect(() => adminPinInput({ pin: "12a4" })).toThrow("err:forbidden");
  });
});
