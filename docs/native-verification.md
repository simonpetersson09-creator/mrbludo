# Mr. B Ludo — native readiness, 2 November 2026

## Implemented
- Packaged local Vite client in `dist-native`, using the existing TanStack Router tree and actual Ludo screens. Engine, computer opponent, all 40 languages, Inter/Space Grotesk fonts, game imagery and real 3D die ship locally. Capacitor has no remote `server.url`.
- Shared online handlers and validators behind both existing Start functions and `/api/public/native`; native transport uses a separately approved Ludo HTTPS origin, bearer verification and restricted CORS. No dice or game-rule change.
- Profile/friend-code/statistics display cache and last-online-match shortcut, all Ludo-namespaced; cached data is never authority for roles or leaderboard writes.
- Automatic anonymous Cloud identity at first launch, existing identity reuse, deduplicated initialization and authenticated server actions. Ordinary players have no registration, Google, email/password or sign-out controls.
- Separate `/admin-login` password form; admin data still requires a server-controlled role. No administrator was created or role assigned.
- Separate iOS and Android Capacitor 8 projects, both using the new `com.mrbgames.ludo` application identifier. No Yatzy application identifier, backend, key, signing certificate or production service file was copied. Identifier ownership/reservation in the stores is not verified.
- Native-only session client backed by iOS Keychain / Android Keystore plugin, with a Ludo-specific key; no plaintext fallback on storage failure. Web retains the managed preview client. Server token attachment uses the same client as the UI.
- Native foreground/background and connectivity listeners, auth refresh pause/resume, fresh match reads on return, Android back handling, and 3D canvas wake/context-loss recovery. Home/back never forfeits a match.
- Safe-area insets on all four edges and compact landscape layout. Android hardware acceleration explicitly enabled, cleartext networking disabled and app backups disabled. All 40 language dictionaries retained.
- Inert AdMob/push adapter boundaries only: no provider IDs, SDK initialization, permission requests, production advertisements, token registration or messages.
- `native:verify`, `native:sync:ios/android`, `native:open:ios/android`, `native:build:ios/android` commands.

## Actually verified here
- Anonymous sign-in enabled in Cloud; two fresh independent browser contexts entered online play without credentials, created/joined a private match and made a server-controlled roll.
- One player went offline, reconnected and reloaded the same match. A legal forfeit finished the match and both saw the winner. Both profiles retained personal friend codes and finished-match statistics after reload. This was a forfeit completion, not a four-pieces-home completion.
- Anonymous administrator access denied; successful privileged administrator login is not verified.
- 35 automated tests passed, including rules, server match logic, language parity, first-launch deduplication/identity preservation, native origin isolation, cached-role safety, match shortcut persistence, opt-in diagnostics privacy and disabled ads/push boundaries.
- Both platform projects generated and plugin sync succeeded. Native configuration checks verified identifiers, no supplied signing settings, Android acceleration and backup protection.
- Browser layout at 320×568, 393×706, 844×390, 768×1024 and 1024×768: controls in bounds, no horizontal overflow, live 3D canvas and no page errors. Screenshots inspected. Browser rendering is not proof of native GPU behavior.

## Yatzy reference and deliberate differences
Read-only snapshot commit `20c4a535`: Yatzy uses Capacitor 8, `webDir: dist`, a static Vite client with no configured remote server URL, iOS `contentInset: never`, local profile/session keys, device-bound server session claims, visualViewport sizing and the already copied presentation-only 3D die. Its platform sync scripts include extensive active AdMob/Firebase setup; those are not copied. Native platform directories were not available in this checkout, so their actual settings/build success could not be inspected. Resources and platform patch scripts were present.

Ludo now follows the same local-bundle/build-then-sync principle and visualViewport pattern. It retains TanStack Router/Start instead of Yatzy's React Router because the project's framework is fixed. Its native JSON transport shares the same server actions instead of importing Yatzy's server functions. Ludo retains server-verified anonymous Auth and Keychain/Keystore rather than replacing it with Yatzy's local session-ID scheme. No Yatzy keys, identifiers, service files or data were copied.

