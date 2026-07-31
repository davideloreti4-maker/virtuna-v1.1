# Handoff — Ambient Audience v2 detail drill, insights rework

**Date:** 2026-08-01 · **Branch:** `task/insights-rework` (off `origin/main` `fb0a5a00`)
**Worktree:** `~/virtuna-slot-b`, port 3002 · **Status:** design exploration only — **no `src/` changes**

Owner brief: rework the Brain + Population pages (overloaded, unclear value); reference the
TikTok/YouTube insight screens; maximise "wow" and "cheat-code" perception; premium tool feel.
Owner explicitly deprioritised honesty-labelling and wiring for this phase — *"we will rework the
engine to produce the real numbers later."*

---

## 0. State

| Artifact | Where |
|---|---|
| Mockup (rev 3, current on disk) | `docs/mockups/insights-three-tab-2026-07-31.html` |
| Published, all revs | https://claude.ai/code/artifact/4465380d-3cac-4afe-9022-f4b6d08ea97e |
| Rev 2 (owner preferred its read) | same URL → version picker → `rev-2-projection-led` |

**Rev 3 was rejected: "doesn't read clean and premium… colors, visual read like AI slop."**
Rev 2 was closer. Neither is approved. Nothing in `src/` was touched.

---

## 1. THE CENTRAL CONSTRAINT — video and text are *inverse*, and 3 of 4 inputs are text

`StimulusKind = "hook" | "video" | "idea" | "draft"` (`AmbientSimulate.tsx:39`). Only `video`
carries a timeline. **This is the thing rev 1–3 all got wrong** — every tab was designed around a
retention curve that three of the four input kinds do not have.

| | **VIDEO** | **TEXT** (hook · idea · draft) |
|---|---|---|
| Attention curve | ✅ real `heatmap.weighted_curve` | ❌ `modeledAttentionData` fabricates one |
| Per-viewer retention | ✅ real `heatmap.personas[].attentions[]` | ❌ none |
| Drop-off second | ✅ real `swipe_predicted_at` | ❌ none |
| Craft dims | ✅ 4 real `GeminiVideoSignals` | ❌ `mutedSensory: true`, rows greyed |
| Action intents | ✅ real `persona_behavioral_aggregate` | ❌ section absent |
| Skim band | ✅ real `skimmedPct` | ❌ 0 — binary verdict has no middle |
| **Coded reasons** | ❌ `reasons: []` **by design** (`ambient-v2-video-population.ts` §3) | ✅ **real** `agg.reasons` |
| **Per-viewer quotes** | ❌ none | ✅ **real** `PopulationPersona.quote` + verdict |
| **4-state playbook** | ❌ omitted (needs reasons) | ✅ `modeledDecisionStates` |
| **The unlock** | ❌ omitted (needs reasons) | ✅ `modeledUnlock` |

**Video has the timeline and no voices. Text has the voices and no timeline.**

### The architecture that already solves this — and that the mockups broke

`domain-template.ts` is an existing platform contract: two **invariant roles** (Brain answers *why*,
Population answers *who/how many*) with **◇ swap slots** the domain fills. Adding a domain authors
one `DomainTemplate` object; it never forks the page.

Rev 1–3 designed *video-shaped tabs* instead of *role-shaped tabs with swapping figures*. The next
pass should keep the tab **roles** invariant and swap the **figures** per `StimulusKind` — e.g.
Overview's hero is the retention curve for video and the reason-breakdown + verbatim wall for text.
A text sim should feel like a *different instrument*, not a video screen with empty slots.

---

## 2. Verified code findings (re-checkable, all still true on `fb0a5a00`)

These are the durable output of the session. Each was read in source, not inferred.

### 2.1 The useful cortex exists and has never run — `BrainTab.tsx:65`
`cortex-sim.ts` ships a **`grounded`** mode whose docstring reads: *"the drive is derived from the
audience's REAL retention curve — attention tracks who is still watching, salience spikes where the
curve breaks, and the default-mode network rises with the people who checked out."* It takes a
`retentionAt(u)` callback (`cortex-sim.ts:62-70`, branch at `:175-202`).

`BrainTab.tsx:65` hardcodes `mode: "simulated"`. So on every video drill, with `weighted_curve` one
prop away, the cortex runs a seeded envelope carrying no information. Wiring it is a few lines and
turns the cortex from decoration into a readout. **Highest value-per-line change in the codebase.**

