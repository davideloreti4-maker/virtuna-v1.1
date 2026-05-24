---
phase: 01-foundation-scaffold
plan: "04"
subsystem: app/seo
tags: [seo, sitemap, robots, metadata-routes, nextjs]
requires: [next@15, src/app/layout.tsx]
provides: [src/app/sitemap.ts, src/app/robots.ts, "/sitemap.xml", "/robots.txt"]
affects: [seo-baseline, crawl-policy]
tech-stack:
  added: []
  patterns: [nextjs-metadata-routes]
key-files:
  created:
    - src/app/sitemap.ts
    - src/app/robots.ts
  modified: []
decisions:
  - "Use Next.js metadata file conventions (TypeScript exports of typed sitemap/robots functions) — auto-serves /sitemap.xml and /robots.txt without manual XML/text construction"
  - "Sitemap entries: only /, /#demo, /#pricing per UI-SPEC § SEO Baseline. Auth-gated routes (/dashboard, /api, /auth, /onboarding) deliberately excluded and explicitly disallowed in robots.ts"
  - "Base URL https://virtuna.ai matches metadataBase already set in src/app/layout.tsx — single source of truth for canonical URL"
metrics:
  duration: 1m 29s
  completed: 2026-05-24
  tasks_completed: 2
  files_changed: 2
requirements_completed: [FOUND-10]
requirements_partial: [META-03]
---

# Phase 01 Plan 04: SEO Baseline (sitemap.ts + robots.ts) Summary

SEO baseline shipped — Next.js metadata routes export typed sitemap (3 entries) and robots (allow `/`, disallow auth-gated routes, sitemap link) for Landing v1.

## Objective Recap

Add Next.js App Router metadata files at `src/app/sitemap.ts` and `src/app/robots.ts` so Next.js 15 auto-serves `/sitemap.xml` and `/robots.txt`. Both files were missing before this plan. Implements FOUND-10 (sitemap.ts + robots.ts production SEO baseline) and contributes the SEO half of META-03 (OG image regeneration deferred to Plan 05).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create `src/app/sitemap.ts` (MetadataRoute.Sitemap, 3 entries) | b8b05e1 | src/app/sitemap.ts |
| 2 | Create `src/app/robots.ts` (MetadataRoute.Robots, allow + disallow + sitemap link) | 22f0327 | src/app/robots.ts |

## Implementation Details

### `src/app/sitemap.ts`
- Default export `sitemap(): MetadataRoute.Sitemap` returning 3 entries
- `https://virtuna.ai/` — `priority: 1.0`, `changeFrequency: 'weekly'`
- `https://virtuna.ai/#demo` — `priority: 0.9`, `changeFrequency: 'monthly'`
- `https://virtuna.ai/#pricing` — `priority: 0.9`, `changeFrequency: 'monthly'`
- `lastModified` set to `new Date()` at module evaluation (Next.js evaluates at build/revalidation, no need for request-time freshness)
- Base URL `https://virtuna.ai` matches `metadataBase` in `src/app/layout.tsx`

### `src/app/robots.ts`
- Default export `robots(): MetadataRoute.Robots`
- Single rule block: `userAgent: '*'`, `allow: '/'`, `disallow: ['/dashboard', '/api', '/auth', '/onboarding']`
- `sitemap: 'https://virtuna.ai/sitemap.xml'` — points to Task 1's auto-served sitemap
- No `crawlDelay` (defaults appropriate for marketing site)

## Verification

Static contract checks (12 OK lines, ≥10 required by plan):
- Both files exist
- `sitemap.ts` exports default `sitemap` with canonical URL + 3 entries (root, /#demo, /#pricing)
- `robots.ts` exports default `robots` with allow `/`, all four disallow entries, sitemap pointer
- `pnpm exec tsc --noEmit` produces zero errors in `src/app/sitemap.ts` or `src/app/robots.ts`

## Deviations from Plan

None — plan executed exactly as written. Both files written verbatim per the plan's `<action>` code blocks. All acceptance criteria for both tasks passed on first run.

## Out-of-Scope Observations

Pre-existing TypeScript errors in `src/lib/engine/**` (746 errors across 15 files: TS2304 missing `expect`, TS2307 missing `@google/genai` module, TS2353/TS7006 type mismatches in `__tests__/video-e2e.test.ts`, etc.) are unrelated to this plan and existed before any changes were made. Per SCOPE BOUNDARY rule, not addressed here. Should be tracked in a separate plan (engine integration or test infrastructure).

## Authentication Gates

None — fully autonomous execution.

## Threat Model Compliance

Plan's `<threat_model>` lists three `accept` dispositions (T-01-14 information disclosure of public anchors, T-01-15 robots.txt advisory tampering, T-01-16 elevation via anchor-only routes). No `mitigate` dispositions required code changes. Auth-gated routes deliberately excluded from sitemap and explicitly disallowed in robots — defense-in-depth (Supabase middleware enforces actual access control regardless of robots advisory).

## Known Stubs

None. Both files are complete, typed, and serve the intended runtime behavior.

## Threat Flags

None — no new security surface introduced beyond what the plan's threat model documented.

## TDD Gate Compliance

N/A — plan frontmatter `type: execute`, not `type: tdd`. Tasks are `type="auto"` without `tdd="true"`, so no RED/GREEN gate sequence required.

## Self-Check: PASSED

- [x] `src/app/sitemap.ts` exists (verified with `test -f`)
- [x] `src/app/robots.ts` exists (verified with `test -f`)
- [x] Commit `b8b05e1` exists in git log
- [x] Commit `22f0327` exists in git log
- [x] All 12 static verification checks emit `OK:` lines
- [x] `pnpm exec tsc --noEmit` produces zero errors in sitemap.ts/robots.ts
