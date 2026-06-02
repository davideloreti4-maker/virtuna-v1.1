---
phase: 04-adapt-frame-niche
plan: "02"
subsystem: engine/remix-adapt + api/remix/adapt
tags: [backend, qwen, engine, api-route, auth, ownership, tdd, wave-1]
dependency_graph:
  requires:
    - src/lib/engine/remix/decode-types.ts (AdaptInput, AdaptConcept — plan 04-01)
    - src/lib/engine/remix/decode.fixture.ts (DECODE_FIXTURE — plan 04-01)
    - src/lib/engine/qwen/client.ts (getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED)
    - src/lib/engine/utils/strip.ts (stripModelOutput)
  provides:
    - src/lib/engine/remix/adapt.ts
    - src/app/api/remix/adapt/route.ts
  affects:
    - Plan 04-03 (AdaptFrameBody) — imports generateAdaptConcepts via /api/remix/adapt
    - Plan 04-04 (AdaptShellNode) — route is the backend counterpart
tech_stack:
  added: []
  patterns:
    - Qwen JSON-mode retry+repair loop (omni-analysis.ts canonical pattern)
    - AdaptConceptsZodSchema .length(3) enforcement (schemas.ts precedent)
    - stripModelOutput before JSON.parse (all Qwen reasoning model calls)
    - read-merge-write: spread current AND current.remix (Pitfall 2 guard)
    - Auth → CSRF/Content-Type → Zod → ownership → generate → persist (route order)
    - vi.hoisted() for all vi.mock factory variables (Zod v4 UUID compatibility)
key_files:
  created:
    - src/lib/engine/remix/adapt.ts
    - src/app/api/remix/adapt/route.ts
  modified:
    - src/lib/engine/remix/__tests__/adapt.test.ts (todos → real tests)
    - src/app/api/remix/adapt/__tests__/route.test.ts (todos → real tests)
decisions:
  - "Zod v4 UUID validation is stricter than regex (requires version 1-8, variant 8/9/a/b) — test fixture must use a real UUID v4, not 00000000-0000-0000-0000-000000000001"
  - "vi.hoisted() required for all vi.mock factory variables in vitest v4 (temporal dead zone with const declarations)"
  - "Auth check before CSRF/Content-Type guards (matches analyze/route.ts, ASVS V2 ordering)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-02T08:47:00Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 04 Plan 02: Qwen-only Adapt Generator + Route Summary

Qwen-only adapt generator (`adapt.ts`) plus authenticated `/api/remix/adapt` POST endpoint. Single `qwen3.6-plus` JSON-mode call producing exactly 3 niche-adapted format concepts; route enforces auth, CSRF guards, Zod body validation, ownership check, and read-merge-write persistence that preserves `variants.craft` and `variants.remix.decode`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Qwen-only adapt generator (adapt.ts) | 8b4e68c6 | adapt.ts, adapt.test.ts |
| 2 | POST /api/remix/adapt route | 6b087840 | route.ts, route.test.ts |

## What Was Built

**`adapt.ts`** — Single Qwen JSON-mode call producing `AdaptConcept[3] | null`:
- `generateAdaptConcepts(input: AdaptInput): Promise<AdaptConcept[] | null>` — MAX_RETRIES=1, AbortController timeout (90s), stripModelOutput + AdaptConceptsZodSchema(.length(3)), belt-and-suspenders count guard mirroring pass2.ts:197
- `buildAdaptUserContent(input: AdaptInput): string` — parameter type is `AdaptInput` (not `DecodeOutput`), making `luck[]`/caption unrepresentable at compile time (D-01 structural guard)
- `ADAPT_SYSTEM_PROMPT` — stable string constant for DashScope cache prefix
- On exhaustion: `Sentry.captureException(lastError, { tags: { stage: "remix_adapt" } })` then `return null`
- Zero references to `runPredictionPipeline`, `usage_tracking`, `DAILY_LIMITS` (D-04 lightweight path)

**`route.ts`** — POST handler: auth → CSRF → Zod → ownership → adapt → read-merge-write:
- Auth: `createClient().auth.getUser()` → 401 before any DB/LLM work (T-04-03, ASVS V2)
- Content-Type 415 + cross-origin 403 guards (creator-profile pattern, T-04-07)
- `AdaptRequestSchema.safeParse` → 400; schema deliberately excludes `luck[]` (T-04-04, D-01)
- Ownership: `createServiceClient().from("analysis_results").select("user_id").eq(...).single()` → 404 if missing or `user_id !== user.id` (T-04-05, ASVS V4)
- Read-merge-write: `{ ...current, remix: { ...currentRemix, adapt: concepts } }` — two-level spread ensures `variants.craft` AND `variants.remix.decode` survive (Pitfall 2)
- generator null → 500, variants NOT written
- Returns `{ concepts }` on success

