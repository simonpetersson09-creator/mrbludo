import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Regler – Mr. B Ludo" },
      { name: "description", content: "Så spelar du Ludo i Mr. B Ludo." },
      { property: "og:title", content: "Regler – Mr. B Ludo" },
      { property: "og:description", content: "Så spelar du Ludo i Mr. B Ludo." },
    ],
  }),
  component: RulesPage,
});

const RULE_KEYS: TranslationKey[] = ["rule1", "rule2", "rule3", "rule4", "rule5", "rule6", "rule7", "rule8"];

function RulesPage() {
  const { t } = useTranslation();
  return (
    <main className="app-screen">
      <div className="home-stack">
        <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft size={16} /> {t("back")}</Link>
        <h1 className="brand-title mb-3 text-3xl">{t("rulesTitle")}</h1>
        {RULE_KEYS.map((k, i) => (
          <div key={k} className="flex gap-3 rounded-[10px] border bg-card p-3 text-sm">
            <span className="font-bold text-gold">{i + 1}</span><span>{t(k)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
