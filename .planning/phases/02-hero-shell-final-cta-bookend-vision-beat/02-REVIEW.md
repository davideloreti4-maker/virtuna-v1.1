---
phase: 02-hero-shell-final-cta-bookend-vision-beat
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/components/ui/word-rotate.tsx
  - src/components/ui/shimmer-button.tsx
  - src/components/ui/animated-shiny-text.tsx
  - src/components/ui/border-beam.tsx
  - src/components/ui/spotlight.tsx
  - src/app/(marketing)/_components/HeroBookend.tsx
  - src/app/globals.css
  - src/app/(marketing)/_components/VisionBeat.tsx
  - src/app/(marketing)/_components/LandingFooter.tsx
  - src/app/(marketing)/privacy/page.tsx
  - src/app/(marketing)/terms/page.tsx
  - src/app/sitemap.ts
  - src/app/(marketing)/_components/HeroSection.tsx
  - src/app/(marketing)/_components/FinalCtaSection.tsx
  - src/app/(marketing)/v3/page.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 2 implements HeroBookend (shared between HeroSection and FinalCtaSection), VisionBeat, LandingFooter, legal stub pages, sitemap, and the v3 page shell. The accessibility architecture is generally sound — the single-H1 contract, IntersectionObserver gating, and reduced-motion handling are all deliberate and correctly documented.

Three blockers found: a nested-`<h1>` DOM invalidity that screen readers and validators will flag as a real violation, a `<button>` wrapped in an `<a>` which is invalid HTML, and fragment URLs in sitemap.xml that Google Search Console rejects. Four warnings around focus-ring gaps, a misleading icon for TikTok, the WordRotate crash path on empty input, and unnecessary `"use client"` propagation that increases client bundle.

---

## Critical Issues

### CR-01: Nested `<h1>` — WordRotate renders `motion.h1` inside outer `<h1>`

**File:** `src/components/ui/word-rotate.tsx:40` / `src/app/(marketing)/_components/HeroBookend.tsx:140-171`

**Issue:** `WordRotate` unconditionally renders `<motion.h1>` (line 40 of word-rotate.tsx). When `headingAs="h1"` (the default, used by HeroSection), `HeroBookend` renders the outer element as `<h1>` (line 78), then nests `<WordRotate>` inside it — producing `<h1>…<h1>…</h1>…</h1>`. Nested `<h1>` is invalid HTML per the spec; browsers auto-close the inner heading and break DOM structure. Screen readers surface two separate `<h1>` landmarks. The code comment on line 54 acknowledges this as a "known limitation" but that does not make it non-blocking — it is an actual accessibility tree violation that fails WCAG 1.3.1 (Info and Relationships).

**Fix — Option A (minimal):** Change `word-rotate.tsx` to render `<motion.span>` instead of `<motion.h1>`, letting the caller control heading semantics. This is the correct primitive design:

```tsx
// word-rotate.tsx line 40-46 — change h1 → span
<motion.span
  key={words[index]}
  className={cn(className)}
  {...motionProps}
>
  {words[index]}
</motion.span>
```

**Fix — Option B (forward-compatible):** Add an `as` prop to `WordRotate` so callers can choose the rendered element (`"span"` default, `"h1"` for standalone use). Given HeroBookend already passes `headingAs`, a matching `as` prop on WordRotate is the clean extension point.

---

### CR-02: `<button>` inside `<a>` — invalid interactive-element nesting

**File:** `src/app/(marketing)/_components/HeroBookend.tsx:190-213`

**Issue:** The primary CTA wraps `<ShimmerButton>` (which renders `<button>`) inside an `<a href="#demo">`. Interactive elements must not be nested (`<a>` inside `<button>` is forbidden; so is `<button>` inside `<a>`). Per HTML spec § 4.5.1, the `<a>` element has a transparent content model but may not contain interactive content. Browsers handle this inconsistently — Chromium hoists the `<button>` out of the anchor in the DOM, breaking the click handler.

```html
<!-- current — invalid -->
<a href="#demo">
  <ShimmerButton>…</ShimmerButton>   <!-- renders <button> -->
</a>
```

**Fix:** Remove the `<a>` wrapper. Use `ShimmerButton` directly with an `onClick` scroll handler, or render it as an `<a>` by making `ShimmerButton` accept an `as` prop / `asChild` pattern, or replace with a plain `<a>` styled to match:

```tsx
// Option A — asChild via Radix Slot (cleanest)
<ShimmerButton asChild …>
  <a href="#demo">Score your first TikTok</a>
</ShimmerButton>

// Option B — convert to anchor directly
<a
  href="#demo"
  role="button"
  className="… shimmer-button styles …"
>
  Score your first TikTok
</a>
```

---

### CR-03: Fragment URLs in `sitemap.xml` violate sitemap protocol

**File:** `src/app/sitemap.ts:18-26`

