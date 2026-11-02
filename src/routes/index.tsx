import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Play, Settings, Users } from "lucide-react";
import { createGame } from "@/lib/ludo/engine";
import { loadGame, loadSettings, saveGame } from "@/lib/ludo/storage";
import { useTranslation } from "@/lib/i18n";
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
  const { t } = useTranslation();
  const [hasGame, setHasGame] = useState(false);
  useEffect(() => setHasGame(!!loadGame()), []);

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
        <Link to="/setup" className="home-action font-display"><Users size={16} /> {t("newMatch")}</Link>
        <Link to="/online" className="home-action font-display"><span aria-hidden="true" className="home-action-icon">🌐</span><span>{t("playOnline")}</span></Link>
        <div className="mt-3 grid grid-cols-3 gap-[7px]">
          <Link to="/stats" className="home-action home-action-ghost"><BarChart3 size={16} /> {t("stats")}</Link>
          <Link to="/rules" className="home-action home-action-ghost"><BookOpen size={16} /> {t("rules")}</Link>
          <Link to="/settings" aria-label={t("settings")} className="home-action home-action-ghost"><Settings size={16} /></Link>
        </div>
      </div>
    </main>
  );
}
