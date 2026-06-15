---
phase: 03-story-showcase
reviewed: 2026-06-15T11:25:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/app/(marketing)/page.tsx
  - src/components/layout/footer.tsx
  - src/components/layout/header.tsx
  - src/components/layout/__tests__/footer.test.tsx
  - src/components/marketing/index.ts
  - src/components/marketing/story/how-it-works.tsx
  - src/components/marketing/story/simulation-showcase.tsx
  - src/components/marketing/story/feature-block.tsx
  - src/components/marketing/story/feature-blocks.tsx
  - src/components/marketing/story/__tests__/how-it-works.test.tsx
  - src/components/marketing/story/__tests__/simulation-showcase.test.tsx
  - src/components/marketing/story/__tests__/feature-blocks.test.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-15T11:25:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Story & Showcase phase: the marketing page scroll skeleton, the
rebuilt header/footer chrome, and the three new STORY sections (HowItWorks,
SimulationShowcase, FeatureBlocks + FeatureBlock leaf), plus their Wave-0 tests.

Overall quality is high. All 28 in-scope tests pass, ESLint is clean, every
referenced semantic token (`bg-surface`, `bg-surface-elevated`,
`bg-background-elevated`, `bg-hover`, `border-border`, `ring-accent`,
`shadow-float`, `text-foreground-*`) resolves in `globals.css`. The RSC/island
split is correctly preserved — every section root is a pure Server Component;
only the leaf motion wrappers and `MotionConfigShell`/`Header` carry
`"use client"`, so `/` stays statically prerenderable (no client directive
leaked to a section root). Product-noun discipline holds inside every in-scope
file: no "reading" appears in user-facing copy for HowItWorks,
SimulationShowcase, FeatureBlocks, header, footer, or page.

No security issues. No hardcoded secrets. CTA targets are static module
constants (`/signup`, `/login`) with no user-input interpolation — no
open-redirect surface. Footer/header link maps use correct React keys.

Findings are limited to one cross-file noun-discipline leak on the shared `/`
route (the hero, just outside this phase's file list, still ships "Numen
reading" — surfaced because this phase explicitly locks the noun and the
SimulationShowcase docblock claims to reuse that hero chrome), one latent
body-scroll-lock clobber pattern, and doc/code drift items.

## Warnings

### WR-01: "reading" still ships as user-facing product copy on `/` (hero slot label)

**File:** `src/components/marketing/hero/hero.tsx:132`
**Issue:** This phase's grading note locks the product noun to "Simulation" and
forbids "reading" in user-facing copy. The three new STORY sections honor it,
but the hero on the SAME route still renders a Placeholder labelled
`label="Numen reading"`, and its test (`hero/__tests__/hero.test.tsx:71-86`)
asserts `getByText(/numen reading/i)` — actively pinning the banned noun. So the
prerendered `/` page a visitor sees still says "reading" above the fold, directly
contradicting STORY-01/02/03's `never uses 'reading'` contract
(`story/__tests__/how-it-works.test.tsx:76-81`). The SimulationShowcase docblock
(`simulation-showcase.tsx:23`) even states it "reused" this hero chrome,
inheriting the inconsistency. hero.tsx is outside the literal file list but is
load-bearing for the same noun lock this phase enforces.
**Fix:** Rename the hero slot label and its test to the locked noun:
```tsx
// hero.tsx
<Placeholder ... label="Numen Simulation" />
// hero.test.tsx
expect(screen.getByText(/numen simulation/i)).toBeTruthy();
```
If hero.tsx is genuinely frozen for this phase, file a follow-up so the noun
lock is enforced page-wide, not only in the new sections.

### WR-02: body scroll-lock clobbers prior overflow instead of saving/restoring it

**File:** `src/components/layout/header.tsx:45-54`
**Issue:** The mobile-menu effect always restores `document.body.style.overflow = ""`
on close/unmount rather than the value it found. A second scroll-locker exists in
the codebase (`src/components/primitives/GlassModal.tsx:132-141`) using the same
clobber pattern. If both are active on one page, whichever cleans up last forces
`overflow` to `""`, silently unlocking scroll while the other consumer still needs
it locked (lost-update on shared global state). GlassModal is not on the marketing
route today, so this is latent rather than active — but the header is the canonical
new chrome and the pattern is the defect.
**Fix:** Snapshot and restore the previous value:
```tsx
useEffect(() => {
  const prev = document.body.style.overflow;
  if (mobileMenuOpen) document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = prev; };
}, [mobileMenuOpen]);
```

