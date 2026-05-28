# VERIF-03 — Phase 4 Wave 0 Content-Type + Niche-Detector Cost UAT

**REQ:** VERIF-03 (Phase 18, milestone Engine Hardening)
**Target:** live Vercel deploy — https://virtuna-v11.vercel.app
**Date executed:** 2026-05-25
**Executed by:** Davide Loreti

## Goal

Confirm the two pending Phase 4 live-API tests:
1. Wave 0 content-type label returned by `/api/analyze` matches the visual content of the test video
2. Niche-detector `cost_cents > 0` on a fresh (non-cached) request, with cache breakdown absent

## Preconditions

- [ ] Live deploy URL reachable: https://virtuna-v11.vercel.app
- [ ] Valid auth token / session cookie for the live app
- [ ] Two test videos with distinct content types — examples:
  - Video A: talking-head (creator speaking directly to camera)
  - Video B: product-demo (showing a product / workflow)
- [ ] Both videos must be fresh (never submitted before) to avoid cache hits — use new URLs or clear cache via Supabase admin if needed
- [ ] Access to full JSON response body (either curl or DevTools Network panel)

## Steps

### A. Wave 0 content-type

1. Submit Video A (talking-head) to `/api/analyze`:
   ```
   curl -N -X POST https://virtuna-v11.vercel.app/api/analyze \
     -H "Content-Type: application/json" \
     -H "Cookie: [your-auth-cookie]" \
     -d '{"videoUrl": "[video-A-url]"}' \
     --no-buffer
   ```
2. In the final `event: result` payload, locate the `content_type` field (or equivalent Wave 0 label). Record observed: ___
3. Expected: label matches the visual content (e.g. `"talking-head"` or similar for Video A). Record: MATCH / MISMATCH
4. Repeat for Video B (product-demo). Record `content_type` observed: ___ Record: MATCH / MISMATCH

### B. Niche-detector cost_cents > 0

1. Submit a fresh, never-seen video (Video A or Video B from above — use a fresh URL to guarantee no cache hit).
2. In the final `event: result` payload (or admin logs), inspect the cost breakdown:
   - Locate `cost_cents` (or `cost_cents_estimated`) in the response.
   - Expected: value is **greater than 0** (niche-detector made at least one LLM/API call).
   - Record observed value: ___
3. Check whether a `cache_breakdown` field (or similar cache-decomposition stage) is present or absent:
   - Expected: absent / `null` / `false` on a fresh, non-cached request (cache breakdown stage does not run on first hit).
   - Record observed: ___

## Result

Choose ONE:
- [ ] **PASS** — Wave 0 content_type labels match for both videos (A green) AND `cost_cents > 0` with cache breakdown absent on fresh request (B green). VERIF-03 closed as MET.
- [ ] **FAIL** — at least one section red. Open follow-up ticket; do NOT close VERIF-03.
- [x] **DEFERRED PERMANENTLY** — live-deploy blocker / feature gated / premise invalidated.

### Defer-permanently rationale (only if chosen above)

- **What was attempted:** Attempted to reach https://virtuna-v11.vercel.app — URL resolves to default Next.js starter, not the Virtuna app.
- **Blocker:** `virtuna-engine-hardening` milestone branch has not been deployed to production. No `/api/analyze` endpoint is live to test Wave 0 content-type or niche-detector cost.
- **Why it's acceptable to leave deferred:** Wave 0 classification and niche-detector cost paths are exercised by vitest suite (966/966 green). Live API test requires a working production deploy — re-run on first production deployment of the engine-hardening milestone.
