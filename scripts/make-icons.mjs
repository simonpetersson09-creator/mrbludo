/**
 * Regenerate every Mr. B Ludo launcher icon and splash from resources/icon.png.
 * Ported from Mr. B Yatzy's scripts/make-icons.js (same sizes and formats).
 * Ludo addition: splash images (Yatzy keeps Capacitor's default splash).
 *
 * Usage: node scripts/make-icons.mjs [new-source.png]   (needs ImageMagick 7)
 * Outputs (committed):
 *   resources/android/res/**   legacy + round + adaptive foreground, mdpi..xxxhdpi, splash
 *   resources/ios/AppIcon.appiconset/**, resources/ios/Splash.imageset/**
 *   public/{app-icon-1024,app-icon,apple-touch-icon,favicon}.png
 * scripts/set-native-icons.mjs copies them into android/ and ios/ after cap sync.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";

const ROOT = process.cwd();
const MASTER = join(ROOT, "resources", "icon.png");
const ANDROID_RES = join(ROOT, "resources", "android", "res");
const IOS = join(ROOT, "resources", "ios");
const PUBLIC = join(ROOT, "public");
const BG = "#06262B"; // Ludo dark teal

const run = (args) => execFileSync("magick", args, { stdio: "inherit" });

function render(src, out, size, { circle = false, alpha = false } = {}) {
  mkdirSync(dirname(out), { recursive: true });
  const args = [src, "-colorspace", "sRGB", "-resize", `${size}x${size}`];
  if (circle) {
    const c = size / 2;
    args.push("(", "-size", `${size}x${size}`, "xc:none", "-fill", "white", "-draw", `circle ${c},${c} ${c},0`, ")", "-compose", "DstIn", "-composite");
  }
  args.push(...(alpha ? ["-alpha", "set"] : ["-alpha", "off"]), out);
  run(args);
}

/** Icon centred on the brand background, ~38% of the shorter side. */
function splash(out, w, h) {
  mkdirSync(dirname(out), { recursive: true });
  const s = Math.round(Math.min(w, h) * 0.38);
  run(["-size", `${w}x${h}`, `xc:${BG}`, "(", MASTER, "-resize", `${s}x${s}`, ")", "-gravity", "center", "-composite", "-alpha", "off", "-depth", "8", out]);
}

const source = process.argv[2];
if (source) {
  mkdirSync(dirname(MASTER), { recursive: true });
  run([resolve(ROOT, source), "-colorspace", "sRGB", "-resize", "1024x1024!", "-alpha", "off", MASTER]);
}
if (!existsSync(MASTER)) { console.error("[icons] resources/icon.png missing."); process.exit(1); }

// Android
rmSync(ANDROID_RES, { recursive: true, force: true });
const DENSITIES = [["mdpi", 48, 1], ["hdpi", 72, 1.5], ["xhdpi", 96, 2], ["xxhdpi", 144, 3], ["xxxhdpi", 192, 4]];
for (const [dpi, size, scale] of DENSITIES) {
  const dir = join(ANDROID_RES, `mipmap-${dpi}`);
  render(MASTER, join(dir, "ic_launcher.png"), size);
  render(MASTER, join(dir, "ic_launcher_round.png"), size, { circle: true, alpha: true });
  render(MASTER, join(dir, "ic_launcher_foreground.png"), Math.round(size * 2.25), { alpha: true });
  splash(join(ANDROID_RES, `drawable-port-${dpi}`, "splash.png"), Math.round(320 * scale), Math.round(480 * scale));
  splash(join(ANDROID_RES, `drawable-land-${dpi}`, "splash.png"), Math.round(480 * scale), Math.round(320 * scale));
}
splash(join(ANDROID_RES, "drawable", "splash.png"), 480, 320);
mkdirSync(join(ANDROID_RES, "values"), { recursive: true });
writeFileSync(join(ANDROID_RES, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);

// iOS icons (same table as Yatzy)
const SET = join(IOS, "AppIcon.appiconset");
rmSync(SET, { recursive: true, force: true });
mkdirSync(SET, { recursive: true });
const IOS_ICONS = [
  [20, 2, "iphone"], [20, 3, "iphone"], [29, 2, "iphone"], [29, 3, "iphone"], [40, 2, "iphone"], [40, 3, "iphone"],
  [60, 2, "iphone"], [60, 3, "iphone"], [20, 1, "ipad"], [20, 2, "ipad"], [29, 1, "ipad"], [29, 2, "ipad"],
  [40, 1, "ipad"], [40, 2, "ipad"], [76, 1, "ipad"], [76, 2, "ipad"], [83.5, 2, "ipad"],
];
const images = [];
for (const [pt, scale, idiom] of IOS_ICONS) {
  const name = `icon_${pt}x${pt}@${scale}x.png`;
  render(MASTER, join(SET, name), Math.round(pt * scale));
  images.push({ size: `${pt}x${pt}`, idiom, scale: `${scale}x`, filename: name });
}
render(MASTER, join(SET, "icon_1024x1024@1x.png"), 1024);
images.push({ size: "1024x1024", idiom: "ios-marketing", scale: "1x", filename: "icon_1024x1024@1x.png" });
writeFileSync(join(SET, "Contents.json"), JSON.stringify({ images, info: { version: 1, author: "xcode" } }, null, 2) + "\n");

// iOS splash (same file names Capacitor's template uses)
const SPL = join(IOS, "Splash.imageset");
rmSync(SPL, { recursive: true, force: true });
const splashFiles = ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"];
for (const f of splashFiles) splash(join(SPL, f), 2732, 2732);
writeFileSync(join(SPL, "Contents.json"), JSON.stringify({
  images: splashFiles.map((filename, i) => ({ idiom: "universal", filename, scale: `${i + 1}x` })),
  info: { version: 1, author: "xcode" },
}, null, 2) + "\n");

// Web copies
render(MASTER, join(PUBLIC, "app-icon-1024.png"), 1024);
render(MASTER, join(PUBLIC, "app-icon.png"), 512);
render(MASTER, join(PUBLIC, "apple-touch-icon.png"), 180);
render(MASTER, join(PUBLIC, "favicon.png"), 64);
console.log("[icons] Mr. B Ludo icons and splash regenerated.");
