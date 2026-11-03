# Mr. B Ludo — native configuration audit, 3 November 2026

## Result
Source configuration is checked and corrected, **not certified production-ready**. No APK/AAB/IPA, signed archive, current packaged-offline run or physical-device test was produced in this audit. Nothing was published; no ads, purchases, login flow, new runtime permissions or push delivery was added.

## Already correct and preserved
- App display name Mr. B Ludo; Android/iOS version 1.0, build 1.
- Local `dist-native` startup with no Capacitor remote `server.url`; bundled game architecture unchanged.
- Android HTTPS-only/mixed-content protection, hardware acceleration and disabled app backup; iOS has no ATS insecure-load exception.
- iPhone portrait/landscape left/right; iPad all four orientations, device family 1,2. Existing orientations are retained rather than changed without device evidence.
- Existing viewport/safe-area handling, view-controller status bar appearance, scene lifecycle, auth refresh and network resume events.
- Existing Keychain/Keystore session adapter with no plaintext fallback. Normal restart/cache clearing requires device verification; reinstall/identifier changes do not promise identity recovery.
- Existing camera permission for match QR scanning; no additional permission or background mode.
- Custom icon/splash resources and copy pipeline. iOS App Store icon is 1024×1024 RGB, not an alpha image.
- Push and ad adapters remain disabled. No APNs key or signing credential was read, copied or added.

## Exact changes
| File | Change |
| --- | --- |
| `capacitor.config.ts` | Shared app ID changed to approved `com.simonpetersson.mrbludo`. |
| `ios/App/App.xcodeproj/project.pbxproj` | Debug/Release Bundle ID, approved team `F43HQMHCAT`, linked entitlements, Push capability; development APNs for Debug, production for Release. |
| `ios/App/App/App.entitlements` | New `aps-environment` build-setting substitution; no keys/tokens. |
| `ios/App/App/Info.plist` | All 40 actual UI languages declared; existing English development region retained. `no` uses native tag `nb`, European Portuguese uses `pt-PT`. |
| `android/app/build.gradle` | Namespace and application ID aligned with shared Capacitor ID. |
| `android/app/src/main/java/com/simonpetersson/mrbludo/MainActivity.java` | Moved from old package path and changed Java package. |
| `android/app/src/main/res/values/strings.xml` | Package/custom scheme identity aligned; display name unchanged. |
| `android/app/src/main/AndroidManifest.xml` | Linked Android 13+ language availability list; permissions unchanged. |
| `android/app/src/main/res/xml/locales_config.xml` | New list of 40 platform locale tags. |
| `ios/App/CapApp-SPM/Package.swift` | Connected the already installed QR-scanner package/product, missing from actual native references. |
| `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle` | Connected the same existing QR-scanner plugin. Capacitor regenerates these on a successful full sync. |
| `src/lib/i18n/language.ts` | Storage-read failures no longer break detection; Portuguese script+region tags map correctly. Manual-choice and existing fallback behavior preserved. |
| `src/lib/native/runtime.ts` | Removed competing native back listener that navigated/exited independently of the confirmation-aware AndroidBackButton. |
| `scripts/native.mjs` | Approved identity/team/entitlement checks; all six native plugins verified; explicit `--source-only` mode when packaged assets are absent. |
| `src/lib/i18n/language.test.ts` | Regional mapping, 40-language count, preferred-language order, manual persistence, unavailable storage and existing fallback tests. |
| `src/lib/native/config.test.ts`, `src/lib/native/runtime.test.ts` | Regression checks for identity, team, locales, push preparation, QR references and single back-event owner. |
| `docs/mobile-installation.md`, `docs/native-verification.md` | Updated installation identity, signing prerequisites and verification limits; historical results distinguished. |
| `AGENTS.md`, `roadmap.md`, this report | Recorded configuration invariants, task completion and blockers. |

Changing the app identifier on both platforms is needed to keep the shared Capacitor config coherent. An old test installation under `com.mrbgames.ludo` is a different app: its saved identity is not migrated automatically. No gameplay rules or online handlers were changed.

## Actual verification
- **83 automated tests in 20 files passed**, including the existing game, multiplayer, secure-storage and disabled-services tests.
- Preview's latest automatic build/typecheck: **build OK** after fixing a test mock's argument typing.
- `bun run native:verify --source-only`: passed. Capacitor core/CLI/iOS/Android 8.6.0, six plugin references, version 1.0 (1), approved identity/team checked.
- iOS plist/entitlements and Android manifest/locale XML parsed successfully; both lists map to exactly the 40 app dictionaries.
- `bunx cap ls ios` and `bunx cap ls android`: discover six existing plugins each.
- **Browser only:** fresh German-language context chose German; selected Japanese through the UI; reloaded and Japanese remained, with zero page errors. Screenshot inspected. This is not proof of WKWebView/Android system language propagation.
- Full `cap update` attempts failed because this sandbox has no `dist-native` package or synced Android plugin JSON. They did not demonstrate successful sync. Missing QR source references were corrected explicitly and regression-tested. Full `native:verify` still requires package generation and both syncs.

## Yatzy read-only comparison
Reference: actual snapshot commit `ec579335`; original never modified. Its `ios/` and `android/` directories are absent, so its real Info.plist, signing, entitlements and installed behavior cannot be compared.

Actual `scripts/set-ios-push.js` prepares `aps-environment` and links entitlements, and also adds token forwarding. Ludo reuses the preparation principle only: environment-specific entitlements/capability, **no new token forwarding or registration flow**. Existing team-scoped APNs-key suitability was authorized by the user, not verified against Apple's account; no key is needed for these configuration changes.

Yatzy's actual language mapper supplies the regional-alias pattern, but its unsupported-language default is English. Ludo retains its existing Swedish device fallback to avoid changing established behavior; translation lookup remains English → Swedish. English `CFBundleDevelopmentRegion` governs native fallback, not JavaScript dictionary fallback.

Yatzy's local bundle, icon copy, haptics and back principles remain the reference. Ludo keeps `dist-native`, its secure anonymous identity and shared server-authoritative rules. Yatzy's active ad/Firebase setup is not copied.

## Before TestFlight / Google Play
1. Build the real local package, run both syncs and full `native:verify` using the installation guide. Verify QR Swift package resolution against Capacitor 8 and native Android dependencies; source references alone do not prove compilation.
2. iOS requires Mac/Xcode and authorized access to team `F43HQMHCAT`. Register/reserve the Ludo App ID with Push capability; validate provisioning and final signed archive entitlements (production for TestFlight). No Apple-account read or signing validation was possible here.
3. Android requires JDK 21, Android SDK 36 and an independently supplied release-signing setup. Java/SDK/adb are absent here; no APK/AAB compilation occurred.
4. A separately approved deployed Ludo online-service address is still missing. Native online end-to-end tests cannot be completed against a nonexistent endpoint. This audit does not change online architecture.
5. Physical iPhone/Android: device language preferences and OS per-app language selection; manual choice after force-close; secure identity after restart/WebView cache clear; airplane-mode cold start; haptics toggle; back confirmation; QR permission/scanning; icon/splash/status bars/notches; iPad/phone rotations; background/foreground and Wi-Fi/mobile reconnect.
6. Validate merged permissions and SDK privacy manifests, App Store privacy / Play Data Safety disclosures, store language availability and store metadata against the final built artifacts. Source checks are not a store-compliance approval.

No unnecessary background mode or push permission request was added; preparing Push capability does not itself send notifications.