import { describe, expect, it, vi } from "vitest";
import { sessionInitializer } from "./session-policy";

const session = { user: { id: "anonymous-player-one" }, access_token: "test-access", refresh_token: "test-refresh" };
describe("anonymous player identity", () => {
  it("creates exactly one anonymous identity on concurrent first launch", async () => {
    const create = vi.fn(async () => session);
    const ensure = sessionInitializer(async () => null, create);
    const result = await Promise.all([ensure(), ensure(), ensure()]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.map(s => s.user.id)).toEqual(["anonymous-player-one", "anonymous-player-one", "anonymous-player-one"]);
  });
  it("keeps the same identity when the app opens again", async () => {
    const create = vi.fn(async () => ({ ...session, user: { id: "wrong-new-player" } }));
    expect((await sessionInitializer(async () => session, create)()).user.id).toBe("anonymous-player-one");
    expect(create).not.toHaveBeenCalled();
  });
  it("never creates a second player on the same phone when the saved session reads back empty", async () => {
    const create = vi.fn(async () => session);
    const ensure = sessionInitializer(async () => null, create);
    await ensure();
    await ensure();
    expect((await ensure()).user.id).toBe("anonymous-player-one");
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("does not replace saved identity when secure storage fails", async () => {
    const create = vi.fn(async () => session);
    await expect(sessionInitializer(async () => { throw new Error("store unavailable"); }, create)()).rejects.toThrow("store unavailable");
    expect(create).not.toHaveBeenCalled();
  });
});