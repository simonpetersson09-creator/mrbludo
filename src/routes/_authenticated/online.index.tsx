import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Crown, KeyRound, Loader2, ScanLine, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/auth/client";
import { VariantPicker, useVariant } from "@/components/ludo/VariantPicker";
import { createMatch, getMe, joinByCode, listFriends, respondInvite } from "@/lib/online/online.functions";
import { loadProfileSnapshot, saveProfileSnapshot, lastOnlineMatch } from "@/lib/online/snapshot";
import { parseMatchCode } from "@/lib/online/match-code";
import { QRScanner } from "@/components/ludo/QRScanner";
import { errorMessage, useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/online/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Spela med vän – Mr. B Ludo" },
      { name: "description", content: "Skapa en match och dela koden, eller gå med med kod eller QR-kod." },
      { property: "og:title", content: "Spela med vän – Mr. B Ludo" },
      { property: "og:description", content: "Spela Ludo med vänner via kod eller QR-kod." },
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
  const [variant, setVariant] = useVariant();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const autoJoined = useRef(false);

  // Online play is where notifications matter: ask for permission here, never at launch.
  useEffect(() => { void import("@/lib/native/push").then((m) => m.askPushPermission()); }, []);
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
  const join = (c: string) => run(() => joinByCode({ data: { code: c } }));

  // Arriving with ?code=XXXXXX (as in Yatzy) joins that match directly.
  useEffect(() => {
    if (autoJoined.current) return;
    const c = parseMatchCode(new URLSearchParams(window.location.search).get("code") ?? "");
    if (!c) return;
    autoJoined.current = true;
    setCode(c);
    void join(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="app-screen flex flex-col overflow-y-auto overscroll-contain px-5">
      <div className="mx-auto w-full max-w-sm space-y-2.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Link to="/" aria-label={t("back")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 transition active:scale-95">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <h1 className="font-display text-xl font-bold">{t("playOnline")}</h1>
        </div>

        {invites.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-[10px] border border-gold bg-card px-2.5 py-1.5 text-xs">
                <span className="flex-1"><b>{i.from?.display_name ?? t("friends")}</b> {t("inviteFrom", { name: "" }).trim()}</span>
                <button className="rounded-md bg-secondary px-2 py-1 text-[11px]" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: false } }))}>{t("decline")}</button>
                <button className="rounded-md bg-gold px-2 py-1 text-[11px] font-bold text-background" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: true } }))}>{t("join")}</button>
              </div>
            ))}
          </div>
        )}

        {resumeId && <Link to="/online/$matchId" params={{ matchId: resumeId }} className="home-action home-action-success">{t("resumeMatch")}</Link>}

        <div className="space-y-1.5">
          {/* Same two cards as Yatzy's "Spela med vän": create and get a code, or join with a code/QR. */}
          <div className="space-y-1.5 rounded-2xl border border-primary/30 bg-primary/10 p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20"><Send className="h-3.5 w-3.5 text-primary" /></div>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold leading-tight">{t("lobbyCreateTitle")}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{t("lobbyCreateHint")}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold text-foreground">{t("playerCount")}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[2, 3, 4].map((n) => (
                  <button key={n} type="button" aria-pressed={n === size} onClick={() => setSize(n)}
                    className={`min-h-9 rounded-lg font-display text-xs font-bold transition active:scale-95 ${n === size ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{n}</button>
                ))}
              </div>
            </div>
            <VariantPicker value={variant} onChange={setVariant} compact />
            <button disabled={busy} onClick={() => run(() => createMatch({ data: { isPrivate: true, maxPlayers: size, variant } }))}
              className="min-h-11 w-full rounded-xl bg-primary px-3 font-display text-sm font-bold text-primary-foreground shadow-lg transition active:scale-[0.97] disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("createGame")}
            </button>
            <Link to="/friends" className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-primary active:opacity-70">
              <Users className="h-3 w-3" /><span>{t("lobbyFriendsLink")}</span><ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex items-center gap-2.5 py-0.5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-1.5 rounded-2xl border border-gold/30 bg-gold/10 p-2.5" onSubmit={(e) => { e.preventDefault(); void join(code); }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/20"><KeyRound className="h-3.5 w-3.5 text-gold" /></div>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold leading-tight">{t("lobbyJoinTitle")}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{t("lobbyJoinHint")}</p>
              </div>
            </div>
            <div>
              <label htmlFor="join-code" className="mb-1 block text-[11px] font-semibold text-foreground">{t("matchCode")}</label>
              <div className="flex gap-1.5">
                <input id="join-code" aria-label={t("matchCode")} value={code} maxLength={6} placeholder="ABC123" autoCapitalize="characters"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="min-w-0 flex-1 rounded-xl border-2 border-gold/50 bg-background px-3 py-2.5 text-center font-display text-lg font-bold uppercase tracking-[0.3em] text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-gold focus:ring-2 focus:ring-gold/40" />
                <button type="button" disabled={busy} onClick={() => setScannerOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-gold/50 bg-background px-3 py-2 text-foreground transition active:scale-95 disabled:opacity-50">
                  <ScanLine className="h-5 w-5 text-gold" />
                  <span className="text-[10px] font-semibold text-muted-foreground">{t("lobbyScanShort")}</span>
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy || code.length !== 6}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gold px-3 font-display text-sm font-bold text-background shadow-lg transition active:scale-[0.97] disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("join")}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {me?.isAdmin && <Link to="/admin" className="home-action home-action-ghost"><Crown size={16} /> {t("admin")}</Link>}
        </div>
      </div>
      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={(c) => { setCode(c); void join(c); }} />
    </main>
  );
}
