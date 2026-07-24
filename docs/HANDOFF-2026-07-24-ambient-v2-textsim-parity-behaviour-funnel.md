# Handoff — Ambient v2: text-sim video parity · section redesigns · "the room, by behaviour" funnel

**Date:** 2026-07-24 · **Branch:** `design/ambient-audience-v2` → merged to `main`
**Surface:** `/ambient-v2` dev harness (4 Brain toggles: authored · LIVE adapter · TEXT sim · pricing).
The RAIL is the real surface; `/ambient-v2` is the dev fixture that exercises the same producers.

## What shipped this session

### 1. Text-sim → video Brain parity (retention + text; sensory reads greyed)
Owner call: the TEXT sim Brain must render the SAME instrument as the video LIVE adapter, with only
the visual-only reads greyed. This **reverses** the prior "text has no attention curve → reason-bars"
stance — the honesty now rides the single calibration line, not omission.

- Text driver swapped `reason-breakdown` → the **same `attention-scrubber`** the video uses:
  - transcript = the REAL concept text (fixture passes the hook text; real sims pass the concept);
  - retention curve = a **MODELED** proxy (`modeledAttentionData`, deterministic LCG from stop-rate +
    friction mix) — labeled modeled by the calibration line, never presented as measured;
  - the "why they stopped" synthesis that heads the scrubber = the **REAL top reason** (top friction
    reason first, coral on the loss clause).
- **Sensory reads greyed on text only** (`mutedSensory` flag through `ModeledBrainInput`):
  Visual/Audio/Face rows in ACTIVATION PER SECOND + the "Visual Pull" nine-signal cell dim, with an
  honest footnote "Visual · Audio · Face — no video substrate in a text sim". Video greys nothing.
- Calibration line updated to name the modeled curve.

### 2. Premium redesign of four shared sections (both tabs, all domains)
- **ACTIVATION PER SECOND** (`KpiHeatmap`): larger rounded cells, per-row peak accent (strongest
  second rings cream), cleaner axis/legend, muted-row styling.
- **THE UNLOCK** (`Unlock`): editorial kicker→hairline, gain reframed as a "projected | +N%" pill.
- **THE SWING** (`Swing`): from→to bar now legible — the gain is its own brighter band + boundary tick.
- **THE ROOM** (`RoomStrip`): gradient confidence meter, highlighted sample count, tighter rhythm.

### 3. "THE ROOM · WHAT THEY DID" — the behaviour funnel (replaces the archetype ledger)
The old district ledger (builders/scrollers/skeptics dot-rows) was redundant with the terrain map +
the read + the index bars. Replaced with a 4-way partition of the room by **what each viewer did with
the content**, using the OLD NodeBar dot vocabulary (clean: name · dots · count; coral on the loss):

| label | = | count basis |
|---|---|---|
| **Stopped** | the hook caught them | `agg.stop` |
| **Almost** | nearly stopped, then scrolled | fence segment's non-stoppers (the swing) |
| **Not for them** | wrong fit | lowest-stop segment's non-stoppers |
| **Scrolled past** (coral) | never caught | the remaining scrollers |

- New pure producer `modeledDecisionStates(agg, reasons)` — an **honest partition** (the four counts
  sum exactly to the room); `DecisionStatesData` type + `PopulationFrameData.decisionStates`.
- Gated in `PopulationFrame`: creator (real sims via `buildPopulationFrameData`) gets the funnel;
  other domains fall back to the archetype `DistrictLedger`.
- Iterated on framing per owner: funnel → back to old dots → reframed from sales language
  (Sold/Winnable/Skeptical/Gone) to **content + human behaviour** (Stopped/Almost/Not for them/
  Scrolled past). Levers/read kept in the data (unrendered) for a future surface.

### 4. Pricing tab updated to match (its own purchase funnel)
Pricing is a hand-authored fixture, so a pricing-native `decisionStates` was authored directly:
**Would pay 530 · Won at $24 140 · Wants a trial 140 · Won't pay 190** (coral). Three of four counts
tie to real authored numbers (would-buy 53%, the 140 near-miss swing, the 140 trial-seekers). The
distinct "Willingness to pay" tier cut is kept; the tier district ledger is replaced.

## Files
- `src/lib/surfaces/ambient-v2-modeled.ts` — `modeledAttentionData`, `mutedSensory`, `modeledDecisionStates`, `fmtCount`.
- `src/lib/surfaces/ambient-v2-population.ts` — text brain = attention-scrubber + reason synthesis; `decisionStates` wired.
- `src/components/audience-lens/v2/` — `BrainDepth` (KpiHeatmap redesign + muting), `AmbientDetail` (Unlock), `AudienceDepth` (Swing/Room), `AudienceTab` (DecisionStates + gated swap), `domain-template` (types), `detail-live-fixture` (transcript), `pricing-template` (decisionStates).
- `src/lib/surfaces/__tests__/ambient-v2-population.test.ts` — scrubber parity, reason synthesis, sensory-greyed, decision-states partition.

## Gates (all green)
tsc 0 · eslint 0 · matte 38 · adapters 11 · brain 21 · **population 19** · baseline 5 · rail 3 → **97 pass**.
Verified live on all 4 tabs via Playwright `getComputedStyle` (screenshots hang on the cortex WebGL): 0 console errors.

## Honest limits / notes
- The text retention curve is **MODELED** (owner-accepted); the transcript is real. Honesty is the
  single calibration line — no per-section modeled chips.
- Pricing `decisionStates` is **hand-authored** fixture data; a production pricing vertical would
  compute it from a pricing-calibrated projection.
- `modeledDecisionStates` keys stay internal (`sold/winnable/skeptical/gone`); the human-behaviour
  wording lives in the `label` field only — tests assert keys + counts, not labels.

## Still open (see the session summary for the ranked list)
- Apply migration `20260723090753_thread_sim_seals.sql` (Phase D seal persistence) — still pending.
- Brain **video** producer cutover (real `runFold` from the rail → modeled producers → cutover).
- Real pricing vertical: compute pricing `decisionStates` from a pricing-calibrated audience.
