---
phase: 01-brand-spine-visual-metaphor
verified: 2026-05-10T21:30:00Z
status: human_needed
score: 10/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm Davide personally reviewed and signed off on hero copy (ROADMAP SC2)"
    expected: "Davide — not the orchestrator acting on his behalf — has read REPLACEMENT-COPY.md hero block and explicitly approves the headline, sub-headline, subline, and CTAs before Phase 2 build starts"
    why_human: "ROADMAP SC2 states 'Davide has reviewed and signed off'. The sign-off in both docs is stamped 'Davide approved 2026-05-10: signed off via Claude Code orchestrator after 7-step verification protocol' — the orchestrator approved on user instruction, not direct human review. Plan 03 is marked autonomous: false precisely because a human gate was required. This is a judgement call only Davide can make."
---

# Phase 1: Brand Spine & Visual Metaphor Verification Report

**Phase Goal:** Brand voice, copy guardrails, and both visual concepts are locked as documented artifacts before any code is written
**Verified:** 2026-05-10T21:30:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Phase Goal Assessment

The phase goal is substantively achieved. Four planning artifacts now exist that lock brand voice, vocabulary guardrails, and visual language before any Phase 2 build code is written. All 11 requirements (BRAND-01..06, VIZ-01..05) map to concrete, substantive files. One human gate (ROADMAP SC2 -- Davide personal sign-off on hero copy) was satisfied by orchestrator proxy rather than direct human review. This is the only item that requires human confirmation before Phase 2 starts.

---

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | `.planning/reference/BRAND-SPINE.md` exists with canonical one-liner, voice tone, vocab guardrails, and preferred verbs | VERIFIED | File exists at 120 lines. `grep -c "Your audience, simulated"` returns 1. All 7 H2 sections confirmed. 5 lockup surfaces, all 7 viewports in audience table. Zero em-dashes. Italic footer present. |
| SC2 | Davide has reviewed and signed off on hero headline, sub-headline, subline, and CTA copy before any build starts | UNCERTAIN | Sign-off boxes are checked in both docs with date 2026-05-10. The sign-off note reads "signed off via Claude Code orchestrator after 7-step verification protocol" -- not direct Davide review. Plan 03 is marked `autonomous: false` precisely because human input was required. |
| SC3 | BRAND-BIBLE addendum documents behavioral-simulation particle visual and 4-stage engine-pipeline as the locked visual language of Virtuna | VERIFIED | `## Visual Metaphor Lock` section appended to BRAND-BIBLE.md at line 352. BRAND-BIBLE.md grew from 351 to 555 lines. Both visuals documented with concept prose, tech rationale, scale affordances, reference URLs, reduced-motion fallbacks. |
| SC4 | Plagiarized Artificial Societies copy is identified and replacement copy is written and approved across all live customer-facing surfaces | VERIFIED | `01-PLAGIARISM-AUDIT.md` (219 lines, 48 flagged surfaces across 13 source files, 4 legal-exposure flags). `01-REPLACEMENT-COPY.md` (293 lines, 10 viewport blocks). Societies.io Wayback snapshot captured for reproducibility. Vocab-lint on REPLACEMENT-COPY.md: exit 0, 0 errors. Note: sign-off is proxy-based (see SC2). |
| SC5 | Implementation technology choice for hero motion is decided with performance rationale documented | VERIFIED | BRAND-BIBLE.md §Visual Metaphor Lock §1: Canvas 2D ~30 KB for hero particles. §2: SVG + motion/react LazyMotion + m + domAnimation ~15 KB for pipeline. Total ~45 KB under 50 KB ceiling. Rejected alternatives table documents WebGL (bundle bloat), GSAP (license cost), SVG-for-hero, Canvas-for-pipeline, plain CSS, Lottie. |

**Score:** 4/5 ROADMAP SCs verified; 1 UNCERTAIN (SC2 -- human gate)

---

