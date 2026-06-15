---
phase: 03-story-showcase
reviewed: 2026-06-15T14:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/app/(marketing)/page.tsx
  - src/components/layout/footer.tsx
  - src/components/layout/header.tsx
  - src/components/layout/__tests__/header.test.tsx
  - src/components/marketing/hero/hero.tsx
  - src/components/marketing/hero/__tests__/hero.test.tsx
  - src/components/marketing/placeholder.tsx
  - src/components/marketing/story/feature-block.tsx
  - src/components/marketing/story/feature-blocks.tsx
  - src/components/marketing/story/how-it-works.tsx
  - src/components/marketing/story/simulation-showcase.tsx
  - src/components/marketing/story/skeletons/audience-cloud-skeleton.tsx
  - src/components/marketing/story/skeletons/device-chrome.tsx
  - src/components/marketing/story/skeletons/driver-rows-skeleton.tsx
  - src/components/marketing/story/skeletons/index.ts
  - src/components/marketing/story/skeletons/score-gauge-skeleton.tsx
  - src/components/marketing/story/__tests__/feature-blocks.test.tsx
  - src/components/marketing/story/__tests__/how-it-works.test.tsx
  - src/components/marketing/story/__tests__/simulation-showcase.test.tsx
  - src/components/marketing/story/__tests__/skeletons.test.tsx
  - src/lib/nav.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 03 (gap-closure): Code Review Report

**Reviewed:** 2026-06-15T14:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Gap-closure pass covering the craft-skeleton primitives (skeletons/\*), a11y
additions to the mobile nav (header.tsx), and the full story section tree
(how-it-works, simulation-showcase, feature-blocks). Focus: client-leak risk,
focus-management correctness, and noun-lock integrity.

No blockers. Three warnings, three info items.

The mobile-nav a11y code is the highest-risk change. The core logic — scroll
lock, focus trap, Escape handler, and focus restore — is correct. One
behavioural gap exists: clicking an in-panel link moves native focus to the
link's href target BEFORE the React effect can restore it to the trigger,
creating a one-frame focus-placement race that passes in JSDOM but can fail in
real browsers on certain link types.

All story components and skeletons are pure RSC with no "use client" directive
— the static prerender constraint holds. Noun lock ("Simulation", never
"reading") is intact across all 21 files.

---

## Warnings

### WR-01: Focus-restore race on link-tap close (header.tsx)

**File:** `src/components/layout/header.tsx:102-109`

**Issue:** When a panel link is tapped, the browser's native focus sequence
runs _before_ React re-renders. The sequence is:

1. User clicks a `<Link href="#section">` (in-page anchor).
2. Browser fires click → the link's default action moves focus to the target
   `<section>` element (if it has a `tabindex` or `id` the browser treats as
   focusable) OR to `document.body`.
3. React processes the `onClick={closeMenu}` → `setMobileMenuOpen(false)`.
4. After re-render + paint, the third `useEffect` fires and calls
   `triggerRef.current?.focus()`.

In JSDOM (used by the test suite) step 2 is a no-op — JSDOM does not implement
native focus-on-anchor-click. In a real browser, step 4 wins only if nothing
else claims focus between steps 2 and 4. For in-page `#` anchors this is
usually fine. For hrefs like `SIGNUP_URL = "/signup"` (a Next.js `<Link>` that
triggers a client-side navigation), the panel unmounts mid-navigation and the
effect fires on a component that may already be tearing down, making the
trigger `focus()` call a no-op (triggerRef.current will be null if the header
unmounts). This is a ghost no-op rather than an error, but it means focus lands
on `<body>` instead of the trigger after a CTA tap-close — breaking the
expected focus-restore behaviour the tests verify.

**Fix:** Move focus restore into the click handler rather than relying on a
downstream effect for the link-tap path:

```tsx
const closeMenu = () => {
  setMobileMenuOpen(false);
  // Restore focus synchronously so the browser's native focus sequence
  // cannot race the effect-based restore.
  requestAnimationFrame(() => triggerRef.current?.focus());
};
```

Then simplify the third `useEffect` to only handle the Escape path (which
already works correctly via the `wasOpenRef` guard).

---

### WR-02: `video` element missing `autoPlay` — first-frame not guaranteed (placeholder.tsx)

**File:** `src/components/marketing/placeholder.tsx:129-135`

**Issue:** When `src` is provided and `variant="video"`, the rendered `<video>`
has `muted` and `playsInline` but no `autoPlay`. Without `autoPlay`, whether
the first frame is decoded and displayed as a poster depends entirely on the
browser: Safari and Chrome usually show it, Firefox sometimes does not, and
mobile browsers may show a blank surface until the user interacts. For a
marketing hero where the video is set-dressing or a screen-recording demo, a
blank black frame is a visible craft regression.

