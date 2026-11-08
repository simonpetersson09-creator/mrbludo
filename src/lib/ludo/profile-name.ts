import { ensurePlayerSession } from "@/lib/auth/player";
import { getMe, updateProfile } from "@/lib/online/online.functions";
import { saveProfileSnapshot } from "@/lib/online/snapshot";
import { loadSettings, saveSettings } from "./storage";

const KEY = "mrb-ludo:v1:profile-name-synced";
let running: Promise<boolean> | null = null;

/** A successful online profile edit also updates the name used for local play. */
export function rememberProfileName(userId: string, name: string): void {
  saveSettings({ ...loadSettings(), name });
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, name }));
    localStorage.removeItem("mrb-ludo:v1:cache:stats-boards");
  } catch { /* optional display cache */ }
}

/** Keep the same player identity, preserve avatar/country, and retry offline edits later. */
export function syncProfileName(): Promise<boolean> {
  if (running) return running;
  running = sync().catch(() => false).finally(() => { running = null; });
  return running;
}

async function sync(): Promise<boolean> {
  const name = loadSettings().name.trim().slice(0, 20);
  // Do not replace a server-assigned unique name with the local default.
  if (name.length < 2) return false;
  const session = await ensurePlayerSession();
  let previous: { userId: string; name: string } | null = null;
  try { previous = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { /* retry */ }
  if (previous?.userId === session.user.id && previous.name === name) return true;
  const me = await getMe();
  if (!me.profile) return false;
  if (name === "Spelare" && !previous) {
    rememberProfileName(me.userId, me.profile.display_name);
    saveProfileSnapshot(me);
    return true;
  }
  // A fetch must never overwrite an edit made while that fetch was in flight.
  if (loadSettings().name.trim().slice(0, 20) !== name) return false;
  await updateProfile({ data: { display_name: name, avatar: me.profile.avatar, country: me.profile.country } });
  if (loadSettings().name.trim().slice(0, 20) !== name) return false;
  rememberProfileName(me.userId, name);
  saveProfileSnapshot({ ...me, profile: { ...me.profile, display_name: name } });
  return true;
}