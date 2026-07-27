---
phase: 02-hero-shell-final-cta-bookend-vision-beat
fixed_at: 2026-05-25T00:00:00Z
review_path: .planning/phases/02-hero-shell-final-cta-bookend-vision-beat/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-25T00:00:00Z
**Source review:** .planning/phases/02-hero-shell-final-cta-bookend-vision-beat/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Nested `<h1>` — WordRotate renders `motion.h1` inside outer `<h1>`

**Files modified:** `src/components/ui/word-rotate.tsx`
**Commit:** dd49256
**Applied fix:** Changed `motion.h1` to `motion.span` in the `AnimatePresence` render block. WordRotate is now a semantic-neutral inline primitive; heading element is controlled exclusively by the consumer (`HeadingTag` in HeroBookend). Also removed the "known limitation" comment in HeroBookend.tsx that acknowledged the now-fixed bug.

---

### CR-02: `<button>` inside `<a>` — invalid interactive-element nesting

**Files modified:** `src/app/(marketing)/_components/HeroBookend.tsx`
**Commit:** 5ab48ff
**Applied fix:** Removed the `<a href="#demo">` wrapper. ShimmerButton has no `asChild`/`href` prop (extends `ComponentPropsWithoutRef<"button">` only), so the fix uses an `onClick` handler that calls `document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })`. This is semantically correct — a button that triggers in-page scroll navigation, with no invalid interactive nesting.

---

### CR-03: Fragment URLs in `sitemap.xml` violate sitemap protocol

**Files modified:** `src/app/sitemap.ts`
**Commit:** 0eca1e5
**Applied fix:** Removed the `#demo` and `#pricing` fragment URL entries. Sitemap now contains only crawlable page URLs: `/`, `/privacy`, `/terms`.

---

### WR-01: `WordRotate` crashes when `words` is empty

**Files modified:** `src/components/ui/word-rotate.tsx`
**Commit:** 04125c7
**Applied fix:** Added `if (!words.length) return;` guard inside `useEffect` to prevent the NaN modulo interval from firing, and added `if (!words.length) return null;` after the hook calls (hooks must not be placed after early returns per React rules of hooks) so the component renders nothing on empty input.

---

### WR-02: `HeroSection` and `FinalCtaSection` marked `"use client"` unnecessarily

**Files modified:** `src/app/(marketing)/_components/HeroSection.tsx`, `src/app/(marketing)/_components/FinalCtaSection.tsx`
**Commit:** 6c17965
**Applied fix:** Removed `"use client"` directive from both files. Both are pure JSX wrappers with no client-side logic. `HeroBookend` is already marked `"use client"` and will correctly be treated as a client boundary. `LandingFooter` remains a server component.

---

### WR-03: Focus rings missing `outline-offset` on footer nav links and social icons

**Files modified:** `src/app/(marketing)/_components/LandingFooter.tsx`
**Commit:** 0f4f402
**Applied fix:** Added `focus-visible:outline-offset-2` to the `activeLinkClass` constant (covers all Product and Legal column nav links) and to all four social icon `<a>` elements. Focus appearance is now consistent with HeroBookend secondary CTA.

---

### WR-04: TikTok social link uses `Music` icon — incorrect brand representation

**Files modified:** `src/app/(marketing)/_components/LandingFooter.tsx`
**Commit:** 6da3cd5
**Applied fix:** Removed `Music` from lucide-react import. Replaced `<Music>` on the TikTok link with an inline SVG of the TikTok logo mark (`viewBox="0 0 24 24"`, `fill="currentColor"`, `aria-hidden="true"`). No new dependency added.

---

_Fixed: 2026-05-25T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
