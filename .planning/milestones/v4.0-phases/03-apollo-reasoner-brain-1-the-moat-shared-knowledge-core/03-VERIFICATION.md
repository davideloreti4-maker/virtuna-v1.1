---
phase: 03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core
verified: 2026-06-05T13:40:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
deferred:
  - truth: "Remix sibling persists (persistDecodeToVariants / persistCraftToVariants) scoped by user_id (CR-02 / WR-04)"
    addressed_in: "Security follow-up (next milestone)"
    evidence: "Pre-existing prior-phase code (craft/decode persist predate P3). Phase-owned persistApolloToVariants IS user_id-scoped (T-03-10 satisfied, route.ts:186/197). Acknowledged in 03-REVIEW.md as deferred."
  - truth: "impact-score.tsx Apollo breakdown bar sources real Apollo composite, not gemini_score (WR-02)"
    addressed_in: "Phase 5 (Wire + Surface — board renders rewrites + composite)"
    evidence: "UI surface owned by P5 (ROADMAP P5 goal: render rewrites + heatmap + estimate). Acknowledged stub at impact-score.tsx:64."
---

# Phase 3: Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core — Verification Report

**Phase Goal:** Establish the shared knowledge core and reframe `deepseek.ts` into the knowledge-grounded expert. The 0–100 is composed from named dimensions + confidence (not a black-box number). Build the distilled core as a byte-stable cached system prompt; wire into the score-mode reasoner; feed verbatim; extend output with rewrites + composite; drop calibration/percentile; keep infra. Ground Remix decode + adapt in the SAME core (R12).
**Verified:** 2026-06-05T13:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | apollo-core.ts exports byte-stable APOLLO_SYSTEM_PROMPT = KNOWLEDGE_CORE + APOLLO_INSTRUCTION, zero interpolation | ✓ VERIFIED | apollo-core.ts:27/257/276 (3 `export const`); :276 composition `${KNOWLEDGE_CORE}\n\n---\n\n${APOLLO_INSTRUCTION}`; zero `${` inside literal (sed 27-256 → 0); apollo-core.test.ts 16/16 green |
| 2 | KNOWLEDGE-CORE.md §2.0a carries ported outlier number (D-02), embedded in apollo-core.ts | ✓ VERIFIED | KNOWLEDGE-CORE.md:51 "Outlier benchmark … views ≥ 5× the creator's follower count (Ava)" inside §2.0a (header :38, §2.1 :53); identical line embedded at apollo-core.ts:77 |
| 3 | deepseek.ts uses APOLLO_SYSTEM_PROMPT as system prefix; STABLE_SYSTEM_PROMPT removed | ✓ VERIFIED | deepseek.ts:12 import, :377 `{ role: "system", content: APOLLO_SYSTEM_PROMPT }`; `STABLE_SYSTEM_PROMPT` grep = 0 |
| 4 | DeepSeekResponseSchema extended additively (6 dims + composite_score + rewrites[2-3] + confidence_scope) WITHOUT dropping legacy required fields | ✓ VERIFIED | types.ts:786 `.length(6)`, :787 `composite_score .min(0).max(100)`, :790 `rewrites .min(2).max(3)`, :789 `confidence_scope .min(1)`; legacy `behavioral_predictions`/`component_scores` still REQUIRED :780-781 |
| 5 | R2 verbatim backstop present (rewrite.original == fed verbatim hook, TS-enforced) | ✓ VERIFIED | deepseek.ts:147-160 normalize-whitespace compare, overwrites `original` from `verbatim.hook` on mismatch; user-message instruction :313/318 "copied EXACTLY"; deepseek.test.ts 32/32 green |
| 6 | creator-rules.ts prompt-injection constants dormanted; no live importers; rulebook untouched (D-01/D-03) | ✓ VERIFIED | live file absent; `_dormant/engine/creator-rules.ts` exists; `grep creator-rules"` (excl dormant/rulebook) = 0 matches; creator-rulebook.ts still live |
| 7 | aggregator blend = behavioral 40 + Apollo composite (renorm); gemini retired from raw_overall_score (D-04) | ✓ VERIFIED | aggregator.ts:71-73 `behavioral:0.40, apollo:0.35`; :79 `SCORE_WEIGHT_KEYS=["behavioral","apollo"]`; :732-738 `behavioral_score*weights.behavioral + apollo_score*weights.apollo`; :712 comment "gemini … NO LONGER feeds raw_overall_score" |
| 8 | apollo_reasoning surfaced on PredictionResult | ✓ VERIFIED | aggregator.ts:951-958 populates `{rewrites, dimensions, composite_score, confidence_scope}`; types.ts:296-299 fields |
| 9 | pipeline.ts threads verbatim hook into reasonWithDeepSeek | ✓ VERIFIED | pipeline.ts:726-755 plucks `hook_verbatim` → `VerbatimPayload` → passed as `verbatim` on DeepSeekInput at the :741 call site |
| 10 | route.ts persistApolloToVariants (read-merge-write, user_id scoped — T-03-10) | ✓ VERIFIED | route.ts:170-205; :184/192 read-merge `{...current, apollo}`; :186 SELECT `.eq("user_id", userId)`; :197 UPDATE `.eq("user_id", userId)` |
| 11 | version.ts ENGINE_VERSION 3.3.0 | ✓ VERIFIED | version.ts:13 `ENGINE_VERSION = "3.3.0"`; `"3.2.0"` grep = 0 in the export; lineage comment :7 documents P3 Apollo invalidation |
| 12 | remix decode-prompts.ts + adapt.ts re-grounded on KNOWLEDGE_CORE, output contracts byte-unchanged (R12/D-12) | ✓ VERIFIED | decode-prompts.ts:19 import, :31 prefix; adapt.ts:19 import, :35 prefix; decode 4-beat preserved (grep=3); adapt `length(3)` preserved; decode-types.ts git diff empty; adapt nudge off system (grep `ADAPT_SYSTEM_PROMPT + extraInstruction`=0); remix-core-grounding.test.ts 10/10 green |
| 13 | CR-03 adapt.ts unbounded-CoT timeout fixed | ✓ VERIFIED | adapt.ts:148-151 `max_tokens:1400 + enable_thinking + thinking_budget:2000`; commit b6e80b1c |

