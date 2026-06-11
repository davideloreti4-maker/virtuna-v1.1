# Phase 1: Foundation, Shell & Voice Baseline - Research

**Researched:** 2026-06-11
**Domain:** Next.js 16 App Router scaffold consuming an in-fork `.numen-surface` Tailwind v4 design system
**Confidence:** HIGH (every claim verified against the actual files in this worktree)

## Summary

Phase 1 rebuilds the existing `(marketing)` route in place to mount a clean Numen landing shell (nav + footer + ordered semantic section slots) under the already-built `.numen-surface` token scope, authors `.planning/VOICE.md` + applies in-voice placeholder copy, and ships baseline SEO metadata. All primitives, the logo, and the token bridge already exist and are importable — this is assembly + authoring work, not net-new design-system work.

**The one real landmine:** there are TWO layouts rendering `<html>`/`<body>` — the root `src/app/layout.tsx` AND `src/app/(marketing)/layout.tsx`. Next.js App Router permits exactly one root layout with `<html>`/`<body>` (verified via Context7/official docs). The marketing layout's `<html><body>` is invalid nesting. The phase MUST resolve this: collapse the marketing layout to a no-html passthrough that mounts the `.numen-surface` scope on a wrapper `<div>` (RESOLVED to Option B — the root `<body>` stays scope-free). Do NOT add a second `<html>`. This decision is load-bearing for D-02/D-09 and is the planner's first task.

