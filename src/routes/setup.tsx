import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, User } from "lucide-react";
import { createGame, type Color, type Player } from "@/lib/ludo/engine";
import { loadSettings, saveGame } from "@/lib/ludo/storage";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Ny match – Mr. B Ludo" },
      { name: "description", content: "Välj antal spelare och datormotståndare för en ny Ludo-match." },
      { property: "og:title", content: "Ny match – Mr. B Ludo" },
      { property: "og:description", content: "Välj antal spelare och datormotståndare för en ny Ludo-match." },
    ],
  }),
  component: SetupPage,
});

const COLORS_SV = ["Röd", "Grön", "Gul", "Blå"];
const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];
/** 2 players sit opposite each other. */
const SEATS: Record<number, Color[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

function SetupPage() {
  const navigate = useNavigate();
  const [count, setCount] = useState(2);
  const [bots, setBots] = useState<boolean[]>([false, true, true, true]);
  const [names, setNames] = useState<string[]>(["Spelare", "Spelare 2", "Spelare 3", "Spelare 4"]);
  useEffect(() => { const n = loadSettings().name; setNames((a) => [n, ...a.slice(1)]); }, []);

  const start = () => {
    const players: Player[] = SEATS[count].map((color, i) => ({
      id: `p${i}`,
      color,
      isBot: i === 0 ? false : bots[i],
      name: i > 0 && bots[i] ? `Dator ${COLORS_SV[color]}` : names[i].trim() || `Spelare ${i + 1}`,
    }));
    saveGame(createGame(players));
    navigate({ to: "/play" });
  };

  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title text-3xl">Ny match</h1>
        <p className="mb-3 text-sm text-muted-foreground">Antal spelare</p>
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
                <span className="flex-1 text-sm font-semibold">Dator {COLORS_SV[color]}</span>
              ) : (
                <input
                  aria-label={`Namn för spelare ${i + 1}`}
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
                  {bots[i] ? <><Bot size={14} /> Dator</> : <><User size={14} /> Människa</>}
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="home-action home-action-success mt-5" onClick={start}>Starta match</button>
      </div>
    </main>
  );
}
