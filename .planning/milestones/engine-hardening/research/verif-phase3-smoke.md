# VERIF-02 — Phase 3 /api/analyze SSE + Cache-Hit Smoke

**REQ:** VERIF-02 (Phase 18, milestone Engine Hardening)
**Target:** live Vercel deploy — https://virtuna-v11.vercel.app
**Date executed:** 2026-05-25
**Executed by:** Davide Loreti

## Goal

Confirm Phase 3 SC#4 + SC#5 against the live Vercel deploy:
1. POST to `/api/analyze` returns a valid SSE stream (`event: progress` + `event: result`)
2. A second POST with identical input returns a cache hit with near-zero cost

## Preconditions

- [ ] Live deploy URL reachable: https://virtuna-v11.vercel.app
- [ ] Valid auth token for the live app (get via browser DevTools → Application → Cookies → `sb-*-auth-token` or equivalent session cookie)
- [ ] A short test video URL (publicly accessible mp4 or TikTok CDN URL)
- [ ] `curl` available in terminal (or browser Network panel open)

## Steps

### A. /api/analyze SSE smoke

1. Issue a POST to `https://virtuna-v11.vercel.app/api/analyze` with the test video. Example curl:
   ```
   curl -N -X POST https://virtuna-v11.vercel.app/api/analyze \
     -H "Content-Type: application/json" \
     -H "Cookie: [your-auth-cookie]" \
     -d '{"videoUrl": "[test-video-url]"}' \
     --no-buffer
   ```
   (Alternatively: use the browser Network panel — filter by `/api/analyze`, inspect the EventStream tab.)

2. Expected: response Content-Type is `text/event-stream`. Record observed: ___
3. Expected: at least one `event: progress` line streams before the final result. Record observed: ___
4. Expected: a final `event: result` arrives with a valid JSON payload (score, content_type, etc.). Record final payload shape (paste or summarise): ___
5. Record `cost_cents_estimated` from first call: ___

### B. Cache-hit smoke

1. Issue a second POST to `/api/analyze` with the **exact same** video URL and identical inputs.
2. Expected: response arrives faster than the first call (cache hit). Record latency diff: ___
3. Expected: `cost_cents_estimated` in the second response is 0 or near-zero (no LLM calls on cache hit). Record value: ___
4. Expected: response body or headers contain a cache-hit indicator (field name may vary — look for `cached: true`, `cache_hit: true`, or similar). Record observed: ___

**Note (D-19 escape):** If Vercel's edge strips `text/event-stream` and the SSE response degrades to a plain JSON response, record as DEFERRED PERMANENTLY with rationale: `"Vercel edge handling strips SSE; covered by local integration tests instead."` Only apply if SSE is definitively not working — try both curl and browser Network panel first.

## Result

Choose ONE:
- [ ] **PASS** — SSE stream works (A green) AND cache hit shows near-zero cost (B green). VERIF-02 closed as MET.
- [ ] **FAIL** — at least one section red. Open follow-up ticket; do NOT close VERIF-02.
- [x] **DEFERRED PERMANENTLY** — live-deploy blocker / feature gated / premise invalidated.

### Defer-permanently rationale (only if chosen above)

- **What was attempted:** Attempted to reach https://virtuna-v11.vercel.app/api/analyze — URL resolves to default Next.js starter, not the Virtuna app.
- **Blocker:** `virtuna-engine-hardening` milestone branch has not been deployed to production. No valid `/api/analyze` endpoint is live.
- **Why it's acceptable to leave deferred:** The SSE stream and cache-hit paths are covered by local integration tests (vitest 966/966 green). Live smoke requires a working production deploy — re-run on first production deployment of the engine-hardening milestone.
