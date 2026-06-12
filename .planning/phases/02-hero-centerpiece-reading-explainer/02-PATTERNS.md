# Phase 2: Hero Centerpiece & Reading Explainer - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 9 net-new (4 components + 5 tests) + 1 asset + 2 integration edits
**Analogs found:** 9 / 9 (every net-new file has an in-repo analog; zero new primitives, zero installs)

> All net-new components live under `src/components/numen-landing/` and MUST render inside the
> `.numen-surface` wrapper (mounted once in `(marketing)/layout.tsx` line 31). Any `bg-bg`/`text-text`/
> `bg-verdict-good` element outside that wrapper renders transparent. Consume primitives, never fork (DS-01).

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/components/numen-landing/hero.tsx` | component (client) | transform (props → static markup) | `src/components/numen-landing/nav.tsx` (client, CTA, FOCUS_RING, token scope) + `(marketing)/page.tsx` hero block (H1/subhead/CTA layout) | exact (role) + exact (CTA pattern) |
| `src/components/numen-landing/reading-loop.tsx` | component (client) | event-driven (timer → `show` state) | `src/components/numen/stage-reveal.tsx` (StageBlock API + reduced-motion) + `nav.tsx` (client `useEffect`/`useState` lifecycle) | exact (motion source) |
| `src/components/numen-landing/verdict-throne.tsx` | component (presentational) | request-response (props → band markup) | `src/components/numen/verdict-swatch.tsx` (band base, literal `tv` classes, APCA) | exact |
| `src/components/numen-landing/how-it-works.tsx` | component (RSC unless D-06) | transform (static 3-card grid) | `src/components/numen/surface.tsx` (card container) + `footer.tsx` (server, repeated-row grid, token scope) | role-match (no existing 3-card grid in repo — `footer.tsx` is the closest multi-column static layout) |
| `src/components/numen-landing/__tests__/hero.test.tsx` | test | — | `tests/numen/stage-reveal.test.ts` (happy-dom render) + `tests/numen/primitives.test.ts` (dynamic import) | role-match (no existing component *render* test renders real JSX with copy assertions — adapt the render harness) |
| `src/components/numen-landing/__tests__/reading-loop.test.tsx` | test | — | `tests/numen/stage-reveal.test.ts` (mock `useReducedMotion=>true`) | exact (reduced-motion mock pattern) |
| `src/components/numen-landing/__tests__/verdict-throne.test.tsx` | test | — | `tests/numen/primitives.test.ts` verdict-swatch block | role-match |
| `src/components/numen-landing/__tests__/how-it-works.test.tsx` | test | — | `tests/numen/stage-reveal.test.ts` render harness | role-match |
| `src/components/numen-landing/__tests__/voice.test.tsx` | test (string scan) | — | `tests/numen/stage-reveal.test.ts` 2nd `it` (source-string forbidden-token scan) | role-match |
| `public/images/landing/hero/keyframe.{webp\|jpg}` | asset | static | (none — content task, no code analog) | no analog |
| `src/app/(marketing)/page.tsx` (MODIFY) | route | — | itself — existing hero block + slot wiring | exact (in-place) |
| `scripts/check-apca.ts` (EXTEND) | config/script | — | itself (add a label-on-`#7faf7a` pairing) | exact (in-place) |

---

## Pattern Assignments

### `src/components/numen-landing/hero.tsx` (client component, transform)

**Analog:** `src/components/numen-landing/nav.tsx` (CTA + FOCUS_RING + client directive) and the existing hero block in `src/app/(marketing)/page.tsx` lines 24-42 (H1/subhead/CTA stack — this is the literal markup the hero EXTRACTS into a component).

**`"use client"` + import convention** (from `nav.tsx` lines 1-9; `motion`-using children force the boundary):
```tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
// import { ReadingLoop } from "@/components/numen-landing/reading-loop";
```

**FOCUS_RING constant — COPY VERBATIM** (identical string in `nav.tsx:30-31`, `footer.tsx:15-16`, `page.tsx:17-18`):
```tsx
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
```

