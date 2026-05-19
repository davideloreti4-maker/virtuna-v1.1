# Phase 1: Foundation + Cross-Cutting Gates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 01-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 1-foundation-cross-cutting-gates
**Areas discussed:** Milestone scope clarification, Section brief workflow, Anti-AI-slop research integration, Day-1 baseline shape, /pricing route fate, Claude design skill installation

---

## Milestone Scope Clarification

User initial answer: "i want the same illustrations and exact design but with our colors and copy"

Claude flagged this as a hard constraint conflict with PROJECT.md + REQUIREMENTS.md's original-content rule. Surfaced two issues:
1. **Legal** — Linear's illustrations and copy are their copyrighted assets. Recoloring doesn't create a new work; would generate a takedown notice within weeks of launch.
2. **Product** — Linear's composition sells Linear (issue tracker for engineering teams). Won't communicate Virtuna's value (TikTok content prediction).

Presented a re-scoping table distinguishing **what can be matched (grammar)** vs **what can't be lifted (vocabulary)**.

| Option | Description | Selected |
|--------|-------------|----------|
| Same grammar, original vocabulary | Match Linear's layout grammar (sections, proportions, motion patterns), visual language (3D depth, soft gradients, screenshot-forward heroes), and craft bar — with ORIGINAL Virtuna illustrations in that style, Virtuna copy, coral palette. Defensible legally + sells Virtuna. | ✓ |
| Pixel-clone Linear | Literal lift of illustrations + copy with color swap. Documented copyright infringement, won't communicate Virtuna's value, requires re-opening REQUIREMENTS.md. | |
| Decide section by section | Lock "same grammar, original vocabulary" as default; flag individual sections for stricter discussion in later CONTEXT files. | |

**User's choice:** Same grammar, original vocabulary
**Notes:** This locks the foundational scope decision for the entire milestone. Captured as D-01.

---

## Secondary Craft Reference

User comment: "if you need additional reference you can also use raycast main landing page"

No options presented — taken as a direct addition. **Raycast.com locked as secondary craft reference alongside primary Linear.app.** Captured as D-02.

---

## Section Brief Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Per-phase, written at start of that phase | Phase 1 writes only template; Phases 2-7 each write their own brief as the section's first artifact. Lower upfront cost, brief stays fresh, can incorporate learnings. | ✓ |
| All 7 briefs upfront in Phase 1 | Write all 7 briefs in Phase 1 before any markup. Locks narrative arc end-to-end but bloats Phase 1 and risks rewrites if later phases learn something. | |
| Hybrid: hero + bento briefs in Phase 1, rest lazy | Front-load the two highest-stakes briefs (hero + bento set tone), rest lazy. | |

**User's choice:** Per-phase, lazy (option 1) — plus added scope note: "utilize shadcn, magic ui and other libraries"
**Notes:** Component library addition captured as D-13..D-16 (Virtuna DS primary, shadcn allowed, Magic UI selective, Aceternity discouraged). Brief template extension captured as D-04.

---

## Visual Verification (raised by user, not asked)

User comment (interrupting): "important we need visual verification, designs you create mostly turn out looking shit and not refined. visual verification is important"

This is the strongest user feedback in the discussion. Triggered:
1. Memory save: `feedback_visual_verification_required.md` (persistent feedback for future sessions)
2. Research request: techniques + GitHub repos for anti-AI-slop UI output
3. 5-layer per-phase visual gate captured as D-05..D-07

No options were presented for the verification protocol itself — Claude proposed a 5-layer gate (Playwright snapshots + side-by-side audit + AI ui-checker + craft rubric + Davide visual review) based on cross-referenced research findings, and locked it as a Claude's discretion call. User has implicit veto via further conversation.

**User's directive:** Visual verification is non-negotiable.
**Notes:** Drove the largest chunk of Phase 1 scope additions (D-05 through D-12).

---

## Anti-AI-Slop Research (user-requested)

User comment: "and research also online what you can do to improve claudes design quality output so it doesnt look like the ai slop"

Cross-referenced 6 web sources + multiple GitHub repos. Key findings:

