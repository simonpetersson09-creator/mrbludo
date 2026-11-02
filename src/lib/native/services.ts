/** No SDK initialization, permission requests, IDs or delivery until separately approved. */
export const nativeServices = Object.freeze({
  advertising: { enabled: false, provider: "admob", appIds: null, unitIds: null },
  push: { enabled: false, registerOnLaunch: false },
});
export async function prepareAds() { return { enabled: nativeServices.advertising.enabled }; }
export async function preparePush() { return { enabled: nativeServices.push.enabled }; }