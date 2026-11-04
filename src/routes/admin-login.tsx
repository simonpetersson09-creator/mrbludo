import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ensurePlayerSession } from "@/lib/auth/player";
import { adminPinLogin } from "@/lib/online/online.functions";
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
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="app-screen"><div className="home-stack">
    <h1 className="brand-title text-3xl">{t("admin")}</h1>
    <form className="flex flex-col gap-2" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        // The PIN unlocks admin for this device's own player identity; nothing is replaced.
        await ensurePlayerSession();
        await adminPinLogin({ data: { pin } });
        await qc.invalidateQueries();
        await navigate({ to: "/admin", replace: true });
      } catch (e) { setError(errorMessage(e, t)); }
      finally { setPin(""); setBusy(false); }
    }}>
      <input className="h-11 rounded-lg border bg-card px-3 text-center text-lg tracking-[0.4em]" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={12} aria-label={t("pinCode")} placeholder={t("pinCode")} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} required />
      <Button type="submit" className="home-action home-action-gold" disabled={busy || pin.length < 4}>{t("signIn")}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
    <Link to="/" className="home-action home-action-ghost">{t("home")}</Link>
  </div></main>;
}
