import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";
import { getMe, updateProfile } from "@/lib/online/online.functions";
import { AVATARS, COUNTRIES, flag } from "@/lib/online/profile-options";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profil – Mr. B Ludo" },
      { name: "description", content: "Ditt spelarnamn, avatar, land och onlinestatistik." },
      { property: "og:title", content: "Profil – Mr. B Ludo" },
      { property: "og:description", content: "Ditt spelarnamn, avatar, land och onlinestatistik." },
    ],
  }),
  component: ProfilePage,
});

type Me = Awaited<ReturnType<typeof getMe>>;

function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🎲");
  const [country, setCountry] = useState("SE");
  useEffect(() => {
    getMe().then((m) => { setMe(m); if (m.profile) { setName(m.profile.display_name); setAvatar(m.profile.avatar); setCountry(m.profile.country); } });
  }, []);
  const save = async () => {
    try { await updateProfile({ data: { display_name: name, avatar, country } }); toast.success("Profilen sparad"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Kunde inte spara"); }
  };
  const s = me?.stats;
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/online" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title mb-3 text-3xl">Profil</h1>
        {!me ? <p className="text-sm text-muted-foreground">Laddar…</p> : (<>
          <label className="text-xs text-muted-foreground" htmlFor="pname">Spelarnamn</label>
          <input id="pname" maxLength={20} className="h-11 rounded-[10px] border bg-card px-3 text-sm outline-none focus:border-gold" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="mt-3 text-xs text-muted-foreground">Avatar</p>
          <div className="grid grid-cols-6 gap-[7px]">
            {AVATARS.map((a) => <button key={a} aria-label={`Avatar ${a}`} onClick={() => setAvatar(a)} className={`h-11 rounded-[10px] border text-xl ${a === avatar ? "border-gold bg-card" : "bg-surface"}`}>{a}</button>)}
          </div>
          <label className="mt-3 text-xs text-muted-foreground" htmlFor="country">Land</label>
          <select id="country" className="h-11 rounded-[10px] border bg-card px-3 text-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}
          </select>
          <button className="home-action home-action-gold mt-3" onClick={save}>Spara</button>
          <button className="mt-3 flex items-center justify-center gap-1 rounded-[10px] bg-surface py-2 text-sm" onClick={() => { navigator.clipboard?.writeText(me.profile?.friend_code ?? ""); toast.success("Vänkod kopierad"); }}>
            Din vänkod: <b className="tracking-widest">{me.profile?.friend_code}</b> <Copy size={14} />
          </button>
          <h2 className="mt-5 font-display text-lg font-bold">Onlinestatistik</h2>
          <div className="mt-2 grid grid-cols-3 gap-[7px] text-center">
            {[["Matcher", s?.played ?? 0], ["Vinster", s?.wins ?? 0], ["Vinst %", s?.played ? Math.round((s.wins / s.played) * 100) : 0], ["Utslagna", s?.captures ?? 0], ["I mål", s?.pieces_home ?? 0], ["Gav upp", s?.forfeits ?? 0]].map(([l, v]) => (
              <div key={l} className="rounded-[10px] bg-surface py-2"><p className="text-lg font-bold text-gold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
            ))}
          </div>
        </>)}
      </div>
    </main>
  );
}
