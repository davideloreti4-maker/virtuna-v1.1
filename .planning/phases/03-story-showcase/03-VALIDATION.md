---
phase: 3
slug: story-showcase
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § Validation Architecture (HIGH confidence, all claims VERIFIED in-repo).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @testing-library/react ^16.3.2 (happy-dom via `/** @vitest-environment happy-dom */` pragma) |
| **Config file** | `vitest.config.ts` (default env `node`; component files opt into happy-dom per-file) |
| **Quick run command** | `npx vitest run src/components/marketing/story/` |
| **Full suite command** | `npm test` (`vitest run` — ~1949 green as of Phase 2) |
| **Estimated runtime** | ~5s scoped · ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/marketing/story/`
- **After every plan wave:** Run `npm test` (full suite green) + `npm run build` (exit 0, route table shows `○ /` static)
- **Before `/gsd:verify-work`:** Full suite must be green + clean build
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below bind each phase requirement to its automated check at plan granularity. The planner MUST align its task `<automated>` verifies to these commands.

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-00 | 0 | STORY-01/02/03 (scaffold) | — | N/A (static, input-free) | unit | `npx vitest run src/components/marketing/story/` | ❌ W0 creates | ⬜ pending |
| 03-01 | 1 | STORY-01 | — | N/A | unit | `npx vitest run src/components/marketing/story/__tests__/how-it-works.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01 | 1 | STORY-01 (noun discipline: "Simulation"/"simulates", never "reading") | — | N/A | unit (string) | same file | ❌ W0 | ⬜ pending |
| 03-02 | 1 | STORY-02 (names all outputs: audience sim, watch-through %, Hook, Retention, Shareability; visual is `<Placeholder>`) | — | N/A | unit | `npx vitest run src/components/marketing/story/__tests__/simulation-showcase.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02 | 1 | STORY-02 (heading reads "The Simulation", matches `#the-simulation`) | — | N/A | unit | same file | ❌ W0 | ⬜ pending |
| 03-03 | 2 | STORY-03 (3–4 blocks, each benefit + `<Placeholder>`) | — | N/A | unit | `npx vitest run src/components/marketing/story/__tests__/feature-blocks.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03 | 2 | STORY-03 (alternating column order / flip on alternating rows) | — | N/A | unit | same file | ❌ W0 | ⬜ pending |
| 03-03 | 2 | Cross: `#features` section mounted in `page.tsx` + "Features" anchor in Header + Footer | — | Centralized in-page anchor only (no open redirect) | unit | extend `page`/`header` test OR new `page.test.tsx` | ❌ W0 (verify existing) | ⬜ pending |
| all | per-wave | Success Crit 4: every product visual is a `<Placeholder>` with `aspect` (no-CLS) + `label` | — | N/A | unit | per-section tests assert `data-variant` + inline `aspect-ratio` set | ❌ W0 | ⬜ pending |
| all | phase gate | Cross: `/` stays statically prerendered (no `"use client"` leaked to section roots) | — | N/A | build assertion | `npm run build` → route table shows `○ /` | n/a (build gate) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/marketing/story/__tests__/how-it-works.test.tsx` — STORY-01 (3 steps, order, placeholder slots, noun discipline)
- [ ] `src/components/marketing/story/__tests__/simulation-showcase.test.tsx` — STORY-02 (named outputs, "The Simulation" heading, placeholder visual)
- [ ] `src/components/marketing/story/__tests__/feature-blocks.test.tsx` — STORY-03 (3–4 blocks, alternating flip, benefit+placeholder pairing)
- [ ] Anchor/mount coverage — assert `#features` section + "Features" nav link. Verify whether a `page.test.tsx` / `header.test.tsx` already exists to extend; if not, add a small new test.
- [ ] Framework install: **none** — Vitest + Testing Library + happy-dom already present (used by `placeholder.test.tsx`, `hero.test.tsx`).

*All section tests use the `/** @vitest-environment happy-dom */` pragma (mirror `placeholder.test.tsx` line 1).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Craft/taste: sections read "refined, premium, considered" and match the Phase-1/2 flat-warm bar | STORY-01/02/03 | Visual taste — five prior attempts failed here; no automated proxy for "refined" | Live UAT at `/`: scroll how-it-works → The Simulation → Features; confirm flat-matte (no glass/glow), calm rhythm, device-framed swappable slots, serif reserved to hero |
| Reduced-motion: section reveals collapse to no-motion under `prefers-reduced-motion` | STORY-01/02/03 | OS-level media query; motion primitives self-gate but the composed result needs eyes | Toggle OS reduce-motion → reload `/` → confirm sections appear without transform/opacity animation, no layout jump |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 story test files + anchor/mount coverage)
- [ ] No watch-mode flags (`vitest run`, never `vitest` watch)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
