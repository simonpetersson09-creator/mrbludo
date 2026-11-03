/** The packaged game works offline; only online actions need this Ludo-only origin. */
export function validateLudoOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || /localhost|id-preview|yatzy/i.test(url.hostname)) {
    throw new Error("Use the approved published Mr. B Ludo HTTPS origin");
  }
  return url.origin;
}

/** Ludo's own published server; the app talks to it directly. */
export const PUBLISHED_LUDO_ORIGIN = "https://mrbludo.lovable.app";

export function nativeOnlineOrigin(): string {
  const value = import.meta.env['VITE_MRB_LUDO_ONLINE_ORIGIN'] || PUBLISHED_LUDO_ORIGIN;
  return validateLudoOrigin(value);
}

export function allowedNativeOrigin(origin: string | null): boolean {
  return origin === "capacitor://localhost" || origin === "https://localhost" || origin === "http://localhost";
}