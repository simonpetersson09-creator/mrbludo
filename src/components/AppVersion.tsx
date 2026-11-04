import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useTranslation } from "@/lib/i18n";

/** The app's real store version and build, e.g. "1.0 (3)" — helps when someone reports a problem. Shown in the app only. */
export function AppVersion() {
  const { t } = useTranslation();
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import("@capacitor/app").then(({ App }) => App.getInfo()).then((i) => setV(`${i.version} (${i.build})`)).catch(() => {});
  }, []);
  if (!v) return null;
  return <p className="select-text pt-1 text-center text-[11px] text-muted-foreground">{t("appVersion", { v })}</p>;
}
