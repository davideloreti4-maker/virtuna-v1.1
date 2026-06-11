---
phase: 01-design-system-foundation-brand-migration
reviewed: 2026-06-11T23:15:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - scripts/check-apca.ts
  - src/app/(kit)/numen-kit/page.tsx
  - src/app/(kit)/numen-kit/stage-demo.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/numen/glass.tsx
  - src/components/numen/icon-button.tsx
  - src/components/numen/pill-chip.tsx
  - src/components/numen/stage-reveal.tsx
  - src/components/numen/surface.tsx
  - src/components/numen/verdict-swatch.tsx
  - tests/numen/glass.test.ts
  - tests/numen/primitives.test.ts
  - tests/numen/showcase.a11y.test.tsx
  - tests/numen/stage-reveal.test.ts
  - tests/numen/tokens.test.ts
  - tests/numen/type.test.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: resolved
resolved: 2026-06-11
resolution:
  fixed: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-05]
  deferred: [IN-01, IN-03, IN-04]
  note: >
    Blocker + all 5 warnings fixed in a sequential fix pass (commits
    19ce82e0, 332765ba, 050a3276, 3f1bb60f, d117dc0c). IN-02 folded into the
    WR-05 fix (dead void imports removed). IN-01/IN-03/IN-04 left as-is (info,
    out of scope). Verified: full suite 1944 pass / 0 fail, APCA gate exit 0,
    build compiled + 56 static pages, legacy --color-accent/--color-border are
    the only definitions of those keys.
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-11T23:15:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 01 builds a parallel warm-neutral `.numen-surface` token layer plus six tailwind-variants primitives, a kit showcase route, an APCA contrast gate, and a 24-test suite (all currently green). The motion discipline (calm tween + over-damped spring, reduced-motion degradation), the inline `backdrop-filter` Glass pattern, and the exact-hex dark tokens (D-03) are correctly implemented. The serif voice is wired without leaking onto `<body>`.

The headline problem is a **token-namespace collision that breaks the D-01 "parallel, do not touch legacy" guarantee**: the new `@theme inline` block redefines `--color-accent` and `--color-border` — the SAME Tailwind utility keys the legacy coral app already owns. Because Tailwind v4 merges every `@theme`/`@theme inline` block into one global utility registry (last-wins), the numen redefinitions override `bg-accent`, `text-accent`, and `border-border` site-wide, and they resolve to `var(--numen-*)` which is **undefined outside `.numen-surface`**. That regresses every legacy component using those utilities. The remaining findings are quality/robustness issues in the primitives and tests.

## Critical Issues

### CR-01: Numen `@theme inline` redefines legacy `--color-accent` / `--color-border` — breaks the live coral app (D-01 violation)

**File:** `src/app/globals.css:386,390` (collides with `:80` and `:93`)
**Issue:**
The legacy `@theme` block defines the utility keys:
```css
--color-accent: var(--color-coral-500);   /* line 80  → bg-accent / text-accent */
--color-border: rgba(255,255,255,0.06);    /* line 93  → border-border */
```
The new Numen `@theme inline` block redefines the **same keys**:
```css
--color-accent: var(--numen-accent);   /* line 386 */
--color-border: var(--numen-border);   /* line 390 */
```
Tailwind v4 collapses all `@theme`/`@theme inline` declarations into a single theme registry. Duplicate keys are last-wins, so the Numen definitions win for the WHOLE app. With `inline`, the emitted utility is the literal `var(--numen-accent)` / `var(--numen-border)`. Outside `.numen-surface` those custom properties are **never declared**, so on every legacy page:
- `bg-accent` / `text-accent` → `var(--numen-accent)` → empty → invalid color (coral disappears / falls back to `currentColor`/inherited)
- `border-border` → `var(--numen-border)` → empty → border falls back to `currentColor`

