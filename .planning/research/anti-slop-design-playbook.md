# Anti-AI-Slop Design Playbook

**Status:** Reference for all Linear Landing Clone phases.
**Audience:** gsd-phase-researcher, gsd-planner, gsd-ui-researcher, gsd-ui-checker, gsd-executor.
**Source:** Cross-referenced research 2026-05-19 (6 articles + GitHub repos cross-checked). Findings consolidated for Virtuna's "match-Linear-craft-not-content" milestone scope.

---

## Why AI design output looks generic

LLMs converge on training-data medians. Every vague descriptor in a prompt becomes a gap the model fills with its training-set defaults:

- Inter / Roboto / system fonts
- Purple gradients on white backgrounds
- Centered hero with H1+sub+single-button stack
- 3-column equal-card feature grids
- Default rounded-2xl corners everywhere
- Scattered, unrelated micro-interactions
- Framework-default spacing scales
- "Gradient orbs representing AI" / "CSS silhouette as product placeholder"

The fix is **explicit constraints + negative constraints** at every layer — tokens, components, sections, and the spec itself.

---

## Hard rules for every phase

### Anti-slop blacklist (forbidden patterns — phase fails its visual gate if any appear)

| ID | Forbidden pattern | Refined alternative |
|---|---|---|
| AS-01 | Purple / rainbow / "AI-orb" radial gradients as decoration | Coral `#FF7F50` accents only; atmospheric depth via subtle noise + dark layered backgrounds |
| AS-02 | 3-column equal-card feature grids | Mixed-size bento (Virtuna spec: 2×2 + two 1×1) or asymmetric arrangement |
| AS-03 | Centered hero with stack: H1 + sub + single CTA only | Eyebrow + H1 + sub + **dual CTA** + product UI screenshot (Virtuna spec) |
| AS-04 | Flat white OR flat dark backgrounds | Dark base + atmospheric depth (radial gradient + low-amplitude noise + subtle inset shadows) |
| AS-05 | Default `rounded-2xl` on every card | Explicit per-component radius (Virtuna locked: cards 12px, buttons 8px, modals 12px) |
| AS-06 | Emoji bullets in feature lists | Proper Lucide / Phosphor icons with coral accent treatment |
| AS-07 | "Rounded card with left coral border" — has become AI-cliché | Card variants must vary by content type, not by gimmick |
| AS-08 | "Gradient orb representing AI" or "abstract neural blob" | Real Virtuna product UI screenshots (prediction result card, competitor dashboard, brand deal card) |
| AS-09 | CSS silhouettes / placeholder shapes as product visuals | AVIF/WebP screenshots from real Virtuna app; no abstract `<div>` mockups |
| AS-10 | Scattered, unrelated micro-interactions (every element has its own animation) | Orchestrated entrance sequence per section; once-only on viewport entry; high-impact rather than ambient |
| AS-11 | Framework-default Tailwind spacing scale verbatim | Display-type fluid `clamp()` scale + spacing rhythm tokens specific to landing route |
| AS-12 | "Modern / clean / professional" as the design goal | Specific tone-anchored choices grounded in Linear + Raycast references |
| AS-13 | Generic CTA copy ("Get Started", "Learn More") | Verb-led, Virtuna-specific ("Predict your next post", "See the prediction engine") |
| AS-14 | Stock illustration packs / Unsplash heroes | Original Virtuna illustrations OR real product UI |
| AS-15 | Section-level Framer Motion wrappers (everything fades in) | Leaf-level `m.*` wrappers; section structure stays static |

### Refinement vocabulary

Use these phrasings when prompting Claude (or talking with downstream agents):

- **"Refine"** not "improve" — signals precision, not sweeping rewrite
- **"Tighten"** not "polish" — signals reduction, not addition
- **Specific timings** — "150ms ease-out" not "smooth transition"
- **Specific values** — `border-radius: 12px` not "rounded corners"
- **Negative constraints first** — list what NOT to do before describing what to do
- **Reference anchors** — "in the visual style of linear.app's hero, with Virtuna content" beats descriptors

