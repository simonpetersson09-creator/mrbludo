import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Lock, LogOut, Trophy, User, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createMatch, getMe, joinByCode, listFriends, quickMatch, respondInvite } from "@/lib/online/online.functions";
import { flag } from "@/lib/online/profile-options";

export const Route = createFileRoute("/_authenticated/online/")({
  head: () => ({
    meta: [
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
  const qc = useQueryClient();
  const [me, setMe] = useState<Me | null>(null);
  const [invites, setInvites] = useState<Inv>([]);
  const [size, setSize] = useState(2);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
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
    } catch (e) { toast.error(e instanceof Error ? e.message : "Något gick fel"); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <div className="flex items-center gap-2">
          <h1 className="brand-title flex-1 text-3xl">Online</h1>
          {me?.profile && <Link to="/profile" className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-sm"><span>{me.profile.avatar}</span><span className="max-w-[110px] truncate font-semibold">{me.profile.display_name}</span><span>{flag(me.profile.country)}</span></Link>}
        </div>

        {invites.length > 0 && (
          <div className="mt-3 flex flex-col gap-[7px]">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-[10px] border border-gold bg-card px-3 py-2 text-sm">
                <span className="flex-1"><b>{i.from?.display_name ?? "En vän"}</b> bjuder in dig</span>
                <button className="rounded-md bg-secondary px-2 py-1 text-xs" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: false } }))}>Nej</button>
                <button className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-background" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: true } }))}>Gå med</button>
              </div>
            ))}
          </div>
        )}

        <p className="mb-2 mt-4 text-sm text-muted-foreground">Antal spelare</p>
        <div className="grid grid-cols-3 gap-[7px]">
          {[2, 3, 4].map((n) => (
            <button key={n} className={`home-action ${n === size ? "home-action-gold" : "home-action-ghost"}`} onClick={() => setSize(n)}>{n}</button>
          ))}
        </div>
        <button className="home-action home-action-success mt-3" disabled={busy} onClick={() => run(() => quickMatch({ data: { maxPlayers: size } }))}><Zap size={16} /> Snabbmatch</button>
        <button className="home-action" disabled={busy} onClick={() => run(() => createMatch({ data: { isPrivate: true, maxPlayers: size } }))}><Lock size={16} /> Skapa privat match</button>

        <form className="mt-3 flex gap-[7px]" onSubmit={(e) => { e.preventDefault(); run(() => joinByCode({ data: { code } })); }}>
          <input aria-label="Matchkod" placeholder="Matchkod" maxLength={8} className="h-11 min-w-0 flex-1 rounded-[10px] border bg-card px-3 text-sm font-semibold uppercase tracking-widest outline-none focus:border-gold" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button type="submit" className="home-action w-28" disabled={busy || code.length < 4}>Gå med</button>
        </form>

        <div className="mt-4 grid grid-cols-3 gap-[7px]">
          <Link to="/friends" className="home-action home-action-ghost"><Users size={16} /> Vänner</Link>
          <Link to="/leaderboard" className="home-action home-action-ghost"><Trophy size={16} /> Topplista</Link>
          <Link to="/profile" className="home-action home-action-ghost"><User size={16} /> Profil</Link>
        </div>
        {me?.isAdmin && <Link to="/admin" className="home-action home-action-ghost mt-[7px]"><Crown size={16} /> Admin</Link>}
        <button className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground" onClick={signOut}><LogOut size={14} /> Logga ut</button>
      </div>
    </main>
  );
}