**Techniques** (consensus across sources):
- Negative constraints in prompts (most-overlooked)
- Replace adjectives with values
- Component-level specs, not just tokens
- Reference-anchored framing
- Layered iteration with snapshot between layers
- "Refine" not "improve" vocabulary
- Spec-prefix every session (Claude doesn't persist brand context)

**GitHub repos discovered:**
- `VoltAgent/awesome-design-md` (71k stars) — 57 brand DESIGN.md files incl. Linear, Raycast
- `Leonxlnx/taste-skill` (13.3k stars) — top anti-slop Claude design skill
- `bitjaru/styleseed` — 69 design judgment rules + 48 shadcn components
- `jiji262/claude-design-skill` — adapted from Claude.ai's internal design prompt
- `Dammyjay93/Interface Design` (4.7k stars) — `.interface-design/system.md` persistence
- `bergside/awesome-design-skills` — 67 design skills for Claude/Cursor/Stitch

All findings consolidated into `.planning/research/anti-slop-design-playbook.md` and the memory file `anti_ai_slop_playbook.md`.

**No options presented to user** — research synthesized into the playbook + memory. User's input came at the next decision point (which skill to install).

---

## Day-1 Baseline Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Empty scaffold with 7 section placeholders | `<main>` with `<section data-section="...">` × 7. Visible structure, snapshots possible, Lighthouse runs, easy to demo progress per phase. | ✓ |
| Bare `<main>` with just `<h1>Virtuna</h1>` | Absolute minimum. Snapshots show nothing, harder to verify foundation works end-to-end. | |
| Holding page (clean coming-soon) | Looks "done" but wastes Phase 1 effort and creates a section that needs deleting in Phase 2. | |

**User's choice:** Empty scaffold with 7 section placeholders
**Notes:** Captured as D-20, D-21.

---

## /pricing Route Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Delete /pricing, redirect to /#pricing | Phase 1 deletes standalone route, adds `/pricing → /#pricing` redirect in next.config.ts. Single source of truth, preserves SEO. | ✓ |
| Keep /pricing, refactor off landing/ dependency | Keep standalone page, rewrite to not import `FAQSection` from `src/components/landing/`. Two pricing surfaces, double maintenance burden. | |
| Defer the decision to Phase 7 | Phase 1 only refactors the import dependency. `/pricing` survives temporarily; Phase 7 revisits. | |

**User's choice:** Delete /pricing, redirect to /#pricing
**Notes:** Captured as D-23. Other `(marketing)/` routes (showcase, coming-soon, viz-test, etc.) stay untouched (D-24).

---

## Claude Design Skill Install

| Option | Description | Selected |
|--------|-------------|----------|
| Install Taste Skill + drop in Linear/Raycast DESIGN.md | 13.3k-star anti-slop Claude skill + 71k-star awesome-design-md files. Phase 2-8 sessions read these as design context. Highest leverage anti-slop tooling. | ✓ |
| Just our own CRAFT-RUBRIC.md — no third-party skills | Phase 1 writes the rubric + anti-slop blacklist; no external skills. Lower-overhead, fully owned, but misses 13.3k-star refined toolchain. | |
| Install Taste Skill only — skip DESIGN.md files | Skill alone provides anti-slop rules. Skip brand-specific DESIGN.md (could feel like overfitting to Linear/Raycast). | |
| Just drop DESIGN.md files — skip the skill | Plain-text Linear + Raycast design systems in `.planning/reference/`, read manually. No Claude skill install. Lower ceiling but predictable. | |

**User's choice:** Install Taste Skill + drop in Linear/Raycast DESIGN.md
**Notes:** Captured as D-11, D-12. Phase 1 deliverables expand to include skill install + DESIGN.md fetch.

---

## Claude's Discretion

Decisions where Claude locked sensible defaults without asking, based on requirements + research + obvious-right-answer status:

- **Token scope isolation mechanism** (D-17, D-18, D-19) — `@layer landing` + route-scoped import + CI scope check. Tailwind v4 cascade-layer standard.
- **Web Vitals destination** (D-25) — console.log in dev + Sentry web vitals in prod (Sentry already integrated; trivial addition).
- **Bundle analyzer baseline budget** (D-26) — POLISH-03 threshold (200 KB gzipped hero critical path) captured in CRAFT-RUBRIC.md at Phase 1 baseline.
- **5-layer visual verification structure** (D-05) — Playwright + side-by-side + ui-checker + rubric + human review.
- **Reference snapshots strategy** (D-06, D-07) — frozen, refreshed on visible-difference basis. No live fetching.

---

## Deferred Ideas

Documented in REQUIREMENTS.md "Future Requirements (deferred)" and PROJECT.md "Out of Scope" — re-noted in 01-CONTEXT.md `<deferred>` section:

- Live demo widget in hero
- Real testimonials section
- Logo strip of brand-deal partners
- `/about`, `/research`, `/manifesto` supporting pages
- Command-K palette on landing
- Light mode variant
- Animated product walkthrough hero (vs static screenshot)
- Reviving paused landing-page / landing-page-redesign branches

No reviewed-but-deferred todos (zero matches from `gsd-sdk query todo.match-phase 1`).
