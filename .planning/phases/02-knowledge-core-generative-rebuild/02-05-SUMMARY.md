---
phase: 02-knowledge-core-generative-rebuild
plan: "05"
subsystem: knowledge-core
tags: [kc, hooks-slice, chat-slice, corpus, d14, d15, owner-gate]
dependency_graph:
  requires: ["02-04"]
  provides: [hooks-slice, chat-slice, compiled-all-four-modes]
  affects: [04-hooks-tool, 05-open-chat]
tech_stack:
  added: []
  patterns:
    - "Full-depth SLICE authoring replicating the gate-proven Ideas shape (D-15)"
    - "Thin stance-slice riding BASE for chat (D-14)"
    - "Archetype vocabulary as PRIVATE reasoning — never an emitted [SLUG] tag (Output Discipline)"
    - "Multi-modal hook framing — spoken line, visual/shot, caption, edit, audio cue"
    - "Regen-kc.ts byte-stable compile — all four per-mode system prompts"
key_files:
  created: []
  modified:
    - .planning/corpus/hooks.md
    - .planning/corpus/chat.md
    - src/lib/kc/compiled.ts
decisions:
  - "QUESTION archetype designated near-failure-mode with explicit guard (lowest median, most overused)"
  - "BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE = the 5 live archetypes; each with mechanism, template, performance note, execution failure"
  - "Depth-match requirement called out as blocking check before RESEARCH archetype selection"
  - "Chat slice stays thin per D-14; all three failure modes (sycophantic opener, hedge-by-enumeration, over-generating) authored"
  - "Owner curation (D-10): killed the [BOLD]/[GAP] slug-EMISSION instruction — archetype is now PRIVATE diversity bookkeeping, never shipped (aligns hooks with curated ideas.md + BASE Output Discipline)"
  - "Owner curation (D-10): added 'Hook Reasoning Scaffold → Clean Deliverable' section + deliverable-boundary line, mirroring the gate-proven ideas.md shape"
  - "Owner adjustment: hooks are MULTI-MODAL — spoken line, opening visual/shot, on-screen caption, edit, and audio cue (often stacked); mechanisms are channel-agnostic; Component 3 + reasoning scaffold (new Channel field) now cover visual/audio/edit hooks, not just the spoken line"
metrics:
  duration: "~30 min (Task 1 prior session; Tasks 2–3 this session)"
  completed: "2026-06-17"
  tasks: 3
  files: 3
---

# Phase 02 Plan 05: Hooks + Chat Slices — COMPLETE

**One-liner:** Authored the full-depth Hooks slice replicating the gate-proven Ideas shape (5 archetypes + timing anchors + failure modes + abstracted exemplars + value-forcing Actionability Contract), owner-curated it (scaffolding-leak fix, clean-deliverable scaffold, multi-modal hook framing) and a thin chat stance-slice riding the BASE (D-14), then recompiled all four byte-stable per-mode system prompts.

## Status

**COMPLETE** — all three tasks done. KC corpus is authored, curated (D-10 passed), and compiled.

## What Was Built

### Task 1 (executor, prior session) — COMPLETE

`.planning/corpus/hooks.md` — full-depth Hooks slice:

- **5 live archetypes** (BOLD / GAP / CONTRARIAN / RESEARCH / NARRATIVE), each with: named BASE mechanism, structural template, performance context, and execution failure.
- **QUESTION archetype** flagged explicitly as near-failure-mode with performance data (lowest median, most overused) and the only condition under which it is acceptable.
- **Timing anchors** throughout: algorithm's first decision ≈1.5s; strong hook in first 3s / ~10–14 words; TikTok-first with inline Reels/Shorts notes where caption phrasing materially changes the hook.
- **Failure Modes** (5 named): algorithm timing miss, depth-mismatch, Question-archetype default (the #1 generation-slop regression), empty contrarianism / ragebait, generic niche opener.
- **Gold-Standard Exemplar Patterns** (5 abstracted templates — no scraped clips, D-04).
- **Actionability Contract** (3 components) + intra-batch diversity + flops-as-negative-grounding.

`.planning/corpus/chat.md` — thin chat stance-slice (D-14): mode job, 3 craft patterns, 3 failure modes, 2 exemplars, thin actionability contract.

### Task 2 (owner curation, D-10) — COMPLETE

Owner-curation pass on both slices, then owner red-line approval with one adjustment:

- **Killed the scaffolding leak (the key fix).** The draft instructed the model to *emit* `[BOLD]`/`[GAP]` slug tags on every hook (Component 1 + diversity rule) — a direct contradiction of BASE "Output Discipline — Scaffolding Is Private" and the curated ideas.md. Archetype is now **private** reasoning/diversity bookkeeping, **never** an emitted tag.
- **Added "Hook Reasoning Scaffold → Clean Deliverable"** — mirror of ideas.md: schema is how you *think*, then SHIP the clean, executable hook + plain varied why + fit. No field labels, no meta-commentary.
- **Deliverable-boundary line** in Mode Job ("ship the executable hook, not a description of one — handed over the blueprint and kept the building").
- **Register variety** — Component 1 bars opening every why-line with "Fires…".
- **chat.md** kept intentionally thin (D-14): added only the matching deliverable-boundary line; no new authoring, full polish still deferred to P5.
- **Owner adjustment — MULTI-MODAL hooks.** A hook is not only the spoken line: it is also the opening visual/shot, the on-screen caption, the edit/cut, and sometimes an audio cue — often stacked. Generalized Mode Job, archetypes intro (mechanisms are channel-agnostic), exemplars, the reasoning scaffold (new **Channel** field), and Component 3 (now covers named shot / caption / cut / sound cue, not just a verbatim line).

Both files flipped from `<!-- DRAFT -->` to `<!-- Owner-curated 2026-06-17 (D-10 passed) -->`.

### Task 3 (executor) — COMPLETE

- Recompiled all four per-mode system prompts via `scripts/regen-kc.ts` → `src/lib/kc/compiled.ts` (byte-stable).
- Verified `compiled.ts` carries the authored slices: **0 skeleton placeholders** remain (`KC_HOOKS_SYSTEM_PROMPT` / `KC_CHAT_SYSTEM_PROMPT` no longer hold `[Author craft here]`); multi-modal content present.
- `npx vitest run src/lib/engine/flash src/lib/kc` → **61/61 passing** (flash-aggregate 21, flash-schema 15, assembler 25).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 4c583438 | feat(02-05): draft Hooks slice (full depth) + thin chat stance-slice |
| Tasks 2–3 | (this session) | feat(02-05): owner-curate hooks+chat (scaffolding-leak fix, clean-deliverable scaffold, multi-modal) + recompile |

## Deviations from Plan

- Task 2 (owner curation) was executed as a Claude-drafted curation pass + owner red-line, rather than owner-authored from scratch — owner's chosen path at the checkpoint. Owner approved with the multi-modal adjustment, which was incorporated before recompile.

## Known Stubs / Follow-ups

- **chat.md** remains intentionally thin (D-14) — full craft-pattern / failure-mode / exemplar authoring deferred to Phase 5.
- **Optional Phase-3 cleanup (pre-existing, not introduced here):** the D-03 compiler embeds the full raw markdown *including* `<!-- … -->` provenance/authoring comments into each system prompt. base.md + ideas.md already did this and passed the 02-04 blind gate, so it is accepted state — but stripping author-only comments at compile time would tighten the prompt. Tracked, not actioned.
- **KC discrimination is a Phase-3 wiring job, not a corpus job** — see RESUME-HERE "SIM is niche-blind" finding (lever #10).

## Threat Surface Scan

No new endpoints, auth paths, or schema changes. Only corpus `.md` files + the generated `compiled.ts` modified.

- T-02-13 (external craft → hooks/chat slice): Research is steer only (D-09); no copy-paste. Owner D-10 gate applied.
- T-02-14 (scoring-craft re-import, D-08): Zero scoring-shaped language; no apollo-core import.
- T-02-15 (chat over-authored, D-14 breach): chat.md remains proportionally thin vs hooks.

## Self-Check: COMPLETE

- `.planning/corpus/hooks.md` curated, DRAFT marker removed: PASS
- `.planning/corpus/chat.md` curated, DRAFT marker removed: PASS
- No `[BOLD]`/`[GAP]` slug-emission instruction remaining: PASS
- "Hook Reasoning Scaffold → Clean Deliverable" present: PASS
- Multi-modal framing (visual / caption / edit / audio) present: PASS
- `compiled.ts` recompiled, 0 skeleton placeholders: PASS
- `npx vitest run src/lib/engine/flash src/lib/kc` = 61/61: PASS
