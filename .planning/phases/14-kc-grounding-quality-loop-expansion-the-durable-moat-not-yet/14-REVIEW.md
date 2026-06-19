---
phase: 14-kc-grounding-quality-loop-expansion
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/lib/engine/wave3/niche-resolver.ts
  - src/lib/engine/wave3/persona-registry.ts
  - src/lib/engine/flash/rubric-critic.ts
  - src/lib/engine/flash/flash-aggregate.ts
  - src/lib/tools/runners/ideas-runner.ts
  - src/lib/tools/runners/hooks-runner.ts
  - src/lib/tools/blocks.ts
  - src/lib/kc/assembler.ts
  - src/lib/kc/profile-role-map.ts
  - src/lib/kc/kc-version.ts
  - src/lib/kc/compiled.ts
  - src/components/thread/idea-card-block.tsx
  - src/components/thread/hook-card-block.tsx
  - src/components/command-bar/ExpertChatThread.tsx
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 14 (compiled.ts not read line-by-line — generated artifact, per instruction)
**Status:** issues_found

## Summary

Phase 14 wires three moat-spine changes: a runner-layer niche resolver, a parallel fail-safe Flash rubric-critic, and a combined SIM+critic gate with bounded single-regen. The core safety properties hold up well under scrutiny:

- **rubric-critic.ts is correctly fail-safe.** `critiqueAgainstRubric` wraps the entire body in try/catch and returns `FAIL_SAFE` on transport/parse/shape error — it cannot throw into the runner's `Promise.all`. Coercion errs strict (anything not an unambiguous `pass:true` → fail). Timer cleanup is correct.
- **Parallelism is genuine.** Both runners run `[SIM, critic]` inside a single inner `Promise.all`, itself mapped over candidates in an outer `Promise.all`. No `await` in a loop. Wall-clock stays ~1x as claimed.
- **Regen is bounded.** Exactly one extra `gatePass`/`gateHooks` on all-fail; no loop. "0 blocks is valid" preserved.
- **`predictedFailureMode` is non-breaking.** `.nullable().optional()` on non-strict zod objects — old persisted cards rehydrate fine, no migration.
- **HONESTY-01 citation removal is clean.** No dangling refs to `CORPUS_SECTIONS` / `insertCitationMarkers`; `code` component still spreads `{...props}` correctly.
- **Voice promotion is safe.** Dropping the tail `platform` role line cannot strip load-bearing data — platform is duplicated in the always-present header, and the SIM niche comes from `resolveNicheKey` not the bundle.

No blockers. The findings below are quality/robustness regressions and correctness edge cases — most important: the combined gate now lets a transient critic-only failure silently suppress Strong candidates with no warning, and the resolver's substring fallback can mis-route on cross-niche token collisions.

## Warnings

### WR-01: Critic-only infra failure silently drops Strong candidates with no warning

**File:** `src/lib/tools/runners/ideas-runner.ts:332,348-350` and `src/lib/tools/runners/hooks-runner.ts:360,374-376`
**Issue:** The combined gate requires `band !== "Weak" AND verdict.pass`. `critiqueAgainstRubric` is fully fail-safe: on ANY error (timeout, 429 rate-limit, transient 5xx) it resolves to `{ pass: false }`. Because the critic and the SIM hit the SAME DashScope backend with `maxRetries: 0` (qwen/client.ts:15), a candidate whose SIM call succeeds (Strong band) but whose critic call is rate-limited or times out is silently dropped. Unlike SIM failures — which push a message to `allWarnings` (ideas-runner.ts:329, hooks-runner.ts:357) — critic failures are swallowed inside `critiqueAgainstRubric` and produce no warning, no log, no telemetry. Under partial backend pressure this can zero out an entire generation that the SIM judged Strong, and the operator gets an empty thread with no diagnostic.
**Fix:** Surface critic outcome to the runner so abstentions are observable, e.g. distinguish "critic failed" from "critic judged fail":
```ts
// in rubric-critic: return a discriminated abstain reason, or expose a second return
// channel; minimally, have the runner record a warning when verdict came from the
// fail-safe path. One option — return a sentinel:
const FAIL_SAFE: RubricVerdict = { pass: false, predictedFailureMode: null, abstained: true };
// runner:
if (verdict.abstained) allWarnings.push(`critic abstained (infra) for "${idea.title}" — gated on SIM band only`);
// and consider: on abstain, fall back to band-only gate rather than hard-failing the candidate,
// so an outage degrades quality gracefully instead of producing zero cards.
```

### WR-02: Niche resolver substring fallback mis-routes on cross-niche token collisions

