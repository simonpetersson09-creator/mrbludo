/**
 * Yatzy HomePage App Open rules, ported unchanged:
 * - cold start: once per launch, preload immediately, try after 1.5 s, only on Home;
 * - return: only when away ≥ 40 s and back on Home; not ready → skipped, never deferred;
 * - leaving Home or backgrounding invalidates the pending opportunity.
 */
import { isAdMobAvailable, preloadAppOpenAd, showAppOpenAd, trackAdOpportunity } from "./admob";
import { trackEvent } from "./analytics";

export const RESUME_AD_MIN_AWAY_MS = 40_000;
export const STARTUP_AD_DELAY_MS = 1500;

let startupAdChecked = false;
let backgroundedAt = 0;
let resumeHomeEpoch = 0;
let resumeWatcherInstalled = false;

const onStartScreen = () => window.location.pathname === "/" && document.visibilityState === "visible";

async function tryShowResumeAd() {
  if (!onStartScreen()) { trackAdOpportunity("appOpen", "resume", "skipped", "not_on_home"); return; }
  const epoch = resumeHomeEpoch;
  if (await showAppOpenAd(() => epoch === resumeHomeEpoch && onStartScreen(), "resume")) trackEvent("resume_ad");
}

function installResumeAdWatcher() {
  if (resumeWatcherInstalled) return;
  resumeWatcherInstalled = true;
  void (async () => {
    const { App } = await import("@capacitor/app");
    await App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        resumeHomeEpoch++;
        backgroundedAt = Date.now();
        if (window.location.pathname === "/") void preloadAppOpenAd("background");
        return;
      }
      const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
      backgroundedAt = 0;
      if (away < RESUME_AD_MIN_AWAY_MS) { if (away > 0) trackAdOpportunity("appOpen", "resume", "skipped", "away_too_short"); return; }
      void tryShowResumeAd();
    });
  })();
}

/** Call from Home's mount effect; returns cleanup. */
export function startHomeAds(): () => void {
  if (!isAdMobAvailable()) return () => { resumeHomeEpoch++; };
  installResumeAdWatcher();
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (!startupAdChecked) {
    void preloadAppOpenAd("startup");
    timer = setTimeout(async () => {
      if (startupAdChecked) return;
      startupAdChecked = true;
      if (await showAppOpenAd(() => !cancelled && onStartScreen(), "startup")) trackEvent("daily_startup_ad");
    }, STARTUP_AD_DELAY_MS);
  }
  return () => { cancelled = true; clearTimeout(timer); resumeHomeEpoch++; };
}
