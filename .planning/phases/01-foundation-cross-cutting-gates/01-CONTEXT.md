# Phase 1: Foundation + Cross-Cutting Gates - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish every guard, gate, and shared primitive that Phases 2-8 depend on so no derivative-feel, technical pitfall, or AI-slop pattern can be introduced undetected. Scope covers:

1. **Token + cascade isolation** — route-scoped landing token layer that physically cannot leak into the dashboard
2. **Motion architecture** — Lenis + LazyMotion wired only on `(marketing)/`, `m.*` convention established
3. **Visual fidelity harness** — Playwright snapshots @ 375/768/1280 + side-by-side reference comparison + AI ui-checker + craft rubric scoring + Davide visual review
4. **Anti-AI-slop discipline** — explicit blacklist baked into CRAFT-RUBRIC.md, enforced per-phase gate
5. **Section brief workflow** — template + per-phase lazy authoring + reference anchoring
6. **Reference assets** — frozen Linear + Raycast snapshots + DESIGN.md context files
7. **Day-1 baseline** — clean `(marketing)/page.tsx` scaffold with 7 section placeholders ready for Phases 2-7 to populate
8. **Legacy cleanup** — delete 14 files in `src/components/landing/`, delete standalone `/pricing` route (redirect to `/#pricing`)

Phase 1 does NOT build hero, bento, or any visible content sections — those are Phases 2-7.

</domain>

<decisions>
## Implementation Decisions

### Milestone Scope (foundational — propagates to every phase)
- **D-01:** Scope = **"same grammar, original vocabulary"** — match Linear's craft bar, layout grammar, visual language (3D depth, soft gradients, screenshot-forward heroes); original Virtuna copy + illustrations + coral palette. No literal asset reuse from Linear or any reference site (legally indefensible + won't sell Virtuna).
- **D-02:** Secondary craft reference = **raycast.com** (alongside primary linear.app). Both are anchors for typography rhythm, spacing rigor, motion polish, minimalism + density.

