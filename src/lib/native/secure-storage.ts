import type { SupportedStorage } from "@supabase/supabase-js";

/** Native-only: no plaintext or web fallback if the encrypted store fails. */
export const nativeSessionStorage: SupportedStorage = {
  async getItem(key) {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    const { value: keys } = await SecureStoragePlugin.keys();
    if (!keys.includes(key)) return null;
    return (await SecureStoragePlugin.get({ key })).value;
  },
  async setItem(key, value) {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    const result = await SecureStoragePlugin.set({ key, value });
    if (!result.value) throw new Error("Secure session storage failed");
  },
  async removeItem(key) {
    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
    await SecureStoragePlugin.remove({ key });
  },
};