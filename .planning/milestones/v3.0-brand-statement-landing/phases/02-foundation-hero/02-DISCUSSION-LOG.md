# Phase 2: Foundation & Hero — Discussion Log

**Discussed:** 2026-05-10
**Mode:** Default (1 round of question, full delegation)
**Outcome:** User delegated all gray-area calls to Claude. CONTEXT.md captures 39 implementation decisions made by Claude grounded in Phase 1 locked brand/tech context and the Anthropic / Linear / Raycast / Vercel reference set.

---

## Round 1 — Gray Area Selection (multiSelect)

**Question:** "Phase 2 (Foundation & Hero) — which implementation areas do you want to discuss before planning?"

**Options presented:**

1. **Scaffold strategy** — How does the new hero coexist with the current plagiarized landing during Phases 2-5? Build directly into `(marketing)/page.tsx`, build in parallel route `/landing-v2` and swap at Phase 6, or feature-flag toggle.
2. **Hero particle visual** — Phase 1 D-07 explicitly delegated to Phase 2: particle count, aggregation center, convergence geometry, initial distribution.
3. **Ambient gradient backdrop** — HERO-07 left composition open. Full-bleed vs scoped. Static vs subtle drift. Coral intensity.
4. **External component policy** — BUILD-02 requires "rejection criteria documented". Strict no-import vs selective imports vetted for Raycast-native feel.

**User selection:** "im non technical you decide"

**Interpretation:** Full delegation across all 4 gray areas. User retains override on the final CONTEXT.md before plan-phase.

---

## Claude's Calls (rationale-stamped)

### 1. Scaffold Strategy → Build directly into `(marketing)/page.tsx`, section-by-section swap

**Reasoning:**
- REQUIREMENTS.md BUILD-09 explicitly forbids `/landing-v2` as end state.
- Vercel preview deployments on PR branches already give Davide a review channel without prod swap.
- Feature-flag toggle adds runtime branching with zero benefit since Vercel previews suffice.
- Frankenstein-in-progress (new hero + old middle sections) is acceptable for 4-6 weeks because the legacy violation already exists (per 01-PLAGIARISM-AUDIT.md).

**Rejected alternatives:**
- Parallel `/landing-v2` route — forbidden by REQUIREMENTS.
- Feature flag — unnecessary complexity.

---

### 2. Hero Particle Visual → 250 desktop / 120 mobile particles, drift+attract → coral confidence pill ("87%"), 70/30 coral/neutral, 2.0-2.4s one-shot

**Reasoning:**
- **Count**: Phase 1's 200-400 sweet spot; matches `hive` viz density at smaller scale; 60fps headroom on mid-range mobile.
- **Aggregation target**: A coral confidence chip — the hero promises *prediction*, so the most honest visual is the actual output (a confidence number). Coral pill matches Raycast badge aesthetic + brand color anchor. Not a video frame (confusing — creator hasn't pasted a URL yet, competes with H1).
- **Convergence geometry**: drift+attract reads organic ("audience reacting individually then aggregating") vs. mechanical radial collapse or algorithmic spiral.
- **Initial distribution**: uniform random — "your audience = many distinct individuals, distributed". Clustering would imply pre-existing groups (wrong story).
- **Color split**: 70/30 telegraphs "majority of your audience responds positively → high confidence" at the converged state.
- **Duration**: 2.0-2.4s — viewer sees the aggregation, doesn't feel slow.

**Locked from Phase 1 (not re-litigated):**
- Canvas 2D, no third-party particle library (D-08).
- Reduced-motion = static converged keyframe (D-10).
- One-shot animation on viewport entry, never a loop.
- `easeOutCubic` from `use-hive-animation.ts:57`.

**Delegated to researcher:**
- Exact percentage value inside the chip (D-34).
- Exact motion equations / attractor curves (D-36).

---

### 3. Ambient Gradient → Full-bleed radial, static, coral-restrained Raycast-style

**Reasoning:**
- **Full-bleed radial**: anchors the convergence point in the visual layout.
- **Static, not animated**: the particle viz IS the motion; gradient is the still backdrop. Reduces motion-design complexity; matches Raycast's static-gradient hero; satisfies `prefers-reduced-motion` with the same keyframe.
- **Coral restrained (~15-25% peak opacity)**: an accent, not a brand-forward wash. Matches Anthropic / Linear / Raycast restraint. Brand-forward coral wash would conflict with the locked reference set aesthetic.
- **Pure CSS implementation**: free in bundle terms, renders before JS hydrates (good for LCP per Phase 5 BUILD-04).

**Rejected alternatives:**
- Animated drift gradient — extra motion competes with the particle viz.
- Brand-forward coral wash — conflicts with restrained reference aesthetic.
- SVG / Canvas gradient — wasted complexity vs. pure CSS.

---

### 4. External Component Policy → Strict NO IMPORT for Phase 2 hero

**Reasoning:**
- Reference set (Anthropic / Linear / Raycast / Vercel) all build their own primitives.
- Maximalist motion libraries (Aceternity, Magic UI) directly conflict with the locked restraint aesthetic.
- Phase 2's hero is well-served by raw Tailwind + 36-component design system + Canvas 2D — no gap that an import fills.
- A rejection-criteria doc still ships as the BUILD-02 artifact, future phases (3-4) MAY revisit individual imports per the criteria.

**Rejection criteria encoded** (in the upcoming `02-EXTERNAL-COMPONENT-POLICY.md`):
- Maximalist motion (animated beams, background gradient animations, neon glow) → REJECT.
- Ships its own font / color tokens / primitives → REJECT.
- Conflicting peer dep on `motion@12` / `framer-motion@12` / `next@16.1.5` / `react@19.2.3` / `tailwindcss@4` → REJECT.
- > 10KB gzipped for a single component → REJECT.
- Accessibility gaps (no reduced-motion, no SR alternatives) → REJECT.

---

## Additional Decisions Made (not in original gray areas, but natural extensions)

- **Hero layout (D-21)**: two-column desktop (text left, canvas right), stacked on mobile.
- **CTA routing (D-27, D-28)**: primary → `/dashboard` (middleware handles auth); secondary → `#science` smooth-scroll anchor (forward-compatible).
- **Component organization (D-30..D-33)**: new components in `src/components/landing/`, PascalCase, drop old plagiarized `hero-section.tsx`.
- **H1 typography (D-23)**: Inter 300 (Light), tight line-height ~1.05, tight tracking -0.02em, `clamp()` size in researcher-tunable range.

---

## Items Flagged for Davide

- **[GATE] Phase 1 hero-copy sign-off** — VERIFICATION SC2 flagged `human_needed`. The orchestrator proxy stamp is on `01-REPLACEMENT-COPY.md`; Davide should personally read the hero block and confirm before plan-phase starts.
- **[REVIEW] This CONTEXT.md** — Davide either approves the 39 delegated calls or redirects specific decisions before plan-phase.

---

## Deferred Ideas (captured for future phases)

- Engine pipeline diagram — Phase 3 (WORKS-01..06).
- A/B hero variants — out of scope.
- Light-mode variant — out of scope.
- Sound design — out of scope.
- In-app prediction viz rebuild — separate future milestone.
- Hover/click on confidence chip — not in spec.
- Magic UI / Aceternity imports — explicitly rejected for Phase 2; revisitable in Phases 3-4.

---

## Scope Creep Redirected

None — user delegated to Claude's calls; no scope creep raised.

---

*Discussion completed: 2026-05-10*
*Mode: full delegation*
*Output: 02-CONTEXT.md with 39 implementation decisions*
