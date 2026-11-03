import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { storeLinks } from "@/lib/app-links";
import mrBDie from "@/assets/mr-b-die.png";

/**
 * The only page a plain web visitor ever sees (Yatzy's rule: the website is a
 * download page, the game lives in the app). With an invite code it doubles as
 * the landing page for people who tapped an invite link without the app.
 */
export function AppOnlyPage({ code }: { code?: string | undefined }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const stores = storeLinks();

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

  return (
    <main className="app-screen relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden px-6">
      <div className="home-bg" aria-hidden="true">
        <div className="home-bg-glow" />
        <div className="home-bg-dice" />
      </div>
      <div className="home-stack text-center">
        <div className="brand-logo mb-2 inline-flex h-28 w-28 items-center justify-center">
          <img src={mrBDie} alt="" width={112} height={112} />
        </div>
        <h1 className="brand-title text-3xl">{code ? t("joinTitle") : t("webOnlyTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {code ? t("joinBody") : t("webOnlyBody")}
        </p>

        {code && (
          <div className="mt-5 rounded-2xl border border-border bg-card/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("matchCode")}
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.28em] text-gold">{code}</p>
            <button type="button" onClick={copy} className="home-action home-action-ghost mt-3 justify-center">
              {copied ? t("codeCopied") : t("copyCode")}
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {stores.map((link) => (
            <a
              key={link.store}
              href={link.url}
              className="home-action home-action-gold justify-center"
              target="_blank"
              rel="noreferrer"
            >
              {link.store === "apple" ? t("storeApple") : t("storeGoogle")}
            </a>
          ))}
          {!stores.length && <p className="text-xs text-muted-foreground">{t("storeSoon")}</p>}
        </div>

        {code && (
          <div className="mt-6 rounded-2xl border border-border bg-card/60 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-foreground">{t("joinHaveApp")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("joinSteps", { label: t("playOnline") })}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
