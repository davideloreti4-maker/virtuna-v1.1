---
phase: 03-above-fold-credibility-hook
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/app/(marketing)/_components/CredibilityHook.tsx
  - src/app/(marketing)/_components/FinalCtaSection.tsx
  - src/app/(marketing)/_components/HeroBookend.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files implement the above-fold credibility hook (HERO-10), the HeroBookend shared layout, and the FinalCtaSection mirror. The architecture is sound — server/client split is correctly applied, the `showCredibilityHook` guard properly prevents duplication in FinalCtaSection, and accessibility props on the heading are correct.

Four warnings surfaced, none causing outright failure today, but two are latent bugs that will manifest under real user conditions (IntersectionObserver on SSR, `focus-visible:outline-2` missing color on CredibilityHook links). Three info items cover placeholder copy shipped to production, a border-consistency deviation from the Raycast spec, and a microcopy semantic element choice.

---

## Warnings

### WR-01: IntersectionObserver fires before `ref.current` is attached on SSR hydration mismatch path

**File:** `src/app/(marketing)/_components/HeroBookend.tsx:73-83`

**Issue:** `HeroBookend` is a `"use client"` component. `useState(false)` means `inView` starts `false`, and `WordRotate` renders the static fallback `<span>creators</span>` on first paint. This is intentional for SSR/hydration consistency. However, `useEffect` sets up the `IntersectionObserver` and immediately calls `setInView(e.isIntersecting)` on the first callback. If the hero section is already in the viewport on mount (normal for a landing page hero), React will re-render, swapping from `<span>creators</span>` to `<WordRotate>`. This causes a noticeable flash/swap on every page load on fast devices where hydration completes while the element is in view. The `inView` gate was designed to pause the rotator when off-screen, not to suppress it on the initial render. The initial `useState(true)` would be more correct for the hero (always starts in view), with the observer only used to pause/resume. Currently the hero always loads with a blank → static word → animated word flash sequence.

**Fix:**
```tsx
// Initialize inView to true for the hero — it always starts visible.
// The observer then handles the pause-when-off-screen concern only.
const [inView, setInView] = useState(true);
```

If the FinalCtaSection instance (reducedHeight) must start paused, add a separate `initialInView` prop or check `reducedHeight`. But for the default hero usage, `true` is the correct initial value.

---

### WR-02: `focus-visible:outline-2` missing explicit outline color on CredibilityHook links (Tailwind v4)

**File:** `src/app/(marketing)/_components/CredibilityHook.tsx:37` and `:103`

**Issue:** Both Numen Machines anchor tags apply `focus-visible:outline-2` as a Tailwind class but rely on `outlineColor` set via inline `style={}`. In Tailwind v4, `outline-2` sets `outline-width: 2px` but does NOT carry over the color from the inline style — outline color defaults to the current text color (near-white) rather than coral. The inline `style={{ outlineColor: "rgba(255,127,80,0.6)" }}` is ignored by Tailwind's `outline-*` utilities because Tailwind v4 uses `outline-color` as a separate property not bridged from inline styles to utility-applied styles. The result: focused links display a white 2px outline instead of the intended coral outline, breaking the brand focus ring.

Additionally, `focus-visible:outline-2` without `focus-visible:outline` (which sets `outline-style: solid`) produces `outline-width: 2px` but no visible outline in some browsers that require `outline-style` to be explicit when `outline-width` alone is specified.

**Fix:**
```tsx
className="... focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(255,127,80,0.6)]"
// Remove outlineColor from inline style — move fully to Tailwind utility
style={{
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderLeftColor: "rgba(255,127,80,0.4)",
  borderLeftWidth: "2px",
  // outlineColor removed — handled by Tailwind class above
}}
```

---

### WR-03: `WordRotate` key collision when `words` array contains duplicates

**File:** `src/app/(marketing)/_components/HeroBookend.tsx:153-166` (consuming `word-rotate.tsx:43`)

**Issue:** `WordRotate` uses `words[index]` as the `AnimatePresence` `key`. The current word list `["creators", "brands", "founders"]` has no duplicates, so this is safe today. However, if words are ever updated and a word appears twice in the list, `AnimatePresence` will not trigger the exit/enter animation cycle when the index transitions between the two identical entries because the key does not change. The bug would silently produce a stuck animation. The correct key is the index, not the word string.