**H1 + subhead + CTA column — the exact current markup to lift** (`page.tsx:24-42`; H1 keeps the locked type scale; CTA `h-11` not `h-10` for the hero per UI-SPEC ≥44px). NOTE the text column today is `max-w-3xl`; UI-SPEC §Container says hero text stays in the `max-w-6xl` gutter while the artifact is the full-bleed exception:
```tsx
<div className="mx-auto flex max-w-3xl flex-col gap-6">
  <h1 className="text-text text-4xl md:text-6xl font-bold tracking-tight">
    Know if your content will land — before you post.
  </h1>
  <p className="text-base md:text-lg leading-relaxed text-text-muted">
    Numen reads your video like your sharpest audience would and gives
    you an honest verdict you can act on.
  </p>
  <div>
    <Link
      href="#cta"
      className={`inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-bg transition-opacity hover:opacity-90 ${FOCUS_RING}`}
    >
      Try Numen
    </Link>
  </div>
</div>
```
> **CTA label "Try Numen" is LOCKED** — must match `nav.tsx:117` and `footer.tsx:84` exactly. `href="#cta"` (anchor jump; slot exists at `page.tsx:57`). Do NOT deep-link `/analyze`. `scroll-mt-20 md:scroll-mt-24` is carried by `SectionShell` on the `#cta` slot, so the jump clears the sticky nav.

**Single-h1 rule:** the hero passes NO `heading=` to `SectionShell` and renders its own `<h1>`. Verdict label / step titles are NOT `<h1>`. (`page.tsx:23-24` comment + `section-shell.tsx:39-43`.)

---

### `src/components/numen-landing/reading-loop.tsx` (client component, event-driven)

**Analog:** `src/components/numen/stage-reveal.tsx` (the `StageBlock` it drives — read in full) + `nav.tsx:33-59` (client `useState`/`useEffect`/cleanup lifecycle pattern).

**`StageBlock` API — `{ show, children }` ONLY, no internal sequencing** (`stage-reveal.tsx:33-49`). The loop is a separate controller toggling `show`:
```tsx
export interface StageBlockProps {
  show: boolean;          // true = present + reveals; false = animates out
  children: React.ReactNode;
}
export function StageBlock({ show, children }: StageBlockProps) { /* AnimatePresence + motion.div */ }
```

**Import the motion source + StageBlock** (mirror `stage-reveal.tsx:28` import path — `motion/react`, never `framer-motion`, D-10):
```tsx
"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { StageBlock } from "@/components/numen/stage-reveal";
```

**Reduced-motion controller pattern (HARD — HERO-04 / D-14).** `StageBlock` already zeroes translate under reduced motion (`stage-reveal.tsx:56,65-67`), BUT the loop controller is separate code and must ALSO not auto-cycle: initialise `revealed` to the full count and `return` before starting the interval. The cleanup `return () => clearInterval(id)` mirrors `nav.tsx:50-51`/`58`:
```tsx
const reduce = useReducedMotion();
const [revealed, setRevealed] = useState(reduce ? STAGES.length : 0);

useEffect(() => {
  if (reduce) return;                 // HARD: no interval, end-state painted directly
  let i = 0;
  const id = setInterval(() => {
    i = i + 1;
    if (i > STAGES.length) i = 0;     // reset → calm replay
    setRevealed(i);
  }, STEP_MS);                        // dwell longer on the verdict stage (≥ ~4s)
  return () => clearInterval(id);     // cleanup — mirrors nav.tsx unmount discipline
}, [reduce]);

return STAGES.map((stage, idx) => (
  <StageBlock key={idx} show={reduce ? true : idx < revealed}>
    {/* last stage renders <VerdictThrone /> */}
  </StageBlock>
));
```
> Cadence / dwell / pause-on-verdict are Claude's discretion but MUST stay calm — no bounce, no flashing, no rapid cycling (UI-SPEC §Hero Interaction). The forbidden bouncy easing `cubic-bezier(0.34, 1.56, 0.64, 1)` must never appear (gated by `stage-reveal.test.ts:41-48`).

---

### `src/components/numen-landing/verdict-throne.tsx` (presentational, request-response)

**Analog:** `src/components/numen/verdict-swatch.tsx` (read in full — the band base) + `surface.tsx` (the solid plate, if legibility backing is needed).

