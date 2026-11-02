import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Lock, Trophy, User, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/auth/client";
import { createMatch, getMe, joinByCode, listFriends, quickMatch, respondInvite } from "@/lib/online/online.functions";
import { loadProfileSnapshot, saveProfileSnapshot, lastOnlineMatch } from "@/lib/online/snapshot";
import { flag } from "@/lib/online/profile-options";
import { useOwnAvatar } from "@/lib/ludo/avatar";
import { PlayerAvatar } from "@/components/ludo/PlayerAvatar";
import { errorMessage, useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/online/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Online – Mr. B Ludo" },
      { name: "description", content: "Snabbmatch, privata matcher med kod och inbjudningar från vänner." },
      { property: "og:title", content: "Online – Mr. B Ludo" },
      { property: "og:description", content: "Spela Ludo online mot 1–3 andra spelare." },
    ],
  }),
  component: OnlineLobby,
});

type Me = Awaited<ReturnType<typeof getMe>>;
type Inv = Awaited<ReturnType<typeof listFriends>>["invites"];

function OnlineLobby() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [me, setMe] = useState<Me | null>(null);
  const [invites, setInvites] = useState<Inv>([]);
  const [size, setSize] = useState(2);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const own = useOwnAvatar();

  useEffect(() => {
    setMe(loadProfileSnapshot()); setResumeId(lastOnlineMatch());
    getMe().then(m => { setMe(m); saveProfileSnapshot(m); }).catch(() => {});
    const load = () => listFriends().then((r) => setInvites(r.invites)).catch(() => {});
    load();
    const ch = supabase.channel(`invites-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_invites" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const run = async (fn: () => Promise<{ id: string } | { matchId: string | null }>) => {
    setBusy(true);
    try {
      const r = await fn();
      const id = "id" in r ? r.id : r.matchId;
      if (id) navigate({ to: "/online/$matchId", params: { matchId: id } });
    } catch (e) { toast.error(errorMessage(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h1 className="brand-title min-w-0 text-3xl">{t("onlineTitle")}</h1>
          {me?.profile && <Link to="/profile" className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-sm"><PlayerAvatar emoji={me.profile.avatar} image={own} className="h-6 w-6 text-sm" /><span className="max-w-[110px] truncate font-semibold">{me.profile.display_name}</span><span>{flag(me.profile.country)}</span></Link>}
        </div>

        {invites.length > 0 && (
          <div className="mt-3 flex flex-col gap-[7px]">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-[10px] border border-gold bg-card px-3 py-2 text-sm">
                <span className="flex-1"><b>{i.from?.display_name ?? t("friends")}</b> {t("inviteFrom", { name: "" }).trim()}</span>
                <button className="rounded-md bg-secondary px-2 py-1 text-xs" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: false } }))}>{t("decline")}</button>
                <button className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-background" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: true } }))}>{t("join")}</button>
              </div>
            ))}
          </div>
        )}

        {resumeId && <Link to="/online/$matchId" params={{ matchId: resumeId }} className="home-action home-action-success mt-3">{t("resumeMatch")}</Link>}
        <p className="mb-2 mt-4 text-sm text-muted-foreground">{t("playerCount")}</p>
        <div className="grid grid-cols-3 gap-[7px]">
          {[2, 3, 4].map((n) => (
            <button key={n} className={`home-action ${n === size ? "home-action-gold" : "home-action-ghost"}`} onClick={() => setSize(n)}>{n}</button>
          ))}
        </div>
        <button className="home-action home-action-success mt-3" disabled={busy} onClick={() => run(() => quickMatch({ data: { maxPlayers: size } }))}><Zap size={16} /> {t("quickMatch")}</button>
        <button className="home-action" disabled={busy} onClick={() => run(() => createMatch({ data: { isPrivate: true, maxPlayers: size } }))}><Lock size={16} /> {t("createPrivate")}</button>

        <form className="mt-3 flex gap-[7px]" onSubmit={(e) => { e.preventDefault(); run(() => joinByCode({ data: { code } })); }}>
          <input aria-label={t("matchCode")} placeholder={t("matchCode")} maxLength={8} className="h-11 min-w-0 flex-1 rounded-[10px] border bg-card px-3 text-sm font-semibold uppercase tracking-widest outline-none focus:border-gold" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button type="submit" className="home-action w-28" disabled={busy || code.length < 4}>{t("join")}</button>
        </form>

        <div className="mt-4 grid grid-cols-3 gap-[7px]">
          <Link to="/friends" className="home-action home-action-ghost"><Users size={16} /> {t("friends")}</Link>
          <Link to="/leaderboard" className="home-action home-action-ghost"><Trophy size={16} /> {t("leaderboard")}</Link>
          <Link to="/profile" className="home-action home-action-ghost"><User size={16} /> {t("profile")}</Link>
        </div>
        {me?.isAdmin && <Link to="/admin" className="home-action home-action-ghost mt-[7px]"><Crown size={16} /> {t("admin")}</Link>}
      </div>
    </main>
  );
}
