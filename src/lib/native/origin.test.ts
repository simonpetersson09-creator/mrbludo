import { expect, it } from "vitest";
import { allowedNativeOrigin, validateLudoOrigin } from "./origin";
it("only accepts a separate stable HTTPS Ludo service", () => {
  expect(validateLudoOrigin("https://ludo.example.org/")).toBe("https://ludo.example.org");
  for (const value of ["http://ludo.example.org", "https://yatzy.example.org", "https://id-preview--example.lovable.app", "https://user:pass@ludo.example.org", "https://ludo.example.org/path"]) expect(() => validateLudoOrigin(value)).toThrow();
});
it("restricts native browser origins; bearer verification is still required", () => {
  expect(allowedNativeOrigin("capacitor://localhost")).toBe(true);
  expect(allowedNativeOrigin("https://localhost")).toBe(true);
  expect(allowedNativeOrigin("https://attacker.example")).toBe(false);
  expect(allowedNativeOrigin(null)).toBe(false);
});