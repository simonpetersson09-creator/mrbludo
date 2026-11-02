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
- Ludo rules live in `src/lib/ludo/engine.ts` as pure functions (no React/DOM/network) so they can run on a server later; rendering only reads state.
- `src/components/dice-engine/` is copied read-only-sourced from Mr. B Yatzy; keep it presentation-only and never re-link it to Yatzy resources.
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
- AdMob and push remain inert adapter boundaries until activation is separately approved; no SDK initialization or permission request on launch.
- Temporary native diagnostics are build-time opt-in and accept only allowlisted event/status labels plus elapsed time; never collect errors, URLs, identities, request data or credentials, and never persist or upload diagnostics.
- Android back button (`src/components/AndroidBackButton.tsx` + pure `src/lib/native/back-policy.ts`) and haptics (`src/lib/native/haptics.ts`) are ports of Yatzy's equivalents; leaving a match via back never forfeits.
- App icon/splash source is `resources/icon.png`; `scripts/make-icons.mjs` regenerates committed `resources/`, and `scripts/set-native-icons.mjs` (run by native sync) overwrites Capacitor defaults, mirroring Yatzy's pipeline.
