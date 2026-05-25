---
phase: "02"
plan: "03"
subsystem: page-assembly
tags: [assembly, wiring, sections, anchors, dvh, bookend, a11y]
dependency_graph:
  requires:
    - 02-01-SUMMARY.md (HeroBookend with headingAs prop + all UI primitives)
    - 02-02-SUMMARY.md (VisionBeat + LandingFooter server components)
  provides:
    - src/app/(marketing)/_components/HeroSection.tsx
    - src/app/(marketing)/_components/FinalCtaSection.tsx
    - src/app/(marketing)/v3/page.tsx (updated — Phase 2 assembly complete)
  affects:
    - /v3 route: Hero + VisionBeat + FinalCtaSection + Footer all rendered
    - LandingHeader nav: #hero, #pricing, #final-cta anchor IDs preserved in DOM
tech_stack:
  added: []
  patterns:
    - Thin client wrapper pattern (HeroSection, FinalCtaSection) delegating to HeroBookend
    - Fragment wrapper for landmark sibling composition (FinalCtaSection + LandingFooter)
    - headingAs="p" pattern for single-H1 a11y contract (FinalCtaSection)
key_files:
  created:
    - src/app/(marketing)/_components/HeroSection.tsx
    - src/app/(marketing)/_components/FinalCtaSection.tsx
  modified:
    - src/app/(marketing)/v3/page.tsx
decisions:
  - "HeroSection is 'use client' because HeroBookend is a client component — boundary kept clean"
  - "FinalCtaSection is 'use client' for same reason; LandingFooter (server) rendered as fragment sibling"
  - "LandingFooter placed outside <section id='final-cta'> — avoids nested landmark violation (footer inside section)"
  - "Single-H1 a11y rule resolved in Phase 2 via headingAs='p' on FinalCtaSection's HeroBookend"
  - "Dev server smoke test blocked by missing Supabase env — static build HTML used for assertion"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-25"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 02 Plan 03: Page Assembly Wiring Summary

Two thin client wrapper components (HeroSection + FinalCtaSection) created and wired into /v3 page assembly, replacing Hero and Final CTA SectionShell placeholders; VisionBeat inserted between pricing and Final CTA; single-H1 a11y contract resolved via headingAs="p" in FinalCtaSection; static build confirms /v3 SSR output.

---

## Final /v3 Page Structure

```
/v3 (static ○)
├── SkipToContent           (Phase 1 — preserved)
├── GrainOverlay            (Phase 1 — preserved)
├── LandingHeader           (Phase 1 — preserved)
└── main#main-content
    └── MotionRoot
        ├── HeroSection          ← Phase 2 REAL (HERO-01, HERO-08)
        ├── SectionShell#demo    ← Phase 4 placeholder
        ├── SectionShell#how-it-works   ← Phase 5 placeholder
        ├── SectionShell#surfaces       ← Phase 6 placeholder
        ├── SectionShell#comparison     ← Phase 7 placeholder
        ├── SectionShell#science        ← Phase 8 placeholder
        ├── SectionShell#social-proof   ← Phase 9 placeholder
        ├── SectionShell#pricing        ← Phase 10 placeholder
        ├── VisionBeat           ← Phase 2 REAL (VISION-01)
        └── FinalCtaSection      ← Phase 2 REAL (CTA-01..06)
            └── LandingFooter    ← Phase 2 REAL (rendered as fragment sibling)
```

---

## HeroSection + FinalCtaSection Wrapper Pattern

Both are `"use client"` because they compose HeroBookend which is a client component. They are thin wrappers — no logic of their own.

**HeroSection:**
- `<section id="hero" aria-label="Hero section" className="relative bg-background">`
- No `min-h-[100dvh]` on wrapper — HeroBookend outer div applies it (reducedHeight=false default)
- No explicit `headingAs=` — default "h1" renders the canonical `<h1>`

**FinalCtaSection:**
- `<section id="final-cta" aria-label="Final CTA section" className="relative bg-background">`
- `style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}` — separator from VisionBeat
- `<HeroBookend reducedHeight headingAs="p" />` — min-h-[60vh] + p[role=heading][aria-level=2]
- `<LandingFooter />` rendered as fragment sibling (avoids landmark nesting violation)

---

## Single-H1 A11y Contract — RESOLVED IN PHASE 2

