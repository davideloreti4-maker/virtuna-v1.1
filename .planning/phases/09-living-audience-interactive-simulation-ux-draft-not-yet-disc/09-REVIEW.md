---
phase: 09-living-audience-interactive-simulation-ux
reviewed: 2026-06-19T10:58:39Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/app/api/tools/chat/route.ts
  - src/components/audience-lens/AudienceLens.tsx
  - src/components/audience-lens/ClusterView.tsx
  - src/components/audience-lens/LensTrigger.tsx
  - src/components/audience-lens/PersonaChatDrawer.tsx
  - src/components/audience-lens/PopulationSwarm.tsx
  - src/components/audience-lens/ReplayController.tsx
  - src/components/audience-lens/__tests__/lens-derive.test.ts
  - src/components/audience-lens/__tests__/population-swarm.test.tsx
  - src/components/audience-lens/flat-card-reactions.ts
  - src/components/audience-lens/lens-derive.ts
  - src/components/audience-lens/use-lens-scale.ts
  - src/components/board/_kit/PersonaGraph.tsx
  - src/components/board/audience/audience-derive.ts
  - src/components/reading/__tests__/persona-cloud.test.tsx
  - src/components/reading/reading-panels.tsx
  - src/components/thread/hook-card-block.tsx
  - src/components/thread/idea-card-block.tsx
  - src/components/thread/message-blocks.tsx
  - src/components/thread/persona-chat-turn-block.tsx
  - src/components/thread/personas-block.tsx
  - src/components/thread/remix-card-block.tsx
  - src/components/thread/script-card-block.tsx
  - src/lib/tools/__tests__/chain-handoff.test.ts
  - src/lib/tools/block-registry.ts
  - src/lib/tools/blocks.ts
  - src/lib/tools/chain-handoff.ts
  - src/lib/tools/runners/__tests__/chat-runner.test.ts
  - src/lib/tools/runners/chat-runner.ts
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-19T10:58:39Z
**Depth:** standard
**Files Reviewed:** 30 (29 source + scoped helpers traced cross-file)
**Status:** issues_found

## Summary

Phase 9 wires the reusable AudienceLens (cloud / cluster / Population swarm / persona chat / Rewrite loop) across the six skill surfaces. The pure math core (`lens-derive.ts`, `audience-derive.ts`) is clean, deterministic, and well-tested; the SSE chat route has solid auth/CSRF/length-cap posture; block schemas are tight (`.strict()` on the Read entries). Determinism and "no scoring path" honesty constraints are genuinely enforced by tests.

The headline defect is a **broken contract between the flat-card persona identity and the chat backend**: the `archetype` value the flat (text-skill) Lens hands to the persona-chat drawer is a humanized display label, not a registry enum, so the persona-grounded "Ask them why →" path is silently rejected server-side and degrades to generic open chat on idea/hook/script/remix surfaces — exactly the surfaces this phase exists to light up. The drawer's Retry button is also dead. Several honesty/consistency mismatches (rounded breakdown vs headline, coral toning on cloud vs table) round out the warnings.

## Critical Issues

### CR-01: Flat-card persona chat is silently non-functional — display label sent as `archetype`, rejected server-side

**File:** `src/components/audience-lens/flat-card-reactions.ts:57`, `src/components/audience-lens/AudienceLens.tsx:243-251`, `src/app/api/tools/chat/route.ts:56-74`

**Issue:** On every flat text-skill surface (idea/hook/script/remix card) the Lens builds nodes via `cardScrollQuoteReactions`, which sets `archetype` to either a positional placeholder `viewer_${i+1}` (line 57) or, for the hook card lead, the `archetypeHint` = `block.props.audienceArchetype`. That `audienceArchetype` is the output of `deriveAudienceArchetype`, a **human-facing label** such as `"Stops the skeptic"` or `"No clear audience lock"` (see `src/lib/tools/hooks/audience-archetype.ts`), NOT a `persona-registry` enum.

