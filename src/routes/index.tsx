import { randomBotNames } from "@/lib/ludo/bot-names";
import { VariantPicker, useVariant } from "@/components/ludo/VariantPicker";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, Globe, Play, Settings, Users } from "lucide-react";
import { createGame } from "@/lib/ludo/engine";
import { listGames, loadSettings, selectGame, startNewGame } from "@/lib/ludo/storage";
import { LANGUAGES, setLanguage, useTranslation } from "@/lib/i18n";
import { QuickMatchSearch } from "@/components/ludo/QuickMatchSearch";
import { HomeStats } from "@/components/ludo/HomeStats";
import { NotificationsOffRow } from "@/components/NotificationsOffRow";
import mrBDie from "@/assets/mr-b-die.png";
import { startHomeAds } from "@/lib/ads/home-ads";
import { Capacitor } from "@capacitor/core";
import { getRankedGames } from "@/lib/ads/local-stats";
import { trackEvent } from "@/lib/ads/analytics";
import { completeRatePrompt, requestAppReview, shouldShowRatePrompt, snoozeRatePrompt } from "@/lib/rate-app";
import { RateAppPrompt } from "@/components/ludo/RateAppPrompt";
import { claimPrompt, releasePrompt } from "@/lib/home-prompt";

const FIRST_PLAY_KEY = "mrb-ludo:v1:first-play-hint-done";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mr. B Ludo – klassiskt Ludo för mobilen" },
      { name: "description", content: "Spela klassiskt Ludo mot datorn eller vänner. Från skaparna av Mr. B Yatzy." },
      { property: "og:title", content: "Mr. B Ludo" },
      { property: "og:description", content: "Spela klassiskt Ludo mot datorn eller vänner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const [resumes, setResumes] = useState<{ id: string; myTurn: boolean; names: string }[]>([]);
  const [showLangs, setShowLangs] = useState(false);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const langPopRef = useRef<HTMLDivElement>(null);

  useEffect(() => startHomeAds(), []);

  // Yatzy-style rating prompt after 5, then 15 and 35 finished games (app only).
  const [showRate, setShowRate] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !shouldShowRatePrompt(getRankedGames())) return;
    // Only when no other question is on screen; otherwise it waits for the next visit.
    const timer = setTimeout(() => { if (claimPrompt("rate")) setShowRate(true); }, 700);
    return () => { clearTimeout(timer); releasePrompt("rate"); };
  }, []);
  // Yatzy's "start here" hint before the very first finished game.
  const [firstHint, setFirstHint] = useState(false);
  useEffect(() => {
    try { if (getRankedGames() === 0 && !localStorage.getItem(FIRST_PLAY_KEY)) setFirstHint(true); } catch { /* storage off */ }
  }, []);
  const doneFirstHint = () => { if (!firstHint) return; setFirstHint(false); try { localStorage.setItem(FIRST_PLAY_KEY, "1"); } catch { /* storage off */ } };
  const rateNow = () => { setShowRate(false); releasePrompt("rate"); completeRatePrompt(); trackEvent("rate_prompt_accepted"); void requestAppReview(); };
  const rateLater = () => { setShowRate(false); releasePrompt("rate"); snoozeRatePrompt(getRankedGames()); trackEvent("rate_prompt_later"); };

  useEffect(() => {
    setResumes(listGames().map(({ id, game: g }) => {
      const cur = g.players[g.current];
      return { id, myTurn: !!cur && !cur.isBot, names: g.players.filter((p) => p.isBot).map((p) => p.name).join(", ") };
    }));
  }, []);

  // Stäng språklistan när man klickar utanför knappen eller listan.
  useEffect(() => {
    if (!showLangs) return;
    const onDown = (e: Event) => {
      const node = e.target as Node;
      if (!langBtnRef.current?.contains(node) && !langPopRef.current?.contains(node)) setShowLangs(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [showLangs]);

  const toggleLangs = () => setShowLangs((v) => !v);

  const [showQuick, setShowQuick] = useState(false);
  const [variant, setVariant] = useVariant();
  const [search, setSearch] = useState<number | null>(null);

  // Nobody found online → local game with computer opponents (Yatzy fallback).
  const startLocal = (players: number) => {
    const name = loadSettings().name;
    const colors: Record<number, (0 | 1 | 2 | 3)[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
    const colorKey = ["colorRed", "colorGreen", "colorYellow", "colorBlue"] as const;
    const cs = colors[players];
    const botNames = randomBotNames(cs.length);
    startNewGame(createGame(cs.map((c, i) => i === 0
      ? { id: "p0", name, color: c, isBot: false }
      : { id: `p${i}`, name: botNames[i], color: c, isBot: true }), variant));
    navigate({ to: "/play" });
  };

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col items-center overflow-x-hidden px-6 py-3"
      style={{ paddingTop: "calc(12px + env(safe-area-inset-top))", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
     <div className="home-bg" aria-hidden="true"><div className="home-bg-glow" /><div className="home-bg-dice" /></div>
     <div className="home-enter relative z-10 my-auto flex w-full max-w-sm flex-col items-center gap-4 sm:gap-8 after:absolute after:left-0 after:top-[calc(100%+0.5rem)] after:h-40 after:w-px after:content-['']">
      <div className="space-y-1 text-center sm:space-y-2">
        <div className="brand-logo mb-2 inline-flex h-28 w-28 items-center justify-center sm:mb-4 sm:h-36 sm:w-36">
          <img src={mrBDie} alt="" width={383} height={512} className="h-full w-full object-contain" loading="eager" decoding="async" />
        </div>
        <h1 className="brand-wordmark text-4xl sm:text-5xl">Mr B Ludo</h1>
        <p className="brand-tagline">{t("tagline")}</p>
      </div>
      <div className="w-full mt-8 sm:mt-10">
      {resumes.length > 0 && (
        <div className="home-stack relative">
          {resumes.map((resume) => (
          <Link key={resume.id} to="/play" onClick={() => selectGame(resume.id)} className={`home-match-card font-display ${resume.myTurn ? "home-match-card-turn" : "home-match-card-waiting"}`}>
            <span className={`home-card-chip${resume.myTurn ? " home-card-chip-light" : ""}`}><Play /></span>
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
              <span className="truncate text-[11px] font-bold leading-none">{t("resumeMatch")}</span>
              <span className="truncate text-[8px] leading-none opacity-90">{resume.names}</span>
            </span>
            <span className={`home-card-pill${resume.myTurn ? " home-card-pill-action animate-pulse" : ""}`}>
              {resume.myTurn ? t("yourTurnLabel") : t("waitingShort")}
            </span>
          </Link>
          ))}
        </div>
      )}
      </div>
      <div className="w-full">
      <div className="home-stack">
                <div className="relative">
        {firstHint && <div className="home-quick-hint" role="note">{t("firstPlayHint")}</div>}
        <button className={`home-action w-full font-display${firstHint ? " home-quick-glow" : ""}`} aria-expanded={showQuick} onClick={() => { doneFirstHint(); setShowQuick((v) => !v); }}><span aria-hidden="true" className="home-action-icon">🎲</span><span>{t("quickMatchBot")}</span></button>
        </div>
        {showQuick && (
          <div className="space-y-2 overflow-hidden rounded-xl border border-primary/30 bg-card/80 p-2.5">
            <VariantPicker value={variant} onChange={setVariant} compact />
            <div className="h-px bg-border/60" />
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold text-foreground">{t("selectPlayerCount")}</p>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" onClick={() => setSearch(n + 1)}
                    className="min-h-9 flex-1 rounded-lg border border-gold/40 bg-gold/10 px-1 py-1.5 text-center font-display text-[11px] font-bold leading-tight text-foreground transition-all active:scale-95 active:bg-gold/25">
                    {n} {n === 1 ? t("opponent") : t("opponents")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <Link to="/online" className="home-action font-display"><span aria-hidden="true" className="home-action-icon">🌐</span><span>{t("playOnline")}</span></Link>
        <Link to="/stats" className="home-action font-display"><BarChart3 size={16} /><span>{t("stats")}</span></Link>
      </div>
      <div className="home-round-row relative z-20">
        <div className="home-round-item relative">
          <button ref={langBtnRef} type="button" className="home-round-action" aria-label={t("languageLabel")} aria-expanded={showLangs} onClick={toggleLangs}>
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="home-round-label">{t("languageLabel")}</span>
          {showLangs && (
            <div
              ref={langPopRef}
              role="menu"
              className="absolute top-full left-0 z-50 mt-2 max-h-48 w-44 overflow-y-auto rounded-2xl border border-border/60 bg-popover py-1.5 shadow-lg [&::-webkit-scrollbar]:hidden"
              style={{ overscrollBehaviorY: "contain", scrollbarWidth: "none" }}
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="menuitem"
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${l.code === lang ? "bg-primary/15 font-semibold text-primary" : "text-popover-foreground hover:bg-secondary/60"}`}
                  onClick={() => { setLanguage(l.code); setShowLangs(false); }}
                >
                  <span className="text-base" aria-hidden="true">{l.flag}</span>
                  <span className="min-w-0 flex-1 truncate text-left">{l.label}</span>
                  {l.code === lang && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link to="/settings" className="home-round-item">
          <span className="home-round-action"><Settings className="h-4 w-4 sm:h-5 sm:w-5" /></span>
          <span className="home-round-label">{t("settings")}</span>
        </Link>
        <Link to="/friends" className="home-round-item">
          <span className="home-round-action"><Users className="h-4 w-4 sm:h-5 sm:w-5" /></span>
          <span className="home-round-label">{t("friends")}</span>
        </Link>
      </div>
      </div>
      <NotificationsOffRow className="mx-auto mt-3 max-w-md" />
      <HomeStats />
     </div>
      {search && (
        <QuickMatchSearch
          players={search}
          variant={variant}
          onCancel={() => setSearch(null)}
          onNoMatch={() => { const n = search; setSearch(null); startLocal(n); }}
          onMatch={(id) => { setSearch(null); navigate({ to: "/online/$matchId", params: { matchId: id } }); }}
        />
      )}
      {showRate && !search && <RateAppPrompt onRate={rateNow} onLater={rateLater} />}
    </main>
  );
}
