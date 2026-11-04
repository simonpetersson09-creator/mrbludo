/** Server-only: database-backed push store and the notify entry point used by online actions. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { translateFor, type TranslationKey } from "@/lib/i18n";
import { readApnsCreds, normalizeEnv, type ApnsEnv } from "./apns";
import { deliver, type DeliverResult, type PushStore } from "./deliver";

type Db = SupabaseClient<Database>;
const DEDUPE_KEEP_MS = 3 * 86_400_000;

export function dbStore(db: Db): PushStore {
  return {
    async tokensFor(userId, pref) {
      let q = db.from("push_tokens").select("token, environment, locale").eq("user_id", userId);
      if (pref) q = q.eq(pref, true);
      const { data } = await q.limit(10);
      return (data ?? []).map((d) => ({ token: d.token, environment: normalizeEnv(d.environment), locale: d.locale }));
    },
    async claim(key, userId) {
      const { error } = await db.from("push_sent").insert({ key, user_id: userId });
      if (!error && Math.random() < 0.05) await db.from("push_sent").delete().lt("created_at", new Date(Date.now() - DEDUPE_KEEP_MS).toISOString());
      return !error;
    },
    async remove(token) { await db.from("push_tokens").delete().eq("token", token); },
    async setEnv(token, env) { await db.from("push_tokens").update({ environment: env }).eq("token", token); },
  };
}

export type PushKind = "turn" | "ready" | "invite" | "friend" | "test" | "remind" | "joined" | "gaveup" | "weekly";
const BODY: Record<PushKind, TranslationKey> = {
  turn: "pushTurn", ready: "pushReady", invite: "pushInvite", friend: "pushFriend", test: "pushTest",
  remind: "pushRemind", joined: "pushJoined", gaveup: "pushGaveUp", weekly: "pushWeekly",
};

/** The device switch (Settings) that must be on for each kind; others always go out. */
const PREF: Partial<Record<PushKind, "turns" | "nudges" | "reminders">> = { turn: "turns", remind: "nudges", weekly: "reminders" };

export interface NotifyJob { kind: PushKind; userId: string; key?: string; path: string; name?: string; collapseId?: string }

/** Sends one event to every device of one player. Never throws and never holds a game action longer than ~3 s. */
export async function notify(db: Db, job: NotifyJob, fetchFn: typeof fetch = fetch): Promise<DeliverResult | null> {
  const creds = readApnsCreds(process.env);
  if (!creds) return null;
  const run = deliver(dbStore(db), fetchFn, creds, {
    userId: job.userId, key: job.key, pref: PREF[job.kind],
    message: (locale) => ({ title: "Mr. B Ludo", body: translateFor(locale, BODY[job.kind], { name: job.name ?? "" }), path: job.path, collapseId: job.collapseId }),
  });
  if (job.kind === "test") return run;
  try {
    return await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
  } catch (e) {
    console.error("push failed", job.kind, e instanceof Error ? e.message : "unknown");
    return null;
  }
}

export const defaultEnv = (): ApnsEnv => normalizeEnv(process.env["APNS_ENV"]);