### Required workflow per section (Phases 2-7)

1. **Section brief** (already required by FOUND-14) — purpose, audience, success criteria, **plus anti-slop list specific to this section**
2. **Structure pass** — semantic HTML + section data-attribute + skeleton layout. No styling. Snapshot.
3. **Typography pass** — type scale, line-heights, letter-spacing applied. No color beyond grayscale. Snapshot.
4. **Color pass** — coral accents, gradient tokens. Snapshot.
5. **Motion pass** — orchestrated entrance + interaction states. Snapshot.
6. **Polish pass** — micro-details (focus rings, hover states, mobile). Final snapshot + side-by-side vs Linear + Raycast.
7. **Anti-slop audit** — score against the AS-01..AS-15 blacklist. Phase fails if ANY hit.
8. **Craft rubric audit** — score against FOUND-12 rubric. 5/6 dimensions must PASS.

---

## Reference assets to capture in Phase 1

Store all in `verification/reference/`:

| Asset | Source | Purpose |
|---|---|---|
| `linear-desktop-1280.png` | linear.app (above-fold) | Craft reference: typography rhythm, spacing, hero composition |
| `linear-tablet-768.png` | linear.app at 768px | Mobile breakpoint craft reference |
| `linear-mobile-375.png` | linear.app at 375px | Mobile-first craft reference |
| `linear-bento.png` | linear.app feature section | Bento grid reference |
| `linear-pricing.png` | linear.app pricing section | Pricing card reference |
| `raycast-desktop-1280.png` | raycast.com (above-fold) | Secondary craft reference: minimalism + density |
| `raycast-feature-section.png` | raycast.com | Feature treatment reference |
| `linear-design.md` | github.com/VoltAgent/awesome-design-md | Plain-text design system for Linear — drop into prompts |
| `raycast-design.md` | github.com/VoltAgent/awesome-design-md | Plain-text design system for Raycast — drop into prompts |

Snapshot once at Phase 1 start. Refresh only if Linear/Raycast meaningfully redesigns (visible difference at first glance).

---

## Component library policy