`AudienceLens` then opens `PersonaChatDrawer` with `archetype: n.archetype!` (line 246). The drawer POSTs `personaGrounding.archetype = "viewer_2"` / `"Stops the skeptic"`. The route's `parsePersonaGrounding` validates `ARCHETYPES.includes(archetype)` (route line 60) and returns `null` for any non-enum value, so the request runs the **plain open-chat path** — the answer is NOT in the persona's voice, and the rehydration `GET ?archetype=viewer_2` returns 400 (route line 115), so the sub-thread never re-appears on reopen. The drawer UI still says "Ask the skeptic" and streams a generic answer, presenting a non-grounded reply as a persona reply. This is the core P9 moat feature ("Ask them why →") failing open on the majority of surfaces with no error surfaced to the user.

**Fix:** Carry the real registry archetype enum through the flat shape instead of a display label. `cardScrollQuoteReactions` should accept (and place on the lead persona) the enum the runner already has, and `FlatPersonaReaction.archetype` must be a registry enum. Where no enum exists (idea/script/remix `viewer_N` placeholders), gate the "Ask them why →" affordance off entirely (mirror the `conceptText`-absent degrade) rather than opening a drawer that cannot ground:
```ts
// flat-card-reactions.ts — only attach a registry enum as the chat-groundable archetype.
// Pass the runner's real archetype id (e.g. "tough_crowd"), not the "Stops the …" label.
out.push({
  archetype: isLead && registryArchetype ? registryArchetype : `viewer_${i + 1}`,
  // ...
});
```
```tsx
// AudienceLens.tsx — only list personas whose archetype is a real registry enum.
const grounded = nodes.filter((n) => n.archetype && ARCHETYPES.includes(n.archetype as Archetype));
```
Without a real enum, do not render the per-persona "Ask them why →" row (or render it disabled), so the UI never promises an in-voice answer it cannot deliver.

### CR-02: PersonaChatDrawer "Retry →" is dead — cleared input makes retry a no-op

**File:** `src/components/audience-lens/PersonaChatDrawer.tsx:90-157, 202-209`

**Issue:** `send()` captures `question = ask.trim()` then immediately clears the composer with `setAsk('')` (line 96). On a stream failure the catch sets `error` and the error block renders a "Retry →" button whose handler is `() => void send()` (line 204). But by then `ask` is `''`, so the retry invocation hits `if (question.length === 0) return;` (line 93) and silently does nothing. The user's question was also already optimistically appended to `turns` (line 97) but is never re-sent, so Retry appears interactive while doing nothing — the question is effectively lost on the first transient failure.

**Fix:** Track the last attempted question and let Retry resend it:
```tsx
const [lastQuestion, setLastQuestion] = useState('');
const send = useCallback(async (override?: string) => {
  if (!target || isStreaming) return;
  const question = (override ?? ask).trim();
  if (question.length === 0) return;
  setLastQuestion(question);
  setError(null);
  if (!override) setAsk('');
  // ...append user turn only when !override, or de-dup the optimistic turn on retry...
}, [ask, target, conceptText, platform, isStreaming]);
// Retry button:
onClick={() => void send(lastQuestion)}
```
Also guard against appending the same user turn twice on retry (the first attempt already pushed it into `turns`).

## Warnings

### WR-01: `weightedRollup` per-archetype breakdown can disagree with the headline stop count

**File:** `src/components/audience-lens/lens-derive.ts:181-195`, `src/components/audience-lens/PopulationSwarm.tsx:171-180, 190, 248-265`

**Issue:** The headline `stop` is `Math.round(sum of contributions)` (line 189), but each `byArchetype[i].stop` is independently `Math.round(contribution)` (line 186). The sum of the independently-rounded per-archetype rows does not generally equal the rounded sum. PopulationSwarm renders BOTH the headline `roll.stop` (line 198/201) and the per-archetype breakdown rows (lines 248-265), so the displayed breakdown can visibly fail to add up to the headline — directly undercutting the D-02 "same numbers, denser resolution" honesty claim the component advertises.

**Fix:** Compute rounded per-archetype stops first, then derive the headline as their sum so the two are identity by construction:
```ts
let stop = 0;
const byArchetype = nodes.map((n) => {
  const w = effectiveWeight(n);
  const isStop = verdictOf(n.watchThrough) === 'stop';
  const rounded = isStop ? Math.round((w / totalW) * DEFAULT_TOTAL) : 0;
  stop += rounded;
  return { archetype: n.id, stop: rounded, weight: w };
});
return { stop, scroll: DEFAULT_TOTAL - stop, total: DEFAULT_TOTAL, byArchetype };
```

### WR-02: Coral toning in the flat cloud and the cluster table disagree

