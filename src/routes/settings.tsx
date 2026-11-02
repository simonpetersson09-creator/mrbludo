import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BarChart3, Camera, Check, ChevronRight, Globe, Gauge, User, Vibrate } from "lucide-react";
import { toast } from "sonner";
import { loadSettings, saveSettings, type Settings } from "@/lib/ludo/storage";
import { adoptOwnAvatarFromServer, fileToAvatarDataUrl, setOwnAvatar, syncOwnAvatar, useOwnAvatar } from "@/lib/ludo/avatar";
import { LANGUAGES, setLanguage, useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Inställningar – Mr. B Ludo" },
      { name: "description", content: "Spelarnamn, språk, datorns tempo och vibration." },
      { property: "og:title", content: "Inställningar – Mr. B Ludo" },
      { property: "og:description", content: "Spelarnamn, språk, datorns tempo och vibration." },
    ],
  }),
  component: SettingsPage,
});

// Layout ported from Yatzy's SettingsPage (sections, cards, rows, toggle).
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="select-none px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Card({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-border/40 bg-secondary/50">{children}</div>;
}
const rowCls = "flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-secondary/60";

function SettingsPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [s, setS] = useState<Settings | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = useOwnAvatar();
  // A picture saved while offline is uploaded as soon as the page is opened again,
  // and a device that has never seen the picture first takes the server copy.
  useEffect(() => { void adoptOwnAvatarFromServer().then(() => syncOwnAvatar()); }, []);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const shared = await setOwnAvatar(await fileToAvatarDataUrl(file));
      toast.success(shared ? t("avatarSaved") : t("avatarLocalOnly"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  };
  const removePicture = async () => {
    setBusy(true);
    const shared = await setOwnAvatar(null);
    setBusy(false);
    toast.success(shared ? t("avatarRemoved") : t("avatarLocalOnly"));
  };
  useEffect(() => setS(loadSettings()), []);
  if (!s) return <main className="app-screen" />;
  const update = (patch: Partial<Settings>) => { const n = { ...s, ...patch }; setS(n); saveSettings(n); };
  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <main className="app-screen">
      <div className="mx-auto mt-3 max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/" })} aria-label={t("back")} className="-ml-2 rounded-xl p-2.5 transition-colors active:bg-secondary/80">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <h1 className="font-display text-2xl font-bold">{t("settingsTitle")}</h1>
        </div>

        <Section title={t("profile")}>
          <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-secondary/50 p-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={t("changeAvatar")}
              disabled={busy}
              className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/30 to-primary/10 ring-2 ring-primary/30 ring-offset-2 ring-offset-background transition active:scale-95 disabled:opacity-60"
            >
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-primary/70" />}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold">{s.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                  className="min-h-9 rounded-full bg-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors active:bg-primary/25 disabled:opacity-60">
                  {t("changeAvatar")}
                </button>
                {avatar && (
                  <button type="button" onClick={removePicture} disabled={busy}
                    className="min-h-9 rounded-full bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors active:bg-destructive/20 disabled:opacity-60">
                    {t("removeAvatar")}
                  </button>
                )}
              </div>
            </div>
          </div>
          <Card>
            {editingName ? (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus maxLength={16} value={s.name} aria-label={t("yourName")}
                  onChange={(e) => update({ name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                  className="flex-1 border-b border-primary/40 bg-transparent py-1 text-sm font-medium transition-colors focus:border-primary focus:outline-none"
                />
                <button onClick={() => setEditingName(false)} aria-label="OK" className="rounded-lg bg-primary/15 p-1.5 active:bg-primary/25">
                  <Check className="h-4 w-4 text-primary" />
                </button>
              </div>
            ) : (
              <button className={rowCls} onClick={() => setEditingName(true)}>
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t("yourName")}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.name}</p>
                </div>
              </button>
            )}
          </Card>
        </Section>

        <Section title={t("botSpeed")}>
          <Card>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Gauge className="h-4 w-4 shrink-0 text-primary" />
              <div className="grid flex-1 grid-cols-3 gap-1.5">
                {(["slow", "normal", "fast"] as const).map((v) => (
                  <button key={v} onClick={() => update({ botSpeed: v })}
                    className={`min-h-9 rounded-full px-2 text-xs font-semibold transition-colors ${s.botSpeed === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {v === "slow" ? t("speedSlow") : v === "normal" ? t("speedNormal") : t("speedFast")}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border/40" />
            <button type="button" role="switch" aria-checked={s.haptics} className={rowCls} onClick={() => update({ haptics: !s.haptics })}>
              <Vibrate className="h-4 w-4 text-primary" />
              <p className="flex-1 text-sm font-medium">{t("haptics")}</p>
              <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${s.haptics ? "bg-primary" : "border border-border bg-secondary"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground shadow transition-all ${s.haptics ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </button>
          </Card>
        </Section>

        <Section title={t("languageLabel")}>
          <Card>
            <button className={rowCls} aria-expanded={langOpen} onClick={() => setLangOpen((o) => !o)}>
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t("languageLabel")}</p>
                <p className="truncate text-xs text-muted-foreground">{current?.flag} {current?.label}</p>
              </div>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${langOpen ? "rotate-90" : ""}`} />
            </button>
            {langOpen && (
              <div className="max-h-72 overflow-y-auto overscroll-contain border-t border-border/40">
                {LANGUAGES.map((l, i) => (
                  <button key={l.code} onClick={() => setLanguage(l.code)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-secondary/60 ${i > 0 ? "border-t border-border/40" : ""}`}>
                    <span className="text-xl leading-none">{l.flag}</span>
                    <span className="flex-1 text-sm font-medium">{l.label}</span>
                    {l.code === lang && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </Section>

        <Section title={t("stats")}>
          <Card>
            <Link to="/stats" className={rowCls}>
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="flex-1 text-sm font-medium">{t("statsTitle")}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Card>
        </Section>
      </div>
    </main>
  );
}
