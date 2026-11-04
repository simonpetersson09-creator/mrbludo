import { createFileRoute } from "@tanstack/react-router";
import { LudoBoard } from "@/components/ludo/LudoBoard";
import { createGame, type GameState } from "@/lib/ludo/engine";

export const Route = createFileRoute("/center-preview")({
  head: () => ({ meta: [{ title: "Mittförslag" }] }),
  component: CenterPreview,
});

function demoState(): GameState {
  const state = createGame([
    { id: "a", name: "Anna", color: 0, isBot: false },
    { id: "b", name: "Bertil", color: 1, isBot: true },
    { id: "c", name: "Cecilia", color: 2, isBot: true },
    { id: "d", name: "David", color: 3, isBot: true },
  ]);
  // Spread a few pieces out so the board looks alive.
  state.pieces[0] = [0, 8, -1, -1];
  state.pieces[1] = [3, 20, -1, -1];
  state.pieces[2] = [10, 33, -1, -1];
  state.pieces[3] = [5, 47, 52, -1];
  return state;
}

const STYLES = [
  { id: "current", label: "Nuvarande: rund medaljong" },
  { id: "hub", label: "Förslag 1: traditionellt möte (som bilden)" },
  { id: "quarters", label: "Förslag 2: fyra färgkvadrater" },
] as const;

function CenterPreview() {
  const state = demoState();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 p-4">
      {STYLES.map((s) => (
        <div key={s.id}>
          <p className="mb-2 text-center text-sm font-semibold">{s.label}</p>
          <LudoBoard state={state} legal={[]} onPick={() => {}} centerStyle={s.id} />
        </div>
      ))}
    </div>
  );
}
