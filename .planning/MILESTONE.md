# Milestone: v5.0 Numen Rework

**Branch:** `milestone/numen-rework`
**Worktree:** `~/virtuna-numen-rework/`
**Started:** 2026-06-13
**Forks from:** `main` @e07dbd6d

> Immutable worktree identity. Scope all planning operations to this milestone.

## Identity

Presentation-layer UI/UX rework to the Numen vision. Collapse the product to **one
thread per video (a "Reading")**; mobile-first; **retheme + restructure the EXISTING
board/app components** (NOT a ground-up rebuild). The first AI turn IS the Reading.

## Source of truth

- **Brief (LOCKED):** `.planning/NUMEN-REWORK-BRIEF.md` — supersedes `NUMEN-SURFACE-VISION.md`
- **Requirements:** `.planning/REQUIREMENTS.md`
- **Roadmap:** `.planning/ROADMAP.md`

## Hard constraints

- **Engine FROZEN at 3.19.0** — no `lib/engine/` changes (presentation only).
- **Reuse** `src/components/board/**` visuals as drill-downs (transplant off Konva, reskinned).
- **Do NOT reuse** `milestone/numen-surface`'s `numen/` + `reading/` kit (reference only).
- **Konva canvas retired**; `/analyze` left dormant (not deleted).
- **Score-forward, no prose narration.**
- The **flat-warm visual system is HUMAN-UAT-GATED** (locked only after human review).
- **Component/motion libs permitted** at executor discretion: Radix, shadcn, MagicUI,
  Aceternity, motion (Framer Motion) — within the flat-warm + calm-motion taste bar.

## Phase numbering

Milestone-scoped, restarts at **Phase 1** (per project convention).
