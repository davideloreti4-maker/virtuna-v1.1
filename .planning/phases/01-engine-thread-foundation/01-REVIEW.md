---
phase: 01-engine-thread-foundation
reviewed: 2026-06-17T08:35:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/lib/tools/blocks.ts
  - src/lib/tools/block-registry.ts
  - src/lib/tools/block-registry.tsx
  - src/lib/tools/tool-runner.ts
  - src/lib/tools/runners/flash-runner.ts
  - src/lib/tools/__tests__/block-registry.test.ts
  - src/lib/tools/__tests__/tool-runner.test.ts
  - src/components/thread/message-blocks.tsx
  - src/components/thread/unsupported-block.tsx
  - src/components/thread/markdown-block.tsx
  - src/components/thread/band-block.tsx
  - src/components/thread/personas-block.tsx
  - src/lib/engine/flash/flash-schema.ts
  - src/lib/engine/flash/flash-prompts.ts
  - src/lib/engine/flash/flash-aggregate.ts
  - src/lib/engine/flash/run-flash-text-mode.ts
  - src/lib/engine/flash/__tests__/flash-aggregate.test.ts
  - src/lib/engine/flash/__tests__/flash-schema.test.ts
  - src/lib/threads/threads.ts
  - src/lib/threads/messages.ts
  - src/lib/threads/__tests__/messages.test.ts
  - src/components/app/home/tool-chips.tsx
  - src/components/app/home/composer.tsx
  - src/components/app/home/__tests__/tool-chips.test.tsx
  - src/components/app/home/__tests__/composer-navigate-guard.test.tsx
  - supabase/migrations/20260617000000_threads_messages.sql
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-17T08:35:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the Engine & Thread Foundation phase: typed-block renderer registry, Flash text-mode engine path, thread/message persistence, the threads+messages migration, and the home composer.

The five flagged review focus areas hold up well:

1. **"No model-generated UI" guarantee** — SOLID. `validateBlock` never throws, unknown/invalid blocks degrade to a propless `<UnsupportedBlock>` static placeholder, and the placeholder reads no model props. Re-validation happens on both write (`insertMessage`) and rehydration (`loadMessages`) plus a third time in `MessageBlocks`. No path executes model-supplied props.
2. **Flash↔Max isolation** — VERIFIED. The Flash path imports only `flash/*`, `wave3/persona-registry`, `qwen/client`, `utils/strip`. No `pipeline.ts`/`aggregator.ts`/`version.ts`/`fold*` imports. `analysis_results` is untouched by the migration.
3. **Markdown XSS** — SAFE. `react-markdown` does not render raw HTML by default (no `rehype-raw`), and `rehype-sanitize` is applied on top. No `dangerouslySetInnerHTML`.
4. **Composer Test-nav guard** — PRESERVED. `pendingNavRef` is armed only inside `handleSubmit`; the effect requires `prevAnalysisIdRef.current === null && pendingNavRef.current`. Hydration-sourced ids and chip clicks cannot navigate. Tests cover both.
5. **RLS** — mostly correct, but the **thread persistence layer has correctness gaps** (CR-01, CR-02, WR-01) around the service-client upsert/select-back and the partial-index conflict target.

The blockers are concentrated in `threads.ts` — the helpers use the RLS-bypassing service client but reconstruct ownership scoping by hand, and two of those hand-rolled scopes are wrong or fragile. Because no callers exist yet (P1 ships the contract only), these will not crash today, but they are latent data-leak / runtime-throw bugs that must be fixed before any route wires them in.

## Critical Issues

### CR-01: `createGroundedThreadLazy` can return another user's thread (service-client ownership bypass)

