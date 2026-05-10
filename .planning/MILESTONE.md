---
name: Landing Page Redesign
slug: landing-page-redesign
branch: milestone/landing-page-redesign
worktree: /Users/davideloreti/virtuna-landing-page-redesign
started: 2026-05-11
status: planning
direction: Magic UI + shadcn (+ selective other libraries vetted to feel native to Raycast aesthetic)
predecessor: v3.0 Brand Statement Landing (abandoned 2026-05-11)
---

# Milestone: Landing Page Redesign

## Identity

This worktree is scoped to one milestone — the **Landing Page Redesign**. Phase numbering starts at 1 (milestone-scoped per `~/.claude/rules/gsd-worktree.md`).

## Goal

Replace the abandoned plagiarized Artificial Societies template at `/` with a from-scratch, production-quality marketing landing built on Magic UI + shadcn that converts TikTok creators while reading as venture-quality to investors/press — and codify a new brand spine *through* the build, not before it.

## Audience

Dual-audience landing — primary conversion = TikTok creators; secondary = investors / press / partners (brand impression). Sectioned narrative serves both.

## Bar

**Production landing.** Real conversion-tuned, mobile responsive, original copy throughout. Not "MVP redo" (we're past good-enough) and not "$100M venture statement piece" (no obsessing over reference-set fidelity).

## Brand spine policy

NOT pre-locked. The H1, voice, positioning, and brand-spine sentence are **discovered during implementation**, not in this planning step. v3.0's "Your audience, simulated" is **released**, not locked. `BRAND-BIBLE.md` (from v3.0 Phase 01) is treated as an evolvable reference; can be superseded as the new spine emerges.

## Section structure (10 sections, single page, top-to-bottom)

1. **Hero** — eyebrow (`VIRTUNA · A NUMEN MACHINES PRODUCT`) + H1 + subhead + primary CTA (`Sign up free`) + soft secondary + layered UI fragments visual (Raycast pattern; upgrade-to-video kept open)
2. **Logo strip / social proof band** — directly under hero (creator count or press logos)
3. **Three Surfaces bento** — Prediction · Competitor Intelligence · Brand Deals, with visuals embedded *inside* tiles
4. **How it works** — numbered engine pipeline (Linear "1.0 → 5.0" pattern, subtle motion)
5. **The Science** — chronological behavioral-research timeline (ElevenLabs pattern)
6. **Built for creators / Built for investors** — audience-tab section
7. **Social proof** — static 3-up testimonial grid + accuracy/platform metrics (no carousels)
8. **Tool consolidation calculator** — interactive "Virtuna replaces N tools, saves $X/mo" widget (Notion pattern), bridges into pricing
9. **Pricing** — Starter/Pro tiers visible
10. **FAQ + Final CTA + footer** — 5-8 collapsible Qs, closing CTA card, Numen Machines lockup

## Anti-patterns (explicit avoidances)

- Static screenshot dump as a standalone section
- Carousel testimonials (<1% engagement past slide 1)
- Multiple primary CTAs per section
- Any plagiarized AS copy residue — every customer-facing word original
- "Viral" and "AI" in H1 / brand spine — overused, weakens positioning
- Maximalist motion-template aesthetic (animated beams everywhere, neon glow) — conflicts with Anthropic/Linear/Raycast vibe

## Scope

- **In:** `/` only — single landing page
- **Out (this milestone):** `/about`, `/research`, `/manifesto`, in-app prediction-viz rebuild, light mode
- **Demo:** Static (screenshots / short loops). No live `paste TikTok URL → see prediction` backend call this milestone.

## Carryover from predecessor

- `BRAND-BIBLE.md` at repo root — Phase 01 of v3.0 wrote the visual metaphor lock content; preserved as a reference (this milestone can build on, evolve, or supersede it)
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
- PROJECT.md edits **deferred to merge time** per worktree rule (read-only in worktrees)
