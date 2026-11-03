import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ensurePlayerSession } from "@/lib/auth/player";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") && !s["redirect"].startsWith("//") ? s["redirect"] : "/online" }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Spelare – Mr. B Ludo" },
      { name: "description", content: "Din personliga spelaridentitet för Ludo online." },
      { property: "og:title", content: "Spelare – Mr. B Ludo" },
      { property: "og:description", content: "Spela med din personliga spelaridentitet." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    ensurePlayerSession().then(() => { if (active) navigate({ href: redirect, replace: true }); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [navigate, redirect, attempt]);

  return (
    <main className="app-screen">
      <div className="home-stack">
        <h1 className="brand-title text-3xl">Mr. B Ludo</h1>
        <p role="status" className="text-sm text-muted-foreground">{failed ? t("reconnecting") : t("loading")}</p>
        {failed && <Button className="home-action" onClick={() => setAttempt(n => n + 1)}>{t("playOnline")}</Button>}
        <Link to="/" className="home-action home-action-ghost">{t("home")}</Link>
      </div>
    </main>
  );
}
