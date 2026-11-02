import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, Globe, Play, Settings, Users } from "lucide-react";
import { createGame } from "@/lib/ludo/engine";
import { loadGame, loadSettings, saveGame } from "@/lib/ludo/storage";
import { LANGUAGES, setLanguage, useTranslation } from "@/lib/i18n";
import heroImg from "@/assets/ludo-hero.jpg";

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
  const [hasGame, setHasGame] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const [langDown, setLangDown] = useState(false);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const langPopRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHasGame(!!loadGame()), []);

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

  const toggleLangs = () => {
    if (!showLangs) {
      const rect = langBtnRef.current?.getBoundingClientRect();
      if (rect) setLangDown(rect.top < 280);
    }
    setShowLangs((v) => !v);
  };

  const quick = () => {
    const name = loadSettings().name;
    saveGame(createGame([
      { id: "p0", name, color: 0, isBot: false },
      { id: "p1", name: t("computerColor", { color: t("colorYellow") }), color: 2, isBot: true },
    ]));
    navigate({ to: "/play" });
  };

  return (
    <main className="app-screen flex flex-col items-center">
      <img src={heroImg} alt="" width={720} height={720} className="mt-2 h-40 w-40 rounded-3xl object-cover shadow-2xl" />
      <h1 className="brand-title mt-4 text-4xl">Mr. B Ludo</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("tagline")}</p>
      <div className="home-stack">
        {hasGame && (
          <Link to="/play" className="home-action"><Play size={16} /> {t("resumeMatch")}</Link>
        )}
        <button className="home-action font-display" onClick={quick}><span aria-hidden="true" className="home-action-icon">🎲</span><span>{t("quickMatchBot")}</span></button>
        <Link to="/online" className="home-action font-display"><span aria-hidden="true" className="home-action-icon">🌐</span><span>{t("playOnline")}</span></Link>
      </div>
      <div className="home-round-row">
        <div className="home-round-item" ref={langRef}>
          <button type="button" className="home-round-action" aria-label={t("languageLabel")} aria-expanded={showLangs} onClick={toggleLangs}>
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <span className="home-round-label">{t("languageLabel")}</span>
          {showLangs && (
            <div className={`home-round-pop${langUp ? " home-round-pop-up" : ""}`} role="menu">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="menuitem"
                  className={`home-round-pop-item${l.code === lang ? " home-round-pop-item-active" : ""}`}
                  onClick={() => { setLanguage(l.code); setShowLangs(false); }}
                >
                  <span aria-hidden="true">{l.flag}</span>
                  <span className="min-w-0 flex-1 truncate text-left">{l.label}</span>
                  {l.code === lang && <Check size={13} className="shrink-0" />}
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
        <Link to="/stats" className="home-round-item">
          <span className="home-round-action"><BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" /></span>
          <span className="home-round-label">{t("stats")}</span>
        </Link>
      </div>
    </main>
  );
}