**File:** `src/lib/engine/wave3/niche-resolver.ts:74-92`
**Issue:** Step 4's `norm.includes(subSlug)` / `norm.includes(subLabel)` contains-check iterates NICHE_TREE in declared order and returns the FIRST top-level instantiation key whose slug/label OR any sub-slug/label is a substring of the input. Because earlier niches are tested first, a free-text value containing a token owned by an earlier niche resolves there even when a later niche is the true match. Concrete: `"history of fashion"` → `education` (sub `history` matches at the education iteration before `fashion-style` is ever reached), not `fashion-style`. `"travel vlogs about food"` → `lifestyle` (sub `travel`) before `food-cooking`. The resolved key then drives the entire SIM persona panel, so a mis-route silently mis-grounds the whole generation — the exact failure class this resolver exists to fix, re-introduced in a subtler form.
**Fix:** Prefer specificity over declaration order in the contains pass: collect ALL matches, then rank by match length (longest token wins) before falling back to declaration order; or restrict the contains fallback to top-level slug/label only (drop the sub-slug contains branch, which is the collision source) and rely on the exact sub-slug→parent walk in step 3 for sub-level resolution:
```ts
// step 4: gather candidates, pick the longest-token match (most specific) deterministically
let best: { key: string; len: number } | null = null;
for (const top of NICHE_TREE) {
  if (!isNicheInstantiationKey(top.slug)) continue;
  for (const token of [normalize(top.slug), normalize(top.label),
       ...top.subs.flatMap(s => [normalize(s.slug), normalize(s.label)])]) {
    if (norm.includes(token) && (!best || token.length > best.len)) best = { key: top.slug, len: token.length };
  }
}
return best?.key ?? null;
```

### WR-03: Bare common niche terms fail to resolve (silent generic fallback for the most common input)

**File:** `src/lib/engine/wave3/niche-resolver.ts:64-92`
**Issue:** The resolver's motivating example in the docstring is `personal-finance`, which works via the step-3 sub-slug walk. But the much more common free-text value `"finance"` does NOT resolve: it is not a top-level key, not a sub-slug (`personal-finance` ≠ `finance`), and the contains pass tests `norm.includes(subSlug)` = `"finance".includes("personal-finance")` = false (wrong direction for the short input). Same for `"tech"` (sub is `tech-gadgets`/`ai-tools` etc. — `"tech".includes("tech-gadgets")` is false), `"food"`, `"makeup"` alone (`"makeup".includes(...)` — actually `makeup` IS a sub so this one works). The net effect: short, single-word niche values — the most likely free-text production input — fall through to the honest generic path, defeating the discrimination the phase is trying to restore.
**Fix:** Add the reverse-contains direction for short inputs in step 4 (does a slug/label CONTAIN the input?), gated on a minimum input length to avoid noise:
```ts
if (norm.length >= 3 && (topSlug.includes(norm) || topLabel.includes(norm))) return top.slug;
for (const sub of top.subs) {
  if (norm.length >= 3 && (normalize(sub.slug).includes(norm) || normalize(sub.label).includes(norm)))
    return top.slug;
}
// "finance" ⊂ "personal-finance" → education; "tech" ⊂ "tech-gadgets" → tech-gadgets
```

### WR-04: Idea pin vector can be computed from a Strong candidate that the critic rejected

**File:** `src/lib/tools/runners/ideas-runner.ts:345,353,421` and `src/lib/tools/runners/hooks-runner.ts:479`
**Issue:** FLYWHEEL-02 pins the predicted disposition vector. In ideas-runner `firstSimPersonas` is set (line 345) for every candidate whose SIM resolved — BEFORE the combined gate runs (lines 348-350). When zero candidates pass the gate, `leadPersonas` stays null and the pin falls back to `firstSimPersonas` (line 421) — i.e. the personas of a candidate the critic explicitly rejected as slop. The flywheel then learns its "predicted signature" from content the system decided NOT to surface, polluting the moat's outcome-loop substrate. Hooks-runner has the analogous path: `survivors[0]?.personas` (line 479) is only reached when `ranked[0]` exists, so it is safer, but the ideas fallback to `firstSimPersonas` crosses the gate boundary.
**Fix:** Only fall back to non-gated personas when a gate survivor genuinely never existed across BOTH batches, and prefer the gated lead. Minimally, gate the fallback on "a survivor existed at some point", or drop the `firstSimPersonas` fallback entirely so a zero-survivor run pins nothing:
```ts
// pin only the gate-passing lead; if none passed, do not pin a rejected vector
const pinnedPersonas = leadPersonas; // remove ?? firstSimPersonas
if (input.pin && pinnedPersonas && pinnedPersonas.length > 0) { /* ... */ }
```

