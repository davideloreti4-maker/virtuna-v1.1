# Phase 1: Foundation, Shell & Voice Baseline - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 6 (3 created, 3 modified) + 1 planning doc
**Analogs found:** 6 / 6 (all code files have an in-repo analog — this is assembly, not greenfield)

> **Worktree note:** all analogs live in THIS worktree (`~/virtuna-numen-landing`). The `.numen-surface` design system, `numen/` primitives, `NumenLogo`, and the stale societies.io shell are all present here (shared `.git`, branch already carries them). No cross-worktree reads needed.

## File Classification

| New/Modified File | Op | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|----|------|-----------|----------------|---------------|
| `src/app/layout.tsx` | modify | root layout / config | request-response (SSR meta de-hype only — scope NOT mounted here) | itself (in place) | exact (self-edit) |
| `src/app/(marketing)/layout.tsx` | modify | route layout (passthrough + `.numen-surface` wrapper) | request-response | itself + RESEARCH Option-B shape | exact (self-edit) |
| `src/app/(marketing)/page.tsx` | modify | route/page (slot composition) | request-response (static) | itself (rebuild) | exact (self-edit) |
| `src/components/numen-landing/nav.tsx` | create | component (nav shell) | event-driven (mobile menu state) | `src/components/layout/header.tsx` | role+flow exact (rebuild clean) |
| `src/components/numen-landing/footer.tsx` | create | component (footer shell) | static / request-response | `src/components/layout/footer.tsx` | role+flow exact (rebuild clean) |
| `src/components/numen-landing/section-shell.tsx` | create | component (section slot) | static markup | RESEARCH §"Section slot pattern" + `numen/surface.tsx` (cn pattern) | role-match (new pattern, no exact analog) |
| `.planning/VOICE.md` | create | planning doc | N/A | none (net-new authoring) | no analog |

---

## Pattern Assignments

### `src/components/numen-landing/nav.tsx` (component, event-driven — `"use client"`)

**Analog:** `src/components/layout/header.tsx` (the stale societies.io header — REBUILD CLEAN, do not import. D-04/D-06.)

This is the highest-value analog: the stale header already implements the full mobile-menu state machine the new nav needs. Copy the SKELETON (state/effects/markup structure), swap the SKIN (Phosphor→Lucide, glass→opaque, societies tokens→`.numen-surface` tokens, calendly/sign-in→anchor links + CTA).

**Client + state pattern to COPY** (`header.tsx:1-7, 20-50`):
```tsx
"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NumenLogo } from "@/components/brand/numen-logo";
import { Menu, X } from "lucide-react"; // CHANGED: was @phosphor-icons/react { List, X }

const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const menuRef = useRef<HTMLDivElement>(null);

// Outside-click close
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (menuRef.current && !menuRef.current.contains(event.target as Node) && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, [mobileMenuOpen]);

// Body scroll-lock
useEffect(() => {
  document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
  return () => { document.body.style.overflow = ""; };
}, [mobileMenuOpen]);
```

**Slide-down reveal pattern to COPY** (`header.tsx:109-135`):
```tsx
<div className={cn(
  "overflow-hidden transition-all duration-200 ease-out md:hidden",
  mobileMenuOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
)}>
  <div className="flex flex-col gap-4 border-t border-border px-8 py-6">
    {/* anchor rows — each min-h-11 (UI-SPEC), onClick closes + restores scroll */}
  </div>
</div>
```

**Dimming overlay pattern to COPY** (`header.tsx:139-146`):
```tsx
{mobileMenuOpen && (
  <div className="fixed inset-0 z-40 bg-black/50 md:hidden"
       onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
)}
```

**Hamburger toggle (a11y) pattern to COPY** (`header.tsx:93-105`) — but swap Phosphor for Lucide and fix `aria-label` to dynamic:
```tsx
<button type="button"
  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden text-text hover:text-text"
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  aria-expanded={mobileMenuOpen}
  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}>
  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
</button>
```

