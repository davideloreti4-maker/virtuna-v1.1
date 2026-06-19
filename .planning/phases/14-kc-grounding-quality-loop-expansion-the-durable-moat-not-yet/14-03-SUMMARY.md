---
phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet
plan: 03
subsystem: api
tags: [knowledge-core, prompt-assembly, hooks-corpus, voice-grounding, honesty-spine, react-markdown, vitest]

# Dependency graph
requires:
  - phase: 02-knowledge-core-generative-rebuild
    provides: KC compile pipeline (regen-kc.ts), hooks.md archetype table, KC_GEN_VERSION, KC_HOOKS_SLICE/SYSTEM_PROMPT
  - phase: 02-knowledge-core-generative-rebuild
    provides: assembler.ts MODE_ROLES + BUNDLE_CHAR_CAP cap-drop, profile-role-map.ts formatVoice
provides:
  - Voice survives the BUNDLE_CHAR_CAP drop for idea/hooks/script/remix + an explicit "Write in this voice" style directive (KCQ-08)
  - 26 owner-curated hook templates folded into hooks.md as a silent private-reasoning exemplar layer under the archetype table (D-16/17/18)
  - KC_GEN_VERSION bumped gen.1.0.0 -> gen.1.1.0 for the authoring update; ENGINE_VERSION untouched
  - Fake §N citation pills removed from ExpertChatThread (HONESTY-01) — no decorative citation render, board-frame pills + real-code render intact
