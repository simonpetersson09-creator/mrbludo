import { Capacitor } from "@capacitor/core";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase as managedClient } from "@/integrations/supabase/client";
import { nativeSessionStorage } from "@/lib/native/secure-storage";

let nativeClient: ReturnType<typeof createClient<Database>> | undefined;
function client() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return managedClient;
  if (!nativeClient) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Player service is unavailable");
    nativeClient = createClient<Database>(url, key, {
      auth: { storage: nativeSessionStorage, storageKey: "mrb-ludo:v1:native-session", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
  }
  return nativeClient;
}

/** Web retains managed preview auth; native uses the app's Keychain/Keystore session. */
export const supabase = new Proxy({} as typeof managedClient, {
  get(_target, prop) { const instance = client(); return Reflect.get(instance, prop, instance); },
});