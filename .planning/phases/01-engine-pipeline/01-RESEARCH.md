# Phase 1: Engine Pipeline — Research

**Researched:** 2026-06-09
**Domain:** Brownfield audit/refine of the Apollo 3-call Qwen prediction pipeline (engine v3.13.0)
**Confidence:** HIGH — all findings are file:line code evidence from the as-built tree; no external library claims.

This is an **audit-first, human-in-the-loop** research pass. It does NOT recommend net-new engine features. Every requirement section below gives: as-built evidence (file:line), the question to resolve, options on the table with tradeoffs, the verification rig that applies, and the co-review decision point that needs Davide (D-00/D-12).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-00 (HARD, milestone-wide):** No automated/autonomous fire-and-forget work. Davide in the loop EVERYWHERE — interactive audit + discussion, understands FIRST, THEN execute with accuracy. Plans surface decision points + Qwen prompt I/O for HIS step-by-step co-review. Prefer interactive checkpoints over wave-based autonomous parallel execution. Audit-first / evidence-before-edits is the default rhythm.
- **D-01:** Audit INLINE per fix — no standalone upfront ENGINE-AUDIT.md deliverable. Understand each Qwen call's I/O as we touch it.
- **D-02:** Testing is ADAPTIVE, decided per-step — ask each time: Davide UATs / Claude UATs (Playwright /analyze on real video) / scripts run (`measure-pipeline.ts`, `smoke-tiktok-pipeline.ts`, `apollo-core-smoke.ts`). Batch testing after a couple fixes. Do NOT pre-commit to one method.
- **D-03:** Triage bar = thorough refinement (NOT P0-only). Ground-up Qwen I/O understanding is the goal.
- **D-04:** Score is NOT the yardstick this phase. Do NOT gate on score determinism or measure improvements against current score. Insight/output quality leads; ENG-04 determinism band DEPRIORITIZED. If determinism measured: measure-first, then set a band from data — don't pre-pick a number.
- **D-05:** Fix grounding IN-ENGINE this phase — Apollo only emits §-cites that resolve to real runtime KNOWLEDGE_CORE content. Board/chat RENDERING reconciliation stays Phase 2/4; engine OUTPUT made honest here.
- **D-06 (OPEN DIRECTION):** Citation/grounding system may need a FUNDAMENTAL rethink, not just a dangling-cite patch. Redesign of the grounding scheme is on the table — not locked to a minimal fix.
- **D-07:** Audit-then-decide the dangling §2.6 (and §7/§8 dropped by T3.1): trace which §-cites Apollo actually emits at runtime vs the lean runtime core vs what the board expects (InsightHeroFrame cites §2.1–§2.6 + §4), THEN pick restore-vs-remap-vs-redesign from evidence.
- **D-08:** Stay safely under the Vercel 300s cap; chase <90s E2E only when free. If a quality/grounding fix costs latency, QUALITY WINS.
- **D-09:** Latency may TEMPORARILY regress during refinement; reclaim it in a cleanup pass before phase close.
- **D-10:** REOPEN the read model choice. flash picked on a 2-video speed A/B (v3.7.0); re-audit read quality (verbatim, emotion_arc, segments) flash vs plus on real videos; flip back to plus if meaningfully richer — latency budget allows under D-08/D-09.
- **D-11:** Contain read drift at the model boundary regardless of which model wins: Zod schema guard + bounded retry on malformed/empty critical fields (emotion_arc.label, weakest_modality, hook_verbatim) + validation logging when fields drift.
- **D-12:** Review all 3 calls' prompt I/O STEP-BY-STEP WITH Davide (co-review per D-00) — not delegated auto-rewrite. Apollo is the moat (deepest attention) but explicit: "review all together with me step by step."
- **D-13:** T3.x prompt trims (dropped §sections, behavioral_predictions gating, max_token caps): AUDIT each trim + its original rationale first, then decide restore-vs-keep per item from evidence.
- **D-14:** Output schemas: MAP consumed-vs-dead output fields first, then prune dead / tighten Zod from that map (pairs with D-11 drift guards). Don't tighten blind.
- **D-15:** Honesty audit folded in: confirm fabricated `predicted-engagement` (Math.sin jitter) fully gone, engagement range grounded in `follower_count × quality read`, no confident-looking fake numbers leak to the board, `analysis_unavailable` flag behaves honestly.

### Claude's Discretion
- Per-field drift-guard strategy during implementation (within D-11), surfaced to Davide per D-00 before applying.

### Deferred Ideas (OUT OF SCOPE)
- Score-determinism hardening / formal tolerance band — deprioritized until engine refined (D-04).
- Net-new engine features (idea generator, A/B variants, cross-platform repurposing, watermark, learning loop, trend velocity) — milestone backlog.
- Chat-side §-citation RENDERING reconciliation — Phase 4 (CHAT-01); engine-side grounding only here.
- Board frame rendering of Apollo output — Phase 2 (BTEST).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | Full E2E analyze is correct + stable on real videos; every Qwen call returns usable output, no silent fallbacks, no thrown frames | §ENG-01 below — traced every call's error/fallback path in pipeline.ts, omni-analysis.ts, fold.ts, deepseek.ts; mapped where empty/malformed degrades silently |
| ENG-02 | Apollo stays grounded in the knowledge core (§ citations resolve to real corpus, not fake legend labels) | §ENG-02 below — full §-scheme trace: corpus taxonomy vs lean runtime core vs board expectation vs chat fake legend; restore/remap/redesign options |
| ENG-03 | Latency held under target (Vercel cap safe; pursue <90s where free) | §ENG-03 below — per-stage contributors, serial-vs-parallel map, thinking_budget + max_token caps, the SSE-under-300s architecture |
| ENG-04 | Score deterministic + honestly banded; engagement range grounded (follower_count × quality read), no fabrication | §ENG-04 below — confirmed Math.sin jitter deleted, engagement formula traced, analysis_unavailable flag behavior; D-04 deprioritizes determinism gate |
| ENG-05 | omni-flash drift hardened (emotion_arc.label, weakest_modality, verbatim hook/segments hold across runs) | §ENG-05 below — located existing drift guards in schemas.ts, the read-model re-audit need, the cached-prompt+temp0+seed+retry envelope new guards must fit |
| ENG-06 | Qwen prompt I/O reviewed end-to-end for quality + token efficiency | §ENG-06 below — all 3 calls' prompt builders mapped; each T3.x trim located with version.ts rationale; consumed-vs-dead output field map |
</phase_requirements>