**Logo placement pattern to COPY** (`header.tsx:70-72`):
```tsx
<Link href="/" className="text-text" aria-label="Numen home">
  <NumenLogo size={26} />   {/* default wordmark="numen"; color via text-text */}
</Link>
```

**DEVIATIONS from analog (mandatory per CONTEXT/UI-SPEC):**
- **Icons:** Lucide `Menu`/`X` — NOT Phosphor `List`/`X` (RESEARCH stack; UI-SPEC icon library row).
- **Skin:** OPAQUE nav (`sticky top-0 z-50 bg-bg border-b border-border`), NOT the glass pill. Drop `header.tsx:54-66` inline `backdropFilter`/`var(--gradient-navbar)`/inset-shadow block entirely (UI-SPEC §Glass/blur posture — recommended opaque to dodge the Lightning-CSS strip).
- **Tokens:** `text-text` / `text-text-muted` / `border-border` / `bg-accent text-bg`, NOT `text-white` / `bg-accent text-accent-foreground` / hardcoded greys. Anchor links `text-sm text-text-muted hover:text-text gap-8`.
- **Right cluster:** primary CTA button only (`bg-accent text-bg text-sm font-medium h-10 px-4 rounded-lg`, placeholder `href="#cta"`), no "Sign in" link, no calendly.
- **Center anchors:** How it works (`#how-it-works`) · Honesty (`#honesty`) · Gallery (`#gallery`) — desktop inline, collapse into hamburger on mobile.
- **Focus ring:** add `focus-visible:ring-2 focus-visible:ring-accent` on every interactive element (UI-SPEC §a11y — the stale header lacks this).
- **Container:** inner `mx-auto max-w-6xl px-6 h-16 flex items-center justify-between` (UI-SPEC), NOT the `max-w-[1204px] rounded-2xl` pill.

---

### `src/components/numen-landing/footer.tsx` (component, static — server component)

**Analog:** `src/components/layout/footer.tsx` (stale societies.io footer — REBUILD CLEAN. D-04/D-07.)

Copy the LAYOUT bones (brand-left / links-center / social-right responsive bar) + the external-link safety pattern. Strip all societies copy, the oversized CTA hero, and Phosphor.

**Responsive bar layout pattern to COPY** (`footer.tsx:47-49`):
```tsx
<div className="flex flex-col items-center gap-8 border-t border-border pt-8 md:flex-row md:justify-between">
```

**External-link safety pattern to COPY** (`footer.tsx:80-97`) — REQUIRED reverse-tabnabbing mitigation (RESEARCH §Security):
```tsx
<a href="https://x.com/..." target="_blank" rel="noopener noreferrer"
   className="... text-text-muted hover:text-text" aria-label="X (Twitter)">
  {/* Lucide icon or text label — NOT Phosphor XLogo */}
</a>
```

**Copyright/year pattern to COPY** (`footer.tsx:14, 50-53`):
```tsx
const currentYear = new Date().getFullYear();
// → "© {currentYear} Numen"  (UI-SPEC copy: "© 2026 Numen")
```

**DEVIATIONS (per D-07 / UI-SPEC §Footer):**
- Server component (no `"use client"`, no state) — static.
- `<footer>` full-bleed `bg-bg border-t border-border`, inner `mx-auto max-w-6xl px-4 md:px-6 py-12` (NOT `max-w-4xl px-6 py-24`).
- Replace the big centered CTA hero with a minimal **footer CTA slot** (same accent button as nav, placeholder `href="#cta"`).
- Contents: `<NumenLogo />` + one-line positioning copy (`text-text-muted text-sm`) + anchor repeat (same 3 anchors) + legal placeholders (Privacy · Terms, `href="#"`) + social (X, LinkedIn — drop Email) + CTA slot + copyright.
- Tokens: `text-text-muted hover:text-text`, NOT `text-gray-400 hover:text-white`.
- Icons: Lucide (NOT Phosphor `LinkedinLogo`/`XLogo`/`Envelope` from `@phosphor-icons/react/dist/ssr`).

---

### `src/components/numen-landing/section-shell.tsx` (component, static markup — server component)

