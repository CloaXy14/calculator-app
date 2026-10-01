# Change report — calculator-app, run 2026-10-01 (2)

Mode: shadow (not committed) · Runbook: `~/.agent-team/RUNBOOK.md` · Status: success

## Summary

Scientific mode is now a separate calculator modelled on the Casio fx-991ES PLUS in LineIO display mode: formula entry on a two-line LCD, the fx-991ES key layout with SHIFT (gold) and ALPHA (red) functions, cursor editing, replay and history, variables, CALC, SOLVE, ∫, d/dx, Σ, fractions, sexagesimal, ENG, SETUP and CLR menus, and Casio error screens. Standard mode stays a desk calculator. Expected values were taken from the worked examples in Casio's fx-991ES PLUS User's Guide before the engine was written.

## Added

- `src/casio/`: `tokens.ts` (one key = one token), `parser.ts` (fx-991ES priority sequence), `evaluate.ts` (functions, Gauss–Kronrod ∫, d/dx, Σ, Pol/Rec, Newton SOLVE), `engine.ts` (key state machine and display view), `useCasio.ts` (hook and keyboard).
- `CasioKeypad.tsx`, `CasioDisplay.tsx`; scientific keys use the standard calculator's cream case, key faces and accent colours.
- Keyboard typing in scientific mode shows the matching on-screen key pressed, like standard mode (SHIFT combinations such as `%` show the main key).
- `math.ts`: grads (Gra), angle conversion, polar angle, Norm 1/2, Fix, Sci, ENG, fraction, DMS and prime-factor renderers.
- Tests: 75 → 121. 51 engine tests replay Casio manual examples (for example 4 × sin 30 × (30 + 10 × 3) = 120, 2⌟3 + 1⌟2 = 7⌟6, ∫(ln X, 1, e) = 1, SOLVE y = ax² + b).
- `vitest.stryker.config.ts`: mutation runs use logic tests only (a full run with UI tests took 65 min).

## Changed (old → new expectation, with reason)

- Switching modes kept one shared calculation → each mode keeps its own calculation (the scientific mode is a separate machine, like a real Casio).
- Scientific features moved out of `useCalculator` into `src/casio/`. Their old reducer tests (postfix sin, SHIFT/HYP toggles, Ans/memory actions, % add-on) were replaced by engine tests with Casio semantics. Casio % is "÷100" (150 × 20% = 30), not the add-on percent of the previous version.
- Default angle unit RAD → DEG (Casio default).

## Removed

None of the existing behavior tests of standard mode. The previous run's scientific reducer tests were replaced, as listed under Changed.

## Numbers

| Metric | Before | After |
|---|---|---|
| Tests | 75 | 122 |
| Line coverage | 99.1% | 98.3% |
| Branch coverage | 96.6% | 95.0% |
| Mutation score, full run (all logic files) | 92.1% (2 files) | 87.2% (7 files, round 1) |
| Mutation score, round 2 (math, parser, evaluate) | — | 95.0% (math 89.2, parser 98.4, evaluate 97.9) |

## Not done

- Natural Textbook display (MathIO: stacked fractions, √ forms). LineIO is a real fx-991ES setting and is what this emulates.
- Modes other than COMP: STAT, CMPLX, BASE-N, EQN, MATRIX, TABLE, VECTOR, and CONST/CONV. Their key legends are printed faded.
- Deliberate deviations kept from the earlier request: 30 displayed digits (Casio: 10) and range 1e±9999 (Casio: 1e±99). ∫ and d/dx are shown to 10 digits like the real calculator.
- Round 2 of mutation testing was not run on `engine.ts` and `useCalculator.ts` (65-minute run); their round-1 scores are 87.7% and 91.8%.
- Not checked on a phone.

## Bugs found

None outside the requested change.
