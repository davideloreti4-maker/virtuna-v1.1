# Phase 1: Test, Verify, Complete & Optimize - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify the entire v1.0 Backend Foundation milestone works end-to-end, audit the prediction engine against the architecture reference doc, fix deviations, write tests, optimize latency/cost, clean up dev artifacts, and visually test the complete user flow in-browser before merging to main.

**Source of truth for engine audit:** `.planning/reference/session-640dc7c5-prediction-engine.md` (in main worktree at `~/virtuna-v1.1/`)

</domain>

<decisions>
## Implementation Decisions

### Verification scope
- All v1.0 features verified — no feature excluded
- **Deep audit:** Prediction engine + API routes (compare implementation against architecture reference doc line by line)
- **Standard verification:** DB migrations, Apify scraping, TanStack Query hooks, dashboard UX (confirm they work, basic checks)
- "Verified" means: automated tests pass AND visual browser check confirms correct behavior
- If prediction engine implementation deviates from the architecture reference, fix to **full alignment** — all 10 pipeline stages, both models (Gemini Flash for visual, DeepSeek R1 for reasoning), correct cost/latency targets
- Include basic UI verification: dashboard renders, data flows through, no broken states

### Test coverage strategy
- **Full test pyramid:** Unit tests for individual pipeline stages, integration tests for full pipeline flow, E2E tests for API routes
- **AI mocking strategy:** Real API calls in dev (Gemini + DeepSeek), mocked in CI for speed/cost
- **Testing framework:** Use whatever's already configured in package.json; if nothing, use Vitest
- **Coverage target:** 80%+ on `src/lib/engine/` and API route handlers
- Tests must be deterministic in CI (mocked responses)

### Optimization targets
- **Latency target:** 3-5s total pipeline (from architecture doc) — Gemini + DeepSeek run in parallel
- **Cost target:** ~$0.013 per analysis (from architecture doc)
- Both latency and cost are equally important
- Backend + basic client optimization: ensure TanStack Query caching/invalidation works correctly
- Apify scraping: just verify it works, don't optimize scheduling
- DB queries: Claude's discretion — profile key queries, fix bottlenecks if found

### Merge readiness criteria
- **Target:** Merge backend-foundation branch into main (virtuna-v1.1)
- **Known blocker:** Prediction engine accuracy — primary concern, must be audited and fixed
- **Code cleanup required:** Remove console.logs, resolve TODOs, clean unused imports before merge
- **Visual browser testing required:** Complete user flow tested in detail in browser BEFORE merge
  - Dashboard loads correctly
  - User submits content (text AND video)
  - Analysis visual/loading experience works
  - Complete prediction results display with correct scores, factors, suggestions, persona reactions
  - Analysis history accessible and accurate
  - All connected pages and navigation work
- No merge until the full user test flow is connected and visually verified

### Claude's Discretion
- DB query profiling depth — fix obvious bottlenecks, don't over-optimize for MVP
- Loading skeleton and error state design details
- Test file organization and naming patterns
- Exact cleanup scope for dev artifacts

</decisions>

<specifics>
## Specific Ideas

- User has concerns the prediction engine backend doesn't match what was intended — the architecture reference doc (`session-640dc7c5-prediction-engine.md`) defines the 10-stage pipeline with specific model assignments and cost/latency targets
- "Test everything" — the visual browser testing should be thorough, not a cursory check
- Clean code before merge — ship quality, not dev artifacts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-test-verify-complete-optimize*
*Context gathered: 2026-02-16*
