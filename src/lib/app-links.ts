/**
 * Store listings for Mr. B Ludo. Both are empty until the app is approved and
 * live; the download page then says "coming soon" instead of linking nowhere.
 * Yatzy keeps the same shape in its own app-links module (read-only reference).
 */
export const APP_STORE_URL = "";
export const PLAY_STORE_URL = "";

export type StoreLink = { store: "apple" | "google"; url: string };

export function storeLinks(): StoreLink[] {
  return [
    APP_STORE_URL && { store: "apple" as const, url: APP_STORE_URL },
    PLAY_STORE_URL && { store: "google" as const, url: PLAY_STORE_URL },
  ].filter((link): link is StoreLink => Boolean(link));
}
