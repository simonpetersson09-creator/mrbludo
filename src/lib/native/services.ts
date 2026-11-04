/** Ads: Yatzy-ported AdMob flow in `src/lib/ads/` (iOS only until Ludo has Android IDs). Push: iOS visible alerts via APNs, see `src/lib/native/push.ts`. */
export const nativeServices = Object.freeze({
  advertising: { enabled: true, provider: "admob", platforms: ["ios"] as const },
  // Permission is asked when entering online play, never at launch; Android waits for Firebase.
  push: { enabled: true, registerOnLaunch: false, platforms: ["ios"] as const },
});
export async function preparePush() { return { enabled: nativeServices.push.enabled }; }
