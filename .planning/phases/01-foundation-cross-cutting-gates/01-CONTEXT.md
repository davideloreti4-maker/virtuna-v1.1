# Phase 1: Foundation + Cross-Cutting Gates - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish every gate, guard, and shared primitive that subsequent phases (2-8) depend on:
- Route-scoped token layer (`landing.css` with display scale, motion easings, gradient tokens)
- Motion architecture (Lenis smooth-scroll + LazyMotion + `m.*` API)
- Visual fidelity harness (Playwright `visual-comparison.spec.ts` with new section selectors)
- Craft quality rubric (`CRAFT-RUBRIC.md`)
- Section brief template (`SECTION-BRIEF-TEMPLATE.md`)
- Deletion of legacy landing artifacts (14 files in `src/components/landing/` + reset `(marketing)/page.tsx`)

Phase 1 ships **no user-visible content** — it ships infrastructure that gates production polish in phases 2-8. The deliverable is a clean baseline empty landing page that passes Phase-1 gate criteria, plus the rubric/brief docs and updated harness.

</domain>

<decisions>
## Implementation Decisions

### Route group scope
- **D-01:** `LenisProvider`, `LazyMotion` provider, and `landing.css` import all wire into `src/app/(marketing)/layout.tsx`. Sibling pages (`/pricing`, `/showcase`, `/coming-soon`, `/viral-score-test`, `/viz-test`) inherit Lenis smooth-scroll — acceptable; not regressing them.
- **D-02:** All landing-specific CSS variables in `landing.css` use `--landing-*` prefix (e.g., `--landing-display-1`, `--landing-ease-out-expo`, `--landing-gradient-feature-border`). No mutations to `globals.css` `@theme`. Zero token-leakage into dashboard routes.
- **D-03:** Researcher MUST verify no Radix dialog / popover usage on `(marketing)/pricing` (Radix scroll-locking conflicts with Lenis). If any found, add `data-lenis-prevent` attribute or refactor.

