import type { CapacitorConfig } from "@capacitor/cli";

// Build tooling only. No preview URL, credentials, signing identities or Yatzy IDs.
const origin = process.env["MRB_LUDO_NATIVE_ORIGIN"];
if (origin) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || /localhost|id-preview|yatzy/i.test(url.hostname)) {
    throw new Error("Use a stable, published Mr. B Ludo HTTPS origin only");
  }
}
const config: CapacitorConfig = {
  appId: "com.mrbgames.ludo",
  appName: "Mr. B Ludo",
  webDir: "native-shell",
  ...(origin ? { server: { url: origin, cleartext: false, allowNavigation: [new URL(origin).hostname] } } : {}),
  ios: { contentInset: "never" },
  android: { allowMixedContent: false },
  plugins: { StatusBar: { style: "DARK" } },
};
export default config;