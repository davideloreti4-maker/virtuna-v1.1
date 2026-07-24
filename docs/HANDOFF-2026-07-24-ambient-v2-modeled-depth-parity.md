# Handoff — Ambient v2: modeled-depth parity + live-adapter accuracy pass (2026-07-24)

**Branch:** `design/ambient-audience-v2` · **all work MERGED to main** (tip `aa05c2ad`).
**Predecessor:** `docs/HANDOFF-2026-07-24-ambient-v2-general-brain-start.md` (PR #377 — General population + Start audience + text Brain + detail surface).

---

## TL;DR

The Ambient v2 Detail drill (`AmbientDetail`) rendered a **much thinner instrument** on the LIVE
video adapter and every text sim than the hand-authored fixture, because the optional
"Sapient-depth" sections had no real producers and were silently dropped
(`{brain.signalGrid ? … : null}`). Owner call: **render 100% complete, the same for video AND text.**

This session built the modeled producers so both paths render the full instrument, then did an
accuracy pass so the LIVE adapter matches the authored page section-for-section.

**3 PRs, all merged:**
| PR | Merge | What |
|----|-------|------|
| #378 | `785d2383` | Full Brain + Population parity (video + text) via new `ambient-v2-modeled.ts` |
| #378 | `6e96e725` | Humanize pStop reason tokens in Population voices |
| #379 | `aa05c2ad` | Live-adapter accuracy pass (buyIntent · locale · signal spread · TEXT-sim toggle) |

---

## The architecture (don't re-derive)

- **`AmbientDetail`** = the Detail instrument. Two tabs, both driven by a `DomainTemplate`:
  - **Brain** (`BrainFrame`/`BrainTab.tsx`) = *why* — cortex + driver axis + signal decomposition + networks + unlock + calibration line.
  - **Population/Audience** (`AudienceTab`) = *who / how many* — terrain + tri-state + audienceFit + amplification + voices + swing + room.
- **`DomainTemplate`** (`domain-template.ts`) is the platform contract. Sections are OPTIONAL fields; the render guards each (`{x ? <X/> : null}`). Add-a-domain = one template + figures, never a fork.
- **Two reference builds on `/ambient-v2`** (dev fixture page, flag-gated):
  - **authored** = `CREATOR_TEMPLATE` (`detail-fixture.ts`) — hand-authored to the full round-4 design. The aspirational target.
  - **live adapters** = the output of the real mapper functions over realistic inputs. The honest "what ships today" surface.

### The producers (all pure, deterministic, SSR-safe — no `Math.random`)

| File | Function | Feeds |
|------|----------|-------|
| `src/lib/surfaces/ambient-v2-brain.ts` | `buildBrainFrameData` / `buildVideoDomainTemplate` | VIDEO Brain (real fold `weighted_curve` + `GeminiVideoSignals` craft dims + verbatim) |
| `src/lib/surfaces/ambient-v2-population.ts` | `buildPopulationFrameData` · `buildReasonBrainFrameData` · `buildDomainTemplate` | Population (both) + TEXT Brain (real pStop reason tally) |
| `src/lib/surfaces/ambient-v2-modeled.ts` | **NEW** — the modeled-depth producers | signalGrid · networkBars · networks · kpiHeatmap · buyIntent · unlock · audienceFit · amplification · swing |

---

## What shipped

### PR #378 — full parity (video + text)

New **`src/lib/surfaces/ambient-v2-modeled.ts`** — one pure modeled producer per previously-omitted
section, each derived from the REAL data a sim already has (sealed stopPct · fold curve · craft dims ·
segment stop rates · pStop reason tokens). String-seeded FNV+LCG → byte-identical server/client.

Wired into all three builders (video Brain, text Brain, shared Population) + both template builders
(unlock). Added `reasons?` to `VideoDomainTemplateInput` so the video unlock has a raw reason tally.

**Honesty spine (STRICT):** every modeled figure is a labeled proxy from real inputs, carried by the
**single consolidated calibration line** per tab (owner call: no per-section chips). Nothing invented
as measured.

**Canonical reason classifier:** the pStop reason-polarity map is now the single source of truth in
`modeled.ts` (`REASON_POLARITY` / `humanizeReason` / `classifyReasons`); `population.ts` imports it.
The unlock classifies friction by **semantics** (token map), NOT the voices' cosmetic
exemplar-persona `loss` (which alternates by quote polarity → produced nonsense levers before).

Follow-up: `codedReasons` (Population voices) now humanizes tokens for display (`weak-hook` → "Weak hook").

### PR #379 — accuracy pass (live must match authored)

1. **buyIntent dropped** from the creator Brain — it's a COMMERCE figure the authored creator template
   deliberately omits (a regular hook has no "purchase-intent" axis). Removed from both creator
   builders; `modeledBuyIntent` stays exported for a future commerce domain.
   **Lesson:** parity target = authored's EXACT section set, not "max sections".
2. **Locale bug** — `agg.total.toLocaleString()` honored the machine's European locale → `1.000`
   instead of `1,000`. New locale-proof `fmtCount()` (regex en-US grouping). **Never `toLocaleString()`
   without a locale.**
3. **Flat signalGrid** — every dim clustered ~48 "OKAY" near a mid stop rate. Added a stable seeded
   per-dim CHARACTER (±22) so the nine spread into a real weak/okay/strong story; the stop rate still
   sets DIRECTION. `whyScore` is now tone-aware. (Live: 68 STRONG / 37 WEAK / 50 OKAY at a 38% stop.)
4. **Dead text `whyThisSecond`** — computed but never rendered (`synthesis` shows only on the
   attention-scrubber path; `ReasonBreakdown` ignores it). Removed `modeledWhyThisPoint`; the
   reason-breakdown's own `read` IS the text "why".
5. **TEXT-sim review surface** — `CREATOR_LIVE_TEXT_TEMPLATE` (`buildDomainTemplate` over a realistic
   hooks/text react payload) + a `creator · TEXT sim` toggle on `/ambient-v2`, so the hooks-sim Detail
   reviews side-by-side with authored + LIVE-video. Enriched `LIVE_PERSONAS` (5 distinct) so voices
   don't dup a quote.

---

## `/ambient-v2` Brain surface now has 4 toggles

`creator · authored` (aspirational) · `creator · LIVE adapter` (video) · `creator · TEXT sim` (hooks) · `pricing template`.

---

## Verification

- **Gates:** tsc 0 · eslint 0 · matte 38 · adapters 11 · brain 21 · population 15 · baseline 5 · rail 3.
- **Live** (`/ambient-v2`, Playwright DOM — screenshots hang on cortex WebGL, use `getComputedStyle`/innerText):
  all 4 toggles, both tabs, 0 console errors. TEXT sim renders 100% both tabs; video buyIntent gone;
  `1,000` locale; signal spread 3 tones.

Run the gates:
```
node ./node_modules/vitest/vitest.mjs run \
  src/lib/surfaces/__tests__/ambient-v2-brain.test.ts \
  src/lib/surfaces/__tests__/ambient-v2-population.test.ts \
  src/lib/surfaces/__tests__/ambient-v2-adapters.test.ts \
  src/components/reading/__tests__/reskin-matte.test.ts \
  src/lib/audience/__tests__/general-baseline-signature.test.ts \
  src/components/app/home/__tests__/home-page-rail.test.tsx
```

---

## Honest limits / open notes

- **Authored ≠ live by design.** The authored page has hand-crafted narrative specificity (ties the
  attention dip to the exact "$400 opener" copy) that a proxy CAN'T reproduce — live reads the measured
  curve/reasons. Structure + section-set match; narrative specificity differs (authored = aspirational,
  live = honestly modeled). This is the intended authored-vs-live distinction, not a bug to close.
- **Transient "367%"** seen mid-review = a count-up animation frame, not a bug (settled = 38%).
- **Production `agg.reasons` are pStop TOKENS** (interest/weak-hook/too-slow…), NOT sentences — the LIVE
  video fixture's sentence reasons were fiction. See `src/lib/audience/population.ts` (`pStop` `why`).
- **Text parity is fixture + unit-covered**, plus the new TEXT-sim toggle. For real-rail eyes, fire a
  sealed text sim through the composer → rail (`buildDomainTemplate` is the same producer).
- `modeledBuyIntent` is exported but currently unused — reserved for a commerce domain.

---

## Files touched

- `src/lib/surfaces/ambient-v2-modeled.ts` (new)
- `src/lib/surfaces/ambient-v2-brain.ts`
- `src/lib/surfaces/ambient-v2-population.ts`
- `src/components/audience-lens/v2/detail-live-fixture.ts`
- `src/app/ambient-v2/page.tsx`
- tests: `ambient-v2-brain.test.ts` · `ambient-v2-population.test.ts`

---

## Dev server

```
rm -rf .next && NODE_OPTIONS="--max-old-space-size=2048" \
  NEXT_PUBLIC_AMBIENT_V2=true PORT=3007 node ./node_modules/next/dist/bin/next dev -p 3007
```
Test user: `e2e-test@virtuna.local` / `e2e-test-password-2026`.