Confirmed legacy consumers of these utilities include `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `select.tsx`, `dropdown-menu.tsx`, `landing/hero-section.tsx`, `sidebar/Sidebar.tsx`, and ~15 more. This directly violates D-01 ("coexists WITHOUT touching it … old pages keep working untouched") and is a live visual regression, not a theoretical one. The test suite does not catch it because `tokens.test.ts` only source-scans the `.numen-surface` block and happy-dom never runs the Tailwind build.

**Fix:** Give the bridged utilities Numen-namespaced keys so they never collide with legacy `--color-accent`/`--color-border`. The components already reference these via their own class names, so rename both the `@theme inline` keys and the primitives' utility classes:
```css
@theme inline {
  --color-numen-bg:            var(--numen-bg);
  --color-numen-panel:         var(--numen-panel);
  --color-numen-panel-2:       var(--numen-panel-2);
  --color-numen-text:          var(--numen-text);
  --color-numen-text-muted:    var(--numen-text-muted);
  --color-numen-accent:        var(--numen-accent);
  --color-numen-verdict-good:  var(--numen-verdict-good);
  --color-numen-verdict-mixed: var(--numen-verdict-mixed);
  --color-numen-verdict-bad:   var(--numen-verdict-bad);
  --color-numen-border:        var(--numen-border);
}
```
Then update primitives + page to `bg-numen-bg`, `text-numen`, `border-numen-border`, `bg-numen-accent`, `bg-numen-verdict-good`, etc. (`--color-bg`/`--color-text`/`--color-panel*`/`--color-verdict-*` happen not to exist in the legacy block today, but they are equally unsafe to claim as bare global keys for a "parallel" layer — namespacing all of them is the only collision-proof option and matches the D-01 intent). Add a regression test that asserts the legacy `--color-accent`/`--color-border` keys are NOT overridden by the numen layer.

## Warnings

### WR-01: PillChip `icon` slot sizes the wrapper span, not the SVG — showcase chips render 24px icons, not 16px

**File:** `src/components/numen/pill-chip.tsx:25,69`
**Issue:** The `icon` slot class `"size-4 shrink-0 text-text-muted"` is applied to the wrapping `<span>`, but `size-4` (`width/height:1rem`) on a span does not constrain a child `<svg>`'s intrinsic size. Lucide icons default to 24px. `text-text-muted` / `text-accent` DO cascade via `currentColor`, but the size does not. In `page.tsx:167-177` the PillChips pass bare `<RefreshCw />` etc. with no size class, so they render at 24px instead of the intended 16px — visually inconsistent with the design intent ("chips read quiet"). Contrast IconButton usages, which explicitly pass `size-5` on each icon.
**Fix:** Target the SVG child from the slot, e.g. `icon: "[&>svg]:size-4 shrink-0 text-text-muted"` (or set `size-4` on the svg directly), so the icon is actually constrained regardless of caller.

### WR-02: Disabled PillChip in `<span>` mode is non-functional and inaccessible

**File:** `src/components/numen/pill-chip.tsx:54,60,64-66`
**Issue:** When `onClick` is omitted the chip renders a `<span>`. If a caller also passes `disabled`, the `disabled` prop is dropped (`disabled={onClick ? disabled : undefined}`) and `<span>` carries no `aria-disabled`, no disabled styling trigger, and the `disabled:opacity-50` utility never activates (spans have no `:disabled`). A "disabled passive chip" silently renders as a normal enabled-looking chip. Also, even in `<button>` mode there is no `aria-disabled` mirror for AT when `disabled` is set. This is a real a11y/state-correctness gap, not style.
**Fix:** Apply `aria-disabled={disabled || undefined}` on both element types and gate the disabled visual via a class, e.g. add `disabled && "opacity-50 pointer-events-none"` through `cn()`, so the disabled state is honored regardless of element.

### WR-03: IconButton hardcodes `type="button"` before spreading props that can also carry `type`

**File:** `src/components/numen/icon-button.tsx:38`
**Issue:** `<button type="button" ... {...props}>` spreads `props` after `type`, so a consumer passing `type="submit"` would silently override the intended default — fine — but the reverse risk is more subtle: `aria-label` is declared required in the interface yet is delivered purely through `{...props}`. There is no runtime/structural guarantee it is present, and nothing prevents `{...props}` from also overriding `className` handling order. The 44px floor is correct, but the only thing making this an accessible control (the label) lives entirely in untyped spread territory. Low-risk but worth hardening since icon-only buttons are an a11y trap.
**Fix:** Destructure `type` and `"aria-label"` explicitly so intent is explicit and the label cannot be accidentally dropped: `function IconButton({ children, className, type = "button", ...props })` and keep `type` after the spread is avoided. Optionally `if (process.env.NODE_ENV !== "production" && !props["aria-label"]) console.warn(...)`.

### WR-04: `useReducedMotion()` returns `null` on first render — the spring path runs once before degrading

**File:** `src/components/numen/stage-reveal.tsx:50,56,65`
**Issue:** `motion`'s `useReducedMotion()` returns `null` (not `false`) until the media query resolves on the client. `reduce ? 0 : 12` treats `null` as falsy → initial render uses `y:12` + spring even for a reduced-motion user, until the hook updates and triggers a re-render. For the SSR/first-paint frame a reduced-motion user can still get the slide. The test mocks the hook to `true` so it never exercises the `null` transitional state. D-14 is a "hard requirement"; the transient slide is a (small) vestibular exposure.
**Fix:** Treat unknown as reduced: `const reduce = useReducedMotion() ?? false;` is insufficient — invert to fail-safe: `const reduce = useReducedMotion() !== false;` so `null` (unknown) and `true` both suppress the translate. Re-render once resolved is acceptable; never show the slide on an unresolved query.

### WR-05: APCA palette is duplicated by hand across `check-apca.ts` and `globals.css` with no enforcement that they match

**File:** `scripts/check-apca.ts:54-61` and `src/app/globals.css:357-365`
**Issue:** The gate hardcodes the six hexes (`#f0ebe3`, `#bab2a5`, `#d98a5e`, `#7faf7a`, `#d6a85a`, `#d4866f`, base `#1a1714`) as string literals that MUST equal the `.numen-surface` declarations. The only thing keeping them in sync is a code comment ("Must match `.numen-surface` in globals.css exactly"). If someone nudges a hue in globals.css and forgets the script, the gate happily passes on stale values — a silent false-green on the exact contrast guarantee the script exists to enforce. The gate is also not wired into `package.json` scripts or `npm test`, so it only runs if someone remembers to invoke `pnpm tsx scripts/check-apca.ts` manually.
**Fix:** Parse the hexes out of `globals.css` (the `tokens.test.ts` `numenSurfaceBlock`/`get()` helpers already do exactly this) and feed them into the gate, so a drift in globals.css is impossible to miss. Add the gate to a `"check:apca"` script and include it in the test/CI gate so it actually runs.

