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
