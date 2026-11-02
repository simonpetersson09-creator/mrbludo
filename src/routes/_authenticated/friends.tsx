import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listFriends, respondFriend, sendFriendRequest } from "@/lib/online/online.functions";
import { flag } from "@/lib/online/profile-options";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({
    meta: [
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
    try { await p; if (ok) toast.success(ok); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Något gick fel"); }
  };
  const friends = data?.friends ?? [];
  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const outgoing = friends.filter((f) => f.status === "pending" && !f.incoming);
  const accepted = friends.filter((f) => f.status === "accepted");
  const online = (ls: string | null) => !!ls && Date.now() - new Date(ls).getTime() < 5 * 60_000;

  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/online" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title mb-3 text-3xl">Vänner</h1>
        <form className="flex gap-[7px]" onSubmit={(e) => { e.preventDefault(); act(sendFriendRequest({ data: { friendCode: code } }), "Vänförfrågan skickad"); setCode(""); }}>
          <input aria-label="Vänkod" placeholder="Väns kod" maxLength={8} className="h-11 min-w-0 flex-1 rounded-[10px] border bg-card px-3 text-sm font-semibold uppercase tracking-widest outline-none focus:border-gold" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="home-action w-28" type="submit" disabled={code.length < 4}>Lägg till</button>
        </form>
        <p className="mt-1 text-xs text-muted-foreground">Din egen kod finns på din profil. Bjud in vänner från väntrummet i en privat match.</p>

        {incoming.length > 0 && <h2 className="mt-4 text-sm font-semibold">Förfrågningar</h2>}
        {incoming.map((f) => (
          <div key={f.id} className="mt-[7px] flex items-center gap-2 rounded-[10px] border border-gold bg-card px-3 py-2 text-sm">
            <span>{f.user.avatar}</span><span className="flex-1 truncate font-semibold">{f.user.display_name} {flag(f.user.country)}</span>
            <button aria-label="Neka" className="rounded-md bg-secondary p-1.5" onClick={() => act(respondFriend({ data: { id: f.id, accept: false } }))}><X size={14} /></button>
            <button aria-label="Acceptera" className="rounded-md bg-gold p-1.5 text-background" onClick={() => act(respondFriend({ data: { id: f.id, accept: true } }), "Ni är nu vänner")}><Check size={14} /></button>
          </div>
        ))}

        <h2 className="mt-4 text-sm font-semibold">Vänlista ({accepted.length})</h2>
        {accepted.length === 0 && <p className="text-sm text-muted-foreground">Inga vänner ännu.</p>}
        {accepted.map((f) => (
          <div key={f.id} className="mt-[7px] flex items-center gap-2 rounded-[10px] bg-surface px-3 py-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${online(f.user.last_seen) ? "bg-success" : "bg-muted"}`} />
            <span>{f.user.avatar}</span><span className="flex-1 truncate font-semibold">{f.user.display_name} {flag(f.user.country)}</span>
            <button className="text-xs text-muted-foreground" onClick={() => act(respondFriend({ data: { id: f.id, accept: false } }))}>Ta bort</button>
          </div>
        ))}
        {outgoing.length > 0 && <h2 className="mt-4 text-sm font-semibold">Skickade</h2>}
        {outgoing.map((f) => (
          <div key={f.id} className="mt-[7px] flex items-center gap-2 rounded-[10px] bg-surface px-3 py-2 text-sm opacity-70">
            <span>{f.user.avatar}</span><span className="flex-1 truncate">{f.user.display_name}</span>
            <button className="text-xs text-muted-foreground" onClick={() => act(respondFriend({ data: { id: f.id, accept: false } }))}>Ångra</button>
          </div>
        ))}
      </div>
    </main>
  );
}
