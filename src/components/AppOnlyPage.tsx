import { useState } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { storeLinks } from "@/lib/app-links";
import mrBHeader from "@/assets/mr-b-ludo-header.png";

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.97.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.85c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M4.2 2.6c-.2.2-.3.6-.3 1v16.8c0 .4.1.8.3 1l9.4-9.4L4.2 2.6zm10.6 8.2 2.7-2.7L6.1 1.6c-.3-.2-.7-.2-.9-.1l9.6 9.3zm0 2.4-9.6 9.3c.2.1.6.1.9-.1l11.4-6.5-2.7-2.7zm6.1-2.4-2.4-1.4-3 3 3 3 2.4-1.4c.8-.5.8-2.7 0-3.2z" />
    </svg>
  );
}

/**
 * The only page a plain web visitor ever sees (Yatzy's rule: the website is a
 * download page, the game lives in the app). With an invite code it doubles as
 * the landing page for people who tapped an invite link without the app.
 */
export function AppOnlyPage({ code }: { code?: string | undefined }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const links = storeLinks();
  const urlOf = (store: "apple" | "google") => links.find((l) => l.store === store)?.url;
  const anyStore = links.length > 0;

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is still on screen */
    }
  };

  const badge = (store: "apple" | "google") => {
    const url = urlOf(store);
    const inner = (
      <>
        {store === "apple" ? <AppleIcon /> : <PlayIcon />}
        <span className="flex flex-col items-start leading-none">
          <span className="text-[10px] font-medium opacity-70">Mr. B Ludo</span>
          <span className="mt-0.5 text-[15px] font-semibold">{store === "apple" ? t("storeApple") : t("storeGoogle")}</span>
        </span>
      </>
    );
    const cls =
      "flex h-14 flex-1 items-center justify-center gap-2.5 rounded-2xl border border-border bg-background/70 px-3 text-foreground shadow-sm transition active:scale-[0.97]";
    return url ? (
      <a key={store} href={url} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    ) : (
      <div key={store} aria-disabled="true" className={`${cls} opacity-55`}>
        {inner}
      </div>
    );
  };

  return (
    <main className="app-screen relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden px-6 py-10">
      <div className="home-bg" aria-hidden="true">
        <div className="home-bg-glow" />
        <div className="home-bg-dice" />
      </div>
      <div className="home-stack items-center text-center">
        <div className="mx-auto mb-1 w-full max-w-xs self-center">
          <img src={mrBHeader} alt="Mr. B Ludo" width={1920} height={1280} className="h-auto w-full rounded-3xl object-cover shadow-lg" />
        </div>
        <h1 className="brand-title text-balance text-3xl">{code ? t("joinTitle") : t("webOnlyTitle")}</h1>
        <p className="mt-2 text-balance text-sm leading-relaxed text-muted-foreground">
          {code ? t("joinBody") : t("webOnlyBody")}
        </p>

        {code && (
          <div className="mt-5 w-full rounded-3xl border border-border bg-card/85 px-5 py-5 shadow-lg backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("matchCode")}</p>
            <p className="mt-2 pl-[0.3em] font-mono text-4xl font-bold tracking-[0.3em] text-gold">{code}</p>
            <button type="button" onClick={copy} className="home-action home-action-gold mt-4 w-full justify-center gap-2">
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copied ? t("codeCopied") : t("copyCode")}
            </button>
          </div>
        )}

        <div className="mt-5 flex w-full gap-3">
          {badge("apple")}
          {badge("google")}
        </div>
        {!anyStore && <p className="mt-2 text-xs text-muted-foreground">{t("storeSoon")}</p>}

        {code && (
          <div className="mt-5 flex w-full items-start gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 text-left">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("joinHaveApp")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("joinSteps", { label: t("playOnline") })}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
