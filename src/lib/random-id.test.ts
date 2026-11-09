import { describe, expect, it } from "vitest";
import { randomId } from "./random-id";

describe("randomId", () => {
  it("works without crypto.randomUUID (old Android)", () => {
    const orig = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    const a = randomId(), b = randomId();
    Object.defineProperty(crypto, "randomUUID", { value: orig, configurable: true });
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
