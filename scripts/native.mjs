import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
const [action = "verify", platform] = process.argv.slice(2);
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
try {
  if (action === "web") {
    run("bunx", ["vite", "build", "--config", "vite.native.config.ts"]);
  } else if (action === "verify") {
    const android = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    const gradle = readFileSync("android/app/build.gradle", "utf8");
    const ios = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    if (!gradle.includes('applicationId "com.mrbgames.ludo"') || !ios.includes("com.mrbgames.ludo")) throw new Error("Ludo app identity missing");
    if (!android.includes('android:hardwareAccelerated="true"') || !android.includes('android:allowBackup="false"')) throw new Error("Android acceleration/backup protection missing");
    if (/DEVELOPMENT_TEAM = [A-Z0-9]+;/.test(ios) || gradle.includes("signingConfigs")) throw new Error("Unexpected signing configuration");
    for (const file of ["capacitor.config.ts", "android/app/build.gradle", "ios/App/App.xcodeproj/project.pbxproj"]) {
      if (/ixzqnmocplgbsawuufsm|sb_secret_|SERVICE_ROLE_KEY/.test(readFileSync(file, "utf8"))) throw new Error("Forbidden production configuration");
    }
    console.log("Ludo identifiers, unsigned native projects, Android hardware acceleration and backup protection verified.");
    console.log("Mac/Xcode available:", existsSync("/Applications/Xcode.app"), "Android SDK configured:", !!(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT));
  } else if (["sync", "open", "build"].includes(action) && ["ios", "android"].includes(platform)) {
    run("bunx", ["cap", "sync", platform]);
    if (action === "open") run("bunx", ["cap", "open", platform]);
    if (action === "build" && platform === "android") run("bash", ["-c", "cd android && ./gradlew assembleDebug"]);
    if (action === "build" && platform === "ios") run("xcodebuild", ["-project", "ios/App/App.xcodeproj", "-scheme", "App", "-destination", "generic/platform=iOS Simulator", "CODE_SIGNING_ALLOWED=NO", "build"]);
  } else throw new Error("Use web, verify, sync ios|android, open ios|android or build ios|android");
} catch (error) { console.error(error.message); process.exit(1); }