### Section Brief Workflow (FOUND-14 extension)
- **D-03:** Briefs written **per-phase, lazy**. Phase 1 writes only the TEMPLATE at `.planning/SECTION-BRIEF-TEMPLATE.md`. Phases 2-7 each write their own brief as the section's first artifact at `${phase_dir}/${padded_phase}-SECTION-BRIEF.md`. Lower upfront cost; brief stays fresh; can incorporate learnings from earlier phases.
- **D-04:** Section brief template MUST include these subsections (extends FOUND-14):
  1. Purpose in Virtuna's narrative
  2. Audience served (creator / investor / partner)
  3. Content — original Virtuna copy
  4. Interaction goals
  5. Success criteria
  6. **Anti-slop list for this section** (which AI-default patterns we're explicitly avoiding)
  7. **Reference anchors** (specific linear.app section + raycast.com section + DESIGN.md citations)

### Visual Verification Protocol (mandatory per-phase gate — extends FOUND-11)
- **D-05:** Per-phase **visual gate** is **5-layer**, all must be green. This is the CRAFT-and-anti-slop gate; it does NOT replace FOUND-13 (technical phase-gate checklist) — both are required to ship a phase:
  1. **Playwright snapshots** — automated @ 375/768/1280 per section per state (default/hover/focus)
  2. **Side-by-side audit doc** — `${phase_dir}/${padded_phase}-VISUAL-AUDIT.md` with Virtuna sections next to Linear/Raycast reference snapshots
  3. **AI ui-checker pass** — gsd-ui-checker agent scores against anti-slop blacklist + craft rubric, writes verdict to VISUAL-AUDIT.md
  4. **Craft rubric scoring** — 6 dimensions (typography precision, spacing rhythm, motion choreography, contrast, mobile bar, anti-slop discipline). **5/6 dimensions must PASS** to ship the phase.
  5. **Davide visual review** — final human sign-off looking at production build (`pnpm build && pnpm start`) at all 3 viewports.
- **D-05a:** **Technical phase-gate checklist (FOUND-13) is also required**, complementing the visual gate. Each phase must additionally pass:
  - Lighthouse mobile LCP < 2.5s + CLS < 0.1
  - Production build verification (`next build && next start` — backdrop-filter rendering, no hydration warnings)
  - Dashboard regression snapshot (Playwright capture of `/app/dashboard` proves zero token leakage from landing route)
  - `git diff --name-only` scope guard (only landing-route + landing-component + landing-hook files changed — zero dashboard files in diff)
  - `landing.css` scope check (D-19) — CI script verifies no imports outside `(marketing)/`
  - **A phase ships only when BOTH the 5-layer visual gate (D-05) AND the technical phase-gate checklist (D-05a / FOUND-13) are green.**
- **D-06:** Phase 1 captures **frozen reference snapshots** in `verification/reference/`:
  - `linear-desktop-1280.png`, `linear-tablet-768.png`, `linear-mobile-375.png` (above-fold)
  - `linear-bento.png`, `linear-pricing.png` (specific sections)
  - `raycast-desktop-1280.png`, `raycast-tablet-768.png`, `raycast-mobile-375.png`
  - `raycast-feature-section.png`
- **D-07:** No live linear.app / raycast.com fetching during automation. Snapshots refreshed only on visible-difference basis (manual update if Linear/Raycast meaningfully redesigns).

### Anti-AI-Slop Discipline (extends FOUND-12)
- **D-08:** CRAFT-RUBRIC.md MUST embed the **AS-01..AS-15 anti-slop blacklist** from `.planning/research/anti-slop-design-playbook.md`. Each forbidden pattern has a refined alternative documented. Phase fails its visual gate if any forbidden pattern appears.
- **D-09:** Per-section workflow follows **layered iteration**: structure → typography → color → motion → polish, with snapshot between each layer. No "generate full section in one shot."
- **D-10:** Prompting vocabulary discipline applies to all phase agents (researcher, planner, executor, ui-checker):
  - "**Refine**" not "improve"; "**tighten**" not "polish" — signals precision over rewrite
  - **Specific values not adjectives** — `border-radius: 12px` not "rounded corners"
  - **Negative constraints first** ("no purple, no centered-stack, no rounded-2xl default, no flat dark") before describing what TO do
  - **Reference-anchored framing** ("in the visual style of linear.app's hero" + "matching raycast.com's spacing rhythm")
  - **Specific timings in motion** — "150ms ease-out" not "smooth"

### Claude Skill + Reference Files (extends Phase 1 scope)
- **D-11:** Install **Taste Skill** (`github.com/Leonxlnx/taste-skill` — 13.3k stars) at `.claude/skills/taste-virtuna/` for this milestone. Provides 3-parameter anti-slop equalizer + GPT-strict variant. Read by gsd-ui-checker as per-phase gate input.
- **D-12:** Fetch **Linear and Raycast DESIGN.md files** from `github.com/VoltAgent/awesome-design-md` (71k stars) into:
  - `.planning/reference/design-md/linear.md`
  - `.planning/reference/design-md/raycast.md` (or closest equivalent if Raycast not in repo)
  Phase researcher / planner / ui-checker agents inject these as design context at session start.

### Component Library Policy (extends D-01)
- **D-13:** **Primary source = existing 36-component Virtuna DS** at `src/components/ui/`, `primitives/`, `motion/`, `effects/`. Fork (don't modify) when landing variant differs — see `LandingFeatureCard` pattern in BENTO-01.
- **D-14:** **shadcn/ui** = allowed for new primitives (copy-paste, Radix-based, already in use). No runtime dep additions.
- **D-15:** **Magic UI** (`magicui.design`, 150+ Motion-based animated components) = selective copy-paste ONLY. Each import requires section-brief justification. No bulk install. Good fit for stat counters (Phase 5/6), animated beams if hero needs one, marquees.
- **D-16:** **Aceternity UI** = **discouraged by default**. Many signature components (3D cards, magnetic buttons, gradient orbs, particle backgrounds) ARE the recognizable AI-aesthetic cliché. Use only if a specific effect is uniquely Aceternity's AND the section brief explicitly justifies the cliché risk.
- **D-16a:** **Other libraries Davide mentioned ("and other libraries")** — same policy as Magic UI (selective copy-paste with section-brief justification per import). Explicit by-name policy:
  - **Motion Primitives** (`motion-primitives.com`, 50+ marketing sections) — reference only, do NOT import sections wholesale (they'll feel templated)
  - **react-bits** (animated components) — selective copy-paste with justification, same as Magic UI
  - **Origin UI** (`coss.com/origin`) — allowed primitive source alongside shadcn, copy-paste only
  - **NextUI / Hero UI** — discouraged (runtime dep + opinionated styling conflicts with Virtuna's existing DS)
  - **Tailwind UI** (paid) — reference only, do NOT copy markup wholesale (it's licensed)
  - **awesome-design-md** files — reference / context injection ONLY, never lifted layout/copy
  - **StyleSeed** (`bitjaru/styleseed` — 69 design rules + brand skins) — DO NOT install (conflicts with Virtuna's 36-component DS). Cherry-pick its 69 design judgment rules into CRAFT-RUBRIC.md if any aren't already covered by AS-01..AS-15.
  - **Any other library** — must be added to this list with a CONTEXT.md amendment + section-brief justification before first import. No silent runtime-dep additions.

### Token Scope + Cascade Isolation (Claude's discretion — locked defaults)
- **D-17:** `landing.css` declares `@layer landing { ... }` (CSS cascade layer) and is imported **ONLY** from `src/app/(marketing)/layout.tsx`. NEVER from root `src/app/layout.tsx`. Dashboard physically never sees the file.
- **D-18:** Token naming prefix `--landing-*` (matches REQ patterns like `--landing-gradient-feature-border` already cited in BENTO success criteria). **No mutations to global `@theme` in `globals.css`** (already locked in FOUND-03).
- **D-19:** Build-time scope check at `scripts/check-landing-scope.ts` — fails CI if `landing.css` is imported anywhere outside `src/app/(marketing)/`. Lightweight grep-based linter.

### Day-1 Baseline Shape (FOUND-02 extension)
- **D-20:** After Phase 1 ships, `src/app/(marketing)/page.tsx` renders **empty scaffold with 7 section placeholders**:
  ```tsx
  <main>
    <section data-section="hero">{/* Phase 2 */}</section>
    <section data-section="bento">{/* Phase 3 */}</section>
    <section data-section="how-it-works">{/* Phase 4 */}</section>
    <section data-section="behavioral-moat">{/* Phase 5 */}</section>
    <section data-section="social-proof">{/* Phase 6 */}</section>
    <section data-section="pricing">{/* Phase 7 */}</section>
    <section data-section="footer">{/* Phase 7 */}</section>
  </main>
  ```
- **D-21:** Each placeholder MUST use `data-section="<name>"` (matches FOUND-11 convention) so Playwright selectors + per-section snapshots work immediately on day 1.

### Legacy Landing + /pricing Route (FOUND-01 + new D-23)
- **D-22:** All 14 files in `src/components/landing/` deleted in a **single commit** (FOUND-01). Verified safe: only used by `(marketing)/page.tsx` + `(marketing)/pricing/page.tsx`.
- **D-23:** Standalone `/pricing` route deleted in same commit. `next.config.ts` adds permanent redirect `/pricing → /#pricing` (anchor to new Phase 7 pricing section). Preserves SEO + inbound bookmarks.
- **D-24:** Other `(marketing)/` routes (`coming-soon`, `primitives-showcase`, `showcase`, `viral-score-test`, `viz-test`) are **out of scope** — untouched.

### Web Vitals Destination (Claude's discretion — extends FOUND-09)
- **D-25:** Phase 1 implements FOUND-09 floor (`console.log` in dev) **AND** wires Sentry web vitals reporter in prod since `@sentry/nextjs` 10.39.0 is already integrated. Trivial addition. Scoped to landing route via route check inside the reporter.

### Bundle Analyzer Baseline (extends FOUND-08)
- **D-26:** `@next/bundle-analyzer` setup includes a documented baseline budget in `.planning/CRAFT-RUBRIC.md`: hero critical path < 200 KB gzipped (POLISH-03 threshold). Phase 1 captures the baseline measurement from the empty-scaffold day-1 build.

### Open Items (Davide owns)
- **D-27:** Davide will define the Virtuna narrative for each section brief (he's the visionary on product story). Phase agents execute on the briefs once written. Agents won't fabricate copy without a brief.

### Claude's Discretion (areas to figure out during planning)
- File structure for `verification/reference/` snapshot capture script (one-time-run vs. checked-in command)
- Whether Taste Skill install is `.claude/skills/taste-virtuna/` (project-scoped) vs `~/.claude/skills/` (global) — recommend project-scoped so it ships with the worktree
- Exact PostCSS / Tailwind v4 invocation order for `@layer landing` compilation — verify against Tailwind v4 docs in Phase 1 research
- Whether `LenisProvider` is implemented inline in `(marketing)/layout.tsx` or extracted to `src/components/landing/lenis-provider.tsx` (recommend extracted — testable + shareable across future marketing routes)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope + requirements
- `.planning/PROJECT.md` — milestone goal, original-content rule, validated requirements list, key decisions (raycast tokens, oklch workaround, glass pattern)
- `.planning/REQUIREMENTS.md` — all 14 FOUND requirements, scope boundaries, out-of-scope exclusions, traceability matrix
- `.planning/ROADMAP.md` §Phase 1 — phase goal, dependencies, success criteria, requirement coverage
- `.planning/STATE.md` — accumulated context + pending todos for the milestone

### Design system + craft references
- `.planning/research/anti-slop-design-playbook.md` — anti-AI-slop techniques + AS-01..AS-15 blacklist + per-phase workflow + GitHub repo recommendations (NEW this session — MANDATORY read for all Phase 2-8 agents)
- `BRAND-BIBLE.md` (repo root) — Raycast design language reference (6% borders, 12px card radius, Inter font, GlassPanel zero-config)
- `CLAUDE.md` (repo root) — Tailwind v4 oklch known issue, Lightning CSS backdrop-filter strip, dev server cache reset protocol

### Codebase maps
- `.planning/codebase/STACK.md` — Next.js 16, React 19, Tailwind v4, Motion 12, framer-motion 12, Radix UI, Supabase, Sentry. Critical: existing `motion` + `framer-motion` deps; Phase 1 wires `LazyMotion` + `m.*` convention.
- `.planning/codebase/STRUCTURE.md` — directory layout, where to add new code, naming conventions, route groups `(app)`, `(marketing)`, `(onboarding)`
- `.planning/codebase/ARCHITECTURE.md` — patterns (server vs client components, route grouping, middleware)
- `.planning/codebase/INTEGRATIONS.md` — Supabase, Whop, Apify, Gemini/DeepSeek, Sentry wiring

### Phase 1 deliverables (created during execution)
- `src/app/(marketing)/landing.css` — route-scoped token layer (FOUND-03)
- `src/components/landing/lenis-provider.tsx` — Lenis wrapper, scoped to `(marketing)/layout.tsx` (FOUND-04)
- `src/app/(marketing)/layout.tsx` — extend to wrap children in LenisProvider + LazyMotion (FOUND-04, FOUND-05)
- `.planning/CRAFT-RUBRIC.md` — craft rubric + AS-01..AS-15 anti-slop blacklist + 6-dimension scoring (FOUND-12, D-08)
- `.planning/SECTION-BRIEF-TEMPLATE.md` — section brief template with 7 required subsections (FOUND-14, D-04)
- `.planning/reference/design-md/linear.md` — fetched from VoltAgent/awesome-design-md (D-12)
- `.planning/reference/design-md/raycast.md` — fetched from VoltAgent/awesome-design-md or equivalent (D-12)
- `verification/reference/linear-*.png` + `raycast-*.png` — frozen reference snapshots (D-06)
- `verification/scripts/visual-comparison.spec.ts` — extended with new section selectors + reference side-by-side (FOUND-11, D-05)
- `scripts/check-landing-scope.ts` — CI scope check (D-19)
- `.claude/skills/taste-virtuna/` — Taste Skill install (D-11)

### External resources (fetched into project)
- `github.com/VoltAgent/awesome-design-md` (71k stars) — source of Linear/Raycast DESIGN.md files
- `github.com/Leonxlnx/taste-skill` (13.3k stars) — Taste Skill install source
- `linear.app` — primary craft reference, snapshot-frozen
- `raycast.com` — secondary craft reference, snapshot-frozen

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Virtuna 36-component DS)
- **`src/components/ui/`** — base DS (button, card, dialog, input, tabs, badge, avatar, toast, typography, skeleton, select). Card variants will be forked for `LandingFeatureCard` in Phase 3 (BENTO-01).
- **`src/components/primitives/`** — Glass-themed primitives (GlassPanel zero-config, GlassInput, GlassModal, CommandPalette). Sticky nav (HERO-01) will use backdrop-filter inline-style pattern from GlassPanel.
- **`src/components/motion/`** — Framer Motion wrappers (FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale). These currently import full `framer-motion`. Phase 1 establishes convention that landing components use `motion/m` (the slim variant) + `LazyMotion` wrapper to avoid the 29 KB bundle hit.
- **`src/components/effects/`** — chromatic aberration, noise textures (atmospheric depth — anti-slop AS-04)
- **`src/hooks/useCountUp.ts`** — animated count-up. Phase 5 (MOAT-03) + Phase 6 (PROOF-02) reuse this.
- **`src/hooks/usePrefersReducedMotion.ts`** — reduced-motion fallback. Wraps motion components in landing for POLISH-02 compliance.
- **`src/hooks/useIsMobile.ts`** — breakpoint hook for the scroll-pinned How It Works fallback (HOW-05).

### Established Patterns
- **Tailwind v4 `@theme`**: Tokens in `src/app/globals.css` via `@theme` block. **Dark colors (L<0.15) MUST use hex not oklch** (Tailwind v4 compile bug — locked in CLAUDE.md). `landing.css` adds route-scoped tokens via `@layer landing`.
- **Backdrop-filter via inline style**: `style={{ backdropFilter: 'blur(5px)' }}`, NOT CSS classes — Lightning CSS strips backdrop-filter from classes. Locked in CLAUDE.md. Critical for HERO-01 sticky nav blur-on-scroll.
- **Route grouping**: `(app)/` has AuthGuard + Providers + AppShell. `(marketing)/` has Header + Footer only. Landing's LenisProvider wraps ONLY `(marketing)/layout.tsx` (FOUND-04) — wrapping `(app)/` breaks Radix dialogs.
- **Motion architecture**: Existing components use full `framer-motion`. Landing convention = `motion/m` + `LazyMotion strict` wrapper.
- **Section IDs**: `data-section="<name>"` for Playwright selectors + scroll anchoring (FOUND-11).
- **AppShell isolation**: Dashboard's `(app)/` layout has its own typography + glassmorphism — landing tokens must not leak (D-17).

### Integration Points
- **`src/app/(marketing)/layout.tsx`** — adds LenisProvider + LazyMotion wrapper (FOUND-04, FOUND-05). Imports `landing.css`.
- **`src/app/(marketing)/page.tsx`** — REPLACE entirely with empty scaffold (FOUND-02, D-20).
- **`src/components/landing/`** — DELETE entire directory (14 files) in single commit (FOUND-01, D-22).
- **`src/app/(marketing)/pricing/`** — DELETE entire directory (D-23). Replaced by Phase 7 pricing section + `/pricing → /#pricing` redirect.
- **`next.config.ts`** — extend with:
  - `images.formats: ['image/avif', 'image/webp']` (FOUND-07)
  - `/pricing → /#pricing` redirect rule (D-23)
  - `@next/bundle-analyzer` wrapper (FOUND-08)
- **`src/app/layout.tsx`** — extend Inter font with `axes: ['opsz']` (FOUND-06). Verify `font-optical-sizing: auto` survives Tailwind v4 base reset.
- **`verification/scripts/visual-comparison.spec.ts`** — extend with new section selectors + reference-snapshot side-by-side (FOUND-11, D-05).
- **`src/components/MotionWrapper.tsx`** (new) — thin `"use client"` wrapper around animated leaves, never section-level (FOUND-10).
- **Sentry config (`sentry.client.config.ts`)** — extend with web vitals reporter scoped to landing route (D-25).

</code_context>

<specifics>
## Specific Ideas

- **Linear.app + Raycast.com** are the named craft references — frozen reference snapshots + DESIGN.md files captured into project at Phase 1.
- **Coral `#FF7F50`** is non-negotiable (PROJECT.md decision, propagates to all phases).
- Davide repeatedly emphasized "**designs you create mostly turn out looking shit and not refined**" — visual verification is the **hardest gate**, not a soft check. 5-layer per-phase gate is the response.
- Davide wants to use **shadcn (already in use), Magic UI (selective), "other libraries"** — interpreted as: case-by-case via section-brief justification, no bulk-install policies. Aceternity discouraged by default per anti-slop research.
- Davide acknowledged **non-technical** — frame future questions in user-visible outcomes, not implementation jargon.
- Davide initially said "match Linear 1:1 with same illustrations and exact design" — corrected through scope discussion to "same grammar, original vocabulary" after surfacing legal + product concerns. Locked decision.

</specifics>

<deferred>
## Deferred Ideas

These came up during discussion or are documented in REQUIREMENTS.md as deferred — preserved here so future phases can pick them up.

- **Live demo widget in hero** (paste TikTok URL → see prediction) — requires API feasibility spike + pricing-tier gating decisions. Future milestone.
- **Real testimonials section with creator quotes** — gather quotes from active users first. Future milestone.
- **Logo strip of brand-deal partners** — gather sufficient partners first. Future milestone.
- **`/about`, `/research`, `/manifesto`** supporting pages — out of scope this milestone; landing CTAs may stub them.
- **Command-K palette on landing** — POLISH-08 explicit deferral. Revisit in next milestone if user value confirms.
- **Light mode variant** — dark-mode first stays. Future.
- **Animated product walkthrough hero** (vs static screenshot) — revisit if static hero underperforms.
- **Reviving paused `milestone/landing-page` or `milestone/landing-page-redesign` branches** — explicitly out of scope (PROJECT.md). Fresh build only.

No reviewed-but-deferred todos (zero matches from `gsd-sdk query todo.match-phase 1`).

</deferred>

---

*Phase: 1-Foundation + Cross-Cutting Gates*
*Context gathered: 2026-05-19*
