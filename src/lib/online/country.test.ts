import { describe, expect, it } from "vitest";
import { isRealCountry } from "./online-inputs";
describe("player country", () => {
  it("accepts real countries", () => { for (const c of ["SE", "NO", "US", "JP", "BR"]) expect(isRealCountry(c)).toBe(true); });
  it("rejects made-up codes", () => { for (const c of ["XX", "ZZ", "QQ", "S", "SWE", "se1"]) expect(isRealCountry(c)).toBe(false); });
});
