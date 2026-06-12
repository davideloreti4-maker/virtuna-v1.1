---
phase: 01-foundation-shell-voice-baseline
verified: 2026-06-12T00:00:00Z
status: passed
score: 4/4 success criteria verified (6/6 requirements satisfied)
overrides_applied: 0
re_verification:
deferred:
  - truth: "Final .numen-surface tokens swapped in (placeholders gone), brand-coherent palette"
    addressed_in: "Phase 4"
    evidence: "Phase 4 success criterion 1: 'The page renders on the final .numen-surface tokens (placeholders gone)' — DS-03 / D-L3 token lock gated on Numen Surface Phase 1 calibration"
  - truth: "OG/share-card ART (palette/layout) finalized to the Numen-surface skin"
    addressed_in: "Phase 4"
    evidence: "Phase 4 / D-11 — OG art redesign deferred; Phase 1 fixed COPY only (per 01-03-PLAN Task 3 scope boundary)"
  - truth: "Dev/showcase route hype-copy cleanup (board-preview 'Virality score' label)"
    addressed_in: "Phase 4"
    evidence: "board-preview/ is a pre-existing dev/showcase route explicitly out of scope (D-04 'dev/showcase routes untouched'); suggested owner Phase 4 polish per deferred-items.md"
---

# Phase 1: Foundation, Shell & Voice Baseline Verification Report

**Phase Goal:** A deployable Next.js landing scaffold consuming `.numen-surface` placeholder tokens; minimal nav + footer; calm confident-mentor voice baseline; SEO meta + kero-paced section-rhythm scaffold — all token-independent so nothing blocks on Numen Surface Phase 1.
**Verified:** 2026-06-12
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | Renders under `.numen-surface` scope with NO forked/reinvented tokens; tolerates placeholder tokens without breaking layout | ✓ VERIFIED | `(marketing)/layout.tsx:31` mounts single wrapper `<div className="numen-surface min-h-screen bg-bg text-text">`; root `layout.tsx` carries NO `numen-surface` (grep=0). All shells use bridged utilities only (`bg-bg/text-text/text-text-muted/bg-accent/border-border`) declared in `globals.css:356-392`; no hardcoded hex / `text-white` / `bg-gray-*` in shell files. `NumenLogo` + `cn` consumed from existing kit. Build green → tokens resolve. |
| 2 | Visitor sees a minimal, product-focused top nav + footer on every viewport (mobile-first) | ✓ VERIFIED | `nav.tsx` sticky opaque bar, desktop anchors + CTA, mobile hamburger (useState + outside-click mousedown + body scroll-lock w/ cleanup + dimming overlay + aria-expanded/aria-label + focus rings). `footer.tsx` minimal static (logo + positioning + anchor repeat + Privacy/Terms + X/LinkedIn `rel="noopener noreferrer"` + CTA slot + copyright). Both wired into `(marketing)/layout.tsx` (one Nav, one main, one Footer). |
| 3 | Copy reads in calm plain-language confident-mentor voice, zero engine jargon; established voice baseline later sections inherit | ✓ VERIFIED | `.planning/VOICE.md` (106 body lines): confident-mentor register, Rule 1 (zero jargon), Rule 2 (zero hype/fake-precision), Rule 3 (band+why), do/don't table, example lines, self-check. Applied copy (page headings, hero h1/subhead, footer line, metadata) all in-voice; route-wide hype grep on the 3 in-scope files = CLEAN. |
| 4 | Page exposes SEO meta (title/description) + kero-modeled section-rhythm scaffold (ordered section slots) later phases fill | ✓ VERIFIED | In-voice `metadata` in root + marketing layouts (title/description, no hype). `page.tsx` composes 6 ordered `SectionShell` slots `hero→how-it-works→honesty→gallery→proof→cta`; exactly one `<h1>` (hero), rest `<h2>` via SectionShell; uniform `py-24 md:py-32` kero rhythm + `scroll-mt-*` (MOT-02). OG card present, de-hyped. |

