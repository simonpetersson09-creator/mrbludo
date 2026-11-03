# Mr. B Ludo — mobile test installation

No publication, advertisements or push is part of these commands. Run commands from the source checkout root. Both apps are `com.simonpetersson.mrbludo`, version 1.0, build 1. iOS uses the approved public Apple Team ID `F43HQMHCAT`; no certificates or private keys are stored here. Changing the former identifier creates a distinct installed app; it does not migrate an old test installation's saved identity automatically.

## Shared prerequisites and offline package

Install Node.js 22+ and Bun (verified here: Node 22.23.4, Bun 1.4.4). Internet is needed to install dependencies and download native toolchain packages, not to run local Ludo afterward.

```sh
bun install --frozen-lockfile
bun run test
bun run native:web
```

The package contains the game, computer opponent, 40 languages, fonts, images and actual 3D die. No remote Capacitor `server.url` is used. Leave `VITE_MRB_LUDO_ONLINE_ORIGIN` unset for an offline-only test package. Rebuild and resync whenever sources or build flags change.

## Android

- JDK 21, JAVA_HOME pointing to it.
- Android Studio with Android SDK Platform 36, Platform Tools (`adb`) and compatible Build Tools. Configure ANDROID_HOME or `android/local.properties` with the installed SDK path.
- USB-connected Android 7/API 24 or newer; enable Developer options and USB debugging and approve the computer. Network is needed for first Gradle dependency resolution.
- The repository includes Gradle wrapper 8.14.3 and Android Gradle Plugin 8.13.0; do not substitute a global Gradle installation.

```sh
bun run native:sync:android
bun run native:build:android
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.simonpetersson.mrbludo/.MainActivity
```

The build produces a debug APK signed with your local Android debug key, not a Play Store release. On Windows, the script invokes `gradlew.bat`.

## iPhone

- Mac with a Capacitor 8-compatible Xcode installation, iOS SDK and command-line tools. Use Xcode 26+ for this test setup; exact Xcode/toolchain compatibility has not been exercised in this Linux environment.
- Run `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`, accept Xcode's license and complete first-launch setup. Swift Package Manager downloads Capacitor 8.6.0; CocoaPods is not used by this project's SPM setup.
- Connected iPhone with iOS 15+; trust the Mac and enable Developer Mode where required. Add an Apple account authorized for team `F43HQMHCAT` in Xcode. Register the Ludo App ID with Push Notifications capability and obtain its provisioning profile; no App Store release is required for development testing.

```sh
bun run native:sync:ios
bun run native:build:ios
bun run native:open:ios
```

`native:build:ios` attempts an unsigned simulator build, not an installable IPA. In Xcode verify target App → Signing & Capabilities → team `F43HQMHCAT` and Bundle ID `com.simonpetersson.mrbludo`, select the connected iPhone, then Product → Run. Debug prepares the development APNs environment; Release prepares production. Xcode archive/export must validate the final signed entitlements against the provisioning profile. No registration, permission request or push delivery is implemented by these settings.

After both syncs, `bun run native:verify` checks both platforms' files, versions, plugins and copied package. It does not compile Swift or Java.
Without a generated `dist-native` package, `bun run native:verify --source-only` checks only source configuration and plugin references; it does not establish sync/build readiness.

## Temporary diagnostics

Off by default; native-only; no upload or disk storage. To enable for a test build on macOS/Linux:

```sh
VITE_MRB_LUDO_NATIVE_DIAGNOSTICS=1 bun run native:web
bun run native:sync:android
bun run native:sync:ios
```

PowerShell: set `$env:VITE_MRB_LUDO_NATIVE_DIAGNOSTICS="1"` before `bun run native:web`. Then rebuild/install using the platform steps above.

Look for `[mrb-ludo:native]` in Android Studio Logcat/WebView console or the Xcode console/Safari Web Inspector. Only event/status/elapsed time is emitted; no session keys, player IDs, URLs, error messages or request bodies. History is capped at 100 rows in memory. Other OS/plugin logs are not governed by this filter: share only these diagnostic lines, not raw device logs. Detection begins when the app entry executes; native crashes or failure to load that entry still require OS tooling.

Disable by removing the environment flag (PowerShell: `Remove-Item Env:VITE_MRB_LUDO_NATIVE_DIAGNOSTICS`), rebuilding, syncing and reinstalling.

## Multiplayer address — independent configuration, not independent hosting

`VITE_MRB_LUDO_ONLINE_ORIGIN` is explicitly configured and never derived from the WebView URL or marketing/web publication address. The JSON multiplayer route is `/api/public/native` on Ludo's deployed Start server; Cloud Auth/data/realtime use Ludo's own backend configuration. Native requests require server-verified bearer credentials, HTTPS and restricted local-native CORS. No Yatzy resources are used.

There is **no deployed independent native-service host configured** today. A separate variable does not make that route available without a server deployment. Do not set it to the database host (which does not serve the Start route), Yatzy or an editor preview. A separately approved reachable Ludo service deployment/address is needed for native online tests. Nothing has been published in this task.

## Physical-device acceptance checklist (not performed here)

1. Airplane mode: cold-start, computer game, real die, language switch, force-close, reopen and continue saved game.
2. Online enabled only after approved service setup: same anonymous identity/friend code survives force-close; two physical players create/join a match.
3. Background/foreground, Wi-Fi/mobile handover, reconnect, legal moves and exactly one server roll after double tap.
4. Inspect safe areas, keyboard, rotation, Android Back, die frame rate and WebView/context recovery.
5. No ad SDK initialization, push permission or notification request.