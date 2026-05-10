# Phase 1: Foundation & Route Scaffolding - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the plagiarized Artificial Societies template currently rendered at `/` with an empty, production-ready marketing route shell, and establish the Magic UI integration + Raycast-native vetting pattern that every subsequent phase (2-8) composes into. No requirement from REQUIREMENTS.md maps directly to this phase — success is measured by what Phase 2 can build on without re-deciding install paths or aesthetic gates.

</domain>

<decisions>
## Implementation Decisions

### Magic UI Primitives (Phase 1 deliverable)
- **D-01:** Three hero-targeted primitives land in Phase 1: **Magic Card**, **Border Beam**, **Shine Border**. They are sibling primitives that share install pattern and map forward to Phase 2 (hero layered UI tiles + CTA accent), Phase 3 (surface bento tile treatments), and Phase 6 (Pro-tier pricing card flourish).
- **D-02:** Phase 1 has latitude to pull additional Magic UI primitives beyond the initial 3 if they support showcase coverage or unlock Phase 2 hero composition — **but every additional primitive must pass the Raycast-native vetting checklist before being committed**. This preserves the vetting pattern as Phase 1's load-bearing artifact.
- **D-03:** Phase 1 will NOT pull primitives from Aceternity / Origin UI / Cult UI. Magic UI is the only external source vetted this phase. The vetting checklist (D-06) generalizes to those other libraries for future phases.

### Install Path
- **D-04:** Use the **shadcn registry CLI** to install Magic UI primitives: `npx shadcn@latest add https://magicui.design/r/<name>.json`. Components land as editable source files in `src/components/magic-ui/` (or equivalent directory aligned with existing `src/components/ui/` shadcn structure). The planner determines the exact target directory based on existing conventions.
- **D-05:** Installed primitive source files are **tuned during install** to use Raycast tokens — strip default Magic UI gradients (often violet/purple) in favor of coral/neutral palette where colored accents are needed, and reduce motion duration/intensity to match the Raycast/Linear/Vercel idiom. No "drop in stock, tune later" — the vetted version is what lands.

