import { randomBotNames } from "@/lib/ludo/bot-names";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, User } from "lucide-react";
import { createGame, type Color, type Player } from "@/lib/ludo/engine";
import { loadSettings, saveGame } from "@/lib/ludo/storage";
import { useTranslation, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Ny match – Mr. B Ludo" },
      { name: "description", content: "Välj antal spelare och datormotståndare för en ny Ludo-match." },
      { property: "og:title", content: "Ny match – Mr. B Ludo" },
      { property: "og:description", content: "Välj antal spelare och datormotståndare för en ny Ludo-match." },
    ],
  }),
  component: SetupPage,
});

const COLOR_KEYS: TranslationKey[] = ["colorRed", "colorGreen", "colorYellow", "colorBlue"];
const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];
/** 2 players sit opposite each other. */
const SEATS: Record<number, Color[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

function SetupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [count, setCount] = useState(2);
  const [bots, setBots] = useState<boolean[]>([false, true, true, true]);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  useEffect(() => {
    const n = loadSettings().name;
    setNames([n, t("playerN", { n: 2 }), t("playerN", { n: 3 }), t("playerN", { n: 4 })]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    const botNames = randomBotNames(4);
    const players: Player[] = SEATS[count].map((color, i) => ({
      id: `p${i}`,
      color,
      isBot: i === 0 ? false : bots[i],
      name: i > 0 && bots[i] ? botNames[i] : names[i].trim() || t("playerN", { n: i + 1 }),
    }));
    saveGame(createGame(players));
    navigate({ to: "/play" });
  };

  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        <h1 className="brand-title text-3xl">{t("newMatchTitle")}</h1>
        <p className="mb-3 text-sm text-muted-foreground">{t("playerCount")}</p>
        <div className="grid grid-cols-3 gap-[7px]">
          {[2, 3, 4].map((n) => (
            <button key={n} className={`home-action ${n === count ? "home-action-gold" : "home-action-ghost"}`} onClick={() => setCount(n)}>{n}</button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-[7px]">
          {SEATS[count].map((color, i) => (
            <div key={i} className="flex h-[52px] items-center gap-2 rounded-[10px] border bg-card px-3">
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: COLOR_VAR[color] }} />
              {i > 0 && bots[i] ? (
                <span className="flex-1 text-sm font-semibold">{t("computerColor", { color: t(COLOR_KEYS[color]) })}</span>
              ) : (
                <input
                  aria-label={t("playerN", { n: i + 1 })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                  value={names[i]}
                  maxLength={16}
                  onChange={(e) => setNames((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                />
              )}
              {i > 0 && (
                <button
                  className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
                  onClick={() => setBots((b) => b.map((v, j) => (j === i ? !v : v)))}
                >
                  {bots[i] ? <><Bot size={14} /> {t("bot")}</> : <><User size={14} /> {t("human")}</>}
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="home-action home-action-success mt-5" onClick={start}>{t("startMatch")}</button>
      </div>
    </main>
  );
}