**File:** `src/components/audience-lens/AudienceLens.tsx:175-178`

**Issue:** For the flat path, a node is toned `accent` only if `clusterFlatNodes([n])` (a single-node fold) lands on the worst slot key. For a single node, `clusterFlatNodes` yields `stopPct` of 100 (stop) or 0 (scroll); `worstBadGroupKey` only flags a slot when pct < 40. So a **stop-verdict** node in the worst cluster returns `slotKey = null` (its single-node pct is 100) and is never painted coral, while `ClusterView` paints the whole worst cluster bar coral. The cloud and the table therefore highlight different members of "the worst cluster," contradicting the comment's stated intent ("a node is in the worst cluster iff its single-node fold lands on the worst slot key").

**Fix:** Determine cluster membership by slot identity, not by re-running the <40% rule per node:
```ts
import { /* … */ } from '@/components/board/audience/audience-derive';
const toned = flatNodes.map((n) => {
  const slot = n.archetype ? archetypeToSlot(n.archetype) : 'fyp';
  return w != null && slot === w ? { ...n, tone: 'accent' as const } : n;
});
```
(Export `archetypeToSlot` from `audience-derive.ts` for reuse, or expose a `slotOf(node)` helper.)

### WR-03: SSE token frames are not split-resilient — a multi-line `data:` or split delta JSON throws

**File:** `src/components/audience-lens/PersonaChatDrawer.tsx:130-144`

**Issue:** The parser splits each frame's lines and takes the first `event:`/`data:` line, then `JSON.parse(dataLine.slice('data:'.length).trim())` (line 137) with no try/catch. SSE permits multi-line `data:` fields, and a network chunk can split a frame mid-`data:` JSON. The buffer split on `\n\n` handles the common case, but a partial/garbled `data:` payload (or any non-JSON keepalive line beginning with `data:`) makes `JSON.parse` throw inside the read loop, which is caught only by the outer `catch` that shows the generic error and discards the rest of an otherwise-recoverable stream.

**Fix:** Wrap the per-frame parse defensively and concatenate multi-line data:
```ts
try {
  const dataLines = frame.split('\n').filter((l) => l.startsWith('data:'));
  if (!eventLine || dataLines.length === 0) continue;
  const payload = JSON.parse(dataLines.map((l) => l.slice(5).trim()).join('\n'));
  // …
} catch { continue; }
```

### WR-04: Cascade `setInterval` is torn down and recreated every tick (timer churn)

**File:** `src/components/audience-lens/AudienceLens.tsx:432-444`, `src/components/audience-lens/ReplayController.tsx:97-109`

**Issue:** Both cascade effects list the advancing state (`progress` / `revealed`) in their dependency arrays. Each tick calls `setProgress`/`setRevealed`, which changes the dependency, which runs cleanup (`clearInterval`) and re-creates a fresh `setInterval` on every frame. Functionally it advances, but the interval period restarts each tick (timing jitter) and it defeats the purpose of `setInterval`. On unmount mid-cascade the latest interval is cleared, but the churn is an avoidable correctness/robustness smell.

**Fix:** Drive the cascade from a single effect keyed on "is cascading" (boolean), reading/writing state via the functional updater only, or use `setTimeout` chained to the latest value. Depend on `cascading`/`reducedMotion` only, not on the frame counter.

### WR-05: `MAX_PRIOR_TURNS` slice applied after the per-archetype filter can starve persona context

**File:** `src/app/api/tools/chat/route.ts:223-250`

**Issue:** For the persona-grounded path the code flatMaps ALL messages → filters to this archetype → `.slice(-MAX_PRIOR_TURNS)`. That is fine. But for the open-chat path the same `.slice(-20)` is applied to the flattened markdown turns; since a single message can contain multiple blocks, the "20 turns" cap counts blocks, not conversational turns, and interleaves user/assistant roles derived from `msg.role` per-message rather than per-block. If any message ever carries multiple markdown blocks, role attribution per block is whatever the parent message role is — correct today, but brittle if multi-block messages are ever introduced. Document/enforce the one-markdown-block-per-message invariant or attribute role per block.

**Fix:** Assert the invariant at the write boundary, or carry role on the block. At minimum add a comment that the open-chat anchor assumes one markdown block per message row.