**Analog:** No exact in-repo analog (no section-slot component exists). Pattern source = **RESEARCH §"Section slot pattern" (lines 147-163)** + UI-SPEC §Section-slot scaffold (lines 167-174). Reuse the `cn()` + `tv()` discipline from `src/components/numen/surface.tsx:1-22` for class composition.

**Pattern to BUILD** (RESEARCH/UI-SPEC verbatim contract):
```tsx
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionShell({ id, heading, children, className }: {
  id: string; heading: string; children?: ReactNode; className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 md:scroll-mt-24 py-24 md:py-32", className)}>
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-text text-3xl md:text-4xl font-bold tracking-tight">{heading}</h2>
        {/* children empty in P1 — P2-4 fill */}
        {children}
      </div>
    </section>
  );
}
```

**cn-composition reference to MIRROR** (`surface.tsx:34-45`) — caller `className` merged through `cn()` so layout overrides win (hero needs `className="pt-28 pb-24 md:pt-40 md:pb-32"` override per UI-SPEC line 56):
```tsx
<Component className={cn(surface(), className)} style={style}>{children}</Component>
```

**Contract constraints (UI-SPEC):**
- Every slot: `scroll-mt-20 md:scroll-mt-24` (clears sticky nav on anchor jump).
- Uniform `py-24 md:py-32` rhythm; hero overrides via `className`.
- Locked slot order + ids (Phases 2-4 fill without renaming): `#hero` → `#how-it-works` → `#honesty` → `#gallery` → `#proof` → `#cta`.

---

### `src/app/(marketing)/layout.tsx` (route layout — MODIFY to passthrough)

**Analog:** itself (current state) + RESEARCH §"Code Examples / Marketing layout (passthrough)" (lines 231-254).

**Current state (the bug to remove)** — `(marketing)/layout.tsx:22-29` renders a SECOND `<html>`/`<body>` (invalid; Next allows only one root html/body) + imports the stale `<Header/>` + stale metadata.

**Target pattern to APPLY** (RESEARCH Option B — passthrough, no html/body; `.numen-surface` mounts on a wrapper `<div>` here, NOT on the root body):
```tsx
import type { Metadata } from "next";
import { Nav } from "@/components/numen-landing/nav";
import { Footer } from "@/components/numen-landing/footer";

export const metadata: Metadata = {
  title: "Numen — an honest verdict on your content, before you post",
  description: "Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.",
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

**Changes vs current:** drop `<html>`/`<body>` + the local `Inter()` re-import (`layout.tsx:6-11`); drop stale `Header` import; replace "Artificial Societies" metadata with Numen title/description (UI-SPEC §SEO). **Mount the `.numen-surface` scope on the wrapper `<div>` (Option B — locked decision D-02, marketing-scoped intent)**: `bg-bg`/`text-text` resolve only under this ancestor scope. Exactly one `<nav>` (in Nav), one `<main>`, one `<footer>` (UI-SPEC §a11y landmarks). The root `src/app/layout.tsx` body stays scope-free — sibling routes (showcase/pricing/etc.) are untouched.

---

### `src/app/layout.tsx` (root layout — MODIFY: de-hype meta ONLY; do NOT mount scope)

**Analog:** itself (current state, lines 1-59). Keep the font wiring + viewport + OG/twitter scaffolding; change one thing (metadata de-hype). **Do NOT add `numen-surface` to the root `<body>`** — under Option B (locked decision D-02), the scope mounts on the marketing-layout wrapper `<div>`, not the root body.

**Root `<body>` — leave scope-free (Option B):**
```tsx
// KEEP AS-IS (do NOT add numen-surface):
<body className="min-h-screen bg-background font-sans antialiased">
```
The `.numen-surface` scope is mounted one level down, in `(marketing)/layout.tsx`'s wrapper `<div>`, so `bg-bg`/`text-text` resolve for the marketing subtree only (globals.css:380). This keeps the 7 sibling routes (showcase, pricing, board-preview, coming-soon, viral-score-test, viz-test, primitives-showcase) on the untouched root body — zero repaint blast radius. An acceptance gate asserts `! grep -q 'numen-surface' src/app/layout.tsx`.

**Metadata de-hype to APPLY** (`layout.tsx:28-46` — current strings VIOLATE the anti-snake-oil voice moat):
- `layout.tsx:29` "Know what will go viral before you post. AI-powered predictions…" → forbidden ("go viral", "predictions"). Replace title/description with the Numen in-voice baseline (UI-SPEC §SEO); de-hype the OG/twitter title/description strings too (lines 32-44).

**Keep unchanged:** `inter`/`serif` font variables (lines 6-19), `viewport` (21-24), `metadataBase` (27), `<DevLocator/>` (55).

---

### `src/app/(marketing)/page.tsx` (page — REBUILD: compose section slots)

**Analog:** itself (current state, lines 1-27) — but the current body (stale `HeroSection`/`BackersSection`/… + `Footer`) is fully replaced.

**Current import structure (REMOVE entirely)** — `page.tsx:1-10` imports stale `@/components/landing` barrel + `@/components/layout/footer`. Rebuilding this file is what orphans those imports (RESEARCH §Runtime State).

**Target pattern to BUILD** — compose ordered `SectionShell` slots (Footer now lives in the layout, not the page):
```tsx
import { SectionShell } from "@/components/numen-landing/section-shell";