### WR-03: mobile nav panel has no Escape-to-close and no focus management

**File:** `src/components/layout/header.tsx:106-157`
**Issue:** The disclosure trigger sets `aria-expanded`/`aria-controls` correctly
and the panel closes on link tap, but there is no `Escape`-key handler and no
focus move into the opened panel (nor focus return to the trigger on close).
With body scroll locked, a keyboard-only user who opens the menu cannot dismiss
it with Escape and tab focus stays behind the trigger — a robustness/a11y gap
for an interactive control on the primary navigation.
**Fix:** Add a keydown listener while open and return focus to the trigger on
close:
```tsx
useEffect(() => {
  if (!mobileMenuOpen) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileMenuOpen(false); };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [mobileMenuOpen]);
```

### WR-04: SimulationShowcase tests depend on accidental single-match copy, not stable structure

**File:** `src/components/marketing/story/__tests__/simulation-showcase.test.tsx:29-66`
**Issue:** Each assertion uses `screen.getByText(/.../i)`, which THROWS on more
than one match. The suite only passes because the component copy was hand-tuned
so each queried token (`/audience/i`, `/simulat/i`, `/hook/i`, `/retention/i`,
`/drop/i`, `/shareab/i`) appears in exactly one text node — a constraint the
source even documents defensively (`simulation-showcase.tsx:46-50, 130`). This
couples the test to incidental wording: a future copy edit that legitimately
mentions "audience" or "drop" twice (e.g. a clarifier line) breaks the gate with
a confusing "multiple elements" error, not a real regression. The phase's own
"resilience rule" (assert stable tokens, not full sentences) is undercut by the
strict single-match query.
**Fix:** Use `getAllByText(...).length` / `queryAllByText` with a count guard
where multiplicity is plausible, e.g.:
```tsx
expect(screen.getAllByText(/audience/i).length).toBeGreaterThanOrEqual(1);
```
or scope the query to the outputs `<dl>` so unrelated copy cannot collide.

## Info

### IN-01: SimulationShowcase docblock lists 5 named outputs; only 3 chips render

**File:** `src/components/marketing/story/simulation-showcase.tsx:26-27`
**Issue:** The header comment enumerates "Audience simulation · Watch-through % ·
Hook · Retention (where viewers drop) · Shareability" (five), but `NAMED_OUTPUTS`
(lines 46-62) defines three chips, the third folding Hook/Retention/Shareability
into one. Doc/code drift — the prose overstates the rendered structure.
**Fix:** Align the docblock to the three rendered chips (the third being the
combined "Hook · Retention · Shareability" lever row).

### IN-02: page.tsx docblock describes a stale Phase-1 skeleton

**File:** `src/app/(marketing)/page.tsx:17-29`
**Issue:** The component docblock still says sections are "empty-but-anchored …
with a muted placeholder heading" and that "Real content + the serif hero land in
Phases 2–4." After this phase, hero / how-it-works / the-simulation / features all
render real content; only pricing and FAQ remain stubs. The comment misleads a
future reader about which sections are filled.
**Fix:** Update the docblock to reflect that STORY sections are now populated and
only `#pricing` / `#faq` remain placeholder stubs.

### IN-03: duplicated nav-link source of truth (header vs footer)

**File:** `src/components/layout/footer.tsx:15-21` and `src/components/layout/header.tsx:17-23`
**Issue:** `PRODUCT_LINKS` (footer) and `NAV_LINKS` (header) are byte-identical
arrays maintained in two files; the footer comment even instructs readers to keep
them "exactly" in sync by hand. The footer test pins all five anchors, so a header
edit can silently desync the two without a failing test on the header side.
**Fix:** Lift the shared anchor set into one constant (e.g. `src/lib/nav.ts`) and
import it in both, so the mirror is structural rather than manual.

### IN-04: redundant variant fallbacks in Placeholder consumers and component

**File:** `src/components/marketing/placeholder.tsx:112-116`
**Issue:** `variant = "image"` is defaulted in the destructure, yet line 115 also
does `const resolvedVariant = variant ?? "image"` — the `?? "image"` is
unreachable because the destructure default already guarantees a value (CVA
`defaultVariants` also covers it). Minor dead-defensive code. (Placeholder itself
is a prior-phase file; flagged only because every STORY section depends on it.)
**Fix:** Drop the redundant `?? "image"`; `resolvedVariant = variant` suffices
given the destructure default.

---

_Reviewed: 2026-06-15T11:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
