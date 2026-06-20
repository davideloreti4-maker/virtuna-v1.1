---
phase: 11-explore-audience-curated-discovery
reviewed: 2026-06-20T11:44:39Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/app/api/tools/explore/route.ts
  - src/app/api/tracked-accounts/route.ts
  - src/components/app/home/composer.tsx
  - src/components/app/home/composer-controls.tsx
  - src/components/app/home/__tests__/composer-controls.test.tsx
  - src/components/discover/outlier-tile.tsx
  - src/components/discover/discover-grid.tsx
  - src/components/thread/outlier-grid-block.tsx
  - src/components/thread/explore-thread-view.tsx
  - src/components/thread/explore-thread-view.test.tsx
  - src/hooks/queries/use-explore-stream.ts
  - src/lib/discover/explore-rank.ts
  - src/lib/discover/explore-rank.test.ts
  - src/lib/tools/blocks.ts
  - src/lib/tools/runners/explore-runner.ts
  - src/lib/tools/runners/explore-runner.test.ts
  - src/lib/tracked-accounts/tracked-accounts-repo.ts
  - src/lib/tracked-accounts/tracked-accounts-repo.test.ts
  - supabase/migrations/20260620090000_tracked_accounts.sql
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: resolved
criticals_resolved: "CR-01, CR-02 (critical) + WR-01 (warning) fixed 2026-06-20 — commits 95beb49e, 2cd740a3, 58633fe2"
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-20T11:44:39Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** resolved (both criticals + WR-01 fixed; WR-02/04/05 + IN-01..04 deferred as documented follow-ups)

> **RESOLUTION (2026-06-20):** CR-01 (un-niched pull on empty input — commit `95beb49e`), CR-02 (route resolves session tracked_accounts for the competitors pull, capped 5, session-derived — commit `2cd740a3`), and WR-01 (remix CTA cleared in `finally` — commit `58633fe2`) are FIXED and verified (full suite 2956 passing / 0 failing, `npm run build` OK, ENGINE_VERSION 3.19.0). Remaining open items below — WR-02 (cache key timeWindow), WR-04 (cache DTO typing), WR-05 (persisted block re-validation), IN-01..04 — are non-blocking follow-ups. WR-03 was neutralized on the fixed path via a non-empty `source` guard.

## Summary

Phase 11 adds the Explore (audience-curated in-thread discovery) skill: an SSE route, a tracked-accounts CRUD route + repo + migration, the pure `rankWithAudienceFit` re-rank, the `useExploreStream` consumer, the `ExploreThreadView` surface, and composer wiring.

The phase's stated focus areas hold up well on the **security and honesty axes**:
- Both new routes are auth-first; `user_id` is session-derived (CR-01), `csrfGuard` is applied to mutating methods, zod validation runs at the repo boundary, and RLS own-rows-only is correctly declared in the migration.
- The SSE producer never navigates; the composer Explore submit branch correctly avoids `pendingNavRef`/`stream.start` (Pitfall 1 satisfied).
- The honesty spine holds: `outlier-tile` omits the fit bar entirely when `fit == null`, the fit bar uses success/warning/muted tones (never coral), the Remix CTA is the lone coral element, and `explore-rank.ts` is pure deterministic math with no SIM call (proven by an in-repo source-grep test).
- `tracked-accounts-repo` upsert idempotency (`onConflict: "user_id,platform,handle"`) is correct and well-tested.
- The `useExploreStream` reader has a correct unmount guard (`isMountedRef` + `abortRef.abort()`).

However, the **end-to-end integration of the quick-action and field-send entry points is broken**: the route hard-requires a non-empty pull input, but the composer's flagship quick-action (and the bare field-send, and the "competitors" card) routinely POST an empty/absent input, yielding a guaranteed `400` for the default (General-audience) user. There is also a stuck-pending UI bug on a successful remix launch. Details below.

## Critical Issues

### CR-01: Flagship "Top performers in my niche today" quick-action 400s for any General-audience (default) user

**File:** `src/components/thread/explore-thread-view.tsx:140`, `:235-238` (with `src/app/api/tools/explore/route.ts:195-198`)

