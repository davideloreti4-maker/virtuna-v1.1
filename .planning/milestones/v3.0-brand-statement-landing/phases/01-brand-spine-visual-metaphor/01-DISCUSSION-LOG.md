# Phase 1: Brand Spine & Visual Metaphor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 1-brand-spine-visual-metaphor
**Areas discussed:** Voice & vocab doc depth, Visual metaphor lock fidelity, Hero motion tech choice, Plagiarism audit scope & verification

---

## Voice & Vocab Doc Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — one-liner + banned words | One-liner + short banned list. Fast, gives writers freedom, every Phase 2-4 copy decision becomes fresh judgment. | |
| Full glossary + tone | Adds preferred verbs, banned→replacement table, tone descriptors with do/don't, audience tuning per section. ~3-4 pages. | ✓ |
| Maximalist — brand bible chapter | Full sentence-construction rules, paragraph rhythm, headline templates, social-bio variants. Agency-grade brand book. | |

**User's choice:** Full glossary + tone (Recommended)
**Notes:** Davide is non-technical and wants me to ask everything I need; chose the recommended middle option. Keeps Phase 2-6 copy work fast without over-engineering an agency-tier brand book.

---

## Visual Metaphor Lock Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Written spec + reference links | Markdown describes visuals + links to similar visuals on the web. Plan-phase researcher fills gaps. | ✓ |
| Written + hand sketches / Excalidraw | Adds rough sketches: particle states, pipeline icons, motion arrows. Closes 80% of ambiguity. | |
| Figma frames / animated prototypes | Designed mockups, zero ambiguity. Designer-day of work. Heavy if not already in Figma. | |
| Throwaway HTML prototype (/gsd-sketch) | Spike a real prototype to feel the motion. Highest signal, bleeds into Phase 2 build territory. | |

**User's choice:** Written spec + reference links
**Notes:** Davide chose the lightest fidelity bar. Plan-phase researcher will fill remaining ambiguity (particle count, easing, icons) during Phase 2 build prep. Acceptable risk: Phase 2 might land somewhere slightly different from the written description; will iterate visually then.

---

## Hero Motion Tech Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Split: Canvas (hero) + SVG/motion (pipeline) | Hero particles → Canvas 2D (~30KB, matches existing hive). Pipeline → SVG + framer-motion (~15KB, accessible). ~45KB total, under budget. | ✓ |
| All Canvas | Both visuals in Canvas. Smallest bundle. Loses accessibility on the pipeline (screen readers can't read stages). | |
| All SVG + framer-motion | Most accessible, declarative. Risky on hero past ~50 particles on mid-tier laptops. | |
| Defer to plan-phase research | Document tradeoffs, prototype both, decide before Phase 2. Out of compliance with success criterion #5 ("Phase 1 makes the call"). | |

**User's choice:** Split: Canvas (hero) + SVG/motion (pipeline) (Recommended)
**Notes:** Strongest pick because Davide already ships a Canvas 2D hive viz at 1300+ nodes / 60fps — direct evidence the approach works. Pipeline diagram is a different shape (4 boxes, one pulse) and benefits from SVG accessibility. Decision documented with performance rationale per VIZ-04.

---

## Plagiarism Audit Scope

| Option | Description | Selected |
|--------|-------------|----------|
| New landing page only | Just the new /landing copy. Tightest scope. | |
| Landing + onboarding + dashboard-visible copy | Anywhere a logged-out OR free-tier user encounters copy. Excludes admin / dev / legal. | ✓ |
| Every surface in the repo | Maximum safety, massive scope. Most of it doesn't matter for creator/investor reading the site. | |

**User's choice:** Landing + onboarding + dashboard-visible copy (Recommended)
**Notes:** Best ratio of coverage to effort. Admin / dev / legal explicitly out of scope (D-13). Captured as deferred idea in CONTEXT.md in case anyone notices a copy issue in those surfaces later.

---

## Plagiarism Verification Method

| Option | Description | Selected |
|--------|-------------|----------|
| Manual eyeballing | Read each piece, judge if it sounds like ours. Subjective. | |
| Diff against Artificial Societies + manual | Side-by-side diff vs Wayback Machine / reference screenshots, flag literal and structural mimicry, then manual tone pass. | ✓ |
| Tool-assisted plagiarism check (Copyscape / Grammarly) | Most rigorous. Adds setup + subscription. Likely overkill. | |

**User's choice:** Diff against Artificial Societies + manual (Recommended)
**Notes:** Catches both literal copies and structural mimicry. Reference screenshots already exist in `.planning/reference/`; Wayback Machine fills text-capture gap.

---

## Plagiarism Sign-Off Model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section batch approval | Write one section, present, approve / redline / reject. ~7 batches. | |
| Line-by-line review | Every word reviewed individually. Highest control, slow (50+ cycles). | |
| Approve once at the end | Write everything, Davide reads complete doc once, approves or sends back. Cascade-rework risk. | ✓ |

**User's choice:** Approve once at the end
**Notes:** Davide accepts cascade-rework risk in exchange for fastest review cycle. Hero copy from REQUIREMENTS.md (HERO-02 / 03 / 04) becomes the draft starting point and gets folded into the final batch review.

---

## Claude's Discretion

- **D-17:** Specific SVG animation library for the pipeline (framer-motion vs. motion vs. plain CSS). Plan-phase researcher evaluates against actual bundle size and DX, must stay within 15KB.
- **D-18:** Internal structure of the Banned → Replacement glossary (table vs. bullet list vs. callouts). Writer's call.
- **D-19:** Specific reference URLs to cite in the BRAND-BIBLE addendum (which Linear page, which Stripe hero, etc.). Chosen during Phase 1 execution.

## Deferred Ideas

- In-app prediction viz rebuild (visual locked here, implementation in a future milestone)
- /about, /research, /manifesto supporting pages
- Sound design for hero motion
- Light mode variant of hero motion
- Plagiarism audit on admin / dev / legal / internal-docs surfaces
- Figma frames or animated prototypes for visuals (could add later if written spec leaves too much ambiguity)
