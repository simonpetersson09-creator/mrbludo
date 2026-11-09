import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/auth/client";
import { listFriends, respondFriend } from "@/lib/online/online.functions";
import { RESUME_EVENT } from "@/lib/native/runtime";
import { errorMessage, t as translate } from "@/lib/i18n";
import { AppNotices } from "@/components/AppNotices";

const SEEN_KEY = "mrb-ludo:v1:seen-friend-requests";
const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); } catch { return []; } };
const writeSeen = (ids: string[]) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-100))); } catch { /* full */ } };

/**
 * App-wide, for a signed-in player: shows new friend requests as an in-app notice (Yatzy)
 * (visit reporting for the admin panel lives in src/lib/online/activity.ts).
 */
export function AppPresence({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let busy = false;
    const check = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const { friends } = await listFriends();
        const seen = readSeen();
        const fresh = friends.filter((f) => f.status === "pending" && f.incoming && !seen.includes(f.id));
        if (!fresh.length) return;
        writeSeen([...seen, ...fresh.map((f) => f.id)]);
        if (window.location.pathname === "/friends") return; // the list itself already shows them
        for (const f of fresh.slice(0, 3)) {
          toast(translate("friendRequestToast", { name: f.user.display_name }), {
            duration: 12_000,
            action: { label: translate("accept"), onClick: () => { respondFriend({ data: { id: f.id, accept: true } }).then(() => toast.success(translate("nowFriends"))).catch((e) => toast.error(errorMessage(e, translate))); } },
            cancel: { label: translate("decline"), onClick: () => { respondFriend({ data: { id: f.id, accept: false } }).catch(() => {}); } },
          });
        }
      } catch { /* offline: next change or resume tries again */ } finally { busy = false; }
    };
    const start = () => {
      if (channel || stopped) return;
      void check();
      channel = supabase.channel(`friend-notice-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendships" }, () => { void check(); }).subscribe();
    };
    void supabase.auth.getSession().then(({ data }) => { if (data.session) start(); });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") start(); });
    const onResume = () => { void check(); };
    window.addEventListener(RESUME_EVENT, onResume);

    return () => {
      stopped = true;
      if (channel) supabase.removeChannel(channel);
      sub.subscription.unsubscribe();
      window.removeEventListener(RESUME_EVENT, onResume);
    };
  }, [enabled]);
  return <AppNotices enabled={enabled} />;
}
