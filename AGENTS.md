<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Mr. B Ludo architecture
- Board-only inks use separate `--board-*` tokens from piece `--ludo-*` colors, so board refinements cannot recolor pieces; decorative board SVG layers never receive pointer events.
- Legal destination overlays use engine `targetOf` and board `pieceCenter`, invoke the same piece action as piece taps, and animate visual waypoints without splitting authoritative moves; die tint and entry direction are presentation props only.
- Ludo rules live in `src/lib/ludo/engine.ts` as pure functions (no React/DOM/network) so they can run on a server later; rendering only reads state.
- Rule variants are `RULES` configs in the one engine, stored as optional `GameState.variant` (missing = classic) and `matches.variant`; quick play filters on it so modes never mix, keeping old saves and Classic behavior unchanged.
- Variant geometry uses `PATHS.trackLen` and board `trackOf`/`cellSizeOf`; Fia has a separate photo-derived grid fitted to the same canvas, so rules, rendering, AI and server capture calculations share variant-specific positions without changing Classic.
- `src/components/dice-engine/` is copied read-only-sourced from Mr. B Yatzy; keep it presentation-only and never re-link it to Yatzy resources.
- Vite strips preview `data-tsd-source` attributes only from dice-engine modules because Three.js objects cannot accept DOM source labels during updates.
- All browser storage keys use the `mrb-ludo:v1:` namespace to stay isolated from Yatzy.
- `noUncheckedIndexedAccess` is off: the board/engine index fixed-size arrays heavily.
- Online play is server-authoritative: shared `src/lib/online/online-actions.ts` handlers apply `match-logic.ts` and optimistic version writes; authenticated Start functions and the native API call those same handlers to avoid divergent rules.
- Dice for online matches are generated only on the server (`secureRoll`); clients never send die values.
- Match/stat/friend writes go through server functions with the admin client after auth; tables only expose member-scoped SELECT via RLS, so leaderboards can only be changed by finished online matches.
- Clients sync via realtime plus a 5 s heartbeat that also refetches and lets the server auto-play idle turns (30 s) and forfeit dropped players (90 s).
- i18n lives in `src/lib/i18n/`: `language.ts` (40 languages, detection, `mrb-ludo:v1:language` storage), `index.ts` (`t`/`useTranslation`, en→sv fallback, `errorMessage` for `err:*` server codes), `translations/*.ts` (sv.ts is the key source of truth; every dict must have identical keys and placeholders — enforced by `i18n.test.ts`, which also fails on unused/unknown keys).
- Server functions throw stable `err:<code>` strings instead of user-facing text; clients translate via `errorMessage()`.
- App-owned auth goes through `src/lib/auth/client.ts`: managed client on web, namespaced Keychain/Keystore storage on native; generated integration files remain untouched.
- Ordinary startup deduplicates anonymous sign-in and never discards a saved identity on storage/network failure; server middleware verifies every private request.
- Capacitor launches the `dist-native` static bundle built by `vite.native.config.ts`, reusing TanStack Router's generated tree and the actual local game screens; only the root and server transport are substituted, so cold-start local play needs no server.
- Packaged online actions use the authenticated `/api/public/native` JSON boundary with shared validators/handlers; the native service origin must be separately approved and cannot point at Yatzy or preview hosts.
- Fonts and local gameplay imagery are bundled; native viewport synchronization uses visualViewport after mount, following Yatzy's principle without importing preview-only globals.
- Native platform projects contain no release signing credentials; build scripts refuse preview/HTTP origins and never publish.
- Keep Capacitor, iOS and Android app identities aligned; the native verifier checks the approved public Apple team and environment-specific APNs entitlements, never private signing credentials.
- Native locale declarations map the 40 app dictionaries to platform tags (no → nb, pt → pt-PT); regression tests prevent platform language lists from drifting.
- AndroidBackButton is the only owner of native back events; lifecycle/network runtime must not install a competing back handler that bypasses confirmation.
- Ads are Yatzy's AdMob flow copied into `src/lib/ads/` (logic identical, only Ludo IDs; rewarded/banner IDs null) plus Yatzy's plugin patch scripts run on install/sync; push stays inert until approved.
- Temporary native diagnostics are build-time opt-in and accept only allowlisted event/status labels plus elapsed time; never collect errors, URLs, identities, request data or credentials, and never persist or upload diagnostics.
- Android back button (`src/components/AndroidBackButton.tsx` + pure `src/lib/native/back-policy.ts`) and haptics (`src/lib/native/haptics.ts`) are ports of Yatzy's equivalents; leaving a match via back never forfeits.
- App icon/splash source is `resources/icon.png`; `scripts/make-icons.mjs` regenerates committed `resources/`, and `scripts/set-native-icons.mjs` (run by native sync) overwrites Capacitor defaults, mirroring Yatzy's pipeline.
- Quick play mirrors Yatzy: 15 s search; ≥2 humans start online with server-played `bot:*` seats (never get stats, played via heartbeat); alone → local bot game.
- Profile pictures are small square JPEG data URLs kept in `profiles.avatar_image` (no storage bucket: this workspace blocks public ones), with the emoji in `profiles.avatar` as the fallback; the device copy drives the UI, and a device that has never seen the picture must adopt the server copy (`adoptOwnAvatarFromServer`) before it pushes, so a new device can never erase an existing picture.
- Friend requests follow Yatzy: only between players who shared an online match (sent from the result screen); there is no friend-code entry.
- Native invite links are parsed only by pure `src/lib/native/deep-link.ts` (own domain + `mrbludo://`; foreign hosts ignored).
- App errors and ad events reach the admin panel only via `src/lib/online/report.ts` → `app_events` (deduplicated, capped per session, short fields only; consent/tracking answers never leave the device).
- The published website is download-only: `src/server.ts` asks `src/lib/web-redirect.ts` (pure rules in `src/lib/web-access.ts`) to send browsers on the live origin to `/join`, so the game, admin panel and the app's own API stay reachable while visitors never become players; preview hosts and native origins must never be gated.
- A shared match code lives 6 hours (`CODE_TTL_MS`/`codeExpired` in `src/lib/online/match-logic.ts`): joining with a dead code closes the waiting match as abandoned instead of letting it sit open forever.
