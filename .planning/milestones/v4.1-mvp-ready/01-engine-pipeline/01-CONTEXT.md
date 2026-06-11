# Phase 1: Engine Pipeline - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit → refine pass over the **EXISTING, shipped** Apollo 3-call pipeline (engine
v3.13.0). Walk Qwen inputs/outputs, prompt quality, latency, grounding, and
correctness end-to-end and refine toward correct/honest/fast. This is brownfield
refinement of a working engine — NOT a feature build.

**AS-BUILT 3-call flow (the thing being refined):**
- **Read** — `qwen3.5-omni-flash`, observer/transcriber + verbatim (hook_verbatim,
  per-segment spoken/on-screen text), emotion_arc, segments, signals.
- **Fold** — `qwen3.5-omni-plus` WATCHING video, the 20→1 audience-sim (behavioral
  intents + per-segment reactions for all archetypes in one call).
- **Apollo reasoner** — `qwen3.6-plus` WATCHING video, expert critique + rewrites,
  grounded in cached KNOWLEDGE_CORE (Chase Hughes craft layer §1–§6 lean variant).
- **Score** = ensemble `0.5·apollo_composite + 0.5·fold_audience` (video mode);
  Apollo-only fallback in text/tiktok_url mode. `analysis_unavailable` honesty flag
  when both core signals die.

**In scope:** ENG-01..ENG-06 (E2E correctness/stability, §-grounding, latency,
honesty, read-drift hardening, deep Qwen prompt I/O review).

**Out of scope:** board rendering (Phase 2), remix board (Phase 3), chat dock +
chat-side citation rendering (Phase 4), cross-cutting UI/brand (Phase 5). Net-new
engine features (idea generator, A/B, watermark, learning loop) — backlog.
</domain>

<decisions>
## Implementation Decisions

### MILESTONE-WIDE constraint (binds all of v4.1, surfaced here)
- **D-00 (HARD):** No automated/autonomous fire-and-forget work. Davide is in the
  loop EVERYWHERE — interactive audit + discussion, he understands first, THEN we
  execute with accuracy. Plans must surface decision points and Qwen prompt I/O for
  HIS review (co-review step-by-step), not auto-rewrite and move on. Prefer
  interactive checkpoints over wave-based autonomous parallel execution. Audit-first
  / evidence-before-edits is the default rhythm. Applies to ALL 5 phases.
  (See memory `mvp-ready-human-in-loop`.)

### Verification rig + triage
- **D-01:** Audit INLINE per fix — no standalone upfront ENGINE-AUDIT.md deliverable.
  Understand each Qwen call's I/O deeply as we touch it, not as a separate document.
- **D-02:** Testing is ADAPTIVE and decided per-step — ask each time whether Davide
  UATs, Claude UATs (Playwright /analyze on a real video), or scripts run
  (`measure-pipeline.ts`, `smoke-tiktok-pipeline.ts`, `apollo-core-smoke.ts`). Batch
  testing after a couple of fixes to stay efficient. Do NOT pre-commit to one method.
- **D-03:** Triage bar = thorough refinement (NOT P0-only). Ground-up understanding
  of Qwen I/O is the goal; "a lot of refinement we need to make."

### Score / determinism (ENG-04)
- **D-04:** Score is NOT the yardstick this phase. Engine isn't optimized yet, so do
  NOT gate on score determinism or measure improvements against the current score.
  Insight/output quality leads; ENG-04 determinism band is DEPRIORITIZED for now
  (revisit once the engine is refined). If determinism is measured, measure-first
  then set a band from data — don't pre-pick a number.

### §-citation grounding (ENG-02)
- **D-05:** Fix grounding IN-ENGINE this phase — ensure Apollo only emits §-cites
  that resolve to real runtime KNOWLEDGE_CORE content. (Board/chat RENDERING
  reconciliation stays Phase 2/4; the engine OUTPUT is made honest here.)
