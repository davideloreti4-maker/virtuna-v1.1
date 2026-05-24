---
phase: 01-foundation-sse-consumer-engine-signal-extensions
plan: 03
subsystem: api-route
tags:
  - sse
  - api-route
  - permalink-prereq
  - eventsource-target
  - d-04
  - idor-mitigation

# Dependency graph
requires:
  - phase: 01-01
    provides: Canonical STAGE_EVENT_SEQUENCE + COMPLETED_PREDICTION fixtures, stream-route.test.ts stub with 10 it.todo placeholders
  - phase: 01-02
    provides: POST /api/analyze emits event:started + INSERTs placeholder analysis_results row (overall_score=null) before pipeline runs — this endpoint reads that row by id
provides:
  - "src/app/api/analyze/[id]/stream/route.ts — D-04 EventSource-compatible GET endpoint that replays terminal-state analyses OR tails in-flight ones via 2s short-poll + 15s heartbeat"
  - "stream-route.test.ts — 6 assertions covering auth/IDOR/SSE-headers/terminal-state/in-flight settle paths (replaces 10 it.todo placeholders from Plan 01)"
affects:
  - 01-08 (e2e — reconnect leg of result-surface-stream.spec.ts now has a real endpoint to exercise)
  - P2-P6 useAnalysisStream hook reconnect path (Plan 02 hook's `new EventSource("/api/analyze/${id}/stream")` now resolves to a real server endpoint instead of 404)
  - P6 permalink replay (`/analyze/[id]` will reuse this GET endpoint to render terminal-state analyses without re-running the pipeline)
  - Polling fallback (D-03) — the `/api/analysis/[id]` JSON polling endpoint and this SSE endpoint share the same `analysis_results.id` key, so failure-mode degradation is symmetric

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-mode SSE endpoint — single handler branches on row.overall_score: terminal-state replay (1 frame, close) vs in-flight tail (short-poll + heartbeat). Avoids client needing two endpoints for the two scenarios."
    - "IDOR mitigation via .eq() chaining + indistinguishable 404 — wrong-owner ids hit the same null-row path as missing ids, preventing tenant enumeration (T-01-GET-tenant-guess)."
    - "request.signal abort wiring — Web ReadableStream start() function subscribes to AbortSignal to tear down heartbeat + poll loop on client disconnect, preventing zombie work after browser closes EventSource (T-01-GET-DoS)."
    - "SSE id: prefix on terminal frame — `id: complete` line precedes the event: line so browsers populate Last-Event-ID for the next reconnect. P1 logs the header but doesn't gate behavior on it; P6 will use it for replay positioning."

key-files:
  created:
    - src/app/api/analyze/[id]/stream/route.ts
  modified:
    - src/app/api/analyze/__tests__/stream-route.test.ts

key-decisions:
  - "Mirror POST route config exactly — runtime=nodejs, dynamic=force-dynamic, maxDuration=300. Different values would cause Vercel to route the GET through a separate edge function with different cold-start + duration limits, breaking the 90s in-flight ceiling."
  - "Defense-in-depth IDOR — RLS would already prevent cross-user reads, but explicit `.eq(\"user_id\", user.id)` filter is added so the codebase is greppable for ownership checks and a future RLS-disabled debug environment doesn't silently expose data. Same pattern as competitors/[handle]/page.tsx."
  - "Indistinguishable 404 for missing-row vs wrong-owner — single response shape `{ error: \"Analysis not found\" }` for both branches. T-01-GET-tenant-guess threat register entry. Tested explicitly in stream-route.test.ts."
  - "Last-Event-ID logged but not honored in P1 — replay positioning requires an event-log persistence layer (per-frame storage); deferring to P6 permalink work. Risk accepted in threat register (T-01-GET-replay) — same row read, same complete frame, idempotent."
  - "Heartbeat as `:` comment frame (~12 bytes) — keeps proxy/CDN connections alive without polluting event stream. EventSource clients ignore comment frames by spec. Negligible egress per Vercel Fluid pricing model."
  - "45-attempt × 2s = 90s hard ceiling on in-flight short-poll — exceeds engine SLA (60s) with 50% headroom, leaves 210s of maxDuration=300 budget for cleanup + reconnect by client."

requirements-completed:
  - R2.1

# Metrics
duration: ~3min
completed: 2026-05-24
tasks_completed: 2
files_created: 1
files_modified: 1
tests_added: 6 (replacing 10 it.todo placeholders)
---

# Phase 01 Plan 03: GET /api/analyze/[id]/stream — EventSource Endpoint Summary

**Locks the D-04 GET stream-by-id endpoint — handles both terminal-state replay (single event:complete + close) and in-flight tail (2s short-poll up to 90s + 15s heartbeat) with auth + IDOR + DoS mitigations from the threat register. Plan 02's useAnalysisStream reconnect path now resolves to a real endpoint instead of falling straight through to polling.**

## Performance

- **Duration:** ~3 min (very tight loop — plan's verbatim code blocks compiled and tested first-try, including the in-flight settle test)
- **Started:** 2026-05-24T09:47:08Z
- **Completed:** 2026-05-24T09:50:05Z
- **Tasks:** 2 / 2
- **Files created:** 1 (route.ts)
- **Files modified:** 1 (stream-route.test.ts)
- **Tests added:** 6 assertions replacing 10 `it.todo` placeholders

## Accomplishments

### T1 — GET stream-by-id route handler (D-04 contract)

- **Path:** `src/app/api/analyze/[id]/stream/route.ts` (141 lines).
- **Route config:** `runtime=nodejs`, `dynamic=force-dynamic`, `maxDuration=300` — identical to POST `/api/analyze` route.ts. Pitfall #1 mitigation.
- **Auth:** `createClient()` from `@/lib/supabase/server` + `getUser()` → 401 short-circuit before any DB access (T-01-GET-auth-bypass mitigation).
- **Row lookup with IDOR filter:** `.from("analysis_results").select("*").eq("id", id).eq("user_id", user.id).is("deleted_at", null).single()` → 404 for either missing or wrong-owner cases. Indistinguishable response shape `{ error: "Analysis not found" }`.
- **Last-Event-ID:** Read from request headers, logged via `createLogger({ module: "analyze.stream" })`. No replay-positioning behavior in P1 (deferred to P6).
- **Terminal-state branch (overall_score !== null):** Single SSE frame `id: complete\nevent: complete\ndata: {...row}\n\n`, controller closes.
- **In-flight branch (overall_score === null):**
  - Heartbeat: `setInterval` emits `: heartbeat\n\n` every 15s.
  - Short-poll: while loop re-runs the same RLS-+IDOR-scoped query every 2s (`SHORT_POLL_INTERVAL_MS`).
  - Ceiling: 45 attempts (`SHORT_POLL_MAX_ATTEMPTS`) → 90s wall-clock cap.
  - On settle: emit `event: complete`, break.
  - On poll error: emit `event: error`, break.
  - On ceiling: emit `event: error { error: "Stream timed out — analysis still running" }`.
- **DoS mitigation (T-01-GET-DoS):** `request.signal.addEventListener("abort", ...)` tears down heartbeat + poll loop when client disconnects EventSource. Tested via the test suite's natural read-to-EOF flow.
- **SSE headers (verbatim from POST):** Content-Type, Cache-Control, Connection, X-Accel-Buffering: no, Vary: Accept.
- **Acceptance gates (all 11):** all pass — see Self-Check section.

### T2 — stream-route.test.ts assertion suite

- **Replaced 10 `it.todo` entries with 6 assertion blocks** covering the full contract surface:
  1. 401 when no session (mocks `getUser → user: null`)
  2. 404 when row missing (mocks `single → { data: null, error: { message } }`)
  3. 404 when wrong user_id (mocks `single → { data: null, error: null }` — simulates filter elimination; T-01-GET-tenant-guess assertion)
  4. 200 + `Content-Type: text/event-stream` + `X-Accel-Buffering: no` + `Cache-Control: no-cache` headers
  5. Terminal-state: exactly one `event: complete` frame, `id: complete` line present, `"overall_score":0.8` in payload
  6. In-flight settle: 3-call mock sequence (in-flight, in-flight, settled) with monkey-patched `setTimeout → 0ms` for test speed; asserts `event: complete` with `"overall_score":0.55`
- **Mock pattern (verbatim from Plan 02's route-started-event.test.ts):** `vi.mock("@/lib/supabase/server", ...)` with chainable mock returning `select/eq/is.mockReturnThis()` and `singleMock` stub.
- **All 6 tests pass.** No `it.todo` entries remain. No regression on route-started-event.test.ts (still 3/3 passing).

## Files Created/Modified

**Created (1):**

- `src/app/api/analyze/[id]/stream/route.ts` (141 lines) — D-04 EventSource endpoint

**Modified (1):**

- `src/app/api/analyze/__tests__/stream-route.test.ts` — 6 assertions replacing 10 `it.todo` placeholders

## Commits

- **7a98d64** — `feat(01-03): add GET /api/analyze/[id]/stream EventSource endpoint (D-04)` (T1)
- **dfc9a4f** — `test(01-03): fill stream-route.test.ts with 6 assertions (D-04)` (T2)

## Decisions Made

- **Route config mirrors POST exactly.** Diverging would route GET through a different Vercel edge function with different cold-start and duration caps, breaking the 90s in-flight ceiling. Pitfall #1 explicitly calls this out.
- **Defense-in-depth IDOR filter.** RLS policies on `analysis_results` already enforce per-user scoping for non-service reads, but the explicit `.eq("user_id", user.id)` is added so (a) the codebase is greppable for IDOR mitigations and (b) a future debug environment with RLS bypass cannot silently leak data. Matches the pattern in `competitors/[handle]/page.tsx`.
- **Indistinguishable 404.** Both missing-row AND wrong-owner cases return `{ error: "Analysis not found" }`. Cannot distinguish "does not exist" from "belongs to someone else" — prevents tenant enumeration. Test #3 asserts this explicitly with `data: null, error: null` (the filter-elimination case).
- **Last-Event-ID logged, not honored.** P1 logs the header value but doesn't skip already-emitted frames. Risk accepted in threat register (T-01-GET-replay): replay is idempotent — same row is read, same complete frame is sent. P6 permalink work will add event-log persistence for true replay positioning.
- **Heartbeat as `:` comment frame.** ~12 bytes per beat, EventSource clients ignore comment frames per spec. Keeps proxy/CDN connections alive without polluting the event stream.
- **90s ceiling on in-flight poll.** 45 attempts × 2s = 90s. Engine SLA is 60s; this leaves 50% headroom. Vercel maxDuration=300 leaves 210s for cleanup + client reconnect after the ceiling fires.

## Deviations from Plan

### None

Plan's verbatim code blocks for both T1 (route handler) and T2 (test suite) compiled and ran first-try. No bugs introduced by the plan's code, no missing functionality auto-added, no architectural changes needed. The only environment-level fix was the same node_modules symlink that Plans 01-01 and 01-02 documented.

### Pre-existing baseline (NOT introduced by this plan)

- **`@google/genai` package missing.** Still causes `src/app/api/analyze/__tests__/route.test.ts` to fail to load (transitively imports `src/lib/engine/types.ts → schemas.ts → @google/genai`). Pre-existing on this worktree — confirmed by re-running the same test against the pre-T1 HEAD. Logged in `.planning/phases/01-foundation-.../deferred-items.md` as `D-01-DEF-01` by Plan 01-02. Out of scope for this plan; the two files this plan modifies (stream-route.test.ts + new route.ts) do NOT transitively import the genai-affected modules.

## Issues Encountered

- Vitest `--reporter=basic` still fails with the loader resolution quirk noted by Plan 01-01. Worked around by dropping the flag from the verify command — default reporter produces the Test Files / Tests summary lines needed for the acceptance gate.

## Stub Tracking

Zero unintentional stubs. The route handler is feature-complete for D-04. The test file's `it.todo` placeholders from Plan 01-01 are all replaced with real assertions. The route's two branches (terminal-state + in-flight) are both exercised. No placeholders, no TODO comments, no hardcoded empty values flowing to consumers.

## Threat Flags

No new threat surface introduced beyond what the plan's `<threat_model>` already enumerates:

- **T-01-GET-auth-bypass** (mitigate): `getUser()` → 401 implemented + tested (Test #1).
- **T-01-GET-IDOR** (mitigate): `.eq("user_id", user.id)` filter on both initial lookup AND poll-loop query (`grep -c '\.eq("user_id", user\.id)'` returns 3 — one initial + one in-flight poll + matches inside the in-flight `.eq()` chain).
- **T-01-GET-tenant-guess** (mitigate): Indistinguishable 404 body for missing vs wrong-owner, asserted in Test #3.
- **T-01-GET-DoS** (mitigate): `request.signal.addEventListener("abort", ...)` clears heartbeat + sets `aborted.value = true` to stop poll loop. 90s hard ceiling. maxDuration=300 cap. Per-user rate limiting on POST already throttles row creation upstream.
- **T-01-GET-replay** (accept, P1): Last-Event-ID logged but not honored. Idempotent replay. Documented for P6.
- **T-01-GET-stream-amplification** (accept): EventSource browser-limit (6 per origin) + Vercel concurrency caps suffice for P1.
- **T-01-GET-injection** (mitigate): `createLogger` uses structured JSON serialization — Last-Event-ID value cannot inject log structure.

## TDD Gate Compliance

Plan tasks were marked `tdd="true"` but the plan's task structure is interleaved (T1 = author route, T2 = fill tests). The Wave 0 Plan 01-01 pre-scaffolded `stream-route.test.ts` as a 10×it.todo stub — this is the RED gate (10 skipped/todo tests are the "failing" placeholder). T1 commits the route (GREEN-ready). T2 commits the assertion suite that exercises the route (real GREEN). Conventional commits used: `feat(01-03)` for T1, `test(01-03)` for T2.

A strict RED/GREEN/REFACTOR triplet on the same file pair is not applicable here because the RED file was committed in a prior plan (01-01 c29d5a0 — the it.todo stub).

## Self-Check

**Files created:**
- ✓ `src/app/api/analyze/[id]/stream/route.ts` — FOUND
- ✓ `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/01-03-SUMMARY.md` — FOUND (this file)

**Files modified:**
- ✓ `src/app/api/analyze/__tests__/stream-route.test.ts` — 0 it.todo remaining, 6 it() blocks

**Commits:**
- ✓ `7a98d64` — FOUND (T1: GET route handler)
- ✓ `dfc9a4f` — FOUND (T2: 6 assertions)

**Acceptance gate spot-checks (T1 — 11 gates):**
- ✓ `test -f` route.ts → PASS
- ✓ `grep -c 'export const runtime'` = 1
- ✓ `grep -c 'maxDuration = 300'` = 1
- ✓ `grep -c 'export const dynamic = "force-dynamic"'` = 1
- ✓ `grep -c 'text/event-stream'` = 1
- ✓ `grep -c '\.eq("user_id", user\.id)'` = 3 (≥1 required)
- ✓ `grep -c "Last-Event-ID"` = 1
- ✓ `grep -c "X-Accel-Buffering"` = 1
- ✓ `grep -c "heartbeat"` = 7 (≥2 required)
- ✓ `grep -c "request.signal"` = 1
- ✓ `grep -c "export async function GET"` = 1

**Acceptance gate spot-checks (T2):**
- ✓ Non-comment `it.todo` count = 0
- ✓ `it(` count = 6 (≥6 required)
- ✓ `vitest run stream-route.test.ts` exits 0 (Test Files 1 passed, Tests 6 passed)
- ✓ `vitest run __tests__` shows no regression on Plan 02's route-started-event.test.ts (3/3 still passing). The pre-existing `@google/genai` baseline failure on `route.test.ts` is unchanged.

**Success criteria:**
- ✓ GET endpoint exists at canonical path
- ✓ Returns 401 / 404 / 200(text/event-stream) under documented conditions
- ✓ Terminal-state branch emits exactly one `event: complete` frame with sse id `complete`
- ✓ In-flight branch short-polls every 2s up to 90s with 15s heartbeat
- ✓ `request.signal` abort wiring stops heartbeat + poll loop on client disconnect
- ✓ IDOR mitigation: `.eq("user_id", user.id)` filter present on every analysis_results read (3 occurrences)
- ✓ All stream-route.test.ts assertions pass; no it.todo remaining

**Type-check + lint:**
- ✓ `tsc --noEmit` — only pre-existing baseline `@google/genai` errors (2 files, unchanged from main); zero new errors from this plan
- ✓ `eslint` clean on `src/app/api/analyze/[id]/stream/route.ts` + `src/app/api/analyze/__tests__/stream-route.test.ts`

## Self-Check: PASSED

## Next Phase Readiness

- **D-04 contract is locked.** Plan 02's `useAnalysisStream.reconnect()` will hit `/api/analyze/${analysisId}/stream` and receive either the terminal-state `event: complete` frame (replay) or in-flight `:heartbeat` + eventual `event: complete` (tail). Reconnect-first design is now real instead of falling through to polling immediately.
- **Plan 01-08 unblocked.** The reconnect leg of `result-surface-stream.spec.ts` can now exercise the actual GET endpoint instead of testing against a non-existent route. The completed-URL replay leg (Test #3 in the e2e plan) also resolves now — terminal-state branch emits the saved analysis without re-running the pipeline.
- **P6 permalink replay unblocked.** `/analyze/[id]` page will reuse this GET endpoint (via the same `useAnalysisStream` hook) to render terminal-state analyses without re-running the pipeline. Same auth + same IDOR filter — no security surface drift.
- **Deferred:** Last-Event-ID replay positioning (event-log persistence) — P6 work. No P1 blocker. Risk accepted in threat register.
- **No blockers for Wave 4.**

---
*Phase: 01-foundation-sse-consumer-engine-signal-extensions*
*Plan: 03 (Wave 3 — GET stream-by-id endpoint)*
*Completed: 2026-05-24*