### 2.2 The brain tab ships with no takeaway — `AmbientOverviewRail.tsx:467`
`buildVideoDomainTemplate({...})` is called **without `reasons`**, so
`modeledUnlock(classifyReasons(undefined))` → `[]` → returns `undefined`. `unlock` is absent on
**every** real video drill. The one actionable element on the page is structurally missing in prod.
(A video fold genuinely has no coded reasons — so the fix is a *video-appropriate* unlock derived
from the curve/craft, not passing `reasons`.)

### 2.3 Real data rendered nowhere
| Data | Where it lives | Sealed? |
|---|---|---|
| Per-persona retention curves | `heatmap.personas[].attentions[]` | ✅ whole `heatmap` on `SimSealVideo.heatmap` |
| Per-persona drop-off second | `heatmap.personas[].swipe_predicted_at` | ✅ same |
| Discovery-pool mix | `heatmap.weights` + `slot_type` | ✅ same |
| Optimal post window | `src/lib/engine/optimal-post.ts`, `PredictionResult.post_window` | ❌ not on the seal |

`slot_type` (`fyp` / `niche` / `loyalist` / `cross_niche`) is a distribution-pool model — it maps
directly onto TikTok's traffic-sources and new-vs-returning cards.

### 2.4 The fabrication zone — `ambient-v2-modeled.ts`
`modeledSignalGrid` (9 signals), `modeledNetworkBars` (7 Yeo-7 networks), `modeledKpiHeatmap`
(10 systems × N seconds) are seeded-LCG output — ~280 numbers, the bulk of the brain tab's length.
`modeledSignalGrid` carries a literal `(rnd() - 0.5) * 44` "character" term and a
`Math.round((rnd() - 0.4) * 30)` delta. Owner call: **keep behind a collapsed "deeper read"
disclosure**, don't delete.

### 2.5 Four partitions of ten rows, stacked
On the audience tab: `TerrainMap` → `DecisionStates` → `TriStateOutcome` → `IndexBars` all
re-cut the same cast. This is the "overloaded" the owner felt. Merge to one ledger + the map.

### 2.6 Two stop numbers that legitimately differ
`weighted_hook_score` (weighted attention at the hook) vs the fold headcount (`stop/total`).
`ambient-v2-video-population.ts` §4 documents this as intentional. They can currently appear on
adjacent surfaces unlabelled. Either print both with denominators or pick one — don't hide it.

---

## 3. Metric ledger — engine → UI

Owner intent is to rework the engine to produce real numbers later, so this is the *target* map,
not a constraint on the design.

| TikTok/IG metric | Engine source | Kind |
|---|---|---|
| Hook rate (3s) | `weighted_hook_score`; `scroll_past_second ≤ hookEnd` | video |
| Retention curve | `heatmap.weighted_curve` | video |
| Retention per viewer type | `heatmap.personas[].attentions[]` grouped by `slot_type` | video |
| Avg watch · watched-full | `watch_through_pct`, `completion_pct` | video |
| Rewatch / loop | `loop_pct`, `rewatch_intent` | video |
| Saves · comments · shares | `save_pct` · `comment_pct` · `share_pct` | video |
| Traffic sources | `heatmap.weights` + `slot_type` | both |
| New vs returning · non-follower % | `slot_type` (loyalist = returning) | both |
| Why they reacted | `agg.reasons` (real tally) | **text** |
| Verbatim objections/endorsements | `PopulationPersona.quote` | **text** |
| Post window | `OptimalPostWindow` | both |
| Views · reach · likes · follows | **none** — no producer exists | — |

---

## 4. Design: what was tried, what failed, why

### Rev 1 — two tabs, honesty-first
Attention + The room. Correct information architecture; owner wanted three tabs and TikTok framing.

### Rev 2 — three tabs, projection-led *(owner preferred this read)*
Overview / Audience / Engagement. Persistent header (thumbnail + projected stat row). Led with
"projected 3.2K views, ↓60% vs median". Added traffic sources, demographics, projected top comments,
before/after unlock curve. Narrative spine: **strong engagement rates, weak hook → throttled reach;
3.2K → 11.4K from one cut.** That spine tested well and is worth keeping.

### Rev 3 — visual pass ❌ REJECTED
Card system, type scale, varied chart forms (donut/gauge/columns), and **amber `#E8B04B` added as a
third semantic colour**.

**Why it failed — diagnosis for the next session:**
1. **Amber was the error.** Warm amber + coral on warm charcoal is exactly the generated-design
   cluster (cream/terracotta/amber warmth). Adding a second warm accent muddied the accent system —
   amber (45°) and coral (5°) are too close to read as distinct semantics, and the page lost the
   disciplined one-accent restraint that made the shipped system feel premium.
   **Do not reintroduce a second accent.** If "good" needs to read as good, use *weight, size and
   position* — not hue. Cream at full strength IS the positive state.
