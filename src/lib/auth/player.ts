import { supabase } from "./client";
import { sessionInitializer } from "./session-policy";

export const ensurePlayerSession = sessionInitializer(
  async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
  async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.session) throw new Error("Player identity unavailable");
    return data.session;
  },
);