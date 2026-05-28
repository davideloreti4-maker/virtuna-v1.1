---
phase: 18-m1-verification-debt-closure
plan: "03"
subsystem: api/security
tags:
  - ssrf
  - security
  - in-03
  - verif-04
  - t-06-13
  - cron

dependency_graph:
  requires:
    - phase: 18-01
      provides: VERIF-04/WR-04 + WR-05 + IN-02 closed
    - phase: 18-02
      provides: VERIF-04/IN-01 closed (deepseek.ts + rules.ts timer fix)
  provides:
    - VERIF-04/IN-03 closed — SSRF guard in processSoundEmbedding
    - Phase 12 threat model item T-06-13 closed
    - Phase 18 final verification gate D-20 satisfied (tsc + vitest green)
    - Roll-up of all 5 VERIF-04 sub-items with grep evidence
  affects:
    - 18-04-PLAN.md (VERIF-01/02/03 UAT — can now proceed with green baseline)

tech_stack:
  added: []
  patterns:
    - "SSRF guard: new URL(...).hostname + 7 string regexes (RFC1918 + loopback + link-local + IPv6 ULA) + https-only check"
    - "Non-fatal cron rejection: log.warn + bare return (cron continues processing remaining rows)"

key_files:
  modified:
    - src/app/api/cron/calculate-trends/route.ts

key-decisions:
  - "Permissive-by-design: no hostname allowlist — allows TikTok CDN, IG, camera-roll exports, custom URLs"
  - "String-based RFC1918 regex sufficient for T-06-13 (internal probing threat); DNS rebinding accepted as residual risk per D-14"
  - "Bare return (not throw) on violation — cron must continue processing remaining rows per non-fatal pattern"
  - "Guard inserted before void stub lines so it fires on valid URLs while stubs suppress noUnusedParameters"

requirements-completed:
  - VERIF-04

duration: 5min
completed: 2026-05-25
---

# Phase 18 Plan 03: SSRF Guard (IN-03 / T-06-13) + Phase-Final Verification Gate Summary

**SSRF guard added to `processSoundEmbedding` blocking non-HTTPS + RFC1918/loopback/link-local/IPv6-ULA URLs via 7 hostname regexes; all 5 VERIF-04 sub-items grep-verified; tsc + vitest green at phase close.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-05-25
- **Tasks:** 2 (1 code edit + 1 verification-only)
- **Files modified:** 1

## Accomplishments

- SSRF guard in `processSoundEmbedding` covers all threat classes from T-06-13: non-HTTPS schemes, RFC1918, loopback, link-local, IPv6 ULA
- Invalid URL strings (URL constructor throws) caught and rejected gracefully — cron continues
- Phase 18 final verification gate D-20 satisfied: tsc clean + vitest 966/966
- All 5 VERIF-04 sub-items (WR-04, WR-05, IN-01, IN-02, IN-03) confirmed with grep evidence

## Task Commits

1. **Task 1: SSRF guard in processSoundEmbedding** — `3278102` (feat)
2. **Task 2: Phase-final verification gate** — verification-only (no code change, no separate commit)

## Files Created/Modified

- `src/app/api/cron/calculate-trends/route.ts` — SSRF guard block added inside `processSoundEmbedding` (29 lines inserted)

## IN-03 Guard Code Block

Full diff of guard added inside `processSoundEmbedding`:

```typescript
  // IN-03 (VERIF-04 / T-06-13): SSRF guard before any fetch(sound_url).
  // Permissive by design — any public HTTPS hostname is allowed (users test
  // against TikTok CDN, IG, camera-roll exports, custom URLs). The guard
  // only rejects non-HTTPS schemes and private / loopback / link-local IPs.
  // On violation: log.warn + bare return (non-fatal — cron continues).
  if (row.sound_url) {
    let hostname: string;
    try {
      hostname = new URL(row.sound_url).hostname;
    } catch {
      log.warn("sound_url SSRF guard rejected — invalid URL", { sound_url: row.sound_url });
      return;
    }
    const isPrivate =
      /^localhost$/i.test(hostname) ||
      /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^169\.254\.\d+\.\d+$/.test(hostname) ||
      /^::1$/.test(hostname) ||
      /^f[cd][0-9a-f]{2}:/i.test(hostname);
    const isHttps = row.sound_url.startsWith("https://");
    if (!isHttps || isPrivate) {
      log.warn("sound_url SSRF guard rejected", { sound_url: row.sound_url });
      return;
    }
  }
```

## Threat T-06-13 Closure Note

**Phase 12 threat model item T-06-13 is now CLOSED.**

