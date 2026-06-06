---
phase: 05-wire-surface
reviewed: 2026-06-06T21:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/lib/engine/types.ts
  - src/lib/engine/apollo-core.ts
  - src/lib/engine/deepseek.ts
  - src/lib/engine/version.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/panel-mapping.ts
  - src/components/board/InsightHeroFrame.tsx
  - src/components/board/board-types.ts
  - src/components/board/board-constants.ts
  - src/components/board/Board.tsx
  - src/app/(app)/analyze/[id]/result-card.tsx
  - src/components/app/simulation/results-panel.tsx
  - src/components/app/simulation/EngagementRangeCard.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: resolved
remediation:
  resolved_in: 7ab7ffd9
  critical_fixed: 2   # CR-01 score-field blueprint, CR-02 composite comment
  warning_fixed: 3    # WR-01 clipboard catch, WR-02 stable keys, WR-03 follower<=0 guard
  info_deferred: 2    # IN-01 dim-name uniqueness (schema .length(6)+enum mostly constrains), IN-02 D-08 hierarchy (subjective → UAT)
  guard_added: "3 prompt-contract tests on buildDeepSeekUserMessage (deepseek.test.ts)"
---

# Phase 05: Code Review Report

> **REMEDIATION (2026-06-06, commit 7ab7ffd9):** Both CRITICAL findings + all 3 WARNINGs fixed and verified (full suite 1834 green). CR-01/CR-02 were production-breaking *and* test-invisible — locked with a new prompt-contract guard. The 2 INFO findings are deferred (IN-01 largely constrained by schema; IN-02 is a subjective D-08 hierarchy call for human UAT).

**Reviewed:** 2026-06-06T21:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 05 implements the D-01 rubric-sum composite (deepseek.ts), R11 engagement range (aggregator.ts), InsightHeroFrame board surface, and EngagementRangeCard. The engine arithmetic, type schema, version bump, and UI dual-read are structurally sound. Two critical defects found: the volatile user-message output contract template was not updated when the system prompt (apollo-core.ts) was — the `dimensions` objects in the template omit the required `"score"` field, and the `composite_score` comment still says "Not arithmetic." These are LLM-instruction contradictions that will cause parse failures or silently degrade D-01 correctness. Three warnings cover an unguarded clipboard API rejection, index-based React keys, and a `follower_count=0` fabrication leak.

---

## Critical Issues

### CR-01: Dimensions output contract template omits required `score` field — LLM may omit it, causing Zod parse failure

**File:** `src/lib/engine/deepseek.ts:327-332`

**Issue:** `buildDeepSeekUserMessage` includes a JSON template showing exactly which fields to emit for each dimension object. The template reads:

```
{ "name": "hook", "band": "strong"|"mid"|"weak", "lever": "...", "evidence": "..." }
```

The `"score"` field — added to `ApolloDimensionSchema` as a **required** `z.number().min(0).max(100)` field by Plan 05-01 — is absent from this template. `apollo-core.ts` (`APOLLO_INSTRUCTION` step 1, `KNOWLEDGE_CORE §4` output contract) was correctly updated to require a numeric score per dimension. But the volatile user-message template is the _concrete JSON blueprint_ the model observes at inference time; it overrides the abstract system-prompt description in how-to-format-output. When an LLM follows this template literally and omits `"score"` from dimension objects, `DeepSeekResponseSchema.safeParse()` fails (`score` is required, not optional), throwing `"DeepSeek response validation failed"` — retried up to 3 times, then `reasonWithDeepSeek` returns `null`. Every request on that path degrades apollo composite to null and accumulates circuit-breaker failures.

The two halves of the instruction are now contradictory: the system prompt says "emit a numeric score," the user message template shows no `score` field. Models that follow the template fail Zod; models that ignore the template and follow the system prompt pass — non-deterministic between model versions/seeds.

**Fix:** Add `"score": <85|50|20>` to each dimension object in the template and update the inline comment:

```typescript
// in buildDeepSeekUserMessage, replace the dimensions block:
  "dimensions": [                        // EXACTLY 6, in this order
    { "name": "hook",        "band": "strong"|"mid"|"weak", "score": <85|50|20>,  "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "retention",   "band": "strong"|"mid"|"weak", "score": <85|50|20>,  "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "clarity",     "band": "strong"|"mid"|"weak", "score": <85|50|20>,  "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "share_pull",  "band": "strong"|"mid"|"weak", "score": <85|50|20>,  "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "substance",   "band": "strong"|"mid"|"weak", "score": <85|50|20>,  "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" },
    { "name": "credibility", "band": "strong"|"mid"|"weak", "score": <85|50|20>,  "lever": "<§2 lever>", "evidence": "<quoted sensor signal>" }
  ],
```

---

### CR-02: `composite_score` inline comment in user-message template contradicts D-01 — instructs LLM to emit a "holistic judgment, Not arithmetic"

**File:** `src/lib/engine/deepseek.ts:333`

**Issue:** The `composite_score` line in the output contract template reads:

```
"composite_score": <number 0-100>,     // ONE holistic, hook-weighted judgment (§2.0a ~80%). Not arithmetic.
```

Plan 05-01 inverted `APOLLO_INSTRUCTION` step 3 to say "emit per-dimension numeric scores — TypeScript computes the composite." But this comment in the volatile user message — which the model _reads at inference time_ — directly contradicts that: it tells the model to emit its own "holistic judgment" and explicitly says "Not arithmetic." Combined with CR-01 (no `score` field in dimensions template), models that comply with this comment will emit a hallucinated holistic composite and omit per-dimension scores. The D-01 post-parse overwrite in `parseDeepSeekResponse` still produces the correct deterministic sum — but only when the LLM emits scores. If it omits scores (following this instruction), Zod rejects, sum never runs, and the circuit breaker trips.

Even when scores are present, a model following "holistic judgment, Not arithmetic" may emit a `composite_score` optimized as a holistic rather than as arithmetic sum — which will be silently overwritten. This is functionally harmless post-overwrite but trains the model on a contradictory contract, increasing jitter across versions.

**Fix:** Update the comment to match the inverted contract:

```typescript
// Replace line 333:
"composite_score": <number 0-100>,     // TypeScript will compute this deterministically — emit any value; it is overwritten by the hook-weighted sum of dimension scores.
```

Or more precisely, to reduce token waste, drop the field from the template entirely and add a comment outside the JSON block explaining the post-parse overwrite.

---

## Warnings

### WR-01: `navigator.clipboard.writeText` unhandled rejection — silent failure in non-secure contexts

**File:** `src/components/board/InsightHeroFrame.tsx:96-99`

**Issue:** `handleCopy` calls `navigator.clipboard.writeText(rewrite.variant).then(...)` with no `.catch()`. The Clipboard API throws / rejects in: (a) non-secure contexts (HTTP), (b) when the user denies clipboard permission, (c) in some browser extensions that block clipboard access. The unhandled rejection will log an uncaught promise rejection to the console and leave the button in the default "Copy" state with no user feedback — silent failure.

**Fix:**

```typescript
function handleCopy() {
  navigator.clipboard.writeText(rewrite.variant).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }).catch(() => {
    // Clipboard API unavailable or denied — fallback: noop or show error state
    // Optional: setCopied(false); or a brief "Failed" label
  });
}
```

---

### WR-02: Index-based `key` props on `rewrites` and `dimensions` lists — stale React state risk on data updates

**File:** `src/components/board/InsightHeroFrame.tsx:289, 303`

**Issue:** Both `apollo.rewrites.map((rw, i) => <RewriteItem key={i} ...>)` and `apollo.dimensions.map((dim, i) => <DimensionRow key={i} ...>)` use array index as key. When `apollo` transitions from a live SSE partial to the full permalink result (or if the dual-read swaps sources), React reconciles by position rather than identity. `RewriteItem` holds `copied: boolean` state — if item order shifts (or items are prepended/inserted by a future change), the `copied` state will attach to the wrong rewrite.

Dimensions have stable `dim.name` values (always the same 6 names in a fixed schema-enforced order); rewrites have `rw.lever_fixed` which per D-08 must be distinct per rewrite. Both are stable, semantic keys.

**Fix:**