**Primary recommendation (RESOLVED — Option B):** Make `(marketing)/layout.tsx` a non-html passthrough that wraps children in a `<div className="numen-surface min-h-screen bg-bg text-text">` containing the Numen nav/footer shell. The root `src/app/layout.tsx` `<body>` stays scope-free (NOT given `.numen-surface`), keeping the scope marketing-scoped per locked D-02 and leaving sibling routes untouched. No surface in this repo currently mounts `.numen-surface` — Phase 1 is its first real consumer, so verify rendered token resolution on a live dev server (success criterion #1).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route + `<html>`/`<body>` + global metadata | Frontend Server (root layout) | — | Next 16 requires exactly ONE root layout owning html/body; metadata API renders server-side |
| `.numen-surface` token scope mount | Frontend Server (body class) | — | Token CSS vars cascade from the body element class; must be in server-rendered HTML |
| Nav shell (anchor links + CTA) | Browser/Client | Frontend Server | Mobile menu needs `useState`/effects → `"use client"`; desktop links are static |
| Footer shell | Frontend Server | — | Static, no interactivity → server component |
| Section slots (semantic `<section id>` + rhythm) | Frontend Server | — | Pure markup + spacing; no client JS in Phase 1 (MOT-02 = rhythm only, not animation) |
| SEO metadata (title/description) | Frontend Server | — | `export const metadata` resolved at build/request |
| VOICE.md | N/A (planning doc) | — | Authored content under `.planning/`, not code |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New landing owns `/` by rebuilding `(marketing)/layout.tsx` + `page.tsx` IN PLACE. No new route group / sandbox path.
- **D-02:** New `(marketing)` layout mounts under `.numen-surface` (`<body className="numen-surface ...">` — see D-09); replaces the stale "Artificial Societies" metadata.
- **D-03:** New shell components live in a clean new dir `src/components/numen-landing/` (`nav.tsx`, `footer.tsx`, `section-shell.tsx`). Avoid colliding with stale `src/components/landing/*`.
- **D-04:** Orphan (stop importing) the stale `src/components/landing/*` + `src/components/layout/header.tsx` + `footer.tsx` — DO NOT delete this phase (flag for Phase 4). Dev/showcase routes (`showcase`, `primitives-showcase`, `pricing`, `board-preview`, `coming-soon`, `viral-score-test`, `viz-test`) stay UNTOUCHED.
- **D-05:** Top nav = `NumenLogo` (left) + inline anchor links (How it works · Honesty · Gallery) + primary CTA button (right). Anchors target section-slot `id`s.
- **D-06:** Mobile = logo + CTA inline; anchor links collapse to hamburger. Build clean Numen version; stale `layout/header.tsx` slide-down/overlay/outside-click/body-scroll-lock is a reference pattern only.
- **D-07:** Footer = `NumenLogo` + one-line positioning copy (in voice) + anchor repeat + legal placeholders (Privacy/Terms placeholder links) + social (X, LinkedIn) + footer CTA SLOT + copyright. Minimal. Live CTA wiring is Phase 2-3.
- **D-08 / D-08a:** Codify voice as (1) durable `.planning/VOICE.md` + (2) applied placeholder copy. Hero H1 seed ≈ "Know if your content will land — before you post."; subhead seed ≈ "Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on." No numbers, no jargon.
- **D-09:** Consume the EXISTING `src/app/globals.css` `.numen-surface` scope as placeholder tokens. Use bridged Tailwind tokens (`bg-bg`, `text-text`, `text-text-muted`, `bg-panel`, `border-border`, accent/verdict, `--numen-ease-calm`). NO forked/reinvented tokens. Phase 4 swaps to final tokens (D-L3).
- **D-10:** Scaffold = semantic `<section>` slots in kero order, each with `id` + in-voice placeholder heading + correct vertical rhythm — NO real media/artifacts. Order: Hero → How the Reading works → Honesty moat → Real Readings gallery → Social proof → Final CTA → Footer.
- **D-11:** SEO meta = title + description (+ basic metadata) via Next metadata. Full OG/share art is Phase 4.

### Claude's Discretion
- Exact component file split inside `src/components/numen-landing/`.
- Which `numen/` primitives to reuse (`StageBlock`, `pill-chip`, `icon-button`, `surface`, `glass`). Phase 1 motion is minimal (MOT-02 = rhythm/pacing only; MOT-01 scroll-reveal is Phase 4).
- Precise placeholder copy wording (must obey VOICE.md register).
- Anchor `id` naming convention.

### Deferred Ideas (OUT OF SCOPE)
- Real Reading hero artifact, verdict band, 3-step explainer, hero CTA → Phase 2.
- Honesty/comparison section, gallery, social proof, conversion + waitlist capture → Phase 3.
- Final token swap, scroll-reveal choreography (MOT-01), LCP hero media, OG card art, full a11y pass → Phase 4.
- Deleting orphaned stale components → Phase 4.
- Use-case/persona section, blog, i18n → v2.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-01 | Consume `.numen-surface` tokens + primitives, no forks | Token scope verified at `globals.css:356-392`; 6 primitives + logo confirmed importable (paths below). Shell composes these, never reinvents. |
| DS-02 | Build tolerates placeholder tokens, swaps on lock | Tokens are placeholder hexes (`globals.css:357-372`), bridged via `@theme inline` (`:380`). Layout uses semantic class names (`bg-bg`/`text-text`) so a Phase-4 hex swap needs no JSX edits. |
| NAV-01 | Minimal product-focused nav + footer | Stale `layout/header.tsx` is the reference pattern (already migrated to `NumenLogo`+`border-border`); build clean nav/footer in `numen-landing/`. |
| CONTENT-01 | Calm confident-mentor voice, no jargon | No existing VOICE.md (verified absent) — net-new authoring. Register constraints sourced from LANDING-STRUCTURE §2-3 + CONTEXT D-08. |
| MOT-02 | Section rhythm modeled on kero spine | Spacing via Tailwind default scale (no custom spacing tokens in `.numen-surface`); rhythm = vertical padding rhythm only, NOT animation. |
| PERF-02 | SEO meta (title/description) | `export const metadata: Metadata` pattern already in use in both layouts; root layout has full OG/twitter already (`layout.tsx:26-46`) — reconcile with marketing layout. |

## Standard Stack (all already installed — verify with `npm ls`, do NOT add)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| next | 16.1.5 | App Router, metadata API, route groups | `[VERIFIED: package.json]` |
| react | 19.2.3 | Components | `[VERIFIED: package.json]` |
| tailwindcss | ^4 | CSS-first, `@theme inline` token bridge | `[VERIFIED: package.json]` |
| typescript | ^5 | Types | no `typecheck` script — use `npx tsc --noEmit` |
| motion | ^12.29.2 | `motion/react` — StageBlock motion source | Phase 1 needs little/none (MOT-02 = rhythm) `[VERIFIED]` |
| tailwind-variants | ^3.2.2 | `tv()` slots in primitives | shell may use for nav variants `[VERIFIED]` |
| lucide-react | ^0.563.0 | Icons used by numen primitives (D-09 Lucide-only) | Use Lucide (e.g. `Menu`/`X`) for the new nav, NOT Phosphor |
| @phosphor-icons/react | ^2.1.10 | Used by STALE header/footer only | Numen kit standard is Lucide — do not introduce Phosphor in new shell |

**No new dependencies needed.** This is the cleanest signal that Phase 1 is assembly work.

## Verified Import Paths & Signatures (for `<read_first>` / `<action>` fields)

| Import | Path | Signature / Props | Client? |
|--------|------|-------------------|---------|
| `NumenLogo` | `@/components/brand/numen-logo` | `{ size?: number=22; wordmark?: "numen"\|"full"\|"none"="numen"; className?: string }` | server-safe |
| `NumenMark` | `@/components/brand/numen-logo` | `{ size?: number=22; className?: string }` (bare mark) | server-safe |
| `StageBlock` | `@/components/numen/stage-reveal` | `{ show: boolean; children: ReactNode }` — `"use client"`, `motion/react`, reduced-motion aware | CLIENT |
| `Surface` | `@/components/numen/surface` | `{ children?; className?; style?; as?: "div"\|"section"\|"article"\|"aside" }` — hairline border + `bg-panel`, 12px radius | server-safe |
| `Glass` | `@/components/numen/glass` | `{ children?; blur?: number=12; className?; style?; as? }` — backdrop-blur via INLINE style (Lightning CSS safe) | CLIENT (`"use client"`) |
| `PillChip` | `@/components/numen/pill-chip` | `{ children?; icon?; intent?: "instant"\|"agentic"; onClick?; disabled?; className? }` | CLIENT |
| `IconButton` | `@/components/numen/icon-button` | extends button attrs; `{ children: ReactNode; "aria-label": string (required) }` — 44px hit area | CLIENT |
| `VerdictSwatch` | `@/components/numen/verdict-swatch` | `{ verdict?: "good"\|"mixed"\|"bad"; size?: "sm"\|"md"\|"lg"; children?; className? }` | server-safe (no Phase 1 use — Phase 2/3) |
| `cn` | `@/lib/utils` | `cn(...inputs: ClassValue[]): string` (clsx+tailwind-merge) | n/a |

**Notes for the planner:**
- `Glass` is the RARE blur primitive (composer/tool-sheet only per its docstring) — likely NOT for the nav. If the nav wants a translucent sticky bar, replicate Glass's inline-`style` backdrop-filter pattern directly (see Pitfall 2), don't force `Glass`.
- The nav's mobile menu requires `"use client"` (state + effects). Footer + section slots stay server components.
- `StageBlock`/`PillChip`/`IconButton`/`VerdictSwatch` are optional in Phase 1 — discretion (D). The hamburger toggle could be a plain button or `IconButton` (needs `aria-label`).

## Token Reference (the `.numen-surface` scope this phase consumes)

Source: `src/app/globals.css:356-392` `[VERIFIED]`. Raw vars → bridged Tailwind utility:

| CSS var | Hex/value | Tailwind utility | Use |
|---------|-----------|------------------|-----|
| `--numen-bg` | `#1a1714` | `bg-bg` | page background |
| `--numen-panel` | `#211e1a` | `bg-panel` | cards/panels |
| `--numen-panel-2` | `#2a2622` | `bg-panel-2` | elevated panels |
| `--numen-text` | `#f0ebe3` | `text-text` | body text |
| `--numen-text-muted` | `#bab2a5` | `text-text-muted` | muted UI text (Lc≥60 locked) |
| `--numen-accent` | `#d98a5e` | `bg-accent`/`text-accent` | clay accent, sparingly (CTA) |
| `--numen-verdict-good` | `#7faf7a` | `bg-verdict-good` | Phase 2/3 only |
| `--numen-verdict-mixed` | `#d6a85a` | `bg-verdict-mixed` | Phase 2/3 only |
| `--numen-verdict-bad` | `#d4866f` | `bg-verdict-bad` | Phase 2/3 only |
| `--numen-border` | `rgba(240,235,227,0.06)` | `border-border` | hairline border |
| `--numen-ease-calm` | `cubic-bezier(0.215,0.61,0.355,1)` | (raw var) | motion easing (Phase 4) |

**`@theme inline` is load-bearing** (`globals.css:380` docstring, "Pitfall 1"): a plain `@theme` would resolve `var(--numen-bg)` at `:root` where it is undefined. Because it's `inline`, `bg-bg` resolves at the usage site under `.numen-surface`. **Implication: any element using `bg-bg`/`text-text` MUST be a descendant of an element with `class="numen-surface"`.** If the body lacks the class, these utilities render empty/transparent → broken layout. This is exactly what success criterion #1 ("visibly tolerates placeholder tokens without breaking") guards.

## Architecture Patterns

### The dual-`<html>` resolution (DO THIS FIRST)

Current state `[VERIFIED]`:
- `src/app/layout.tsx` (ROOT) → `<html className="{inter} {serif}"><body className="min-h-screen bg-background font-sans antialiased">{children}<DevLocator/></body></html>` + full Numen metadata (title/desc/OG/twitter, metadataBase `https://virtuna.ai`).
- `src/app/(marketing)/layout.tsx` → ALSO renders `<html className={inter.variable}><body className="...bg-background...">` + stale "Artificial Societies" metadata + stale `<Header/>`.

Next 16 (Context7-confirmed): **only the root layout may define `<html>`/`<body>`.** Two is invalid → nested html/body, hydration breakage. The marketing layout's html/body is a migration artifact.

**Recommended fix — RESOLVED to Option B (user decision, see Open Questions RESOLVED Q1):**
- **Option B (CHOSEN):** Keep root body neutral (scope-free); `(marketing)/layout.tsx` wraps `{children}` in `<div className="numen-surface min-h-screen bg-bg text-text">`. The wrapping div scopes the tokens to the marketing subtree only, honoring D-02's marketing-scoped intent and leaving the 7 sibling routes on the untouched root body (zero repaint blast radius). Next 16 forbids a second `<body>`, so the wrapper `<div>` is the legal expression of "the `(marketing)` layout mounts the scope."
- **Option A (SUPERSEDED — user chose Option B):** ~~Set `className="numen-surface"` on the ROOT `<body>`.~~ Rejected: root-body mount repaints sibling routes and is a literal-D-02 deviation that gains nothing over the wrapper div.

Either way: the marketing layout STOPS importing the stale `<Header/>`, STOPS rendering html/body, and replaces metadata. Root layout's `font-inter`/`font-serif` variables stay (Numen logo wordmark is Inter; serif reserved for later).

### Mounting under the scope — token usage in JSX
```tsx
// Inside the numen-surface subtree:
<section id="hero" className="bg-bg text-text">
  <h1 className="text-text">…</h1>
  <p className="text-text-muted">…</p>
  <a className="bg-accent text-bg …">CTA</a>  {/* accent sparingly */}
</section>
```
No existing surface mounts `.numen-surface` yet (`grep` returned zero `.tsx` hits) — Phase 1 is the FIRST consumer. The `primitives-showcase` page uses a DIFFERENT legacy token set (`bg-bg-base`, `text-text-primary`) — that is NOT the numen-surface scope; do not copy its class names.

### Section slot pattern (D-10, MOT-02)
```tsx
// src/components/numen-landing/section-shell.tsx (server component)
export function SectionShell({ id, heading, children, className }: {
  id: string; heading: string; children?: ReactNode; className?: string;
}) {
  return (
    <section id={id} className={cn("py-24 md:py-32", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-text text-3xl md:text-4xl font-bold tracking-tight">{heading}</h2>
        {children}
      </div>
    </section>
  );
}
```
Slot order + `id`s (anchor targets for nav): `hero` → `how-it-works` → `honesty` → `gallery` → `proof` → `cta` → footer. Nav anchor naming is discretion (D) — keep stable so Phase 2-3 fill them without renaming.

### Mobile nav pattern (reference: stale `layout/header.tsx`)
The stale header `[VERIFIED: header.tsx:20-148]` already implements the full pattern to replicate (clean, with Lucide not Phosphor):
- `useState(mobileMenuOpen)` + `useRef(menuRef)`.
- Outside-click close: `document.addEventListener("mousedown", …)` checking `menuRef.contains`.
- Body scroll-lock: `document.body.style.overflow = "hidden"` on open, reset on close + cleanup.
- Slide-down via `max-h-0 opacity-0` → `max-h-40 opacity-100` with `transition-all duration-200 ease-out`.
- Full-screen dimming overlay `fixed inset-0 z-40 bg-black/50` (click closes).
- `aria-expanded`, `aria-label` on the toggle; 44px hit area.
Rebuild this in `numen-landing/nav.tsx` with `numen-surface` tokens (`border-border`, `text-text`, `bg-accent` CTA) + Lucide `Menu`/`X`.

### Anti-Patterns to Avoid
- **Second `<html>`/`<body>`** in the marketing layout (current bug — must remove).
- **Phosphor icons** in the new shell — the Numen kit is Lucide-only (D-09 in primitives). Stale header uses Phosphor; don't carry it.
- **`backdrop-filter` via Tailwind class** — stripped by Lightning CSS (see Pitfall 2).
- **Dynamic token class interpolation** (`bg-${verdict}`) — Tailwind can't see it (VerdictSwatch docstring "Pitfall 5").
- **Copying `primitives-showcase` token names** (`bg-bg-base`, `text-text-primary`) — wrong scope.
- **Reusing stale `landing/*` or `layout/header|footer`** — orphan, don't import (D-04).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand mark | custom SVG | `NumenLogo` / `NumenMark` | locked geometry, `currentColor`-aware |
| Class merging | string concat | `cn()` from `@/lib/utils` | clsx + tailwind-merge dedup |
| Token values | new hex/CSS vars | `.numen-surface` bridged utilities | DS-01 forbids forks |
| Reduced-motion reveal | custom | `StageBlock` (Phase 2+) | already handles `useReducedMotion` |
| SEO `<head>` tags | manual `<meta>` | `export const metadata: Metadata` | Next API; manual head tags are an anti-pattern (Context7-confirmed) |

## Common Pitfalls

### Pitfall 1: Tokens render empty outside `.numen-surface`
**What goes wrong:** `bg-bg`/`text-text` produce no color; page looks unstyled/black.
**Why:** `@theme inline` resolves vars at usage site; without an ancestor `.numen-surface`, the vars are undefined.
**Avoid:** Ensure the body (or a top wrapper) carries `numen-surface`. Verify on a running dev server, not just typecheck.

### Pitfall 2: Lightning CSS strips `backdrop-filter`
**What goes wrong:** A glass/translucent nav loses its blur in production build (works in dev).
**Why:** CLAUDE.md known issue — Lightning CSS strips the utility-class form.
**Avoid:** Apply blur via React inline `style={{ backdropFilter: 'blur(Xpx)', WebkitBackdropFilter: 'blur(Xpx)' }}` (the `Glass` primitive already does this — `glass.tsx:46-50`; the stale header does too — `header.tsx:62-66`). If the nav is opaque (`bg-bg`/`bg-panel`, recommended for a minimal nav), this pitfall doesn't apply.

### Pitfall 3: Dual root layout / metadata collision
**What goes wrong:** Two `<html>`; or marketing metadata silently overridden by root.
**Why:** Both layouts currently export metadata + html. Next merges metadata down the tree (closer layout wins for overlapping keys), but two html tags is invalid.
**Avoid:** Single html in root; marketing layout exports only the override keys it needs (title/description) and renders no html/body.

### Pitfall 4: oklch dark-token inaccuracy (already mitigated)
**What goes wrong:** Very dark colors (L<0.15) compile wrong in `@theme`.
**Why:** Tailwind v4 oklch bug (CLAUDE.md).
**Avoid:** Already handled — `.numen-surface` authors every dark token as exact hex (`globals.css:342-343` D-03). No action; just don't introduce oklch dark values.

## Runtime State Inventory

This is greenfield scaffold work (new components, rebuilt route) — not a rename/migration. The only "state" is which imports the marketing route points at.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB/datastore touched | none |
| Live service config | None | none |
| OS-registered state | None | none |
| Secrets/env vars | None (no CTA wiring this phase — placeholder links only) | none |
| Build artifacts | Stale `components/landing/index.ts` barrel + `components/layout/index.ts` still exported but will be unimported after rebuild | none (orphan only, D-04; delete Phase 4) |

**Verified:** rebuilding `(marketing)/page.tsx` removes the only imports of `landing/*` + `layout/footer`. Stale `layout/header` is imported by `(marketing)/layout.tsx` — removed when that layout is rebuilt. After Phase 1, grep `@/components/landing` and `@/components/layout/header|footer` should return only the stale files' own internal refs (confirm in verification).

## Code Examples

### Marketing layout (passthrough, no html/body) — Option B shape
```tsx
// src/app/(marketing)/layout.tsx
import type { Metadata } from "next";
import { Nav } from "@/components/numen-landing/nav";
import { Footer } from "@/components/numen-landing/footer";

export const metadata: Metadata = {
  title: "Numen — an honest verdict on your content, before you post",
  description:
    "Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="numen-surface min-h-screen bg-bg text-text">
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
```
(Root `src/app/layout.tsx` body stays scope-free — do NOT add `numen-surface` to it. The `.numen-surface` scope mounts only on this marketing wrapper `<div>`, so `bg-bg`/`text-text` resolve for the marketing subtree and the sibling routes on the root body are untouched.)

### Metadata baseline (PERF-02)
Minimal correct Next 16 object — title + description suffice for Phase 1; OG/twitter art is Phase 4. Root layout already has OG/twitter scaffolding (`layout.tsx:31-45`) which can stay as inherited defaults; marketing layout overrides title/description.

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Route-group layout owning `<html>` | Only root layout owns html/body | App Router (stable) | Marketing layout must shed its html/body |
| `framer-motion` | `motion` (`motion/react`) | v12 | StageBlock already on `motion/react`; don't import framer-motion in new code |
| Manual `<head>` meta | `export const metadata` | App Router | Use metadata API only |

**Deprecated/outdated in this repo:**
- Stale `components/landing/*`, `layout/header.tsx`, `layout/footer.tsx` — societies.io brand, orphan now (D-04).
- `(marketing)/layout.tsx` stale "Artificial Societies" metadata + `<html>`/`<body>` — replace.
- Phosphor icons in shell context — kit standard is Lucide.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MOOT under Option B: the root `<body>` is NOT modified this phase, so dev/showcase routes cannot regress. `.numen-surface` is contained to the marketing wrapper `<div>`. | Architecture / Open Questions | NONE — no root-body change ships. |
| A2 | RESOLVED (Option B, user decision): D-02 is satisfied by mounting `.numen-surface` on a wrapper `<div>` INSIDE `(marketing)/layout.tsx`, NOT on the root `<body>`. The root body is untouched. | dual-html resolution / Open Questions | NONE — superseded by the user's Option B decision; see Open Questions (RESOLVED) Q1. |
| A3 | Phase 1 needs no `motion`/StageBlock usage (MOT-02 = rhythm only) | Stack / Discretion | LOW — CONTEXT explicitly scopes MOT-01 reveals to Phase 4. |

## Open Questions (RESOLVED)

1. **Root vs marketing body class placement (D-02 literal wording). — RESOLVED.**
   - What we knew: Next 16 allows only one `<html>`/`<body>`, and it lives in the root layout. D-02 says the *marketing layout* mounts the scope.
   - **Resolution (user decision): Option B.** The `.numen-surface` scope mounts on a wrapper `<div className="numen-surface min-h-screen bg-bg text-text">` rendered INSIDE `(marketing)/layout.tsx`. The root `src/app/layout.tsx` `<body>` is NOT modified to add `.numen-surface`. Next.js forbids a second `<body>`, so a wrapper `<div>` is the legal expression of D-02's "the marketing layout mounts the scope" intent — it keeps the scope marketing-scoped exactly as D-02 specifies (supersedes the earlier Option A recommendation and assumption A2).

2. **Does removing `bg-background` from the root body affect showcase/pricing routes? — RESOLVED (moot under Option B).**
   - Under Option B the root `<body>` is left untouched, so the 7 sibling `(marketing)` routes (showcase, pricing, board-preview, coming-soon, viral-score-test, viz-test, primitives-showcase) cannot be repainted by this phase. There is no root-body change to regress them. Assumption A1's "verify on dev server" mitigation is no longer load-bearing — the scope is contained to the marketing wrapper `<div>`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js | scaffold | ✓ | 16.1.5 | — |
| React | components | ✓ | 19.2.3 | — |
| Tailwind v4 | tokens | ✓ | ^4 | — |
| All primitives + logo | shell | ✓ | in-fork | — |
| motion | StageBlock (opt) | ✓ | ^12.29.2 | — |

No missing dependencies. No new installs. (No external services/CTAs wired this phase.)

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected for app code (no jest/vitest config; only Playwright under `extraction/` for an unrelated capture pipeline) |
| Config file | none for unit tests — see Wave 0 |
| Quick run command | `npx tsc --noEmit` (no `typecheck` script) + `npm run lint` |
| Full suite command | `npm run build` (Next build = the real compile/type/route gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-01/DS-02 | Page renders under `.numen-surface`, tokens resolve, no forked tokens | manual+build | `npm run build` then load `/` on `npm run dev` (visual: warm-neutral bg, readable text) | ✅ build |
| NAV-01 | Nav + footer visible all viewports; mobile menu toggles | manual (Playwright optional) | `npm run dev` → desktop + 375px viewport check | ❌ (manual; Playwright avail if a smoke test is wanted) |
| CONTENT-01 | Copy in voice, no "X% accuracy"/jargon | manual review vs VOICE.md | grep page for forbidden terms: `grep -riE "accuracy\|predict viral\|[0-9]+%" src/app/\(marketing\)` should return nothing | ✅ grep |
| MOT-02 | Ordered `<section id>` slots with rhythm | static | grep section ids present + order; `npm run build` passes | ✅ grep+build |
| PERF-02 | `<title>` + `<meta description>` render | build/manual | `npm run build` + inspect rendered head, or curl dev `/` | ✅ |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green + manual dev-server render check (desktop + mobile) + anti-snake-oil grep clean before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] No unit-test framework for app components. Recommendation: do NOT introduce Vitest/Jest just for this scaffold phase — `tsc --noEmit` + `next build` + a lint pass + manual render is proportional for shell/markup work. (A render smoke test via the existing Playwright install is optional, not required.)
- [ ] Anti-snake-oil guard: add a grep check (above) to phase verification — cheap, high-value for CONTENT-01.

## Security Domain

> Phase 1 ships static markup + placeholder links. No auth, no input, no data, no secrets, no CTA wiring (deferred). ASVS surface is effectively nil this phase.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth this phase) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | no user input (placeholder links only) |
| V6 Cryptography | no | — |
| V14 (config) | minor | external links use `rel="noopener noreferrer"` + `target="_blank"` (X/LinkedIn social, placeholder legal) |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| reverse-tabnabbing on external `target="_blank"` | Tampering | `rel="noopener noreferrer"` on all external links (X, LinkedIn) — already the stale header's pattern |

