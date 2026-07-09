# Handoff — Grounded Generation design session (2026-07-09)

## What this was
A long **discussion/brainstorm** session (no code written to product) designing how Numen should
**ground every generation (hooks/ideas/scripts/topics/remix) in real, proven, outlier videos** and
present them so every request feels like a "cheat code." The owner explicitly kept this in
**thinking/refining mode** and twice pushed back on jumping to implementation.

## Source of truth
**`docs/GROUNDED-GENERATION-VISION.md`** — the full design brief. Read it first. It is comprehensive
(§0–12) and self-consistent. This handoff is just the map + how to resume.

## The one-paragraph thesis
Biggest current gap: generations run **cold** (KC craft prose + profile), not derived from videos that
worked. Fix = **live-first outlier scrape** (curated Sandcastles set = floor) → **gather-once /
walk-many** flywheel in chat → every output card carries a **receipt** (@handle · multiplier · real
video) → **barbell** = proof (past outlier) + prediction (audience sim — the wedge Sandcastles lacks).
Doctrine: **real work + real proof + made for me**; the earned streamed wait *sells* the work; theater
is only allowed because the work is real (honesty spine kept).

## Decisions LOCKED this session
- Live-first + curated floor; request-driven gather (tracked competitors = a prior, not the spine).
- Outlier gate = `views ÷ followers ≥ 3×`; scrape **30** posts; **search-query** over hashtags.
- Option **B** (caption/on-screen fallback for the ~20% of TikToks without native transcript).
- **Omni OFF the critical path.** Tiered extraction: metadata → captions+1 LLM → `plus` silent
  video-watch (format/visual) → omni only when AUDIO matters.
- **Model routing:** `plus` throughout (flash retired; cost ~flat; thinking on/off is the real lever).
  ONE change from current policy: **thinking-ON for the background/cached extraction call** (Apollo
  pattern). Generation stays thinking-OFF (A/B later).
- Extraction = a **cached corpus job** (background). The `generate → simulate` spine is UNCHANGED;
  generation just receives retrieved templates as grounding via a new `assembleBundle` field.
- Template + customized = **two stages** (reusable/displayed template, then per-user fill).
- **Three-beat streamed reveal**, option (b) pending→resolved reaction. Same spine every skill.
- Adopt **Sandcastles' taxonomy** as the seed archetype vocabulary; **unified card grammar** across all
  skills (§11b).
- **Degradation ladder** (§11d): Rung −1 own-proof → 0 in-niche → 1 adjacent-audience → 2 cross-niche
  structural → 3 curated → 4 craft (flagged). Rung 2 "search by structure not topic" = the pivotal move
  and, for boring niches, the **killer feature** (white-space arbitrage — frame as strength).
- **Learning flywheel** (§11e): two loops (proof + calibration); own-proof = Rung −1; **two-corpora
  architecture** (shared cross-user map vs private personal corpus).

## Code-verified grounding plan (§11f)
- All 4 runners share `assembleBundle → Qwen → Flash SIM → build block`. Highest-leverage change =
  **add optional-additive `corpus`/`retrievedExamples` field to `AssemblerInput`** (`assembler.ts:81`),
  fenced like `anchor`, `undefined`=no-op → grounds hooks/ideas/script at once.
- Output blocks/renderers need a new **proof row** (handle + thumbnail + multiplier + fit label) +
  distinct corpus `archetype` field (hooks' `audienceArchetype` is the audience tag, not this).
- **Remix already IS the vision for N=1** (decode→adapt, `coverUrl`+`sourceDecode`) → generalize
  `AdaptInput` 1→N. **Cheapest prototype.**
- Three-beat streaming = net-new plumbing (content-callback + interleaved emit + per-card SIM), and is
  **separable** — grounding ships first on today's 2-frame reveal.

## Recommended build order (when it moves to build)
1. Retrieval/extraction subsystem: query-expand → scrape 30 → outlier gate → topical prune (embedding)
   → audience+transfer score (flash) → extract (plus, thinking-on, silent video-watch) → corpus.
2. Wire into **Hooks** via the one `AssemblerInput` field; prove end-to-end on the 2-frame reveal.
3. Fan to **Ideas + Script**; generalize **Remix** 1→N.
4. Layer the **three-beat streamed reveal** last.

## Still OPEN (good next threads)
- Corpus **table + embeddings schema** (shared vs personal) — the one data-model piece not yet specified.
- `views ÷ median` accurate outlier metric — when it supplements the cheap ratio.
- **IG day-one** posture (Clockworks is TikTok-only; IG = flakier, no native transcript → whisper-only).
- **Per-request cost ceiling** (owner deprioritized vs quality, but constrains the adaptive-widen loop).

## Constraints / etiquette for the resuming session
- This is still **design/discussion** — do NOT start building unless the owner says so.
- Existing generation/grounding code is mostly stale relative to this vision; treat the brief as intent.
- Reference assets: Sandcastles shots at `~/Downloads/Sandcastles.ai Screenshots` (18) +
  `.planning/references/sandcastles/` (6). All 26 reviewed this session.
- Auto-wip daemon is DISABLED (2026-07-07) — commits are manual.
