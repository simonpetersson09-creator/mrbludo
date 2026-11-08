import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAdDiagnostics } from "@/lib/online/online.functions";

/** Same on-demand diagnostics layout as Yatzy, using Ludo's role-protected server. */
export default function AdminAdDiagnostics() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  async function load() {
    setLoading(true); setError(""); setCopied(false);
    try {
      const data = await adminAdDiagnostics();
      setText(data.diagnostics.length ? data.diagnostics.map((row) => JSON.stringify(row)).join("\n") : "Inga iPhone-försök registrerade från 8 november 2026 inom de senaste 30 dagarna.");
    } catch { setError("Diagnostiken kunde inte hämtas. Försök igen."); }
    finally { setLoading(false); }
  }
  return <details className="mt-6 border-t border-border pt-4">
    <summary className="cursor-pointer font-semibold">iPhone – appstartsdiagnostik</summary>
    <p className="mt-2 text-xs text-muted-foreground">Från 8 november 2026 (UTC), högst de senaste 30 dagarna.</p>
    <div className="my-3 flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw />{loading ? "Hämtar…" : "Hämta senaste 30 dagarna"}</Button>
      <Button variant="outline" size="sm" disabled={!text} onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => setError("Kopiering gick inte. Markera texten och kopiera."));
      }}><Copy />{copied ? "Kopierat" : "Kopiera"}</Button>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {text && <textarea readOnly aria-label="iPhone appstartsloggar" value={text} className="h-80 w-full rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground" />}
  </details>;
}