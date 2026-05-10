# Phase 1: Foundation & Route Scaffolding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 1-Foundation & Route Scaffolding
**Areas discussed:** First primitive landed (with forced sub-questions on install path and verification surface)

---

## Areas Presented (initial multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Empty shell content | What does a visitor see at `/` after Phase 1? Truly blank `<main>`? Minimal placeholder? Header + section anchors stubbed? | |
| Magic UI install path | shadcn registry (`npx shadcn add @magicui/...`), npm dependency, or hand-copy into `src/components/magic-ui/`? | (covered as sub-question of "First primitive landed") |
| First primitive landed | Which Magic UI component proves the pattern — something loud (marquee/beam), something quiet for Phase 2 hero (border-beam/magic-card), or simplest possible install? | ✓ |
| Vetting + cleanup | Vetting checklist contents/location + scope of plagiarized cleanup (delete `src/components/landing/*` and AS metadata now or defer)? | |

**User's choice:** First primitive landed (single area)

---

## First primitive landed

### Sub-question 1: What kind of Magic UI primitive should land in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Hero-targeted | Something Phase 2 will reuse — Border Beam, Magic Card, Animated Gradient Text, Shine Border. Proves the install path AND gives Phase 2 a head start. | ✓ |
| Background/atmosphere | Something that sets dark-mode mood — Dot Pattern, Grid Pattern, Aurora, Particles. Proves dark theme integration without being content-specific. | |
| Motion-decorative | Something loud that stress-tests Raycast-native vetting — Animated Beam, Meteors, Sparkles. Validates the 'no maximalist motion' guardrail catches the wrong ones. | |
| Simplest possible | Trivial install just to prove pipeline works — Marquee, Number Ticker. Defer aesthetic decisions to Phase 2. | |

**User's choice:** Hero-targeted ("if design is done in phase 2 just go with 1")
**Notes:** User trusted Claude's framing that Phase 2 owns hero design and selected the option that supports Phase 2 without locking composition. Captured in CONTEXT.md `<specifics>`.

### Sub-question 2: Which specific hero-targeted primitive?

| Option | Description | Selected |
|--------|-------------|----------|
| Magic Card | Gradient-following hover card. Fits the "layered UI fragments" brief directly — Phase 2 can compose 2-3 of these as floating UI tiles on dark gradient. | ✓ |
| Border Beam | Subtle animated border outline. Most Raycast-native of the set — reusable for hero CTAs, surface bento tiles, pricing card highlight. | ✓ |
| Shine Border | One-shot gleam-on-load border treatment. Quietest motion — lowest risk of feeling 'maximalist'. Reusable on primary CTA + Pro tier card. | ✓ |
| Let me check what's there | Show the Magic UI hero-category catalog so I can pick — I want to see actual options before committing. | |

**User's choice:** "do all 3" — Magic Card + Border Beam + Shine Border
**Notes:** Slight expansion past the "at least one" Phase 1 success criterion, but defensible — they share install pattern and each maps forward to a distinct future phase (2/3/6). Captured as D-01 in CONTEXT.md.

### Sub-question 3: How do these 3 Magic UI primitives land in the codebase?

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn registry CLI | `npx shadcn@latest add https://magicui.design/r/<name>.json` — components land as editable source files in `src/components/magic-ui/`. Recommended Magic UI install path. | ✓ |
| Hand-copy from docs | Copy component source from magicui.design into `src/components/magic-ui/` manually. Same end state as CLI but no tool dependency. | |
| npm install + re-export | If a published `magic-ui-react` npm package exists, install it and re-export through a thin wrapper. Trades editability for upgrade path. | |

**User's choice:** shadcn registry CLI
**Notes:** Matches the project's existing shadcn convention in `src/components/ui/`. Captured as D-04 in CONTEXT.md.

### Sub-question 4: How do we verify the 3 primitives feel Raycast-native after install?

| Option | Description | Selected |
|--------|-------------|----------|
| Showcase route | Add the 3 primitives to existing `/showcase` route with Raycast-tuned tokens applied — visible side-by-side with existing 36 components. Eyeball before Phase 2 commits. | ✓ |
| Dedicated sandbox route | New `/showcase/magic-ui` route just for vetting external imports. Keeps the main showcase clean; flagged as internal-only. | |
| Inline on `/` | Drop them directly into the (otherwise empty) marketing route as a Phase 1 stub — Phase 2 then rebuilds `/` around them. | |
| Install only, verify in Phase 2 | Install + token-tune the source files; defer visual verification to Phase 2 when they're actually composed into the hero. | |

**User's choice:** Showcase route + "use magic ui as much as you want"
**Notes:** Two signals — (1) existing `/showcase` is the verification surface, (2) latitude to pull additional primitives beyond the initial 3 where useful. Captured as D-02 (latitude with guardrail) and D-07 (verification surface) in CONTEXT.md.

---

## Claude's Discretion

Areas the user did not select for discussion (only "First primitive landed" was selected). Captured in CONTEXT.md `<decisions> → Claude's Discretion`:

- **Empty shell content at `/`** — Planner discretion guided by Phase 1 success criteria (intentionally-empty + dark-mode tokens + no console errors).
- **Marketing layout metadata** — Currently plagiarized AS title/description. Planner discretion to update in Phase 1 with neutral `title: "Virtuna"` (recommended) or defer to Phase 8 Copy Finalization.
- **Plagiarized landing components cleanup scope** — Planner discretion to delete `src/components/landing/*` in Phase 1 (recommended — dead code once Phase 1 stops importing; v3.0 archive preserves them) or leave as orphans for Phase 8.
- **Header treatment** — Planner discretion to scrub AS branding in `src/components/layout/header.tsx` during Phase 1 (recommended: minimal Virtuna stub) or defer to Phase 2.
- **Vetting checklist location** — Planner discretion (strong default: BRAND-BIBLE.md). Contents minimum spelled out in CONTEXT.md D-06.

## Deferred Ideas

- Brand spine sentence finalization (Phase 8 — per MILESTONE.md policy of "emerges during build, not pre-locked")
- Hero composition (Phase 2)
- Bento tile treatments using Border Beam (Phase 3)
- Pricing card flourish using Shine Border (Phase 6)
- Aceternity / Origin UI / Cult UI integrations (future phases as needs surface — vetting checklist generalizes)
- Lighthouse / mobile / a11y audits (Phase 8)
- Plagiarized header copy full polish (Phase 2 if only stubbed in Phase 1)
