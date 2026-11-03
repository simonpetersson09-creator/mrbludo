import { describe, expect, it } from "vitest";
import { possessive } from "./LudoBoard";
describe("turn bubble genitive", () => {
  it("drops the extra s after names ending in s", () => {
    expect(possessive("Lars tur", "Lar")).toBe("Lars tur");
    expect(possessive("Larss tur", "Lars")).toBe("Lars tur");
    expect(possessive("James's turn", "James")).toBe("James' turn");
  });
  it("keeps the s for other names", () => expect(possessive("Simons tur", "Simon")).toBe("Simons tur"));
});
