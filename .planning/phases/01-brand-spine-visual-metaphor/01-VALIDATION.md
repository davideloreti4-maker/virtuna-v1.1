---
phase: 1
slug: brand-spine-visual-metaphor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Phase 1 is artifacts-only** — no production code is written. Validation centers on document-existence checks, vocab-lint script execution, and downstream Phase 2-6 enforcement.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (existing — Phase 1 doesn't add tests) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm lint:vocab` (the new vocab-lint script — runs in <1s) |
| **Full suite command** | `pnpm lint && pnpm build && pnpm lint:vocab` |
| **Estimated runtime** | ~5 seconds (no test compilation; smoke-grep + lint) |

---

## Sampling Rate

- **After every task commit:** `pnpm lint:vocab` (vocab-lint script — <1s)
- **After every plan wave:** `pnpm lint && pnpm build && pnpm lint:vocab` (full hygiene)
- **Before `/gsd-verify-work`:** All file-existence checks pass + vocab-lint clean + Davide D-15 batch sign-off
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-* | 01 | 1 | BRAND-01 | — | BRAND-SPINE.md contains canonical one-liner | smoke | `test -f .planning/reference/BRAND-SPINE.md && grep -q "Your audience, simulated" .planning/reference/BRAND-SPINE.md` | ❌ W0 | ⬜ pending |
| 1-01-* | 01 | 1 | BRAND-02 | — | Required H2 sections present | smoke | `for s in "Voice" "Vocabulary" "Tone" "Audience"; do grep -q "## $s" .planning/reference/BRAND-SPINE.md \|\| exit 1; done` | ❌ W0 | ⬜ pending |
| 1-01-* | 01 | 1 | BRAND-03 | — | Numen Machines lockup matrix present | smoke | `grep -q "Lockup Decision Matrix\|VIRTUNA · A NUMEN MACHINES PRODUCT" .planning/reference/BRAND-SPINE.md` | ❌ W0 | ⬜ pending |
| 1-01-* | 01 | 1 | BRAND-04 | — | Three-audience framing per viewport | smoke | `grep -q "Audience Tuning\|Audience tuning per section" .planning/reference/BRAND-SPINE.md` | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | VIZ-01 | — | Hero behavioral-simulation visual locked in addendum | smoke | `grep -q "Behavioral Simulation\|Behavioral-Simulation" BRAND-BIBLE.md` | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | VIZ-02 | — | 4-stage engine pipeline visual locked in addendum | smoke | `grep -qE "4-stage|Engine.*Pipeline|Engine Diagram" BRAND-BIBLE.md` | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | VIZ-03 | — | Scale affordances (mobile/desktop) documented | smoke | `grep -q "Scale Affordances\|mobile scale\|reduced-motion" BRAND-BIBLE.md` | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | VIZ-04 | — | Tech rationale + bundle numbers documented | smoke | `grep -E "Canvas 2D.*30 ?KB\|motion/react.*15 ?KB\|LazyMotion" BRAND-BIBLE.md` | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | VIZ-05 | — | Composite: VIZ-01 + VIZ-02 + VIZ-03 all pass | smoke | (chained) | ❌ W0 | ⬜ pending |
| 1-03-* | 03 | 2 | BRAND-05 | — | Plagiarism audit + replacement copy on disk | smoke | `test -f .planning/phases/01-brand-spine-visual-metaphor/01-PLAGIARISM-AUDIT.md && test -f .planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` | ❌ W0 | ⬜ pending |
| 1-03-* | 03 | 2 | BRAND-06 | — | Hero copy signed off (D-15 batch) | manual | Davide reviews REPLACEMENT-COPY.md, marks `- [x] Davide approved YYYY-MM-DD` | — | ⬜ pending |
| 1-04-* | 04 | 1 | (downstream P2-6) | — | Vocab-lint script catches banned terms | unit | `node scripts/lint-vocab.mjs src/app` (intentional violation in fixture exits 1) | ❌ W0 | ⬜ pending |
| 1-04-* | 04 | 1 | (downstream P2-6) | — | Pre-commit hook wires vocab-lint | smoke | `grep -q "lint-vocab\|lint:vocab" .githooks/pre-commit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/reference/BRAND-SPINE.md` — created (covers BRAND-01..04)
- [ ] `BRAND-BIBLE.md` — addendum appended (covers VIZ-01..05)
- [ ] `.planning/phases/01-brand-spine-visual-metaphor/01-PLAGIARISM-AUDIT.md` — created (covers BRAND-05 audit)
- [ ] `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` — created (covers BRAND-05 replacement + BRAND-06 sign-off)
- [ ] `scripts/lint-vocab.mjs` — created (downstream enforcement)
- [ ] `.githooks/pre-commit` — wires `pnpm lint:vocab` (downstream enforcement)
- [ ] `package.json` — adds `scripts.lint:vocab` entry

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero copy + sub-headline + subline + CTAs sign-off | BRAND-06 | Davide is the brand owner; voice is subjective | Davide reads `01-REPLACEMENT-COPY.md`, redlines, then marks `- [x] Davide approved YYYY-MM-DD` |
| Plagiarism replacement copy approval | BRAND-05 | Originality vs Wayback diff requires human reading | Davide compares `01-PLAGIARISM-AUDIT.md` (societies.io captures) against `01-REPLACEMENT-COPY.md` and approves the batch (D-15) |
| BRAND-SPINE.md tone DO/DON'T examples | BRAND-04 | Voice ground truth lives in Davide's head (researcher Open Q4) | Davide drafts ~6 DO/DON'T pairs OR provides 1-2 voice samples for the planner to extract from |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly tagged manual-only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Plagiarism source domain is **`societies.io`** (NOT `artificialsocieties.io` — Wayback has zero captures for the latter)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
