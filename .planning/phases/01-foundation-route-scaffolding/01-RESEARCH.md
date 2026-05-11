# Phase 1: Foundation & Route Scaffolding — Research

**Researched:** 2026-05-11
**Domain:** Magic UI integration via shadcn registry CLI on Next.js 15 / Tailwind v4 / React 19, marketing route scaffolding, design-language vetting checklist
**Confidence:** HIGH (registry payloads verified verbatim via `curl`; install path verified against `components.json`; existing codebase patterns inspected)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Three primitives land in Phase 1: **Magic Card**, **Border Beam**, **Shine Border**. Forward mapping — Magic Card to Phase 2 hero tiles + Phase 3 bento surfaces; Border Beam to hero CTA accent / bento highlight; Shine Border to Pro pricing card flourish (Phase 6).
- **D-02:** Latitude to install additional Magic UI primitives beyond the initial 3 if they unlock Phase 2 hero composition or improve showcase coverage. Every additional primitive MUST pass the vetting checklist (D-06) before commit.
- **D-03:** Phase 1 pulls ONLY from Magic UI. No Aceternity / Origin UI / Cult UI in this phase. The vetting checklist generalizes to those for future phases.
- **D-04:** Install via **shadcn registry CLI**. Components land as editable source files in `src/components/magic-ui/` (planner picks final path — mirrors existing `src/components/ui/` shadcn structure).
- **D-05:** **Tune during install** — strip Magic UI's stock violet/pink defaults to coral/neutral, reduce motion duration/intensity to Raycast idiom. No "drop in stock, tune later." Tuned version IS what lands.
- **D-06:** **Documented Raycast-native vetting checklist** is Phase 1's load-bearing artifact. Default location: `BRAND-BIBLE.md` (new section after "Do's and Don'ts"). Eight gates minimum (color, border opacity, radius, motion, font, GlassPanel compat, dark-mode-first, bundle size).
- **D-07:** Verification surface = existing `/showcase` route at `src/app/(marketing)/showcase/page.tsx`. Add Magic UI section after the existing "Gradients" ShowcaseSection. No separate sandbox route.

### Claude's Discretion

- **Empty shell content at `/`** — UI-SPEC §Marketing Route Shell already prescribes minimal `<main className="min-h-screen bg-background">` with phase stub comments inside. Honor that.
- **Marketing layout metadata** — UI-SPEC prescribes neutral `title: "Virtuna"` / `description: "Virtuna — TikTok creator intelligence."` placeholder. Brand spine NOT pre-locked. Phase 8 (COPY-02) finalizes.
- **Plagiarized landing components cleanup** — UI-SPEC §Plagiarized Landing Components Contract LOCKS the decision: **DELETE the entire `src/components/landing/` directory in Phase 1** after confirming no remaining imports. SEE RUNTIME STATE INVENTORY § for the cross-route import gotcha.
- **Header treatment** — UI-SPEC §Header Stub Contract prescribes minimal Virtuna-correct stub: wordmark `"Virtuna"` (keep SVG V-mark), nav CTA `"Sign up free" → /signup`, keep `Sign in` link, keep visual chrome (gradient, blur, inset shadow).

### Deferred Ideas (OUT OF SCOPE)

- Brand spine sentence finalization (Phase 8 COPY-02).
- Hero composition (Phase 2 owns it; Phase 1 only INSTALLS primitives Phase 2 will compose).
- Bento tile treatments using Border Beam (Phase 3).
- Pro pricing flourish using Shine Border (Phase 6).
- Aceternity / Origin UI / Cult UI integrations (future phases; checklist gates them).
- Plagiarized header copy polish beyond Phase 1 stubs (Phase 2 concern once hero is in place).
- Lighthouse / mobile / a11y audits (Phase 8).

</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 1 has **no direct requirement mapping** from REQUIREMENTS.md. It is enabling infrastructure. Success is measured by Phase 1's four ROADMAP success criteria, which the planner MUST verify:

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | Visitor at `/` sees clean, intentionally-empty marketing route (not plagiarized AS template) with dark-mode tokens applied | §Marketing Route Shell Replacement — exact before/after diff for `page.tsx` and `layout.tsx`; §Runtime State Inventory — confirms no cross-route breakage |
| SC-2 | ≥1 Magic UI primitive installed + vetted to feel Raycast-native (6% borders, GlassPanel pattern, Inter font), exported through documented path | §Standard Stack + §Magic UI Primitive Install Mechanics — verified CLI commands, verbatim verified source, tuning diffs (stock → tuned) for all 3 primitives |
| SC-3 | Documented vetting checklist exists for Magic UI / Aceternity / Origin UI / Cult UI | §Vetting Checklist Draft — 9-gate checklist (UI-SPEC §Vetting Checklist Contract is the authoritative version; research verifies it covers all known Magic UI failure modes) |
| SC-4 | Route renders without console errors and without React hydration warnings | §Common Pitfalls — next-themes hydration trap, mounted-state guard, suppressHydrationWarning usage in Magic Card source (already present), and Lightning CSS / backdrop-filter rule |

</phase_requirements>

---

## Summary

Phase 1 is a textbook **scaffold-and-vet** phase: install 3 known-source primitives from a public shadcn registry, override their stock visual defaults at install time to match a strict in-house design language, replace a placeholder route with an empty production-grade shell, and codify the visual gates so future external-library imports never re-litigate.