export default function HomePage() {
  return (
    <>
      {/* Hero: special padding override + placeholder H1/subhead/CTA */}
      <SectionShell id="hero" heading="..." className="pt-28 pb-24 md:pt-40 md:pb-32" />
      <SectionShell id="how-it-works" heading="How the Reading works" />
      <SectionShell id="honesty" heading="An honest verdict, not a hype score." />
      <SectionShell id="gallery" heading="Real Readings, real creators." />
      <SectionShell id="proof" heading="..." />
      <SectionShell id="cta" heading="See what your next video is really saying." />
    </>
  );
}
```
Placeholder copy strings from UI-SPEC §Copywriting (lines 201-214); all must obey VOICE.md (no jargon, no "%/viral/predict"). Hero H1/subhead/CTA per D-08a.

---

### `.planning/VOICE.md` (planning doc — NET-NEW authoring)

**Analog:** none — net-new (verified absent, RESEARCH NAV-01/CONTENT-01). Source material = CONTEXT D-08/D-08a + UI-SPEC §Voice register (lines 191-214) + `.planning/LANDING-STRUCTURE.md` §2-3. Not code; no pattern to copy. Must capture: calm confident-mentor register, second person, zero engine jargon, zero hype/fake-precision (anti-snake-oil), verdict = band + one-line why (never naked number), specificity, do/don't word lists, 2-3 example hero/section lines.

---

## Shared Patterns

### Class merging — `cn()`
**Source:** `@/lib/utils` (used in every analog: `header.tsx:3`, `footer.tsx:2`, `surface.tsx:5`, `icon-button.tsx:7`, `numen-logo.tsx:1`)
**Apply to:** nav, footer, section-shell — all class composition.
```tsx
import { cn } from "@/lib/utils";
className={cn("base classes", conditional && "more", className)}
```
Never string-concat classes (RESEARCH §Don't Hand-Roll). For variant-heavy slots, `tv()` from `tailwind-variants` is the kit pattern (`surface.tsx:20`, `icon-button.tsx:21`) — optional for nav.

### Token usage — `.numen-surface` bridged utilities
**Source:** `globals.css:356-392` (scope + `@theme inline` bridge)
**Apply to:** all shell JSX (every element must be a descendant of the `.numen-surface` marketing wrapper `<div>`)
| Use | Utility | Never |
|-----|---------|-------|
| page/nav/footer bg | `bg-bg` | `bg-background`, hardcoded hex |
| panel/menu sheet | `bg-panel` / `bg-panel-2` | — |
| headings/body | `text-text` | `text-white` |
| muted/links/legal | `text-text-muted` (hover `text-text`) | `text-gray-400` |
| hairline borders | `border-border` | `border-white/[0.06]` |
| CTA fill only | `bg-accent text-bg` | `bg-accent text-accent-foreground` |
| verdict bands | `bg-verdict-*` | **OUT OF SCOPE Phase 1** |
Accent is reserved (~10%): nav CTA + footer CTA + focus ring only. No accent on links/headings/logo/icons (UI-SPEC §Color).

### Brand mark — `NumenLogo` / `NumenMark`
**Source:** `src/components/brand/numen-logo.tsx:64-87`
**Apply to:** nav (left), footer. Props `{ size?: number=22; wordmark?: "numen"|"full"|"none"; className? }`. `currentColor`-aware — color it by setting `text-text` on the wrapping `<Link>`. Locked geometry — do NOT restyle the internal wordmark.

### External-link safety
**Source:** `header.tsx:84-85`, `footer.tsx:81-83`
**Apply to:** footer X / LinkedIn (and any external legal link)
```tsx
target="_blank" rel="noopener noreferrer"   // reverse-tabnabbing mitigation (REQUIRED)
```

### Focus-visible ring (a11y — analogs LACK this, must ADD)
**Source:** kit pattern in `icon-button.tsx:22` (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`)
**Apply to:** every interactive element (nav links, CTA, hamburger, footer links) — the stale header/footer omit it; UI-SPEC §a11y makes it mandatory.

