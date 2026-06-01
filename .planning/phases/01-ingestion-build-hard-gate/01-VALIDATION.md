---
phase: 1
slug: ingestion-build-hard-gate
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (repo uses `*.test.ts(x)`; existing engine + scraping tests, e.g. `src/lib/engine/corpus/__tests__/apify-jobs.test.ts`, `src/lib/engine/learning/__tests__/ingest.test.ts`) |
| **Config file** | `vitest.config.*` (confirm path during planning — present in repo per existing test dirs) |
| **Quick run command** | `npx vitest run src/lib/scraping src/lib/engine/__tests__` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~quick subset seconds; full suite per existing baseline |

---

## Sampling Rate

- **After every task commit:** Run the relevant `src/lib/scraping` + `src/lib/engine` vitest subset
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green AND the live spike artifact present with criteria 1/2/4 recorded
- **Max feedback latency:** quick subset (seconds)

---

## Per-Task Verification Map

| Req | Criterion | Test Type | Automated Command | File Exists | Status |
|-----|-----------|-----------|-------------------|-------------|--------|
| INGEST-01 | crit 1 — non-owned URL → non-empty Omni segments | integration (mocked Apify + mocked/real Omni) | `npx vitest run src/lib/scraping/__tests__/resolve-video.test.ts` | ❌ W0 | ⬜ pending |
| INGEST-01 | crit 2 — two different videos → different structural signal (C1 guard) | spike/eval (live Omni) | manual spike + recorded artifact assertion | ❌ W0 (live, in spike) | ⬜ pending |
| INGEST-01 | crit 3 — remix row null `video_storage_path`; temp deleted in `finally` (C4) | unit + integration | `npx vitest run src/app/api/analyze/__tests__/derive-and-drop.test.ts` | ❌ W0 | ⬜ pending |
| INGEST-01 | crit 4 — failure taxonomy: each class returns a typed error, not a bare throw | unit (mocked dataset shapes) | `npx vitest run src/lib/scraping/__tests__/resolve-video.failures.test.ts` | ❌ W0 | ⬜ pending |
| INGEST-01 | crit 5 — `video_upload` + `text` paths unchanged (no regression) | regression (existing) | `npx vitest run src/lib/engine` | partial (existing) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/scraping/__tests__/resolve-video.test.ts` — happy-path resolve (mocked Apify dataset → `mediaUrls[0]`) — covers crit 1
- [ ] `src/lib/scraping/__tests__/resolve-video.failures.test.ts` — empty dataset, no `mediaUrls` (private/carousel), 404, `vm.` short link — covers crit 4
- [ ] `src/app/api/analyze/__tests__/derive-and-drop.test.ts` — asserts no `video_storage_path` on remix row + `finally`-delete invoked — covers crit 3 / C4
- [ ] `01-INGESTION-SPIKE.md` artifact — the live ≥5-URL run + Omni fidelity + C1 differential (cannot be automated; live + recorded)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Apify Clockworks resolve across ≥5 varied URLs | INGEST-01 crit 1/2/4 | Billable external API + live TikTok URLs; URL-TTL and Omni hook-line fidelity can't be asserted offline | Run the spike procedure in `01-RESEARCH.md` (clockworks/tiktok-scraper, `{ postURLs:[url], shouldDownloadVideos:true }` → `mediaUrls[0]`; curl-TTL check; two-video C1 differential), record results in `01-INGESTION-SPIKE.md` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (uses `npx vitest run`)
- [x] Feedback latency acceptable (quick subset)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-01 (gsd-plan-checker verified Dimension 8 substance)
