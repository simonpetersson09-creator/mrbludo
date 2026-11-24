import { describe, expect, it } from "vitest";
import { signHubToken, verifyHubToken } from "./hub-token";

const secret = "test-hub-secret";
const now = 1_800_000_000_000;

describe("hub token", () => {
  it("accepts a valid, unexpired token", async () => {
    expect(await verifyHubToken(await signHubToken(secret, now + 60_000), secret, now)).toBe(true);
  });
  it("rejects a wrong signature", async () => {
    const token = await signHubToken("other-secret", now + 60_000);
    expect(await verifyHubToken(token, secret, now)).toBe(false);
  });
  it("rejects an expired token", async () => {
    expect(await verifyHubToken(await signHubToken(secret, now - 1), secret, now)).toBe(false);
  });
  it("rejects when the secret is missing", async () => {
    expect(await verifyHubToken(await signHubToken(secret, now + 60_000), undefined, now)).toBe(
      false,
    );
  });
});
