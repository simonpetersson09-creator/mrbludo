import { expect, it } from "vitest";
import { CODE_TTL_MS, codeExpired } from "./match-logic";

it("keeps a shared match code alive for exactly six hours", () => {
  const made = Date.parse("2026-02-10T10:00:00.000Z");
  expect(codeExpired(new Date(made).toISOString(), made + 60_000)).toBe(false);
  expect(codeExpired(new Date(made).toISOString(), made + CODE_TTL_MS)).toBe(false);
  expect(codeExpired(new Date(made).toISOString(), made + CODE_TTL_MS + 1)).toBe(true);
});

it("refuses a code whose creation time cannot be read", () => {
  expect(codeExpired("", 0)).toBe(true);
  expect(codeExpired("not-a-date", 0)).toBe(true);
});