**Score:** 13/13 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | persistDecodeToVariants / persistCraftToVariants user_id scope (CR-02 / WR-04) | Security follow-up (next milestone) | Pre-existing prior-phase code; phase-owned persistApolloToVariants IS scoped (T-03-10 met). 03-REVIEW.md defers. |
| 2 | impact-score.tsx Apollo bar shows real composite not gemini_score (WR-02) | Phase 5 (Wire + Surface) | UI surface owned by P5; acknowledged stub at impact-score.tsx:64 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/apollo-core.ts` | 3 byte-stable constants | ✓ VERIFIED | 276 lines, single template literal, KNOWLEDGE-CORE.md source header (4 refs) |
| `.planning/corpus/KNOWLEDGE-CORE.md` | §2.0a outlier number | ✓ VERIFIED | line 51 |
| `src/lib/engine/deepseek.ts` | Apollo reasoner (core prefix + extended output + verbatim + backstop) | ✓ VERIFIED | core prefix :377, backstop :147, infra preserved (circuit breaker 13 refs) |
| `src/lib/engine/types.ts` | extended schema | ✓ VERIFIED | ApolloDimensionSchema/ApolloRewriteSchema :756/770; additive extension :786-790 |
| `src/lib/engine/_dormant/engine/creator-rules.ts` | dormanted | ✓ VERIFIED | exists; live removed |
| `src/lib/engine/aggregator.ts` | behavioral+apollo blend, verbatim, apollo_reasoning | ✓ VERIFIED | :71-79, :732-738, :951 |
| `src/lib/engine/pipeline.ts` | verbatim threaded | ✓ VERIFIED | :726-755 |
| `src/app/api/analyze/route.ts` | persistApolloToVariants user_id scoped | ✓ VERIFIED | :170-205 |
| `src/lib/engine/version.ts` | 3.3.0 | ✓ VERIFIED | :13 |
| `src/lib/engine/remix/decode-prompts.ts` | KNOWLEDGE_CORE grounded | ✓ VERIFIED | :19/31 |
| `src/lib/engine/remix/adapt.ts` | KNOWLEDGE_CORE grounded + token bound | ✓ VERIFIED | :19/35/148 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| deepseek.ts | apollo-core.ts | import APOLLO_SYSTEM_PROMPT as system | ✓ WIRED | :12 import, :377 system role |
| deepseek.ts | VerbatimPayload.hook | rewrite.original from fed hook | ✓ WIRED | backstop :147-160 |
| aggregator.ts | composite_score | apollo term in raw_overall_score | ✓ WIRED | :725/738 |
| aggregator.ts | reasonWithDeepSeek (via pipeline) | verbatim on DeepSeekInput | ✓ WIRED | pipeline.ts:741/755 |
| route.ts | variants.apollo | read-merge-write user_id | ✓ WIRED | :184-197 |
| decode-prompts.ts | apollo-core.ts | DECODE_SYSTEM_PROMPT prepends KNOWLEDGE_CORE | ✓ WIRED | :19/31 |
| adapt.ts | apollo-core.ts | ADAPT_SYSTEM_PROMPT prepends KNOWLEDGE_CORE | ✓ WIRED | :19/35 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| aggregator raw_overall_score | apollo_score | deepseek.composite_score (live Qwen call) | Yes — live checkpoint confirmed composite 76/71 on real video | ✓ FLOWING |
| deepseek rewrites[].original | verbatim.hook | pipeline plucks Omni hook_verbatim | Yes — live checkpoint: 3 rewrites grounded both runs | ✓ FLOWING |
| variants.apollo | finalResult.apollo_reasoning | aggregator populates from deepseek output | Yes — apollo_reasoning shape verified live; overall 68/72 (not 0, not stale) | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R2 | 03-01, 03-02 | Rewrites quote the creator's actual line (2–3 variants) | ✓ SATISFIED | TS backstop deepseek.ts:147; live checkpoint R2 PASS (all 3 rewrites grounded both runs) |
| R5 | 03-02, 03-04 | Honest expert score: overall = behavioral + Apollo composite, gemini retired (D-04), confidence renders | ✓ SATISFIED | aggregator.ts:732-738 blend; :712 gemini retired; calibration/percentile removed (deepseek grep=0); calculateConfidence Apollo-vs-behavioral |
| R12 | 03-03 | decode + adapt grounded in same core | ✓ SATISFIED | decode-prompts.ts:31 + adapt.ts:35 both prepend KNOWLEDGE_CORE; contracts unchanged; remix-core-grounding.test.ts 10/10 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| apollo-core byte-stability + composition | `vitest run apollo-core.test.ts` | 16 passed | ✓ PASS |
| deepseek Apollo schema + R2 backstop + distinct levers | `vitest run deepseek.test.ts` | 32 passed | ✓ PASS |
| remix decode+adapt reference KNOWLEDGE_CORE (R12) | `vitest run remix-core-grounding.test.ts` | 10 passed | ✓ PASS |
| full engine suite | `vitest run src/lib/engine` | 943 passed / 18 skipped | ✓ PASS |
| typecheck | `tsc --noEmit` | clean (exit 0) | ✓ PASS |
| Live E2E (R2/R6/R8) | orchestrator real-video run (b3b7bf2c) | R2 PASS, R6 117.7/119.2s under cap, R8 ±5 within noise band (user-approved) | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| route.ts | 228/239 | persistDecodeToVariants no user_id scope | ℹ️ Info | Pre-existing prior-phase code; deferred to security follow-up (CR-02). Phase-owned Apollo persist IS scoped. |
| route.ts | 132/142 | persistCraftToVariants no user_id scope | ℹ️ Info | Pre-existing prior-phase code; deferred (WR-04) |
| impact-score.tsx | 64 | apollo bar sources gemini_score | ℹ️ Info | Acknowledged stub; UI owned by P5 (WR-02) |
| deepseek.ts | — | post-parse backstop logs-but-continues on count mismatch | ℹ️ Info | WR-01; Zod `.length(6)`/`.min(2)` already throws upstream — block is defensive/unreachable on normal path |

No 🛑 Blocker anti-patterns. No unreferenced TBD/FIXME/XXX in phase-modified files.

### Human Verification Required

None pending. The blocking `checkpoint:human-verify` (R2/R8/R6) was executed live by the orchestrator on a real .mp4 (twice for the R8 band, commit b3b7bf2c) and user-approved. It surfaced + fixed two real bugs (Apollo §4 JSON contract gap; unbounded-CoT timeout). The only deferred live item — an authed row-write through `/api/analyze` — has its logic (read-merge-write + user_id + ENGINE_VERSION invalidation) unit-tested and was accepted as deferred.

### Gaps Summary

No gaps. All 13 must-haves verified against the actual codebase with file:line evidence. The phase goal is achieved: the shared knowledge core (apollo-core.ts) is byte-stable and embedded with the ported D-02 number; deepseek.ts is reframed as the Apollo reasoner consuming that core with an additively-extended dimension/composite/rewrites output and a TS R2 backstop; the blend is behavioral + Apollo with gemini retired; verbatim is threaded end-to-end; Apollo output persists to variants.apollo with user_id scoping; ENGINE_VERSION bumped to 3.3.0; and Remix decode + adapt both ground on the same KNOWLEDGE_CORE with their output contracts preserved. Success criteria R2, R5, R12 all SATISFIED. Gates green (tsc clean, 943/18 vitest, build success).

Two deferred items (CR-02/WR-04 sibling-persist user_id, WR-02 UI bar source) are pre-existing prior-phase code or P5-owned UI — not phase-blocking, documented in 03-REVIEW.md, and tracked in the `deferred` frontmatter.

---

_Verified: 2026-06-05T13:40:00Z_
_Verifier: Claude (gsd-verifier)_
