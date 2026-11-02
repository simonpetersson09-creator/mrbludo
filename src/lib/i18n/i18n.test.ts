import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sv, type TranslationKey } from "./translations/sv";
import { LANGUAGES } from "./language";

const TRANS_DIR = join(__dirname, "translations");
const SRC_DIR = join(__dirname, "..", "..");

const svKeys = Object.keys(sv) as TranslationKey[];
const PARAMS = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

async function loadDict(code: string): Promise<Record<string, string>> {
  const file = code === "pt-BR" ? "ptBR" : code;
  const mod = await import(`./translations/${file}.ts`);
  return mod[file] as Record<string, string>;
}

describe("i18n dictionaries", () => {
  it("has a translation file for every supported language", () => {
    const files = new Set(readdirSync(TRANS_DIR).filter((f) => f.endsWith(".ts")).map((f) => f.replace(".ts", "")));
    for (const l of LANGUAGES) {
      expect(files.has(l.code === "pt-BR" ? "ptBR" : l.code), `missing file for ${l.code}`).toBe(true);
    }
  });

  it("every language has exactly the Swedish keys (none missing, none extra)", async () => {
    for (const l of LANGUAGES) {
      const dict = await loadDict(l.code);
      const keys = Object.keys(dict);
      const missing = svKeys.filter((k) => !(k in dict));
      const extra = keys.filter((k) => !svKeys.includes(k as TranslationKey));
      expect(missing, `${l.code} missing: ${missing.join(",")}`).toEqual([]);
      expect(extra, `${l.code} extra: ${extra.join(",")}`).toEqual([]);
    }
  });

  it("placeholders match the Swedish source in every language", async () => {
    for (const l of LANGUAGES) {
      const dict = await loadDict(l.code);
      for (const k of svKeys) {
        const want = PARAMS(sv[k]);
        const got = PARAMS(dict[k] ?? "");
        expect(got, `${l.code}.${k}: params "${got}" != "${want}"`).toBe(want);
      }
    }
  });

  it("no translation is an empty string", async () => {
    for (const l of LANGUAGES) {
      const dict = await loadDict(l.code);
      for (const k of svKeys) {
        expect((dict[k] ?? "").trim().length, `${l.code}.${k} is empty`).toBeGreaterThan(0);
      }
    }
  });
});

describe("i18n usage in source", () => {
  /** Collect every quoted dictionary key referenced in src (routes + components),
   *  including keys passed via arrays like RULE_KEYS / COLOR_NAME_KEYS / TABS. */
  function usedKeys(): Set<string> {
    const used = new Set<string>();
    const keySet = new Set<string>(svKeys);
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "i18n") continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|ts)$/.test(e.name) && !e.name.endsWith(".test.ts")) {
          const src = readFileSync(p, "utf8");
          for (const m of src.matchAll(/"([a-zA-Z][a-zA-Z0-9_]*)"/g)) if (keySet.has(m[1])) used.add(m[1]);
        }
      }
    };
    walk(join(SRC_DIR, "routes"));
    walk(join(SRC_DIR, "components"));
    return used;
  }

  it("every t() call references a real key", () => {
    const used = usedKeys();
    const bad = [...used].filter((k) => !svKeys.includes(k as TranslationKey));
    expect(bad, `unknown keys used: ${bad.join(",")}`).toEqual([]);
  });

  it("no dictionary key is unused (except generic helpers kept for reuse)", async () => {
    const used = usedKeys();
    // err* keys are looked up dynamically by errorMessage() from server error codes.
    // Helpers resolve genericError dynamically; old account copy remains only for backward dictionary compatibility.
    const retiredAccountKeys = new Set(["signUp", "authHint", "continueGoogle", "orEmail", "noAccount", "haveAccount", "checkEmail", "loginFailed"]);
    const isDynamic = (k: string) => k.startsWith("err") || k === "genericError" || retiredAccountKeys.has(k);
    const unused = svKeys.filter((k) => !used.has(k) && !isDynamic(k));
    expect(unused, `unused keys: ${unused.join(",")}`).toEqual([]);
  });
});