## Packaged-client browser checks
- First launch with network offline, local asset files served from the built package only: start local computer match, make real rolls/moves, load live 3D die, reload saved game and continue; no external gameplay requests and no page errors.
- Offline Japanese language switch survives reload; 40 dictionaries pass parity tests.
- Packaged layout passes small-phone, landscape and tablet checks. Cached profile/friend code display survives offline reload using an explicitly labeled test fixture; this is not proof of native secure identity persistence.
- Real authenticated anonymous native API profile/stats read passed; missing bearer returns 401. Capacitor preflight receives allowed CORS headers; unknown origins receive no allowed-origin header in the dev server. A full packaged-native online match against a published origin remains unverified.

## Website and build blockers
The prior URL check showed only Ludo's preview URL; no service deployment/address has been supplied or configured since. Nothing was published. Local offline installation needs no published website. `VITE_MRB_LUDO_ONLINE_ORIGIN` is separately configured, not derived from the WebView or website address, but `/api/public/native` still needs a deployed Ludo Start server. Independent configuration is not an independently deployed backend host. Never use the Cloud database host, Yatzy host or editor preview as that route's release endpoint.

Actual build attempts: Android stopped because Java/JAVA_HOME is missing (Android SDK is also absent); iOS stopped because xcodebuild is unavailable. Static package build, both Capacitor sync operations and native package verification passed. No APK, AAB or IPA was produced.

## Exact commands from a clean source checkout
See [the concise installation guide](mobile-installation.md) for complete prerequisites, temporary diagnostics and physical-device acceptance checks. The script now checks required native files, Capacitor/plugin parity, both platforms' app version 1.0 (1), and copied configuration/package freshness. This checks references, not Swift/Java compilation. No missing required references were confirmed in the source audit. Native artifacts exist locally after sync and are generated/ignored in a clean checkout.

Use Node 22+ and Bun; regenerate web assets before every sync.

```sh
bun install --frozen-lockfile
bun run test
bun run native:web
bun run native:sync:android
bun run native:sync:ios
bun run native:verify
```

For approved online service configuration, set `VITE_MRB_LUDO_ONLINE_ORIGIN` to the separately approved reachable Ludo service origin, then repeat `native:web` and sync. Leaving it unset creates an offline-capable package without an online endpoint; no fabricated URL is supplied.

Android with JDK 21+ and SDK/API 36 installed:
```sh
bun run native:build:android
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
Set JAVA_HOME and ANDROID_HOME to your installed toolchains (or SDK path in Android Studio). The debug APK is not a Play Store release.

iOS on Mac with Xcode installed:
```sh
bun run native:build:ios
bun run native:open:ios
```
The build command produces an unsigned simulator build. For a real iPhone, choose your own Apple team under Signing & Capabilities in Xcode, select the connected iPhone, and Run. An installable signed IPA requires that account/provisioning; no Yatzy team or certificate may be selected.

## External toolchains and physical tests still required
- iOS compilation needs a Mac, Xcode (Capacitor 8 requirements), signing/provisioning for device builds and the user's own Apple account. No IPA was produced.
- Android compilation needs compatible JDK/Android SDK and Android Studio or equivalent command-line tooling. No APK/AAB was produced; no release signing key exists here.
- Physical iPhone/Android: validate local Capacitor plugin bridging, Keychain/Keystore write/read/refresh after force-close, identity and match recovery, offline cold-start, suspension timing, Wi-Fi/mobile handover, status/system bars, notches, keyboard, rotation/tablets, Android dialog/back behavior, WebGL hardware acceleration/context restore and roll frame rate.
- Uninstall/reinstall and device migration are not identity recovery promises: losing secure storage can create a new anonymous identity. No cross-device recovery flow exists.
- Store compliance, native icons/splash artwork, privacy disclosures, consent flows for later ads/push, app identifiers reservation and release signing remain release work. Never enable live advertisements/push or submit to stores without approval.