**Issue:** `#demo` (line 18) and `#pricing` (line 25) are URL fragments. The [Sitemaps protocol](https://www.sitemaps.org/protocol.html) explicitly states URLs must not contain fragment identifiers. Google Search Console ignores or rejects sitemap entries with `#` in the URL. These entries provide no SEO value and may cause the sitemap to fail validation, degrading the signal for the real entries (`/`, `/privacy`, `/terms`).

**Fix:** Remove the fragment entries entirely. Sitemaps should list only crawlable page URLs:

```ts
// sitemap.ts — remove the #demo and #pricing entries
return [
  { url: `${base}/`,        lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
  { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  { url: `${base}/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
];
```

---

## Warnings

### WR-01: `WordRotate` crashes when `words` is empty

**File:** `src/components/ui/word-rotate.tsx:30,41,45`

**Issue:** `words.length` on line 30 is `0` when `words=[]`, making `(0 + 1) % 0 = NaN`. `words[NaN]` is `undefined`. React will render `undefined` silently in development but `key={undefined}` on `AnimatePresence` children can cause keying bugs. More importantly, the `setInterval` fires every 2.5 s forever with `NaN` index. The component has no guard against empty input.

**Fix:**

```tsx
// word-rotate.tsx — guard at top of component body
if (!words.length) return null;
```

Or at minimum add it to the interval callback:
```tsx
setIndex((prev) => words.length ? (prev + 1) % words.length : 0)
```

---

### WR-02: `HeroSection` and `FinalCtaSection` marked `"use client"` unnecessarily

**File:** `src/app/(marketing)/_components/HeroSection.tsx:1` / `src/app/(marketing)/_components/FinalCtaSection.tsx:1`

**Issue:** Both wrapper components contain zero client-side logic — they are pure JSX wrappers that render `HeroBookend` and `LandingFooter`. Marking them `"use client"` opts their entire subtree out of RSC, forcing the full `HeroBookend` (which legitimately needs `"use client"`) and `LandingFooter` (a pure server component) to be bundled on the client. `LandingFooter` should remain a server component; FinalCtaSection's `"use client"` directive forces it client-side unnecessarily.

**Fix:** Remove `"use client"` from both files. `HeroBookend` is already `"use client"` — the directive does not need to exist on its parent wrapper. RSC will automatically treat the wrapper as server and delegate client rendering to `HeroBookend`.

---

### WR-03: Focus rings missing `outline-offset` on footer nav links and social icons

**File:** `src/app/(marketing)/_components/LandingFooter.tsx:23-27,173-204`

**Issue:** `activeLinkClass` (line 23) applies `focus-visible:outline focus-visible:outline-2` but no `focus-visible:outline-offset-*`. Social icon links (lines 173–204) have the same gap. Without `outline-offset`, the 2px coral outline renders flush against the text/icon, making it hard to see against the dark background. WCAG 2.4.11 (Focus Appearance, AA in WCAG 2.2) requires adequate focus indicator visibility. The HeroBookend secondary CTA (HeroBookend.tsx:218) correctly includes `focus-visible:outline-offset-2` — inconsistency across the same design system.

**Fix:** Add `focus-visible:outline-offset-2` to `activeLinkClass` and to all four social icon `<a>` classNames:

```tsx
const activeLinkClass =
  "text-sm text-foreground-secondary hover:text-foreground transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
```

---

### WR-04: TikTok social link uses `Music` icon — incorrect brand representation

**File:** `src/app/(marketing)/_components/LandingFooter.tsx:2,196`

**Issue:** The TikTok link (`https://www.tiktok.com/@virtuna`) renders the `Music` icon from lucide-react. `Music` is a musical note glyph; it does not represent TikTok's brand. Users will not recognise this as TikTok. Lucide does not include a TikTok logo (it's a trademarked brand icon), so the workaround is an SVG or a specialist icon library.

**Fix options:**
1. Import the TikTok SVG inline (preferred — no new dependency):
```tsx
// Inline SVG TikTok mark
<svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor" aria-hidden="true">
  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.19a8.16 8.16 0 004.77 1.52V7.27a4.85 4.85 0 01-1-.58z"/>
</svg>
```
2. Use `react-icons` `SiTiktok` if already available in the dependency tree.

---

## Info

### IN-01: `sitemap.ts` uses `new Date()` for `lastModified` — always shows current timestamp

**File:** `src/app/sitemap.ts:9`

**Issue:** `const now = new Date()` is evaluated at request time (or at build time for static export). In a static export build, every deploy updates `lastModified` for all pages regardless of actual content change. Search engines may ignore the field or discount it as noise. Not a bug, but degrades SEO signal quality.

**Fix:** Use static ISO dates per page, updated only when content changes:
```ts
{ url: `${base}/`, lastModified: new Date('2026-05-25'), … }
```

---

### IN-02: Double space in Spotlight className

**File:** `src/components/ui/spotlight.tsx:12`

**Issue:** The `cn()` argument contains a double space: `"animate-spotlight pointer-events-none absolute z-[1]  h-[169%] …"`. `cn` (clsx) passes this through as-is; browsers normalise double spaces in HTML attributes so it has no runtime effect. Cosmetic only.

**Fix:** Remove the extra space between `z-[1]` and `h-[169%]`.

---

### IN-03: Privacy and Terms pages — "Coming soon. Last updated: 2026." is legally ambiguous

**File:** `src/app/(marketing)/privacy/page.tsx:19` / `src/app/(marketing)/terms/page.tsx:19`

**Issue:** Displaying canonical URLs for `/privacy` and `/terms` in the sitemap and footer while the pages show "Coming soon" content may be considered misleading in GDPR/CCPA jurisdictions (EU, California). GDPR Art. 13/14 requires a privacy notice to be available before or at the point of data collection. If the landing page collects any data (analytics, sign-up waitlist), absent privacy policy content is a compliance risk.

**Fix:** Before collecting any user data (even analytics), replace stub copy with minimal but complete privacy and terms content, or remove the links and sitemap entries until the documents are drafted.

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
