import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
const [action = "verify", platform] = process.argv.slice(2);
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) { console.error(`${command} is unavailable: ${result.error.message}`); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
function requireFiles(paths) {
  const missing = paths.filter(path => !existsSync(path));
  if (missing.length) throw new Error(`Missing required native files: ${missing.join(", ")}`);
}
try {
  if (action === "web") {
    const origin = process.env.VITE_MRB_LUDO_ONLINE_ORIGIN;
    if (origin) {
      const parsed = new URL(origin);
      if (parsed.protocol !== "https:" || /localhost|id-preview|yatzy/i.test(parsed.hostname) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("Only the separately approved published Ludo HTTPS origin may be bundled");
    }
    run("bunx", ["vite", "build", "--config", "vite.native.config.ts"]);
  } else if (action === "verify") {
    requireFiles(["bun.lock", "android/gradlew", "android/gradlew.bat", "android/gradle/wrapper/gradle-wrapper.jar", "android/gradle/wrapper/gradle-wrapper.properties", "android/settings.gradle", "android/capacitor.settings.gradle", "android/app/capacitor.build.gradle", "android/app/src/main/java/com/mrbgames/ludo/MainActivity.java", "ios/App/App/AppDelegate.swift", "ios/App/App/SceneDelegate.swift", "ios/App/App/Info.plist", "ios/App/App/Base.lproj/Main.storyboard", "ios/App/App/Base.lproj/LaunchScreen.storyboard", "ios/App/CapApp-SPM/Package.swift", "ios/debug.xcconfig"]);
    const capacitorPackages = ["core", "cli", "android", "ios"].map(name => JSON.parse(readFileSync(`node_modules/@capacitor/${name}/package.json`, "utf8")).version);
    if (new Set(capacitorPackages).size !== 1 || capacitorPackages[0] !== "8.6.0") throw new Error("Capacitor core/CLI/platform version mismatch; use bun install --frozen-lockfile");
    const spm = readFileSync("ios/App/CapApp-SPM/Package.swift", "utf8");
    for (const plugin of ["@capacitor/app", "@capacitor/network", "@capacitor/status-bar", "capacitor-secure-storage-plugin"]) {
      requireFiles([`node_modules/${plugin}/package.json`, `node_modules/${plugin}/Package.swift`]);
      if (!spm.includes(`node_modules/${plugin}`)) throw new Error(`iOS plugin missing: ${plugin}; run native:sync:ios`);
    }
    const config = readFileSync("capacitor.config.ts", "utf8");
    if (!config.includes('webDir: "dist-native"') || config.includes("server:")) throw new Error("Native app must launch the packaged game, not a remote website");
    if (!existsSync("dist-native/index.html")) throw new Error("Run bun run native:web first");
    const files = readdirSync("dist-native/assets");
    if (!files.some(f => f.endsWith("woff2")) || !files.some(f => f.startsWith("DiceScene"))) throw new Error("Bundled fonts or 3D die missing");
    for (const file of files.filter(f => /\.(js|html|css)$/.test(f))) {
      // The auth SDK contains a literal prefix detector; reject real keys, not that detector.
      if (/ixzqnmocplgbsawuufsm|sb_secret_[A-Za-z0-9_-]{12,}|supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/.test(readFileSync(`dist-native/assets/${file}`, "utf8"))) throw new Error("Forbidden backend configuration in native package");
    }
    const android = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    const gradle = readFileSync("android/app/build.gradle", "utf8");
    const ios = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    if (!gradle.includes('applicationId "com.mrbgames.ludo"') || !ios.includes("com.mrbgames.ludo")) throw new Error("Ludo app identity missing");
    if (!gradle.includes('versionCode 1') || !gradle.includes('versionName "1.0"') || (ios.match(/CURRENT_PROJECT_VERSION = 1;/g) || []).length !== 2 || (ios.match(/MARKETING_VERSION = 1.0;/g) || []).length !== 2) throw new Error("Android/iOS app versions differ");
    if (!spm.includes('exact: "8.6.0"')) throw new Error("iOS Capacitor package version differs");
    for (const path of ["android/app/src/main/assets", "ios/App/App"]) {
      requireFiles([`${path}/public/index.html`, `${path}/capacitor.config.json`]);
      const synced = JSON.parse(readFileSync(`${path}/capacitor.config.json`, "utf8"));
      if (synced.appId !== "com.mrbgames.ludo" || synced.server?.url) throw new Error("Synced native configuration loads wrong identity or remote website");
      if (readFileSync(`${path}/public/index.html`, "utf8") !== readFileSync("dist-native/index.html", "utf8")) throw new Error("Synced package is stale; repeat native:sync");
    }
    if (!android.includes('android:hardwareAccelerated="true"') || !android.includes('android:allowBackup="false"')) throw new Error("Android acceleration/backup protection missing");
    if (/DEVELOPMENT_TEAM = [A-Z0-9]+;/.test(ios) || gradle.includes("signingConfigs")) throw new Error("Unexpected signing configuration");
    for (const file of ["capacitor.config.ts", "android/app/build.gradle", "ios/App/App.xcodeproj/project.pbxproj"]) {
      if (/ixzqnmocplgbsawuufsm|sb_secret_|SERVICE_ROLE_KEY/.test(readFileSync(file, "utf8"))) throw new Error("Forbidden production configuration");
    }
    console.log("Required native files, Capacitor 8.6.0 plugins, app version 1.0 (1), synced local package, isolated identities and unsigned settings verified. This is not a native compilation.");
    console.log("Mac/Xcode available:", existsSync("/Applications/Xcode.app"), "Android SDK configured:", !!(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT));
  } else if (["sync", "open", "build"].includes(action) && ["ios", "android"].includes(platform)) {
    if (!existsSync("dist-native/index.html")) throw new Error("Run bun run native:web before sync or build");
    run("bunx", ["cap", "sync", platform]);
    if (action === "open") run("bunx", ["cap", "open", platform]);
    if (action === "build" && platform === "android") run("bash", ["-c", "cd android && ./gradlew assembleDebug"]);
    if (action === "build" && platform === "ios") run("xcodebuild", ["-project", "ios/App/App.xcodeproj", "-scheme", "App", "-destination", "generic/platform=iOS Simulator", "CODE_SIGNING_ALLOWED=NO", "build"]);
  } else throw new Error("Use web, verify, sync ios|android, open ios|android or build ios|android");
} catch (error) { console.error(error.message); process.exit(1); }