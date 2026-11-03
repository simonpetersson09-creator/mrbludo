// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { completeRatePrompt, shouldShowRatePrompt, snoozeRatePrompt } from "./rate-app";

describe("rating prompt schedule", () => {
  beforeEach(() => localStorage.clear());

  it("first asks after five finished games", () => {
    expect(shouldShowRatePrompt(4)).toBe(false);
    expect(shouldShowRatePrompt(5)).toBe(true);
  });

  it("waits ten more games after the first 'later', then twenty", () => {
    snoozeRatePrompt(5);
    expect(shouldShowRatePrompt(14)).toBe(false);
    expect(shouldShowRatePrompt(15)).toBe(true);
    snoozeRatePrompt(15);
    expect(shouldShowRatePrompt(34)).toBe(false);
    expect(shouldShowRatePrompt(35)).toBe(true);
  });

  it("stops after three 'later'", () => {
    snoozeRatePrompt(5); snoozeRatePrompt(15); snoozeRatePrompt(35);
    expect(shouldShowRatePrompt(1000)).toBe(false);
  });

  it("stops for good after choosing to rate", () => {
    completeRatePrompt();
    expect(shouldShowRatePrompt(1000)).toBe(false);
  });
});