## Package Legitimacy Audit

No packages installed this phase — all dependencies pre-exist in `package.json`. Slopcheck N/A. Verified the shell consumes only already-present, in-repo modules and locked deps (next 16.1.5, react 19.2.3, tailwind v4, motion 12.29.2, tailwind-variants 3.2.2, lucide-react 0.563.0).

## Sources

### Primary (HIGH confidence)
- `src/app/globals.css:332-392` — `.numen-surface` token scope + `@theme inline` bridge.
- `src/components/numen/{stage-reveal,glass,surface,pill-chip,icon-button,verdict-swatch}.tsx` — primitive signatures.
- `src/components/brand/numen-logo.tsx` — `NumenLogo`/`NumenMark` props.
- `src/app/layout.tsx` + `src/app/(marketing)/layout.tsx` + `page.tsx` — dual-html state, metadata.
- `src/components/layout/header.tsx` — mobile-nav reference pattern.
- `package.json` — versions + scripts.
- Context7 `/vercel/next.js` — root layout owns the only html/body; metadata API; no manual head tags.
- `.planning/{LANDING-STRUCTURE,REQUIREMENTS,ROADMAP}.md` + `01-CONTEXT.md` — scope + decisions + voice register.

### Secondary / Tertiary
- None required — all claims verified against repo files or official Next docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read package.json + every primitive file.
- Architecture: HIGH — dual-html confirmed in both layout files + Context7 docs.
- Token consumption: HIGH — read the exact `.numen-surface` block + bridge.
- Pitfalls: HIGH — sourced from primitive docstrings + CLAUDE.md + verified files.

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable; re-verify if Numen Surface Phase 1 token lock lands or Next minor bumps)
