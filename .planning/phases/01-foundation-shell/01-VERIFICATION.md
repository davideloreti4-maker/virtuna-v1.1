---
phase: 01-foundation-shell
verified: 2026-06-14T21:05:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit / in a browser (pnpm dev) and confirm the flat-warm look: charcoal #262624 page bg, cream #ece7de text, terracotta-clay coral #d97757 CTA — and crucially FLAT-MATTE (no glass, no backdrop-blur, no inset shine, no glow/halo anywhere)."
    expected: "Calm dark charcoal surface, cream text, one terracotta CTA; header is a flat opaque bar with a hairline bottom border (not a glass pill); footer is flat with a hairline top border. No frosted/blurred/glowing surfaces."
    why_human: "Visual appearance and the absence of glass/glow rendering cannot be verified by grep — only by eye. CONTEXT D-08 explicitly calls for this visual sanity check at the phase gate."
  - test: "Narrow the viewport below 768px (or open DevTools device toolbar) and exercise the mobile header: tap the menu icon, confirm the flat panel opens, tap a nav link, confirm the panel closes."
    expected: "Desktop nav links + Sign in/Try it free are hidden under ~768px; a Menu icon-button appears; tapping it reveals a flat charcoal panel with the anchors + Sign in + a full-width Try it free; tapping any link closes the panel and navigates to the anchor."
    why_human: "Responsive collapse + open/close interaction in a real browser viewport is a runtime/visual behavior; the unit test proves the state transition but not the actual responsive rendering."
  - test: "Enable OS/DevTools 'prefers-reduced-motion: reduce' (DevTools → Rendering → Emulate CSS prefers-reduced-motion), then trigger any animated element (e.g. a <Placeholder breathe /> or a later motion element)."
    expected: "All non-Framer CSS animations (skeleton-breathe / shimmer / marquee) halt (animation: none), and Framer motion elements drop transform/layout animation while keeping opacity — nothing janky, nothing load-bearing fails to appear."
    why_human: "Reduced-motion runtime behavior requires emulating the OS setting in a browser; the code path (MotionConfig reducedMotion='user' + the @media block) is verified statically but the actual halt is observable only at runtime. Plans 01-02/01-03 mark this an at-phase-gate DevTools check."
  - test: "Confirm the in-page anchor navigation works: click each header nav link (How it works · The Simulation · Pricing · FAQ) and each footer Product link."
    expected: "Each link smooth-scrolls/jumps to the matching anchored stub section (#how-it-works, #the-simulation, #pricing, #faq); the logo links back to #hero."
    why_human: "Anchor-scroll behavior is a runtime browser behavior; the hrefs and target ids are verified in code but the actual scroll resolution is observable only in-browser."
---

# Phase 1: Foundation & Shell Verification Report