### Backdrop-filter (only if a translucent surface is chosen — recommended NOT to)
**Source:** inline-style pattern at `header.tsx:62-66` and `glass.tsx`
**Apply to:** N/A for the recommended OPAQUE nav. If ever translucent, apply blur via React inline `style={{ backdropFilter, WebkitBackdropFilter }}` — NEVER a Tailwind class (Lightning CSS strips it; CLAUDE.md known issue).

---

## No Analog Found

| File | Role | Reason | Planner uses instead |
|------|------|--------|----------------------|
| `src/components/numen-landing/section-shell.tsx` | component (section slot) | No section-slot component exists in repo; both stale and numen kits lack one | RESEARCH §Section slot pattern (147-163) + UI-SPEC §Section-slot scaffold (167-174); mirror `surface.tsx` cn-composition |
| `.planning/VOICE.md` | planning doc | Net-new voice authoring (verified absent) | CONTEXT D-08/D-08a + UI-SPEC §Voice + LANDING-STRUCTURE §2-3 |

---

## Anti-Patterns (do NOT copy from analogs)

- **Second `<html>`/`<body>`** — current `(marketing)/layout.tsx:23-24` bug; remove (RESEARCH Pitfall 3).
- **Phosphor icons** — stale header/footer use `@phosphor-icons/react`; Numen kit is Lucide-only.
- **Glass/pill nav** — stale header's `var(--gradient-navbar)` + `max-w-[1204px] rounded-2xl` pill; new nav is opaque full-bleed `bg-bg border-b border-border`.
- **societies tokens** — `text-white` / `text-gray-400` / `text-accent-foreground` / `bg-background`; use `.numen-surface` bridged utilities.
- **`primitives-showcase` token names** — `bg-bg-base` / `text-text-primary` are a DIFFERENT legacy scope; never copy.
- **Hype/jargon copy** — root `layout.tsx:28-44` "go viral"/"AI-powered predictions"; forbidden by VOICE.
- **Importing stale `landing/*` or `layout/header|footer`** — orphan, don't import (D-04; delete is Phase 4).

---

## Metadata

**Analog search scope:** `src/app/`, `src/app/(marketing)/`, `src/components/{layout,numen,brand,numen-landing}/`, `src/app/globals.css` (token scope)
**Files scanned:** 9 read in full/targeted (root layout, marketing layout, marketing page, stale header, stale footer, numen-logo, surface, icon-button, stage-reveal) + globals.css §332-392
**Worktrees checked:** 7 listed; all needed analogs resolved in-worktree (`~/virtuna-numen-landing`)
**Pattern extraction date:** 2026-06-11
