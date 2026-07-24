# Ambient v2 Rail — Session Handoff (2026-07-23)

Branch `design/ambient-audience-v2` · worktree `~/virtuna-ambient-audience-v2` · dev **:3007**
(launch with `NEXT_PUBLIC_AMBIENT_V2=true` — the rail is flag-gated).
All commits below are **pushed**, **none PR'd to main yet**.

## What shipped this session (commits `0f15c829` → `e6751727`)

| Commit | What |
|---|---|
| `0f15c829` | Phase C — real Brain-depth adapter (`ambient-v2-brain.ts`, pure mapper, no new fold) |
| `570cdb59` | Live Brain-adapter preview on `/ambient-v2` |
| `d134c4f5` | Persist the video Brain seal at Test time (foundation — writer before reader) |
| `fbad5319` | **Video reader** — tested videos in the unified Overview rank: native **viral score** + attention **%** revealed on Simulate (reuses the persisted read, no new producer); Brain-first drill |
| `79281120` | Persistent Simulate cue on touch + video rows in the Overview preview fixture |
| `a744083a` | Make the queued-row Simulate cue **persistent** (not hover-only) |
| `23d4bcd4` | Float the rail panel + **config-before-run** Simulate order |
| `87d1a3ce` | **Connected** full-height rail (reverted the floating card, kept `#181817`) |
| `9145429d` | Sealed-row click shows a RESULT + wider rail + connected config panel |
| `e6751727` | **Remove the ad-hoc SealResult** — only the real Population/Brain pages ever render |

## Current rail behaviour (verified live via Playwright, test user `e2e-test@virtuna.local`)

- **Rail** = connected, full-height, flush to the page's right edge, `#181817`, 400px wide, left hairline
  divider. (Layout: `home-page-layout.tsx` aside `w-[400px]`, thread row is `flex-row` — NOT
  `justify-center` — so the work column flexes and the rail sits flush right.)
- **Queued (un-run) row** → tap opens the **ARM config panel** (connected in-rail via `AmbientSimulate`
  `connected` prop). Its "Simulate ↑" fires the real `/api/tools/react` sim. Config → run order.
- **Persistent "Simulate →" cue** under every queued row (all devices, no hover gate).
- **Video row** → shows its native **viral score**; tap reveals the already-measured attention %
  (no re-run); revealed → drills into the real **Brain** page.
- **Sealed row (calibrated)** → the real **Population** page (`AmbientDetail`).
- **Sealed row (General/uncalibrated)** → currently **INERT** (the % on the row is the result).
  ← this is what the next task changes.

## Gates (all green at session end)
`tsc 0 · eslint 0 · matte 38 · rail 7 · adapters 11`. Tests run with
`node ./node_modules/vitest/vitest.mjs run <paths>` (NOT `npm test` — see repo notes).

## NEXT TASK (owner-decided, do in the fresh session) — General = a real generic audience

**Decision:** General must produce the SAME Population page as calibrated. The split (verdict-only on
General) was rejected as confusing for new users. See memory `ambient-v2-general-population.md`.

**Blocker (verified):** `signatureHasPopulationAxes` (`src/lib/audience/population.ts:149`) needs
`signature.audience.topic_vocab` + ≥1 persona with a `reaction` object; `GENERAL_AUDIENCE`
(`src/lib/audience/audience-repo.ts:39`) has `personas: []` and no axes, so `react`
(`src/app/api/tools/react/route.ts:160`) sets `population: null`.

**Plan:**
1. Author a generic baseline `AudienceSignature` for General — 10 personas with HONEST baseline
   `reaction` axes (`interests`, `hookSensitivity`, `noveltyBias`, `skepticism`, `attentionSpan`, all
   0..1) + a generic `topic_vocab`. Sensible baseline, not random.
2. Wire the signature resolver so General resolves *with* that signature (start
   `resolve-thread-audience.ts` / `resolve-user-audience.ts`; react reads `audience.signature`).
3. `react` then computes a real generic population → the Population page renders for General.
4. Remove the population-gate in `openStimulus` (`AmbientOverviewRail.tsx`) so a General sealed row
   drills into `AmbientDetail` like any other.

**Hold the tension:** calibrated audience is the moat — the generic baseline must still leave a reason
to calibrate (calibration = YOUR people). UI already labels General "BASELINE".

## Also open (not started)
- Open a PR for the whole branch to main once the General work + any further owner feedback lands.
- Owner has additional feedback to add before the fresh session executes.
