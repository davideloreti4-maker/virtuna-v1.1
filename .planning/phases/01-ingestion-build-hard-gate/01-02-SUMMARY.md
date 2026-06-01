---
phase: 01-ingestion-build-hard-gate
plan: 02
subsystem: ingestion
tags: [apify, clockworks, tiktok, ssrf, typed-errors, resolver, tdd]

requires:
  - phase: 01-ingestion-build-hard-gate
    plan: 01
    provides: "confirmed Apify contract (mediaUrls[0], api.apify.com host, failure shapes)"

provides:
  - "resolveVideoUrl(url: string): Promise<ResolvedVideo> — single-URL resolver with SSRF guard"
  - "IngestError class with kind discriminant (5 types)"
  - "apifyVideoSchema extended with mediaUrls field (additive, scrapeVideos unaffected)"
  - "ResolvedVideo interface { mp4Url: string; durationSeconds: number }"
  - "ScrapingProvider interface extended with resolveVideoUrl"
  - "Wave-0 scraping test files (15 passing tests)"

affects:
  - src/lib/scraping/apify-provider.ts
  - src/lib/scraping/types.ts
  - src/lib/schemas/competitor.ts
  - src/lib/scraping/__tests__/resolve-video.test.ts
  - src/lib/scraping/__tests__/resolve-video.failures.test.ts
  - src/lib/schemas/__tests__/competitor.test.ts

tech-stack:
  added: []
  patterns:
    - "SSRF allowlist via hostname suffix matching (.apify.com, .tiktokcdn.com)"
    - "Typed error taxonomy via IngestError extends Error with kind discriminant"
    - "Mutable-state vi.mock pattern for ApifyClient (avoids hoisting issues)"

key-files:
  created:
    - src/lib/scraping/__tests__/resolve-video.test.ts
    - src/lib/scraping/__tests__/resolve-video.failures.test.ts
    - src/lib/schemas/__tests__/competitor.test.ts
  modified:
    - src/lib/scraping/apify-provider.ts
    - src/lib/scraping/types.ts
    - src/lib/schemas/competitor.ts

key-decisions:
  - "mediaUrls[0] confirmed as mp4 field — added as z.array(z.string().url()).optional() to apifyVideoSchema"
  - "SSRF allowlist: .apify.com, .apifyusercontent.com, .tiktokcdn.com, .tiktokcdn-us.com — HTTPS only"
  - "not_found detection: branch on item.error/item.errorCode BEFORE mediaUrls extraction (spike-confirmed shape)"
  - "scrape_failed wraps actor throw (replaces bare Error at apify-provider.ts:33)"
  - "Mutable-state mock pattern chosen over vi.fn() for ApifyClient to avoid hoisting issues in vitest"

metrics:
  duration: "25min"
  completed: "2026-06-01"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
  tests_added: 35
  tests_passing: 35
---

# Phase 01 Plan 02: Single-URL Resolver Summary

**`resolveVideoUrl(url)` implemented with typed IngestError taxonomy (5 kinds), SSRF allowlist (api.apify.com + TikTok CDN), and 35 passing tests across both Wave-0 scraping test files.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-01
- **Tasks:** 2 (both auto/TDD)
- **Tests added:** 35 (15 in scraping, 20 in schemas)
- **Tests passing:** 35/35

## Accomplishments

### Task 1: Schema + Types
- Extended `apifyVideoSchema` with `mediaUrls: z.array(z.string().url()).optional()` (spike-confirmed field). Additive — `scrapeVideos`'s `safeParse` path unaffected.
- Added `ResolvedVideo` interface: `{ mp4Url: string; durationSeconds: number }`.
- Added `IngestErrorKind` union type + `IngestError extends Error` class carrying `kind` and `url` discriminants.
- Extended `ScrapingProvider` interface with `resolveVideoUrl(url: string): Promise<ResolvedVideo>`.

### Task 2: Resolver + SSRF + Tests
- Implemented `ApifyScrapingProvider.resolveVideoUrl(url)` mirroring the existing `scrapeVideos` actor-call pattern.
- Input shape: `{ postURLs: [url], resultsPerPage: 1, shouldDownloadVideos: true }` with `{ waitSecs: 180 }` (spike-confirmed).
- Failure taxonomy (in branch order):
  1. Actor throws → `IngestError("scrape_failed")`
  2. `items.length === 0` → `IngestError("empty_dataset")`
  3. `item.error` or `item.errorCode` present → `IngestError("not_found")` ← spike-critical: checked BEFORE mediaUrls
  4. `safeParse` fails → `IngestError("no_media_url")`
  5. `mediaUrls` absent/empty → `IngestError("no_media_url")`
  6. SSRF check fails → `IngestError("ssrf_rejected")`
