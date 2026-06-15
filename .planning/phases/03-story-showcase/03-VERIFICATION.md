---
phase: 03-story-showcase
verified: 2026-06-15T11:30:00Z
status: gaps_found
score: 4/4 must-haves verified
overrides_applied: 0
human_uat_result: issues_found
gaps_open: 5
human_verification:
  - test: "Open / in a browser (or run `npm run dev`) and scroll the story body: How it works → The Simulation → Features."
    expected: "The three-step 'How it works', the device-framed 'The Simulation' showcase, and the 3-4 alternating feature deep-dives read as a premium, calm, flat-warm marketing narrative — not as empty boxes or a screensaver. Placeholder slots look intentional (labelled stand-ins), not broken/missing assets. Clears the taste bar five prior attempts missed (Phase-2 craft lesson)."
    why_human: "Visual craft / premium-feel quality is not grep-verifiable. Phase 2's bespoke crowd moment passed every automated gate yet was rejected at live craft review — the milestone memory explicitly flags 'live UAT at / after build gate' for this phase."
  - test: "Click each of the 5 header nav links AND the 5 footer 'Product' links: How it works · The Simulation · Features · Pricing · FAQ."
    expected: "Each link smooth-scrolls to its in-page section; the new 'Features' anchor lands on the feature deep-dive section between The Simulation and Pricing. Mobile: open the hamburger panel and confirm all 5 links + CTA are present and scroll correctly."
    why_human: "Anchor-scroll behavior and the mobile disclosure panel are runtime interactions; the existence of the anchors + targets is grep-verified GREEN, but the actual scroll/landing UX is a live check."
  - test: "Resize the viewport from 320px → desktop across the three story sections."
    expected: "Steps stack 1-col on mobile → 3-col on desktop; the feature rows stack copy-over-visual on mobile and alternate image left/right on desktop; the simulation device frame + named-output chips reflow without overflow or layout shift. (Note: full mobile-first hardening is Phase 5 / FOUND-05 — this is a sanity reflow check, not the hardening gate.)"
    why_human: "Responsive reflow + no-CLS feel across breakpoints is a visual/runtime check beyond static analysis."
---

# Phase 3: Story & Showcase Verification Report

**Phase Goal:** Tell the product story through placeholder frames — a three-step "how it works", a "the reading"/Simulation showcase of the output, and three to four feature deep-dive blocks that each pair a benefit with a placeholder visual.
**Verified:** 2026-06-15T11:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