**Tests filled in:**
- `adapt.test.ts` — 11 tests green: exactly-3, repair-loop, final-invalid→null, no-caption-guard, luck-exclusion + 6 smoke
- `route.test.ts` — 12 tests green: auth-401, content-type-415, cross-origin-403, zod-body-400×2, ownership-404, read-merge-write, success-200, null-engine-500 + 3 smoke

## Verification

- `npx vitest run src/lib/engine/remix src/app/api/remix` → 23 green, 0 fail
- `grep -E 'runPredictionPipeline|usage_tracking|DAILY_LIMITS' src/lib/engine/remix/adapt.ts` → only in doc comment (no code usage) — D-04 satisfied
- Route enforces 401 before any DB/LLM work; 404 on cross-user before write
- Read-merge-write preserves craft + decode (merge-preservation test asserts all three keys present)
- `grep -c "currentRemix" src/app/api/remix/adapt/route.ts` → 2 (ownership + write scope)
- `grep "luck" src/app/api/remix/adapt/route.ts` → only in comments (schema excludes it — D-01 satisfied)
- No new npm dependencies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 UUID strictness — test fixture UUID rejected**
- **Found during:** Task 2 route test debugging
- **Issue:** Zod v4 uses a stricter UUID regex requiring version digit 1-8 and variant digit 8/9/a/b. The Wave 0 scaffold fixture `'00000000-0000-0000-0000-000000000001'` passes the JavaScript UUID pattern (`/^[0-9a-f]{8}-...$/`) but fails `z.string().uuid()` in Zod v4. This caused ownership-404, read-merge-write, success-200, and null-engine-500 tests to all return 400 (Zod body validation failure) instead of their expected statuses.
- **Fix:** Changed `ANALYSIS_ID` to `'550e8400-e29b-41d4-a716-446655440000'` (valid UUID v4 used widely in tests).
- **Files modified:** `src/app/api/remix/adapt/__tests__/route.test.ts`
- **Commit:** 6b087840

**2. [Rule 1 - Bug] vi.hoisted() required for vi.mock factory variables in vitest v4**
- **Found during:** Task 2 route test first run
- **Issue:** `const mockGenerateAdaptConcepts = vi.fn()` declared after `vi.mock('@/lib/engine/remix/adapt', ...)` in source order triggers a `ReferenceError: Cannot access 'mockGenerateAdaptConcepts' before initialization` because vi.mock is hoisted above all declarations. The original scaffold used `await import('../route')` to avoid this, but that pattern doesn't work with top-level imports.
- **Fix:** Moved all mocked variables into a single `vi.hoisted(() => ({ mockCreate, mockGetUser, mockFrom, mockGenerateAdaptConcepts }))` call. This pattern is the canonical solution per vitest docs.
- **Files modified:** `src/app/api/remix/adapt/__tests__/route.test.ts`
- **Commit:** 6b087840

## Known Stubs

None. Both `adapt.ts` and `route.ts` are fully implemented with real Qwen client calls (mocked in tests only) and real Supabase read-merge-write. No hardcoded empty values or placeholder returns.

## Threat Flags

None new. All STRIDE threats from the plan's threat model are mitigated by the implementation:
- T-04-03: auth gate in place (getUser() → 401 first)
- T-04-04: luck[]/caption excluded from both schema and input builder
- T-04-05: ownership check → 404
- T-04-06: Zod body validation + niche .max(200)
- T-04-07: Content-Type 415 + cross-origin 403

## Self-Check: PASSED

- [x] `src/lib/engine/remix/adapt.ts` — FOUND
- [x] `src/app/api/remix/adapt/route.ts` — FOUND
- [x] `src/lib/engine/remix/__tests__/adapt.test.ts` — FOUND (11 green tests)
- [x] `src/app/api/remix/adapt/__tests__/route.test.ts` — FOUND (12 green tests)
- [x] Commits 8b4e68c6, 6b087840 — FOUND in git log
- [x] `grep -c "AdaptInput" adapt.ts` → 6 (≥1 required)
- [x] `grep -c "currentRemix" route.ts` → 2 (≥1 required)
- [x] No luck key in AdaptRequestSchema (only in comments)
- [x] No runPredictionPipeline/usage_tracking/DAILY_LIMITS in adapt.ts code
- [x] vitest run 23 tests green, 0 fail
