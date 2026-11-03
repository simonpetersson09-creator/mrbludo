import { createFileRoute } from "@tanstack/react-router";
import { AppOnlyPage } from "@/components/AppOnlyPage";
import { parseMatchCode } from "@/lib/online/match-code";

/**
 * Invite landing for people without the app (Yatzy's /join). App users never
 * see it: the same link opens the app straight away.
 */
export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => {
    const code = parseMatchCode(typeof search.code === "string" ? search.code : "");
    return code ? { code } : {};
  },
  head: () => ({
    meta: [
      { title: "Mr. B Ludo – ladda ner appen" },
      { name: "description", content: "Spela klassiskt Ludo mot datorn eller vänner. Ladda ner Mr. B Ludo." },
      { property: "og:title", content: "Mr. B Ludo" },
      { property: "og:description", content: "Spela klassiskt Ludo mot datorn eller vänner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useSearch();
  return <AppOnlyPage code={code} />;
}
