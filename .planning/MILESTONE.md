# Milestone: Result Surface

**Branch:** `milestone/result-surface`
**Worktree:** `~/virtuna-result-surface/`
**Started:** 2026-05-24
**Status:** Active
**Part of:** Intelligence Surface drop (3 milestones: Result Surface → Iteration & Niche Intelligence → Compounding Intelligence)

## Purpose

Build the polished analysis experience that wraps the validated Engine Foundation (v3.0.0) — the surface every user touches when they analyze a video. This is the **magic moment** layer: result card, live persona simulation, mobile route, and the onboarding sequence that converts free users.

Without this milestone, the engine is invisible. With it, Virtuna becomes a product creators can feel.

## Position in the drop

The Intelligence Surface drop is **3 parallel milestones**, all shipping together (no incremental public release):

1. **Result Surface** (this) — magic moment + core analysis UX
2. **Iteration & Niche Intelligence** — modes that turn results into action + niche-specific intelligence
3. **Compounding Intelligence** — outcome feedback loop + learning surfaces

This milestone ships **first** (sequential), then II and III fork as parallel worktrees once design patterns here are locked.

## Scope (in)

### Polished result card
A single unified card that contains the full analysis output. All panels animate in as the engine streams stages via SSE.

- **Retention curve** — viewer drop-off prediction across video length
- **Persona breakdown panels** — 10 personas (6 FYP + 2 niche + 1 loyalist + 1 cross-niche) with individual verdicts, expandable reasoning
- **Hook decomposition UI** — visual + audio + text + speech sub-scores, coherence, cognitive load
- **Similar videos panel** — top-K pgvector matches from competitor corpus
- **Reasoning narrative** — DeepSeek synthesis + self-critique, structured (not wall of text)
- **Emotion arc visualization** — pacing/intensity curve across video
- **Comparative baseline** — where this video ranks vs creator's own past content and niche cohort
- **Anti-virality verdict state** — "don't post yet" UI when the engine says rework before publishing

### Live audience simulation viz
SSE-driven hive extension. The user watches personas "react" in real-time as the pipeline runs. Wave 3 (persona simulation) drives the animation. This is THE wow moment — the difference between "uploaded, got result" and "watched the AI think."

- Hive extends with persona nodes (color-coded by persona type)
- Reactions stream in as DeepSeek persona calls complete (parallel)
- Final aggregation animates into the verdict
- Reduced-motion fallback (static breakdown)

### Mobile-first analysis route
Entire upload → analyze → result flow on mobile. Creators are mobile-native. The current desktop dashboard does not work on mobile.

- Mobile upload (camera roll picker, file size check, watermark scan pre-upload)
- Mobile-optimized live viz (vertical hive, swipeable persona cards)
- Mobile result card (collapsible panels, swipe navigation)
- Mobile share/export

### Share & export
Essential for product virality — creators screenshot results and post them. Make that frictionless.

- Generate shareable PNG of result card (themed, branded, no scoped data)
- Public permalink (read-only, gated by tier)
- Native share sheet on mobile, copy-link on desktop
- Watermark with `virtuna.app/r/<id>` on shareable images

### Re-shoot script generator *(new — packages existing engine output)*
The engine produces counterfactuals + A/B variants. Currently those are insights. This turns them into a **ready-to-act-on script** the creator copies and uses.

- New opening line (from counterfactual)
- Scene order / pacing recommendation
- Voiceover script
- Caption variants
- Click-to-copy each section
- Optional: export as plain text / markdown / Notion-importable

### Optimal post-time recommendation *(new — needs small engine signal)*
Engine generates a per-niche optimal post-time recommendation. Surfaces in the result card.

- Engine signal: `optimal_post_window` (day-of-week + hour range, niche-driven)
- Card panel: "Post this between Tue 6-8pm EST for max reach"
- Calendar integration deferred (post-drop)

### First-analysis WOW onboarding *(new)*
Orchestrated demo flow for the first time a user analyzes. Times the live viz, the verdict reveal, and the next-action prompt to maximize "holy shit" feeling.

- Tutorial overlay (skippable) on first upload
- Pacing: persona viz holds, verdict reveals on tap, next-action panel surfaces last
- Track first-analysis completion rate as success metric

## Scope (out — handled in II/III)

- Concept mode, A/B variant flow, cross-platform repurposing, watermark detection → **M2-II**
- Trending sounds discovery, idea generator, steal-this-playbook → **M2-II**
- Hook archetype library, trend velocity, outcome feedback loop, wins/flops trend → **M2-III**
- Weekly intelligence report (post-drop fast-follow)
- Brand-fit predictor (separate brand-deals milestone)
- Series planner, content calendar, coaching feed, niche leaderboard (deferred)

## Dependencies

### Hard (must exist before M2-I implementation)
- Engine v3.0.0 shipped to main ✅ (Engine Foundation milestone closed 2026-05-23)
- Pipeline `onStageEvent` callback + SSE in `/api/analyze` ✅
- Creator profile (9-card) live in `creator_profiles` table ✅
- Aggregator outputs: persona array, hook decomp, similar videos, reasoning narrative, calibrated confidence ✅
- DeepSeek counterfactuals + A/B variants generated server-side ✅

### Soft (new engine signals — small additions in this milestone)
- `optimal_post_window` signal in aggregator output
- Emotion arc data emitted from segmentation (likely already there — verify in P1)

## Success criteria

A creator who:
1. Lands cold on `/analyze` on a phone, uploads a 30s video, sees the live persona viz, gets a verdict in <60s
2. Sees a result card with all 8 panels populated and animated in
3. Reads the re-shoot script, copies the new opening line, and the optimal post-time
4. Shares the result card to their network via native share sheet
5. Returns the next day for a second analysis (first-analysis WOW worked)

Quantitative gates (set during planning):
- Mobile lighthouse score ≥ 90 on `/analyze`
- Live viz holds 60fps on iPhone 13+ (graceful fallback below)
- p95 end-to-end (upload → verdict) ≤ 60s (engine cap)
- Share-image generation ≤ 2s
- Zero design regressions in retained desktop UX (regression audit included)

## Stack decisions (locked at milestone start)

- **SSE** for live viz (already in pipeline, just consume)
- **Canvas 2D** for live persona viz (consistent with existing hive)
- **Recharts** for retention curve + emotion arc (existing dep)
- **Satori + @vercel/og** for share-image generation (no new heavy dep — already used for OG metadata)
- **Mobile route as same `/analyze`** with responsive layout (not separate route) — Tailwind v4 breakpoints
- **Re-shoot script as Markdown** under the hood, rendered with existing GlassCard components

## Identity

This file is immutable. Signals to all sessions opened in this worktree that they are scoped to the Result Surface milestone.

**Next:** After M2-I lands (merged to main), fork `milestone/iteration-intelligence` and `milestone/compounding-intelligence` as parallel worktrees from main.