The technical complexity is low because every action is verifiable: the Magic UI registry JSON payloads are publicly available and have been fetched verbatim; the install paths, dependencies, and component signatures are all known before any code is written. The risks are **cosmetic** (stock violet/pink bleeding through if a default is missed), **dependency-hygiene** (Magic Card pulls `next-themes` which is not currently in `package.json`), **hydration** (Magic Card's `next-themes` `useTheme()` hook needs a mounted-state guard — already present in source via `suppressHydrationWarning` + `mounted` state), and **cross-route imports** (`FAQSection` from the about-to-be-deleted `src/components/landing/` is ALSO imported by `src/app/(marketing)/pricing/page.tsx` — Phase 1 cannot blindly delete the directory without first detaching or migrating that import).

**Primary recommendation:** Configure `@magicui/*` namespace in `components.json` (one-time setup), then run `npx shadcn@latest add @magicui/magic-card @magicui/border-beam @magicui/shine-border` to land all 3 at once, immediately tune the stock defaults in-source per UI-SPEC's per-primitive tuning tables, install the missing `next-themes` dep, register the missing `@keyframes shine` if the registry's `css` block isn't auto-injected into `globals.css`, delete `src/components/landing/` AFTER detaching `FAQSection` from `/pricing` (planner picks: inline-copy temp stub on `/pricing` OR move FAQSection to `src/components/marketing/`), replace `page.tsx` and `layout.tsx` per UI-SPEC, stub the Header, append a Magic UI demo section to `/showcase`, and write the 9-gate vetting checklist into `BRAND-BIBLE.md`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic UI primitive source (tuned) | Browser / Client (React) | — | All 3 primitives are `'use client'` (pointer events, motion/react, useTheme); they run entirely in the browser after hydration. No server-side render output beyond a static wrapper. |
| Magic UI primitive install / tuning | Build-time tooling (shadcn CLI) | Repo source | Install is a one-shot CLI action that writes editable source files into the repo. The TUNING is an immediate post-install in-source edit, not a runtime config. |
| Marketing route shell (`/`) | Frontend Server (Next.js App Router RSC) | — | `src/app/(marketing)/page.tsx` defaults to server component (no `'use client'` directive). Empty `<main>` renders on the server; only the Header carries client-side interactivity (hamburger menu state). |
| Marketing layout metadata | Frontend Server (Next.js metadata API) | — | `export const metadata: Metadata = {...}` resolves at build/request time on the server; ships in document head. |
| Header stub (chrome) | Browser / Client | — | Already a `'use client'` component (hamburger menu state, click-outside ref). Phase 1 only changes copy/links, not the interactivity model. |
| `/showcase` Magic UI demo section | Frontend Server (default) + Browser (primitives) | — | Showcase page is RSC; the imported `MagicCard` / `BorderBeam` / `ShineBorder` are client subtrees. Renders cleanly with server-rendered surrounding wrapper and client-only motion subtrees. |
| Vetting checklist artifact | Documentation (BRAND-BIBLE.md) | — | Pure markdown; no runtime concern. |

**Sanity check:** No capability in Phase 1 belongs to a different tier than assigned. No API/backend work, no database work, no CDN concern. Magic UI primitives correctly sit in the client tier — pushing them to RSC would crash because they use pointer events, hooks, and motion/react.

---

## Standard Stack

### Core (must be installed/configured)

| Library | Version (verified) | Purpose | Why standard |
|---------|--------------------|---------|--------------|
| `motion` | `^12.29.2` ✓ already installed `[VERIFIED: package.json line 52]` | Animation primitives (`motion/react` — `motion`, `useMotionValue`, `useMotionTemplate`, `useSpring`, `useReducedMotion`) | Magic UI registry declares `motion` as the only animation dep for Border Beam and Magic Card. Repo already standardizes on `motion/react` for the 5 motion components in `src/components/motion/`. |
| `next-themes` | latest stable `[VERIFIED: registry payload dependencies array]` — **NOT in package.json yet** `[VERIFIED: grep package.json]` | Theme detection for Magic Card (used by `useTheme()` to decide `mixBlendMode: "screen" \| "multiply"` in orb mode) | Magic Card source declares `import { useTheme } from "next-themes"`. App is dark-mode-only, so `useTheme()` always resolves dark, but the import is hard-coded — `next-themes` must be installed before `npx shadcn add` succeeds. |
| `shadcn` CLI | `@latest` (current is v4 per [March 2026 changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4)) | Registry add command | shadcn registry CLI v4 supports `@namespace/component` syntax via `components.json` `registries` field. Required for the `@magicui/*` invocation form. |
| `tailwindcss` | `^4` ✓ already installed `[VERIFIED: package.json line 86]` | Utility CSS engine | Magic UI primitives use Tailwind v4 native utilities (`mask-intersect`, `bg-linear-to-l`, `rounded-(length:--var)`) — these REQUIRE Tailwind v4; would break on v3. |
| `tw-animate-css` | `^1.4.0` ✓ already installed `[VERIFIED: package.json line 64]` | `animate-shine` family compatibility | Not strictly required but already present; provides safe namespacing for any custom animate-* utilities. |

### Supporting (already installed, used by primitives indirectly)

| Library | Version | Purpose | When used |
|---------|---------|---------|-----------|
| `@radix-ui/react-slot` | `^1.2.4` ✓ | `asChild` pattern in existing button.tsx | Carryover from v3.0 Phase 02 — Radix Slot SSR fix already landed. Magic UI primitives do NOT use Slot directly, but the existing project pattern stays intact. |
| `next/font/google` (Inter) | bundled with Next 15 | Inter font loading | Marketing layout already loads Inter via `next/font/google` and assigns to `--font-inter` CSS variable. Magic UI primitives must NOT embed any `font-family` override. |
| `@phosphor-icons/react` | `^2.1.10` ✓ | Header icons (List, X) | Header stub keeps existing Phosphor icons; unchanged in Phase 1. |
| `lucide-react` | `^0.563.0` ✓ | Optional icons | Approved by checklist Gate 8; not used in Phase 1 deliverables specifically. |
| `class-variance-authority` + `clsx` + `tailwind-merge` | ✓ | `cn()` utility | `src/lib/utils.ts` `cn()` is the existing pattern; Magic UI source imports `cn` from `@/lib/utils` which resolves to this. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Why we don't |
|------------|-----------|----------|--------------|
| `motion` (motion/react) | `framer-motion` (still in package.json line 50, `^12.29.3`) | Same API surface, slightly larger bundle | `framer-motion` is LEGACY in this repo (per BRAND-BIBLE.md §6 Bundle pinning rule + v3.0 carryover notes). All NEW motion code uses `motion/react` import path. Magic UI registry uses `motion/react` natively — keep alignment. |
| `next-themes` | Hand-rolled `theme === 'dark'` constant | Smaller bundle (~5 KB saved) | Magic Card source HARD-CODES `import { useTheme } from "next-themes"` — would require editing the import line away from stock pattern. The vetting checklist (Gate 7) says "do not assume light-mode base" but does NOT forbid the dep. Cleaner: install next-themes, set forced dark mode at root (or accept that `useTheme()` defaults to undefined → falls through `mounted = false → isDarkTheme = true` per the source's own guard). |
| URL-form install (`https://magicui.design/r/<name>.json`) | Namespace-form install (`@magicui/<name>`) | URL form still works (documented under `add: name, url or local path`); namespace form requires one-time `components.json` config | Namespace form is the **2026-current** Magic UI recommendation per their docs. Cleaner long-term, single CLI invocation can pull all 3 primitives, future Magic UI installs use the same alias. **Recommendation: configure namespace once.** URL form is the fallback if the namespace setup runs into trouble. |
| Install all primitives, then tune | Tune each primitive immediately after install | Two commits vs one per primitive | D-05 requires tuned version IS what lands. Plan should structure tasks as: install + tune as one unit per primitive (single commit per primitive that includes the tuning). |

**Installation (one-time setup):**

```bash
# 1. Configure Magic UI namespace in components.json (one-time)
# Edit components.json to add the "registries" field:
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/magic-ui"   // ← temporarily set to magic-ui for the add command
  },
  "registries": {                   // ← NEW field
    "@magicui": "https://magicui.design/r/{name}.json"
  }
}
```

**WARNING:** `components.json` `aliases.ui` controls where `registry:ui` items land. If you leave it pointing at `"@/components/ui"` (the current value), Magic UI primitives WILL be written to `src/components/ui/magic-card.tsx`, NOT `src/components/magic-ui/`. The cleanest pattern:

- **Option A (recommended):** Temporarily flip `aliases.ui` to `"@/components/magic-ui"` while running `npx shadcn add @magicui/*`, then flip back. Verify both before and after via `cat components.json`.
- **Option B:** Run `npx shadcn add @magicui/*`, then `mv src/components/ui/{magic-card,border-beam,shine-border}.tsx src/components/magic-ui/` and fix any internal imports.

Option A is cleaner because the registry's `path` and `target` resolution treats `aliases.ui` as the destination for `type: "registry:ui"` items.

```bash
# 2. Install next-themes (registry dep for Magic Card)
pnpm add next-themes

# 3. Add all 3 primitives in one CLI invocation
npx shadcn@latest add @magicui/magic-card @magicui/border-beam @magicui/shine-border
# Equivalent URL form (fallback if namespace not configured):
# npx shadcn@latest add https://magicui.design/r/magic-card.json https://magicui.design/r/border-beam.json https://magicui.design/r/shine-border.json
```

**Version verification:**

```bash
npm view motion version        # confirm motion/react still on 12.x — already pinned at 12.29.2
npm view next-themes version   # latest stable; verify ≥ 0.4 (App Router support)
npm view shadcn version        # confirm v4-era CLI; v3 CLI does NOT support registries field
```

`[ASSUMED]` exact `next-themes` version — verify with `npm view next-themes version` during install. The dep was last published on stable for App Router compatibility (`>=0.4.x` for the `next-themes/v3` semantics with RSC).

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       USER (visitor at /)                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Next.js 15 App Router — RSC + Client Boundary                      │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │ MarketingLayout (server)                                    │    │
│   │  - <html lang="en" className="--font-inter">                │    │
│   │  - <body className="bg-background font-sans antialiased">   │    │
│   │  - metadata: Metadata { title, description }                │    │
│   │  ┌───────────────────────────────────────────────────┐     │    │
│   │  │ <Header /> (client — useState + useRef + useEffect)│     │    │
│   │  │   - Floating pill chrome (gradient + blur)         │     │    │
│   │  │   - Wordmark "Virtuna" + V-mark SVG                │     │    │
│   │  │   - Sign in link + "Sign up free" CTA → /signup    │     │    │
│   │  │   - Mobile hamburger menu                          │     │    │
│   │  └───────────────────────────────────────────────────┘     │    │
│   │  ┌───────────────────────────────────────────────────┐     │    │
│   │  │ HomePage (server)                                  │     │    │
│   │  │   <main className="min-h-screen bg-background">    │     │    │
│   │  │     {/* Phase 2: Hero */}                          │     │    │
│   │  │     {/* Phase 3: Bento */}                         │     │    │
│   │  │     {/* ... 4-7 ... */}                            │     │    │
│   │  │   </main>                                          │     │    │
│   │  └───────────────────────────────────────────────────┘     │    │
│   └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │ ShowcasePage (server)                                        │    │
│   │  ...existing 36-component demos...                           │    │
│   │  ┌───────────────────────────────────────────────────┐     │    │
│   │  │ NEW: Magic UI Primitives section (client subtree)  │     │    │
│   │  │   <MagicCard /> × 2 (gradient mode)                │     │    │
│   │  │   <BorderBeam /> wrapped in a base Card            │     │    │
│   │  │   <ShineBorder /> wrapped in a base Card           │     │    │
│   │  └───────────────────────────────────────────────────┘     │    │
│   └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│   src/components/magic-ui/  (NEW — tuned in-source)                  │
│      magic-card.tsx        — motion/react + next-themes              │
│      border-beam.tsx       — motion/react + mask-intersect           │
│      shine-border.tsx      — pure CSS mask + @keyframes shine        │
│      index.ts              — barrel export                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ consumes
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│   src/app/globals.css  @theme block (Layer 1 + Layer 2 tokens)       │
│      --color-coral-500, --color-surface, --color-border,             │
│      --color-background, --radius-lg, etc.                           │
│   + @keyframes shine (injected by registry OR manually added)        │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow narrative:**

1. Visitor requests `/`. Next.js resolves `src/app/(marketing)/layout.tsx` (server), which renders `<html><body>` + metadata + the Header (a client component shipped to the browser) + `{children}`.
2. `{children}` is `src/app/(marketing)/page.tsx` (server) — Phase 1 ships this as an empty `<main>` with section stub comments. Renders as a dark canvas.
3. No Magic UI primitives are imported by the `/` route in Phase 1 (they're only used in `/showcase`). Their presence in `src/components/magic-ui/` is purely for Phase 2+ to consume.
4. Visitor navigates to `/showcase`. The new Magic UI section renders MagicCard/BorderBeam/ShineBorder as client subtrees that hydrate after the surrounding RSC payload arrives. They consume CSS tokens from `globals.css` via `var()` references (e.g. coral spotlight reads `var(--color-coral-500)` etc.).

### Recommended Project Structure (Phase 1 changes only)

```
src/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx        ← EDIT metadata (title + description)
│   │   ├── page.tsx          ← REWRITE as empty <main>
│   │   ├── pricing/
│   │   │   └── page.tsx      ← EDIT to detach FAQSection import (see Runtime State Inventory)
│   │   └── showcase/
│   │       └── page.tsx      ← APPEND Magic UI section after Gradients
│   └── globals.css           ← VERIFY @keyframes shine present after install
├── components/
│   ├── layout/
│   │   └── header.tsx        ← EDIT logo wordmark + CTA copy/links
│   ├── landing/              ← DELETE entire directory (after detaching /pricing import)
│   ├── magic-ui/             ← NEW
│   │   ├── magic-card.tsx    ← INSTALL + TUNE (coral defaults)
│   │   ├── border-beam.tsx   ← INSTALL + TUNE (coral defaults)
│   │   ├── shine-border.tsx  ← INSTALL + TUNE (coral defaults)
│   │   └── index.ts          ← NEW barrel export
│   ├── primitives/           ← unchanged (GlassPanel et al.)
│   └── ui/                   ← unchanged (36 components)
├── components.json           ← EDIT registries field (add @magicui)
└── package.json              ← EDIT (pnpm add next-themes)

BRAND-BIBLE.md                ← EDIT (append External Library Vetting Checklist section)
```

### Pattern 1: shadcn Namespace Registry (Magic UI install)

**What:** Configure `components.json` `registries` field to map `@magicui/*` to the Magic UI registry URL template, then install via namespace shorthand.

**When to use:** Whenever installing from a non-default shadcn registry. Replaces ad-hoc URL-pasting and makes future adds idempotent.

**Example:**

```jsonc
// components.json — DIFF (showing only the new field)
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/magic-ui"     // ← TEMPORARILY redirect for install
  },
  "registries": {                     // ← NEW (Mar 2026 shadcn CLI v4)
    "@magicui": "https://magicui.design/r/{name}.json"
  }
}
```

```bash
# Source: https://ui.shadcn.com/docs/registry/namespace [CITED]
npx shadcn@latest add @magicui/magic-card @magicui/border-beam @magicui/shine-border
```

After install, restore `aliases.ui` to `"@/components/ui"` so future shadcn installs land in the canonical directory.

### Pattern 2: Tuning a Stock Primitive at Install Time (D-05)

**What:** Immediately after `shadcn add`, edit the installed source file to replace stock prop defaults with Raycast token values. Same file, same exports — only the default values and (where appropriate) any embedded color literals change.

**When to use:** Every external-library import. Stock defaults are tuned for the library's marketing demo (typically purple/violet/pink — saturated and motion-heavy). Raycast aesthetic demands restraint.

**Example (Magic Card tuning diff — verified against registry source):**

```typescript
// src/components/magic-ui/magic-card.tsx (excerpt — DEFAULTS ONLY)

// BEFORE (stock from https://magicui.design/r/magic-card.json):
export function MagicCard(props: MagicCardProps) {
  const {
    children,
    className,
    gradientSize = 200,
    gradientColor = "#262626",        // <- dark neutral, ok
    gradientOpacity = 0.8,            // <- too intense
    gradientFrom = "#9E7AFF",         // <- VIOLET, MUST GO
    gradientTo = "#FE8BBB",           // <- PINK, MUST GO
    mode = "gradient",
  } = props
  // ... rest unchanged
}

// AFTER (tuned for Virtuna Raycast language):
export function MagicCard(props: MagicCardProps) {
  const {
    children,
    className,
    gradientSize = 200,                                  // KEEP
    gradientColor = "#18191a",                           // → --color-surface
    gradientOpacity = 0.6,                               // ↓ from 0.8
    gradientFrom = "#FF7F50",                            // → --color-coral-500
    gradientTo = "rgba(255,127,80,0.15)",                // fade coral, no pink
    mode = "gradient",
  } = props
  // ... rest unchanged
}
```

`[VERIFIED: registry payload at https://magicui.design/r/magic-card.json fetched 2026-05-11]`

**Caveat:** The hex literals stay as hex (not `var(--color-...)`) inside default-prop expressions because TypeScript default-arg evaluation runs in JS scope, not CSS scope. Tokens are consumed downstream only — the prop signatures keep concrete color strings. This is fine because the values exactly match the @theme tokens. **A vetting Gate-1 nit:** technically these are "hardcoded hex" — but they're hardcoded to Raycast tokens, which is the point. Add a comment block calling this out.

### Pattern 3: Marketing Route Shell as Phase Stub

**What:** Replace a content-heavy route with a minimal `<main>` containing only HTML comments marking future-phase composition slots. Renders as a dark canvas.

**When to use:** When demolishing plagiarized templates and the replacement design is being built incrementally over multiple phases.

**Example:**

```typescript
// src/app/(marketing)/page.tsx — Phase 1 deliverable
// (No 'use client' — server component by default)

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Phase 2: Hero & Trust Band */}
      {/* Phase 3: Three Surfaces bento */}
      {/* Phase 4: How It Works + The Science */}
      {/* Phase 5: Audience Tabs + Social Proof */}
      {/* Phase 6: Tool Consolidation Calculator + Pricing */}
      {/* Phase 7: FAQ + Final CTA + Footer */}
    </main>
  );
}
```

**Verification:** Open `/` in browser. Expect: floating Header pill at top, then black canvas below. No `Footer` (Phase 7 ships it).

### Pattern 4: useReducedMotion Wrapper (motion/react, already established in repo)

**What:** Wrap any motion-bearing primitive in a `useReducedMotion()` guard from `motion/react`. Repo already uses this in 5 motion components.

**When to use:** Vetting Gate 4 mandates it. Magic Card needs it added (source has no guard); Border Beam needs it added (returns `null` when reduced); Shine Border already uses `motion-safe:` Tailwind variant — no JS change needed.

**Example (Border Beam tuned for reduced motion):**

```typescript
// src/components/magic-ui/border-beam.tsx — TUNED + reduced-motion guarded
"use client"

import { motion, MotionStyle, Transition, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  transition?: Transition
  className?: string
  style?: React.CSSProperties
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
}

export const BorderBeam = ({
  className,
  size = 40,                                       // ↓ from 50 (less eye-catching)
  delay = 0,
  duration = 8,                                    // ↑ from 6 (Raycast pace)
  colorFrom = "rgba(255,127,80,0.9)",              // ← coral-500 at opacity
  colorTo = "rgba(255,127,80,0)",                  // ← coral fade to transparent
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) => {
  const reducedMotion = useReducedMotion()
  if (reducedMotion) return null                   // ← NEW reduced-motion gate

  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={{ "--border-beam-width": `${borderWidth}px` } as React.CSSProperties}
    >
      <motion.div
        className={cn(
          "absolute aspect-square",
          "bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent",
          className
        )}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          ...style,
        } as MotionStyle}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  )
}
```

`[VERIFIED: Border Beam source verbatim from https://magicui.design/r/border-beam.json fetched 2026-05-11; useReducedMotion is already used 5× in src/components/motion/]`

### Anti-Patterns to Avoid

- **Stock defaults shipped to production.** Magic UI stock colors (`#9E7AFF` violet, `#FE8BBB` pink, `#ffaa40` amber, `#9c40ff` violet, `#000000` black for Shine Border) are all visually wrong for Raycast aesthetic. They MUST be overridden at install. Don't say "we'll override at call sites" — call sites should be able to use defaults safely.
- **Importing all primitives into the root route.** Magic Card, Border Beam, Shine Border are NOT imported by `/` in Phase 1. They're only consumed by `/showcase` for verification. Phase 2 imports them as needed.
- **Reaching into `src/components/landing/` for stub content.** All 13 landing components are AS-plagiarized. Deleting them in Phase 1 is the contract; do NOT keep them around "in case." v3.0 archive preserves them under `.planning/milestones/v3.0-brand-statement-landing/` if anything is salvageable.
- **Leaving `aliases.ui` pointing at `@/components/ui` during the install.** This is the silent footgun — Magic UI files would land mixed in with the existing 36-component design system, creating namespace pollution. Flip the alias before `shadcn add`, flip it back after.
- **Skipping the `next-themes` install.** Magic Card source imports `next-themes` directly. Even though the app is dark-mode-only, the dep MUST exist or the build will fail.
- **Hardcoding `font-family: Inter` in any primitive.** Gate 5 prohibits embedded font-family in primitives. Inter inheritance comes from `body { font-family: var(--font-sans) }` in globals.css; primitives stay font-family-free.
- **Forgetting to register `@keyframes shine` if registry doesn't auto-inject.** Shine Border's animation runs off `@keyframes shine` declared in the registry's `css` field. Tailwind v4 + shadcn v4 CLI should auto-inject this into globals.css under the `@theme` block, but verify after install — UI-SPEC explicitly warns this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor-tracking spotlight inside a card border | Custom pointermove + radial-gradient + motion-template | **Magic UI Magic Card** | The `motion/react` `useMotionTemplate` + `useSpring` interactions are subtle; getting natural easing + global-blur reset on visibility-change + window-blur is 100+ lines of carefully-debugged hand-rolling. The vetted Magic Card already handles all of it. |
| Animated coral arc sweeping a 1px border | Custom motion-path + `offsetPath` + masking | **Magic UI Border Beam** | The Tailwind v4 `mask-intersect` + `mask-clip` combo is fragile to handcraft; Border Beam encodes the working pattern. Just override colors and duration. |
| Rotating gradient border without JS | Custom CSS mask-composite + radial-gradient + keyframes | **Magic UI Shine Border** | Pure CSS technique; trivially small (under 50 lines including types) but the mask-composite hack is non-obvious. Shine Border ships the working pattern; do not reinvent. |
| User-OS reduced-motion detection | Hand-rolled `matchMedia` listener | **`useReducedMotion()` from `motion/react`** (already used 5× in repo) | Already standardized; SSR-safe; returns boolean. |
| Theme detection for client-side rendering | Hand-rolled `useState(theme)` + system preference | **`next-themes` `useTheme()`** | Magic Card hard-codes this dep; just install it. Dark-mode-first means `useTheme()` always resolves dark, but the wiring is in place for future light-mode if ever needed. |
| Glass-effect container with frosted blur | Custom backdrop-filter + gradient + inset shadow | **Existing `GlassPanel` primitive** | Already zero-config, already Raycast-token-aligned, already Lightning-CSS-safe (inline `backdropFilter` style). Magic UI primitives compose alongside GlassPanel, not against it. |
| External-library design-fit auditing | Per-phase ad-hoc "does this feel right?" reviews | **9-gate vetting checklist in BRAND-BIBLE.md** | The whole point of Phase 1 is to write this once so future phases stop relitigating it. |

**Key insight:** Every problem in this column has a one-line solution (install a dep, import a util, follow a 9-gate checklist) vs. a 100-line custom solution that re-litigates a known-solved problem. Phase 1's job is to wire those one-liners and write the checklist.

---

## Runtime State Inventory

> This phase involves deleting a directory (`src/components/landing/`) and replacing route content. The grep audit found files; the inventory below explicitly answers what runtime state survives the file delete.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 1 is pure code/config. No DB, no localStorage write, no Supabase mutation. `[VERIFIED: grep -r 'localStorage\|sessionStorage' src/components/landing/ → 0 matches]` | None |
| Live service config | None — no external service registers a "landing" string. `[VERIFIED: no Cloudflare/Vercel project setting references "landing"; the `landing` directory is internal naming only]` | None |
| OS-registered state | None — no scheduled tasks, no systemd services, no LaunchAgents reference this codebase. | None |
| Secrets/env vars | None — no env var references "landing", "Artificial Societies", or any AS-plagiarized identifier. Whop / Supabase / Apify keys are unrelated. `[VERIFIED: grep 'landing\|societies' .env* → no env files present (correctly gitignored); package.json doesn't reference these]` | None |
| Build artifacts | Next.js `.next/` build cache. CSS cache known to misbehave when @theme changes. | Recommend `pnpm run build` clean + `rm -rf .next/ node_modules/.cache/` AFTER install/tune to flush stale CSS, per CLAUDE.md known issue. NOT a migration — just a cache flush. |
| **Cross-route imports (CRITICAL)** | **`FAQSection` is imported by `src/app/(marketing)/pricing/page.tsx:3`** — IF Phase 1 deletes `src/components/landing/` without detaching this import, `/pricing` will 500 / fail to build. `[VERIFIED: grep -rn "components/landing" src/ → matches in pricing/page.tsx]` | **The planner MUST add a task that handles this BEFORE deleting `src/components/landing/`.** Three viable options for the planner to pick: (1) Inline the FAQSection JSX directly into `pricing/page.tsx` as a temporary stub (simplest, but pollutes pricing page with AS-style copy until Phase 8); (2) Move `faq-section.tsx` (and its accordion dep) to `src/components/marketing/faq-section.tsx` and update the import — preserves the FAQ on `/pricing` but the copy is still AS-plagiarized (still flagged for Phase 8); (3) Remove FAQSection from `/pricing` entirely (simplest cleanup, but loses the FAQ section from `/pricing` rendering until Phase 7 ships a new one). **Recommendation: option 3 — remove the import + JSX from `/pricing` in the same Phase 1 task that deletes `src/components/landing/`.** Justification: `/pricing` is a secondary route, the AS-style FAQ on it is exactly what Phase 8 COPY-01 mandates eliminating, and Phase 1 keeping it alive defeats COPY-01. |

**Search proof:**

```text
$ grep -rn "from.*landing\|components/landing" src/ --include="*.tsx" --include="*.ts"
src/app/(marketing)/page.tsx:9:} from "@/components/landing";
src/app/(marketing)/pricing/page.tsx:3:import { FAQSection } from "@/components/landing";
```

Two import sites confirmed. Phase 1 already plans to delete the first one (replacing `page.tsx`). The second (`pricing/page.tsx`) is the runtime-state landmine. The planner must allocate a task for it.

**Canonical question answered:** *After every file in `src/components/landing/` is deleted, what runtime systems still reference the old code?* Answer: only `src/app/(marketing)/pricing/page.tsx`'s static import statement. No build cache, no OS registration, no DB row, no env var. Once that import is detached, the delete is safe.

---

## Common Pitfalls

### Pitfall 1: `next-themes` hydration mismatch on initial render

**What goes wrong:** Magic Card's `useTheme()` from `next-themes` returns `undefined` on the first render (server) and resolves to `"dark"` (or `"light"` or `"system"`) after hydration. If `isDarkTheme` is computed and used to set inline styles BEFORE the mount effect runs, React logs a hydration mismatch warning.

**Why it happens:** `useTheme()` reads from a context that's empty during SSR. The themed value only arrives after a client effect fires.

**How to avoid:** The verified Magic Card source already handles this correctly — `mounted` state defaults to `false`, `isDarkTheme` is memoized to `true` when not mounted (via `if (!mounted) return true`), and the orb-mode `<motion.div>` uses `suppressHydrationWarning` on the dynamic styled element. **Action for the planner: do NOT remove the `mounted` state guard or `suppressHydrationWarning` during tuning.** The tuning diff only changes the default prop values, not the hydration logic.

**Warning signs:** Console warning "Warning: Prop `style` did not match. Server: ... Client: ..." or any "Hydration failed" error tied to Magic Card mount.

`[VERIFIED: Magic Card registry source includes `useState(false)` + `useEffect(() => setMounted(true), [])` + `suppressHydrationWarning` already; preserve this exactly]`

### Pitfall 2: Lightning CSS strips `backdrop-filter` from class names

**What goes wrong:** When `backdrop-filter: blur(5px)` is set via Tailwind utility class or `globals.css` rule, Lightning CSS (Tailwind v4's compiler) silently strips it from the final CSS output. The effect renders without blur. Hard to debug because no error fires.

**Why it happens:** Lightning CSS has a known interaction with `backdrop-filter` under certain conditions in the Tailwind v4 compile pipeline.

**How to avoid:** Apply `backdropFilter` via React inline styles, never via CSS classes. Repo's existing `Header` and `GlassPanel` already follow this pattern. Magic UI primitives DO NOT use `backdrop-filter`, so this is not a direct concern for Phase 1's Magic UI primitives — BUT, if the planner has the executor wrap any Magic UI primitive in a GlassPanel during showcase composition, the GlassPanel inline style already handles it correctly. Just keep it inline.

**Warning signs:** Glass effect missing in Safari/Chrome, but other styles render fine.

`[VERIFIED: CLAUDE.md Known Technical Issues section; existing src/components/layout/header.tsx:62 and src/components/primitives/GlassPanel.tsx:46-53 use inline backdropFilter]`

### Pitfall 3: Tailwind v4 oklch compilation error for very dark colors

**What goes wrong:** Tokens with `L < 0.15` in `oklch()` compile incorrectly in Tailwind v4 `@theme` blocks. The output color is visually wrong (often too light or off-hue).

**Why it happens:** Known Tailwind v4 issue with the oklch parser at the dark end of the lightness spectrum.

**How to avoid:** Use exact hex strings for very dark tokens (`#07080a` `#1a1b1e` `#18191a` etc.). globals.css already does this correctly. Magic UI primitives' tuned defaults stay as exact hex (`#FF7F50`, `#18191a`, `rgba(255,127,80,0.15)`) — do NOT round-trip through `oklch()` for these.

**Warning signs:** Background color visibly different from spec in browser. Comparison via DevTools shows the computed color is off.

`[VERIFIED: CLAUDE.md Known Technical Issues; globals.css uses hex for gray-700 through gray-950 explicitly with a comment "→ hex"]`

### Pitfall 4: Dev server CSS cache holds stale @theme tokens

**What goes wrong:** After changing `globals.css` (e.g. registering `@keyframes shine` post-install) or installing new primitives, dev server keeps showing the old CSS. CSS changes don't appear in the browser even after page reload.

**Why it happens:** Next.js dev caches `.next/` build output + `node_modules/.cache/` + the browser caches CSS files aggressively.

**How to avoid:** Kill dev server, `rm -rf .next/ node_modules/.cache/`, hard-refresh the browser. Repeat the install/tune cycle from a clean cache.

**Warning signs:** New animation registered in globals.css but no shine effect renders on `ShineBorder`. New token referenced in source but old color displayed.

`[VERIFIED: CLAUDE.md Known Technical Issues; recurring footgun documented across multiple v3.0 phase verifications]`

### Pitfall 5: `aliases.ui` silently writes to wrong directory

**What goes wrong:** `npx shadcn add @magicui/magic-card` writes to `src/components/ui/magic-card.tsx` (default `aliases.ui`) instead of the desired `src/components/magic-ui/magic-card.tsx`. No error fires. Mixed up with the existing 36-component design system.

**Why it happens:** `components.json` `aliases.ui` controls the destination directory for all `registry:ui` typed items. Magic UI primitives ARE typed `registry:ui`. The default value in the current `components.json` is `"@/components/ui"`.

**How to avoid:** Flip `aliases.ui` to `"@/components/magic-ui"` BEFORE running `shadcn add`. Run install. Flip back to `"@/components/ui"` AFTER (so future shadcn-native adds land in `ui/`). Verify each step with `cat components.json`.

**Warning signs:** `magic-card.tsx` appearing in `src/components/ui/` directory listing after install instead of the intended `src/components/magic-ui/`.

`[VERIFIED: components.json line 17 = "ui": "@/components/ui"; shadcn registry-item docs cite aliases.ui as the registry:ui destination]`

### Pitfall 6: `@keyframes shine` not auto-injected by shadcn CLI

**What goes wrong:** Shine Border depends on the `shine` CSS keyframe being registered globally. Registry declares it under `css.@keyframes shine`. Some shadcn CLI versions inject this into `globals.css`; others log a warning and skip it.

**Why it happens:** Tailwind v4 + shadcn CLI v4 should auto-inject the `cssVars.theme` and `css` blocks into the configured `tailwind.css` file (`src/app/globals.css`). Older CLI versions don't.

**How to avoid:** After running `shadcn add @magicui/shine-border`, run `grep -n "@keyframes shine" src/app/globals.css`. If 0 matches, manually add the keyframe block from the verified registry source:

```css
/* In globals.css — add inside the @theme block or at module scope */
@keyframes shine {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
  to { background-position: 0% 0%; }
}
```

And ensure the corresponding `animate-shine` utility is registered under `@theme`:

```css
@theme {
  /* ... existing tokens ... */
  --animate-shine: shine var(--duration) infinite linear;
}
```

The `motion-safe:animate-shine` Tailwind class used in the Shine Border source consumes this.

**Warning signs:** Shine Border renders the static mask outline but no animation runs.

`[VERIFIED: Shine Border registry payload includes cssVars.theme and css.@keyframes blocks; UI-SPEC §Shine Border @keyframes injection note flags this explicitly; existing globals.css already has 4 @keyframes blocks at lines 237, 246, 255, 267 — confirms the codebase pattern of in-file keyframe declarations]`

### Pitfall 7: framer-motion vs motion/react import paths

**What goes wrong:** Magic UI primitives import from `motion/react`. The repo has BOTH `motion ^12.29.2` AND `framer-motion ^12.29.3` in package.json (the latter is legacy). If an executor or planner accidentally types `from "framer-motion"` while tuning, the build won't break (because both deps export the same API) but the bundle will double-import the same library.

**Why it happens:** Decades of muscle memory typing "framer-motion." Both libraries have the same API surface today.

**How to avoid:** All NEW motion code uses `motion/react` import path. The 2 existing `framer-motion` imports in `src/components/app/simulation/*.tsx` are legacy and slated for cleanup. The vetting checklist Gate 8 flags this. **The planner should add a verification step: `grep -rn "from \"framer-motion\"" src/components/magic-ui/ → must return 0 matches`.**

**Warning signs:** Bundle size jumps unexpectedly; duplicate `framer-motion` and `motion` entries in `pnpm-lock.yaml` for the same version range.

`[VERIFIED: package.json includes both deps; BRAND-BIBLE.md §6 Bundle pinning rule documents this; grep src/components/motion/ confirms all 5 motion files use "motion/react"]`

### Pitfall 8: Showcase page hydration noise from interactive demos

**What goes wrong:** Adding 4 client subtrees (MagicCard × 2 + BorderBeam + ShineBorder) to the showcase page increases hydration cost. On first paint, the section may flash unstyled briefly.

**Why it happens:** Each `'use client'` primitive ships a separate hydration root in the React tree.

**How to avoid:** Wrap the Magic UI showcase section in a single client boundary if possible (one `'use client'` parent component instead of 4 mounted as siblings) OR accept the cost — `/showcase` is a developer-only route, not a user-conversion surface. Recommend: leave each primitive as its own client subtree, but verify no hydration warnings fire (UI-SPEC SC-4).

**Warning signs:** Brief flash of unstyled content (FOUC) on `/showcase` first paint near the Magic UI section.

`[ASSUMED] — exact severity depends on Next 15 hydration scheduling; verify in browser DevTools console`

---

## Code Examples

### Example 1: Final `src/app/(marketing)/layout.tsx` (Phase 1)

```typescript
// src/app/(marketing)/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/header";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Virtuna",                                          // ← was "Artificial Societies | Human Behavior, Simulated"
  description: "Virtuna — TikTok creator intelligence.",     // ← was AS description
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
```

`[VERIFIED: UI-SPEC §Marketing Layout Metadata Contract prescribes this exact title/description; current layout.tsx structure is preserved]`

### Example 2: Final `src/app/(marketing)/page.tsx` (Phase 1)

```typescript
// src/app/(marketing)/page.tsx
// (No 'use client' — server component. No Footer (Phase 7 ships it).)

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Phase 2: Hero & Trust Band */}
      {/* Phase 3: Three Surfaces bento */}
      {/* Phase 4: How It Works + The Science */}
      {/* Phase 5: Audience Tabs + Social Proof */}
      {/* Phase 6: Tool Consolidation Calculator + Pricing */}
      {/* Phase 7: FAQ + Final CTA + Footer */}
    </main>
  );
}
```

`[VERIFIED: UI-SPEC §Marketing Route Shell Contract prescribes this exact structure]`

### Example 3: Final `src/components/layout/header.tsx` (Phase 1 stubs only)

```typescript
// src/components/layout/header.tsx — DIFF showing only changed lines from current

// CHANGE 1: Wordmark text
// BEFORE: <span className="font-sans text-white">Artificial Societies</span>
// AFTER:
<span className="font-sans text-white">Virtuna</span>

// CHANGE 2: Primary nav CTA — copy + link
// BEFORE:
<Link
  href="https://calendly.com"
  target="_blank"
  rel="noopener noreferrer"
  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
>
  Book a Meeting
</Link>
// AFTER:
<Link
  href="/signup"
  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
>
  Sign up free
</Link>

// CHANGE 3: Mobile CTA (mirror of desktop)
// BEFORE:
<Link
  href="https://calendly.com"
  target="_blank"
  rel="noopener noreferrer"
  className="w-full rounded-lg bg-accent px-4 py-3 text-center text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
  onClick={() => setMobileMenuOpen(false)}
>
  Book a Meeting
</Link>
// AFTER:
<Link
  href="/signup"
  className="w-full rounded-lg bg-accent px-4 py-3 text-center text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
  onClick={() => setMobileMenuOpen(false)}
>
  Sign up free
</Link>

// UNCHANGED: SVG V-mark path, "Sign in" link, all structural chrome (gradient + blur + inset shadow)
```

`[VERIFIED: UI-SPEC §Header Stub Contract; current header.tsx examined verbatim]`

### Example 4: `src/components/magic-ui/index.ts` (NEW barrel export)

```typescript
// src/components/magic-ui/index.ts
export { MagicCard } from "./magic-card";
export { BorderBeam } from "./border-beam";
export { ShineBorder } from "./shine-border";

// Type re-exports — primitives don't ship rich type exports; rely on inferred return type
// for consuming code.
```

`[VERIFIED: UI-SPEC §Component Directory Contract; mirrors src/components/ui/index.ts pattern]`

### Example 5: Pricing page detachment of FAQSection

```typescript
// src/app/(marketing)/pricing/page.tsx — Phase 1 cleanup

// BEFORE:
import { PricingSection } from "./pricing-section";
import { Footer } from "@/components/layout/footer";
import { FAQSection } from "@/components/landing";   // ← will break when landing/ is deleted
import type { Metadata } from "next";

// ... PricingPage rendering <FAQSection /> in the <main> ...

// AFTER:
import { PricingSection } from "./pricing-section";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Virtuna",
  description: "Choose the plan that fits your creator journey. Start with a 7-day free Pro trial.",
};

export default function PricingPage() {
  return (
    <>
      <main>
        <PricingSection />
        {/* FAQ section removed in Phase 1 (was AS-plagiarized). Phase 7 will add a new
            FAQ section here if it's needed on /pricing. */}
      </main>
      <Footer />
    </>
  );
}
```

`[VERIFIED: src/app/(marketing)/pricing/page.tsx examined verbatim; cleanup decision per CONTEXT D-cleanup + Runtime State Inventory finding]`

### Example 6: Magic UI showcase section (appended to `/showcase`)

```typescript
// src/app/(marketing)/showcase/page.tsx — APPEND after the existing "Gradients" ShowcaseSection
// (Keep the existing 780-line page exactly; append a new <ShowcaseSection> at the end of the
// outer <div>, before the closing </div>.)

// New section structure (illustrative — planner adopts UI-SPEC §/showcase Route Addition Contract):

import { MagicCard, BorderBeam, ShineBorder } from "@/components/magic-ui";
// ... existing imports stay ...

// Inside the ShowcasePage return, after the </ShowcaseSection> that closes "Gradients":

<ShowcaseSection
  id="magic-ui"
  title="Magic UI Primitives"
  description="Three vetted primitives tuned to the Raycast design language. These are the tuned versions — stock defaults have been overridden to use coral accent and Raycast motion timing."
>
  {/* Magic Card demo — 2-column ComponentGrid */}
  <ComponentGrid columns={2}>
    <div className="relative h-[200px] rounded-lg overflow-hidden">
      <MagicCard>
        <div className="flex h-full items-center justify-center">
          <Text size="sm" muted>Magic Card — gradient mode</Text>
        </div>
      </MagicCard>
    </div>
    <div className="relative h-[200px] rounded-lg overflow-hidden">
      <MagicCard>
        <div className="flex h-full items-center justify-center">
          <Text size="sm" muted>Magic Card — hover tracking</Text>
        </div>
      </MagicCard>
    </div>
  </ComponentGrid>

  {/* Border Beam demo — single card */}
  <div className="mt-6 relative h-[140px] rounded-lg border border-border bg-surface overflow-hidden">
    <BorderBeam />
    <div className="flex h-full items-center justify-center">
      <Text size="sm" muted>Border Beam — coral sweep</Text>
    </div>
  </div>

  {/* Shine Border demo — single card */}
  <div className="mt-6 relative h-[140px] rounded-lg bg-surface overflow-hidden">
    <ShineBorder shineColor={["rgba(255,127,80,0.8)", "rgba(255,127,80,0.15)", "rgba(255,127,80,0.8)"]} />
    <div className="flex h-full items-center justify-center">
      <Text size="sm" muted>Shine Border — featured card treatment</Text>
    </div>
  </div>

  <div className="mt-6">
    <CodeBlock
      title="Tuned usage"
      code={`import { MagicCard, BorderBeam, ShineBorder } from "@/components/magic-ui";

// Magic Card — gradient mode (coral defaults already tuned)
<MagicCard>
  <div className="p-6">Content</div>
</MagicCard>

// Border Beam — drop into a relative + overflow-hidden parent
<div className="relative overflow-hidden rounded-lg border border-border">
  <BorderBeam />
  <div className="p-6">Card content</div>
</div>

// Shine Border — featured/active card treatment
<div className="relative overflow-hidden rounded-lg bg-surface">
  <ShineBorder />
  <div className="p-6">Featured tier</div>
</div>`}
    />
  </div>
</ShowcaseSection>
```

`[VERIFIED: UI-SPEC §/showcase Route Addition Contract; existing showcase/page.tsx structure examined at lines 736-778 confirms exact append point]`

### Example 7: Vetting checklist verbatim (for BRAND-BIBLE.md)

UI-SPEC §Vetting Checklist Contract is the authoritative version (9 gates, ready to paste). Research confirms the gates cover every known Magic UI failure mode found in registry payload inspection:

- Gate 1 (Color) — catches violet/pink/amber stock defaults found in Magic Card + Border Beam ✓
- Gate 2 (Border opacity) — catches 8%/12% drift ✓
- Gate 3 (Radius) — catches non-12px card radii ✓
- Gate 4 (Motion) — catches sub-6s loops, unguarded reduced-motion (Magic Card source has no built-in guard — must add) ✓
- Gate 5 (Font) — catches embedded font-family (none of the 3 ship with it — confirmed) ✓
- Gate 6 (GlassPanel compat) — catches backdrop-filter class form (none of the 3 use it — confirmed) ✓
- Gate 7 (Dark-mode-first) — catches `dark:` conditional logic; Magic Card uses `useTheme()` which is acceptable (defaults to dark when mounted=false) ✓
- Gate 8 (Bundle size) — pins motion/react over framer-motion; catches GSAP/Lottie/etc. ✓
- Gate 9 (Security) — confirmed all 3 primitives pass (no fetch/eval/process.env per UI-SPEC §Registry Safety table) ✓

**Action:** Planner instructs executor to copy UI-SPEC's checklist verbatim into BRAND-BIBLE.md under a new section heading `## External Library Vetting Checklist` appended after the existing `## Do's and Don'ts` section. The checklist content is already drafted; no rewriting needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| URL form `npx shadcn add https://...json` (still works) | Namespace form `@namespace/component` via `components.json` `registries` field | shadcn CLI v4 — March 2026 [CITED: https://ui.shadcn.com/docs/changelog/2026-03-cli-v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) | Cleaner multi-registry setup; one-time `components.json` edit instead of pasting URLs. Both forms still work. |
| `framer-motion` for animation | `motion/react` (same vendor, renamed package) | 2025 rename | Magic UI registry uses `motion/react` natively. Repo standardized in v3.0; legacy framer-motion only in 2 simulation files. |
| `import { Tabs } from "@radix-ui/react-tabs"` | shadcn-style wrapped components | Established | Repo follows this pattern in `src/components/ui/` for all 36 components. Magic UI follows the same shadcn idiom. |
| Tailwind v3 + tailwind.config.js | Tailwind v4 + `@theme` block in CSS | Tailwind v4 release Q4 2025 [CITED: https://tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide) | Magic UI primitives use Tailwind v4 utilities (`mask-intersect`, `bg-linear-to-l`, `rounded-(length:--var)`). Repo is on v4 — compatible. |
| `dark:` Tailwind conditional + manual theme switch | `next-themes` + `useTheme()` for theme-aware components | 2023 stable | Magic Card uses `useTheme()`. Repo is dark-mode-only but next-themes is the cleanest API for the rare interaction that wants it. |

**Deprecated/outdated:**

- `framer-motion` for new code: still in package.json but BRAND-BIBLE.md §6 pins all new imports to `motion/react`.
- `GradientGlow`, `GradientMesh`, `primitives/GlassCard`: deleted in v2.x cleanup, per CLAUDE.md.
- Tailwind v3 syntax: not applicable in this repo; Tailwind v4 from v2.x onwards.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `next-themes` will install cleanly as a peer of `next ^16.1.5` / `react ^19.2.3` | Standard Stack | If incompatible, install fails. Mitigation: pin to a known-good version; consult [next-themes README](https://github.com/pacocoursey/next-themes) for App Router compat (App Router supported since 0.2.x; current stable >=0.4). LOW risk — `next-themes` has had App Router support since 0.2.x. |
| A2 | shadcn CLI v4 auto-injects `cssVars.theme` + `css.@keyframes` into `globals.css` for registry items that declare them | Pitfall 6 | If CLI doesn't inject, Shine Border won't animate. Mitigation: Pitfall 6 documents the manual fallback (paste keyframe into globals.css). Planner should add a verification step after install. MEDIUM risk — auto-injection behavior varies by CLI minor version. |
| A3 | Magic Card's `mounted`-state guard fully eliminates hydration mismatch warnings under React 19 strict mode | Pitfall 1 | If StrictMode double-rendering surfaces a warning, may need additional `suppressHydrationWarning` on the outer `motion.div` (not just the inner gradient div). Mitigation: load `/showcase` in dev mode with browser DevTools console open after install; if warnings fire, augment the source. LOW risk — the verified source already includes `suppressHydrationWarning` on the inner motion.div. |
| A4 | Tailwind v4's `mask-intersect` + `mask-[linear-gradient(...)]` utilities used by Border Beam compile correctly in this repo's Tailwind v4 + `@tailwindcss/postcss ^4` setup | Pattern 4 / Border Beam | If utilities don't compile (silent CSS strip), Border Beam renders the moving gradient but without the mask — visible bleed outside the border. Mitigation: visual verification on `/showcase`. LOW risk — Tailwind v4 has had `mask-intersect` since 4.0 release. |
| A5 | Deleting `src/components/landing/` and detaching FAQSection from `/pricing` does not break any other downstream surface (Storybook, e2e tests, etc.) | Runtime State Inventory | If e2e tests assert against FAQSection on /pricing, they fail. Mitigation: planner adds a verification step to run `pnpm test` and `pnpm run e2e` after the delete. LOW risk — repo does not appear to have e2e tests specifically targeting the AS-plagiarized FAQ; but verify. |
| A6 | Magic UI namespace registry (`@magicui`) URL template `https://magicui.design/r/{name}.json` continues to resolve to the canonical Magic UI v3 components (not legacy v2) | Standard Stack | If Magic UI rebrands their registry path, install fails. Mitigation: URL form fallback works regardless. LOW risk — Magic UI docs explicitly recommend this URL pattern as of 2026-05-11. |

**Recommendation to planner / discuss-phase:** All assumptions are LOW/MEDIUM risk with documented mitigations. None of them are load-bearing decisions that need user confirmation before execution. The planner can proceed and the executor can verify each in real time.

---

## Open Questions

1. **`aliases.ui` flip strategy — temporarily flip vs. post-install file move?**
   - What we know: Both Option A (flip alias, install, flip back) and Option B (install to ui/, then mv) achieve the same end state.
   - What's unclear: Whether the planner prefers minimizing config diffs (Option A pollutes `components.json` momentarily) or minimizing filesystem moves (Option B pollutes `src/components/ui/` momentarily).
   - Recommendation: Option A (flip alias). It's cleaner: a single CLI invocation lands files in the right place, no `mv` needed, no internal import paths to fix.

2. **Magic UI primitive `index.ts` barrel — flat or scoped?**
   - What we know: Existing `src/components/ui/index.ts` is a flat barrel exporting every component. `src/components/primitives/index.ts` mirrors this.
   - What's unclear: Whether `src/components/magic-ui/index.ts` should follow the same flat barrel OR sub-export by primitive (e.g. `magic-ui/cards/magic-card`).
   - Recommendation: Flat barrel — matches existing conventions. Phase 2 can refactor if structure pressures grow.

3. **Showcase placement order — append after Gradients or insert before code-block demos?**
   - What we know: UI-SPEC says append after Gradients (line 757).
   - What's unclear: None — UI-SPEC is authoritative. Skip.

4. **Tuning the showcase ShineBorder shineColor at the call site vs. inside the source defaults?**
   - What we know: UI-SPEC §3 Shine Border specifies the array form `["rgba(255,127,80,0.8)", ..., "rgba(255,127,80,0.8)"]` for the showcase demo, suggests the default should be the same array.
   - What's unclear: Whether the default prop value should be a string (`"#FF7F50"`) or an array (`[..., ..., ...]`). The TS signature accepts both.
   - Recommendation: Default to the **array form** at the source — matches the showcase visual contract and produces the smooth coral arc instead of a flat coral mask. This is consistent with UI-SPEC §3 tuning table.

5. **Do we keep the `tw-animate-css` dep?**
   - What we know: Already installed (`^1.4.0`). globals.css imports it on line 2.
   - What's unclear: Whether any Magic UI primitive depends on `tw-animate-css` utilities. None observed in source.
   - Recommendation: Keep — it's a stable dep that supports `animate-*` namespace and is harmless if unused.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pnpm` | `pnpm dlx shadcn@latest add`, `pnpm add next-themes` | ✓ (project default) | bundled | `npm` or `npx` invocation works equivalently |
| `node` runtime | Next.js dev/build | ✓ | check `node --version` ≥ 18 | none — required |
| `npx` / `pnpm dlx` | one-shot shadcn CLI | ✓ | bundled | none — required |
| Internet (shadcn registry fetch) | `shadcn add` HTTPS request to `magicui.design/r/*.json` | ✓ | n/a | offline fallback: copy the registry JSON content into a local file, `shadcn add ./local.json` |
| `motion` | runtime motion/react for Magic Card + Border Beam | ✓ | `^12.29.2` (package.json) | none — required |
| `framer-motion` | legacy reference; NOT used by Magic UI primitives | ✓ | `^12.29.3` (package.json) | n/a — legacy, do not extend |
| `next-themes` | Magic Card `useTheme()` import | ✗ — **NOT in package.json** | latest stable | **No fallback — must install before `shadcn add @magicui/magic-card` runs** |

**Missing dependencies with no fallback:**

- `next-themes` — Magic Card source imports it directly. Install BEFORE the shadcn add command, OR the install will succeed but the import will fail at build/runtime. Recommended task ordering: (1) `pnpm add next-themes`, (2) configure components.json registries, (3) flip aliases.ui, (4) shadcn add, (5) tune, (6) flip aliases.ui back.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

> `workflow.nyquist_validation` configuration: `.planning/config.json` was not inspected for an explicit boolean — treating as enabled per default. If the planner determines this milestone has Nyquist validation disabled, this section can be skipped.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` ✓ + Playwright `^1.58.0` ✓ |
| Config files | `vitest.config.*`, `playwright.config.ts` under `e2e/` and `extraction/` |
| Quick run command | `pnpm test` (Vitest run) |
| Full suite command | `pnpm test && pnpm run e2e` |

### Phase Requirements → Test Map

Phase 1 has no direct REQUIREMENTS.md mapping. The four success criteria (SC-1 through SC-4) need validation:

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| SC-1 | `/` renders empty `<main>` with dark bg (no AS plagiarized content) | smoke (manual or e2e) | Manual: open `/` in browser; e2e: `pnpm run e2e -g "marketing route shell"` | ✗ Wave 0 (none exists yet) |
| SC-2 | All 3 Magic UI primitives importable from `@/components/magic-ui` and render correctly on `/showcase` | unit (import smoke) | `pnpm test src/components/magic-ui/` | ✗ Wave 0 (need a smoke test file) |
| SC-2.tuning | Each primitive's stock defaults overridden — Magic Card `gradientFrom = #FF7F50`, Border Beam `colorFrom` is coral rgba, Shine Border `shineColor` is coral array | unit | grep-style assertion in a small test file | ✗ Wave 0 |
| SC-3 | Vetting checklist section present in BRAND-BIBLE.md | smoke | `grep -c "External Library Vetting Checklist" BRAND-BIBLE.md` (expect ≥1) | n/a (no test runner) — verification step in plan |
| SC-4 | No console errors / hydration warnings | manual / DevTools | open browser, watch console on `/` and `/showcase` | manual-only |
| SC-cross | `/pricing` still renders after `src/components/landing/` deletion | smoke | `pnpm run build` (full app build); `pnpm dev` then open `/pricing` | covered by build |
| SC-build | App builds cleanly | smoke | `pnpm run build` | covered |

### Sampling Rate

- **Per task commit:** `pnpm test` (Vitest, ~10s for the small new test files)
- **Per wave merge:** `pnpm test && pnpm run lint && pnpm run build` (~1-2 min)
- **Phase gate:** Full build green + browser smoke check on `/`, `/pricing`, `/showcase` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/magic-ui/__tests__/magic-card.test.tsx` — assert MagicCard import works + default `gradientFrom === "#FF7F50"`
- [ ] `src/components/magic-ui/__tests__/border-beam.test.tsx` — assert BorderBeam import + default `colorFrom` includes "255,127,80"
- [ ] `src/components/magic-ui/__tests__/shine-border.test.tsx` — assert ShineBorder import + default shineColor is an array (coral palette)
- [ ] `tests/integration/marketing-shell.test.tsx` — render `<HomePage />`, assert empty `<main>` (no plagiarized text)
- [ ] No additional test runner install needed (Vitest is already present)

*(If the planner chooses to skip these smoke tests because they're trivially small, the manual verification on `/showcase` covers the same surface — but a small unit test file per primitive is the cheapest invariant-lock against future regressions.)*

---

## Security Domain

> `security_enforcement` config not inspected; treating as enabled by default. Magic UI primitives are client-side visual components — security surface is minimal but the registry-fetch step is worth auditing.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 1 doesn't touch auth |
| V3 Session management | no | n/a |
| V4 Access control | no | Public marketing route, no role gates |
| V5 Input validation | partial | No user input in Phase 1; future phases (calculator, forms) will. Zod is already a dep (`^4.3.6`) |
| V6 Cryptography | no | n/a — no cryptographic operations in Phase 1 |
| V12 File integrity | yes | shadcn registry payload integrity — verify content matches expected source before commit |

### Known Threat Patterns for Phase 1 stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Malicious registry payload (supply-chain — magicui.design serves tampered JSON) | Tampering | UI-SPEC §Registry Safety table records `view passed — no flags` for all 3 primitives as of 2026-05-11. Re-verify by inspecting installed source: must contain no `fetch()`, `XMLHttpRequest`, `process.env`, `eval()`, `new Function()`, dynamic external imports, obfuscated variable names. Gate 9 of the vetting checklist enforces this. |
| Hydration mismatch leaking sensitive content | Information disclosure | n/a — Phase 1 has no sensitive content. Empty shell + showcase placeholders only. |
| XSS via uncontrolled className / style injection | Tampering | Magic UI primitives accept `className` / `style` from parent. No `dangerouslySetInnerHTML` in any source. Standard React safety holds. |
| Open redirect on "Sign up free" CTA | Tampering | CTA links to `/signup` (internal route). No user-controlled href. Safe. |

`[VERIFIED: UI-SPEC §Registry Safety table fetched 2026-05-11; registry JSON inspected verbatim — no flagged patterns found]`

---

## Project Constraints (from CLAUDE.md)

Extracted from the Virtuna project's `CLAUDE.md` — these are project-level directives the planner MUST verify compliance against. Treated with the same authority as locked CONTEXT.md decisions.

| Constraint | Source | Applies to Phase 1? |
|------------|--------|----------------------|
| Stack: Next.js 15, TypeScript, Tailwind v4, Supabase | CLAUDE.md §Identity | yes — all Phase 1 files use TypeScript, Tailwind v4 utilities |
| Phase numbering: milestone-scoped (starts at 1) | CLAUDE.md §Phase Numbering | yes — Phase 1 is correctly numbered 1 (worktree-scoped) |
| Tailwind v4 oklch inaccuracy at L < 0.15 — use hex | CLAUDE.md §Known Technical Issues | yes — Magic Card tuned defaults use exact hex `#18191a` (not `oklch(0.21 0 0)`) |
| Lightning CSS strips `backdrop-filter` from classes | CLAUDE.md §Known Technical Issues | yes — Magic UI primitives don't use backdrop-filter, so no direct application; but executor must remember rule if wrapping in GlassPanel during showcase |
| Dev server CSS caching — clear `.next/` + `node_modules/.cache/` + browser | CLAUDE.md §Known Technical Issues | yes — Pitfall 4 documents the same |
| Setup: `git config core.hooksPath .githooks` | CLAUDE.md §Setup | already configured per CLAUDE.md MEMORY.md — auto-push hook in place |
| Body: #07080a bg, Inter font, letter-spacing 0.2px, antialiased | CLAUDE.md §Raycast Design Language Rules | yes — empty shell `bg-background` resolves to `#07080a` via globals.css; Inter loaded by next/font/google in layout |
| Borders: universal 6%, hover 10% (NOT 8% or 12%) | CLAUDE.md §Raycast Design Language Rules | yes — Vetting Gate 2 enforces; tuning checks rgba(255,255,255,0.06) only |
| Glass pattern locked: linear-gradient(137deg, ...) + blur(5px) + border 0.06 + inset shadow | CLAUDE.md §Raycast Design Language Rules | yes — GlassPanel already follows; Magic UI primitives don't override |
| GlassPanel: zero-config (4 props only) | CLAUDE.md §Raycast Design Language Rules | yes — must not extend or duplicate |
| Cards: bg-transparent, border 0.06, radius 12px, inset shadow 0.05 | CLAUDE.md §Raycast Design Language Rules | yes — Magic Card defaults use `--color-background` for inner fill + transparent border + 12px (inherited from parent class `rounded-lg`) |
| Card hover: `bg-white/[0.02]` only — NO translate-y, NO border change | CLAUDE.md §Raycast Design Language Rules | yes — Magic UI primitives use radial-gradient hover instead of translate; consistent with Raycast no-lift rule |
| Buttons: primary = shadow-button, all sizes 8px radius | CLAUDE.md §Raycast Design Language Rules | yes — Header "Sign up free" CTA uses `rounded-lg` (8px from --radius-md), bg-accent, hover bg-accent/90 |
| Inputs: rgba(255,255,255,0.05) bg, 8px radius, 42px height | CLAUDE.md §Raycast Design Language Rules | n/a — no inputs introduced in Phase 1 |
| Radius scale: 4/6/8/12/16/20/24 | CLAUDE.md §Raycast Design Language Rules | yes — Vetting Gate 3 enforces; only 8px and 12px used in Phase 1 components |
| Key tokens: surface=#18191a, muted=#848586, accent-foreground=#1a0f0a | CLAUDE.md §Raycast Design Language Rules | yes — Magic Card `gradientColor = "#18191a"` matches surface token verbatim |
| Deleted components: GradientGlow, GradientMesh, primitives/GlassCard | CLAUDE.md §Raycast Design Language Rules | yes — Phase 1 does not resurrect them |
| No colored tinting, no glow effects — accents only | CLAUDE.md §Raycast Design Language Rules | yes — Vetting Gates 1, 4 enforce; Magic Card spotlight is the only "glow"-adjacent effect and it's restrained (opacity 0.6, single coral, fade to transparent) |
| Conventions: Server components by default, client only when interactive | CLAUDE.md §Conventions | yes — page.tsx, layout.tsx, showcase/page.tsx remain server components; only Magic UI primitives and Header are `'use client'` |
| Conventions: GSD workflow in `.planning/` | CLAUDE.md §Conventions | yes — Phase 1 plan lives at `.planning/phases/01-foundation-route-scaffolding/01-PLAN-N.md` |
| Conventions: Commit format `type(phase): description` | CLAUDE.md §Conventions | yes — planner instructs executor to use this format on each commit |

---

## Sources

### Primary (HIGH confidence)

- **shadcn CLI docs (current):** [https://ui.shadcn.com/docs/cli](https://ui.shadcn.com/docs/cli) — current `add` syntax including URL, local path, and namespace forms
- **shadcn namespace registry docs:** [https://ui.shadcn.com/docs/registry/namespace](https://ui.shadcn.com/docs/registry/namespace) — exact `components.json` `registries` field syntax
- **shadcn CLI v4 changelog (Mar 2026):** [https://ui.shadcn.com/docs/changelog/2026-03-cli-v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) — confirms current CLI features
- **shadcn Tailwind v4 docs:** [https://ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — confirms v4 install pathway
- **Magic UI registry payloads (verbatim, fetched 2026-05-11):**
  - [https://magicui.design/r/magic-card.json](https://magicui.design/r/magic-card.json) — full source + deps + props verified
  - [https://magicui.design/r/border-beam.json](https://magicui.design/r/border-beam.json) — full source + deps + props verified
  - [https://magicui.design/r/shine-border.json](https://magicui.design/r/shine-border.json) — full source + cssVars + @keyframes verified
- **Magic UI installation docs:** [https://magicui.design/docs/installation](https://magicui.design/docs/installation) — confirms namespace install pattern
- **Magic UI component docs:**
  - [https://magicui.design/docs/components/magic-card](https://magicui.design/docs/components/magic-card)
  - [https://magicui.design/docs/components/border-beam](https://magicui.design/docs/components/border-beam)
  - [https://magicui.design/docs/components/shine-border](https://magicui.design/docs/components/shine-border)
- **Codebase artifacts (verbatim inspection):**
  - `components.json` (current state)
  - `package.json` (dep versions)
  - `src/app/(marketing)/layout.tsx`, `page.tsx`, `pricing/page.tsx`, `showcase/page.tsx`
  - `src/components/layout/header.tsx`
  - `src/components/primitives/GlassPanel.tsx`
  - `src/components/landing/index.ts` (exports list)
  - `src/components/motion/*.tsx` (motion/react usage pattern)
  - `src/hooks/usePrefersReducedMotion.ts`
  - `src/app/globals.css` (token authority + @keyframes inventory)
- **Project canonical references:**
  - `.planning/phases/01-foundation-route-scaffolding/01-CONTEXT.md` (locked decisions)
  - `.planning/phases/01-foundation-route-scaffolding/01-UI-SPEC.md` (UI contract)
  - `.planning/MILESTONE.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
  - `CLAUDE.md` (project Raycast Design Language rules)
  - `BRAND-BIBLE.md` (Design language + Visual Metaphor Lock from v3.0)

### Secondary (MEDIUM confidence)

- **Tailwind v4 mask utilities:** [https://tailwindcss.com/docs/mask-composite](https://tailwindcss.com/docs/mask-composite) — confirms `mask-intersect` is a v4 utility
- **Motion for React + Tailwind v4 compat:** [https://motion.dev/docs/react-tailwind](https://motion.dev/docs/react-tailwind) — confirms motion/react + Tailwind v4 pairing is supported
- **Tailwind v4 migration guide:** [https://tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide)

### Tertiary (LOW confidence — flagged for verification)

- **`next-themes` exact App Router compat version:** assumed >=0.4 based on training knowledge; verify via `npm view next-themes versions` before install (Assumption A1)

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — every dep version verified against `package.json`; registry payloads verified verbatim via `curl`; missing `next-themes` dep confirmed by `grep`
- **Architecture:** HIGH — diagram derived from inspecting actual route files; tier responsibility table matches Next.js 15 RSC defaults
- **Pitfalls:** HIGH — Pitfalls 1-7 derived from verified codebase patterns + CLAUDE.md Known Technical Issues; Pitfall 8 is MEDIUM (depends on Next 15 hydration scheduling specifics — verify in browser)
- **Vetting checklist:** HIGH — UI-SPEC §Vetting Checklist Contract is already drafted; research confirms it covers every known Magic UI failure mode
- **Runtime state inventory:** HIGH — confirmed `FAQSection` cross-route import via grep; no other survival risks found in 5 inventory categories

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 — refresh if shadcn CLI ships v5 or Magic UI restructures their registry