### Vetting Pattern
- **D-06:** Phase 1 produces a **documented Raycast-native vetting checklist** that every future external-library import (Magic UI, Aceternity, Origin UI, Cult UI) must pass before being committed. Location: planner decides — strong default is `BRAND-BIBLE.md` (it's the established design-language reference and already discoverable). Checklist contents at minimum:
  - Color audit (no purple/violet/blue defaults bleeding through — must use Raycast neutral palette + coral accents only)
  - Border opacity audit (universal `white/[0.06]`; hover `white/[0.10]`)
  - Border radius audit (cards 12px, inputs/buttons 8px, modals 12px)
  - Motion audit (subtle, no neon glow, no maximalist beams everywhere, no auto-looping high-contrast animations)
  - Font audit (Inter only, no embedded `font-family` overrides)
  - GlassPanel compatibility (does this composes with the existing GlassPanel zero-config pattern?)
  - Dark-mode-first (no `dark:` conditional logic that assumes light-mode base)
  - Bundle size sanity check (no surprise heavy deps like Framer alternatives the project doesn't already use)

### Verification Surface
- **D-07:** Verify the 3 primitives feel Raycast-native by adding them to the existing **`/showcase` route** (`src/app/(marketing)/showcase/`), composed alongside the existing 36-component design system. Eyeball test before Phase 2 commits to using them in the hero. No dedicated separate sandbox route — keeps the showcase as the single design-system source of truth.

### Claude's Discretion
- **Empty shell content at `/`** — Phase 1 must replace the plagiarized AS-style render in `src/app/(marketing)/page.tsx`. User did not lock the exact replacement. Planner's discretion guided by Phase 1 success criterion #1 ("clean, intentionally-empty marketing route … with the existing dark-mode design tokens applied") and #4 ("renders without console errors and without React hydration warnings"). Reasonable default: minimal `<main>` containing nothing more than what's required to render the existing `<Header />`-only layout cleanly + dark-mode background; OR a centered placeholder element ("Landing page rebuild in progress" or empty `<section>` stubs for the 10 future sections). Avoid: importing any of the existing `src/components/landing/*` AS-style sections.
- **Marketing layout metadata** — Current `src/app/(marketing)/layout.tsx` declares `title: "Artificial Societies | Human Behavior, Simulated"` and a matching description. This is direct plagiarism and is in this phase's blast radius (the route shell). Planner discretion: update metadata to a neutral Virtuna-correct title/description as part of Phase 1 (recommended, because the metadata ships with whatever route shell lands), OR defer to Phase 8 (Copy Finalization). If updating now, do NOT pre-lock the brand spine — use a placeholder like `title: "Virtuna"` until Phase 8.
- **Plagiarized landing components cleanup scope** — `src/components/landing/*.tsx` (HeroSection, BackersSection, FeaturesSection, StatsSection, CaseStudySection, PartnershipSection, FAQSection, etc.) are no longer imported once Phase 1 stops referencing them in `page.tsx`. Planner discretion to either:
  - Delete them in Phase 1 to prevent future re-import mistakes (recommended — they're dead code the moment Phase 1 ships, and v3.0 archive preserves them if anything is salvageable), OR
  - Leave them in place as orphans for Phase 8's cleanup audit.
  Pick one and document the choice in PLAN.md.
- **Header treatment** — Current `<Header />` is rendered by the marketing layout. It carries AS-template branding signals (logo, nav copy). Planner discretion to either include it in the Phase 1 cleanup pass (replace logo/nav copy with Virtuna placeholders) or treat the header as a Phase 2 concern. Recommended: minimal Virtuna-correct header text adjustments in Phase 1 (logo wordmark, nav stub) so the empty shell doesn't ship visibly plagiarized chrome.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & requirements
- `.planning/MILESTONE.md` — Worktree identity, 10-section landing structure, anti-patterns, brand-spine policy ("emerges during build, not pre-locked"), v3.0 carryover policy
- `.planning/REQUIREMENTS.md` — All 36 milestone requirements; Phase 1 has **no direct requirement mapping** (enabling infrastructure)
- `.planning/ROADMAP.md` §"Phase 1: Foundation & Route Scaffolding" — Phase goal + 4 success criteria (intentionally-empty route, ≥1 Magic UI primitive vetted, vetting checklist documented, no console/hydration warnings)

### Design language & tokens (MUST follow when tuning Magic UI primitives)
- `BRAND-BIBLE.md` — Raycast Design Language reference (v3.0 Phase 01 artifact, carried over; **evolvable in this milestone**). The vetting checklist (D-06) likely lives here as a new section.
- `CLAUDE.md` §"Raycast Design Language Rules (Verified 2026-02-08)" — Authoritative tokens: 6%/10% borders, GlassPanel zero-config, radius scale (4/6/8/12/16/20/24), key hex values (#07080a bg, #18191a surface, #848586 muted, #FF7F50 coral, #1a0f0a accent-foreground)
- `src/app/globals.css` — Tailwind v4 `@theme` block where coral scale + neutral scale + radius/blur tokens are defined; primitives must consume these, not declare their own
- `src/components/primitives/GlassPanel.tsx` (if present) — Zero-config glass component; vetting checklist must confirm Magic UI primitives compose with this, not against it

### Existing code anchors (touched in Phase 1)
- `src/app/(marketing)/layout.tsx` — Marketing layout with AS-plagiarized metadata; in Phase 1's blast radius
- `src/app/(marketing)/page.tsx` — Currently imports AS-style sections; Phase 1 replaces this entirely
- `src/components/landing/` — All AS-style sections; Phase 1 stops importing (deletion is planner's discretion per D-cleanup)
- `src/components/layout/header.tsx` — Marketing-route chrome; carries AS branding signals
- `src/app/(marketing)/showcase/` — Existing design-system showcase route; Phase 1 adds Magic UI primitives here for vetting (D-07)
- `src/components/ui/` (existing 36 components) — Sibling directory pattern that informs where `magic-ui/` lives (planner picks final path)

### Read-only reference (v3.0 archive — predecessor)
- `.planning/milestones/v3.0-brand-statement-landing/` — Full v3.0 artifacts (REQUIREMENTS.md, ROADMAP.md, phase plans/verifications, BRAND-SPINE vocab, abandoned external-component policy). Read-only reference only — this milestone does not revive v3.0's flow.

### Worktree & project rules
- `~/.claude/rules/gsd-worktree.md` — Worktree conventions (phase numbering, scoped vs shared files, auto-push hook)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/ui/` (36 components)**: shadcn-style internal design system already at Raycast token parity. New `magic-ui/` directory should mirror this structure (one file per component, barrel export via `index.ts`).
- **`src/components/primitives/`**: Lower-level primitives (likely including GlassPanel). Magic UI primitives should compose alongside, not duplicate.
- **`src/app/(marketing)/showcase/`**: Existing design-system showcase route — Phase 1 verification surface per D-07.
- **`src/app/(marketing)/coming-soon/`**: Existing placeholder-style route; serves as a reference for what an "intentionally empty" surface looks like in this codebase.
- **`src/components/landing/`**: All AS-plagiarized — explicitly NOT reusable; flagged for non-import (planner discretion to delete entirely).

### Established Patterns
- **shadcn + Tailwind v4 `@theme` block** — Tokens defined in `globals.css`; components consume CSS variables, not literal hex/rgba. Magic UI primitives must be tuned to read from these variables.
- **Server components by default, client only when interactive** (per `CLAUDE.md`). Magic Card / Border Beam / Shine Border all involve client-side motion → must be `'use client'`. Acceptable but should be noted in the source files.
- **Radix Slot `asChild` SSR bug fix** in `src/components/ui/button.tsx` (carryover from v3.0 Phase 02 plan 04) — if any Magic UI primitive uses Radix Slot, this fix may need to propagate.
- **GlassPanel zero-config** (4 props: children, className, style, as). Magic UI primitives should not declare competing glass treatments.
- **`React.useId()` for SSR-safe unique IDs** (per `CLAUDE.md`) — if any Magic UI primitive ships with module-level counters, swap to `useId()` during the vetting tune.

### Integration Points
- **Marketing layout (`src/app/(marketing)/layout.tsx`)** — Phase 1 blast radius for metadata + `<Header />` decisions.
- **Marketing route (`src/app/(marketing)/page.tsx`)** — Phase 1 replaces entirely; Phase 2 composes the hero into the same file.
- **Showcase route (`src/app/(marketing)/showcase/`)** — Add Magic UI section composed alongside existing 36-component showcase.
- **`globals.css` `@theme` block** — No new tokens expected in Phase 1; primitives consume existing tokens.

</code_context>

<specifics>
## Specific Ideas

- User explicitly trusted Claude to pick the primitive type once told that Phase 2 owns the hero design ("if design is done in phase 2 just go with 1"). Translate as: Phase 1 chooses primitives that *support* Phase 2 hero work without committing to specific hero composition. Magic Card + Border Beam + Shine Border meet that bar.
- User said "use magic ui as much as you want" — interpret as latitude (not mandate) to install additional primitives beyond the initial 3 where it accelerates Phase 2-6 work. Guardrail (D-02): every additional primitive must pass the vetting checklist before commit.
- Showcase route is the verification surface — Phase 1 ships a section in `/showcase` demonstrating the 3 (or more) installed primitives composed cleanly with the existing 36-component system. Eyeball test, not unit test.

</specifics>

<deferred>
## Deferred Ideas

- **Brand spine sentence finalization** — Per MILESTONE.md policy, the H1/voice/brand-spine sentence is discovered during implementation, finalized by COPY-02 in Phase 8. Phase 1 does NOT lock any sentence; if marketing-layout metadata is updated in Phase 1, use a neutral `title: "Virtuna"` only.
- **Hero composition** — Belongs to Phase 2. Phase 1 installs primitives; Phase 2 decides how Magic Card tiles layer on the dark gradient.
- **Bento tile treatments using Border Beam** — Phase 3 concern. Phase 1 just installs.
- **Pricing card flourish using Shine Border on Pro tier** — Phase 6 concern. Phase 1 just installs.
- **Aceternity / Origin UI / Cult UI integrations** — Deferred to future phases as needs surface; vetting checklist from Phase 1 (D-06) generalizes to gate them.
- **Plagiarized header copy cleanup beyond Phase 1's scope** — If Phase 1 only stubs the header (logo wordmark + nav placeholder), full marketing-chrome polish is Phase 2 (because hero gates how the header feels in context).
- **Lighthouse / mobile / a11y audits** — Phase 8 (System Hardening). Phase 1 only requires "no console errors, no hydration warnings."

</deferred>

---

*Phase: 1-Foundation & Route Scaffolding*
*Context gathered: 2026-05-11*
