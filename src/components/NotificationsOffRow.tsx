import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { RESUME_EVENT } from "@/lib/native/runtime";
import { enablePush, pushPermission, type PushPermission } from "@/lib/native/push";

/** Yatzy-style reminder: shown only in the iPhone app while notifications are not allowed. */
export function NotificationsOffRow({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<PushPermission>("unsupported");
  useEffect(() => {
    const check = () => { void pushPermission().then(setState); };
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener(RESUME_EVENT, check);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener(RESUME_EVENT, check); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  if (state === "granted" || state === "unsupported") return null;
  return (
    <button type="button" onClick={() => { void enablePush().then(setState); }}
      className={`flex min-h-11 w-full items-center gap-3 rounded-2xl border border-gold/40 bg-secondary/60 px-3 py-2 text-left transition active:scale-[0.99] ${className}`}>
      <BellOff className="h-4 w-4 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{t("notifOffTitle")}</span>
        <span className="block text-xs text-muted-foreground">{t("notifOffDesc")}</span>
      </span>
      <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-xs font-bold text-primary-foreground">{t("notifOffAction")}</span>
    </button>
  );
}