**Method:** FinalCtaSection passes `headingAs="p"` to HeroBookend.
HeroBookend renders `<p role="heading" aria-level={2}>` with identical visual styling and WordRotate behavior.

**SSR assertion result:**
```
grep -cE '<h1[> ]' .next/server/app/v3.html → 1
```
Exactly ONE `<h1>` in HTML output. Hero is the canonical H1. Final CTA visual H1 is `<p role="heading" aria-level={2}>`.

UI-SPEC § Accessibility Contract single-H1 rule satisfied in Phase 2 — no deferral to Phase 11.

---

## Build Verification

`pnpm build` output (both runs):
- `/v3` — `○ (Static)` ✓
- `/privacy` — `○ (Static)` ✓
- `/terms` — `○ (Static)` ✓

---

## Static HTML Smoke Test Results

Assertions against `.next/server/app/v3.html`:

| Check | Expected | Result |
|-------|----------|--------|
| `id="hero"` present | 1 | PASS (1) |
| `id="vision-beat"` present | 1 | PASS (1) |
| `id="final-cta"` present | 1 | PASS (1) |
| `<h1` count (single-H1) | 1 | PASS (1) |
| "Predict viral for" (Hero H1) | ≥1 | PASS (1) |
| "Score your first TikTok" (primary CTA) | ≥1 | PASS (1) |
| "Davide Loreti, Founder, Virtuna" (VisionBeat) | 1 | PASS (1) |
| "Numen Machines" (Footer strip) | ≥1 | PASS (1) |
| "Privacy Policy" in /privacy.html | ≥1 | PASS (1) |
| "Terms of Service" in /terms.html | ≥1 | PASS (1) |

**Note on dev server smoke test:** Dev server blocked by missing Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` not present in this worktree — no `.env.local`). Middleware rejects all requests with 500. This is a pre-existing auth gate, not caused by Plan 03 changes. Static build HTML used as authoritative verification instead.

---

## Anchor Preservation

LandingHeader nav links `#hero`, `#pricing`, `#final-cta` still resolve:
- `#hero` — present in HeroSection `<section id="hero">`
- `#pricing` — preserved on SectionShell placeholder (unchanged)
- `#final-cta` — present in FinalCtaSection `<section id="final-cta">`

---

## Dev Server Lifecycle

- Dev server spawned with `PID=48492`
- Killed with `kill 48492` after smoke test attempt
- `pgrep -f "next dev"` confirmed empty after kill

---

## Deviations from Plan

### Auth Gate (not a deviation — pre-existing)

**Dev server smoke test blocked by Supabase env gate**
- Middleware requires `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- No `.env.local` in this worktree
- All curl requests return 500 (middleware error)
- Resolution: Used `.next/server/app/v3.html` (static build output) for all assertions
- All plan acceptance criteria met via static HTML — functionally equivalent

None — plan executed as written except dev-server smoke tests redirected to static HTML.

---

## Threat Surface Scan

No new trust boundaries introduced beyond those in the plan's threat model.

| Threat | Status |
|--------|--------|
| T-02-13: Anchor nav tampering | MITIGATED — `id="hero"` and `id="final-cta"` confirmed in SSR HTML |
| T-02-14: Heading hierarchy gap | RESOLVED — single `<h1>` in SSR HTML (`grep -cE '<h1[> ]' v3.html = 1`) |
| T-02-17: Orphaned dev server | MITIGATED — PID captured, killed, `pgrep` confirmed empty |

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create HeroSection.tsx wrapper | f81bbe5 | src/app/(marketing)/_components/HeroSection.tsx |
| 2 | Create FinalCtaSection.tsx | ca426e3 | src/app/(marketing)/_components/FinalCtaSection.tsx |
| 3 | Update v3/page.tsx assembly | 0f5cac0 | src/app/(marketing)/v3/page.tsx |

---

## Self-Check

Files exist:
- [x] `src/app/(marketing)/_components/HeroSection.tsx`
- [x] `src/app/(marketing)/_components/FinalCtaSection.tsx`
- [x] `src/app/(marketing)/v3/page.tsx` (modified)

Commits exist:
- [x] f81bbe5 (HeroSection)
- [x] ca426e3 (FinalCtaSection)
- [x] 0f5cac0 (v3 page assembly)

## Self-Check: PASSED
