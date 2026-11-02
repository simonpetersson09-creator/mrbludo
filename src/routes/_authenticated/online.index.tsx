import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Crown, KeyRound, Loader2, ScanLine, Send, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/auth/client";
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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const autoJoined = useRef(false);

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
      <div className="mx-auto w-full max-w-sm space-y-6 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label={t("back")} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 transition active:scale-95">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <h1 className="font-display text-2xl font-bold">{t("playOnline")}</h1>
        </div>

        {invites.length > 0 && (
          <div className="flex flex-col gap-[7px]">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-[10px] border border-gold bg-card px-3 py-2 text-sm">
                <span className="flex-1"><b>{i.from?.display_name ?? t("friends")}</b> {t("inviteFrom", { name: "" }).trim()}</span>
                <button className="rounded-md bg-secondary px-2 py-1 text-xs" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: false } }))}>{t("decline")}</button>
                <button className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-background" onClick={() => run(() => respondInvite({ data: { id: i.id, accept: true } }))}>{t("join")}</button>
              </div>
            ))}
          </div>
        )}

        {resumeId && <Link to="/online/$matchId" params={{ matchId: resumeId }} className="home-action home-action-success">{t("resumeMatch")}</Link>}

        <div className="space-y-4">
          {/* Same two cards as Yatzy's "Spela med vän": create and get a code, or join with a code/QR. */}
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20"><Send className="h-5 w-5 text-primary" /></div>
              <div className="min-w-0">
                <p className="font-display text-base font-bold">{t("lobbyCreateTitle")}</p>
                <p className="text-xs leading-snug text-muted-foreground">{t("lobbyCreateHint")}</p>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">{t("playerCount")}</p>
              <div className="grid grid-cols-3 gap-[7px]">
                {[2, 3, 4].map((n) => (
                  <button key={n} type="button" aria-pressed={n === size} onClick={() => setSize(n)}
                    className={`min-h-10 rounded-xl font-display text-sm font-bold transition active:scale-95 ${n === size ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{n}</button>
                ))}
              </div>
            </div>
            <button disabled={busy} onClick={() => run(() => createMatch({ data: { isPrivate: true, maxPlayers: size } }))}
              className="w-full rounded-xl bg-primary py-3.5 font-display text-lg font-bold text-primary-foreground shadow-lg transition active:scale-[0.97] disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t("createGame")}
            </button>
            <Link to="/friends" className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-primary active:opacity-70">
              <Users className="h-3.5 w-3.5" /><span>{t("lobbyFriendsLink")}</span><ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3 rounded-2xl border border-gold/30 bg-gold/10 p-4" onSubmit={(e) => { e.preventDefault(); void join(code); }}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20"><KeyRound className="h-5 w-5 text-gold" /></div>
              <div className="min-w-0">
                <p className="font-display text-base font-bold">{t("lobbyJoinTitle")}</p>
                <p className="text-xs leading-snug text-muted-foreground">{t("lobbyJoinHint")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input aria-label={t("matchCode")} value={code} maxLength={6} placeholder="ABC123" autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                className="min-w-0 flex-1 rounded-xl border border-border/50 bg-secondary px-3 py-3 text-center font-display text-xl font-bold uppercase tracking-[0.3em] text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-gold/60 focus:ring-1 focus:ring-gold/40" />
              <button type="button" disabled={busy} onClick={() => setScannerOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-border/50 bg-secondary px-3 py-2 text-foreground transition active:scale-95 disabled:opacity-50">
                <ScanLine className="h-5 w-5 text-gold" />
                <span className="text-[10px] font-semibold text-muted-foreground">{t("lobbyScanShort")}</span>
              </button>
            </div>
            <button type="submit" disabled={busy || code.length !== 6}
              className="w-full rounded-xl bg-gold py-3.5 font-display text-lg font-bold text-background shadow-lg transition active:scale-[0.97] disabled:opacity-50">
              {t("join")}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-[7px]">
          <Link to="/leaderboard" className="home-action home-action-ghost"><Trophy size={16} /> {t("leaderboard")}</Link>
          {me?.isAdmin && <Link to="/admin" className="home-action home-action-ghost"><Crown size={16} /> {t("admin")}</Link>}
        </div>
      </div>
      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={(c) => { setCode(c); void join(c); }} />
    </main>
  );
}
