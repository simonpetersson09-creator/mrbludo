import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listen: vi.fn(async (_event: string, _handler: unknown) => ({ remove: vi.fn() })) }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.listen } }));
vi.mock("@capacitor/network", () => ({ Network: { addListener: mocks.listen } }));
vi.mock("@capacitor/status-bar", () => ({ StatusBar: { setStyle: vi.fn(async () => {}) }, Style: { Dark: "DARK" } }));
vi.mock("@/lib/auth/client", () => ({ supabase: { auth: { startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() } } }));
afterEach(() => vi.clearAllMocks());
it("leaves Android back exclusively to the confirmation-aware component", async () => {
  const { startNativeRuntime } = await import("./runtime");
  const cleanup = await startNativeRuntime(() => {});
  expect(mocks.listen.mock.calls.map(call => call[0])).toEqual(["appStateChange", "networkStatusChange"]);
  cleanup();
});