> **Noun pivot note:** The ROADMAP success criteria + REQUIREMENTS.md STORY-01/02 text still use the pre-lock noun "reading". The LOCKED product noun is "Simulation". The implementation correctly renders "The Simulation" / "Get your Simulation" / "your prediction" and never uses "reading" as a user-facing product noun. The `#the-simulation` anchor + verbatim "The Simulation" `<h2>` satisfy the "showcase of the output" criterion. Absence of the word "reading" is the intended state, NOT a gap.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A "how it works" section walks three ordered steps (paste TikTok link → audience reacts/simulates → get your Simulation) using placeholder frames | ✓ VERIFIED | `how-it-works.tsx` renders a `STEPS` const of exactly 3 ordered entries (01 "Paste a TikTok link", 02 "The audience reacts", 03 "Get your Simulation"), each with a labelled `<Placeholder variant="image" aspect="16/10">`. Mounted at `<section id="how-it-works">` page.tsx:47-51. Test suite 6/6 GREEN. Noun-disciplined (`/simulat/i` present, no "reading"). |
| 2 | A "The Simulation" showcase presents the output (audience simulation, watch-through %, Hook · Retention (where viewers drop) · Shareability) via a placeholder product frame | ✓ VERIFIED | `simulation-showcase.tsx` `<h2>` reads VERBATIM "The Simulation"; device-framed `<Placeholder>` (browser chrome + numen.app pill); `<dl>` names all 5 outputs — "Audience reaction" (synthetic crowd), "Watch-through %", "Hook · Retention · Shareability" + "where viewers drop". Mounted at `#the-simulation` page.tsx:57-61. Test 7/7 GREEN. |
| 3 | Three to four feature deep-dive blocks each pair a clear benefit with a placeholder visual; blocks alternate column order on desktop, stack on mobile | ✓ VERIFIED | `feature-blocks.tsx` maps 4 `FEATURES` through `<FeatureBlock flip={i % 2 === 1}>`; `feature-block.tsx` applies `cn(flip && "md:order-2")` / `md:order-1` for the alternating flip, `grid-cols-1 md:grid-cols-2` for mobile stack. Each block = h3 benefit + one `<Placeholder>`. New `<section id="features">` mounted between #the-simulation and #pricing (page.tsx:68-72). Test 4/4 GREEN. |
| 4 | Every product visual is a labelled placeholder slot from the Phase 1 system, swappable later with no layout shift; `/` stays statically prerendered | ✓ VERIFIED | All 9 product visuals (3 steps + 1 showcase frame + 4 feature blocks + showcase nested) use the FOUND-03 `<Placeholder>` with inline `aspectRatio` (no-CLS) + label + one-prop `src` swap. No `"use client"` in any of the 4 story components. `npm run build` exit 0, route table `┌ ○ /` (Static). A 5th "Features" anchor added to header NAV_LINKS (5 links) + footer PRODUCT_LINKS. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/marketing/story/how-it-works.tsx` | STORY-01 3-step RSC | ✓ VERIFIED | 97 lines, pure RSC, exports `HowItWorks`, 3 Placeholder slots, imports Placeholder + StaggerReveal only |
| `src/components/marketing/story/simulation-showcase.tsx` | STORY-02 output showcase RSC | ✓ VERIFIED | 146 lines, pure RSC, verbatim "The Simulation" h2, device-framed Placeholder, 5 named outputs |
| `src/components/marketing/story/feature-blocks.tsx` | STORY-03 4-block section RSC | ✓ VERIFIED | 81 lines, pure RSC, 4 FEATURES + alternating flip |
| `src/components/marketing/story/feature-block.tsx` | STORY-03 flip leaf RSC | ✓ VERIFIED | 57 lines, pure RSC, `md:order-*` flip + Placeholder |
| `src/app/(marketing)/page.tsx` | All 3 sections mounted + #features inserted | ✓ VERIFIED | Imports all 3 from barrel; renders inside the LOCKED-rhythm sections; #features between #the-simulation and #pricing |
| `src/components/layout/header.tsx` | "Features" → #features in NAV_LINKS | ✓ VERIFIED | NAV_LINKS now 5 entries, #features between The Simulation and Pricing |
| `src/components/layout/footer.tsx` | "Features" → #features in PRODUCT_LINKS | ✓ VERIFIED | PRODUCT_LINKS mirrors header, #features present |
| `src/components/marketing/index.ts` | barrel exports all 3 | ✓ VERIFIED | HowItWorks, SimulationShowcase, FeatureBlocks all exported |
| 3 story test files + extended footer test (03-00) | RED→GREEN Nyquist gates | ✓ VERIFIED | All exist; all GREEN now (17 story + 11 footer + 6 header = 34/34) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| how-it-works.tsx | @/components/marketing/placeholder | import { Placeholder } | ✓ WIRED | SDK-confirmed pattern found |
| simulation-showcase.tsx | @/components/marketing/placeholder | import { Placeholder } | ✓ WIRED | SDK-confirmed |
| feature-blocks.tsx | ./feature-block + Placeholder | maps `<FeatureBlock flip>` | ✓ WIRED | SDK-confirmed |
| page.tsx | HowItWorks/SimulationShowcase/FeatureBlocks | named import rendered in sections | ✓ WIRED | All 3 SDK-confirmed inside their section ids |
| header.tsx + footer.tsx | #features section | anchor in NAV_LINKS / PRODUCT_LINKS | ✓ WIRED | SDK reported "not found" because the `from` field bundles two file paths; manually confirmed `grep -c '"#features"'` = 1 in each |
| test files → section components (03-00) | ../how-it-works etc. | import (RED-by-design at Wave 0) | ✓ WIRED | SDK shows "not found" reflecting Wave-0 RED-by-design state; components now exist + imports resolve (vitest GREEN) |

### Data-Flow Trace (Level 4)

Not applicable — all product visuals are intentional static `<Placeholder>` slots (FOUND-03 / milestone decision: marketing surface only, no engine/data wiring). No dynamic data source by design. The placeholders are the correct deliverable, not hollow renders.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Story + layout test suites GREEN | `npx vitest run story/ footer.test.tsx header.test.tsx` | 34 passed (5 files) | ✓ PASS |
| Story sections compile + render statically | `npm run build` | exit 0, "Compiled successfully", `┌ ○ /` | ✓ PASS |
| `/` is statically prerendered (no use-client leak) | route table inspect | `○ /` (Static), not `ƒ /` | ✓ PASS |
| No `"use client"` in any story component | `grep -rl '"use client"' story/*.tsx` | none | ✓ PASS |

### Probe Execution

Not applicable — no probe scripts declared in PLAN/SUMMARY and no `scripts/*/tests/probe-*.sh` convention in this marketing-landing repo. Behavioral spot-checks (above) cover the runnable verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STORY-01 | 03-00, 03-01 | "how it works" 3-step section (placeholder frames) | ✓ SATISFIED | how-it-works.tsx 3 ordered steps + Placeholders; test 6/6 GREEN; mounted at #how-it-works |
| STORY-02 | 03-00, 03-02 | "The Simulation" output showcase (5 named outputs, placeholder frames) | ✓ SATISFIED | simulation-showcase.tsx verbatim heading + 5 outputs + device-framed Placeholder; test 7/7 GREEN |
| STORY-03 | 03-00, 03-03 | 3-4 feature deep-dive blocks (benefit + placeholder visual) | ✓ SATISFIED | feature-blocks.tsx 4 alternating blocks; test 4/4 GREEN; #features section + nav anchor |

No orphaned requirements: REQUIREMENTS.md maps exactly STORY-01/02/03 to Phase 3, and the plans declare exactly those three. No unmapped IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No debt markers (TBD/FIXME/XXX/TODO/HACK) in any modified file; no banned board/reading/viral-results imports; no glass/glow/backdrop-blur/#FF7F50 in code; no "viral"/"AI" headline words; no user-facing "reading" product noun. The only grep hits were in DOC COMMENTS describing the rules being followed. |

### Human Verification Required

This is a visual marketing phase (ROADMAP UI hint: yes). Three live checks at `/` are needed — automated gates all pass, but visual craft / runtime UX is not grep-verifiable, and the Phase-2 precedent (a fully-green-but-rejected hero) plus the milestone memory note ("live UAT at / after build gate") make this mandatory.

#### 1. Story-body visual craft pass

**Test:** Open `/` (or `npm run dev`) and scroll: How it works → The Simulation → Features.
**Expected:** The narrative reads premium, calm, flat-warm — placeholders look like intentional labelled stand-ins, not broken/missing assets; clears the taste bar five prior attempts missed.
**Why human:** Visual craft / premium-feel is not grep-verifiable; Phase 2's bespoke moment passed all automated gates yet failed live craft review.

#### 2. Nav anchors + mobile disclosure

**Test:** Click each of the 5 header nav links and 5 footer "Product" links; on mobile open the hamburger panel.
**Expected:** Each smooth-scrolls to its section; "Features" lands between The Simulation and Pricing; mobile panel shows all 5 links + CTA.
**Why human:** Anchor-scroll + mobile disclosure are runtime interactions; targets are grep-verified but the live UX is not.

#### 3. Responsive reflow (320px → desktop)

**Test:** Resize the viewport across the three story sections.
**Expected:** Steps 1-col→3-col; feature rows stack→alternate; showcase frame + chips reflow without overflow/CLS. (Full hardening is Phase 5/FOUND-05 — sanity check only.)
**Why human:** Responsive reflow + no-CLS feel is a visual/runtime check.

### Gaps Summary

**Automated layer: PASS.** All 4 success criteria are observably true, all 3 requirements satisfied, all artifacts wired, `/` builds `○` static, full suite (34/34) GREEN. The phase goal — telling the product story through three placeholder-framed sections — is structurally achieved.

**Live human UAT (2026-06-15, Playwright @ 1440 + 375): ISSUES FOUND.** The sections work but the craft does not yet clear the taste bar (the exact risk the milestone flagged after Phase 2). The phase is held `gaps_found` pending the refinements below.

**Locked refinement scope (Davide, 2026-06-15):** Keep **D-D Option A** — visuals stay labelled `<Placeholder>` stubs, NO real data/screenshots. The fix is to make the placeholders read as *intentional product skeletons*, plus layout/a11y polish. Formal gap-closure route chosen.

| ID | Gap | Severity | Refinement (scoped) |
|----|-----|----------|---------------------|
| GAP-1 | Placeholders read as "unfinished," not intentional — flat dark boxes with a tiny image-icon + a literal **"16:10"** dev-artifact label, in every section | High | Add story-specific skeleton treatment to the placeholder slots: static SVG hints of the real shapes (score-gauge arc, audience dot-cloud, Hook · Retention · Shareability driver bars, browser/phone device UI). Remove the visible "16:10" ratio label from marketing placeholders. Still stubs (no real assets). |
| GAP-2 | The Simulation device frame is a ~640px-tall empty void — the single biggest dead moment; teases nothing about the product shape | High | Cap frame height / adjust ratio; fill with the score-gauge → audience-cloud → driver-rows skeleton so it reads as the shape of a Simulation. |
| GAP-3 | Feature blocks feel sparse — one-line text floats vertically-centered against a tall 16:10 image; rows feel disconnected; excess vertical whitespace across all three sections reads low-density on desktop | Med | Cap image height / wider-shorter ratio, top-align or tighten vertical rhythm, reduce section padding so text↔visual feel paired, not stranded. |
| GAP-4 | Mobile nav a11y (matches code-review WR-03, confirmed live): **Escape does not close** the panel and there is no focus trap / focus restore — keyboard users can get stuck with scroll locked | Med | Add Escape-to-close, focus trap while open, restore focus to the trigger on close. (Fold in WR-02 scroll-lock-restore while here.) |
| GAP-5 | Anchor scroll offset is accidental — no `scroll-margin-top`; section headings clear the 65px sticky header by only ~16px (works by luck of padding) | Low | Add `scroll-margin-top` (= sticky header height) to the section anchors for a reliable, comfortable offset. |

Also fold in the non-blocking code-review Info items while in these files: docblock drift in `simulation-showcase.tsx` (documents 5 outputs, renders 3) + stale Phase-1 description comment in `page.tsx`; hand-duplicated header/footer nav arrays; brittle `getByText` queries (WR-04).

**Next:** `/gsd-plan-phase 3 --gaps` → creates `gap_closure: true` fix plans → `/gsd-execute-phase 3 --gaps-only` → re-verify. Engine stays frozen; marketing-surface only.

---

_Verified: 2026-06-15T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
