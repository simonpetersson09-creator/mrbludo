# Mr. B Ludo — native readiness, 2 November 2026

## Implemented
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
- 29 automated tests passed, including rules, server match logic, language parity, first-launch deduplication/identity preservation and disabled ads/push boundaries.
- Both platform projects generated and plugin sync succeeded. Native configuration checks verified identifiers, no supplied signing settings, Android acceleration and backup protection.
- Browser layout at 320×568, 393×706, 844×390, 768×1024 and 1024×768: controls in bounds, no horizontal overflow, live 3D canvas and no page errors. Screenshots inspected. Browser rendering is not proof of native GPU behavior.

## Blocking a runnable phone build
This is a TanStack Start server application, not a static offline bundle. The initial Capacitor shell loads an explicitly configured stable, published Ludo HTTPS origin. No such approved published origin exists yet; the bundled shell intentionally does not pretend to be the game. Nothing was published. Set `MRB_LUDO_NATIVE_ORIGIN` after separate website publication approval; sync/build refuse missing, HTTP, preview and Yatzy origins. The remote shell cannot cold-start the game offline. A bundled offline game is a separate remaining implementation.

## External toolchains and physical tests still required
- iOS compilation needs a Mac, Xcode (Capacitor 8 requirements), signing/provisioning for device builds and the user's own Apple account. No IPA was produced.
- Android compilation needs compatible JDK/Android SDK and Android Studio or equivalent command-line tooling. No APK/AAB was produced; no release signing key exists here.
- Physical iPhone/Android: validate plugin bridging from the configured HTTPS origin, Keychain/Keystore write/read/refresh after force-close, identity and match recovery, suspension timing, Wi-Fi/mobile handover, status/system bars, notches, keyboard, rotation/tablets, Android dialog/back behavior, WebGL hardware acceleration/context restore and roll frame rate.
- Uninstall/reinstall and device migration are not identity recovery promises: losing secure storage can create a new anonymous identity. No cross-device recovery flow exists.
- Store compliance, native icons/splash artwork, privacy disclosures, consent flows for later ads/push, app identifiers reservation and release signing remain release work. Never enable live advertisements/push or submit to stores without approval.