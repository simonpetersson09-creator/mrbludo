/** Ads: Yatzy-ported AdMob flow in `src/lib/ads/` (iOS only until Ludo has Android IDs). Push stays off until approved. */
export const nativeServices = Object.freeze({
  advertising: { enabled: true, provider: "admob", platforms: ["ios"] as const },
  push: { enabled: false, registerOnLaunch: false },
});
export async function preparePush() { return { enabled: nativeServices.push.enabled }; }
