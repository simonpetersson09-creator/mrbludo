import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANGUAGES, mapTagToLanguage } from "../i18n/language";

const read = (path: string) => readFileSync(path, "utf8");
describe("approved native configuration", () => {
  it("uses com.simonpetersson.mrbludo consistently on both platforms", () => {
    expect(read("capacitor.config.ts")).toContain('appId: "com.simonpetersson.mrbludo"');
    expect(read("android/app/build.gradle")).toContain('applicationId "com.simonpetersson.mrbludo"');
    expect(read("ios/App/App.xcodeproj/project.pbxproj").match(/PRODUCT_BUNDLE_IDENTIFIER = com\.simonpetersson\.mrbludo;/g)).toHaveLength(2);
  });
  it("uses approved public Apple team F43HQMHCAT for Debug and Release", () => {
    expect(read("ios/App/App.xcodeproj/project.pbxproj").match(/DEVELOPMENT_TEAM = F43HQMHCAT;/g)).toHaveLength(2);
  });
  it("connects the existing QR scanner to iOS and Android", () => {
    expect(read("ios/App/CapApp-SPM/Package.swift")).toContain("node_modules/@capacitor/barcode-scanner");
    expect(read("android/capacitor.settings.gradle")).toContain("node_modules/@capacitor/barcode-scanner/android");
    expect(read("android/app/capacitor.build.gradle")).toContain("implementation project(':capacitor-barcode-scanner')");
  });
  it("declares all 40 actual UI languages on both platforms", () => {
    const plist = read("ios/App/App/Info.plist");
    const locales = plist.match(/<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? "";
    const iosTags = [...locales.matchAll(/<string>(.*?)<\/string>/g)].map(m => m[1]);
    const androidTags = [...read("android/app/src/main/res/xml/locales_config.xml").matchAll(/android:name="(.*?)"/g)].map(m => m[1]);
    const expected = LANGUAGES.map(l => l.code).sort();
    for (const tags of [iosTags, androidTags]) {
      expect(tags).toHaveLength(40);
      expect(tags.map(mapTagToLanguage).sort()).toEqual(expected);
    }
  });
  it("uses Xcode-build (development) and TestFlight/App Store (production) APNs environments without background modes", () => {
    const project = read("ios/App/App.xcodeproj/project.pbxproj");
    expect(project.match(/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g)).toHaveLength(2);
    expect(project).toContain("MRB_APNS_ENVIRONMENT = development;");
    expect(project).toContain("MRB_APNS_ENVIRONMENT = production;");
    expect(read("ios/App/App/App.entitlements")).toContain("$(MRB_APNS_ENVIRONMENT)");
    expect(read("ios/App/App/Info.plist")).not.toContain("UIBackgroundModes");
    expect(read("src/lib/native/services.ts")).toContain("registerOnLaunch: false");
  });
});