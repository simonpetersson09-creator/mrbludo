import type { CapacitorConfig } from "@capacitor/cli";

// Same local-bundle principle as Yatzy, with an entirely separate Ludo identity.
const config: CapacitorConfig = {
  appId: "com.simonpetersson.mrbludo",
  appName: "Mr. B Ludo",
  webDir: "dist-native",
  ios: { contentInset: "never" },
  android: { allowMixedContent: false },
  plugins: { StatusBar: { style: "DARK" } },
};
export default config;