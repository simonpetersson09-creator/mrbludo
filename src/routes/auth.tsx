import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : "/online" }),
  head: () => ({
    meta: [
      { title: "Logga in – Mr. B Ludo" },
      { name: "description", content: "Logga in för att spela Ludo online med vänner och topplistor." },
      { property: "og:title", content: "Logga in – Mr. B Ludo" },
      { property: "og:description", content: "Logga in för att spela Ludo online." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: redirect });
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + redirect, data: { display_name: name } } });
        if (error) throw error;
        toast.success("Kolla din e-post och bekräfta kontot");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel");
    } finally { setBusy(false); }
  };

  const google = async () => {
    sessionStorage.setItem("mrb-ludo:v1:after-login", redirect);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth?redirect=" + encodeURIComponent(redirect) });
    if (r.error) { toast.error("Inloggningen misslyckades"); return; }
    if (r.redirected) return;
    navigate({ to: redirect });
  };

  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> Tillbaka</Link>
        <h1 className="brand-title text-3xl">{mode === "in" ? "Logga in" : "Skapa konto"}</h1>
        <p className="mb-3 text-sm text-muted-foreground">Krävs för onlinespel, vänner och topplistor.</p>
        <button className="home-action" onClick={google}>Fortsätt med Google</button>
        <p className="my-2 text-center text-xs text-muted-foreground">eller med e-post</p>
        <form onSubmit={submit} className="flex flex-col gap-[7px]">
          {mode === "up" && (
            <input aria-label="Spelarnamn" placeholder="Spelarnamn" maxLength={20} required minLength={2} className="h-11 rounded-[10px] border bg-card px-3 text-sm outline-none focus:border-gold" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input aria-label="E-post" type="email" placeholder="E-post" required className="h-11 rounded-[10px] border bg-card px-3 text-sm outline-none focus:border-gold" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input aria-label="Lösenord" type="password" placeholder="Lösenord" required minLength={6} className="h-11 rounded-[10px] border bg-card px-3 text-sm outline-none focus:border-gold" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="home-action home-action-gold" disabled={busy}>{mode === "in" ? "Logga in" : "Skapa konto"}</button>
        </form>
        <button className="mt-3 text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Inget konto? Skapa ett" : "Har du konto? Logga in"}
        </button>
      </div>
    </main>
  );
}