**File:** `src/lib/threads/threads.ts:44-72`
**Issue:** The helper uses `createServiceClient()` (RLS bypassed) and, on conflict, the `upsert({ ignoreDuplicates: true })` is a no-op. It then reads the row back with `.eq("reading_id", readingId).single()` — selecting by `reading_id` ALONE, with no `user_id` filter. The unique index is global on `reading_id`, so exactly one row matches, but the function returns it regardless of whether `userId` (the caller's authenticated user) actually owns it. If the same `reading_id` ever maps to a row created by a different user (today implausible because readings are user-scoped, but the function takes `userId` precisely to enforce that boundary and then ignores it), the caller receives a thread it does not own — a cross-user data-access path that RLS would normally block but the service client does not. The function accepts `userId` and never uses it to scope the read-back.
**Fix:**
```ts
// Scope the read-back to the caller's user_id so a service-client read can
// never surface a thread owned by someone else.
const { data, error } = await supabase
  .from("threads")
  .select("*")
  .eq("reading_id", readingId)
  .eq("user_id", userId)   // <-- enforce ownership the service client bypasses
  .single();

if (error || !data) {
  throw new Error(
    `createGroundedThreadLazy: no thread for reading_id=${readingId} owned by user — ${error?.message ?? "ownership mismatch or no data"}`,
  );
}
```

### CR-02: Upsert `onConflict: "reading_id"` does not match the PARTIAL unique index — runtime throw

**File:** `src/lib/threads/threads.ts:51-56` and `supabase/migrations/20260617000000_threads_messages.sql:51`
**Issue:** The unique index is *partial*: `CREATE UNIQUE INDEX ... ON public.threads (reading_id) WHERE reading_id IS NOT NULL`. PostgREST/`supabase-js` `upsert({ onConflict: "reading_id" })` emits `ON CONFLICT (reading_id) DO ...`, which requires a unique constraint or index covering `(reading_id)` whose predicate Postgres can infer. A partial index is only usable as an `ON CONFLICT` arbiter when the statement's `WHERE` predicate matches the index predicate — which the supabase upsert does not supply. Postgres raises `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`. So the very idempotency path the helper exists for (D-15 concurrent first-open) throws instead of no-op'ing. This is masked today only because no route calls it and the message-helper tests mock the client.
**Fix:** Either (a) make the index total by giving `reading_id` a `UNIQUE` constraint that tolerates NULLs (Postgres allows multiple NULLs under a plain UNIQUE, so a non-partial unique works for open threads too):
```sql
-- Plain UNIQUE allows many NULL rows AND is a valid ON CONFLICT arbiter.
ALTER TABLE public.threads
  ADD CONSTRAINT threads_reading_id_key UNIQUE (reading_id);
-- (drop threads_reading_id_unique_idx)
```
or (b) drop the upsert path and do an explicit insert-then-select with a unique-violation catch. Verify against the live DB with a concurrent two-tab first-open before relying on it.

## Warnings

### WR-01: `getOpenThread` uses `.maybeSingle()` but nothing enforces one open thread per user

**File:** `src/lib/threads/threads.ts:102-118` and migration `:51`
**Issue:** The partial unique index only covers `reading_id IS NOT NULL`, so a user can accumulate multiple `type='open'` threads (reading_id NULL). `getOpenThread` filters `user_id + type='open' + reading_id IS NULL` and calls `.maybeSingle()`, which **throws** (`PGRST116`, "multiple rows returned") the moment a second open thread exists. There is no DB-level or code-level guard creating exactly one. Latent runtime error as soon as any code creates a second open thread.
**Fix:** Add a partial unique index for the open-thread case and/or switch to deterministic selection:
```sql
CREATE UNIQUE INDEX threads_one_open_per_user_idx
  ON public.threads (user_id) WHERE type = 'open' AND reading_id IS NULL;
```
and/or in code use `.order("created_at").limit(1).maybeSingle()` so a stray duplicate cannot throw.

### WR-02: `getOpenThread` reads via the service client — RLS not exercised on a read path

**File:** `src/lib/threads/threads.ts:102-118`
**Issue:** Unlike `getThread` (RLS session client), `getOpenThread` uses `createServiceClient()` and hand-scopes with `.eq("user_id", userId)`. This is the same bypass-then-reimplement pattern as CR-01: correct only as long as the manual `user_id` filter is present and the caller passes a trustworthy session-derived `userId`. The doc comment justifies it ("query by user_id without needing an RLS session"), but a read that *could* run through RLS is safer doing so. Prefer the session client for reads so the DB is the backstop.
**Fix:** Use `await createClient()` (RLS session client) for `getOpenThread`, matching `getThread`. RLS (`threads_select_own`) already scopes to `auth.uid()`, so the explicit `user_id` filter becomes belt-and-suspenders rather than the sole guard.

### WR-03: Migration has no DELETE policy AND no UPDATE policy on `messages` — silent failures

**File:** `supabase/migrations/20260617000000_threads_messages.sql:107-136`
**Issue:** `messages` has RLS enabled with only SELECT and INSERT policies; `threads` has SELECT/INSERT/UPDATE but no DELETE. With RLS on and no matching policy, those operations are silently denied (return 0 rows affected, no error) for `authenticated`. Deletes today route through `ON DELETE CASCADE` from `auth.users`/`threads`, so this is not a data-integrity hole, but any future session-client UPDATE/DELETE on `messages` (e.g. edit/retract a message) will silently no-op and be hard to debug. Worth an explicit decision now.
**Fix:** Either document the intentional immutability of messages in the migration header, or add the policies you expect to need:
```sql
DROP POLICY IF EXISTS messages_delete_own ON public.messages;
CREATE POLICY messages_delete_own ON public.messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.threads
                 WHERE threads.id = messages.thread_id AND threads.user_id = auth.uid()));
```

### WR-04: `coerceFlashResponse` silently truncates/blanks malformed personas instead of failing loud

**File:** `src/lib/engine/flash/flash-schema.ts:80-90`
**Issue:** Coercion maps every persona to `{ archetype: String(pp.archetype ?? ""), verdict: normalizeVerdict(...), quote: String(pp.quote ?? "") }`. A missing `archetype` becomes `""` (which still passes `z.string()` — empty archetype is accepted by the schema), and a missing `quote` becomes `""` (correctly rejected by `.min(1)`). The asymmetry means a model that omits `archetype` produces a *valid* `FlashResult` with an empty-string archetype, which then flows into `personas-block.tsx` keyed on `persona.archetype` — duplicate empty keys cause React key collisions, and the aggregate `fraction`/band are computed off potentially garbage rows without any warning surfaced. The `warnings: string[]` channel exists in `FlashRunResult` but is never populated when coercion had to repair data.
**Fix:** Tighten the schema (`archetype: z.string().min(1)`) so an empty archetype fails Zod, and/or push a warning when coercion materially altered the payload (e.g. dropped fields, renormalized verdicts) so callers can surface low-confidence Flash output rather than treating it as clean.

### WR-05: `verdict` coercion lowercases but does not validate the *value* before Zod — odd values reach the enum check as-is

**File:** `src/lib/engine/flash/flash-schema.ts:51-54, 86`
**Issue:** `normalizeVerdict` lowercases/trims any string (and stringifies non-strings). A model returning `verdict: "stops"` or `verdict: "maybe"` is passed through verbatim (lowercased) and then rejected by the Zod enum — fine — but a model returning `verdict: true`/`verdict: 1` becomes `"true"`/`"1"` and also fails Zod, which is correct, yet the whole 10-persona response is rejected wholesale on a single bad verdict with a generic Zod message. Given Flash's stated purpose is to *salvage* small-model sloppiness, a single stray verdict nukes the entire call. Consider mapping near-miss synonyms (`"stops"→"stop"`, `"scrolls"→"scroll"`) the way `personas-block.tsx` already labels them, since the prompt itself uses "stops"/"scrolls" in the UI.
**Fix:** Extend `normalizeVerdict` to fold known synonyms before the enum check, e.g. `if (s.startsWith("stop")) return "stop"; if (s.startsWith("scroll")) return "scroll";`. Keeps the hard contract while actually delivering the advertised salvage.

### WR-06: `dispatchToolOutput` silently swallows a missing/non-array `blocks` field

**File:** `src/lib/tools/tool-runner.ts:114-121`
**Issue:** After a successful `outputSchema.safeParse`, the code does `const rawBlocks = Array.isArray(output.blocks) ? output.blocks : []`. If a runner's `outputSchema` validates but does not expose a `blocks` array (a contract drift), this returns `[]` with no error — the dispatch reports success and persists an empty message. The convention "schema root MUST expose a `blocks` array" is documented but unenforced; a misconfigured runner degrades to silent empty output instead of throwing. Note `flashRunner`'s own `FlashOutputSchema` does guarantee `blocks`, so this is a contract-safety gap, not an active bug.
**Fix:** Fail loud when the convention is violated:
```ts
if (!Array.isArray(output.blocks)) {
  throw new Error(`ToolRunner(${runner.id}): outputSchema root has no \`blocks\` array`);
}
```

## Info

### IN-01: `dispatchToolOutput` casts parsed blocks without re-validating prop shape

**File:** `src/lib/tools/tool-runner.ts:115-119`
**Issue:** `rawBlocks as OutputBlock[]` trusts that `outputSchema` already validated prop shape. True for `flashRunner`, but `assertBlocksInRegistry` only checks `block.type` membership, not props. A runner whose `outputSchema` is loose on `props` could emit type-valid/prop-invalid blocks that only get caught later at `insertMessage`/`MessageBlocks`. Acceptable given the triple-validation downstream, but worth a comment that dispatch trusts `outputSchema` for prop fidelity.
**Fix:** Add a one-line comment, or route dispatch output through `validateBlock` per block for symmetry with the persistence layer.

### IN-02: `@ts-expect-error` mutation of `callParams` is brittle

**File:** `src/lib/engine/flash/run-flash-text-mode.ts:98-101, 108`
**Issue:** `temperature`/`seed` are attached via `@ts-expect-error` post-construction, then the object is passed as `callParams as never`. If the SDK types ever gain `temperature`/`seed` (they likely already support them), `@ts-expect-error` will itself error ("unused expect-error"). Mirrors `fold.ts`, so it is an inherited pattern, but it is fragile.
**Fix:** Type `callParams` with the SDK's request type (or a local interface including `temperature?`/`seed?`) and drop the suppressions + the `as never`.

### IN-03: `MessageBlocks` re-declares the component map already exported by `block-registry.tsx`

**File:** `src/components/thread/message-blocks.tsx:22-26` vs `src/lib/tools/block-registry.tsx:23-27`
**Issue:** `BLOCK_COMPONENTS` (message-blocks) and `BLOCK_COMPONENT_REGISTRY` (block-registry.tsx) are duplicate maps of the same three renderers. The inline comment explains it avoids `.ts/.tsx` resolution ambiguity, but it means adding a fourth block type requires updating two maps; TypeScript enforces completeness on each independently, so a drift would compile but render the wrong component in one path. Minor duplication risk.
**Fix:** Import `BLOCK_COMPONENT_REGISTRY` from `block-registry.tsx` in `message-blocks.tsx` and delete the local map, or add a comment cross-referencing the two so future edits update both.

### IN-04: `loadMessages` emits `__unsupported__` sentinels but `MessageBlocks` expects raw blocks — representation mismatch

**File:** `src/lib/threads/messages.ts:144-152` vs `src/components/thread/message-blocks.tsx:33-37`
**Issue:** `loadMessages` returns `HydratedBlock[]` where failed blocks are `{ type: "__unsupported__", props: { raw } }`. `MessageBlocks` takes `body: unknown[]` and re-runs `validateBlock` on each element. If the hydrated `__unsupported__` sentinel is what gets passed to `MessageBlocks`, `validateBlock` correctly returns `{ok:false}` → `UnsupportedBlock` (no regression). But the original `raw` is now nested under `props.raw`, so any future debugging/telemetry that wants the original payload must unwrap one extra level. The two layers re-validate the same data with different sentinel encodings. Works, but the double sentinel scheme is redundant — only one re-validation layer is needed since `MessageBlocks` validates anyway.
**Fix:** Decide on a single ownership: either `loadMessages` passes raw blocks through and lets `MessageBlocks` be the sole validator, or `MessageBlocks` consumes `HydratedBlock[]` directly and skips its own `validateBlock`. Avoid validating the same data twice with two different unsupported encodings.

---

_Reviewed: 2026-06-17T08:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
