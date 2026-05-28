---
phase: 1
slug: foundation-sse-consumer-engine-signal-extensions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (unit) + Playwright 1.58.0 (e2e) |
| **Config file** | `vitest.config.ts` + `e2e/playwright.config.ts` |
| **Quick run command** | `npx vitest run src/lib/engine src/hooks src/app/api/analyze` |
| **Full suite command** | `npx vitest run && npx playwright test --config e2e/playwright.config.ts` |
| **Estimated runtime** | ~25s quick / ~120s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/engine src/hooks src/app/api/analyze`
- **After every plan wave:** Run `npx vitest run` (full Vitest including engine 80% coverage gate)
- **Before `/gsd-verify-work`:** `npx vitest run && npx playwright test --config e2e/playwright.config.ts` green
- **Max feedback latency:** 30s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 1.1 | 1 | R2.1 | T-01-01 | `useAnalysisStream` parses stage events, builds panelReady | unit (happy-dom) | `npx vitest run src/hooks/queries/__tests__/use-analysis-stream.test.tsx` | ❌ W0 | ⬜ pending |
| 01-01-02 | 1.1 | 1 | R2.1 | T-01-02 | Reconnects once with Last-Event-ID, then polls; aborts on visibility-hidden | unit (happy-dom + mock EventSource) | `npx vitest run src/hooks/queries/__tests__/use-analysis-stream-reconnect.test.tsx` | ❌ W0 | ⬜ pending |
| 01-02-01 | 1.2 | 1 | R2.1 | — | `panel-mapping.ts` constants map stage events to panel IDs | unit | `npx vitest run src/lib/engine/__tests__/panel-mapping.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 1.3 | 2 | R1.7 | — | Emotion arc field populated on Omni analysis output | unit (engine) | `npx vitest run src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 1.4 | 2 | R6.1 | T-01-03 | `optimal_post_window` populated on known-niche analysis | unit (aggregator) | `npx vitest run src/lib/engine/__tests__/aggregator-optimal-post.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 1.4 | 2 | R6.1 | — | `computeOptimalPostWindow` returns fallback on unknown niche / table miss | unit | `npx vitest run src/lib/engine/__tests__/optimal-post.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-03 | 1.4 | 2 | R6.1 | T-01-04 | `niche_post_windows` migration creates table + pg_cron schedule | manual | `psql ... '\d niche_post_windows' && SELECT * FROM cron.job WHERE jobname='refresh-niche-post-windows'` | manual | ⬜ pending |
| 01-05-01 | 1.5 | 2 | R1.9 | — | Anti-virality threshold constant + ECE rationale documented | unit | `npx vitest run src/lib/engine/__tests__/anti-virality.test.ts` | ❌ W0 | ⬜ pending |
| 01-06-01 | 1.6 | 3 | R2.1 | — | `<Skeleton when={panelReady[id] !== 'ready'}>` toggles per panel | unit (happy-dom) | `npx vitest run src/app/\(app\)/analyze/__tests__/result-card.test.tsx` | ❌ W0 | ⬜ pending |
| 01-06-02 | 1.6 | 3 | R2.1 | T-01-05 | ResultCard skips stream open when `initialData.overall_score !== null` (pitfall #3 — replay path) | unit (happy-dom) | `npx vitest run src/app/\(app\)/analyze/__tests__/result-card.test.tsx` | ❌ W0 | ⬜ pending |
| 01-API-01 | 1.1 | 1 | R2.1 | T-01-06 | `GET /api/analyze/[id]/stream` → 401 unauth / 404 missing / 200 text/event-stream | unit (route handler) | `npx vitest run src/app/api/analyze/__tests__/stream-route.test.ts` | ❌ W0 | ⬜ pending |
| 01-API-02 | 1.1 | 1 | R2.1 | T-01-07 | POST route INSERTs placeholder + emits `event: started` BEFORE stream starts (pitfall #6) | unit (route handler) | `npx vitest run src/app/api/analyze/__tests__/route-started-event.test.ts` | ❌ W0 | ⬜ pending |
| 01-E2E-01 | 1.6 | 3 | R2.1 | — | Submit on `/analyze` → navigate to `/analyze/[id]` → panels transition idle→loading→ready | e2e | `npx playwright test e2e/result-surface-stream.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/queries/__tests__/use-analysis-stream.test.tsx` — happy-dom env, mock fetch + EventSource, assert panelReady transitions
- [ ] `src/hooks/queries/__tests__/use-analysis-stream-reconnect.test.tsx` — happy-dom env, simulate connection drop, assert single-reconnect + polling fallback
- [ ] `src/app/api/analyze/__tests__/stream-route.test.ts` — node env, mock supabase, assert headers + status codes + heartbeat
- [ ] `src/app/api/analyze/__tests__/route-started-event.test.ts` — node env, assert `event: started` frame on POST start
- [ ] `src/lib/engine/__tests__/panel-mapping.test.ts` — node env, pure map function tests
- [ ] `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` — node env, mock Qwen response, assert emotion_arc parsed
- [ ] `src/lib/engine/__tests__/aggregator-optimal-post.test.ts` — node env, mock supabase, assert optimal_post_window populated on PredictionResult
- [ ] `src/lib/engine/__tests__/optimal-post.test.ts` — node env, pure function tests with mock supabase
- [ ] `src/lib/engine/__tests__/anti-virality.test.ts` — node env, assert threshold constant + edge cases
- [ ] `src/app/(app)/analyze/__tests__/result-card.test.tsx` — happy-dom env, render with/without initialData, assert stream gate
- [ ] `e2e/result-surface-stream.spec.ts` — Playwright, mock-pipeline backend OR cached test analysis
- [ ] Test fixture: `src/test/fixtures/stage-events.ts` — canonical sequence of stage events
- [ ] Test fixture: `src/test/fixtures/completed-prediction.ts` — canonical completed PredictionResult
- [ ] No framework install needed — Vitest + Playwright + happy-dom present in `package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `niche_post_windows` table + pg_cron schedule exist in Supabase | R6.1 | DB-side state outside Vitest reach; cron schedule requires live Postgres | `supabase db diff` shows no drift; `psql -c '\d niche_post_windows'`; `psql -c "SELECT jobname, schedule FROM cron.job WHERE jobname='refresh-niche-post-windows'"` |
| Mobile reconnect behavior on visibility-change | R2.1 | EventSource visibility semantics require real browser | Open `/analyze/[id]` on iOS Safari, background app, return — assert single reconnect with Last-Event-ID |
| Anti-virality threshold rationale documented | R1.9 | Threshold provenance is a doc artifact, not a code assertion | Inspect `src/lib/engine/anti-virality.ts` for inline comment block with ECE source + sweep methodology |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