| Library | Status | Use when |
|---|---|---|
| **Existing Virtuna DS** (36 components in `src/components/ui/`, `primitives/`, `motion/`, `effects/`) | ✅ Primary source | Default. Reuse Card, Button, Glass*, motion wrappers. Fork (don't modify) when landing variant differs. |
| **shadcn/ui** (Radix-based, already in use) | ✅ Allowed | New primitive needed that doesn't exist in DS. Copy in, don't add as runtime dep. |
| **Magic UI** (magicui.design — 150+ animated components, Motion-based) | ✅ Selective copy-paste only | Specific marketing effects that don't exist in DS: stat counter animation polish, animated beam if hero needs one, marquee for partner row. **No bulk install.** Each Magic UI import requires section-brief justification. |
| **Aceternity UI** (28k stars, "shadcn for magic effects") | ⚠️ Discouraged by default | Many of its signature components (3D cards, magnetic buttons, gradient orbs, particle backgrounds) ARE the recognizable AI-aesthetic. Only use a specific effect if no DS/Magic-UI alternative exists AND the section brief justifies the visual cliché risk. |
| **Motion Primitives** (50+ marketing sections) | ⚠️ Reference only | Study patterns. Don't import sections wholesale — they'll feel templated. |
| **VoltAgent/awesome-design-md** (71k stars, 57 brand DESIGN.md files) | ✅ Reference only | Pull `linear.md` + `raycast.md` for context injection. Don't pull layout/copy. |
| **bergside/awesome-design-skills** (67 skill files) | ✅ Optional Claude skill install | If the project benefits from a per-phase auditor skill, consider Taste Skill or Interface Design as a Claude Code skill install. |
| **Leonxlnx/Taste Skill** (13.3k stars, top design skill) | 🔬 Evaluate for Phase 1 | 3-parameter equalizer system + GPT-strict variant. Best-known anti-slop Claude skill. Consider installing as `.claude/skills/taste-virtuna/` for this milestone. |
| **bitjaru/styleseed** (69 design rules + 48 shadcn components + brand skins) | 🔬 Evaluate for Phase 1 | Could install Linear skin and extract its 69 judgment rules into Virtuna's CRAFT-RUBRIC. Don't adopt wholesale — Virtuna already has 36 components. |

---

## Spec-prefix protocol (every phase agent)

Claude does not persist brand context between sessions. Every research/planner/executor session for this milestone MUST receive the design spec as prefix context. Two ways:

1. **Read PROJECT.md + BRAND-BIBLE.md + landing.css token file** at session start (current GSD pattern — adequate for token + token-level rules)
2. **Read `verification/reference/linear-design.md` + `verification/reference/raycast-design.md`** at session start (new — anchors craft expectations to specific brand systems)

`gsd-phase-researcher` and `gsd-ui-checker` agent prompts should explicitly cite these files.

---

## Visual verification protocol (mandatory per-phase gate)

Replaces "Lighthouse only" gating with multi-layer visual verification:

1. **Automated Playwright snapshots** at 375 / 768 / 1280 — per section, per state (default/hover/focus)
2. **Side-by-side audit** — `${phase_dir}/${padded_phase}-VISUAL-AUDIT.md` with each Virtuna section's snapshot next to the Linear/Raycast reference snapshot
3. **AI ui-checker pass** — gsd-ui-checker agent scores each section against the anti-slop blacklist + craft rubric, writes verdict to VISUAL-AUDIT.md
4. **Craft rubric score** — 6 dimensions (typography precision, spacing rhythm, motion choreography, contrast, mobile bar, anti-slop discipline). 5/6 must PASS to ship the phase
5. **Davide visual review** — final human sign-off looking at production build at all 3 viewports

No phase ships without all 5 layers green. This is the bar.

---

## What this changes about existing FOUND requirements

- **FOUND-11** (visual fidelity harness): EXTEND. Add reference snapshot capture script + side-by-side audit doc generator.
- **FOUND-12** (CRAFT-RUBRIC.md): EXTEND. Include the AS-01..AS-15 anti-slop blacklist + 6-dimension scoring + 5/6-pass threshold.
- **FOUND-14** (section brief template): EXTEND. Add required "Anti-slop list for this section" subsection. Add required "Reference anchors (linear.app section + raycast.com section)" subsection.
- **NEW (post-Phase-1)**: Capture frozen Linear + Raycast reference snapshots + DESIGN.md files in `verification/reference/`. Treat as Phase 1 deliverable.

---

## Sources

Cross-referenced 2026-05-19. Treat as snapshot — the underlying tools/repos evolve fast.

- **MindStudio anti-slop articles** — establish the spec-first + replace-adjectives-with-values + component-level-spec techniques
- **bswen.com anti-patterns guide** — full anti-pattern table (Inter/Roboto/purple/centered/3-col defaults)
- **saascity.io vibe coding** — ban-generic-choices + force-creativity-through-specificity + aesthetic-tone-anchoring
- **Anthropic Claude prompting cookbook** — self-correction prompting + production-grade aesthetic patterns
- **github.com/VoltAgent/awesome-design-md** (71k stars) — DESIGN.md files for 57 brands incl. Linear, Stripe, Vercel, Anthropic
- **github.com/bitjaru/styleseed** — 69 design judgment rules + 48 shadcn components + Linear/Stripe/Vercel/Notion brand skins
- **github.com/jiji262/claude-design-skill** — internal Claude design prompt with explicit anti-slop rules
- **github.com/Leonxlnx (Taste Skill)** — 13.3k stars, anti-slop equalizer skill
- **github.com/Dammyjay93 Interface Design** — `.interface-design/system.md` persistence pattern
- **github.com/bergside/awesome-design-skills** — 67 design skills curated for Claude/Cursor/Stitch
- **magicui.design / ui.aceternity.com / motion.dev** — component library evaluations
