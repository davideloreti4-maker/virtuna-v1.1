# Milestone: Landing v2 — Refined Marketing Site

**Branch:** `milestone/landing-v2`
**Worktree:** `~/virtuna-landing-v2/`
**Started:** 2026-06-14
**Forks from:** `main` @e07dbd6d

> Immutable worktree identity. Scope all planning operations to this milestone.

## Identity

A **refined, from-scratch marketing landing page** for **Numen** (TikTok virality
intelligence). This is the **marketing surface only** — not the product app. Built
to the bar set by Linear, Raycast, sandcastles.ai, and OpusClip: premium, dark,
minimal, motion-rich but tasteful.

## Why from scratch

Five prior landing attempts were all judged **not good enough** and are abandoned
(reference only, do **not** revive their code):
`milestone/landing`, `milestone/landing-page`, `milestone/landing-page-redesign`,
`milestone/landing-linear-clone`, `milestone/numen-landing`.

## Source of truth

- **Vision (input brief):** `.planning/LANDING-VISION.md`
- **Requirements:** `.planning/REQUIREMENTS.md` (created by `/gsd-new-milestone`)
- **Roadmap:** `.planning/ROADMAP.md` (created by `/gsd-new-milestone`)

## Hard constraints / scope

- **Marketing surface only.** No engine, no app logic, no Supabase product flows
  beyond a waitlist/CTA. Engine + board untouched (they live on `main`).
- **All platform/product visuals are PLACEHOLDERS** — sized, labelled stand-ins for
  screenshots/videos/demos the human swaps in later. Build the slots, not the assets.
- **Component/motion libs permitted** (executor discretion, within the taste bar):
  shadcn/ui, Radix, Magic UI, Aceternity UI, motion (Framer Motion).
- **Visual North Star:** refined > flashy. Linear/Raycast restraint + considered motion.
- Numen brand carries over from `main`: coral accent (#FF7F50), Inter, dark
  (#07080a) Raycast aesthetic, "Stele" logo + "Numen" wordmark.

## Models (this worktree)

- **All GSD agents → `claude-opus-4-8`** (quality profile, see `config.json`).
- **`cc` main session → Opus 4.8 (1M) @ max effort** (see `.claude/settings.local.json`).

## Phase numbering

Milestone-scoped, restarts at **Phase 1** (per project convention).