### Requirements Table (BRAND-01..06, VIZ-01..05)

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| BRAND-01 | Brand spine "Your audience, simulated." in `.planning/reference/BRAND-SPINE.md` as canonical one-liner | CLOSED | File exists, `grep -c "Your audience, simulated"` = 1. Section `## 1. The One-Liner (canonical)` at line 8. |
| BRAND-02 | Voice & language doc -- tone, vocab guardrails (avoid "viral"/"AI"/etc.), preferred verbs | CLOSED | BRAND-SPINE.md §2 Tone Descriptors + §3 Preferred Verbs (`predict · simulate · forecast · learn · improve...`) + §4 Banned -> Replacement Table (11 entries, 4 required + 7 hype-vocab extras). Enforced by scripts/lint-vocab.mjs (Plan 04). |
| BRAND-03 | Numen Machines lockup pattern documented -- when to lead vs use as tag | CLOSED | BRAND-SPINE.md §5 Numen Machines Lockup Pattern -- 5-row table (landing hero pre-headline, landing footer, OG metadata, in-product chrome, page titles). Lockup string `VIRTUNA · A NUMEN MACHINES PRODUCT` present. |
| BRAND-04 | Three-audience framing (creators primary; investors/partners absorb) encoded in voice doc | CLOSED | BRAND-SPINE.md §6 Audience Tuning per Viewport -- 4-column table with all 7 viewports. Hero = "All three (creator-led)"; Science = "Investors + partners". |
| BRAND-05 | Plagiarized Artificial Societies copy replaced across live site | CLOSED (plan) | `01-PLAGIARISM-AUDIT.md` documents 48 surfaces across 13 files; `01-REPLACEMENT-COPY.md` provides replacement strings. Note: actual file replacement happens in Phase 2-6 build (BUILD-09). Replacement copy authored and signed off. Legacy violations remain in `src/` (57 errors from lint-vocab on production code) -- expected; Phase 2-6 swaps these. |
| BRAND-06 | Headline + subline + CTA copy authored to brand-spine standard, signed off by Davide | PARTIAL | Copy is authored and mirrors REQUIREMENTS.md HERO-01..05 verbatim. Vocab-lint on REPLACEMENT-COPY.md: exit 0. Sign-off boxes [x] checked with 2026-05-10 date. However: sign-off was by "Claude Code orchestrator" on user instruction, not direct Davide review. ROADMAP SC2 specifies "Davide has reviewed". Plan 03 is `autonomous: false`. This is an unresolved human gate. |
| VIZ-01 | Behavioral-simulation visual concept locked -- animated audience particles aggregating into confidence score | CLOSED | BRAND-BIBLE.md §Visual Metaphor Lock §1: "Animated audience particles reacting to a video stimulus, aggregating into a confidence score." One-shot animation, coral accent for converged particles, reduced-motion fallback documented. Canvas 2D tech decision with 7 hive viz file:line landmarks cited. |
| VIZ-02 | Engine-pipeline visual concept locked -- 4-stage diagram with subtle pulse motion | CLOSED | BRAND-BIBLE.md §Visual Metaphor Lock §2: "`video -> analyze -> simulate audience -> predict`". Once-on-entry pulse via `whileInView viewport={{ once: true }}`. SVG + motion/react LazyMotion. Reduced-motion fallback (static stages, full visibility). |
| VIZ-03 | Visual concepts work at hero scale, mobile scale, and future in-app embed scale | CLOSED | BRAND-BIBLE.md §Visual Metaphor Lock §3 Scale Affordances -- 3-column table for hero (desktop), mobile (≤640px), in-app embed. Both visuals explicitly addressed at all three scales. Reduced-motion fallback at all three scales. |
| VIZ-04 | Implementation technology choice decided with performance budget < 50KB JS for hero motion | CLOSED | Canvas 2D ~30 KB (hero particles, no library). SVG + motion/react LazyMotion + m + domAnimation ~15 KB (pipeline). Total ~45 KB < 50 KB ceiling documented in Performance Budget table. WebGL + GSAP + SVG-for-hero + Canvas-for-pipeline + plain CSS + Lottie + Figma all rejected with rationale. |
| VIZ-05 | Both visuals documented in BRAND-BIBLE addendum as "the visual language of Virtuna" | CLOSED | `## Visual Metaphor Lock` H2 at line 352 of BRAND-BIBLE.md (555 total lines, was 351). Section header confirmed by `grep -c "^## Visual Metaphor Lock$"` = 1. Both visuals + scale affordances + rejected alternatives + performance budget + Phase 2-6 usage instructions present. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/reference/BRAND-SPINE.md` | Voice + vocab + tone source-of-truth, ≥120 lines | VERIFIED | 120 lines exactly. All 7 H2 sections. Zero em-dashes. Italic two-line footer. Commit `6b0ee39`. |
| `BRAND-BIBLE.md` (with addendum) | Visual Metaphor Lock appended, ≥450 lines | VERIFIED | 555 lines (was 351). `## Visual Metaphor Lock` at line 352. Existing lines 1-348 preserved (confirmed by `head -348 | grep "^## Resources$"` = 1). Footer updated v2.3.5 → v2.3.6, date 2026-02-08 → 2026-05-10. Commit `e28d03b`. |
| `.planning/phases/01-brand-spine-visual-metaphor/01-PLAGIARISM-AUDIT.md` | Diff artifact, ≥80 lines | VERIFIED | 219 lines. 48 flagged surfaces, 13 source files. 4 legal-exposure flags documented. Commits `402198f`, `288ace4`. |
| `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` | Replacement copy, ≥120 lines | VERIFIED | 293 lines. 10 viewport blocks. Hero mirrors REQUIREMENTS.md HERO-01..05 verbatim. Vocab-lint on this file: exit 0. Commits `9aab50c`, `288ace4`. |
| `scripts/lint-vocab.mjs` | Node ESM scanner, executable, ≥60 lines, no third-party deps | VERIFIED | 81 lines, executable (+x). Shebang `#!/usr/bin/env node`. Imports: `node:fs`, `node:path`, `node:process` only. 5 BANNED patterns (viral, go viral, AI, users, framer-motion). Suppress marker recognized. Functional: clean→0, violation→1, suppress→0. Commits `7b339fb`. |
| `.githooks/pre-commit` | Blocking hook, #!/bin/sh, invokes scanner | VERIFIED | Exists, executable. Shebang `#!/bin/sh`. Invokes `node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding`. No `|| true`. `--no-verify` bypass documented in comments. Commit `7b3f77d`. |
| `package.json` (lint:vocab entry) | `"lint:vocab"` script pointing to scanner | VERIFIED | `grep -c '"lint:vocab"' package.json` = 1. Value: `node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding`. JSON valid. |
| `.planning/reference/societies-snapshot.html` | Wayback capture, ≥5KB | VERIFIED | 225 KB. |
| `.planning/reference/societies-text.txt` | Plain text extract, ≥1KB | VERIFIED | 10 KB. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| BRAND-SPINE.md §4 Banned->Replacement | scripts/lint-vocab.mjs BANNED array | vocab table seeds mirrored as regex | VERIFIED | BANNED array contains all 4 required seeds: `\bviral\b`, `\bgo viral\b`, `\bAI\b`, `\busers\b` plus `framer-motion`. Script functional. |
| .githooks/pre-commit | scripts/lint-vocab.mjs | shell exec with hardcoded scan roots | VERIFIED | Hook invokes `node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding`, fails-fast via `|| exit 1`. |
| package.json scripts.lint:vocab | scripts/lint-vocab.mjs | pnpm script entry | VERIFIED | `pnpm lint:vocab` resolves and produces identical output to direct node invocation. |
| REPLACEMENT-COPY.md hero block | REQUIREMENTS.md HERO-01..05 | verbatim mirroring | VERIFIED | Pre-headline, H1, sub-headline, subline, both CTAs present verbatim. Confirmed by grep (counts ≥1 for each required string). |
| BRAND-BIBLE.md §1 Hero | src/components/hive/ landmarks | file:line citations for Phase 2 researcher | VERIFIED | `use-hive-animation` (5×), `use-canvas-resize` (2×), `HiveCanvas` (3×), `usePrefersReducedMotion` (4×) cited with specific line ranges. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BRAND-01 | 01-01-PLAN.md | Canonical one-liner in BRAND-SPINE.md | SATISFIED | File + string present |
| BRAND-02 | 01-01-PLAN.md, 01-04-PLAN.md | Voice/vocab/tone doc + enforcement tooling | SATISFIED | BRAND-SPINE.md + lint-vocab.mjs + pre-commit |
| BRAND-03 | 01-01-PLAN.md | Numen Machines lockup pattern documented | SATISFIED | BRAND-SPINE.md §5 with 5-surface matrix |
| BRAND-04 | 01-01-PLAN.md | Three-audience framing encoded | SATISFIED | BRAND-SPINE.md §6 with 7-viewport table |
| BRAND-05 | 01-03-PLAN.md | Plagiarized copy identified + replacement authored | SATISFIED (plan) | Audit + replacement docs exist; live swap is Phase 2-6 work (BUILD-09) |
| BRAND-06 | 01-03-PLAN.md | Hero copy signed off by Davide before build | PARTIAL | Copy authored correctly. Sign-off was proxy-based (orchestrator on user instruction). ROADMAP SC2 requires direct Davide review. |
| VIZ-01 | 01-02-PLAN.md | Hero behavioral-simulation visual locked | SATISFIED | BRAND-BIBLE.md §1 |
| VIZ-02 | 01-02-PLAN.md | Engine pipeline 4-stage visual locked | SATISFIED | BRAND-BIBLE.md §2 |
| VIZ-03 | 01-02-PLAN.md | Scale affordances for 3 scales | SATISFIED | BRAND-BIBLE.md §3 scale table |
| VIZ-04 | 01-02-PLAN.md | Tech choice + < 50KB budget documented | SATISFIED | Canvas 2D ~30KB + motion/react ~15KB = ~45KB ceiling documented |
| VIZ-05 | 01-02-PLAN.md | Both visuals in BRAND-BIBLE addendum | SATISFIED | `## Visual Metaphor Lock` section exists at 555-line BRAND-BIBLE.md |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `01-REPLACEMENT-COPY.md` | 262-263, 272-274 | Banned vocabulary (`AI`, `viral`, `go viral`) | Info | These are in the `og-metadata` notes block quoting the OLD plagiarized strings being replaced -- not new copy strings. `node scripts/lint-vocab.mjs 01-REPLACEMENT-COPY.md` returns exit 0 (scanner only flags actual copy strings in that file). Not a blocker -- planning docs documenting source material legitimately reference banned terms. |
| `src/` production code | various | 57 lint-vocab errors in existing legacy code | Info | Expected per plan -- legacy plagiarized copy in `src/components/landing/`, `src/components/onboarding/`, etc. Phase 2-6 build phases replace these using `01-REPLACEMENT-COPY.md`. Not a Phase 1 blocker. |
| `.githooks/pre-commit` | -- | Hook inert unless `git config core.hooksPath .githooks` is set per-worktree | Warning | Documented in SUMMARY-04. One-time developer setup step. The hook is correctly installed; activation is manual. This is an expected per-worktree setup requirement, not a code defect. |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Lint-vocab exits 0 on clean input | `node scripts/lint-vocab.mjs $TMP/clean` | exit 0, "0 error(s)" | PASS |
| Lint-vocab exits 1 on violation | `node scripts/lint-vocab.mjs $TMP/bad` (contains "go viral") | exit 1, "2 error(s)" | PASS |
| Suppress marker respected | `node scripts/lint-vocab.mjs $TMP/supp` (disable-next-line before "go viral") | exit 0 | PASS |
| REPLACEMENT-COPY.md is vocab-lint clean | `node scripts/lint-vocab.mjs .planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` | exit 0, "0 error(s)" | PASS |
| No third-party deps in scanner | `grep "^import" scripts/lint-vocab.mjs` | 3 imports, all `node:*` | PASS |
| package.json valid JSON | `node -e "JSON.parse(...)"` | exit 0 | PASS |

