---
phase: 03-ideas-tool
plan: 03
subsystem: ideas-pipeline
tags: [ideas, runner, sse, open-thread, kc-stamp, chain-anchor, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-ideas-tool
    plan: 01
    provides: "niche-aware runFlashTextMode panel param, gate floor (band !== 'Weak', MIXED_THRESHOLD=3)"
  - phase: 03-ideas-tool
    plan: 02
    provides: "IdeaCardBlockSchema, buildGroundingLine, withKcStamp, KC_PROVENANCE_FIELD"
provides:
  - "runIdeasPipeline: over-generate(json_object)→parallel-SIM→gate(band!=='Weak')→≤3 idea-card blocks"
  - "POST /api/tools/ideas: auth→cap→pipeline→SSE content-first→insertMessage(KC_GEN_VERSION stamped)"
  - "POST /api/tools/ideas/develop: PINNED chain-anchor endpoint for Plan 04 Hooks CTA"
  - "createOpenThreadLazy(userId): idempotent open thread get-or-create (CR-01 ownership scoped)"
  - "Open Q1 resolved: structured json_object generation (seedHookPath = 'structured')"
  - "Open Q2 resolved: parallel Promise.all SIMs + content-first SSE stream"
  - "Open Q3 resolved: ideas append to user's open thread (type:'open', reading_id:null)"
affects: [03-ideas-tool plan 04, any phase reading the /develop endpoint contract]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structured json_object generation: KC_IDEAS_SYSTEM_PROMPT + json_object response_format → {ideas:[]} (Open Q1)"
    - "Parallel Flash gate: Promise.all(ideas.map(runFlashTextMode)) — wall time ≈ one SIM (Open Q2)"
    - "Content-first SSE: status→content[faces+scrollQuote]→score[band chip] (IDEAS-02/D-04/Q2)"
    - "KC_GEN_VERSION stamp: withKcStamp({blocks}) → {kcGenVersion, blocks} JSONB message body (Plan 02 landing spot)"
    - "Chain-anchor seam: POST /develop writes anchor + placeholder; Hooks generation deferred to P4 (D-15, RESEARCH Pattern 6)"
    - "ProfileRow cast: Supabase Json→ProfileRow as unknown as ProfileRow (JSONB strict-TS boundary pattern)"

key-files:
  created:
    - src/lib/tools/runners/ideas-runner.ts
    - src/app/api/tools/ideas/route.ts
    - src/app/api/tools/ideas/develop/route.ts
    - src/lib/tools/runners/__tests__/ideas-runner.test.ts
    - src/app/api/tools/ideas/__tests__/route.test.ts
    - src/lib/threads/__tests__/open-thread.test.ts
  modified:
    - src/lib/threads/threads.ts

key-decisions:
  - "Open Q1 RESOLVED: structured json_object generation (PRIMARY); markered-prose fallback preserved but not triggered; seedHookPath='structured'"
  - "Open Q2 RESOLVED: parallel Promise.all SIMs (wall-time ≈ one SIM); content-first = status→content[face+quote]→score[band]"
  - "Open Q3 RESOLVED: open thread (type:'open', reading_id:null); ideas + chain both append to same thread"
  - "GATE FLOOR applied: band !== 'Weak' (MIXED_THRESHOLD=3 from 03-01); fail-loud if MIXED_THRESHOLD is NaN/undefined"
  - "Rate limit: deferred to v2 (no ideas-specific message count table in v1; auth + ask-cap are v1 trust boundary)"
  - "/develop Hooks placeholder: intentional D-15 affordance; Plan 04 replaces with generated Hooks cards"
  - "ProfileRow Json cast: as unknown as ProfileRow at route boundary (Supabase JSONB → typed interface)"

# Metrics
duration: ~15min
completed: 2026-06-17
---

# Phase 03 Plan 03: Ideas Pipeline Route Summary

**Server-side Ideas pipeline: over-generate(json_object)→parallel-niche-SIM gate→≤3 idea-card blocks→SSE content-first→KC_GEN_VERSION-stamped open thread + PINNED /develop chain-anchor seam for Plan 04 Hooks CTA**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-17
- **Tasks:** 2 of 2
- **Files created:** 6
- **Files modified:** 1 (threads.ts)

## MANDATORY Plan 04 Handoffs (WARNING-1)

### 1. Ideas route SSE event contract

```
event: status  { message: "Generating ideas…" }
event: status  { message: "Scoring on your audience…" }
event: content { blocks: [{type, props: {title, angle, whyItFits, mechanism, seedHook, needsTake,
                            topic, take, format, scrollQuote, model}}] }
  — card faces WITH scrollQuote (WARNING-4: quote is on the face, never deferred)
event: score   { seedHook, band, fraction, model }   (one per card, after content)
event: done    { count: N }
```

Consumer reads via `fetch` + `res.body.getReader()` (POST + body, NOT EventSource — mirrors use-expert-chat.ts).

### 2. PINNED `/develop` endpoint path + payload (WARNING-1)

```
POST /api/tools/ideas/develop
Payload: { ideaId?: string, anchor: string, platform: string }
Response: { threadId: string, messageId: string, fencedHooksBundle: string, ideaId: string | null }
```

- `anchor`: the chosen idea's concept text (fenced via assembleBundle injection fence)
- `ideaId`: optional provenance for the Hooks call
- `fencedHooksBundle`: the pre-fenced assembleBundle({mode:"hooks", anchor}) output — Plan 04 passes this directly to Hooks generation without re-assembling
- `threadId`/`messageId`: the open thread + placeholder message ids for in-thread continuation

Plan 04 Hooks CTA calls this endpoint, then calls the Hooks generation route with `fencedHooksBundle`.

### 3. Open Q1 seed-hook extraction path (WARNING-2)

**RESOLVED: `structured` (json_object generation)**

- KC_IDEAS_SYSTEM_PROMPT instructed to return `{ideas: [...]}` JSON; each idea has an explicit `seedHook` field.
- No brittle prose parsing. Removes the ===IDEA=== delimiter pattern from the prototype.
- Fallback (`markered`) preserved in code but NOT triggered in production.
- `runIdeasPipeline` returns `seedHookPath: "structured"` so callers can observe which path ran.

### 4. Over-generate buffer + gate floor (from 03-01-SUMMARY)

| Constant | Value | Source |
|----------|-------|--------|
| IDEA_BUFFER | 5 | Plan 03 runner (D-13) |
| MAX_SURVIVORS | 3 | Plan 03 runner (D-13) |
| GATE FLOOR | `band !== "Weak"` (MIXED_THRESHOLD = 3) | 03-01-SUMMARY mandatory handoff |

## Task Commits

| # | Phase | Commit | Description |
|---|-------|--------|-------------|
| 1 RED | TDD | 245d7789 | test(03-03): failing ideas-runner tests |
| 1 GREEN | TDD | a42cec10 | feat(03-03): ideas-runner — over-generate→gate→3 blocks |
| 2 RED | TDD | ab67cf1a | test(03-03): failing route + open-thread tests |
| 2 GREEN | TDD | 4a54c90e | feat(03-03): Ideas SSE route + createOpenThreadLazy + /develop endpoint |

## Files Created/Modified

- `src/lib/tools/runners/ideas-runner.ts` — NEW: `runIdeasPipeline` (generate→SIM→gate→blocks)
- `src/app/api/tools/ideas/route.ts` — NEW: POST /api/tools/ideas SSE route
- `src/app/api/tools/ideas/develop/route.ts` — NEW: POST /api/tools/ideas/develop chain-anchor
- `src/lib/threads/threads.ts` — Added `createOpenThreadLazy(userId)` (idempotent + CR-01 scoped)
- `src/lib/tools/runners/__tests__/ideas-runner.test.ts` — NEW: 7 runner unit tests
- `src/app/api/tools/ideas/__tests__/route.test.ts` — NEW: 8 route integration tests
- `src/lib/threads/__tests__/open-thread.test.ts` — NEW: 4 open-thread idempotency tests

## Decisions Made

- **Open Q1 structured generation (resolved):** json_object mode with `{ideas:[{seedHook,...}]}` shape removes brittle prose delimiter. Plan 04 inherits this pattern for Hooks generation.
- **Open Q2 parallel + content-first (resolved):** `Promise.all` for SIM wall-time ≈ 1 SIM; SSE emits face (with scrollQuote) before band chip. `status` events provide legible progress to client.
- **Open Q3 open thread (resolved):** `type:"open"`, `reading_id:null` — one open thread per user; both ideas messages and the develop chain append to the same thread. `createOpenThreadLazy` mirrors `createGroundedThreadLazy` idempotent pattern.
- **Rate limit deferred to v2:** No ideas-specific message count table in v1. Auth + ask-cap (400 on >2000 chars) are the v1 trust boundary. RATE_LIMIT constants defined; wiring deferred.
- **`/develop` Hooks placeholder intentional (D-15):** Plan 04 replaces with generated Hooks cards. The placeholder is the D-15 in-thread chain seam, not a stub blocking the plan goal.
- **ProfileRow Json cast:** Supabase database.types.ts types JSONB columns as `Json`; `as unknown as ProfileRow` at the route boundary is the correct TS pattern (runtime shape matches the interface).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Runner test file mock isolation conflict**
- **Found during:** Task 2 GREEN
- **Issue:** Route test file had `vi.mock("@/lib/tools/runners/ideas-runner")` hoisted at top-level, causing runner tests in the same file to import the mocked (empty) runner.
- **Fix:** Moved runner unit tests to `src/lib/tools/runners/__tests__/ideas-runner.test.ts` (own file, own mock scope). Route tests now only test the route layer.
- **Commit:** 4a54c90e

**2. [Rule 1 - Bug] TypeScript strict null — `simResult` possibly undefined**
- **Found during:** Task 2 build
- **Issue:** TypeScript flagged `simResults[i]` as possibly `undefined` (array index access).
- **Fix:** Added `!idea` guard + `simResult === null || simResult === undefined` check before accessing `.result`.
- **Commit:** 4a54c90e

**3. [Rule 1 - Bug] TypeScript type incompatibility — Supabase ProfileRow**
- **Found during:** Task 2 build
- **Issue:** `creator_profiles` row returned by Supabase has `target_audience: Json` (JSONB); `ProfileRow` expects a typed object.
- **Fix:** Added `as unknown as ProfileRow | null` cast at the route boundary + imported `ProfileRow` type. This is the documented pattern for Supabase JSONB fields.
- **Commit:** 4a54c90e

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Rate-limit (TODO v2) | `src/app/api/tools/ideas/route.ts:101` | No ideas-count table in v1; auth + ask-cap are v1 trust boundary. RATE_LIMIT constants defined for v2 wiring. Does NOT block plan goal. |
| Hooks placeholder block | `src/app/api/tools/ideas/develop/route.ts` | Intentional D-15 affordance (RESEARCH Pattern 6). Plan 04 replaces with generated Hooks cards. Required by D-15, not a missing feature. |

## Threat Flags

New endpoints introduced:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-api-route | src/app/api/tools/ideas/route.ts | POST SSE route — auth (T-03-07), ask cap (T-03-10), assembleBundle injection fence (T-03-09), service-client ownership (T-03-08/CR-01), block validation at write (T-03-11), Qwen-only (T-03-12) — all mitigated |
| threat_flag: new-api-route | src/app/api/tools/ideas/develop/route.ts | POST chain-anchor — same mitigations; anchor fenced via assembleBundle; auth before any DB write |

All threat register entries (T-03-07 through T-03-12) applied as specified.

## Self-Check: PASSED

- `src/lib/tools/runners/ideas-runner.ts`: FOUND
- `src/app/api/tools/ideas/route.ts`: FOUND
- `src/app/api/tools/ideas/develop/route.ts`: FOUND
- `src/lib/threads/threads.ts` (createOpenThreadLazy): FOUND
- `src/lib/tools/runners/__tests__/ideas-runner.test.ts`: FOUND
- `src/app/api/tools/ideas/__tests__/route.test.ts`: FOUND
- `src/lib/threads/__tests__/open-thread.test.ts`: FOUND
- Commit 245d7789 (Task 1 RED): FOUND
- Commit a42cec10 (Task 1 GREEN): FOUND
- Commit ab67cf1a (Task 2 RED): FOUND
- Commit 4a54c90e (Task 2 GREEN): FOUND
- vitest 18 tests PASS, 0 FAIL
- npm run build: PASS (Compiled successfully)
- npm test: 234 files PASS, 0 FAIL