- SSRF allowlist: `api.apify.com`, `.apifyusercontent.com`, `.tiktokcdn.com`, `.tiktokcdn-us.com` (HTTPS required; internal IPs + loopback rejected).

## resolveVideoUrl Contract (for Plan 03)

```typescript
async resolveVideoUrl(url: string): Promise<ResolvedVideo>
// Returns: { mp4Url: string; durationSeconds: number }
// mp4Url is a SSRF-validated https://api.apify.com/v2/key-value-stores/... URL
// Requires ?token=<APIFY_TOKEN> for actual fetch (Plan 03 re-hosts to Supabase)
// Throws IngestError with kind: "empty_dataset" | "no_media_url" | "not_found" | "ssrf_rejected" | "scrape_failed"
```

## SSRF Allowlist Suffixes

```
.apify.com           — confirmed observed host (api.apify.com KV records)
.apifyusercontent.com — Apify public CDN (resilience)
.tiktokcdn.com       — TikTok CDN suffix (resilience)
.tiktokcdn-us.com    — TikTok US CDN suffix (resilience)
```

All require `protocol === "https:"`. Private IP ranges (RFC 1918 + loopback) explicitly rejected.

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/lib/schemas/competitor.ts` | Modified | Added `mediaUrls` field to `apifyVideoSchema` |
| `src/lib/scraping/types.ts` | Modified | Added `ResolvedVideo`, `IngestErrorKind`, `IngestError`, extended `ScrapingProvider` |
| `src/lib/scraping/apify-provider.ts` | Modified | Added `resolveVideoUrl` + SSRF allowlist |
| `src/lib/scraping/__tests__/resolve-video.test.ts` | Created | 5 happy-path tests (incl. vm. link) |
| `src/lib/scraping/__tests__/resolve-video.failures.test.ts` | Created | 10 failure taxonomy + SSRF tests |
| `src/lib/schemas/__tests__/competitor.test.ts` | Created | 20 schema round-trip + IngestError tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest vi.mock hoisting requires mutable-state pattern**
- **Found during:** Task 2 implementation
- **Issue:** `vi.mock` factories are hoisted before module imports. Referencing module-scope `vi.fn()` variables inside the factory resulted in `is not a constructor` errors because the variables hadn't been initialized yet.
- **Fix:** Used a mutable `mockState` object captured in a plain class mock inside the factory. Module-scope variables read the mutable state on each call instead of being referenced directly by the factory.
- **Files modified:** `resolve-video.test.ts`, `resolve-video.failures.test.ts`
- **Commit:** 349a7359

## Threat Surface

| Threat ID | Status |
|-----------|--------|
| T-01-04 (SSRF on resolved mp4 host) | Mitigated — allowlist + internal IP rejection in `isAllowedMp4Host()`, tested in `resolve-video.failures.test.ts` |
| T-01-06 (bare Error throws) | Mitigated — all throws in `resolveVideoUrl` are `IngestError` (6 typed throws total) |

## Next Phase Readiness

**Plan 03 unblocked.** It receives:
- `resolveVideoUrl(url)` → `{ mp4Url, durationSeconds }` (SSRF-clean api.apify.com URL)
- `mp4Url` needs `?token=<APIFY_TOKEN>` to fetch (Plan 03 re-hosts to Supabase + derive-and-drop)
- `IngestError.kind` taxonomy for honest error copy in the route handler

---

## Self-Check: PASSED

- [x] `src/lib/scraping/apify-provider.ts` exists with `resolveVideoUrl`
- [x] `src/lib/scraping/types.ts` exists with `IngestError` class
- [x] `src/lib/schemas/competitor.ts` exists with `mediaUrls` field
- [x] `src/lib/scraping/__tests__/resolve-video.test.ts` exists
- [x] `src/lib/scraping/__tests__/resolve-video.failures.test.ts` exists
- [x] Commit b1b1e9d0 (Task 1) confirmed
- [x] Commit 349a7359 (Task 2) confirmed
- [x] 35 tests passing (vitest run src/lib/scraping + normalize-scrape)
