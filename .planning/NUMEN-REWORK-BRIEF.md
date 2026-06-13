# Numen — UI/UX Rework Brief (v5.0)

> **Status: LOCKED.** Captured 2026-06-13 from a design/strategy conversation.
> This is the discuss/roadmap input for a fresh milestone launched from trunk.
> It **supersedes** `NUMEN-SURFACE-VISION.md` (which was explicitly "EXPLORATORY,
> nothing locked"). Where they conflict, this wins.

---

## 0. TL;DR — what this milestone is

**Rework the existing UI/UX to the Numen vision — reuse what we built, don't rebuild.**
Stand down the *Numen Surface* milestone (the ground-up rebuild on `milestone/numen-surface`).
Start fresh from `main` on a new worktree/branch.

The product collapses to **one thread per video**: the user drops a video, the AI
returns a **Reading** (a consolidated, clean result), with a persistent composer
for follow-ups. Mobile-first. Desktop = same thread, widened. The Konva board is
**retired**.

This is a **presentation-layer milestone**. The engine is frozen (3.19.0).

---

## 1. Why — the rework decision

The *Numen Surface* rebuild (Phases 1–4 on `milestone/numen-surface`) was stood down. Diagnosis from the review:

- **The vision was right; the execution was wrong.** It ran on a doc headed
  "EXPLORATORY, nothing locked," built 4 phases of scaffolding (ground-up kit,
  view-model, banding, a thin reading view) and never shipped a usable app.
- **It ignored its own brief.** Vision §4 said "existing card components become
  the rich message blocks." The rebuild instead built a *new* thin kit
  (text-only retention block, etc.) — rebuilding the vocabulary it was told to reuse.
- **It threw effort at the wrong layer.** The board components were richer than
  what replaced them, and the board was never actually deleted (it's intact at
  `/analyze`). Nothing of value was lost; it just wasn't reused.

**Correction:** retheme + restructure the **existing** components (a conscious
override of the old vision §6 "ground-up, not a retheme" — the rebuild proved
ground-up too costly for the payoff). Reuse the rich visuals, re-author a clean
information architecture on top, cut the jargon, reskin to a new flat-warm system.

**Do NOT carry over `milestone/numen-surface` components or concepts** (the
`numen/` kit, the `reading/` blocks, verdict-band copy, the "stage-gate" framing).
That branch stays in `.git` for reference only; it is not a source. Build on the
**existing board + app-shell components** instead.

---

## 2. Locked decisions

### 2.1 Paradigm
- **One thread per video. The thread IS the product.** The AI's first turn is the Reading.
- **Konva canvas retired entirely.** The frame *components* are DOM/React/SVG (not
  Konva) and transplant cleanly; only the canvas *shell* (pan/zoom, camera,
  world-space positioning) dies.
- **Desktop = same thread, widened + denser.** No separate spatial instrument for
  now. `/analyze` left dormant (not deleted) until we're sure.

### 2.2 The composer (one universal input, two layouts)
- **Empty / new:** composer **centered**, warm **serif greeting** above it, starter
  chips below (`Paste link` · `Upload video` · `Try a demo`). Use the **Numen stele
  glyph**, not Claude's asterisk. Reference: Claude.ai start screen.
- **Active (a Reading exists):** composer **drops to bottom-pinned**; the Reading
  fills the scroll area above. Reference: Claude.ai conversation screen.
- `+` = upload; paste-URL auto-detected. Submit → new thread → stage-reveal fires.
- The composer is also the **follow-up** field after the Reading (no separate dock).

### 2.3 Result information architecture
The board's ~40 fields reduce to **4 questions a creator actually has**:
1. **Did it do well?** → `overall_score` + go/no-go gate (`anti_virality_gated`)
2. **Who's it for?** → watch-through `completion_pct` + persona cloud
3. **What's working / broken?** → 3 driver rows
4. **What do I change?** → timestamped fixes + copyable hook rewrites (**Fix First**)

**Vertical order:** hero → driver rows → **Fix First** → deeper read → composer.

### 2.4 Driver rows (the always-visible levers)
- **Hook** — stop-power (modality breakdown on tap: visual/audio/text/speech)
- **Retention** — *where they drop* (`weighted_top_dropoff_t`, e.g. "⚠ 0:08"). NOT
  watch-time (that's the hero outcome — don't duplicate). The row is the *fixable* part.
- **Shareability** — `share_pull` (the #1 reach multiplier on TikTok)

Frame: **hero = the outcome; rows = the levers you change next time.** The other 3
Apollo dimensions (clarity / substance / credibility) fold into the deeper-read expand.

### 2.5 Disclosure + reuse
- **Headline + one inline hero visual** (retention) per the chosen hero; everything
  heavier is **one tap away**.
- **Keep ALL rich visuals** — `RetentionChart`, `PersonaGraph`, filmstrip, emotion
  arc, factor bars, segment table, etc. They become the **drill-downs**. Nothing
  visual is deleted.
- **Stage-reveal** kept — each block/headline materializes as its engine stage
  completes, so the ~45–60s wait reads as progress, not a spinner.

### 2.6 The verdict
- **Score-forward instrument. NO prose narration.** No "your video will travel"
  horoscope copy. The number is shown clean and **zone-colored** (green/amber/red),
  Whoop-style. Confidence/uncertainty shows through restraint, not a sentence.

### 2.7 Visual language (flat-warm)
- **Warm-dark, FLAT base** — warm-neutral *hue* (not cold `#07080a`), but **matte:
  no glow, no shine, no halo gradients, no ambient/"presence" lighting.** Contrast
  from elevation, not effects.
- **Color only in the data** — score zones + coral as the single brand accent
  (logo, primary action, focus). Everything else neutral.
- **Serif for voice moments** (greeting, hero line), **sans for all data.**
- **Hairline borders, generous space, calm/soft motion.** Linear/Things restraint.
- **Coral evolves** (matured slightly warmer), doesn't die — continuity.
- **Retire the Raycast glass** (137deg gradient + 5px/12px blur + inset white shine)
  wherever it appears (incl. the sidebar) — that inset glow is the vetoed shine.

### 2.8 App shell / home
- **Home = greeting + composer (clean).** Past Readings live in the **sidebar**
  (collapsible on desktop, drawer on mobile), NOT listed under the composer.
- **Ingestion = the composer** (`+` upload / paste-URL).
- **First-run = a live demo Reading** on a known viral video (show the magic first).

### 2.9 What gets cut (consolidation = jargon *data*, never visuals)
Cut from display: `feature_vector`, `score_weights`, `signal_availability`, dead
sub-scores (ml/rules/trends/gemini — all 0 in prod), telemetry (`latency_ms`,
`cost_cents`, model names), `critique`, **`predicted_engagement`** ("projected
views" — code flags it false precision: `followers×(score/100)²`), and dead modules
not firing in prod (retrieval, platform_fit, audio-fingerprint).
**Redundancy fixed:** completion % shows in 3 frames today → Audience owns it once.

### 2.10 Engine
**Frozen at 3.19.0. Presentation only.** No `lib/engine/` changes.

---

## 3. v1 scope

**In v1 (this milestone):**
- Home + sidebar (reskinned), ingestion via composer, first-run demo
- The consolidated Reading thread (hero → 3 rows → Fix First → all visuals as drill-downs)
- Stage-reveal
- The flat-warm visual system / token migration
- **Basic text follow-up** (reuse existing "Ask the expert" chat as the thread tail)

**Deferred to later milestones (NOT v1):**
- Agentic tools (Apify competitor analysis, etc.) — "the moat," but heavy backend
- In-thread monetization turns
- Desktop dense-instrument (Konva successor) — revisit only if powerusers demand it

Rationale: keep this milestone tightly about the **UI rework, shippable**. The moat
gets built on top of a shipped surface, not before it.

---

## 4. Reuse map (existing code → reskin/restructure)

| Need | Reuse (existing) | Action |
|---|---|---|
| Result visuals | `src/components/board/**` derive + chart components (`RetentionChart`, `PersonaGraph`, `ScoreDistribution`, `FactorBars`, `InsightHero`, filmstrip, `SegmentTable`) | Transplant into thread blocks as drill-downs; reskin to flat-warm tokens; drop Konva shell |
| App shell + sidebar | `src/components/app/app-shell.tsx`, `src/components/sidebar/Sidebar.tsx` (has `useAnalysisHistory` "Recent" list, collapse, mobile drawer) | Keep structure + history wiring; **reskin off the glass** (strip 137deg gradient, blur, inset shine) |
| Past Readings list | `useAnalysisHistory` / `/api/analysis/history` | Reuse as the sidebar Reading list |
| Follow-up chat | existing "Ask the expert" chat (`/api/analyze/[id]/chat`) | Repurpose as the inline thread tail |
| Stream / stage data | existing `useAnalysisStream` + permalink hooks | Drive stage-reveal |

**Do not reuse:** anything under `milestone/numen-surface`'s `src/components/numen/`
or `src/components/reading/` (fresh build instead).

---

## 5. Result layout (locked mock)

```
EMPTY STATE                          ACTIVE READING (scroll)
┌──────────────────────┐            ┌────────────────────────────┐
│                      │            │ ▸ [thumbnail of the video]  │
│   [stele]  serif     │            ├────────────────────────────┤
│   "What should I     │            │ ╭──────╮  │  ◌  ◌  ◌        │
│    read, Davide?"    │            │ │  71  │  │ ◌  ◌  ◌  ◌      │
│                      │            │ ╰──────╯  │  ◌   ◌   ·      │
│ ┌──────────────────┐ │            │ Strong    │  57% watch     │
│ │ Paste a link…  ⊕ │ │            │ ─────────────────────────  │
│ └──────────────────┘ │            │ Hook         ▓▓▓▓▓▓▓   87  │
│ [Paste][Upload][Demo]│            │ Retention    ▓▓▓░░░░  ⚠0:08│
│                      │            │ Shareability ▓▓▓▓▓░░   64  │
└──────────────────────┘            ├────────────────────────────┤
(composer centered)                  │ FIX FIRST                  │
                                     │ ▸ Recut the open — you     │
                                     │   lose them at 0:08        │
                                     │ ▸ 2 more fixes →           │
                                     ├────────────────────────────┤
                                     │ ▸ Deeper read              │
                                     ├────────────────────────────┤
                                     │ [why this?] [rewrite hook] │
                                     │ ┌────────────────────────┐ │
                                     │ │ Ask about this read… ⊕ │ │
                                     │ └────────────────────────┘ │
                                     └────────────────────────────┘
                                     (composer bottom-pinned)
```

---

## 6. Engine signal reference (for the roadmap)

Real output type: `src/lib/engine/types.ts` (`PredictionResult`). The 6 scored
Apollo dimensions live at `apollo_reasoning.dimensions[]` (hook, retention, clarity,
share_pull, substance, credibility — each `score` 0–100 + `band` strong/mid/weak).

- **CORE (headline):** `overall_score`, `anti_virality_gated`+reason,
  `apollo_reasoning.ceiling_capper`, `apollo_reasoning.rewrites[]`,
  `counterfactuals.suggestions` (fixes), dims `hook`/`retention`,
  `share_pull`, `weighted_completion_pct`/`completion_pct`, `weighted_hook_score`,
  `weighted_top_dropoff_t`, `hook_decomposition.weakest_modality`,
  `optimal_post_window`, drop-segment label.
- **SUPPORTING (behind a tap):** other Apollo dims, segment/persona breakdown,
  niche diff/ghost curve, share/comment/save/loop rates, hook modality sub-scores,
  CTA, pacing/transition, audio sub-scores + mix, `emotion_arc`, verbatim hook,
  confidence range, fatal-flaw warnings.
- **CUT:** see §2.9.

---

## 7. Open / calibration items (decide during build, not blockers)
- Exact warm-neutral hex ramp + the score-zone green/amber/red values + matured coral hue.
- Exact serif typeface for voice moments.
- How the thread *settles* (reveal → resting document) in detail.
- Shareability of a Reading (export image vs link) — growth loop, likely later.
- Mobile sidebar drawer vs bottom-sheet for the Reading list.

---

## 8. Launch mechanics
1. From trunk `~/virtuna-v1.1/` on `main`, run `/gsd-new-milestone` (e.g. *numen-rework* / v5.0), feeding this brief.
2. New worktree + branch off `main`; clean scoped `.planning/`.
3. `milestone/numen-surface` branch kept in `.git` (reference only, not a source).
4. Engine frozen 3.19.0 — presentation only.