This is a bug in the imported primitive (`word-rotate.tsx:43`), but `HeroBookend` is the direct consumer and owns the `words` array definition.

**Fix (in `word-rotate.tsx`):**
```tsx
// Line 43: use index as key, not the word value
<motion.span
  key={index}   // was: key={words[index]}
  ...
```

---

### WR-04: `section` landmark in `CredibilityHook` creates nested landmark inside `HeroBookend`'s non-landmark `div`

**File:** `src/app/(marketing)/_components/CredibilityHook.tsx:19`

**Issue:** `CredibilityHook` wraps its content in `<section aria-label="Backed by">`. `HeroBookend` renders this inside a plain `<div>`, which in turn lives inside the `<section id="final-cta" aria-label="Final CTA section">` (in `FinalCtaSection`) or an unnamed container (in HeroSection). A named `<section>` creates an ARIA `region` landmark. For HeroSection usage the landmark tree is: `[page regions] → region("Backed by")` which is acceptable. However, the `CredibilityHook` component is reused inside `HeroBookend` which is itself used inside `<section id="final-cta">` — so the tree becomes: `region("Final CTA section") → region("Backed by")`. Nested named regions are valid but can create noise in screen-reader landmark navigation. More critically, when `showCredibilityHook={false}`, the `<section>` is not rendered (the whole component is gated), so this is contained. The actual defect: the `section` element chosen for what is visually a `div`-level sub-component adds landmark weight without a clear structural need. Using a `<div>` with `role="group"` and `aria-label="Backed by"` would provide the accessible name without creating a navigable landmark region.

**Fix:**
```tsx
// CredibilityHook.tsx line 19 — demote from region landmark to group
<div role="group" aria-label="Backed by" className="w-full">
```

---

## Info

### IN-01: Placeholder "Partner" text will ship to production as visible content

**File:** `src/app/(marketing)/_components/CredibilityHook.tsx:55-72` and `:120-137`

**Issue:** Four desktop placeholder slots and two mobile placeholder slots render visible text "Partner" with `opacity: 0.5`. These slots are `aria-hidden="true"` so screen readers skip them, but sighted users on desktop will see four "Partner" labels in the credibility bar. This reads as unfinished scaffolding. If this is intentional pre-launch state, it should be documented in a `// PLACEHOLDER: remove before launch` comment. If it is not intentional, the slots should either be hidden (`invisible` class or `opacity: 0`) or removed.

**Fix:** Add comment or hide until real partner logos are ready:
```tsx
// PLACEHOLDER: swap with real partner logo before launch
<div aria-hidden="true" className="invisible ...">
```

---

### IN-02: Separator line uses inline `style` instead of Tailwind utility, deviating from Raycast border spec

**File:** `src/app/(marketing)/_components/CredibilityHook.tsx:22-25`

**Issue:** The 1px separator uses `style={{ background: "rgba(255,255,255,0.06)" }}`. The CLAUDE.md Raycast design rules specify `white/[0.06]` as the universal border token. Using `background` on an `h-px` div is a workaround — the correct approach per the design system is `bg-white/[0.06]` Tailwind class, which is directly available in Tailwind v4. The inline style makes this harder to update via design token changes and is inconsistent with how borders are handled elsewhere.

**Fix:**
```tsx
<div
  className="w-full h-px mb-4 bg-white/[0.06]"
  aria-hidden="true"
/>
// Remove style prop entirely
```

---

### IN-03: Microcopy `<p>` tag used for what is semantically a `<span>` inside a flex row

**File:** `src/app/(marketing)/_components/CredibilityHook.tsx:75-83`

**Issue:** The desktop microcopy element is a `<p>` tag sitting inline inside a flex row alongside `<a>` and `<div>` siblings. A `<p>` tag introduces paragraph semantics and implicit block layout that is overridden by the parent flex container. Using `<p>` for inline label text adjacent to logo chips is semantically imprecise — `<span>` with `role="note"` or simply a `<span>` would be cleaner. This is a minor semantic issue with no functional impact.

**Fix:**
```tsx
<span
  className="ml-4 text-xs text-foreground-muted"
  style={{ letterSpacing: "0.2px" }}
>
  Backed by behavioral research{" "}
  <span aria-hidden="true">·</span>{" "}
  <span className="font-medium">Numen Machines</span>
</span>
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
