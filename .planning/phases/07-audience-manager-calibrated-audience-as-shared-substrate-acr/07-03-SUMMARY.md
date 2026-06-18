---
phase: 07-audience-manager-calibrated-audience-as-shared-substrate-acr
plan: "03"
subsystem: audience-calibration-routes
tags: [audience, calibration, sse, crud-routes, tdd, honesty-spine, thin-data-gate, apify]
dependency_graph:
  requires:
    - src/lib/audience/audience-types.ts
    - src/lib/audience/goal-intent.ts
    - src/lib/audience/temperature-disposition.ts
    - src/lib/audience/audience-repo.ts
    - src/lib/scraping/apify-provider.ts
    - src/lib/engine/corpus/follower-tier.ts
  provides:
    - src/lib/audience/calibration.ts
    - src/lib/audience/persona-repaint.ts
    - src/app/api/audiences/route.ts
    - src/app/api/audiences/[id]/route.ts
    - src/app/api/audiences/calibrate/route.ts
    - src/lib/audience/__tests__/calibration.test.ts
    - src/app/api/audiences/__tests__/route.test.ts
  affects: [07-04, 07-05, 07-06]
tech_stack:
  added: []
  patterns: [TDD-London-School, SSE-ReadableStream, provider-injection-for-testability, thin-data-gate, honesty-spine, CR-01-session-user-id]
key_files:
  created:
    - src/lib/audience/calibration.ts
    - src/lib/audience/persona-repaint.ts
    - src/app/api/audiences/route.ts
    - src/app/api/audiences/[id]/route.ts
    - src/app/api/audiences/calibrate/route.ts
    - src/lib/audience/__tests__/calibration.test.ts
    - src/app/api/audiences/__tests__/route.test.ts
  modified: []
decisions:
  - "THIN_MIN_VIDEOS=10: strict threshold (both tier===null AND videos<10 required for thin gate)"
  - "Repaint is template-based (not LLM call): deterministic, cheap, stored ONCE at calibration (Pitfall 2)"
  - "Provider injection via optional _provider param on calibrateFromScrape (avoids vi.mock class constructor issues)"
  - "calibrateFromScrape runs scrapeProfile + scrapeVideos in parallel (Promise.all) for speed"
  - "SSE event names: status/fallback/error/done (exact names for 07-04 frontend calls)"
  - "Thin fallback uses @handle in message copy; Target audience uses name as fallback label"
  - "GENERAL_AUDIENCE.id='general' imported directly in DELETE route for explicit refusal (D-04)"
metrics:
  duration: "~8m"
  completed: "2026-06-18"
  tasks_completed: 2
  files_count: 7
---

# Phase 7 Plan 03: Calibration Pipeline + Audience Routes Summary

Calibration pipeline + CRUD route surface: handle or description → persisted, goal-biased Audience — or honest General fallback without fabrication. SSE streams staged status so 1-3 min Apify runs never block opaquely.

## What Was Built

### `src/lib/audience/calibration.ts`

Exports: `THIN_MIN_VIDEOS`, `deriveAudienceProfile`, `calibrateFromScrape`

**Thin-data gate (D-06 / Pitfall 3):**
- BOTH conditions required: `getFollowerTier(followerCount) === null` AND `videos.length < THIN_MIN_VIDEOS`
- Returns `{ fallback: 'general', reason: 'thin' }` — NEVER constructs a single `CalibratedPersona`
- Network/actor throw → `{ error: 'scrape_failed' }` — distinct from thin (UI-SPEC copy distinguishes them)

**Success path:**
- `Promise.all([scrapeProfile, scrapeVideos])` parallel scrape
- `biasForGoalIntent(goalIntent)` baked into `persona_weights` ONCE (Pitfall 2 — stored, not per-request)
- `repaintPersonas(...)` called once, result stored in `audience.personas`
- Returns `{ audience: Omit<Audience, 'id' | 'created_at' | 'updated_at'> }` — caller persists

**THIN_MIN_VIDEOS = 10** (strict per Assumptions A4)

### `src/lib/audience/persona-repaint.ts`

Exports: `repaintPersonas`

**Template-based repaint (not LLM):** deterministic, cheap, stored ONCE at calibration time.
- Each of 10 archetypes → `baseDescription + goalIntentSuffix`
- 4 goal-intent suffix tables (grow/sell/authority/nurture) × 10 archetypes = 40 deterministic strings
- Share calculation: `slot_weight / archetypes_per_slot` (proportional)
  - fyp (5 archetypes): each gets `fyp/5`
  - niche (3 archetypes): each gets `niche/3`
  - loyalist (1): gets `loyalist`
  - cross_niche (1): gets `cross_niche`
- Shares sum to 1.0 exactly

### Route Contracts (for 07-04 frontend calls)

#### `GET /api/audiences`
- Auth-first → `listAudiences()` → `{ audiences: Audience[] }`
- Returns: `[GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...userRows]`

