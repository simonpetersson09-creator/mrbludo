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
- Online play is server-authoritative: `src/lib/online/online.functions.ts` loads the match, applies `match-logic.ts` (which wraps the same engine as local play), and writes with an optimistic `version` check so concurrent/double actions fail instead of forking state.
- Dice for online matches are generated only on the server (`secureRoll`); clients never send die values.
- Match/stat/friend writes go through server functions with the admin client after auth; tables only expose member-scoped SELECT via RLS, so leaderboards can only be changed by finished online matches.
- Clients sync via realtime plus a 5 s heartbeat that also refetches and lets the server auto-play idle turns (30 s) and forfeit dropped players (90 s).
- i18n lives in `src/lib/i18n/`: `language.ts` (40 languages, detection, `mrb-ludo:v1:language` storage), `index.ts` (`t`/`useTranslation`, en→sv fallback, `errorMessage` for `err:*` server codes), `translations/*.ts` (sv.ts is the key source of truth; every dict must have identical keys and placeholders — enforced by `i18n.test.ts`, which also fails on unused/unknown keys).
- Server functions throw stable `err:<code>` strings instead of user-facing text; clients translate via `errorMessage()`.