Additionally, there is no `loop` attribute and no `poster` fallback, so when
the video ends it freezes on the last frame (or black) with no controls for the
user.

**Fix:** Add `autoPlay loop` for the showcased-asset use case, and allow a
`poster` prop for the static-fallback image:

```tsx
// In PlaceholderProps interface, add:
poster?: string;

// In the video element:
<video
  src={src}
  className="h-full w-full object-cover"
  muted
  playsInline
  autoPlay
  loop
  poster={poster}
  aria-label={label}
/>
```

---

### WR-03: Footer `<h2>` labels break the page heading outline (footer.tsx)

**File:** `src/components/layout/footer.tsx:70,88,104`

**Issue:** Three `<h2>` elements ("Product", "Legal", "Social") sit inside
`<nav>` elements in the footer. The marketing page already uses `<h2>` for its
section headings ("How it works", "The Simulation", etc.). Screen readers that
build a page outline from headings present the footer's "Product", "Legal",
"Social" `<h2>`s as peers of the main content sections, polluting the outline
with navigation housekeeping. The correct semantic level for footer column
labels that are subordinate to the page structure is `<h3>` (or `aria-labelledby`
pointing to a visually-hidden label).

This does not break WCAG's required success criteria (heading levels are a best
practice, not a SC), but it degrades the screen-reader experience for keyboard
users navigating by heading.

**Fix:**

```tsx
// footer.tsx line 70 — change h2 → h3 for all three column labels
<h3 className="text-sm font-semibold text-foreground">Product</h3>
// … same for Legal (line 88) and Social (line 104)
```

---

## Info

### IN-01: Identical `DriverRowsSkeleton` used in two separate `FeatureBlock` rows (feature-blocks.tsx)

**File:** `src/components/marketing/story/feature-blocks.tsx:62-76`

**Issue:** `FEATURES[1]` ("See exactly where viewers drop") and `FEATURES[3]`
("Fix the weakest lever") both render `<DriverRowsSkeleton className="w-full px-2" />`
with no distinguishing props. The two blocks have different benefit copy but
an identical visual, so at a glance they read as repeated set-dressing rather
than two distinct product facets.

Per stub-lock rules, no live data is expected here — this is a craft observation
for when skeletons are finalized or swapped for real assets.

**Fix (optional):** Introduce a `highlight` prop or a different skeleton for
the fourth block (e.g., a simplified `ScoreGaugeSkeleton` side-by-side, or a
`DriverRowsSkeleton` with `highlight="hook"` coloring). Not a code bug; deferred
until assets are ready.

---

### IN-02: `StaggerReveal.Item` static-prop used downstream (stagger-reveal.tsx)

**File:** `src/components/motion/stagger-reveal.tsx:102`

**Issue:** `StaggerReveal.Item = StaggerRevealItem` is set at line 102 (static
prop assignment). The `how-it-works.tsx` and `feature-blocks.tsx` comments note
this as a known landmine — the static-prop form crashes `next build` for RSC
prerendering, which is why they import `StaggerRevealItem` by name instead.
The static prop assignment on the component itself is still present and will
continue to mislead future contributors who reach for `StaggerReveal.Item`.

**Fix:** Delete the static-prop assignment or add a JSDoc `@deprecated` marker
pointing to the named export:

```ts
// Remove or deprecate:
/** @deprecated Import StaggerRevealItem directly — static props do not survive RSC prerender. */
StaggerReveal.Item = StaggerRevealItem;
```

---

### IN-03: `ScoreGaugeSkeleton` arc math uses module-level `Math.PI` computation (score-gauge-skeleton.tsx)

**File:** `src/components/marketing/story/skeletons/score-gauge-skeleton.tsx:28-33`

**Issue:** `CIRCUMFERENCE`, `ARC_LEN`, and `SWEEP_LEN` are computed at module
load time using `Math.PI`. This is correct and deterministic (no hydration
risk), but the constants are undocumented magic-number chains. A future editor
who changes `R` will need to understand that `ARC_LEN` and `SWEEP_LEN` cascade
from it, which is not obvious from the local constant names. Not a runtime bug.

**Fix:** Add inline comments tying each constant to its geometric meaning:

```ts
const R = 52;                                    // arc radius (px, in the 128×128 viewBox)
const CIRCUMFERENCE = 2 * Math.PI * R;           // full-circle circumference
const ARC_FRACTION = 0.75;                       // 270° / 360° = 3/4 of the circle
const ARC_LEN      = CIRCUMFERENCE * ARC_FRACTION; // visible arc length (track)
const SWEEP_LEN    = ARC_LEN * (SCORE / 100);   // filled portion for the sample score
```

---

_Reviewed: 2026-06-15T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