---

### Human Verification Required

**1. Hero copy sign-off integrity (ROADMAP SC2 / BRAND-06)**

**Test:** Open `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md`. Read the `## Hero (HERO-01..05)` viewport block. Confirm you approve the pre-headline, H1, sub-headline, subline, and both CTAs as the locked copy before Phase 2 starts.
**Expected:** Davide personally reviews and either (a) approves by adding a personal sign-off comment, or (b) redlines specific strings by editing the doc, triggering a re-plan loop in Plan 03 per D-15.
**Why human:** The ROADMAP SC2 specifies "Davide has reviewed and signed off". The current sign-off was applied by the Claude Code orchestrator acting on user instruction ("verify yourself after that approve"). Plan 03 is marked `autonomous: false` because a genuine human gate was required. Proxy sign-off satisfies the technical format but not the intent of the gate. Phase 2 build will render this hero copy on the live landing page -- Davide should confirm the exact wording before the build executes.

---

## Verdict Summary

**10 of 11 requirements CLOSED.** BRAND-06 is PARTIAL -- the copy is correct and vocab-lint clean, but the sign-off was executed by proxy rather than direct human review.

**Phase verdict: PASS-WITH-NOTES** -- all documentation artifacts are substantive, wired, and functional. The single open item (BRAND-06 human sign-off) does not block technical Phase 2 work but should be resolved before treating Phase 1 as fully complete per the ROADMAP success criteria.

### Quick Reference: All Artifacts Shipped

| Artifact | Lines | Status |
|----------|-------|--------|
| `.planning/reference/BRAND-SPINE.md` | 120 | VERIFIED |
| `BRAND-BIBLE.md` (Visual Metaphor Lock appended) | 555 | VERIFIED |
| `.planning/phases/01-brand-spine-visual-metaphor/01-PLAGIARISM-AUDIT.md` | 219 | VERIFIED |
| `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` | 293 | VERIFIED |
| `scripts/lint-vocab.mjs` | 81 | VERIFIED |
| `.githooks/pre-commit` | 5 | VERIFIED |
| `package.json` (lint:vocab entry) | +1 | VERIFIED |

### Deferred (Phase 1 out of scope by design)

| Item | Addressed In |
|------|-------------|
| Replace plagiarized copy in live `src/` files (BUILD-09) | Phase 6 |
| Build hero section using locked copy | Phase 2 |
| Build pipeline, demo, bento sections | Phase 3 |
| Lighthouse / WCAG / Core Web Vitals | Phase 5 |
| In-app prediction viz implementation | Future milestone (visual metaphor locked here) |

---

_Verified: 2026-05-10T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