```typescript
// Rewrites — use lever_fixed (per D-08 they must be distinct per rewrite)
{apollo.rewrites.map((rw) => (
  <RewriteItem key={rw.lever_fixed} rewrite={rw} dropLabel={...} />
))}

// Dimensions — use dim.name (always unique: hook/retention/clarity/share_pull/substance/credibility)
{apollo.dimensions.map((dim) => (
  <DimensionRow key={dim.name} dim={dim} />
))}
```

---

### WR-03: `computeEngagementRange` passes `follower_count=0` through the null guard, producing a fabricated `0–1` range

**File:** `src/lib/engine/aggregator.ts:187`

**Issue:** The null guard correctly rejects `null` and `undefined` follower counts. But `follower_count=0` is a valid DB value (new account with no followers, or a data-pipeline zero-fill) and passes through. At `follower_count=0`, `mid_estimate=0` and `followerCount * uncertainty=0`, so `half_width=max(0,0)=0`, `lo=0`, `hi=0` — the `hi<=lo` backstop bumps `hi` to 1. The card renders "0 – 1" views with a confidence dot, which is factually nonsense and violates R9 honesty (fabricated range from a zero baseline).

**Fix:** Extend the guard to also reject `follower_count <= 0`:

```typescript
// src/lib/engine/aggregator.ts:187
if (
  creatorContext.follower_count === null ||
  creatorContext.follower_count === undefined ||
  creatorContext.follower_count <= 0          // add: 0 produces a nonsense 0-1 range
) {
  return null;
}
```

---

## Info

### IN-01: Rubric-sum does not guard against duplicate/missing `hook` dimension name — weight total drifts silently

**File:** `src/lib/engine/deepseek.ts:159-162`

**Issue:** The weight accumulation loop uses `dim.name === "hook"` to assign `HOOK_WEIGHT`. Zod validates that each dimension's `name` is one of the 6 enum values, and `.length(6)` requires exactly 6 items — but neither Zod nor the post-parse backstop enforces that each name appears exactly once. If the LLM emits two `"hook"` dimensions (and omits another, e.g. `"credibility"`), the sum becomes `2 × 0.80 + 4 × 0.04 = 1.76`. At max scores that clamps to 100 — silent over-inflation with no log warning. If the LLM emits zero `"hook"` dimensions, the sum becomes `6 × 0.04 = 0.24` max — a silently deflated composite that will not round-trip back to the correct 100 for a perfect input.

This is currently mitigated by the system prompt requiring the specific 6-name order and the post-parse `dimensions.length !== 6` log.warn. But there is no uniqueness check and no "hook must appear exactly once" assertion. The post-parse log.warn fires on wrong _count_, not on wrong _name distribution_.

**Suggestion:** Add a post-parse assertion after the dimensions length check:

```typescript
const hookCount = data.dimensions.filter(d => d.name === "hook").length;
if (hookCount !== 1) {
  log.warn("Apollo dimensions hook count wrong — rubric-sum weight total drifts", { hookCount });
}
```

---

### IN-02: `ceiling_capper` rendered as hero text (`confidence_scope`), not as ceiling text — field labels swapped in UI

**File:** `src/components/board/InsightHeroFrame.tsx:259-266`

**Issue:** The hero read section renders `apollo.confidence_scope` as the large `text-[15px] font-[500]` hero text and `apollo.ceiling_capper` as the smaller `text-[12px] text-white/50` subtitle. Per the Apollo schema and D-08 design: `ceiling_capper` is the "single thing capping the score" (highest-leverage, actionable) and should be the headline; `confidence_scope` is "which §2 signals the sensor could not provide" (limitations caveat) and should be the demoted copy. The current order surfaces the limitations caveat as the hero insight, which inverts the intended information hierarchy.

This is presentation only — no data correctness impact.

**Suggestion:** Swap the rendering order:

```tsx
{/* Hero read — ceiling_capper is the highest-leverage insight */}
<p className="text-[15px] font-[500] leading-[1.4] text-white">
  {apollo.ceiling_capper ?? apollo.confidence_scope}
</p>
{apollo.confidence_scope && (
  <p className="text-[12px] leading-[1.4] text-white/50">
    {apollo.confidence_scope}
  </p>
)}
```

---

_Reviewed: 2026-06-06T21:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