**Score:** 4/4 success criteria verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Final `.numen-surface` token swap (placeholders gone) | Phase 4 | P4 SC1 + DS-03 / D-L3 — gated on Numen Surface Phase 1 calibration sign-off |
| 2 | OG/share-card art redesign to Numen-surface skin | Phase 4 | P4 / D-11 — Phase 1 fixed copy only per 01-03 Task 3 scope |
| 3 | Dev/showcase hype-copy cleanup (`board-preview` "Virality score") | Phase 4 | D-04 dev/showcase routes untouched; deferred-items.md Plan 01-03 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/layout.tsx` | De-hyped in-voice metadata; no scope mount; 1 html/1 body | ✓ VERIFIED | title `Numen — an honest verdict…`; 1 html / 1 body; `numen-surface` grep=0; hype grep CLEAN |
| `.planning/VOICE.md` | Canonical confident-mentor baseline ≥40 lines | ✓ VERIFIED | 106 body lines; names confident-mentor, accuracy, go viral (forbidden), band; do/don't + examples |
| `src/components/numen-landing/section-shell.tsx` | Server SectionShell slot (id+heading+rhythm+scroll-margin) | ✓ VERIFIED | exports `SectionShell`, optional heading, `cn(... , className)` override-last, scroll-mt + py rhythm, no `use client` |
| `src/components/numen-landing/nav.tsx` | Client sticky opaque nav + hamburger | ✓ VERIFIED | `"use client"`, Lucide (no phosphor), sticky `bg-bg border-b`, 3 anchors, hamburger state machine, focus rings |
| `src/components/numen-landing/footer.tsx` | Static server footer shell | ✓ VERIFIED | server, NumenLogo, anchors, legal, X/LinkedIn `rel=noopener noreferrer`, CTA slot, copyright, focus rings |
| `src/app/(marketing)/layout.tsx` | No-html passthrough mounting `.numen-surface` wrapper | ✓ VERIFIED | 0 html / 0 body, single `numen-surface` wrapper div, imports new Nav/Footer, one `<main>`, in-voice metadata, no stale Header |
| `src/app/(marketing)/page.tsx` | Ordered SectionShell slots; single hero h1 | ✓ VERIFIED | imports SectionShell, 6 ids in locked order, `<h1>` count=1, no `@/components/landing` barrel |
| `src/app/(marketing)/opengraph-image.tsx` | De-hyped in-voice OG copy | ✓ VERIFIED | alt/tagline/subtitle in-voice; hype grep (incl `predict`) CLEAN; art/colors untouched (Phase 4) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `(marketing)/layout.tsx` wrapper div | `.numen-surface` scope (globals.css) | `className="numen-surface …"` | ✓ WIRED | scope decl at globals.css:356; wrapper carries it; root body does NOT |
| `page.tsx` | `section-shell.tsx` | import + ordered composition | ✓ WIRED | `import { SectionShell }`; 6 slots composed |
| nav/footer anchors | page section ids | `#hero/#how-it-works/#honesty/#gallery/#proof/#cta` | ✓ WIRED | nav 3 anchors + footer 3 anchors all resolve to real page ids; hero/cta exist |
| nav.tsx + footer.tsx | NumenLogo + bridged tokens | import + utility classes | ✓ WIRED | `NumenLogo` imported in both; bridged tokens only |
| layout.tsx metadata | VOICE.md register | in-voice title/description | ✓ WIRED | metadata strings obey VOICE.md forbidden-terms; CLEAN |

### Data-Flow Trace (Level 4)

N/A — phase delivers a static structural shell + voice baseline. No dynamic data sources; section slots are intentional heading-only skeletons (Phases 2-4 fill children). Hero/footer year is `new Date().getFullYear()` (real, not hardcoded). No HOLLOW_PROP / DISCONNECTED conditions apply.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production build compiles | `npm run build` | ✓ Compiled successfully in 5.8s; 55/55 static pages | ✓ PASS |
| Root `/` route + `/opengraph-image` present | build route table | both routes emitted | ✓ PASS |
| Single hero h1 | `grep -c '<h1' page.tsx` | 1 | ✓ PASS |
| Scope on marketing wrapper, not root body | grep numen-surface both files | marketing=3, root=0 | ✓ PASS |

### Probe Execution

