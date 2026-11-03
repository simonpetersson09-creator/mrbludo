/**
 * Store listings for Mr. B Ludo. Both are empty until the app is approved and
 * live; the download page then says "coming soon" instead of linking nowhere.
 * Yatzy keeps the same shape in its own app-links module (read-only reference).
 */
export const APP_STORE_URL = "";
export const PLAY_STORE_URL = "";

export type StoreLink = { store: "apple" | "google"; url: string };

export function storeLinks(): StoreLink[] {
  const links: StoreLink[] = [];
  if (APP_STORE_URL) links.push({ store: "apple", url: APP_STORE_URL });
  if (PLAY_STORE_URL) links.push({ store: "google", url: PLAY_STORE_URL });
  return links;
}
