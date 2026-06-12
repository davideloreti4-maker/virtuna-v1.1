# Phase 02 — Deferred Items (out-of-scope discoveries)

Logged during execution; NOT fixed (outside the current plan's task scope).

## Pre-existing tsc errors (baseline, unrelated to 02-03)

Discovered while running `pnpm exec tsc --noEmit` during 02-03. All predate this plan
and live in files this plan does not touch:

| File | Error | Note |
|------|-------|------|
| `src/lib/engine/wave3/__tests__/fold-schema.test.ts` (65/90/100) | TS2532 Object possibly undefined | engine test, FROZEN engine surface — do not edit |
| `tests/numen/stage-reveal.test.ts` (50/65) | TS2769 overload / missing props | Phase 01 DS test |
| `tests/numen/tokens.test.ts` (143) | TS2532 Object possibly undefined | Phase 01 DS test |
| `src/lib/reading/__tests__/{identical-render,verdict,view-model}.test.ts` | TS2307 Cannot find module `../view-model` | EXPECTED — view-model is built in 02-04 (RED scaffolds from 02-01) |

The `../view-model` errors resolve when 02-04 builds the module. The others are
pre-existing and belong to their owning phases.
