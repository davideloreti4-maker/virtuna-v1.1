---
name: Landing Page Redesign
slug: landing-page-redesign
branch: milestone/landing-page-redesign
worktree: /Users/davideloreti/virtuna-landing-page-redesign
started: 2026-05-11
status: bootstrapping
direction: Magic UI + shadcn
predecessor: v3.0 Brand Statement Landing (abandoned 2026-05-11)
---

# Milestone: Landing Page Redesign

## Identity

This worktree is scoped to one milestone — the **Landing Page Redesign**. Phase numbering starts at 1 (milestone-scoped per `~/.claude/rules/gsd-worktree.md`).

## Direction

Replace the current Virtuna landing entry (`/`) with a marketing page built on **Magic UI components** layered over the existing shadcn / Radix primitives already in the repo. The predecessor milestone (v3.0 Brand Statement Landing) shipped Phase 02 with a custom Canvas-based behavioral hero, but the rest of the page still rendered the plagiarized Artificial Societies template — full redesign opted over staged replacement.

## Carryover from predecessor

- `BRAND-BIBLE.md` at repo root — Phase 01 of v3.0 wrote the visual metaphor lock content; preserved as a reference (the new milestone can build on, evolve, or supersede it)
- `src/components/ui/button.tsx` — retained the Radix Slot `asChild` SSR bug fix landed by v3.0 Phase 02 plan 04 (real bug fix, useful regardless of design direction)
- `.planning/milestones/v3.0-brand-statement-landing/` — full v3.0 artifacts archive (REQUIREMENTS.md, ROADMAP.md, all phase plans/summaries/verifications, abandoned external-component policy, BRAND-SPINE vocab spec). Read-only reference if anything from v3.0 should be revived.

## Scoped vs shared

Per `~/.claude/rules/gsd-worktree.md`:

- **Scoped (this milestone only):** STATE.md, REQUIREMENTS.md, ROADMAP.md, phases/, research/
- **Shared (read or append-only):** PROJECT.md, MILESTONES.md, milestones/, config.json, reference/
- **Append-only:** This MILESTONE.md is immutable after the milestone closes

## Bootstrap notes

- Worktree forked from `main @ 11985b2` (v3.0 abandonment commit)
- Hooks enabled: `git config core.hooksPath .githooks`
- Pre-commit is currently a no-op (the v3.0 vocab guardrail was archived); new milestone can re-enable or replace

## Next steps

Run `/gsd-new-milestone "Landing Page Redesign"` from inside this worktree to bootstrap PROJECT.md updates and route into requirements gathering.
