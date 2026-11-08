import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), getMe: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/player", () => ({ ensurePlayerSession: mocks.session }));
vi.mock("@/lib/online/online.functions", () => ({ getMe: mocks.getMe, updateProfile: mocks.update }));
import { loadSettings, saveSettings } from "./storage";
import { rememberProfileName, syncProfileName } from "./profile-name";

beforeEach(() => {
  localStorage.clear();
  mocks.session.mockReset().mockResolvedValue({ user: { id: "same-player" } });
  mocks.getMe.mockReset().mockResolvedValue({ userId: "same-player", profile: { display_name: "Spelare 7131", avatar: "🙂", country: "SE" }, stats: null, isAdmin: false });
  mocks.update.mockReset().mockResolvedValue({ ok: true });
});

it("links Simon p to the existing player and preserves avatar/country", async () => {
  saveSettings({ ...loadSettings(), name: "Simon p" });
  expect(await syncProfileName()).toBe(true);
  expect(mocks.update).toHaveBeenCalledWith({ data: { display_name: "Simon p", avatar: "🙂", country: "SE" } });
  await syncProfileName();
  expect(mocks.update).toHaveBeenCalledTimes(1);
});
it("keeps the edited name offline and retries on reconnect", async () => {
  saveSettings({ ...loadSettings(), name: "Simon p" });
  mocks.update.mockRejectedValueOnce(new Error("offline"));
  expect(await syncProfileName()).toBe(false);
  expect(loadSettings().name).toBe("Simon p");
  expect(await syncProfileName()).toBe(true);
  expect(mocks.update).toHaveBeenCalledTimes(2);
});
it("adopts the numbered server name rather than uploading Spelare", async () => {
  expect(await syncProfileName()).toBe(true);
  expect(loadSettings().name).toBe("Spelare 7131");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("keeps online profile edits in local settings without uploading an old name", async () => {
  rememberProfileName("same-player", "Simon p");
  expect(loadSettings().name).toBe("Simon p");
  await syncProfileName();
  expect(mocks.update).not.toHaveBeenCalled();
});