## Summary

The engine is a **3-LLM-call Qwen pipeline** behind one SSE response: **Read** (`qwen3.5-omni-flash`, watches video → verbatim + segments + emotion_arc + factors), **Fold** (`qwen3.5-omni-plus`, watches video → 10-archetype audience sim), **Apollo** (`qwen3.6-plus`, watches video, grounded in the cached KNOWLEDGE_CORE → 6 §-cited dimensions + 2–3 rewrites). The aggregator blends `0.5·apollo_composite + 0.5·fold_audience` in video mode, with an Apollo-only fallback in text/url mode and an `analysis_unavailable` honesty flag when both core signals die.

The architecture is sound and the prior milestone already did the hard honesty work (Math.sin fabrication deleted, ensemble score, degradation flag). The **real refinement surface this phase** is: (1) **ENG-02 grounding** — the single highest-value thread, because three different §-schemes are live in the codebase and only one is real; (2) **ENG-06 prompt I/O co-review** — the T3.x trims dropped corpus sections the rubric arguably still wants; (3) **ENG-05 read-model re-audit** — flash was picked on a thin 2-video A/B and D-10 reopens it; (4) **ENG-01 silent-fallback audit** — several degradation paths swallow failures into warnings the board never surfaces.

**Primary recommendation:** Run this as an **audit-first, co-review sequence** — ENG-02 grounding first (it's the moat and the riskiest), then ENG-06 prompt walkthrough (all 3 calls with Davide), then ENG-05 read re-audit, with ENG-01/03/04 as cross-cutting checks verified via the existing rigs. Do NOT auto-rewrite prompts; surface each Qwen I/O for step-by-step review per D-12.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Video perception (transcribe/observe) | Read call (omni-flash) | — | Only call that "looks at the video"; substrate for fold + Apollo |
| Audience simulation (retention curve, intents) | Fold call (omni-plus, watches video) | — | Brain 2 — commodity audience psych; persona-registry.ts corpus |
| Expert critique + rewrites + §-grounding | Apollo call (qwen3.6-plus, watches video) | — | Brain 1 — THE MOAT; cached KNOWLEDGE_CORE craft layer |
| Score ensemble + honesty flags | `aggregator.ts` (pure TS) | — | No LLM; deterministic blend + degradation honesty |
| Cache invalidation on output-shape change | `version.ts` ENGINE_VERSION | `prediction-cache.ts` | Cache key invariant — any output change bumps version |
| §-citation RENDERING (board) | Phase 2 (out of scope) | InsightHeroFrame | Engine emits honest cites here; board reconciliation later |
| §-citation grounding (chat) | Phase 4 (out of scope) | `chat/seed-context.ts` | Chat uses a SEPARATE fake legend — flagged below, fixed Phase 4 |

## Standard Stack (as-built — no changes proposed)

| Component | Value | Source |
|-----------|-------|--------|
| LLM provider | DashScope intl (`dashscope-intl.aliyuncs.com/compatible-mode/v1`) via OpenAI SDK | `qwen/client.ts:3,15` |
| Read model | `qwen3.5-omni-flash` (env `QWEN_OMNI_MODEL`) | `qwen/client.ts:36` |
| Reasoner model | `qwen3.6-plus` (env `QWEN_REASONING_MODEL`) | `qwen/client.ts:37` |
| Fast/fallback model | `qwen3.6-flash` (env `QWEN_FAST_MODEL`) | `qwen/client.ts:38` |
| Fold model | `qwen3.5-omni-plus` (env `FOLD_MODEL`) | `wave3/fold.ts:72-75` |
| Determinism knobs | `temperature: 0` + `seed: 7` on all scoring calls; SDK `maxRetries: 0` (app owns retry) | `qwen/client.ts:15,28` |
| Validation | Zod `safeParse` at every model boundary | `qwen/schemas.ts`, `fold-prompts.ts:245`, `types.ts:815` |
| Test framework | Vitest (`vitest run`); ~38 engine test files in `src/lib/engine/__tests__/` | `package.json` scripts |
| E2E | Playwright (`e2e/playwright.config.ts`) | `package.json` |

**No new packages.** This is a brownfield refine; the Package Legitimacy Audit is **N/A** (no installs). All work edits existing files.

## ENG-01 — E2E correctness & silent-fallback audit

**As-built call/fallback paths (the silent-degradation surface):**

| Call | File:line | On empty/malformed | Surfaced to user? |
|------|-----------|--------------------|-------------------|
| Read (Omni) | `omni-analysis.ts:192-330` | 2 attempts (MAX_RETRIES=1, 60s timeout); Zod fail → retry; after retries → returns ALL-NULL output (`geminiResult:null`, `nullWave0`) | **Silent** — pipeline pushes `"Omni analysis failed: …"` to `warnings[]` (`pipeline.ts:538`) and substitutes `DEFAULT_GEMINI_RESULT` (all-zero factors, "Analysis unavailable"). No thrown frame, but a zeroed analysis flows downstream. |
| Fold | `fold.ts:280-431` | ONE attempt, no retry; parse fail / segment-count mismatch / timeout → `fold_success=false`, empty arrays, warning pushed | **Silent** — `pipeline.ts:741-745` catches, pushes `"Fold unavailable: …"`, foldOutcome stays null; aggregator falls back to deepseek behavioral or FALLBACK_BEHAVIORAL (zeros). |
| Apollo | `deepseek.ts:389-521` | 3 attempts (MAX_RETRIES=2) + circuit breaker; on persistent fail → **returns null** | **Silent** — `pipeline.ts:683-692` catches, pushes warning, deepseekResult null; aggregator zeroes apollo_score. |
| Both core dead | `aggregator.ts:856` | `analysis_unavailable = !availability.gemini && !availability.behavioral` | **Surfaced** (T1.5) — board renders "couldn't analyze" state. This is the ONE honest path. |

**Question to resolve:** Which silent fallbacks are acceptable graceful-degradation vs. which mask a broken run that the user should see? The dual-failure flag (`analysis_unavailable`) only fires when BOTH die — a **single** dead signal (e.g., fold fails but Apollo succeeds) silently halves the score basis with only a `warnings[]` entry, and `InsightHeroFrame.tsx:222-232` filters out `"Weights redistributed"` / `"Low confidence"` warnings, so the user sees nothing.

**Options:**
- **A (audit-only):** Confirm via `smoke-tiktok-pipeline.ts` signal-completeness gate which paths fire on real videos; document, change nothing. Lowest risk.
- **B (partial-degradation honesty):** Extend the honesty surface so a single dead core signal also annotates the result (a `partial_analysis` flag or a surfaced warning). Pairs with ENG-04 honesty. Costs a `version.ts` bump (output shape).
- **C (harden retries):** Add a retry to fold (currently 0) so a single transient parse fail doesn't drop the audience half. Costs latency (D-09 tolerates temporary regression).

**Verification rig:** `scripts/smoke-tiktok-pipeline.ts` (has a `checkSignalGate`); `measure-pipeline.ts` for stage-level FAIL flags (`!!FAIL` print path, line 65).

**Co-review point (D-00):** which degradation paths get a user-visible honesty signal vs stay silent — Davide decides the bar.

## ENG-02 — §-citation grounding (THE KEY THREAD)

This is the highest-value, highest-ambiguity requirement. There are **three different §-schemes live in the tree, and only one resolves to real content.**

**Scheme 1 — the real corpus taxonomy** (`KNOWLEDGE-CORE.md`, the full brain):
§1 Persona · §2 Craft Frameworks (§2.0, §2.0a, §2.1 Hooks, §2.2 Retention, §2.3 Share/trust, §2.4 CTA, §2.5 Substance, **§2.6 Behavioral layer — "Empty in v1", reserved for Chase Hughes**) · §3 Anti-Patterns · §4 Scoring Rubric (§4.1 Platform) · §5 Decode Lens · §6 Rewrite · **§7 Audience knowledge** · **§8 Sources & Provenance**.

**Scheme 2 — the LEAN RUNTIME core** actually shipped to Apollo (`apollo-core.ts:8-19`): T3.1 dropped **§2.6, §7, §8** and the header meta. So at runtime Apollo's system prompt contains §1–§6 only (craft layer byte-unchanged).

**Scheme 3 — what Apollo is INSTRUCTED to emit** (`deepseek.ts:319-353`, the `buildDeepSeekUserMessage` output contract): each of 6 dimensions must name a `lever` "§2 lever that fired/failed" + cite §-numbers in `lever`/`evidence`/`ceiling_capper`; `APOLLO_INSTRUCTION` (`apollo-core.ts:240-246`) says "Cite section numbers (e.g. §2.1, §2.0a)". So Apollo emits **free-text §-cites pointing into §2.x and §4** — exactly the sections that ARE present in the lean core. Good.

**Scheme 4 — the board's expectation** (`InsightHeroFrame.tsx`): Here is the crucial finding — **the board does NOT parse, resolve, or validate §-cites at all.** It renders `dimension.lever`, `dimension.evidence`, `ceiling_capper`, `confidence_scope`, and `rewrite.lever_fixed` as **opaque strings**. The ONLY §-aware code is line 354: `rw.lever_fixed.includes('§2.2')` to attach a retention drop-label. There is no §-legend, no §-resolution, no dangling-cite render bug on the board side.

**Scheme 5 — the CHAT fake legend** (`chat/seed-context.ts:96-106`, OUT OF SCOPE this phase, Phase 4 CHAT-01): a completely different flat `§1–§10` map (Hook / Pacing / Storytelling / CTA / Authenticity / Visual / Audio / Viewer-psych / Platform / Viral-triggers). This **does not match the corpus taxonomy at all** and is the "fake legend labels" the requirement warns about — but it's the chat's, not the engine's. **Flag for Phase 4; do not fix here.**

**So what is actually broken / dangling for ENG-02?**
1. **§2.6 dangling:** The corpus reading rule (`KNOWLEDGE-CORE.md:3`) tells the model "a behavioral layer (Chase Hughes) slots into §2.6 + §6" — but §2.6 is *empty/reserved* and was *dropped entirely* from the lean runtime core. If Apollo ever cites §2.6 (it shouldn't, since it's not in the runtime prefix and is empty), the cite resolves to nothing. Low live-incidence risk, but it is a real dangling reference in the SOURCE corpus the regeneration instruction preserves.
2. **§7/§8 dropped but referenceable:** §4's text doesn't reference §7/§8, so dropping them is low-risk for scoring. But `KNOWLEDGE-CORE.md:181` (§5 Decode) and §6 reference §2.x only — clean. The risk is purely if the model hallucinates a §7/§8 cite.
3. **No runtime validation that emitted §-cites resolve:** Apollo emits §-cites as free text; nothing checks they point at a section present in the lean core. A hallucinated "§9" would flow through to `dimension.lever` and render verbatim on the board.

**Options on the table (D-06 puts redesign in scope — do NOT assume minimal patch):**

| Option | What it does | Tradeoff |
|--------|-------------|----------|
| **Restore** | Re-add §2.6/§7/§8 to the lean runtime core so every corpus cite resolves | Simplest; but §2.6 is empty, §8 is ~2k chars of IP bookkeeping — restoring dead/bookkeeping sections bloats the cached prefix (latency) for cites the rubric never needs. Bump `version.ts`. |
| **Remap** | Keep lean core; add a runtime guard that validates each emitted §-cite against a whitelist of sections actually present (§1–§6, §2.0a, §4.1); flag/strip danglers + log | Honest output guaranteed; small code add; fits the existing Zod post-parse backstop pattern (`deepseek.ts:128-190`). Doesn't restructure the taxonomy. Bump `version.ts` only if output shape changes (a strip would). |
| **Redesign** (D-06) | Replace free-text §-cites with a structured, enumerated lever taxonomy (e.g., an enum of valid lever IDs the schema validates) so cites are machine-checked and the board/chat can share one legend | Highest value (fixes engine + sets up Phase 4 chat reconciliation cleanly), highest effort + content work; changes the Apollo output contract → `version.ts` bump + schema change + prompt rewrite (co-review heavy). The §2.x lever names already exist in `ApolloDimensionSchema.lever` as free text — this would formalize them. |

**Recommendation for the planner:** present all three to Davide with the evidence above. The **remap** is the honest-output floor (satisfies D-05 cheaply); the **redesign** is the D-06 "fundamental rethink" that also de-risks Phase 4 chat. The board side needs no fix (Scheme 4 finding).

**Verification rig:** `scripts/apollo-core-smoke.ts` — runs the real KNOWLEDGE_CORE + reasoner on real videos and prints the §-cited assessment side-by-side with the baseline. This is the rig to inspect *which §-cites Apollo actually emits at runtime* (answers D-07 directly). Run it first, before deciding.

**Co-review point (D-12/D-06):** restore-vs-remap-vs-redesign is a Davide decision after seeing the apollo-core-smoke output.

## ENG-03 — Latency

**Per-stage contributors (from version.ts history + inline notes):**

| Stage | Model | Latency note | Tuning knobs (file:line) |
|-------|-------|--------------|--------------------------|
| Read | omni-flash | ~17s (was ~36s on plus; flipped v3.7.0) | `OMNI_MAX_TOKENS` env (default 0/uncapped), `TIMEOUT_MS=60_000`, `MAX_RETRIES=1` (`omni-analysis.ts:25-30`) |
| Fold | omni-plus + video | ~42–54s; `PER_CALL_TIMEOUT_MS=90_000` is a HARD ceiling (only earns the flip if it beats 10-pass) | `FOLD_THINKING_BUDGET=1000`, `FOLD_MAX_TOKENS=4000` (`fold.ts:52-62`); no retry (one attempt) |
| Apollo | qwen3.6-plus + video | ~49s at budget 1500 (was ~76s at 3000; NOT thinking-bound per A/B) — sits just under the fold so it's hidden | `DEEPSEEK_THINKING_BUDGET=1500`, `max_tokens:3000`, `TIMEOUT_MS=120_000` (`deepseek.ts:26-35,443`) |
| Tail | TS only | stage10 critique sub-ms (deterministic); stage11 removed; optimal_post DB read timed (`aggregator.ts:677-694`) | — |

**Parallelism map (`pipeline.ts`):**
- Read runs FIRST and BLOCKS (fold + Apollo both need its segments/verbatim) — `pipeline.ts:508-541`.
- **Fold and Apollo run in PARALLEL** after Read: fold kicked off at `pipeline.ts:710-746`, deepseek promise at `:639-693`, both awaited together (`wave2Promise` + the fold block). The critical path = Read (~17s) + max(fold ~54s, Apollo ~49s) ≈ **~70s**, well under the 300s cap.
- DB writes are serial (S19) — minor.

**The architectural latency flag (NOT a per-stage knob):** the whole pipeline + tail is awaited inside ONE SSE response under Vercel's 300s `maxDuration` cap (`pipeline.ts:103` ENGINE-MAP note). At ~70s there's comfortable headroom, so re-architecting (async split) is NOT needed — confirmed by D-08 ("chase <90s only when free").

**Question to resolve:** Is there free latency to reclaim, or does any planned ENG-02/ENG-05 quality fix (e.g., flipping read flash→plus, restoring core sections) push us up? D-08 says quality wins; D-09 says temporary regression is fine, reclaim in a cleanup pass.

**Options:** measure-first via `measure-pipeline.ts` (prints per-stage durations + the fold/Apollo overlap verdict). Do NOT pre-optimize — the doc is explicit that the fold gates the critical path, so trimming Apollo buys no E2E.

**Verification rig:** `scripts/measure-pipeline.ts` — prints `TOTAL_LATENCY_MS`, per-stage durations sorted, and a PARALLEL/SERIALIZED verdict.

## ENG-04 — Honesty & determinism

**Fabrication removed — CONFIRMED:** the Math.sin engagement jitter is gone. `aggregator.ts:430-432` and `:981-983` document the deletion; `predicted_engagement` is now `computeEngagementRange(creatorContext, overall_score)` (`aggregator.ts:1098`).

**Engagement range is grounded — CONFIRMED:** `computeEngagementRange` (`aggregator.ts:182-231`) is a pure deterministic formula: `follower_count × quality_ratio²-based reach_factor`, returns **null when follower_count is absent/≤0** (`:189-195`) — no fabrication. Width widens at low quality (honest fat-tail). NOTE: it is **LIVE-RESULTS-ONLY, not persisted** (`aggregator.ts:1096-1097`) — permalink reload shows no range. Flag this as a known honesty gap (intentional, deferred).

**`analysis_unavailable` flag — CONFIRMED behaving:** `aggregator.ts:856` = `!availability.gemini && !availability.behavioral`; surfaced on PredictionResult (`:1138`), required since v3.13.0, derivable from persisted `signal_availability` JSONB. Fires only on DUAL failure (see ENG-01 single-failure gap).

**Score is a TRUE ensemble — CONFIRMED:** `aggregator.ts:827-841` — video+both → `0.5·apollo_score + 0.5·fold_audience_score`; Apollo-only fallback (text/url) → weighted `behavioral·w + apollo·w`; apollo-dead+fold-ok → fold 100%; both dead → 0 (flagged unavailable).

**Determinism (D-04 DEPRIORITIZED):** temp 0 + seed 7 on all calls (`qwen/client.ts:28`), composite overwritten by a deterministic rubric-sum (`deepseek.ts:156-164`, HOOK_WEIGHT=0.80). But thinking-mode calls (fold, Apollo) carry residual provider noise. **Do NOT propose gating on a determinism band** (D-04). If anything, measure-first via two `measure-pipeline.ts` runs on the same video and report the score delta — don't pre-pick a tolerance.

**Question to resolve:** any remaining confident-looking fake numbers leaking to the board? Audit thread per D-15. Candidate: `rule_score:50` and `trend_score:0` are hardcoded fallbacks still on PredictionResult (`aggregator.ts:1101-1102`) — dead, set to constants, but if the board renders them they're misleading. Cross-check against Phase 2 board audit.

**Verification rig:** `measure-pipeline.ts` (prints OVERALL_SCORE/CONFIDENCE; run twice for determinism delta). Unit: `aggregator.test.ts`, `aggregator-anti-virality.test.ts`.

## ENG-05 — Read-model re-audit & drift hardening

**D-10 — read model choice REOPENED.** flash was chosen on a **2-video speed A/B** (`qwen/client.ts:31-35`): "36→17s, substrate held/richer." That's a thin sample. The latency budget now allows plus (D-08/D-09).

**What a read-quality re-audit needs:** compare flash vs plus on real videos for **verbatim richness** (hook_verbatim spoken_words/on_screen_text, per-segment spoken_text), **emotion_arc** (point count + label validity), and **segments** (boundary quality). Rollback lever exists: `QWEN_OMNI_MODEL=qwen3.5-omni-plus`.

**Existing drift guards (D-11) — the boundary is already partly hardened:**
- **weakest_modality** (`schemas.ts:31-51`): drift guard already in place — `.optional().catch(undefined)` + a transform that DERIVES it from the 4 hook scores if the model omits/drifts it. Never nukes the call. This is the pattern D-11 wants.
- **emotion_arc.label** (`schemas.ts:81-95`): synonym-normalization preprocessor (`medium`→`mid`, `Low`→`low`, etc.) + `.optional().catch(undefined)`. Was failing ~50% of responses before the guard (05-HUMAN-UAT note).
- **hook_verbatim** (`schemas.ts:202-205`): `.optional()`, nullable per-field, max-280. Threaded through carefully (`omni-analysis.ts:290-296` — the "do NOT remove, re-introduces the drop" warning).
- **segments** (`schemas.ts:213-222`): inline parse-time shape MUST mirror the exported `SegmentSchema` (PITFALL 4 note — a field absent from one shape gets stripped).

**The drift-guard gap D-11 targets:** the guards are **drop-to-undefined** (graceful), but there's **no bounded retry on empty/malformed CRITICAL fields** and **no validation logging when fields drift**. Currently a drifted emotion_arc.label silently becomes undefined with no telemetry. D-11 wants: Zod guard (exists) + bounded retry on critical-field emptiness + drift logging.

**The envelope new guards must fit (Established Pattern):** stable cached system prompt + volatile user message + temp 0 + seed + (for Apollo) circuit breaker + bounded retry. Read has MAX_RETRIES=1 (`omni-analysis.ts:25`) but the retry only fires on **whole-response** Zod fail/JSON error, NOT on a *valid-but-empty critical field*. D-11's bounded retry would need to detect "parsed OK but emotion_arc empty / hook_verbatim null on a speech video" and retry the user message (preserving the cached system prefix, per the Apollo retry-nudge pattern `deepseek.ts:409-415`).

**Options:**
- **A:** keep flash, add the missing critical-field retry + drift logging (D-11). Lowest latency cost.
- **B:** flip to plus if the re-audit shows meaningfully richer substrate (D-10), THEN add the same D-11 guards on whichever model wins.

**Verification rig:** `apollo-core-smoke.ts` (prints the read's sensor signals), `measure-pipeline.ts` (prints emotion_arc point count). Unit: `omni-analysis-emotion-arc.test.ts`, `omni-analysis-verbatim.test.ts` (already cover the guards). A flash-vs-plus A/B is a new throwaway script or an env-flip + two smoke runs.

**Co-review point (D-10/D-11):** model flip decision + per-field drift-guard strategy (Claude's Discretion within D-11, but surfaced to Davide before applying).

## ENG-06 — Qwen prompt I/O review (all 3 calls, step-by-step with Davide)

**The 3 prompt builders to walk (D-12):**

| Call | System prefix (cached) | Volatile user message | File:line |
|------|------------------------|------------------------|-----------|
| Read | `buildSystemPrompt()` — full JSON schema spec + rules (byte-stable since T3.4 moved niche hints out) | `buildUserHints()` + video + "Analyze this TikTok video…" | `omni-analysis.ts:63-178` |
| Fold | `STABLE_FOLD_SYSTEM_PROMPT` — 10 archetype defs + Critical Divergence Requirement | `buildFoldUserContent()` — video + verbatim + segment grid + emotion arc + slot assignments | `fold-prompts.ts:34-206` |
| Apollo | `APOLLO_SYSTEM_PROMPT` = KNOWLEDGE_CORE (lean) + APOLLO_INSTRUCTION | `buildDeepSeekUserMessage()` — verbatim hook/segments + Omni signals (scores stripped) + creator context + JSON output contract | `deepseek.ts:244-356`, `apollo-core.ts` |

**D-13 — the T3.x trims, each located with its version.ts rationale (audit restore-vs-keep per item):**

| Trim | What was dropped | Original rationale (version.ts) | Restore-vs-keep evidence |
|------|------------------|----------------------------------|--------------------------|
| **T3.1** | §2.6/§7/§8 + header meta from KNOWLEDGE_CORE lean variant | v3.12.0: "sections the rubric never scores against" | Keep is defensible (§2.6 empty, §8 bookkeeping) — but ties directly into ENG-02 §-grounding decision. Audit together. |
| **T3.2** | "## Rule Matches" + "## Trend Context" from Apollo user msg | v3.11.0 / `deepseek.ts:285-290`: both stages removed; injected phantom-system text the model could weight | Keep — clean dead-text removal, no downside. |
| **T3.3** | Apollo `behavioral_predictions` ask gated to text mode only | v3.12.0 / `deepseek.ts:303-316`: on video the fold owns audience prediction; Apollo's 4 numbers were discarded | Keep on video — but verify the fold actually always supplies them (ENG-01 fold-failure path drops them). Schema made `.optional()` (`types.ts:822`). |
| **T3.4** | niche/content-type hints moved omni SYSTEM→USER message | v3.12.0: prefix-cache was busting per niche | Keep — pure cache-efficiency win, byte-stable prefix. |
| **fold reason drop** | per-segment `reason` field dropped from fold output | v3.6.0 / `fold-prompts.ts:208-217`: packed then hardcoded `{}` at serving boundary, rendered nowhere; was the 25↔62s latency jitter | Keep — dead output, latency win. |
| **budget trims** | Apollo 3000→1500, fold 8000→4000 max_tokens | v3.6.0: A/B showed insight not thinking-bound | Keep — but re-validate if read/core changes shift the input size. |

**D-14 — consumed-vs-dead output field map (map BEFORE tightening Zod):**

| Apollo output field | Consumed by | Status |
|---------------------|-------------|--------|
| `component_scores` (7) | `aggregator.ts:763-774` → behavioral_score (but behavioralSource defaults to "fold", so on video the FOLD aggregate wins; component_scores feed behavioral_score only as the blend term + FeatureVector) | **Partially live** — feeds behavioral_score blend term + persisted feature_vector |
| `composite_score` | overwritten by deterministic rubric-sum (`deepseek.ts:156-164`), then → apollo_score (`aggregator.ts:792`) → blend | **Live** (but LLM's own value is discarded — only the dimension scores matter) |
| `dimensions` (6) | `apollo_reasoning.dimensions` → InsightHeroFrame DimensionRow | **Live** (board hero) |
| `rewrites` (2–3) | `apollo_reasoning.rewrites` → InsightHeroFrame RewriteItem | **Live** (board hero) |
| `ceiling_capper` | InsightHeroFrame lead line (`:303`) | **Live** (the hero LEAD) |
| `confidence_scope` | InsightHeroFrame caveat (`:307`) | **Live** |
| `platform_note` | InsightHeroFrame (`:313`) | **Live** |
| `suggestions` | `aggregator.ts:930` → PredictionResult.suggestions | **Live** |
| `warnings` | InsightHeroFrame fatal-flaw bullets (`:222`) | **Live** |
| `behavioral_predictions` | on video: NOT asked (T3.3); fold owns it | **Dead on video, live on text** |
| `confidence` | `calculateConfidence` deepseekConfidence arg | **Live** |

Fold output: all consumed (personaSimResults → behavioral aggregate + heatmap). Read output: rich — many fields feed FeatureVector (persisted for the learning loop) but some are score-machinery the demoted score barely uses (`rule_score`/`trend_score` hardcoded constants `aggregator.ts:1101-1102`). The D-14 map above is the starting point; the full Read-field consumed-vs-dead audit is a co-review task.

**Co-review point (D-12/D-13/D-14):** all 3 prompts walked step-by-step with Davide; each T3.x trim decided restore-vs-keep from the evidence above; the dead-field prune list confirmed before any Zod tightening.

## Runtime State Inventory

This phase edits engine code + prompts; it touches stored/cached state via the cache-key invariant.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `analysis_results` rows carry `signal_availability` JSONB, `engine_version`, `variants.apollo` (Apollo §4 output persisted for permalink). Cached predictions in `prediction-cache.ts` (L1 in-mem 24h + L2 Supabase) keyed on `hash::ENGINE_VERSION::userId`. | **Any output-shape change (ENG-02 remap/redesign, ENG-04 partial flag, ENG-06 schema tighten) MUST bump `version.ts`** — else stale cached rows serve old-shape results. Also update `version.test.ts:9` (hardcodes "3.13.0"). |
| Live service config | DashScope models are env-overridable (`QWEN_OMNI_MODEL`, `FOLD_MODEL`, `DEEPSEEK_THINKING_BUDGET`, etc.) — runtime envs in Vercel, NOT in git. | If a read-model flip (D-10) is made the default, change `qwen/client.ts:36` default AND any Vercel env override; document. |
| OS-registered state | None — no schedulers/daemons embed engine strings. | None. |
| Secrets/env vars | `DASHSCOPE_API_KEY`, `APIFY_TOKEN`, Supabase keys — referenced by name, not renamed this phase. | None — code-only refine, no secret renames. |
| Build artifacts | `_dormant/` directories hold cut modules (ml, stage11, platform_fit, corpus eval) — referenced in comments, not imported. | None unless a dormant module is revived (not in scope). |

**The canonical cache invariant (flag everywhere):** `version.ts:63-65` + ENGINE-MAP note — ENGINE_VERSION is the cache key. The planner MUST add a `version.ts` bump task to any plan that changes Apollo/fold/read OUTPUT shape or the KNOWLEDGE_CORE system-prefix bytes. Prompt-only changes that alter the cached system prefix also shift cache behavior (they bust the DashScope prefix-cache, a latency concern, not a correctness one).

## Common Pitfalls (engine-specific, from inline code warnings)

### Pitfall 1: Dropping a Zod-parsed field in the assembly cast
**What goes wrong:** `emotion_arc`/`hook_verbatim` ride through `as GeminiVideoAnalysis` casts (`omni-analysis.ts:289-296`); the original bug dropped emotion_arc on 100% of rows despite the prompt marking it required.
**How to avoid:** the inline warnings say "do NOT clean up by removing it." When tightening schemas (D-14), preserve the cast-threaded fields. Both the inline parse shape AND the exported SegmentSchema must declare per-segment verbatim (`schemas.ts:110-119` PITFALL 4).

### Pitfall 2: Raising a timeout instead of lowering a budget
**What goes wrong:** the fold's `PER_CALL_TIMEOUT_MS=90s` is a HARD ceiling, not a soft limit (`fold.ts:43-56`); raising it defeats the whole "fold beats 10-pass" premise.
**How to avoid:** if a fold change needs more headroom, lower `FOLD_THINKING_BUDGET`/`FOLD_MAX_TOKENS`, never raise the timeout.

### Pitfall 3: Forgetting the version bump on an output change
**Warning sign:** stale cached rows serving old-shape results after a deploy. Always pair an output/schema change with `version.ts` + `version.test.ts`.

### Pitfall 4: Putting volatile data in the cached system prefix
**What goes wrong:** busts the DashScope prefix-cache (T3.4 fixed exactly this). All per-request data goes in the USER message; system prefix stays byte-stable.

### Pitfall 5: Assuming the board has a §-cite bug
**What goes wrong:** ENG-02 reads like "fix dangling §-cites on the board." The board renders cites as opaque strings — the only §-aware code is one `includes('§2.2')` check. The grounding fix is **engine-side honesty** (D-05), not a board render fix.

## Validation Architecture

`nyquist_validation: true` in config.json — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) |
| Config file | (vitest picks up project config; tests in `src/lib/engine/__tests__/`) |
| Quick run | `npx vitest run src/lib/engine/__tests__/<file>.test.ts` |
| Full suite | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Command | Exists? |
|--------|----------|-----------|---------|---------|
| ENG-01 | Pipeline E2E correctness, fallback paths | integration + live | `npx vitest run src/lib/engine/__tests__/pipeline.test.ts`; live: `scripts/smoke-tiktok-pipeline.ts` | ✅ |
| ENG-02 | Apollo §-cites resolve to real core | live A/B | `pnpm tsx scripts/apollo-core-smoke.ts "<video>"` | ✅ (rig); ❌ a §-resolution unit test if remap chosen → Wave 0 |
| ENG-03 | Per-stage latency + parallelism | live | `npx tsx scripts/measure-pipeline.ts "<video>"` | ✅ |
| ENG-04 | Engagement range grounding, honesty flags, ensemble | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts` | ✅ |
| ENG-05 | Read drift guards (emotion_arc.label, weakest_modality, verbatim) | unit | `npx vitest run src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts omni-analysis-verbatim.test.ts` | ✅; ❌ critical-field retry test if D-11 retry added → Wave 0 |
| ENG-06 | Apollo prompt contract / schema | unit | `npx vitest run src/lib/engine/__tests__/deepseek.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** the relevant unit test file (sub-30s).
- **Per wave merge:** `npm test` (full engine suite).
- **Phase gate:** full suite green + at least one live rig run on a real video before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] If ENG-02 **remap** chosen: a unit test asserting emitted §-cites resolve to a whitelist (new).
- [ ] If ENG-05 **D-11 critical-field retry** added: a unit test for "parsed-OK-but-empty-critical-field → retry" (new).
- [ ] Otherwise: **None — existing ~38 engine test files cover all current behavior.** Live rigs (`measure-pipeline`, `smoke-tiktok-pipeline`, `apollo-core-smoke`) cover E2E per D-02.

## Security Domain

Engine refine handles **untrusted LLM output** as its primary boundary; ASVS V5 (input validation) is the live category.

| ASVS Category | Applies | Standard control (as-built) |
|---------------|---------|------------------------------|
| V5 Input Validation | yes | Zod `safeParse` at every model boundary + post-parse clamps (`deepseek.ts:128-190`, `schemas.ts`, `fold-prompts.ts:245`). LLM output is untrusted — preserved on any schema change. |
| V6 Cryptography | no | No new crypto. |
| V2/V3/V4 Auth/Session/Access | no | Engine runs server-side behind existing auth (route layer, out of scope). |

| Threat | STRIDE | Mitigation (as-built — preserve) |
|--------|--------|----------------------------------|
| Apify token leak to DashScope | Information Disclosure | tiktok_url path downloads server-side with token, re-hosts to a short-TTL signed URL, NEVER puts token in the URL fed to Omni; derive-and-drop unconditional cleanup (`pipeline.ts:400-496`). Do NOT regress this in any read-path change. |
| Malformed LLM JSON → crash/throw | Tampering / DoS | bounded retry + circuit breaker + graceful null fallback (no thrown frames) — the ENG-01 audit must preserve this. |
| Fabricated metrics shown as real | (Honesty/integrity) | Math.sin jitter deleted; engagement range null-when-no-baseline; `analysis_unavailable` flag (ENG-04). Preserve. |

## State of the Art

| Old Approach | Current Approach (v3.13.0) | When Changed | Impact |
|--------------|----------------------------|--------------|--------|
| ~24 LLM calls, ~332s, over cap | 3 calls (~70s) | 3.0→3.13 | The cut already happened — this phase REFINES, not re-cuts |
| Score = one Apollo call graded twice | True ensemble 0.5·apollo + 0.5·fold | v3.10.0 | Fold now in the headline number |
| Fabricated Math.sin engagement | Grounded follower×quality range or null | (Plan 02 / R9) | Honesty fixed |
| Blind/text fold + blind reasoner | Sense-complete (both watch video) | v3.9.0 | Read substrate quality matters more (ENG-05) |
| Full KNOWLEDGE_CORE in prefix | Lean variant (§2.6/§7/§8 dropped) | v3.12.0 T3.1 | The ENG-02 grounding question |

**Deprecated/dormant (do not revive this phase):** ml.ts, stage11-counterfactuals, platform_fit, audio-fingerprint, trends, rule semantic tier, 10-pass personas — all in `_dormant/` or hardcoded-constant fallbacks.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Latency numbers (~17s read, ~54s fold, ~49s Apollo, ~70s E2E) are from version.ts/inline A/B notes, NOT measured this session | ENG-03 | Plan over/under-estimates free latency budget — MITIGATED: D-02 says measure-first via measure-pipeline.ts before deciding |
| A2 | Apollo rarely emits a §2.6/§7/§8 dangling cite at runtime (the lean core omits them) — but unverified on live output | ENG-02 | If it does emit them, the dangling-cite risk is higher than "low" — MITIGATED: apollo-core-smoke.ts run answers this directly (D-07) |
| A3 | `rule_score:50`/`trend_score:0` constants on PredictionResult are dead (not rendered) — board consumption is a Phase 2 concern | ENG-04 | If the board renders them they're misleading fake numbers — cross-check in Phase 2 |
| A4 | DashScope qwen3.5-omni-flash/plus + qwen3.6-plus model IDs are current/valid — taken from as-built env defaults, not re-verified against DashScope docs this session | Stack | A model deprecation would break the engine — these are SHIPPED + running, so live-validated by production; re-verify only if a flip is proposed |

## Open Questions (RESOLVED — deferred to execution checkpoints per D-00)

> These are not unresolved research gaps. Per D-00 (human-in-the-loop), each is a live
> decision wired to a blocking co-review checkpoint task, fed by an evidence-gathering
> audit: Q1 → Plan 01-01 Task 2 · Q2 → Plan 01-02 Task 2 · Q3 → Plan 01-04 Task 2.
> Pre-resolving them in research would violate D-00.

1. **Which §-grounding option does Davide want (restore/remap/redesign)?** → gated by Plan 01-01 Task 2
   - Known: the board has no §-cite bug; the engine emits free-text cites into §2.x/§4 which are present in the lean core; §2.6/§7/§8 are dropped + §2.6 is empty.
   - Unclear: whether the dangling-cite risk justifies a fundamental redesign (D-06) or just a remap guard.
   - Recommendation: run `apollo-core-smoke.ts` FIRST, then co-review the three options.

2. **Flip read flash→plus (D-10)?** → gated by Plan 01-02 Task 2
   - Known: flash picked on 2 videos; budget allows plus.
   - Unclear: real richness delta on a wider sample.
   - Recommendation: env-flip A/B (two smoke runs) before deciding.

3. **Should single-signal failure (not just dual) get a user-visible honesty annotation (ENG-01 + D-15)?** → gated by Plan 01-04 Task 2
   - Recommendation: surface to Davide; cheap output-flag add but needs version bump.

## Sources

### Primary (HIGH — direct code evidence)
- `src/lib/engine/version.ts`, `pipeline.ts`, `qwen/omni-analysis.ts`, `qwen/client.ts`, `qwen/schemas.ts`, `wave3/fold.ts`, `wave3/fold-prompts.ts`, `deepseek.ts`, `apollo-core.ts`, `aggregator.ts`, `types.ts` — read in full or in the relevant ranges.
- `src/components/board/InsightHeroFrame.tsx` — ENG-02 board-expectation finding.
- `src/lib/chat/seed-context.ts:90-106` — the chat fake-legend §-scheme (Phase 4 scope).
- `.planning/corpus/KNOWLEDGE-CORE.md` — full §-taxonomy.
- `scripts/measure-pipeline.ts`, `smoke-tiktok-pipeline.ts`, `apollo-core-smoke.ts` — verification rigs.
- `.planning/phases/01-engine-pipeline/01-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`, `ENGINE-MAP.md` — context.

### Secondary (MEDIUM)
- version.ts change-history comments (self-reported A/B results, not re-measured this session — see A1).

## Metadata

**Confidence breakdown:**
- ENG-01/04/06 (as-built tracing): HIGH — direct line evidence.
- ENG-02 grounding: HIGH on the scheme-mapping facts; MEDIUM on live dangling-cite incidence (A2 — needs apollo-core-smoke run).
- ENG-03 latency: HIGH on the parallelism/knob map; MEDIUM on absolute numbers (A1 — version.ts-reported, measure-first per D-02).
- ENG-05: HIGH on existing guards; the flash-vs-plus delta is unmeasured (D-10 reopens it).

**Research date:** 2026-06-09
**Valid until:** ~30 days (stable codebase; re-verify model IDs only if a flip is proposed).
