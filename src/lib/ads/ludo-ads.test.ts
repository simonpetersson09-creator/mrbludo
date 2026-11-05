import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "ios", isNativePlatform: () => true, isPluginAvailable: () => true } }));

describe("Mr. B Ludo ad configuration", () => {
  it("uses Ludo's own iOS AdMob IDs", async () => {
    const { ADMOB_IDS } = await import("./admob");
    expect(ADMOB_IDS.ios).toEqual({
      appId: "ca-app-pub-7448540924654868~5267706252",
      appOpen: "ca-app-pub-7448540924654868/8436795076",
      optional: "ca-app-pub-7448540924654868/7239438484",
    });
  });
  it("uses Ludo's own Android IDs", async () => {
    const { ADMOB_IDS } = await import("./admob");
    expect(ADMOB_IDS.android).toEqual({
      appId: "ca-app-pub-7448540924654868~9915034875",
      appOpen: "ca-app-pub-7448540924654868/6723116515",
      optional: "ca-app-pub-7448540924654868/8690804307",
    });
  });
  it("puts Ludo's Android App ID in the manifest", () => {
    expect(readFileSync("android/app/src/main/AndroidManifest.xml", "utf8")).toContain("ca-app-pub-7448540924654868~9915034875");
  });
  it("has no banner units", async () => {
    const { BANNER_IDS } = await import("./admob");
    expect(BANNER_IDS).toEqual({ ios: null, android: null });
  });
  it("never uses Mr. B Yatzy's ad IDs anywhere in the app or scripts", () => {
    const yatzy = ["6494873071", "8707432437", "6422685490", "1382689760", "2605382885", "7786182090", "2816751438"];
    for (const file of ["src/lib/ads/admob.ts", "scripts/set-ios-admob-plist.js", "ios/App/App/Info.plist", "android/app/src/main/AndroidManifest.xml"]) {
      const text = readFileSync(file, "utf8");
      for (const id of yatzy) expect(text, `${file} contains ${id}`).not.toContain(id);
    }
  });
  it("puts Ludo's App ID in Info.plist", () => {
    expect(readFileSync("ios/App/App/Info.plist", "utf8")).toContain("ca-app-pub-7448540924654868~5267706252");
  });
  it("shows the return ad only after 40 seconds away", async () => {
    const { RESUME_AD_MIN_AWAY_MS } = await import("./home-ads");
    expect(RESUME_AD_MIN_AWAY_MS).toBe(40_000);
  });
});