### WR-06: `ScaleToggle` uses `role="tablist"`/`role="tab"` without `tabpanel` wiring

**File:** `src/components/audience-lens/AudienceLens.tsx:368-403, 219-270`

**Issue:** The toggle declares `role="tablist"` with `role="tab"` + `aria-selected`, but the Panel/Population regions below are not `role="tabpanel"` and carry no `aria-labelledby`/`id` linkage, and the tabs are not in a roving-tabindex arrangement (both buttons are independently focusable, arrow-key navigation absent). Screen-reader users get a "tab" promise the markup does not fulfill. Either complete the ARIA tabs pattern (ids, `aria-controls`, roving tabindex, arrow keys) or downgrade to a plain segmented control (`role="group"` + `aria-pressed`).

**Fix:** Simplest: switch to `aria-pressed` buttons inside a `role="group"` with `aria-label="Audience scale"`, dropping the tab semantics.

### WR-07: `parseFraction` accepts `stop === 0` but lead-quote attachment then mislabels the scroll persona as the quote owner

**File:** `src/components/audience-lens/flat-card-reactions.ts:51-62`

**Issue:** When `stop === 0`, every persona is `scroll`, yet the single real `scrollQuote` is attached to persona `i === 0` (a scroll persona) — which is consistent with the comment, but the downstream cascade (`cascadeOrder`) reveals stops first and the cloud paints by watch-through; a scroll persona carrying the only verbatim can read as the "lead" reaction while the cluster shows 0% stop. Low-severity, but the "first stop persona" intent in the doc comment (line 53) and the code (`i === 0` unconditionally) diverge whenever `stop > 0` and persona 0 happens to be a stop vs when `stop === 0`. Verify this is the intended honesty framing.

**Fix:** Either explicitly attach to the first stop index when stops exist, or update the comment to state the quote always anchors persona 0 regardless of its verdict.

## Info

### IN-01: `resolvedWeights` computed then discarded in chat-runner

**File:** `src/lib/tools/runners/chat-runner.ts:247-248`

**Issue:** `resolveAudienceWeights(...)` is called and immediately `void`-ed with a comment that it is "wired for future Max-path integration." Dead computation on every chat request (minor waste, and a reader-confusing no-op).

**Fix:** Remove until the Max path needs it; reintroduce when wired. Keeps the hot path free of speculative work.

### IN-02: `ReplayMirror` strongest/weakest collapse to the same segment for a single node

**File:** `src/components/audience-lens/ReplayController.tsx:193-206`

**Issue:** With one node, `sorted[0]` and `sorted[sorted.length-1]` are identical, so the sr-only summary reads "strongest in X, weakest in X." Harmless but reads oddly for the 1-persona degrade case.

**Fix:** When `nodes.length < 2`, omit the strongest/weakest clause.

### IN-03: Magic numbers in the swarm/cascade scatter lack named constants

**File:** `src/components/audience-lens/PopulationSwarm.tsx:133, 141`, `src/components/board/_kit/PersonaGraph.tsx:113`

**Issue:** Seed offsets `9173`, `31337`, spread base `8 + dot.sentiment * 10`, and the `0.06` cascade step in `AudienceLens.tsx:437` are inline magic numbers duplicated across PersonaGraph/PopulationSwarm/lens-derive. The duplication of the mulberry32 PRNG (copied verbatim into three files per the comments) is acknowledged but increases drift risk.

**Fix:** Hoist the shared seed-derivation + PRNG into a single non-`'use client'` util importable by all three, and name the cascade-step / spread constants.

### IN-04: `as`-cast block narrowing in the chat route bypasses the registry validator

**File:** `src/app/api/tools/chat/route.ts:121-132, 223-250`

**Issue:** The GET/POST rehydration paths hand-roll block narrowing with repeated `(b as { props: { archetype?: unknown } })` casts instead of routing through the shared `validateBlock`/`PersonaChatTurnBlockSchema`. The casts assume `b.props` shape without schema validation; `loadMessages` is documented to re-validate (D-14), so this is likely safe today, but the duplicated cast logic is fragile and should reuse the SSOT validator.

**Fix:** Filter via `validateBlock(b)` (already imported indirectly) or a typed guard derived from `PersonaChatTurnBlockSchema` rather than inline `as` casts.

---

_Reviewed: 2026-06-19T10:58:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
