import { useEffect, useState } from "react";
import { getLanguage, subscribeLanguageChanges, type Language } from "./language";
import { sv, type TranslationKey } from "./translations/sv";
import { en } from "./translations/en";
import { no } from "./translations/no";
import { da } from "./translations/da";
import { fi } from "./translations/fi";
import { es } from "./translations/es";
import { fr } from "./translations/fr";
import { it } from "./translations/it";
import { de } from "./translations/de";
import { nl } from "./translations/nl";
import { ca } from "./translations/ca";
import { ro } from "./translations/ro";
import { tr } from "./translations/tr";
import { pl } from "./translations/pl";
import { cs } from "./translations/cs";
import { sk } from "./translations/sk";
import { sl } from "./translations/sl";
import { hr } from "./translations/hr";
import { hu } from "./translations/hu";
import { pt } from "./translations/pt";
import { ptBR } from "./translations/ptBR";
import { id } from "./translations/id";
import { ms } from "./translations/ms";
import { vi } from "./translations/vi";
import { el } from "./translations/el";
import { ru } from "./translations/ru";
import { uk } from "./translations/uk";
import { ja } from "./translations/ja";
import { ko } from "./translations/ko";
import { th } from "./translations/th";
import { hi } from "./translations/hi";
import { bn } from "./translations/bn";
import { gu } from "./translations/gu";
import { kn } from "./translations/kn";
import { ml } from "./translations/ml";
import { mr } from "./translations/mr";
import { or } from "./translations/or";
import { pa } from "./translations/pa";
import { ta } from "./translations/ta";
import { te } from "./translations/te";

export type { TranslationKey } from "./translations/sv";
export { LANGUAGES, getLanguage, setLanguage, isLanguageManuallySet, type Language } from "./language";

type Dict = Partial<Record<TranslationKey, string>>;

const DICTS: Record<Language, Dict> = {
  sv, en, no, da, fi, es, fr, it, de,
  nl, ca, ro, tr, pl, cs, sk, sl, hr, hu, pt, "pt-BR": ptBR, id, ms, vi, el, ru, uk,
  ja, ko, th, hi, bn, gu, kn, ml, mr, or, pa, ta, te,
};

function format(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

function lookup(lang: Language, key: TranslationKey): string {
  return DICTS[lang]?.[key] ?? (lang === "sv" ? undefined : en[key]) ?? sv[key] ?? (key as string);
}

/**
 * Translate a key. Falls back to English (non-Swedish languages), then Swedish, then the key itself.
 * Use outside React. Inside components prefer useTranslation() so they
 * re-render automatically when the language changes.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return format(lookup(getLanguage(), key), params);
}

/** React hook — returns a translator that re-renders the component on language change. */
export function useTranslation() {
  const [lang, setLang] = useState<Language>(() => getLanguage());

  useEffect(() => {
    return subscribeLanguageChanges(() => {
      const next = getLanguage();
      setLang((prev) => (prev === next ? prev : next));
    });
  }, []);

  const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
    format(lookup(lang, key), params);

  return { t: translate, lang };
}

/** Translate a server error. Server functions throw stable codes ("err:xxx");
 *  anything else (auth errors etc.) is shown as-is or as a generic error. */
export function errorMessage(e: unknown, translate: (key: TranslationKey) => string): string {
  const raw = e instanceof Error ? e.message : "";
  const m = /^err:([a-z_]+)$/.exec(raw);
  if (m) {
    const key = `err${m[1].split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("")}` as TranslationKey;
    const translated = translate(key);
    if (translated !== key) return translated;
  }
  return raw && !raw.startsWith("err:") ? raw : translate("genericError");
}
