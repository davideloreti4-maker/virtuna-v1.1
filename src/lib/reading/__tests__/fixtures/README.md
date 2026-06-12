# Reading view-model fixtures — REAL captures (not mocks)

These fixtures are **genuine captured runs**, not hand-authored mocks. The
DATA-02 identical-render contract test (`../identical-render.test.ts`, the crux,
D-12) deep-equals the live Reading against the re-opened resting document for the
**same analysis id**. That proof is only meaningful against real data — all
pre-existing repo fixtures (`src/test/fixtures/*`, `verdict/__tests__/fixtures/*`)
are hand-authored mocks with stale shapes (null `apollo_reasoning`/`hero`/
`heatmap`, deprecated `predicted_engagement` point shape) and are **explicitly
unacceptable** for this test (Phase 2 success criteria 1 + 2).

## Files

| File | What it is |
|------|------------|
| `live-<id>.json` | The live `PredictionResult` from the `complete` SSE (direct mode), or — in UI mode — the closest live snapshot the smoke script can drive (the raw row). |
| `persisted-<id>.json` | The **raw** `analysis_results` row (`select("*")` shape). `fromPersistedRow` (D-11) consolidates the `app/api/analysis/[id]/route.ts` reload shims, so it consumes the raw row — NOT the route's already-enriched output. |

Both files share the same `<id>` (the analysis the run produced). The contract
test globs this directory, so the filenames carry the id and nothing hardcodes it.

## How to regenerate

Run the smoke pipeline against ONE real video. The capture step writes the pair
here automatically when the per-video signal-completeness gate passes.

```bash
# 1. Bring the dev stack up (live engine API keys + Supabase reachable).
#    Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
pnpm dev   # http://localhost:3000

# 2. UI mode (uploads via the dev-server UI — interactive):
pnpm tsx scripts/smoke-tiktok-pipeline.ts urls.txt
#    where urls.txt holds one TikTok URL. Project note: a short clip such as
#    ~/Downloads/"TikTok Video Downloader.mp4" works well for live UAT.

#    Optional: also exercise the live reload HTTP route end-to-end by supplying
#    an authenticated session cookie (the route's user_id ownership filter is
#    NOT weakened — the cookie scopes the GET to its own row):
#      SMOKE_SESSION_COOKIE='sb-...=...' pnpm tsx scripts/smoke-tiktok-pipeline.ts urls.txt
```

The script:

- gates capture behind the per-video `gate_pass` (a degraded run is not a
  faithful contract fixture);
- **settles the write-after-`complete` race** (Pitfall 2) — it polls the
  persisted row until `variants.apollo` is non-null before snapshotting, and
  **aborts the capture with a clear message** if it never settles (rather than
  writing a partial fixture);
- reuses the `user_id`-scoped query (the `/api/analysis/[id]` ownership filter is
  never weakened).

## Before committing a regenerated fixture (T-02-01)

The persisted row may contain creator-facing content. Capture from a **synthetic
test video**, and have a reviewer confirm **no secrets/tokens/PII** are present in
the JSON before committing.