- **D-06 (OPEN DIRECTION):** The citation/grounding system may need a FUNDAMENTAL
  rethink, not just a dangling-cite patch. Treat redesign of the grounding scheme as
  on the table for research/planning — not locked to a minimal fix.
- **D-07:** Audit-then-decide the dangling §2.6 (and §7/§8 dropped by T3.1): trace
  which §-cites Apollo actually emits at runtime vs the lean runtime core vs what the
  board expects (InsightHeroFrame cites §2.1–§2.6 + §4), THEN pick
  restore-vs-remap-vs-redesign from evidence.

### Latency (ENG-03)
- **D-08:** Stay safely under the Vercel 300s cap; chase <90s E2E only when it's
  free. If a quality/grounding fix costs latency, QUALITY WINS.
- **D-09:** Latency may TEMPORARILY regress during refinement; reclaim it in a
  cleanup pass before the phase closes.

### Read model + drift (ENG-05)
- **D-10:** REOPEN the read model choice. flash was picked on a 2-video speed A/B
  (v3.7.0); re-audit read quality (verbatim, emotion_arc, segments) flash vs plus on
  real videos and flip back to plus if meaningfully richer — latency budget allows it
  now under D-08/D-09.
- **D-11:** Contain read drift at the model boundary regardless of which model wins:
  Zod schema guard + bounded retry on malformed/empty critical fields
  (emotion_arc.label, weakest_modality, hook_verbatim) + validation logging when
  fields drift.

### Qwen prompt I/O review (ENG-06)
- **D-12:** Review all 3 calls' prompt I/O STEP-BY-STEP WITH Davide (co-review per
  D-00) — not delegated auto-rewrite. (Apollo is the moat — expect deepest attention
  there — but the explicit instruction is "review all together with me step by step.")
- **D-13:** T3.x prompt trims (dropped §sections, behavioral_predictions gating,
  max_token caps): AUDIT each trim + its original rationale first, then decide
  restore-vs-keep per item from evidence.
- **D-14:** Output schemas: MAP consumed-vs-dead output fields first, then prune dead
  fields / tighten Zod from that map (pairs with the D-11 drift guards). Don't tighten
  blind.

### Honesty (ENG-04, folded as an audit thread)
- **D-15:** Honesty audit folded in (not separately deep-discussed): confirm the
  fabricated `predicted-engagement` (Math.sin jitter) is fully gone, engagement range
  is grounded in `follower_count × quality read`, and no confident-looking fake
  numbers leak to the board. `analysis_unavailable` flag behaves honestly.

### Claude's Discretion
- Per-field drift-guard strategy during implementation (within D-11), surfaced to
  Davide per D-00 before applying.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Engine direction & teardown
- `.planning/ENGINE-MAP.md` — Apollo teardown / cut-list SSOT (sensor-vs-score-machinery
  lens; two-brain architecture; end-state thesis). NOTE: written in the engine-opt era,
  score-mode-centric — treat as direction, verify against v3.13.0 as-built.
- `.planning/corpus/KNOWLEDGE-CORE.md` — the FULL Apollo brain (source of truth for the
  cached system prompt; craft §1–§6 + the §2.6/§7/§8 sections dropped from the runtime
  lean variant). Central to ENG-02 grounding.

### As-built engine code (the refinement targets)
- `src/lib/engine/version.ts` — ENGINE_VERSION 3.13.0 + full change-history rationale
  (3.0→3.13: verbatim, Apollo rewire, 10-pass deletion, fold model flips, omni flash flip,
  rubric-sum, sense-complete perception, ensemble score, phantom-injection removal, T3.x
  trims, degradation honesty). Read this to understand WHY each thing is the way it is.
- `src/lib/engine/pipeline.ts` — orchestration of the 3-call flow + tail.
- `src/lib/engine/qwen/omni-analysis.ts` + `qwen/client.ts` — Read call (ENG-05/06).
- `src/lib/engine/wave3/fold.ts` + `wave3/fold-prompts.ts` + `wave3/persona-registry.ts`
  — Fold audience-sim (ENG-01/06).