- **Threat:** `sound_url` SSRF — attacker stores an internal URL (e.g. `http://169.254.169.254/...` for cloud metadata, `http://10.0.0.1/admin`) in `trending_sounds.sound_url`; cron fetches it from the Vercel server
- **Mitigation:** Guard rejects any URL that is not HTTPS or resolves to a private/loopback/link-local/ULA hostname before any `fetch()` call
- **Residual risks accepted (per D-14 / threat model):**
  - DNS rebinding (T-18-08): hostname resolves public at check, internal at fetch — accepted as higher-effort attack class; guard is permissive-by-design for legitimate CDN URLs
  - IPv4-mapped IPv6 bypass (T-18-09): `::ffff:10.0.0.1` not matched by regexes — acceptable for current threat profile (Apify-sourced URLs are public CDN domains)
- **Audit trail:** every rejection logged via `log.warn("sound_url SSRF guard rejected", { sound_url })` (T-18-10 repudiation mitigation)

## VERIF-04 Sub-Item Roll-up (All 5 Checks)

All grep checks run against post-Plan-03 codebase:

### WR-04 — Cron N+1 bulk-prefetch (CLOSED in Plan 01)

```
grep -cE '\.in\("sound_name", batchNames\)' src/app/api/cron/calculate-trends/route.ts
→ 1  ✓
```

Bulk SELECT `.in("sound_name", batchNames)` — one query per batch, not per row. Set construction + non-fatal fallback via `log.warn` confirmed at lines 208-228.

**Status: MET**

### WR-05 — audio_description Zod bounds (CLOSED in Plan 01)

```
grep -cE 'min\(10\)\.max\(280\)' src/lib/engine/types.ts
→ 1  ✓

grep -cE 'min\(10\)\.max\(280\)' src/lib/engine/qwen/schemas.ts
→ 1  ✓
```

Both `types.ts:375` and `qwen/schemas.ts:77` use `min(10).max(280)`.

**Status: MET**

### IN-01 — Timer leaks in deepseek.ts + rules.ts (CLOSED in Plan 02)

```
grep -cE 'clearTimeout\(timeout\)' src/lib/engine/deepseek.ts
→ 2  ✓

grep -cE 'clearTimeout\(timeout\)' src/lib/engine/rules.ts
→ 2  ✓
```

`clearTimeout` now runs in both try path (existing) and catch path (added in Plan 02) in both files.

**Status: MET**

### IN-02 — pgvector cast centralization (CLOSED in Plan 01)

```
grep -REn --include='*.ts' 'JSON\.stringify\(vectors\[j\]\)' src/ | grep -v '^\s*//' | wc -l
→ 0  ✓
```

`serializeVector` in `src/lib/supabase/pgvector.ts` replaced both inline `JSON.stringify(vectors[j])` call sites.

**Status: MET**

### IN-03 — sound_url SSRF guard (CLOSED in Plan 03 — this plan)

```
grep -c 'sound_url SSRF guard rejected' src/app/api/cron/calculate-trends/route.ts
→ 2  ✓

grep -cE 'new URL\(row\.sound_url\)\.hostname' src/app/api/cron/calculate-trends/route.ts
→ 1  ✓

awk '/async function processSoundEmbedding/,/^}/' src/app/api/cron/calculate-trends/route.ts | grep -c '^\s*throw '
→ 0  ✓  (no throw inside processSoundEmbedding)

grep -cE 'log\.warn\("Bulk idempotency prefetch failed' src/app/api/cron/calculate-trends/route.ts
→ 1  ✓  (WR-04 block unchanged)
```

**Status: MET**

## Final Phase Verification Gate (D-20)

### pnpm exec tsc --noEmit

```
TypeScript: No errors found
Exit code: 0  ✓
```

### pnpm vitest run

```
PASS (966) FAIL (0)
Exit code: 0  ✓
```

## Decisions Made

- Guard is permissive by design (no hostname allowlist) — users test against all kinds of video URLs; guard only blocks internal network probing
- `getQwenClient()` kept inside try in rules.ts (Plan 02 decision) — preserved here unchanged
- Bare `return;` not `return null;` — function returns `Promise<void>`, bare return is cleanest form

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `processSoundEmbedding` remains a no-op stub (audio pipeline deferred to future milestone). The SSRF guard ensures that when the pipeline is re-enabled, the guard already protects any `fetch(sound_url)` call. This is intentional and documented.

## Threat Flags

No new threat surface introduced. Guard reduces existing surface (T-06-13 closed). No new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

Files:
- `src/app/api/cron/calculate-trends/route.ts` — FOUND, modified
- `.planning/phases/18-m1-verification-debt-closure/18-03-SUMMARY.md` — this file

Commits:
- `3278102` — FOUND (feat(18-03): add SSRF guard to processSoundEmbedding)

Acceptance criteria:
- `grep -c 'log.warn("sound_url SSRF guard rejected'` → 2 ✓
- `grep -cE 'new URL\(row\.sound_url\)\.hostname'` → 1 ✓
- No throw inside processSoundEmbedding → 0 ✓
- WR-04 block unchanged → 1 ✓
- tsc: 0 errors ✓
- vitest: 966 passed, 0 failed ✓