#### `POST /api/audiences`
- Auth-first → Zod validate → `createAudience()` → `{ audience }` (201)
- Request body: `{ name, type, platform, goal_label?, goal_intent?, persona_weights?, personas?, profile?, calibration? }`
- user_id: always from session (CR-01)

#### `GET /api/audiences/[id]`
- Auth-first → `getAudience(id)` → `{ audience }` (200) or 404

#### `PATCH /api/audiences/[id]`
- Auth-first → Zod partial validate → `updateAudience(id, data)` → `{ audience }` (200)

#### `DELETE /api/audiences/[id]`
- Auth-first → refuses `id === 'general'` with 400 `{ error: 'cannot_delete_general' }` (D-04)
- User-owned: `deleteAudience(id)` → 204

#### `POST /api/audiences/calibrate` (SSE, `maxDuration=300`)
- Auth-first → Zod validate `{ handle?, type, platform, goalIntent, name, description? }`
- SSE event stream:

| Event | Payload | Timing |
|-------|---------|--------|
| `status` | `{ message: "Reading your followers…" }` | Before Apify call |
| `status` | `{ message: "Building your audience profile…" }` | After Apify call |
| `fallback` | `{ reason: 'thin', message: string }` | If thin gate fires — warning-toned, no createAudience |
| `error` | `{ message: string, retry: true }` | On scrape_failed or persist error |
| `done` | `{ audience: Audience }` | On success — persisted audience |

## Test Coverage

| File | Tests | Result |
|------|-------|--------|
| calibration.test.ts | 20 | PASS |
| route.test.ts | 19 | PASS |
| **Total (plan 03)** | **39** | **All green** |
| **Total (all audience)** | **101** | **All green** |

## Key Decisions Made

1. **THIN_MIN_VIDEOS = 10:** Strict threshold per A4. Both tier===null AND videos < 10 required. A creator with 50k followers but only 8 public videos does NOT trigger thin gate (tier resolves → proceed with scrape).

2. **Template-based repaint (not LLM-once):** v1 repaint is a deterministic template (base description + goal-intent suffix). Cheap, zero latency, stored at calibration. An LLM-once approach would require persisting the LLM output anyway — the template achieves the same storage contract without Apify-side latency.

3. **Provider injection for testability:** `calibrateFromScrape` accepts an optional `_provider` param. Avoids `vi.mock` class constructor issues (Vitest mock factory returns a plain function, not a constructable class). Production path instantiates `new ApifyScrapingProvider()` when `_provider` is undefined.

4. **Parallel scrape (`Promise.all`):** `scrapeProfile` and `scrapeVideos` are independent Apify actor calls — running them in parallel reduces calibration latency. Both throw paths are caught together.

5. **SSE event names (stable — 07-04 frontend uses these exactly):**
   - `status` — staged copy messages (2 stages)
   - `fallback` — thin-data honest notice (D-06, warning-toned)
   - `error` — scrape failure with retry signal
   - `done` — persisted audience payload

6. **sanitizeText on all free-text inputs (T-07-04):** Strips control characters + trims on `handle`, `name`, `description`, `goal_label` before any DB write or prompt use.

## Downstream Contracts

**07-04 (chip + wiring / frontend):**
- Route paths: `GET /api/audiences`, `POST /api/audiences`, `GET/PATCH/DELETE /api/audiences/[id]`, `POST /api/audiences/calibrate`
- Calibrate SSE event names: `status` / `fallback` / `error` / `done`
- Sentinel ids: `'general'`, `'preset-growth'`, `'preset-conversion'` (unchanged from 07-02)

**07-05 (BLOCKING gate / DB push):**
- After `supabase db push`: regenerate `database.types.ts` and remove `(supabase as any)` casts from `audience-repo.ts`

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors found in unrelated files (44 errors in total in the project — flash-schema.test.ts, fold-adapter.test.ts, etc.) — all pre-date this plan and are out of scope per deviation rules.

## Commits

| Hash | Message |
|------|---------|
| a20938ea | test(07-03): add failing tests for calibration pipeline + persona-repaint (RED) |
| 3bd466ca | feat(07-03): calibration pipeline + persona-repaint (GREEN) |
| 62a7f12b | feat(07-03): audiences CRUD routes + calibrate SSE route |

## Threat Flags

None — all mitigations from T-07-01 through T-07-05 implemented:

| ID | Status |
|----|--------|
| T-07-01: weights sum Zod refine | Applied on all write routes (POST/PATCH) |
| T-07-02: RLS owner-scoped | Enforced at DB layer (audience-repo + migration); routes rely on it |
| T-07-03: user_id from session | CR-01 enforced in audience-repo.createAudience + all route handlers |
| T-07-04: sanitizeText on inputs | Applied to handle/name/description/goal_label before any use |
| T-07-05: scrape own handle | D-06 scope enforced in calibration (Personal = own handle; Target = no scrape) |

## Known Stubs

None — all routes fully implemented. The `(supabase as any)` cast in `audience-repo.ts` is a known interim (pending `database.types.ts` regeneration in 07-05), not a stub.

## Self-Check: PASSED