N/A — no probes declared in PLAN/SUMMARY; not a migration/tooling phase. The authoritative gate is `npm run build` (run by verifier, green).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DS-01 | 01-02, 01-03 | Consumes `.numen-surface` tokens, no forked tokens | ✓ SATISFIED | bridged tokens only; scope mounted; NumenLogo/cn reused |
| DS-02 | 01-03 | Build tolerates placeholder tokens | ✓ SATISFIED | build green on placeholder token layer; swap gated to P4 |
| NAV-01 | 01-02 | Minimal product-focused top nav + footer | ✓ SATISFIED | nav.tsx + footer.tsx built, wired in layout |
| CONTENT-01 | 01-01, 01-03 | Calm confident-mentor voice, no jargon/hype | ✓ SATISFIED | VOICE.md baseline + in-voice copy; hype grep CLEAN on in-scope files |
| MOT-02 | 01-02, 01-03 | Section rhythm modeled on kero spine | ✓ SATISFIED | SectionShell uniform `py-24 md:py-32` + scroll-mt across 6 ordered slots |
| PERF-02 | 01-01, 01-03 | SEO meta + OG card | ✓ SATISFIED | in-voice title/description in both layouts; opengraph-image route present |

No orphaned requirements: all 6 P1 requirements in REQUIREMENTS.md traceability are claimed by plans and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| section-shell.tsx | 43 | `: null` (conditional heading) | ℹ️ Info | Intentional — optional heading lets hero render its own h1 with no second-level skip. Not a stub. |
| page.tsx slots | 45-60 | empty children (heading-only slots) | ℹ️ Info | Intentional phase-scoped skeleton (D-10); Phases 2-4 fill real media. Not a stub. |
| nav/footer/page | — | placeholder hrefs `#cta`, `#` | ℹ️ Info | Documented phase-scoped placeholders; live CTA wiring = CTA-01/02 (P2/P3). Not a blocker. |

No debt markers (TBD/FIXME/XXX/HACK) in phase-modified files. No stub-classified empties (no hollow data flow). No hype/fake-precision in any in-scope file.

### Architectural Note (not a gap)

The `(marketing)/layout.tsx` route-group layout wraps all sibling routes (`showcase`, `pricing`, `board-preview`, `coming-soon`, `viral-score-test`, `viz-test`, `primitives-showcase`). This is pre-existing Next.js route-group behavior — the OLD layout already wrapped them (with the dual-`<html>` bug + stale societies `<Header />`). The phase REPLACED the broken Header with the clean Nav/Footer + scope wrapper, fixing the dual-html landmine — a strict improvement. The "7 sibling routes untouched" claim (D-02 / Option B) correctly refers to (a) not editing the sibling route files and (b) leaving the ROOT `<body>` scope-free so the non-marketing app tree is untouched. Both hold. Not a phase failure.

### Human Verification Required

None. All success criteria verified programmatically (file inspection + grep gates + production build). No `<verify><human-check>` blocks were deferred in the PLAN files. Visual/responsive polish (375px hamburger interaction, scope-resolved warm-neutral bg) is a nice-to-have manual confirmation but is NOT required to assert goal achievement — the build is green, the scope wrapper is load-bearing and present, and the structural contract is met. (Manual visual confirmation can be folded into Phase 2's UI work.)

### Gaps Summary

No blocking gaps. The phase goal — a deployable, token-scoped landing scaffold with a minimal nav + footer, the confident-mentor voice baseline, and the kero-paced ordered section-rhythm scaffold + SEO meta — is fully achieved on disk:

- Root layout de-hyped, scope-free, single html/body. ✓
- VOICE.md canonical baseline authored (106 body lines, all rules). ✓
- Three shell components built, substantive, wired, on bridged tokens. ✓
- `.numen-surface` mounts on the marketing wrapper (Option B / D-02); root body untouched. ✓
- Single hero `<h1>` + 6 ordered slots; nav/footer anchors resolve. ✓
- In-voice metadata + de-hyped OG copy; in-scope hype grep CLEAN. ✓
- `npm run build` green (55/55 static pages). ✓

Three items are explicitly **deferred** to Phase 4 (final token swap / OG art redesign / dev-route hype cleanup) per the roadmap and D-04/D-11/D-L3 — informational, not actionable gaps. Pre-existing repo-wide tsc/lint debt in unrelated engine/test files is out of scope (SCOPE BOUNDARY) and does not block; the authoritative `npm run build` gate passes.

---

_Verified: 2026-06-12_
_Verifier: Claude (gsd-verifier)_
