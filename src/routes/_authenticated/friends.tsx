import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/auth/client";
import { createMatch, inviteFriend, listFriends, respondFriend, sendFriendRequest } from "@/lib/online/online.functions";
import { flag } from "@/lib/online/profile-options";
import { useAvatarImages } from "@/lib/ludo/avatar";
import { PlayerAvatar } from "@/components/ludo/PlayerAvatar";
import { errorMessage, useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Vänner – Mr. B Ludo" },
      { name: "description", content: "Lägg till vänner med vänkod och bjud in dem till privata matcher." },
      { property: "og:title", content: "Vänner – Mr. B Ludo" },
      { property: "og:description", content: "Lägg till vänner och spela privata matcher." },
    ],
  }),
  component: FriendsPage,
});

type Data = Awaited<ReturnType<typeof listFriends>>;

function FriendsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [code, setCode] = useState("");
  const load = useCallback(() => listFriends().then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const ch = supabase.channel(`friends-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const act = async (p: Promise<unknown>, ok?: string) => {
    try { await p; if (ok) toast.success(ok); load(); } catch (e) { toast.error(errorMessage(e, t)); }
  };
  const friends = data?.friends ?? [];
  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const outgoing = friends.filter((f) => f.status === "pending" && !f.incoming);
  const accepted = friends.filter((f) => f.status === "accepted");
  const pics = useAvatarImages(friends.map((f) => f.user.id));
  const online = (ls: string | null) => !!ls && Date.now() - new Date(ls).getTime() < 5 * 60_000;

  const [inviting, setInviting] = useState<string | null>(null);
  const invite = async (userId: string) => {
    setInviting(userId);
    try {
      const m = await createMatch({ data: { isPrivate: true, maxPlayers: 2 } });
      await inviteFriend({ data: { matchId: m.id, userId } });
      toast.success(t("inviteSent"));
      navigate({ to: "/online/$matchId", params: { matchId: m.id } });
    } catch (e) { toast.error(errorMessage(e, t)); } finally { setInviting(null); }
  };

  return (
    <main className="app-screen flex flex-col overflow-y-auto overscroll-contain px-5">
      <div className="mx-auto w-full max-w-md space-y-3 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label={t("back")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 transition active:scale-95">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <h1 className="font-display text-lg font-black text-foreground">{t("friendsTitle")}</h1>
        </div>
        <p className="-mt-1 px-4 text-center text-[10px] text-muted-foreground">{t("friendCodeHint")}</p>

        <form className="flex gap-[7px]" onSubmit={(e) => { e.preventDefault(); act(sendFriendRequest({ data: { friendCode: code } }), t("requestSent")); setCode(""); }}>
          <input aria-label={t("friendCode")} placeholder={t("friendCode")} maxLength={8} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card/80 px-3 text-sm font-semibold uppercase tracking-widest outline-none focus:border-primary" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="home-action w-28" type="submit" disabled={code.length < 4}>{t("addFriend")}</button>
        </form>

        {(incoming.length > 0 || outgoing.length > 0) && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("requests")}</h2>
            {incoming.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-3 py-2">
                <UserPlus className="h-4 w-4 shrink-0 text-primary" />
                <PlayerAvatar emoji={f.user.avatar} image={pics[f.user.id]} className="h-7 w-7 border border-border/60 bg-secondary text-sm" />
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">{f.user.display_name} {flag(f.user.country)}</p>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => act(respondFriend({ data: { id: f.id, accept: false } }))} className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground active:scale-95">{t("decline")}</button>
                  <button onClick={() => act(respondFriend({ data: { id: f.id, accept: true } }), t("nowFriends"))} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground active:scale-95">{t("accept")}</button>
                </div>
              </div>
            ))}
            {outgoing.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-3 py-2 opacity-80">
                <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">{f.user.display_name} · {t("sent")}</p>
                <button onClick={() => act(respondFriend({ data: { id: f.id, accept: false } }))} className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground active:scale-95">{t("undo")}</button>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("friendList", { n: accepted.length })}</h2>
        {data === null ? (
          <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : accepted.length === 0 ? (
          <div className="space-y-3 py-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border/50 bg-secondary/60"><Users className="h-6 w-6 text-muted-foreground" /></div>
            <p className="px-4 text-sm text-muted-foreground">{t("noFriends")}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {accepted.map((f) => (
              <div key={f.id} className="flex w-full items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/60 px-2.5 py-2">
                <PlayerAvatar emoji={f.user.avatar} image={pics[f.user.id]} className="h-9 w-9 border border-border/60 bg-secondary text-base" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-foreground">{f.user.display_name} {flag(f.user.country)}</p>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${online(f.user.last_seen) ? "bg-success" : "bg-muted"}`} />
                    <button className="underline-offset-2 hover:underline" onClick={() => act(respondFriend({ data: { id: f.id, accept: false } }))}>{t("remove")}</button>
                  </p>
                </div>
                <button onClick={() => invite(f.user.id)} disabled={!!inviting} aria-label={t("invite")} className="flex h-9 w-[4.25rem] shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary transition active:bg-primary/25 disabled:opacity-60">
                  {inviting === f.user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-center text-[11px] font-bold leading-tight">{t("invite")}</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