2. **Gradients on hero cards** (`linear-gradient(180deg, #262320 …)`) violate the shipped **matte**
   law (`CLAUDE.md`: no glass, no glow, no inset-shine).
3. **Card-in-card nesting** added borders inside borders; the shipped rail is a *connected surface*
   (`AmbientDetail.tsx:329` — full-height, one left hairline, no rounding, no shadow), not a stack
   of floating cards. Rev 3 fought the surface model.
4. **Form variety for its own sake.** Donut + gauge + columns + sparkline + rail + bars in one
   440 px column reads busy, not premium. Restraint reads premium.

### What to keep from all three
- The narrative spine (rev 2).
- The projection as the opening move, positioned against the creator's own catalogue.
- The **one-playhead instrument**: cortex · curve · filmstrip · transcript scrubbing together.
- Retention-by-pool (video) — nothing on TikTok/YouTube answers *"does this escape my followers?"*
- Projected comment section (strongest reaction of any element; **and it's text-sim-native**).
- Collapsed "deeper read" for the modeled zone.
- Design notes as collapsed `<details>` so the default read is product, not deck.

---

## 5. Open decisions

1. **Text-sim tab set.** Same three tabs with swapped figures, or a different set for text?
   Recommendation: same roles, swapped ◇ figures, per the existing `DomainTemplate` contract.
2. **Where the verbatim wall lives** for text sims — it's the strongest text asset and has no home
   in the current three-tab design.
3. **Benchmark bands** — platform norms are uncalibrated against a simulated panel. Show with a
   caveat, show bare, or hold.
4. **Two stop numbers** — print both with denominators, or pick one.
5. **Whether the cortex rides all three tabs** or Overview only.

---

## 6. Environment / process notes

- Branch `task/insights-rework` off `origin/main` `fb0a5a00`. **Do not switch branches.**
- Worktree `~/virtuna-slot-b`, dev server port **3002**, cap 2 GB. Start only to verify; a launchd
  reaper kills idle servers after 10 min — confirm it's still listening before hitting it.
- `npx tsc --noEmit` + relevant vitest before any commit. No `src/` changes yet, so nothing to run.
- Design SSOT is `src/app/globals.css` `@theme` + `docs/DESIGN-SYSTEM.md`. `BRAND-BIBLE.md`,
  `docs/tokens.md`, `docs/components.md` are STALE.
- In-surface palette is `AmbientDetail.tsx` `TONE`: cream `#ece7de`, dim/faint/ghost alphas,
  coral `#FF6363` (**loss only**), border 6 %, hair 8 %, well `#262624`, rail `#181817`.
- Mockup convention: `docs/mockups/<name>-<date>.html`.

---

## 7. Key files

| Path | Role |
|---|---|
| `src/components/audience-lens/v2/AmbientDetail.tsx` | Tab shell, `TONE`, shared atoms |
| `src/components/audience-lens/v2/BrainTab.tsx` | Brain frame · **`:65` the `mode` bug** |
| `src/components/audience-lens/v2/AudienceTab.tsx` | Population frame |
| `src/components/audience-lens/v2/BrainDepth.tsx` · `AudienceDepth.tsx` | The depth sections |
| `src/components/audience-lens/v2/domain-template.ts` | **The swap-slot contract** |
| `src/components/audience-lens/v2/AmbientOverviewRail.tsx` | Mount · **`:467` missing `reasons`** |
| `src/lib/brain/cortex-sim.ts` | **`grounded` mode, unused** |
| `src/lib/surfaces/ambient-v2-brain.ts` | Video → BrainFrameData |
| `src/lib/surfaces/ambient-v2-video-population.ts` | Video fold → aggregate (§3 no reasons) |
| `src/lib/surfaces/ambient-v2-population.ts` | Text → both frames |
| `src/lib/surfaces/ambient-v2-modeled.ts` | The LCG zone |
| `src/lib/threads/sim-seals.ts` | What survives reload |
| `src/lib/engine/types.ts` | `HeatmapPayload` `:41` · `PersonaSimulationResultSchema` `:794` |
| `src/app/ambient-v2/page.tsx` · `(app)/dev/cards` | Dev surfaces to review against |

Flag: `NEXT_PUBLIC_AMBIENT_V2=true` (build-time inline — restart dev + clear `.next/`).
