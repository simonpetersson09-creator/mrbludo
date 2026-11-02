// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setAvatar, getAvatars, getUser } = vi.hoisted(() => ({
  setAvatar: vi.fn(),
  getAvatars: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/online/online.functions", () => ({
  setAvatar: (a: unknown) => setAvatar(a),
  getAvatars: (a: unknown) => getAvatars(a),
}));
vi.mock("@/lib/auth/client", () => ({ supabase: { auth: { getUser: () => getUser() } } }));

import { adoptOwnAvatarFromServer, getOwnAvatar, setOwnAvatar, syncOwnAvatar } from "./avatar";

const PICTURE = "data:image/jpeg;base64,AAA";

beforeEach(() => {
  localStorage.clear();
  setAvatar.mockReset().mockResolvedValue({ ok: true });
  getAvatars.mockReset();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("profile picture on a new device", () => {
  it("takes the server copy instead of erasing it", async () => {
    getAvatars.mockResolvedValue({ u1: PICTURE });
    await adoptOwnAvatarFromServer();
    expect(getOwnAvatar()).toBe(PICTURE);
    expect(setAvatar).not.toHaveBeenCalled();
    await syncOwnAvatar();
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it("keeps a picture the player deliberately removed", async () => {
    getAvatars.mockResolvedValue({ u1: null });
    await setOwnAvatar(PICTURE);
    setAvatar.mockClear();
    await setOwnAvatar(null);
    expect(setAvatar).toHaveBeenCalledTimes(1);
    expect(setAvatar).toHaveBeenCalledWith({ data: { image: null } });
    await syncOwnAvatar();
    expect(setAvatar).toHaveBeenCalledTimes(1);
    await adoptOwnAvatarFromServer();
    expect(getOwnAvatar()).toBeNull();
  });

  it("stays quiet when the server cannot be reached", async () => {
    getAvatars.mockRejectedValue(new Error("offline"));
    await adoptOwnAvatarFromServer();
    expect(getOwnAvatar()).toBeNull();
    expect(setAvatar).not.toHaveBeenCalled();
  });
});
