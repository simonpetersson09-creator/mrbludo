import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Globe, Play, Settings, Users, Zap } from "lucide-react";
import { createGame } from "@/lib/ludo/engine";
import { loadGame, loadSettings, saveGame } from "@/lib/ludo/storage";
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
  const [hasGame, setHasGame] = useState(false);
  useEffect(() => setHasGame(!!loadGame()), []);

  const quick = () => {
    const name = loadSettings().name;
    saveGame(createGame([
      { id: "p0", name, color: 0, isBot: false },
      { id: "p1", name: "Dator Gul", color: 2, isBot: true },
    ]));
    navigate({ to: "/play" });
  };

  return (
    <main className="app-screen flex flex-col items-center">
      <img src={heroImg} alt="" width={720} height={720} className="mt-2 h-40 w-40 rounded-3xl object-cover shadow-2xl" />
      <h1 className="brand-title mt-4 text-4xl">Mr. B Ludo</h1>
      <p className="mb-6 text-sm text-muted-foreground">Klassiskt Ludo – fyra pjäser, en tärning</p>
      <div className="home-stack">
        {hasGame && (
          <Link to="/play" className="home-action home-action-success"><Play size={16} /> Fortsätt pågående match</Link>
        )}
        <button className="home-action" onClick={quick}><Zap size={16} /> Snabbmatch mot datorn</button>
        <Link to="/setup" className="home-action"><Users size={16} /> Ny match (2–4 spelare)</Link>
        <Link to="/online" className="home-action home-action-gold"><Globe size={16} /> Spela online</Link>
        <div className="mt-3 grid grid-cols-3 gap-[7px]">
          <Link to="/stats" className="home-action home-action-ghost"><BarChart3 size={16} /> Statistik</Link>
          <Link to="/rules" className="home-action home-action-ghost"><BookOpen size={16} /> Regler</Link>
          <Link to="/settings" className="home-action home-action-ghost"><Settings size={16} /></Link>
        </div>
      </div>
    </main>
  );
}
