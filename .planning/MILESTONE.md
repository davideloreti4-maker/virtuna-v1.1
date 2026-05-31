# Milestone: v3.2 Viral Remix

**Branch:** `milestone/viral-remix`
**Worktree:** `~/virtuna-viral-remix/`
**Started:** 2026-05-31
**Status:** Planning
**Forks from:** `feat/actions-frame-inline-redesign` @ `9626c92` (NOT `main`)

## Why this base (not main)

`main` is 76 commits behind and lacks the board-redesign + engine work this milestone reuses. Viral Remix reconfigures the existing board (swaps Verdict+Actions → Decode+Adapt) and rides the existing `/api/analyze` SSE pipeline — both of which only exist on the feat branch. The seed SPEC also lives on the feat branch, not main. Branching off the feat branch is the only base that has every dependency.

**Reconciliation note:** PROJECT.md/MILESTONES.md edits made here live on this branch until the feat-branch work merges to main. Per the worktree convention these are normally main-only edits; the unusual base means they ride along on `milestone/viral-remix` and get reconciled at merge time.

## Purpose

Close the *front half* of the creator loop. Today Virtuna is reactive (bring your content → get graded). Remix adds proactive discovery → creation: paste a third-party viral TikTok in an explicit **Remix mode** → **Decode** (why it worked, repeatable structure vs luck) → **Adapt** (~3 niche-adapted concepts, format-not-content) → per-concept **Develop & predict** runs one concept through the existing pipeline → parent/child lineage ("remixed from" chip).

Product spine (settled, do not re-litigate): **Decoder → Translator → Predict.**

## Seed

`.planning/milestones/viral-remix-SPEC.md` — 8 locked requirements, ambiguity 0.21, full interview log + acceptance criteria. This milestone is seeded from that SPEC; requirements are derived from it rather than re-interviewed.

## Locked Decisions (from seed SPEC)

- **Explicit Remix toggle** at the input front door — no auto-detect / handle-matching.
- **One board, two configs** — keep Input/Engine/Audience/Content Craft; swap Verdict+Actions → Decode+Adapt. No separate app surface.
- **Per-concept Develop** — no bulk auto-scoring (engine E2E ~90–312s makes it prohibitive).
- **`parent_id` lineage** + "remixed from" chip; child analyses appear in Recent.
- **Format-adaptation framing, never content copy** (legal + craft).
- **Niche from creator-profile** with inline fallback prompt.
- **Qwen-only** for any new model calls (decode/adapt generation).
- **TikTok-only** for this milestone.

## Reasoned-default assumptions (overridable)

3 concepts; per-concept develop (not bulk); niche from creator-profile w/ inline fallback; Audience frame retained in remix mode (persona retention of the *viral* video serves Decode); TikTok-only.

## First gate — ingestion-depth SPIKE (req #8)

Constraint Clarity scored 0.62 (below the 0.65 gate) for one reason: it is **unconfirmed** whether `/api/analyze` ingests frames/transcript vs just preview metadata for a **non-owned** TikTok URL. Decode requires real structural signal. **The roadmap makes this spike the first phase — Decode cannot be planned until it resolves.**

## Out of Scope

- Radar / trend feed (daily "winning in your niche") — future milestone; sidebar nav hook only, no build.
- Pattern Playbook (accumulated niche formulas) — future milestone.
- Auto-detect mine-vs-theirs — rejected in favor of the toggle.
- Separate Studio/Discover app surface — rejected; reconfigure the existing board.
- Bulk auto-scoring of all concepts — cost/latency prohibitive.
- Storing/redistributing source video — derive structural analysis only.
- Non-TikTok platforms (Reels, Shorts).