**Issue:** The route requires a non-empty pull input:
```ts
// route.ts:195
const pullInput = rawAccounts || rawNiche || rawInput;
if (!pullInput) {
  return Response.json({ error: "input is required" }, { status: 400 });
}
```
But card 1's payload is built from `audienceNiche`, which is empty for the default user:
```ts
// explore-thread-view.tsx:140
const audienceNiche = (audience?.goal_label || audience?.name || '').trim();
...
// card 1 onClick (:235)
onQuickAction({ niche: audienceNiche, timeWindow: 'today' })
```
For a new user (no calibrated audience), `audience` is `null` → `audienceNiche === ""` → body is `{ niche: "", timeWindow: "today" }` → `rawNiche === ""` → `pullInput === ""` → **400 "input is required"**. The composer surfaces this as the `SkillRunError` ("Couldn't reach that source."), which is both wrong copy and a broken primary action for the most common entry state. Card 1 is *always enabled*, so this is the default Explore experience.

**Fix:** Either (a) make the route fall back to an un-niched pull when input is empty (matching the composer's own comment at `composer.tsx:659` "empty → un-niched pull"), or (b) guarantee the UI never sends an empty pull. Option (a), in `route.ts`:
```ts
// Allow an un-niched (trending) pull: only 400 if the route truly cannot proceed.
const pullInput = rawAccounts || rawNiche || rawInput;
const { mode, normalized } = pullInput
  ? classifyDiscoverInput(pullInput)
  : { mode: "niche" as const, normalized: TRENDING_FALLBACK_QUERY };
```
If an un-niched pull is NOT a supported product behavior, instead disable card 1 / the send button when no niche is derivable, and surface "Pick an audience or type a niche" — do not let the tap fire a request that can only fail.

---

### CR-02: "What competitors shipped" quick-action can never succeed — sends no pull input

**File:** `src/components/thread/explore-thread-view.tsx:251-256` (with `src/app/api/tools/explore/route.ts:189-198`)

**Issue:** Card 2 ("What competitors shipped") is gated on `hasTrackedAccounts`, but when enabled its payload carries no account/niche/input at all:
```ts
// explore-thread-view.tsx:253
onClick={hasTrackedAccounts ? () => onQuickAction({ timeWindow: 'week' }) : undefined}
```
`{ timeWindow: 'week' }` → route receives empty `niche`/`accounts`/`input` → `pullInput === ""` → **400**. The route never reads the user's tracked accounts (confirmed: no `listTrackedAccounts` import in `route.ts`), and `timeWindow` is explicitly a no-op (`void body.timeWindow`, `route.ts:191`). So the card promises "Recent posts from accounts you track" but cannot produce them — every tap returns a 400 rendered as a misleading "Couldn't reach that source." error.

**Fix:** The card must pass the tracked handle(s) as the pull input (profile mode), e.g. by fetching the tracked accounts and threading the first/selected handle into `accounts`, or by adding a server branch that resolves tracked accounts from the session when `accounts` is omitted. Minimal version (pass a handle from a tracked account selection):
```ts
onClick={hasTrackedAccounts ? () => onQuickAction({ accounts: someTrackedHandle, timeWindow: 'week' }) : undefined}
```
If P11 is intentionally the "producer half" and the competitor pull is deferred to P12, then card 2 should be left in its disabled/honest state for now (or clearly labeled "coming soon") rather than wired to a request that always 400s. Note the same empty-input failure also affects the bare empty Explore field-send (`composer.tsx:659`, `explore.start({ niche: ask || undefined })` with empty `ask` → body `{}` → 400), despite `canSubmit` allowing an empty Explore send (`composer.tsx:293-294`).

## Warnings

### WR-01: `remixPendingId` is never cleared on a successful remix launch — CTA stuck in "Remixing…" forever

**File:** `src/components/thread/explore-thread-view.tsx:147-172`

**Issue:** `handleRemix` sets `remixPendingId` then clears it only on the `!res.ok` and `catch` branches. On the success path it calls `onThreadReload()` and returns without resetting:
```ts
setRemixPendingId(tile.platformVideoId);
try {
  const res = await fetch(handoff.endpoint, {...});
  if (!res.ok) { setRemixPendingId(null); return; }
  onThreadReload?.();            // success — remixPendingId stays set
} catch {
  setRemixPendingId(null);
}
// no finally
```
After a successful remix, that tile's "Remix → Read" button stays `disabled` with the "Remixing…" label indefinitely (the component instance keeps the stale `remixPendingId`; `onThreadReload` re-fetches blocks but does not reset this local state). The user cannot remix that tile again.

**Fix:** Reset in a `finally`, or right after `onThreadReload`:
```ts
try {
  const res = await fetch(...);
  if (res.ok) onThreadReload?.();
} catch { /* swallow — leave grid for retry */ }
finally {
  setRemixPendingId(null);
}
```

### WR-02: Discover-cache key omits `serendipity` and `timeWindow` — a same-day re-pull silently ignores changed params

**File:** `src/app/api/tools/explore/route.ts:248,289` (cache keyed via `discover-cache.ts:discoverCacheKey` = `normalizedInput|mode|day`)

**Issue:** The cache stores/reads on `(normalized, mode, day)` only. `serendipity` is re-applied per request on a cache hit (correct — `buildBlockFromRanked` re-runs `rankWithAudienceFit`), so the valve still affects ordering on a hit. But `timeWindow` is part of the documented param contract (`ExploreStartParams.timeWindow`) and, if it is ever threaded into the pull (the code comments say it's a planned follow-up), a cache hit on the same `(normalized, mode, day)` would return tiles pulled under a *different* window. Today this is latent (timeWindow is a no-op), so it is a WARNING, not a BLOCKER — but it is a correctness trap waiting for the follow-up that wires timeWindow.

**Fix:** When `timeWindow` becomes load-bearing, include it in the cache key (extend `discoverCacheKey` to accept an optional discriminator). Add a code comment at the cache call sites noting the key must grow if `timeWindow` starts affecting the pull.

### WR-03: `source` min(1) zod constraint can be violated by a whitespace-only / punctuation-only niche

**File:** `src/lib/tools/runners/explore-runner.ts:60-62,113` and `src/app/api/tools/explore/route.ts:81-83,119`

**Issue:** For niche mode, `source = normalized` (the niche text). `OutlierGridBlockSchema` requires `source: z.string().min(1)` (`blocks.ts:273`). `classifyDiscoverInput` lowercases/trims but does not strip to empty-guard a punctuation-only input; a niche like `"!!!"` classifies to niche mode with `normalized = "!!!"` (non-empty, passes the route's `pullInput` guard) — that survives. But a niche that trims to empty would make `source === ""` and the block `safeParse` would throw `explore block validation failed`, surfacing as a generic SSE `error` rather than a clean 400. The route's `pullInput` guard catches the all-empty case, but the coupling between "what passes the input guard" and "what produces a valid `source`" is implicit and fragile.

**Fix:** Make the niche `source` explicitly non-empty (e.g. fall back to a constant label when `normalized` is empty), or validate `normalized.length > 0` right after `classifyDiscoverInput` and return a 400 there, so a malformed `source` can never reach the schema as a thrown 500-shaped SSE error.

### WR-04: `getCachedDiscover<RankedOutlier>` is typed as `RankedOutlier` but the cache stores JSON-degraded objects (`postedAt` is a string)

**File:** `src/app/api/tools/explore/route.ts:248-261`

**Issue:** `setCachedDiscover<RankedOutlier>(normalized, mode, result.ranked)` stores `RankedOutlier[]` whose `postedAt` is a real `Date`. The in-memory Map does not serialize, so within one process `postedAt` stays a `Date`. But the typing claims `RankedOutlier` (Date) while the rehydration block explicitly defends against a string (`t.postedAt instanceof Date ? ... : new Date(t.postedAt)`), implying the author expects a JSON-degraded shape. The generic type and the defensive code disagree; the `as T[]` cast in `getCachedDiscover` hides the mismatch. This is benign today (single-instance Map keeps the Date), but the type lies about the runtime shape, and a future move to a serializing cache (Redis, the HARDEN-01 gate) would make `t.multiplier`/`t.views` etc. fine but every consumer assuming `Date` would break silently except the one field that was hand-guarded.

**Fix:** Either type the cache payload as a JSON-serializable DTO (e.g. `Omit<RankedOutlier,'postedAt'> & { postedAt: string }`) so the rehydration is type-checked, or drop the misleading generic and document that the cache holds whatever the route last stored (the `DiscoverTile = object` opaque type already hints at this).

### WR-05: `persisted*Blocks` are `any[]` and Explore-persisted grids skip block re-validation on rehydration (D-14 gap)

**File:** `src/components/app/home/composer.tsx:152-163,317-329`

**Issue:** Persisted blocks loaded from `GET /api/threads/open` are filtered by a loose `b.type === 'outlier-grid'` string check and stored in an `any[]`, then passed straight into `ExploreThreadView` → `OutlierGridBlockRenderer` → `DiscoverGrid` as `OutlierGridBlock` without a `safeParse`. The block's design contract (`blocks.ts` header, D-14) is "re-validate on rehydration." The write boundary validates (`insertMessage`), so persisted data should be well-formed, but a schema migration or a hand-edited row would flow unvalidated into the renderer, where `tile.fit.level` indexes `FIT_BAR[level]` (`outlier-tile.tsx:149`) — an out-of-enum `level` would yield `undefined.width` and crash the tile. The hooks/ideas paths share this `any[]` pattern, so this is consistent with prior phases, but it is a real robustness gap newly extended to outlier-grid.

**Fix:** Run `OutlierGridBlockSchema.safeParse` (or the shared `validateBlock`) when filtering persisted blocks, dropping any that fail, before handing them to the renderer. At minimum, guard `FIT_BAR[tile.fit.level]` against an unknown level in `outlier-tile.tsx`.

## Info

### IN-01: `getSkill` fallback returns `SKILLS[1]` (Ideas) for an unknown id, but `SKILLS[0]` is now Explore

**File:** `src/components/app/home/composer-controls.tsx:75-76`

**Issue:** `getSkill` falls back to `SKILLS[1]!` with the comment "fall back to Ideas (never reached)." After the P11 reordering, `SKILLS[0]` is Explore and `SKILLS[1]` is Ideas — so the comment is still accurate by luck, but the index-based fallback is brittle: any future reorder silently changes the fallback skill. The path is genuinely unreachable today (`activeTool` is a closed union), so this is informational.

**Fix:** Make the fallback explicit and order-independent: `SKILLS.find(s => s.id === "idea") ?? SKILLS[0]!`.

### IN-02: `statusMessage` plumbed through `useExploreStream` but the route never emits a `status` event

**File:** `src/hooks/queries/use-explore-stream.ts:81,201-203,247` and `src/app/api/tools/explore/route.ts` (no `status` event)

**Issue:** The hook handles an `eventType === 'status'` frame and exposes `statusMessage`, but the route only ever sends `stage`/`content`/`done`/`error`. `ExploreThreadView` does not consume `statusMessage` either. This is harmless dead-ish plumbing carried over from the use-hooks-stream clone (the JSDoc even says "reserved").

**Fix:** Drop the `status` branch + `statusMessage` from `useExploreStream` (and its return type) until the route emits it, to keep the consumer honest about the actual event contract.

### IN-03: `void body.timeWindow` / accepted-but-ignored param is a silent no-op the user can set

**File:** `src/app/api/tools/explore/route.ts:187-191`, `src/components/app/home/composer-controls.tsx:604-634`

**Issue:** The Search popover renders a Today/This week/This month segmented control and sends `timeWindow`, but the route deliberately ignores it (`void body.timeWindow`). The user can change the window and see no effect. The code is honest in comments, but the UI presents a working control that does nothing — a minor honesty/UX wrinkle (the broader honesty spine is otherwise well kept).

**Fix:** Either thread `timeWindow` into the pull/rank window, or visually mark the control as not-yet-active, so the affordance does not over-promise.

### IN-04: Stale-closure risk — `audienceNiche` baked into quick-action closures, but `audience` is a prop so this is fine; flagging the `eslint-disable-next-line exhaustive-deps` in composer for visibility

**File:** `src/components/app/home/composer.tsx:723` (handleSubmit deps) and `:336` (rehydration effect)

**Issue:** Two `eslint-disable-next-line react-hooks/exhaustive-deps` directives. The mount-once rehydration effect (`:336`) is intentional and correct (`cancelled` guard present). `handleSubmit` (`:723`) omits several referenced values (e.g. `file`, `isValidTikTok` are listed, but `persistedChatBlocks`, `scriptBlocks`, `remixBlocks` referenced in the chat-refine branch are not in the dep array) — for the Explore path specifically there is no stale-closure bug (it reads `trimmedUrl`/`explore` which are listed). Flagged only so the disable is a conscious choice, not silent drift.

**Fix:** No change required for Explore correctness; consider auditing the `handleSubmit` dep list during a future refactor.

---

_Reviewed: 2026-06-20T11:44:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