### WR-05: `void resolvedWeights` dead-computes a value on every run in both runners

**File:** `src/lib/tools/runners/ideas-runner.ts:292-293` and `src/lib/tools/runners/hooks-runner.ts:319-320`
**Issue:** `resolveAudienceWeights(audience ? [audience] : [])` is invoked and its result immediately discarded with `void resolvedWeights` ("wired for future Max-path integration"). This runs unconditionally on every generation, executing whatever resolution logic that function performs, with the result thrown away. It is dead computation that obscures intent (a reader cannot tell whether the weights matter) and risks a silent behavior coupling if `resolveAudienceWeights` ever has side effects. Out-of-scope as a perf issue, but it is a maintainability/correctness-clarity defect: code that computes-and-discards reads as a bug to the next maintainer.
**Fix:** Remove the call until the Max path actually consumes it, or guard it behind the feature that will use it. If kept as a deliberate forward-wire, narrow it: `// resolveAudienceWeights wired in 07-04; Max-path consumer lands in P15 — intentionally not called yet.` and delete the invocation.

### WR-06: `reducedMotion` captured once at mount, never updates on preference change

**File:** `src/components/command-bar/ExpertChatThread.tsx:57-60`
**Issue:** `reducedMotion` is read synchronously from `window.matchMedia(...).matches` during render and stored as a plain const (not state, no `addEventListener('change')`). If the user toggles "reduce motion" while the panel is open, the streaming caret/dots/pulse keep animating (or stay disabled) until the component remounts. This is an accessibility-correctness gap for a setting that is explicitly honored elsewhere in the file. It also computes on every render rather than subscribing.
**Fix:** Subscribe to the media query:
```ts
const [reducedMotion, setReducedMotion] = useState(false);
useEffect(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  setReducedMotion(mq.matches);
  const on = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}, []);
```

## Info

### IN-01: Dead no-op statement in niche-resolver

**File:** `src/lib/engine/wave3/niche-resolver.ts:95`
**Issue:** `void NICHE_INSTANTIATION_KEYS;` with the comment "keyset is the source of truth" is a no-op that references an imported value solely to suppress an unused-import lint. The import is otherwise unused (`isNicheInstantiationKey` is what's actually used). It reads as accidental.
**Fix:** Remove the `void` statement and the unused `NICHE_INSTANTIATION_KEYS` import from the destructured import block (lines 30-33), keeping only `isNicheInstantiationKey`.

### IN-02: Hook card hardcodes `platform: 'tiktok'` for the rewrite/lens

**File:** `src/components/thread/hook-card-block.tsx:141`
**Issue:** `buildCardRewrite({ ..., platform: 'tiktok' })` and the `LensTrigger` for hooks hardcode TikTok, while the idea card reads the real platform from `usePlatform()` (idea-card-block.tsx:65). A hook generated for Instagram/YouTube will produce a TikTok-framed rewrite. Likely acceptable for v1 (TikTok-first) but it is an inconsistency vs the idea card and a latent correctness gap when multi-platform lands.
**Fix:** Read platform from `usePlatform()` as the idea card does, and pass it to both `LensTrigger` and `buildCardRewrite`.

### IN-03: `@ts-expect-error` used to attach temperature/seed instead of typing the call

**File:** `src/lib/engine/flash/rubric-critic.ts:183-186` (also mirrored in run-flash-text-mode.ts:122-125)
**Issue:** `temperature` and `seed` are bolted onto `callParams` post-construction behind `@ts-expect-error`, then the whole object is cast `as never`. This defeats type-checking on the call params entirely — a typo in `model`/`messages`/`response_format` would not be caught. It mirrors an existing pattern, so it is consistent, but it is a type-safety hole at an API boundary (CLAUDE.md: "Use typed interfaces for all public APIs").
**Fix:** Define a local params type that includes `temperature?: number; seed?: number` (or extend the SDK request type) and construct the object once with all fields, removing the `@ts-expect-error` directives and the `as never` cast.

### IN-04: Idea-card `developError` rendered with `mt-1` inside a flex-row (layout drift)

**File:** `src/components/thread/idea-card-block.tsx:302-306`
**Issue:** `developError` is rendered with `className="mt-1 ..."` but it sits inside a `flex items-center gap-4` row (line 283) as a sibling of the Develop button, not stacked below it. The `mt-1` has no vertical effect in a centered flex row; the error will appear inline to the right of the button rather than beneath it as the class implies. Cosmetic, but the markup intent (error below button) does not match the rendered result.
**Fix:** Wrap the button + error in a `flex-col` container, or move the error out of the flex row, so `mt-1` produces the intended stacked layout.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