**Phase Goal:** Stand up the marketing page at `/` with the dark Numen brand system (flat-warm: charcoal #262624 bg, cream #ece7de text, terracotta coral #d97757, Inter + Newsreader serif, flat-matte — no glass/glow; 6%/10% borders + 12px radius), the reusable placeholder-slot component every section will use, the motion foundation behind a reduced-motion fallback, and the header + footer chrome that wraps the scroll.
**Verified:** 2026-06-14T21:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All five ROADMAP success criteria are structurally VERIFIED in the codebase (real components, real tests, green build). Because the phase goal is fundamentally a **visual/runtime** deliverable (flat-warm appearance, the *absence* of glass/glow rendering, responsive mobile collapse, reduced-motion halt, anchor-scroll), the final sign-off requires a human visual/interaction pass in a browser — items listed below. CONTEXT D-08 explicitly scoped a "quick visual check on the assembled landing" to the phase gate, and plans 01-02/01-03/01-04 each defer a DevTools check there. Hence `human_needed`, not `passed`.

### Observable Truths

| # | Truth (from ROADMAP Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Visiting `/` renders the new marketing page (replacing the old home), dark-only, flat-warm Numen design system ported from numen-rework | ✓ VERIFIED | `(marketing)/page.tsx` renders `<MotionConfigShell><Header/><main>5 anchored sections</main><Footer/></MotionConfigShell>`, server component, Numen metadata. No competing `src/app/page.tsx`. `globals.css` line 45 `--color-charcoal-app:#262624`, 51 `--color-cream-primary:#ece7de`, 21 `--color-coral-500: oklch(0.68 0.13 33)≈#d97757`; `--color-background→charcoal-app`, `--color-foreground→cream-primary`. Removed glass/glow tokens (gradient-navbar/glass/feature, shadow-glass/glow-accent): NONE present. Old `src/components/landing/*` + 4 dead test routes deleted; zero orphan imports. `pnpm build` → / is `○` static. |
| 2 | Reusable placeholder-slot renders labelled aspect-correct stand-ins in image/video/avatar/logo, swappable via one prop, no layout shift | ✓ VERIFIED | `marketing/placeholder.tsx`: CVA 4 variants, `VARIANT_ICON` map (Image/Video/UserRound/Building2), `src` one-prop swap (`<img>` for image/avatar/logo, `<video>` for video), inline `aspectRatio` lock with `DEFAULT_ASPECT` per-variant (avatar 1/1), opt-in `breathe` gated `motion-reduce:animate-none`, flat-matte chip surface. Barrel exports `Placeholder`. 11/11 unit tests pass asserting img-absent/present, video, data-variant, aspect lock, breathe gate. |
| 3 | Motion wired via motion (Framer Motion) + every animation respects a global reduced-motion fallback | ✓ VERIFIED | `marketing/motion-config.tsx`: `"use client"`, `<MotionConfig reducedMotion="user">` from `motion/react`, wired into `page.tsx` around the full chrome. `globals.css` line 363 `@media (prefers-reduced-motion: reduce)` block sets `animation: none !important` for skeleton-breathe/shimmer/marquee/marquee-vertical. D-16: 6 `motion/*` wrappers on `motion/react`, 0 on `framer-motion` (dep retained for 4 out-of-scope product files, removal deferred). |
| 4 | Header shows Stele logo + "Numen" wordmark + "Try it free" CTA, collapses to mobile nav on small screens | ✓ VERIFIED | `layout/header.tsx`: renders `<NumenLogo/>` (Stele mark + "Numen" wordmark via currentColor), 4 anchor links, `Button asChild variant=primary` "Try it free" → `SIGNUP_URL` (/signup), "Sign in" → `LOGIN_URL` (/login). Mobile: `useState` disclosure, ≥44px Menu/X toggle with `aria-label` Open/Close, `mobile-nav-panel`, close-on-tap, body-scroll-lock. Flat-matte (`bg-background-elevated`, `border-b border-border`, `shadow-float` only on panel). 6/6 unit tests pass (href assertions + open/close). |
| 5 | Footer provides brand, in-page section links, and legal/social placeholders | ✓ VERIFIED | `layout/footer.tsx`: static server component, `<NumenLogo/>` + tagline, `PRODUCT_LINKS` mirroring nav (#how-it-works/#the-simulation/#pricing/#faq), `LEGAL_LINKS` (Privacy/Terms), `SOCIAL_LINKS` (X/TikTok) as `href="#"` placeholders. No societies content. Flat-warm (`border-t border-border`, no glass/gradient). 10/10 unit tests pass (brand present, societies absent, anchor mirror, legal/social labels). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/app/globals.css` | Flat-warm @theme (charcoal/cream/terracotta), flat-matte shadows, reduced-motion block, --font-serif→newsreader | ✓ VERIFIED | All tokens present; removed glass tokens absent; reduced-motion @media block present (line 363). SDK: passed. |
| `src/app/layout.tsx` | Inter + Newsreader on `<html>`, lang="en" | ✓ VERIFIED | Both fonts wired; `${inter.variable} ${newsreader.variable}`, `lang="en"`. SDK: passed. |
| `src/app/(marketing)/page.tsx` | Scroll skeleton — Header + anchored sections + Footer + Numen metadata | ✓ VERIFIED | 5 sections (hero/how-it-works/the-simulation/pricing/faq), MotionConfigShell wrap. SDK: passed. |
| `src/app/(marketing)/layout.tsx` | Bare pass-through (no html/body/Header/societies) | ✓ VERIFIED | Pure `<>{children}</>`. No `<html>`/`<body>`/`<Header>`/"Artificial Societies". |
| `src/lib/routes.ts` | SIGNUP_URL / LOGIN_URL constants | ✓ VERIFIED | `SIGNUP_URL="/signup"`, `LOGIN_URL="/login"`. SDK: passed. |
| `src/components/marketing/placeholder.tsx` | CVA placeholder slot (4 variants, src swap, aspect lock) | ✓ VERIFIED | Substantive (184 lines). SDK: passed. |
| `src/components/marketing/index.ts` | Barrel: Placeholder + MotionConfigShell | ✓ VERIFIED | Both exported. SDK: passed. |
| `src/components/marketing/motion-config.tsx` | Client MotionConfig shell reducedMotion="user" | ✓ VERIFIED | SDK: passed. |
| `src/components/layout/header.tsx` | Flat-matte sticky Header | ✓ VERIFIED | 159 lines, NumenLogo + routes. SDK: passed. |
| `src/components/layout/footer.tsx` | Flat-warm compact Footer | ✓ VERIFIED | 139 lines, NumenLogo + anchors. SDK: passed. |
| Test files (placeholder/header/footer) | FOUND-03/NAV-01/NAV-03/NAV-02 coverage | ✓ VERIFIED | 27/27 tests pass, substantive assertions. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `page.tsx` | `header.tsx` | `import { Header }` | ✓ WIRED | Imported via barrel `@/components/layout`; rendered `<Header/>` (line 28). SDK pattern (`layout/header`) was a false negative — barrel import resolves it. |
| `globals.css` | `--font-newsreader` | `--font-serif` alias | ✓ WIRED | Line 123 `--font-serif: var(--font-newsreader), ...`. SDK false negative (file-resolution quirk); manual grep confirms. |
| `placeholder.tsx` | `@/lib/utils` | `cn()` | ✓ WIRED | `cn()` used 2× (import + composition). SDK reported "Invalid regex" (tool bug), not a missing link. |
| `index.ts` | `./placeholder` | barrel re-export | ✓ WIRED | SDK: verified. |
| `page.tsx` | `motion-config.tsx` | MotionConfigShell wrap | ✓ WIRED | SDK: verified. |
| `motion-config.tsx` | `motion/react` | import MotionConfig | ✓ WIRED | SDK: verified. |
| `header.tsx` | `@/lib/routes` | SIGNUP_URL/LOGIN_URL | ✓ WIRED | SDK: verified. |
| `header.tsx` | `numen-logo.tsx` | import NumenLogo | ✓ WIRED | SDK: verified. |
| `footer.tsx` | `numen-logo.tsx` | import NumenLogo | ✓ WIRED | SDK: verified. |
| `footer.tsx` | nav anchors | in-page anchor mirror | ✓ WIRED | SDK: verified (#the-simulation present). |

**Note on SDK false negatives:** 3 key links reported `verified:false` by `gsd-sdk query verify.key-links` were manually confirmed WIRED. Two are pattern mismatches (the link uses the barrel import path, not the literal direct path the pattern expected; the font-serif regex didn't resolve against the file) and one is an SDK regex-escaping bug (`cn\(` → "Invalid regex pattern"). All three connections exist in the actual code (verified by reading the files + targeted grep).

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `placeholder.tsx` | `src` prop | Developer-supplied build-time path | N/A (designed stand-in) | ✓ N/A — the labelled stand-in IS the intended default; `src` swaps to real media. Not a hollow data path; this is a marketing-surface-only phase with no dynamic data by design. |
| `header.tsx` / `footer.tsx` | NAV_LINKS / PRODUCT_LINKS | Static const arrays | Yes (static anchors) | ✓ FLOWING — static nav data renders real anchor links. |

No dynamic/DB-backed data exists in this phase (marketing surface only, per MILESTONE constraint). Level-4 trace is N/A for hollow-data risk.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase-1 component tests pass | `npx vitest run placeholder/header/footer.test.tsx` | 27/27 passed (placeholder 11, footer 10, header 6) | ✓ PASS |
| Production build compiles | `pnpm build` | "Compiled successfully", 51/51 static pages, `/` is `○` static | ✓ PASS |
| `/` owned by marketing, old home replaced | `ls (marketing)/page.tsx` + `test -f src/app/page.tsx` | marketing home exists; no competing root | ✓ PASS |
| Old societies code deleted | `test -d src/components/landing` + dead routes | all deleted, 0 orphan imports | ✓ PASS |
| D-16 motion library | grep motion/react vs framer-motion in motion/* | 6 on motion/react, 0 on framer-motion | ✓ PASS |
| No debt markers in new files | grep TBD/FIXME/XXX/TODO/HACK in 11 new files | none found | ✓ PASS |

### Probe Execution

No probes declared for this phase (UI/marketing phase; PLANs declare no `scripts/*/tests/probe-*.sh`). Behavioral verification done via the vitest suites + build above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FOUND-01 | 01-01 | Visitor lands on new marketing page at `/`, replacing current home | ✓ SATISFIED | `(marketing)/page.tsx` skeleton; no competing root; old landing/* deleted |
| FOUND-02 | 01-01 | Page renders dark-only flat-warm Numen design system (charcoal/cream/terracotta, flat-matte, 6%/10% borders, 12px radius) | ✓ SATISFIED | `globals.css` flat-warm @theme; removed glass tokens; Newsreader wired. Visual confirmation → human item 1. |
| FOUND-03 | 01-02 | Reusable placeholder-slot, labelled, aspect-correct, 4 variants, one-prop swap | ✓ SATISFIED | `placeholder.tsx` + 11 tests |
| FOUND-04 | 01-03 | Motion wired via motion/react + global reduced-motion fallback | ✓ SATISFIED | MotionConfigShell + CSS @media block + D-16 verified. Runtime halt → human item 3. |
| NAV-01 | 01-04 | Header: Stele logo + "Numen" wordmark + "Try it free" CTA | ✓ SATISFIED | `header.tsx` + 6 tests |
| NAV-02 | 01-05 | Footer: brand + in-page section links + legal/social placeholders | ✓ SATISFIED | `footer.tsx` + 10 tests |
| NAV-03 | 01-04 | Header collapses to mobile-appropriate nav on small screens | ✓ SATISFIED | mobile useState disclosure + tests. Responsive render → human item 2. |

All 7 phase requirement IDs accounted for across the 5 plans (FOUND-01/02 in 01-01, FOUND-03 in 01-02, FOUND-04 in 01-03, NAV-01/03 in 01-04, NAV-02 in 01-05). No orphaned requirements: REQUIREMENTS.md maps exactly these 7 to Phase 1, all claimed. FOUND-05/06/07 correctly deferred to Phase 5 (not Phase 1 scope).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `footer.tsx` | 60 | `role="contentinfo"` redundant on `<footer>` | ℹ️ Info | a11y nit (REVIEW WR-03). Out-of-scope for Phase 1 per task instructions (Phase 5 hardening = FOUND-07). |
| `footer.tsx` | 81/99/115 | column heads use `<h2>` (skip hierarchy) | ℹ️ Info | a11y nit (REVIEW WR-02). Deferred to Phase 5. |
| `(marketing)/page.tsx` | 31-38 | hero is `<p>`, no `<h1>` on page | ℹ️ Info | The real hero `<h1>` is a Phase 2 deliverable (REVIEW WR-05). Explicitly out-of-scope for Phase 1 per task instructions. |
| `pricing/page.tsx` | 5 / — | `force-dynamic` + no `<Header>` | ℹ️ Info | Pre-existing legacy `/pricing` debt (REVIEW CR-01/CR-02). Phase 1 only build-fixed (dropped FAQSection import); full reskin deferred (CONTEXT D-11 + `<deferred>`). Out-of-scope per task instructions. Build passes. |

**No 🛑 Blocker anti-patterns.** No debt markers (TBD/FIXME/XXX/TODO/HACK) in any new Phase-1 file. The "glass/blur" strings found in `header.tsx`/`placeholder.tsx` are JSDoc prose describing the *absence* of glass — NOT actual CSS. The flat-matte contract holds: no `backdropFilter`, `blur()`, `gradient-glass`, `gradient-navbar`, `shadow-glass`, or `shadow-glow` CSS in any new file.

### Human Verification Required

Four runtime/visual checks (the phase goal is fundamentally a visual deliverable; CONTEXT D-08 + plans 01-02/01-03/01-04 scope these to the phase gate):

#### 1. Flat-warm visual + no-glass/glow rendering
**Test:** Visit `/` (`pnpm dev`) and confirm charcoal #262624 bg, cream #ece7de text, terracotta #d97757 CTA, and FLAT-MATTE surfaces (no glass/blur/shine/glow).
**Expected:** Calm dark charcoal, cream text, one terracotta CTA; flat header (hairline bottom border, not a glass pill); flat footer (hairline top border). No frosted/blurred/glowing surfaces.
**Why human:** Visual appearance and absence-of-glass rendering cannot be grep-verified.

#### 2. Mobile header collapse (responsive + interaction)
**Test:** Below ~768px, tap the menu icon → panel opens → tap a nav link → panel closes.
**Expected:** Desktop links hidden under 768px; Menu icon appears; flat charcoal panel with anchors + Sign in + full-width CTA; closes + navigates on link tap.
**Why human:** Responsive rendering + interaction in a real viewport (unit test proves state transition, not actual responsive layout).

#### 3. Reduced-motion fallback
**Test:** Enable `prefers-reduced-motion: reduce` (DevTools → Rendering), trigger an animated element.
**Expected:** Non-Framer CSS animations halt; Framer elements drop transform/layout, keep opacity; nothing janky, nothing load-bearing fails.
**Why human:** Runtime OS-setting emulation required; code path verified statically only.

#### 4. In-page anchor navigation
**Test:** Click each header nav link + footer Product link; click the logo.
**Expected:** Each scrolls/jumps to its anchored section (#how-it-works/#the-simulation/#pricing/#faq); logo → #hero.
**Why human:** Anchor-scroll is a runtime browser behavior; hrefs/ids verified in code.

### Gaps Summary

**No gaps.** All 5 ROADMAP success criteria are structurally achieved in the codebase: the flat-warm `/` skeleton replaces the old home, the design-system port is complete (charcoal/cream/terracotta tokens, glass/glow removed, Newsreader wired), the `<Placeholder>` slot is real and tested, the two-layer reduced-motion foundation is wired (MotionConfig + CSS @media) with D-16 verified, and the header/footer chrome satisfy NAV-01/02/03. `pnpm build` exits 0 (`/` static), 27/27 Phase-1 unit tests pass, no debt markers, flat-matte contract intact, all 7 requirement IDs covered with zero orphans.

Status is `human_needed` (not `passed`) solely because the phase goal is a **visual/runtime** deliverable: the flat-warm look, the literal absence of glass/glow rendering, the responsive mobile collapse, the reduced-motion halt, and anchor-scroll can only be confirmed by a human in a browser — exactly the phase-gate visual check CONTEXT D-08 and plans 01-02/01-03/01-04 deferred here. The legacy `/pricing` debt and the deferred hero `<h1>` (Phase 2) are explicitly out-of-scope for Phase 1 and are not gaps.

---

_Verified: 2026-06-14T21:05:00Z_
_Verifier: Claude (gsd-verifier)_