**`VerdictSwatch` props** (`verdict-swatch.tsx:40-57`): `verdict: "good"|"mixed"|"bad"`, `size: "sm"|"md"|"lg"`, optional `children` (on-swatch text MUST meet APCA Lc ≥ 60), `className`. The hero throne uses `verdict="good"` (D-03 confident band):
```tsx
import { VerdictSwatch } from "@/components/numen/verdict-swatch";
```

**LITERAL verdict classes only — NEVER `bg-${verdict}`** (`verdict-swatch.tsx:8-13,21-36`). The band colors are encoded as `tv` literal strings (`good: "bg-verdict-good"` etc.) precisely so Tailwind v4 can see them. Do NOT re-introduce interpolation; reuse `VerdictSwatch`:
```tsx
verdict: {
  good: "bg-verdict-good",   // literal — greppable
  mixed: "bg-verdict-mixed",
  bad: "bg-verdict-bad",
},
```

**Throne composition — band + bold label + muted why on a SOLID plate** (RESEARCH Pattern 3; plate = `Surface`/`bg-panel`, NOT glass-over-photo — Lightning CSS strips `backdrop-filter`). Token names only, no hex in JSX:
```tsx
<div className="rounded-[12px] border border-border bg-panel p-4 md:p-6">
  <span className="inline-flex items-center gap-2">
    <VerdictSwatch verdict="good" size="md" />
    <span className="text-sm md:text-base font-bold text-text">This will likely land.</span>
  </span>
  <p className="mt-2 text-sm md:text-base leading-relaxed text-text-muted">
    Strong hook in the first 2 seconds — tighten the middle and it lands.
  </p>
</div>
```
> **NO naked number** — never render `/100` or `%` (VOICE Rule 3; the app's own `verdict-bands.ts` demotes the score). Verdict = band + why. The app's data-shape labels are "High potential / Solid contender / Needs work" — the landing renders the GOOD band in landing voice ("This will likely land."), a deliberate voice rendering, NOT the raw app label.

---

### `src/components/numen-landing/how-it-works.tsx` (RSC unless D-06 clickable, transform)

**Analog:** `src/components/numen/surface.tsx` (card container — read in full) + `footer.tsx` (closest existing static multi-column/repeated-row layout; server component, token scope, no client state). **No existing 3-feature-card grid exists in the repo** — compose `Surface` cards in a Tailwind grid.

**`Surface` API** (`surface.tsx:24-45`): `children`, `className` (merged last, overrides win), `style`, `as: "div"|"section"|"article"|"aside"`. Base already carries `rounded-[12px] border border-border bg-panel` + soft shadow — do NOT re-declare those:
```tsx
import { Surface } from "@/components/numen/surface";
```

**3-step grid** (RESEARCH Code Examples + UI-SPEC §3-Step contract — mobile stack `gap-6`, desktop `md:grid-cols-3 gap-8`, inner `p-4 md:p-6`). Step titles are `<h3>` (under the `#how-it-works` `<h2>` from `SectionShell`, no level skip). Each step shows REAL content (keyframe / stage-read excerpt / band+why), NOT icon-only (READ-02):
```tsx
<div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
  <Surface className="p-4 md:p-6">
    <h3 className="text-base md:text-lg font-medium text-text">Upload</h3>
    <p className="mt-2 text-base leading-relaxed text-text-muted">
      Drop in your video — that&apos;s all it needs.
    </p>
    {/* real keyframe thumbnail */}
  </Surface>
  {/* step 2 "Numen reads it" (real stage-read excerpt) + step 3 "Your verdict" (<VerdictThrone> reuse) */}
</div>
```
> Step 3 reuses the SAME `VerdictThrone` / `bg-verdict-good` band + why (one verdict-good use in hero, one here). If D-06 clickable-to-hero is shipped: wrap each card in a real interactive element (`<Link href="#hero">` style of `nav.tsx`) with the shared `FOCUS_RING`, ≥44px, hover `hover:bg-panel-2` ONLY (no translate-y, no border change) — and the component then needs `"use client"` is NOT required for an anchor link. Default is static RSC.

---

### Test files — `src/components/numen-landing/__tests__/*.test.tsx`

**Reduced-motion mock (COPY VERBATIM for `reading-loop.test.tsx`)** — `tests/numen/stage-reveal.test.ts:1,18-24`:
```ts
/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => true };
});
```
> `reading-loop.test.tsx` asserts: under the mock, end-state renders (all stages `show`), NO `setInterval` cycling, NO non-zero translate (HERO-04). Mirror the translate-scan loop in `stage-reveal.test.ts:33-39`.

**Render harness (for `hero` / `verdict-throne` / `how-it-works` tests)** — `tests/numen/stage-reveal.test.ts:28-32` shows the `render` + `getByText` pattern (uses `createElement`; new tests can use JSX directly since files are `.tsx`):
```tsx
const { getByText, container } = render(<VerdictThrone />);
expect(getByText("This will likely land.")).toBeTruthy();
// HERO-03: assert NO naked number rendered
expect(container.textContent).not.toMatch(/\d+\s*\/\s*100|\d+\s*%/);
```

**Forbidden-token source scan (for `voice.test.tsx`)** — model on `stage-reveal.test.ts:41-48` (the banned-string scan), but assert on the RENDERED `container.textContent` of the hero/explainer components against the VOICE.md ban list (`%`, "viral", "% accuracy", "guaranteed", engine terms "Apollo"/"fold"/"Omni"/"model"/"pipeline"):
```ts
const banned = [/%/, /viral/i, /guaranteed/i, /\bApollo\b/, /\bfold\b/, /\bOmni\b/, /\bpipeline\b/];
for (const re of banned) expect(container.textContent).not.toMatch(re);
```

**Dynamic-import variant (for `verdict-throne.test.tsx` if asserting the `tv` contract)** — `tests/numen/primitives.test.ts:44-58` shows the verdict-swatch import + variant-distinctness assertion.

**Vitest config:** `pnpm test` (alias `vitest run`); include globs cover both `src/**/*.test.tsx` and `tests/**`. Per-file `@vitest-environment happy-dom` pragma required for render tests (line 1 of each).

---

### `src/app/(marketing)/page.tsx` (MODIFY — fill 2 slots)

**Pattern (in-place):** replace the inline hero markup (`page.tsx:24-42`) with `<Hero />` inside the `#hero` `SectionShell` (keep `className="pt-28 pb-24 md:pt-40 md:pb-32"`, keep NO `heading=`). Fill the currently-empty `#how-it-works` slot (`page.tsx:45`) with `<HowItWorks />` as `children` while KEEPING `heading="How the Reading works"`:
```tsx
<SectionShell id="hero" className="pt-28 pb-24 md:pt-40 md:pb-32">
  <Hero />
</SectionShell>

<SectionShell id="how-it-works" heading="How the Reading works">
  <HowItWorks />
</SectionShell>
```

---

### `scripts/check-apca.ts` (EXTEND — Open Q2)

**Pattern (in-place):** the gate measures every pairing on `BASE = "#1a1714"` (`check-apca.ts:39,54-61`). The existing `verdict-good` row measures the band color vs BASE at Lc ≥ 45 — it does NOT measure the on-band LABEL. Add ONE pairing measuring the chosen label color on the band `#7faf7a` at target Lc ≥ 60; if it fails, the throne uses the `bg-panel` plate (UI-SPEC-sanctioned) so the label sits on the plate, not the band. Add to the `PAIRINGS` array following the existing shape:
```ts
// existing locked rows (check-apca.ts:54-61) — do not change hexes
{ label: "verdict-good", text: "#7faf7a", target: 45, role: "verdict band label (large/heavy)" },
```

---

## Shared Patterns

### FOCUS_RING (interactive elements)
**Source:** `nav.tsx:30-31` (identical in `footer.tsx:15-16`, `page.tsx:17-18`)
**Apply to:** hero CTA, any clickable explainer step
```tsx
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
```

### Primary CTA button (locked label + style)
**Source:** `nav.tsx:110-118` (`h-10`) / `footer.tsx:80-85` / `page.tsx:34-39` (`h-11`)
**Apply to:** hero CTA (use `h-11`/`min-h-11` for ≥44px in the hero)
```tsx
<Link href="#cta"
  className={`inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-bg transition-opacity hover:opacity-90 ${FOCUS_RING}`}>
  Try Numen
</Link>
```
> Label "Try Numen" + `href="#cta"` are LOCKED across nav/footer/hero. `bg-accent` (clay) is reserved for the CTA fill + focus ring ONLY — never on H1, verdict band, or borders.

### Token scope + `cn()` merge discipline
**Source:** `layout.tsx:31` (`.numen-surface` wrapper) + `surface.tsx:41` / `verdict-swatch.tsx:53` / `section-shell.tsx:36` (`cn(base(), className)` — caller override wins)
**Apply to:** every net-new component
```tsx
import { cn } from "@/lib/utils";
// className merged LAST so caller layout overrides win
<Component className={cn(base(), className)} />
```
> All color by bridged token NAME (`bg-bg`, `text-text`, `text-text-muted`, `border-border`, `bg-panel`, `bg-accent`, `bg-verdict-good`) — NEVER hardcode hex in JSX (Phase-4 swap depends on it). Tokens resolve only under `.numen-surface` (`globals.css:380-388`, `@theme inline`).

### `tailwind-variants` (`tv`) for any variant component
**Source:** `verdict-swatch.tsx:21-36`, `surface.tsx:20-22`
**Apply to:** verdict-throne (reuse `VerdictSwatch`), any new variant surface
> Literal class strings only — Tailwind v4 cannot see runtime-built strings. This is the `bg-${verdict}` anti-pattern the whole kit is built to avoid.

### Reduced-motion gate
**Source:** `stage-reveal.tsx:50,56,65-67` (component) + `stage-reveal.test.ts:18-24` (test mock)
**Apply to:** `reading-loop.tsx` + its test
> `useReducedMotion()` from `motion/react`. Component zeroes translate; CONTROLLER must additionally not auto-cycle and paint the end-state.

---

## No Analog Found

| File | Role | Data Flow | Reason / Guidance |
|------|------|-----------|-------------------|
| `public/images/landing/hero/keyframe.{webp\|jpg}` | asset | static | No code analog — a real creator-video still is a CONTENT task. Gate behind a `checkpoint:human-verify` (rights-clear real still; NO stock, NO fake chrome). Static-import via `next/image` with `preload` (Next 16.1.5 — NOT deprecated `priority`), `placeholder="blur"`, auto dims → zero CLS. |
| 3-feature-card grid (within `how-it-works.tsx`) | layout | — | No existing 3-card/feature-grid component in the repo. `footer.tsx` is the closest static multi-column layout; compose `Surface` cards in `md:grid-cols-3` per RESEARCH Code Examples. |
| Component *render* test asserting copy | test | — | No existing test renders real component JSX with copy/no-number assertions. `stage-reveal.test.ts` render harness (`render` + `getByText` + `container.querySelectorAll`) is the closest; extend it for copy + `not.toMatch(/\d+\s*%/)` assertions. |
| Reading/verdict data fixture | fixture | — | `src/test/fixtures/{stage-events,completed-prediction}.ts` are ENGINE/SSE-shaped (numeric `overall_score: 0.72`, score weights) — NOT the band+why Reading shape. Mirror only the verdict *band* shape from the app's `~/virtuna-numen-surface/src/lib/reading/verdict-bands.ts` (`high/solid/needs-work`), rendered in landing voice. Do NOT import the engine fixtures into landing components. |

---

## Metadata

**Analog search scope:** `src/components/numen-landing/`, `src/components/numen/`, `src/app/(marketing)/`, `tests/numen/`, `src/test/fixtures/`, `scripts/`, `src/app/globals.css`
**Files scanned (read in full):** `stage-reveal.tsx`, `verdict-swatch.tsx`, `surface.tsx`, `section-shell.tsx`, `nav.tsx`, `footer.tsx`, `(marketing)/page.tsx`, `(marketing)/layout.tsx`, `tests/numen/stage-reveal.test.ts`, `tests/numen/primitives.test.ts`, `scripts/check-apca.ts`, `globals.css` (token-bridge grep)
**Key invariants confirmed:** literal verdict classes (`bg-verdict-good`, never interpolated); `motion/react` import path; `.numen-surface` token scope is load-bearing; `FOCUS_RING` + "Try Numen"/`#cta` CTA locked; single `<h1>` (hero, no `heading=`); APCA gate measures band-on-base (Lc ≥ 45), needs label-on-band extension (Lc ≥ 60).
**Pattern extraction date:** 2026-06-12
