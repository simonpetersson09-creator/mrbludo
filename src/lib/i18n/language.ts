// Language preference for Mr. B Ludo. Same detection/fallback pattern as
// Mr. B Yatzy, but fully isolated: own storage keys under the mrb-ludo:v1:
// namespace, no shared code or data with Yatzy.

const LANG_KEY = "mrb-ludo:v1:language";
const LANG_SOURCE_KEY = "mrb-ludo:v1:language-source"; // 'manual' | 'auto'

export type Language =
  | "sv" | "fi" | "no" | "da" | "en" | "es" | "fr" | "it" | "de"
  | "nl" | "ca" | "ro" | "tr" | "pl" | "cs" | "sk" | "sl" | "hr" | "hu"
  | "pt" | "pt-BR" | "id" | "ms" | "vi" | "el" | "ru" | "uk"
  | "ja" | "ko" | "th" | "hi" | "bn" | "gu" | "kn" | "ml" | "mr" | "or" | "pa" | "ta" | "te";

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "sv", label: "Svenska", flag: "🇸🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fi", label: "Suomi", flag: "🇫🇮" },
  { code: "no", label: "Norsk", flag: "🇳🇴" },
  { code: "da", label: "Dansk", flag: "🇩🇰" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "pt", label: "Português (PT)", flag: "🇵🇹" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "cs", label: "Čeština", flag: "🇨🇿" },
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { code: "sl", label: "Slovenščina", flag: "🇸🇮" },
  { code: "hr", label: "Hrvatski", flag: "🇭🇷" },
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { code: "ca", label: "Català", flag: "🇪🇸" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩" },
  { code: "gu", label: "ગુજરાતી", flag: "🇮🇳" },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", label: "മലയാളം", flag: "🇮🇳" },
  { code: "mr", label: "मराठी", flag: "🇮🇳" },
  { code: "or", label: "ଓଡ଼ିଆ", flag: "🇮🇳" },
  { code: "pa", label: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
];

/** Map a BCP-47 tag (e.g. "sv-SE", "nb-NO") to a supported app language. */
export function mapTagToLanguage(tag: string): Language | null {
  const parts = tag.toLowerCase().split(/[-_]/);
  const base = parts[0];
  switch (base) {
    case "sv": return "sv";
    case "da": return "da";
    case "no":
    case "nb":
    case "nn": return "no";
    case "fi": return "fi";
    case "de": return "de";
    case "fr": return "fr";
    case "es": return "es";
    case "it": return "it";
    case "en": return "en";
    case "nl": return "nl";
    case "ca": return "ca";
    case "ro": return "ro";
    case "tr": return "tr";
    case "pl": return "pl";
    case "cs": return "cs";
    case "sk": return "sk";
    case "sl": return "sl";
    case "hr":
    case "bs":
    case "sr": return "hr";
    case "hu": return "hu";
    case "pt": return parts[1] === "pt" ? "pt" : "pt-BR";
    case "id":
    case "in": return "id";
    case "ms": return "ms";
    case "vi": return "vi";
    case "el": return "el";
    case "ru": return "ru";
    case "uk": return "uk";
    case "ja": return "ja";
    case "ko": return "ko";
    case "th": return "th";
    case "hi": return "hi";
    case "bn": return "bn";
    case "gu": return "gu";
    case "kn": return "kn";
    case "ml": return "ml";
    case "mr": return "mr";
    case "or": return "or";
    case "pa": return "pa";
    case "ta": return "ta";
    case "te": return "te";
    default: return null;
  }
}

/** Device/system preferred language, Swedish fallback if unsupported. */
export function detectDeviceLanguage(): Language {
  try {
    const tags = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ].filter(Boolean) as string[];
    for (const tag of tags) {
      const hit = mapTagToLanguage(tag);
      if (hit) return hit;
    }
  } catch {
    /* ignore */
  }
  return "sv";
}

export function getLanguage(): Language {
  if (typeof window === "undefined") return "sv";
  const v = localStorage.getItem(LANG_KEY) as Language | null;
  if (v && LANGUAGES.some((l) => l.code === v)) return v;
  // First launch: pick the device language (Swedish fallback) and remember it
  // as an automatic choice, so a later manual pick always wins.
  const auto = detectDeviceLanguage();
  try {
    localStorage.setItem(LANG_KEY, auto);
    localStorage.setItem(LANG_SOURCE_KEY, "auto");
  } catch {
    /* ignore */
  }
  return auto;
}

/** True when the user actively picked the language in Settings. */
export function isLanguageManuallySet(): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(LANG_SOURCE_KEY) === "manual" ||
    (localStorage.getItem(LANG_SOURCE_KEY) === null && localStorage.getItem(LANG_KEY) !== null)
  );
}

export function setLanguage(lang: Language): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
    localStorage.setItem(LANG_SOURCE_KEY, "manual");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("mrb-ludo-language-changed"));
}

export function subscribeLanguageChanges(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("mrb-ludo-language-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("mrb-ludo-language-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
