import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n";

/** Same fixed messages as Mr. B Yatzy: no free text, so nothing to moderate. */
export const QUICK_MESSAGES = [
  { id: "nice_roll", text: "Bra kast! 🎲" },
  { id: "lucky", text: "Tur 😅" },
  { id: "gg", text: "GG 👏" },
  { id: "comeback", text: "Nu vänder det 🔥" },
  { id: "oh_no", text: "Oj då 😱" },
  { id: "your_turn", text: "Din tur 👀" },
  { id: "rematch", text: "Revansch?" },
  { id: "well_played", text: "Snyggt spelat" },
  { id: "haha", text: "Hahaha 😂" },
] as const;
const TEXT = new Map<string, string>(QUICK_MESSAGES.map((m) => [m.id, m.text]));

const COOLDOWN_MS = 4000;
const BUBBLE_MS = 3500;
const COLOR_VAR = ["var(--ludo-red)", "var(--ludo-green)", "var(--ludo-yellow)", "var(--ludo-blue)"];

interface Bubble { key: string; text: string; name: string; color: number; mine: boolean }

export function QuickChat({ matchId, myName, myColor }: { matchId: string; myName: string; myColor: number | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const lastSent = useRef(0);
  const channel = useRef<RealtimeChannel | null>(null);

  const add = useCallback((b: Bubble) => {
    setBubbles((prev) => [...prev, b].slice(-4));
    setTimeout(() => setBubbles((prev) => prev.filter((x) => x.key !== b.key)), BUBBLE_MS);
  }, []);

  useEffect(() => {
    const ch = supabase.channel(`ludo-quick-chat-${matchId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "quick_message" }, ({ payload }) => {
      const d = payload as { id?: string; name?: string; color?: number };
      const text = d.id ? TEXT.get(d.id) : undefined; // only known ids are shown
      if (!text) return;
      add({ key: `${Date.now()}-${Math.random()}`, text, name: String(d.name ?? "").slice(0, 24), color: Number(d.color) || 0, mine: false });
    });
    ch.subscribe();
    channel.current = ch;
    return () => { void supabase.removeChannel(ch); channel.current = null; };
  }, [matchId, add]);

  useEffect(() => {
    const id = setInterval(() => setCooldown(Math.max(0, COOLDOWN_MS - (Date.now() - lastSent.current))), 200);
    return () => clearInterval(id);
  }, []);

  const send = (id: string) => {
    const now = Date.now();
    if (myColor == null || now - lastSent.current < COOLDOWN_MS) return;
    lastSent.current = now;
    setCooldown(COOLDOWN_MS);
    setOpen(false);
    add({ key: `${now}-me`, text: TEXT.get(id)!, name: myName, color: myColor, mine: true });
    void channel.current?.send({ type: "broadcast", event: "quick_message", payload: { id, name: myName, color: myColor } });
  };

  return (
    <>
      <div className="quick-chat-bubbles" aria-live="polite">
        {bubbles.map((b) => (
          <div key={b.key} className="quick-chat-bubble" style={{ background: COLOR_VAR[b.color] }}>
            <span className="quick-chat-name">{b.mine ? t("you") : b.name}</span>
            <span>{b.text}</span>
          </div>
        ))}
      </div>
      <button type="button" className="quick-chat-btn" aria-label={t("quickMessages")} onClick={() => setOpen((v) => !v)} disabled={myColor == null}>
        <MessageCircle size={16} strokeWidth={2.5} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[75] bg-background/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="quick-chat-panel">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <p className="font-display text-sm font-bold">{t("quickMessages")}</p>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1" aria-label={t("close")}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {QUICK_MESSAGES.map((m) => (
                <button key={m.id} type="button" disabled={cooldown > 0} onClick={() => send(m.id)}
                  className="rounded-xl bg-secondary/80 px-3 py-2.5 text-left text-[13px] font-medium text-foreground transition active:scale-95 disabled:opacity-50">
                  {m.text}
                </button>
              ))}
            </div>
            {cooldown > 0 && <p className="pb-3 text-center text-[10px] text-muted-foreground">{t("waitCooldown", { sec: Math.ceil(cooldown / 1000) })}</p>}
          </div>
        </>
      )}
    </>
  );
}
