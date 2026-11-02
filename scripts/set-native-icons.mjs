/**
 * Copy the committed Mr. B Ludo icons/splash over Capacitor's defaults.
 * Mirrors Mr. B Yatzy's set-android-icons.js + set-ios-icons.js. Idempotent.
 * Usage: node scripts/set-native-icons.mjs android|ios
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, resolve } from "path";

const platform = process.argv[2];
const R = resolve(process.cwd(), "resources");
function copyDir(src, dest) {
  if (!existsSync(src)) throw new Error(`${src} missing; run node scripts/make-icons.mjs`);
  mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const f of readdirSync(src)) { cpSync(join(src, f), join(dest, f), { recursive: true }); n++; }
  return n;
}
if (platform === "android") {
  const dest = resolve("android/app/src/main/res");
  if (!existsSync(dest)) throw new Error("android/ missing; run cap add android");
  let n = 0;
  for (const dir of readdirSync(join(R, "android", "res"))) n += copyDir(join(R, "android", "res", dir), join(dest, dir));
  console.log(`[Android icons] Copied ${n} Mr. B Ludo icon/splash files.`);
} else if (platform === "ios") {
  const cat = resolve("ios/App/App/Assets.xcassets");
  if (!existsSync(cat)) throw new Error("ios/ missing; run cap add ios");
  const n = copyDir(join(R, "ios", "AppIcon.appiconset"), join(cat, "AppIcon.appiconset"))
    + copyDir(join(R, "ios", "Splash.imageset"), join(cat, "Splash.imageset"));
  console.log(`[iOS icons] Copied ${n} Mr. B Ludo icon/splash files.`);
} else throw new Error("Use android or ios");
