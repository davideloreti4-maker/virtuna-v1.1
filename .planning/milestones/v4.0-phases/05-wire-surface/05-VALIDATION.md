---
phase: 5
slug: wire-surface
status: signed
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-06
signed: 2026-06-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | package.json `test: vitest run` |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | full suite ~tens of seconds (~900+ tests); single file <5s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <relevant file>` (quick)
- **After every plan wave:** Run `npm test` (full suite — threading regressions surface here)
- **Before `/gsd:verify-work`:** Full suite green + one real video run proving `variants.apollo.dimensions[].score` non-null in DB + insight-hero renders on fresh AND permalink + `scripts/measure-pipeline.ts` ≤90s
- **Max feedback latency:** ~5s (single-file quick run)

---

## Per-Task Verification Map

| Req / Decision | Behavior | Test Type | Automated Command | File Exists |
|----------------|----------|-----------|-------------------|-------------|
| R5/D-01 | composite_score == deterministic (weighted) sum of dimension scores | unit | `npx vitest run src/lib/engine/__tests__/deepseek*.test.ts` | ❌ W0 (new — sum identity + 6 dims + score field) |
| R8/D-01 | same video twice → identical composite (rubric-sum determinism) | unit | `npx vitest run <new determinism test>` | ❌ W0 |
| R5/D-01 | schema accepts dimension `score`; old band-only rows still parse on read | unit | `npx vitest run src/lib/engine/__tests__/*types*` | ❌ W0 |
| threading | `apollo_reasoning.dimensions[].score` survives aggregator→persist (assembly-hop guard) | unit | aggregator test asserting non-null on new field | ❌ W0 |
| D-02 | band/range render from overall_score+confidence | unit | `npx vitest run src/components/board/verdict/__tests__/*` | ✅ (VerdictNode tests exist) |
| D-08 strip | results-panel never renders predicted-engagement (always null) | unit | `npx vitest run src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx` | ✅ (exists; update after strip) |
| D-08 hero | insight-hero renders rewrites + dims from live result AND permalink `variants.apollo` | unit | new frame test, dual-read fixture | ❌ W0 |
| D-07 | a rewrite is labelled with the heatmap biggest-drop mm:ss | unit | new join test | ❌ W0 |
| R11 | two creators of different follower tiers → materially different range; output is a range not a point | unit | new aggregator/estimate test | ❌ W0 |
| R6 | E2E ≤90s, fold ∥ Apollo unchanged | integration/manual | `scripts/measure-pipeline.ts <video>` | ✅ harness exists (human/live) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/__tests__/deepseek*.test.ts` — composite == weighted sum of dimension scores; determinism (same input twice); 6 dims each carry a score
- [ ] aggregator threading test — `apollo_reasoning.dimensions[].score` non-null end-to-end (assembly-hop guard)
- [ ] insight-hero frame test — dual-read (live top-level + `variants.apollo`), rewrites struck-through + copyable, 6 dims, drop-point label (D-07)
- [ ] R11 estimate test — follower-tier sensitivity + range-not-point
- [ ] update `results-panel.predicted-engagement-null.test.tsx` after strip (remove/repurpose the "renders when present" case)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E latency ≤90s with fold ∥ Apollo unchanged | R6 | Needs live engine + real video + API quota | `npx tsx scripts/measure-pipeline.ts <video-url>` — assert total ≤90s, omni ~17s first paint |
| Real run persists `variants.apollo.dimensions[].score` non-null to DB | D-01 threading | Requires live Supabase write + Qwen run | Run a real `/analyze`, query `analysis_results` row, confirm dimension scores present + permalink reload renders hero |
| **Same video twice → identical OR same-D-02-band `overall_score`** (live determinism gate) | R8/D-01 | The W0 unit test proves the rubric *adder* (same parsed dims → same sum), NOT the live cure — thinking-mode residual can flip a dimension band, and the untouched behavioral 53.3% half can still move the composite. Per [[engine-determinism-gate]]: assert same-video-twice identity on a REAL run before trusting the determinism claim. | Run `scripts/measure-pipeline.ts <video>` (or `/analyze`) on the SAME video twice; record both `overall_score` values; PASS if byte-identical OR both land in the same D-02 band. Document the two composites in sign-off. **Required before phase sign-off.** |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s (single-file quick run)
- [x] `nyquist_compliant: true` set in frontmatter

**Accepted cuts (not silent — recorded here):**
- **R11 estimate is live-only** (05-02/05-04): `predicted_engagement` is computed on the live result and deliberately not persisted, so the engagement range card shows on a fresh analysis and is absent on permalink reload. This is an accepted UX cut (per-creator-median persistence is a deferred follow-up), not a regression. 05-04 should render a one-line "estimate available on fresh run" affordance so reload reads as intentional, not broken.

**Open before sign-off (gates verify, not execution):**
- Live same-video-twice determinism gate (manual-only table) must be run + its two composites recorded here.

**Approval:** signed 2026-06-06 (contract approved for execution; live determinism gate + real-run threading remain as manual verify items before phase completion)
