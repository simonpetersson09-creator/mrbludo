import { describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("capacitor-secure-storage-plugin", () => ({
  SecureStoragePlugin: {
    keys: async () => ({ value: [...store.keys()] }),
    get: async ({ key }: { key: string }) => ({ value: store.get(key)! }),
    set: async ({ key, value }: { key: string; value: string }) => { store.set(key, value); return { value: true }; },
    remove: async ({ key }: { key: string }) => { store.delete(key); return { value: true }; },
  },
}));

import { nativeSessionStorage } from "./secure-storage";

describe("native player identity storage", () => {
  it("survives clearing the WebView cache and storage", async () => {
    await nativeSessionStorage.setItem("sb-session", "token-123");
    localStorage.clear();
    sessionStorage.clear();
    expect(await nativeSessionStorage.getItem("sb-session")).toBe("token-123");
    expect(localStorage.getItem("sb-session")).toBeNull();
  });
});
