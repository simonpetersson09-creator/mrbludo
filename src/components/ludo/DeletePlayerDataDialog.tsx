import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { deletePlayerData } from "@/lib/ludo/player-data";

// Ported from Yatzy's DeletePlayerDataDialog: explicit acknowledgement, then a permanent erase.
export function DeletePlayerDataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const guard = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const close = () => { if (!guard.current) onClose(); };
  useEffect(() => {
    if (!open || !ref.current) return;
    setConfirmed(false); setError(false); setDone(false);
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);
  const erase = async () => {
    if (!confirmed || guard.current) return;
    guard.current = true; setBusy(true); setError(false);
    try { await deletePlayerData(); setDone(true); }
    catch { setError(true); }
    finally { guard.current = false; setBusy(false); }
  };
  if (!open) return null;
  const btn = "min-h-11 w-full rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50";
  return createPortal(
    <dialog ref={ref} aria-labelledby="delete-data-title" aria-describedby="delete-data-description"
      onCancel={(e) => { e.preventDefault(); if (!done) close(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-80px)] w-[calc(100%-40px)] max-w-sm overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl backdrop:bg-background/80">
      <Trash2 className="mx-auto mb-3 h-8 w-8 text-destructive" />
      <h2 id="delete-data-title" className="text-center font-display text-lg font-bold">{t(done ? "deleteDataDone" : "deleteData")}</h2>
      <p id="delete-data-description" className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(done ? "deleteDataRestart" : "deleteDataDescription")}</p>
      {done ? (
        <button className={`${btn} mt-5 bg-primary text-primary-foreground`} onClick={() => window.location.replace("/")}>{t("ok")}</button>
      ) : (
        <>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-destructive" />
            <span>{t("deleteDataAcknowledge")}</span>
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{t("deleteDataError")}</p>}
          <div className="mt-5 flex flex-col gap-2">
            <button className={`${btn} bg-destructive text-destructive-foreground`} disabled={!confirmed || busy} onClick={() => void erase()}>{t(busy ? "loading" : "deleteDataConfirm")}</button>
            <button className={`${btn} border border-border bg-secondary`} disabled={busy} onClick={close}>{t("cancel")}</button>
          </div>
        </>
      )}
    </dialog>,
    document.body,
  );
}