## Info

### IN-01: `--font-serif: var(--font-serif)` in `@theme inline` is a self-referential bridge that only works by next/font side-effect

**File:** `src/app/globals.css:391`
**Issue:** Unlike the other bridged tokens (`--color-bg: var(--numen-bg)` references a distinct scoped name), `--font-serif: var(--font-serif)` references itself. It functions only because `next/font` injects a `:root { --font-serif: '__Source_Serif_4...' }` declaration at runtime, so the emitted `font-family: var(--font-serif)` resolves against that. It works, but it is fragile and confusing — if the font wiring is ever renamed (it deliberately is NOT the `serif.variable` name here), the `font-serif` utility silently produces an empty family.
**Fix:** Either drop this line (Tailwind v4 already exposes `font-serif` from a `--font-serif` `:root` var without a bridge) or add a comment clarifying the indirection is a next/font side-effect, not a scoped override like the colors.

### IN-02: `void APCAcontrast; void sRGBtoY;` keep-alive is dead-code ceremony

**File:** `scripts/check-apca.ts:27-32`
**Issue:** The two imports are imported then immediately `void`-ed solely to "not be tree-shaken," but this is a directly-run tsx script with no bundler/tree-shaking pass — nothing would remove them, and they are never called. It is dead ceremony that reads as if the primitives are used when they are not. `calcAPCA` is the only function actually used.
**Fix:** Remove the unused `APCAcontrast`/`sRGBtoY` imports and the `void` statements; import only `calcAPCA`.

### IN-03: Showcase serif specimen ships two near-identical 11-line blocks (copy-paste)

**File:** `src/app/(kit)/numen-kit/page.tsx:217-261`
**Issue:** The Source Serif 4 and Newsreader specimen panels duplicate the same two `<p>` greeting/verdict lines with only the `font-serif` class vs `fontFamily` inline-style differing. Same duplication for the two greeting lines inside each. Minor maintainability smell in a showcase file.
**Fix:** Map over `[{label, style}]` pairs and the two specimen sentences to render the four paragraphs from data. Low priority — showcase-only.

### IN-04: vitest alias `"@/"` (trailing slash) is redundant/inconsistent with tsconfig `@/*`

**File:** `vitest.config.ts:6`
**Issue:** The alias key is `"@/"` while tsconfig uses `"@/*": ["./src/*"]`. Vite resolves the numen imports (`@/components/numen/...`) correctly in practice (tests pass), but the trailing-slash form is a non-standard alias key that can shadow more specific aliases or behave differently across Vite versions. The other aliases below it use exact module paths, so the convention is inconsistent.
**Fix:** Use `"@": new URL("./src", import.meta.url).pathname` (no trailing slash) to match the conventional Vite `@`→`src` alias, consistent with tsconfig.

---

_Reviewed: 2026-06-11T23:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
