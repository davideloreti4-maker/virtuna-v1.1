---
phase: 01-brand-spine-visual-metaphor
plan: 03
type: summary
plan_name: "Plagiarism Audit + Replacement Copy"
status: complete
duration_minutes: 13
tasks_completed: 4
tasks_total: 4
requirements_closed:
  - BRAND-05
  - BRAND-06
files_created:
  - .planning/reference/societies-snapshot.html
  - .planning/reference/societies-text.txt
  - .planning/phases/01-brand-spine-visual-metaphor/01-PLAGIARISM-AUDIT.md
  - .planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md
files_modified: []
date_completed: 2026-05-10
---

# Plan 01-03 Summary: Plagiarism Audit + Replacement Copy

## What was built

Two phase artifacts authored against a captured Wayback snapshot of `www.societies.io` (the actual plagiarism source per RESEARCH.md A1, NOT `artificialsocieties.io`), plus the reference captures themselves.

### Reference captures (Task 1)
- `.planning/reference/societies-snapshot.html` — 225 KB rendered HTML of 2025-11-11 Wayback capture (largest available)
- `.planning/reference/societies-text.txt` — 10 KB clean text extract used for diff analysis

### Plagiarism Audit (Task 2)
- `.planning/phases/01-brand-spine-visual-metaphor/01-PLAGIARISM-AUDIT.md` — 218 lines, 25 KB
- 48 flagged surfaces across 13 source files
- Severity breakdown: **8 HIGH** (verbatim from snapshot) + **22 HIGH-LEGACY** (verbatim from older societies.io era, brand name still present in current code) + **7 MEDIUM** (structural mimicry) + **11 LOW** (similar tone)
- 14+ file:line citations to `src/components/landing/*.tsx`, `src/components/onboarding/*.tsx`, `src/app/(marketing)/layout.tsx`
- 4 legal-exposure flags documented:
  - `stats-section.tsx:37` — direct link to societies.io's GCS bucket PDF (`storage.googleapis.com/as-website-assets/...`)
  - `partnership-section.tsx:26` — quote attributed to Francesco D'Orazio (Pulsar CEO)
  - Real-person quote attributions to Sparky Zivin (Teneo)
  - `backers-section.tsx:14-16` — Point72/Kindred/Y Combinator listed as backers (societies.io's actual backers, not Virtuna's)
- Snapshot-era limitation explicitly documented (the Virtuna v1.1 strings "Human Behavior, Simulated" and "AI personas that replicate real-world attitudes, beliefs, and opinions" don't appear in the 2025-11 snapshot but originate from a pre-redesign societies.io era unretrievable from current Wayback CDX — flagged as HIGH-LEGACY)

### Replacement Copy (Task 3)
- `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` — 293 lines, 17 KB
- 10 viewport blocks fully drafted: hero, demo, how-it-works, three-surfaces, science, social-proof, pricing, footer, onboarding, og-metadata
- **Hero block mirrors REQUIREMENTS.md HERO-01..05 verbatim** per D-16:
  - Pre-headline: `VIRTUNA · A NUMEN MACHINES PRODUCT`
  - H1: "Predict how your audience will respond. / Before you post."
  - Sub-headline: "Virtuna simulates your audience to forecast every video before it ships."
  - Subline: "Trained on decades of behavioral research. Self-improving with every outcome."
  - CTAs: "Run a prediction →" + "See the science"
- Brand spine "Your audience, simulated." propagated to footer brand stamp + og:description
- Onboarding rewrite drops HIGH-LEGACY "Your AI society is ready" (societies.io product-name plagiarism) for "Your audience model is ready" per BRAND-SPINE.md audience-led voice
- **Vocab-lint clean: 0 errors, 0 warnings**
- Zero `<draft>` placeholders, zero em-dashes (per style invariants)

### D-15 batch sign-off (Task 4)
Davide-on-behalf approval via Claude Code orchestrator after running the 7-step verification protocol from the plan:

1. ✅ Both docs opened, sizes confirmed (AUDIT 218 lines, COPY 293 lines, snapshot 225KB, text 10KB)
2. ✅ AUDIT findings tables believable, severity counts match Findings (8/22/7/11 = 48)
3. ✅ COPY hero block VERBATIM match against REQUIREMENTS HERO-01..05
4. ✅ Vocab-lint on COPY: exit 0, 0 errors
5. ✅ Sign-off boxes checked + 2026-05-10 date filled in both docs
6. ✅ 3 file:line audit citations spot-checked against live code:
   - `hero-section.tsx:29-31` — confirmed "Human Behavior, / Simulated." + "AI personas that replicate real-world attitudes, beliefs, and opinions"
   - `backers-section.tsx:14-16` — confirmed Point72 Ventures + Kindred Capital + Y Combinator hardcoded
   - `stats-section.tsx:32-37` — confirmed "Artificial Societies achieves 86%" + direct PDF link to `storage.googleapis.com/as-website-assets/Artificial%20Societies%20Survey%20Eval%20Report%20Jan26.pdf` (clear legal exposure)
7. ✅ societies-text.txt confirmed "Artificial Societies", "AI personas", "go viral", "Point72 Ventures Kindred Capital Combinator" as plagiarism source

## Commits
- `c4d14ef` — `docs(01-03): capture societies.io Wayback snapshot + text extract` (Task 1)
- `402198f` — `docs(01-03): author 01-PLAGIARISM-AUDIT.md` (Task 2)
- `9aab50c` — `docs(01-03): author 01-REPLACEMENT-COPY.md` (Task 3)
- `288ace4` — `docs(01-03): D-15 batch sign-off on AUDIT + COPY` (Task 4)

## Requirements closed
- **BRAND-05** — plagiarism replaced (audit complete, replacement copy authored, signed off)
- **BRAND-06** — hero copy authored to brand-spine standard, signed off before Phase 2 build starts (D-16 lock holds)

## What this enables
Phase 2 (Build hero) and Phase 3 (Build remaining viewports) now have signed-off, brand-spine-compliant copy strings to consume. Phase 6 (BUILD-09) will replace `src/app/page.tsx` wholesale using `01-REPLACEMENT-COPY.md` as the single source of truth.

## Deviations
None. All 4 tasks executed as planned. Sign-off was performed by orchestrator on user instruction ("verify yourself after that approve") rather than user directly editing the docs — the 7-step verification protocol was followed end-to-end and all acceptance criteria pass.

## Self-Check: PASSED
- [x] Task 1: societies-snapshot.html ≥5KB (225KB ✓), societies-text.txt ≥1KB (10KB ✓)
- [x] Task 2: 12+ surfaces covered (13 sections), severity counts verified
- [x] Task 3: Hero verbatim REQUIREMENTS HERO-01..05, vocab-lint exit 0, all 7 viewports + onboarding + footer + OG present
- [x] Task 4: Sign-off boxes checked in both docs (`grep -c "\[x\] Davide"` returns 3+2), date markers present (`grep -cE "Davide approved [0-9]{4}-[0-9]{2}-[0-9]{2}"` returns 1+1)
- [x] BRAND-05 and BRAND-06 closed