affects: [hooks-tool, ideas-tool, script-tool, remix-tool, expert-chat, kc-grounding, future-kc-authoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Voice as a NON-tail MODE_ROLES element so a routine cap-drop sheds lower-signal grounding (wins/flops/platform) before the creator's voice"
    - "Owner exemplar patterns folded UNDER the archetype table as private-reasoning-only scaffolds — governed by the same no-emit/no-[SLUG]-leak discipline as the archetype vocabulary"
    - "Honesty spine: delete a dishonest UI affordance with no positive re-light (D-14)"

key-files:
  created:
    - src/lib/kc/__tests__/assembler.test.ts
  modified:
    - src/lib/kc/assembler.ts
    - src/lib/kc/profile-role-map.ts
    - .planning/corpus/hooks.md
    - src/lib/kc/compiled.ts
    - src/lib/kc/kc-version.ts
    - src/components/command-bar/ExpertChatThread.tsx

key-decisions:
  - "Voice ranks ahead of wins/flops/platform in MODE_ROLES.idea/hooks/script/remix (chat stays voice-free); tail-drop now sheds lower-signal grounding first (KCQ-08 / D-11/D-12)"
  - "D-18 map-before-merge delegated to the executor: owner supplied raw labels (their own taxonomy), executor mapped each of the 26 to the closest hooks.md archetype; mapping table documented below for owner post-hoc review"
  - "QUESTION-mapped exemplars (#7, #14) folded in under the near-failure-mode archetype framing the slice already weights as last-resort"
  - "HONESTY-01 = pure deletion, no replacement (D-13/D-14)"

patterns-established:
  - "OWNER EXEMPLAR PATTERNS block: archetype-grouped, private-reasoning-only, [placeholder]-must-be-resolved-never-shipped"

requirements-completed: [KCQ-08, HONESTY-01]

# Metrics
duration: ~20min (across a blocking human-action checkpoint)
completed: 2026-06-20
---

# Phase 14 Plan 03: KC Grounding — Voice, Owner Hook Exemplars & Honesty Lane Summary

**Voice now survives the cap-drop with an explicit style directive (KCQ-08), the owner's 26 hook templates ground Hooks as a silent archetype-mapped exemplar layer (KC_GEN_VERSION gen.1.1.0), and the fake §N citation pills are deleted from the expert chat (HONESTY-01).**

## Performance

- **Duration:** ~20 min active (plan spanned a blocking human-action checkpoint for the owner's templates)
- **Completed:** 2026-06-20
- **Tasks:** 3 (1 auto, 1 checkpoint+fold-in, 1 auto)
- **Files modified:** 6 (1 created)

## Accomplishments
- **KCQ-08 voice calibration:** moved `voice` out of the tail position in `MODE_ROLES` for idea/hooks/script/remix so a routine `BUNDLE_CHAR_CAP=4000` drop no longer silently removes it; strengthened `formatVoice` to the explicit "Write in this voice — match its sentence rhythm, vocabulary register, and tone" directive while retaining the "do NOT reuse specific content" honesty clause + the `<<<USER_CONTENT>>>` fence. Changes live in the VOLATILE user-message path only — `compiled.ts` / cached system prompts byte-unchanged.
- **26 owner hook templates (D-16/17/18):** folded under the `hooks.md` archetype table as an OWNER EXEMPLAR PATTERNS block, archetype-grouped, framed private-reasoning-only (never emit verbatim, never ship a `[placeholder]`, no pills). Recompiled byte-stable via `regen-kc.ts`; `KC_GEN_VERSION` bumped `gen.1.0.0 -> gen.1.1.0` (ENGINE_VERSION unchanged at 3.19.0).
- **HONESTY-01:** deleted `CORPUS_SECTIONS`, `insertCitationMarkers`, and the `§cite:` pill-render branch from `ExpertChatThread.tsx`; render `{content}` directly; board-frame pills (`VALID_FRAMES`/`parseFrameTag`) and the real-code fallback left intact.

## D-18 Map-Before-Merge — 26 Owner Templates → hooks.md Archetypes

Owner supplied the 26 templates in RAW format (their own taxonomy labels, not pre-mapped to the hooks.md table). Per the resolved checkpoint, the executor performed the D-18 mapping. **For owner post-hoc review:**

| # | Template (gist) | Owner raw label | Mapped archetype | Rationale |
|---|-----------------|-----------------|------------------|-----------|
| 1 | "I just got the most [adj] [noun] ever" | Personal Experience | NARRATIVE | personal event opener / identification |
| 2 | "[system] got me [result], but [why rare/secret]" | Secret Reveal Breakdown | GAP | result named, mechanism withheld (open loop) |
| 3 | "I'm a [Pro], took me [time], teach you in [short]" | Authority | RESEARCH | effort/depth + authority promise |
| 4 | "wave of [trend]... but [barrier]" | Secret Reveal Breakdown | GAP | open loop on the barrier/fix |
| 5 | "Everything you heard about [Subject] was a lie" | Contrarian | CONTRARIAN | flat contradiction of a held belief |
| 6 | "only [N] [category] you need to [action]" | List | BOLD | declarative scarcity claim |
| 7 | "Is it possible for [demo] to [result]? This [person]..." | Case Study | QUESTION | dominant surface form is an explicit question (last-resort archetype) |
| 8 | "[Brand] zero -> success in [time] by [strategy]" | Case Study | NARRATIVE | transformation story |
| 9 | "take [boring obj] turn into [result]?" | Secret Reveal Breakdown | GAP | partial reveal, withheld how |
| 10 | "how I [result] in [short time]" | Case Study | NARRATIVE | personal transformation |
| 11 | "haven't seen anyone talk about [problem]... I'm not the only one?" | Personal Experience | NARRATIVE | identification opener |
| 12 | "never [outcome] unless you understand [concept]" | Authority | BOLD | declarative stakes claim |
| 13 | "Don't start [activity] until [process]" | Trap Mistake | BOLD | declarative warning claim |
| 14 | "What happens when you [action] for [duration]?" | Question | QUESTION | explicit question (last-resort archetype) |
| 15 | "[N] common [topic] mistakes to avoid" | List | BOLD | declarative list-claim |
| 16 | "[%] of [products] are [negative]. Only [N] worth it" | Contrarian | CONTRARIAN | contradicts category belief |
| 17 | "[content] got [metric] all because of [small detail]" | Case Study | GAP | result named, detail withheld |
| 18 | "At what point do we admit [Subject][negative]?" | Contrarian | CONTRARIAN | rhetorical contradiction |
| 19 | "How I got [result] A -> B in [time]" | Case Study | NARRATIVE | personal transformation |
| 20 | "I just found the biggest [niche] [benefit] in [year]" | Secret Reveal Breakdown | GAP | discovery, withheld payoff |
| 21 | "one [asset], spend [short time], your best [result]" | Secret Reveal Breakdown | BOLD | declarative guarantee claim |
| 22 | "Give me [time], teach better than [official/expensive]" | Authority | CONTRARIAN | contradicts the official/expensive route |
| 23 | "unpopular opinion: best way to [goal] is unwilling to [advice]" | Contrarian | CONTRARIAN | explicit contrarian |
| 24 | "gained [result] in [timeframe], here's how" | Case Study | NARRATIVE | personal transformation |
| 25 | "Never post [content] on [platform] without [tool]" | Trap Mistake | BOLD | declarative warning claim |
| 26 | "[N] simple ways to make [process] more effective" | List | BOLD | declarative list-claim |

**Distribution:** BOLD x8, GAP x5, CONTRARIAN x5, NARRATIVE x6, RESEARCH x1, QUESTION x2.

**Flags for owner review:**
- All 26 fold cleanly under a named hooks.md archetype — no template contradicts or duplicates an existing archetype definition.
- The owner's raw labels are a richer surface taxonomy (Secret Reveal Breakdown, Case Study, Authority, Trap Mistake, List, Personal Experience) than the hooks.md mechanism table (6 archetypes). Several raw labels collapse onto one archetype by their dominant *mechanism* (e.g. "Case Study" maps to NARRATIVE for transformation stories but to GAP/QUESTION when the dominant pull is a withheld detail or an explicit question). The mapping keyed on dominant mechanism, not surface label.
- #7 and #14 map to QUESTION (the slice's near-failure-mode / last-resort archetype). They are folded in but grouped under the QUESTION caution; the diversity rule still treats QUESTION as last-resort.
- RESEARCH has only one exemplar (#3) — if the owner wants a stronger RESEARCH grounding base, that is the lightest archetype in the current set.

## Task Commits

Each task was committed atomically:

1. **Task 1: Voice priority promotion + style-match instruction (KCQ-08)** — `bfcb9d5c` (feat)
2. **Task 2: Fold 26 templates into hooks.md + recompile + KC_GEN_VERSION bump (D-16/17/18)** — `e24c66aa` (feat)
3. **Task 3: Delete fake §N citation pills (HONESTY-01)** — `429ad5de` (fix)

## Files Created/Modified
- `src/lib/kc/assembler.ts` - MODE_ROLES voice reorder (voice out of tail for idea/hooks/script/remix) + updated priority doc
- `src/lib/kc/profile-role-map.ts` - formatVoice strengthened to the explicit "Write in this voice" directive (+ JSDoc)
- `src/lib/kc/__tests__/assembler.test.ts` - NEW: voice non-tail order + survives a representative cap-drop; formatVoice directive/honesty/fence asserts
- `.planning/corpus/hooks.md` - OWNER EXEMPLAR PATTERNS block (26 templates, archetype-grouped, private-reasoning-only) folded under the archetype table
- `src/lib/kc/compiled.ts` - regenerated via regen-kc.ts (KC_HOOKS_SLICE / KC_HOOKS_SYSTEM_PROMPT now carry the exemplar block); byte-stable
- `src/lib/kc/kc-version.ts` - KC_GEN_VERSION gen.1.0.0 -> gen.1.1.0
- `src/components/command-bar/ExpertChatThread.tsx` - removed CORPUS_SECTIONS + insertCitationMarkers + §cite: pill branch; render {content}; board-frame + real-code render intact

## Decisions Made
- D-18 map-before-merge owned by the executor (owner delegated by supplying raw labels) — mapping table above is the reviewable artifact.
- Voice ranks above wins/flops/platform but below niche/audience — niche/audience are the highest-signal grounding and remain the last to drop.
- Exemplars grouped by archetype in the corpus so the intra-batch diversity rule can read them.

## Deviations from Plan

### Process deviation (not a code auto-fix)

**1. Task 3 working-tree edits captured by the repo stop-hook as an auto-wip commit**
- **Found during:** Task 3 (HONESTY-01 deletion)
- **Issue:** The repo's `core.hooksPath` stop-hook auto-committed the ExpertChatThread.tsx working-tree changes as `chore(auto-wip): ui — ExpertChatThread.tsx` (`060e7a78`) before the executor ran its own `git commit`.
- **Fix:** The auto-wip commit was HEAD and contained ONLY the Task 3 deletion (60 lines, all citation-pill removals, nothing layered on top). Amended its message to the proper atomic Task 3 conventional-commit (`429ad5de`) — content unchanged. No reset/rewind of any protected ref (destructive-git prohibition honored).
- **Verification:** `grep -c "CORPUS_SECTIONS|insertCitationMarkers|§cite"` returns 0; board-frame pills (6 refs) intact; `npm run build` succeeds.
- **Committed in:** `429ad5de`

---

**Total deviations:** 1 process deviation (hook-driven commit re-authored). No code auto-fixes, no scope creep.
**Impact on plan:** None on the delivered code — all three tasks executed exactly as specified.

## Issues Encountered
- Cap-drop test sizing: the first cap-drop test asserted voice-survival with an oversized ask that tripped the assembler's step-4b whole-profile drop (fenced ask alone overflows -> all profile roles drop, including voice). Empirically sized the ask to 2700 chars so step-4a (per-role tail drop) fires instead — voice survives while wins/flops/platform shed. Test green.

## Verification

- `npx vitest run src/lib/kc src/lib/engine/flash` — **137 passed, 2 skipped, 0 failed.**
- `regen-kc.ts` re-run after staging produced **no further diff** (byte-stable compiled.ts).
- `KC_GEN_VERSION = gen.1.1.0` (bumped once); `ENGINE_VERSION = 3.19.0` (unchanged).
- `npm run build` — **succeeded** (full route table rendered).
- `npm run lint` — pre-existing repo lint debt (63 errors / 98 warnings) lives in test files + an unrelated `useEffect` setState pattern at `ExpertChatThread.tsx:95` (OUTSIDE this plan's diff, which touched only the citation-pill regions ~26-38 and ~323-390). No new lint error introduced by this plan's changes. Logged as out-of-scope per the scope boundary.

## Next Phase Readiness
- KCQ-08 + HONESTY-01 closed; the corpus + voice + honesty lane of Phase 14 is delivered.
- The hooks exemplar layer is owner-reviewable via the mapping table above — owner may adjust archetype assignments or add RESEARCH exemplars in a future authoring pass (another MINOR KC_GEN_VERSION bump + regen).
- Pre-existing repo lint debt (63 errors) remains unaddressed (out of scope) — recommend a dedicated lint pass before public traffic (HARDEN-01).

## Self-Check: PASSED

- SUMMARY file exists on disk.
- Task commits verified present: `bfcb9d5c` (Task 1), `e24c66aa` (Task 2), `429ad5de` (Task 3).
- All key files created/modified confirmed (assembler.ts, profile-role-map.ts, assembler.test.ts, hooks.md, compiled.ts, kc-version.ts, ExpertChatThread.tsx).

---
*Phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet*
*Completed: 2026-06-20*