### Token sourcing strategy
- **D-04:** Extract Linear's craft tokens directly from `linear.app` via DevTools CSS variable inspection: display type scale (`clamp()` math), motion easings (cubic-bezier curves), tracking/line-height/letter-spacing values, spacing rhythm. These are the *craft execution layer* and the milestone explicitly allows them as references.
- **D-05:** Coral `#FF7F50` overrides every color decision. Linear's purple-gradient palette is the boundary — do not adopt.
- **D-06:** `--landing-gradient-feature-border` uses coral + Raycast neutrals (defined fresh from Virtuna's existing token system in `globals.css`). Researcher proposes 2-3 candidate gradient compositions; user selects in Phase 3.
- **D-07:** Display scale fluid `clamp(min, preferred, max)` values: extract Linear's three primary display sizes (H1 hero, H2 section, H3 card) as starting point; rename to `--landing-display-{1,2,3}`. Body and label scales use existing `--font-size-*` tokens from `globals.css`.

### Craft rubric design
- **D-08:** `CRAFT-RUBRIC.md` defines 5 dimensions, numeric 1-5 per dimension:
  1. Typography precision (display scale execution, tracking, line-height)
  2. Spacing rhythm (vertical rhythm, section padding, element gaps)
  3. Motion smoothness (60fps, hardware-accelerated, no jank)
  4. Mobile responsive (375 / 768 / 1280 px)
  5. WCAG AA contrast (5.4:1+ body, 7.2:1 buttons)
- **D-09:** Pass threshold: every dimension ≥ 4, average ≥ 4.4. Below threshold → BLOCK.
- **D-10:** Applied by `gsd-ui-auditor` agent at phase verification (`/gsd-ui-review` workflow). User does final side-by-side review.
- **D-11:** Rubric stays at `.planning/CRAFT-RUBRIC.md` (shared across all landing phases, milestone-scoped).

### Section brief design
- **D-12:** `SECTION-BRIEF-TEMPLATE.md` is lightweight 1-page with 6 fields:
  1. Purpose in Virtuna narrative (what does this section persuade the visitor of?)
  2. Target audience emphasis (creator / broader short-form / investor — primary + secondary)
  3. Original copy draft (eyebrow / H1-H3 / sub / body bullets / CTAs)
  4. Interaction goals (what the visitor *does* — scroll, hover, tap CTA)
  5. Ban-list pointer (no Linear phrasing, no purple gradient, no `viral` / `AI` in H1)
  6. Success criteria (what "done" looks like for this section)
- **D-13:** Each phase 2-7 produces `.planning/phases/NN-.../NN-SECTION-BRIEF.md` BEFORE any markup. The brief is filled in conversation between user and Claude at the top of `/gsd-plan-phase` for that phase. No markup commits without a committed brief.
- **D-14:** Template lives at `.planning/SECTION-BRIEF-TEMPLATE.md`. Phase 1 produces template + one worked example (annotated empty brief showing what each field looks like populated).

### Visual fidelity baseline
- **D-15:** Two-track verification:
  - **Regression track:** `verification/scripts/visual-comparison.spec.ts` updated with `data-section="<name>"` selectors. First-ship Playwright snapshots at 375 / 768 / 1280 px become the self-baseline. All subsequent runs diff against self-baseline (regression detection, not craft judgment).
  - **Craft judgment track:** Linear screenshots used by `gsd-ui-auditor` agent for side-by-side qualitative review during rubric scoring. Never pixel-diff (impossible + derivative risk).
- **D-16:** `data-section="<name>"` attribute is a documented convention. Phase 1 documents it in `CRAFT-RUBRIC.md` (or a sibling `.planning/landing-conventions.md` if cleaner — planner decides).
- **D-17:** Baseline empty landing page for Phase 1 verification: `<main data-section="placeholder" />` with nav-height spacer + minimal H1 so Lighthouse mobile LCP/CLS measurements run cleanly. Real hero arrives in Phase 2.

### Implementation choices (Claude's Discretion)
- **D-18:** Old landing deletion: single commit. Removes 14 files in `src/components/landing/` + resets `src/app/(marketing)/page.tsx` to baseline placeholder. Git history is the backup. No `_legacy/` folder, no archive tag.
- **D-19:** Motion package strategy: landing route imports from `motion@12.29.2` (use `m.*` + LazyMotion). Dashboard stays on `framer-motion@12.29.3`. Both coexist. Future consolidation phase out of scope.
- **D-20:** `next/font` Inter config gets `axes: ['opsz']` added to existing config (verify via `font-optical-sizing: auto` check post-build). One file change, no provider swap.
- **D-21:** `next.config.ts` updated minimally: add `images.formats: ['image/avif', 'image/webp']`. Keep existing `transpilePackages` + Sentry wrapper untouched.
- **D-22:** `@next/bundle-analyzer` added as devDep with `ANALYZE=true pnpm build` documented in `package.json` scripts and README snippet.
- **D-23:** Web Vitals: `useReportWebVitals` logs to console in dev. Vercel Analytics wiring deferred to Phase 8 (POLISH-04 Lighthouse covers measurement; production analytics is a separate concern).
- **D-24:** `MotionWrapper` pattern: documented as thin `"use client"` leaf-level wrappers around `m.div`. Phase 1 ships ONE worked example component (`src/components/landing/MotionWrapper.tsx`) + JSDoc explaining the rule. Subsequent phases follow the pattern.
- **D-25:** Visual-fidelity-harness update is additive: keep existing societies.io comparison spec methods, add new `landing-section-snapshot` test suite scoped to `data-section` selectors. Dashboard regression coverage stays intact.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone identity & boundaries
- `.planning/MILESTONE.md` — worktree identity, original-content rule, craft reference vs. content boundary
- `.planning/PROJECT.md` — Virtuna product identity, current milestone scope, key decisions log
- `.planning/REQUIREMENTS.md` — 14 FOUND requirements for this phase (FOUND-01 through FOUND-14)
- `.planning/ROADMAP.md` §"Phase 1: Foundation + Cross-Cutting Gates" — goal, depends-on, success criteria

### Repo conventions
- `CLAUDE.md` (project root) — Virtuna stack, Raycast design language rules, known technical issues (Tailwind v4 oklch inaccuracy, Lightning CSS backdrop-filter stripping, dev server cache)
- `BRAND-BIBLE.md` (project root) — Raycast Design Language reference, dashboard token system (must stay intact; landing tokens never override)
- `~/.claude/rules/gsd-worktree.md` — GSD multi-worktree conventions for this worktree

### Existing code touchpoints
- `src/app/(marketing)/layout.tsx` — to be extended with LenisProvider + LazyMotion + landing.css import
- `src/app/(marketing)/page.tsx` — to be reset to baseline placeholder
- `src/components/landing/` — to be deleted in full (14 files)
- `verification/scripts/visual-comparison.spec.ts` — to be extended with `data-section` selectors
- `next.config.ts` — to be extended with `images.formats`
- `src/app/globals.css` — read-only reference; landing.css must not collide with `@theme` definitions here

### Outputs created by this phase (referenced by phases 2-8)
- `.planning/CRAFT-RUBRIC.md` — 5-dimension rubric, applied at each phase's `/gsd-ui-review`
- `.planning/SECTION-BRIEF-TEMPLATE.md` — required template for each section brief in phases 2-7
- `src/app/(marketing)/landing.css` — `--landing-*` token layer
- `src/components/landing/MotionWrapper.tsx` — worked example of the motion wrapper pattern

### Reference materials (researcher fetches at plan-phase time)
- `linear.app` — live token extraction target (DevTools → Computed → CSS variables). Researcher pulls display scale `clamp()` values, easing cubic-beziers, tracking/line-height ratios, spacing scale. **Tokens only — never copy.**
- Lenis docs — version 1.3.23, `LenisProvider` React integration, Radix dialog interaction caveats
- `motion@12.29.2` docs — LazyMotion + `m.*` pattern, bundle savings ~29KB

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`(marketing)/layout.tsx`**: Existing layout already imports Inter via `next/font/google` with `display: "swap"` and `variable: "--font-inter"`. Extending it with `axes: ['opsz']` (FOUND-06) is a one-line change.
- **`globals.css` `@theme` block**: Existing Tailwind v4 token system defines the dashboard's Raycast tokens. Landing.css uses `--landing-*` prefix to coexist without override.
- **`verification/scripts/visual-comparison.spec.ts`**: Existing Playwright harness for societies.io regression. Pattern reused for landing self-baseline (new `data-section` selectors).
- **`framer-motion` usage in dashboard**: Existing components (`simulation/`, `viral-results/`) confirm Motion is wired and working in the repo. Landing uses the renamed `motion` package + LazyMotion for tree-shaking — coexistence is fine.

### Established Patterns
- **Server components by default**: Marketing layout is a server component; LenisProvider must be a `"use client"` wrapper composed into the server layout.
- **Route group scope**: `(app)`, `(marketing)`, `(onboarding)` already established. Landing piggybacks on `(marketing)` — no new group.
- **Verification scripts**: Existing pattern is one spec file per harness purpose. Landing additions follow this.

### Integration Points
- **`(marketing)/layout.tsx`** ← new: `LenisProvider`, `LazyMotion`, landing.css link, Web Vitals reporter mount
- **`next.config.ts`** ← new: `images.formats: ['image/avif', 'image/webp']`
- **`package.json`** ← new: `lenis@1.3.23`, `@next/bundle-analyzer` devDep, `analyze` script
- **`src/app/(marketing)/page.tsx`** ← reset to baseline placeholder
- **`verification/scripts/visual-comparison.spec.ts`** ← extend with `data-section` based snapshot suite

</code_context>

<specifics>
## Specific Ideas

- User directive: **"match Linear 1:1"** at the craft execution bar. Interpretation: extract Linear's display scale, easings, tracking, spacing, motion timings directly. Palette stays coral. Content stays Virtuna-original.
- User has limited technical knowledge for these foundation choices — delegating to Claude/researcher for implementation specifics. Defaults locked in `<decisions>` reflect that.
- Section brief stays lightweight — user must be able to fill it in conversation at the top of each subsequent phase without writing prose for hours.

</specifics>

<deferred>
## Deferred Ideas

- **Light mode variant** — explicitly out of scope (PROJECT.md, REQUIREMENTS.md). Dark-mode first.
- **Live demo widget in hero** (paste TikTok URL → see prediction) — deferred to its own milestone (REQUIREMENTS.md "Future Requirements").
- **Vercel Analytics production wiring** — deferred to Phase 8 or post-milestone. Phase 1 only wires `useReportWebVitals` console logging.
- **Motion package consolidation** (migrate dashboard from `framer-motion` to `motion`) — out of scope. Coexistence accepted.
- **Command-K palette on landing** — explicit deferral (PROOF-08 / REQUIREMENTS.md "Future Requirements").
- **`_legacy/` folder for old landing components** — rejected; git history is the backup.

</deferred>

---

*Phase: 1-foundation-cross-cutting-gates*
*Context gathered: 2026-05-19*
