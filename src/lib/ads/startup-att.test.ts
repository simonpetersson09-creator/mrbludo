import { describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ order: [] as string[], active: false, listener: null as null | ((s: { isActive: boolean }) => void) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true, isPluginAvailable: () => true } }));
vi.mock('./local-stats', () => ({ getRankedGames: () => 0 })); // fresh install: no match played
vi.mock('./analytics', () => ({ trackEvent: () => {} }));
vi.mock('@/lib/ads/analytics', () => ({ trackEvent: () => {} }));
vi.mock('@capacitor/app', () => ({ App: {
  getState: async () => ({ isActive: sdk.active }),
  addListener: async (_e: string, fn: (s: { isActive: boolean }) => void) => { sdk.listener = fn; return { remove: async () => {} }; },
} }));
let status = 'notDetermined';
vi.mock('@capacitor-community/admob', () => ({
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
  InterstitialAdPluginEvents: { Dismissed: 'd', FailedToShow: 'f' }, RewardAdPluginEvents: {},
  AdMob: {
    requestConsentInfo: async () => { sdk.order.push('ump'); return { canRequestAds: true }; },
    trackingAuthorizationStatus: async () => ({ status }),
    requestTrackingAuthorization: async () => { sdk.order.push('att'); status = 'denied'; },
    initialize: async () => { sdk.order.push('init'); },
    prepareInterstitial: async () => { sdk.order.push('ad_request'); },
    loadAppOpen: async () => { sdk.order.push('ad_request'); },
    addListener: async () => ({ remove: async () => {} }),
    getConsentEligibility: async () => ({ canRequestAds: true }),
  },
}));

describe('startup privacy (App Review 2.1)', () => {
  it('asks UMP then ATT on a fresh install only once the app is active, with no ad request', async () => {
    const m = await import('./admob');
    const p = m.requestStartupPrivacy();
    await new Promise(r => setTimeout(r, 10));
    expect(sdk.order).not.toContain('att'); // app inactive: waits
    sdk.active = true; sdk.listener?.({ isActive: true });
    await p;
    expect(sdk.order.slice(0, 3)).toEqual(['ump', 'att', 'init']);
    expect(sdk.order).not.toContain('ad_request');
  });
});