- `src/lib/engine/deepseek.ts` + `apollo-core.ts` — Apollo reasoner + cached KNOWLEDGE_CORE
  / APOLLO_SYSTEM_PROMPT (ENG-02/06).
- `src/lib/engine/aggregator.ts` — ensemble score blend + tail (ENG-04; honesty/dead-source pruning).
- `src/components/board/InsightHeroFrame.tsx` — consumes Apollo levers/§-cites (read for the
  ENG-02 audit of what the board EXPECTS; the fix itself stays engine-side).

### Verification rigs
- `scripts/measure-pipeline.ts` — latency/stage measurement.
- `scripts/smoke-tiktok-pipeline.ts` — E2E smoke.
- `scripts/apollo-core-smoke.ts` — Apollo knowledge-core A/B smoke.

### Codebase maps (for orientation)
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `STACK.md`, `INTEGRATIONS.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `measure-pipeline.ts` / `smoke-tiktok-pipeline.ts` / `apollo-core-smoke.ts`: existing
  verification scripts — reuse for the adaptive testing in D-02.
- `wave3/persona-registry.ts` (553 lines): Brain-2 corpus already built; fold reuses it.
- `apollo-core.ts` cached-prefix pattern (KNOWLEDGE_CORE + APOLLO_INSTRUCTION): the
  grounding mechanism ENG-02 audits.
- Existing Zod schemas in `qwen/schemas.ts` / `gemini/schemas.ts` / fold schema: the
  drift-guard (D-11) and schema-tightening (D-14) hooks.

### Established Patterns
- Stable cached system prompt + volatile user message + temp 0 + seed + circuit breaker +
  bounded retry — the shared envelope across read/fold/Apollo. New guards must fit it.
- ENGINE_VERSION cache-key invariant: ANY change that should invalidate cached results MUST
  bump `version.ts` (D-23 from prior milestone). Relevant if grounding/score output shifts.
- uat-test-video memory: use `~/Downloads/TikTok Video Downloader.mp4` for live /analyze UAT;
  Playwright upload needs the file copied into `./.playwright-mcp/`.

### Integration Points
- Apollo output → `InsightHeroFrame` (board) — Phase 2 consumer; keep contract sane while refining.
- Engine output row → chat grounding (Phase 4) — §-scheme decisions here ripple to CHAT-01.
</code_context>

<specifics>
## Specific Ideas

- "I want to audit and understand from the ground up, qwen input/outputs etc — a lot of
  refinement we need to make." → audit-first, deep I/O focus, co-review.
- "We need to maybe adjust or change the system fundamentally" (re: §-grounding) → redesign
  of the grounding/citation scheme is explicitly on the table (D-06).
- "Review all together with me step by step" (re: prompt I/O) → interactive co-review (D-12).
- "Score not that important as the current setup is not optimized yet, so we shouldn't
  measure against it" → quality over score (D-04).
- "In general for this milestone we don't want automated work, we want me in the loop
  everywhere... I need to understand and then we execute with accuracy" → D-00, milestone-wide.
</specifics>

<deferred>
## Deferred Ideas

- Score-determinism hardening / formal tolerance band — deprioritized until the engine is
  refined (D-04). Revisit late in this phase or a follow-up.
- Net-new engine features (idea generator, A/B variants, cross-platform repurposing,
  watermark, learning loop, trend velocity) — milestone backlog, NOT this phase.
- Chat-side §-citation RENDERING reconciliation — Phase 4 (CHAT-01); engine-side grounding
  only here.
- Board frame rendering of Apollo output — Phase 2 (BTEST).

None of the above were scope creep into Phase 1; recorded so they aren't lost.
</deferred>

---

*Phase: 1-Engine Pipeline*
*Context gathered: 2026-06-09*
