import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/auth/client";
import { getMe } from "@/lib/online/online.functions";
import { errorMessage, useTranslation } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin-login")({
  head: () => ({ meta: [
    { title: "Administratörsåtkomst – Mr. B Ludo" },
    { name: "description", content: "Skyddad administratörsåtkomst till Mr. B Ludo." },
    { property: "og:title", content: "Administratörsåtkomst – Mr. B Ludo" },
    { property: "og:description", content: "Skyddad administratörsåtkomst till Mr. B Ludo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }), component: AdminLogin,
});
function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="app-screen"><div className="home-stack">
    <h1 className="brand-title text-3xl">{t("admin")}</h1>
    <form className="flex flex-col gap-2" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      // Keep the ordinary player identity; failed admin login must not destroy it.
      const { data: previous } = await supabase.auth.getSession();
      try {
        await qc.cancelQueries(); qc.clear();
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw new Error("err:forbidden");
        const me = await getMe();
        if (!me.isAdmin) {
          if (previous.session) await supabase.auth.setSession(previous.session);
          else await supabase.auth.signOut();
          throw new Error("err:forbidden");
        }
        await navigate({ to: "/admin", replace: true });
      } catch (e) { setError(errorMessage(e, t)); }
      finally { setPassword(""); setBusy(false); }
    }}>
      <input className="h-11 rounded-lg border bg-card px-3" type="email" autoComplete="username" aria-label={t("email")} placeholder={t("email")} value={email} onChange={e => setEmail(e.target.value)} required />
      <input className="h-11 rounded-lg border bg-card px-3" type="password" autoComplete="current-password" aria-label={t("password")} placeholder={t("password")} value={password} onChange={e => setPassword(e.target.value)} required />
      <Button type="submit" className="home-action home-action-gold" disabled={busy}>{t("signIn")}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
    <Link to="/" className="home-action home-action-ghost">{t("home")}</Link>
  </div></main>;
}