# Proposal — generation-engine rework for in-thread chat (2026-08-09)

**Lane:** `lane/in-thread-chat` · builds on `HANDOFF-2026-08-09-in-thread-chat-audit.md` (F-1…F-22)
and `HANDOFF-2026-08-09-in-thread-chat-live-runs.md` (N-1…N-8 + addenda).
**Status: PROPOSAL — nothing here is built.** Owner picks the slice; stages are independently
shippable and ordered by (value ÷ risk).

The owner's brief: *generated content isn't reliably high-quality/accurate/faithful to the ask; the
chat has no working memory for follow-ups; rework the engine for high-value output.*

---

## 1. What the engine actually is today (all verified file:line this session)

```
TYPED MESSAGE ──► /api/tools/chat
                   ├─ prior turns: openChatPriorTurns() — up to 20 turns, ONE line per past card
                   ├─ router: qwen3.7-flash agent loop (~4.8s to decide, nothing renders meanwhile)
                   │    └─ tool call: { topic: <ONE sentence>, anchor?: <ONE line> }   ◄── THE BOTTLENECK
                   └─ runner: qwen3.7-flash, ONE pass, prompt = assembleBundle ≤ 4,000 chars
                        ├─ creator profile ~900 chars
                        ├─ ask (the topic string the router wrote — NOT the conversation)
                        └─ grounding block ≤ 1,800 (ideas/script) / 2,800 (hooks) chars
                             └─ ~400–500 chars PER EXAMPLE: madlib ≤130, spoken hook ≤100,
                                why-it-works ≤120, ≤6 beats × 70 chars
CARD CTA ("Write the script →") ──► /api/tools/{script,hooks,ideas} one-shot
                   ├─ NO thread context at all (verified: no loadMessages/priorTurns in any of the 3)
                   ├─ anchor = the clicked line, passed as an UNINSTRUCTED "Chain anchor" fence,
                   │   next to an EMPTY "Creator ask" fence (assembler.ts:274-276) → N-7 topic drift
                   └─ persists assistant blocks with NO user-turn row → N-8 turn merge on reload
TYPED "punch up hook 2" ──► detectRefineIntent() → /api/tools/refine — carries the ORIGINAL CARD PROPS
                   └─ the only path that can genuinely rewrite… and the shipped follow-up chips
                      ("Punch them up" = "Rewrite these hooks tighter") DON'T match its heuristic,
                      so they fall into the chat path whose tool schema cannot carry the pack.
```

Validation on model output is shape-only (non-empty strings, types): `"0"` ships as a seed line
(N-2), counts are unenforced (N-4), `sourceIndex` is range-checked only — the model IS explicitly
instructed to *instantiate* the cited structure (`prompt.ts:215-240`) but **nothing verifies it did**
(N-1, corrected: instructed-but-unverified, not uninstructed), and there is no anchor-fidelity check
(N-7). No runner retries, ever; a malformed script beat is silently skipped and the script ships
without it.

Four more load-bearing facts from the deep sweep (all file:line-verified by the sweep agent):

- **Ranking is the model's self-estimate.** The persona SIM that scored candidates was removed
  2026-07-22; `personaStops` (0–10) is self-reported by the generator in the same call and is the
  ENTIRE ranking signal (`hooks-runner.ts:621`). So the summary's "reacted with your 10 reactors,
  strongest first" describes machinery that no longer runs — the audience panel's "Not simulated
  yet" is the honest surface in the N-3 contradiction. A prior rubric critic was removed for
  ~100% failure (`hooks-runner.ts:678`) — any Stage-C judge must not repeat that design.
- **Generation is deterministic:** `temperature: 0, seed: 7` everywhere → a regenerate on the same
  ask+profile is byte-identical. (Deliberate for calibration-drift detection per `client.ts:24` —
  changing it needs care — but it means "try again" cannot help a user today.)
- **Citation integrity hazard:** `assembleBundle` re-truncates corpus-last AFTER `used` (the
  sourceIndex mapping array) is computed (`assembler.ts:314-325`), and the chat path applies NO
  length cap to the router-written `topic`/`anchor` — so the model can cite an example that was cut
  from its own prompt, and the card renders that receipt anyway.
- **`fitLabel` is a hardcoded constant** — `DEFAULT_FIT = "adjacent"` (`retrieve.ts:30`), which is
  why every card says "◐ adjacent audience" (F-8). It's a placeholder, not a measurement.

## 2. Defect → mechanism map

| Observed defect | Mechanism |
|---|---|
| Script about the wrong topic (N-7) | empty ask + uninstructed anchor fence + no output check |
| Follow-ups "forget" (owner complaint) | runner never sees the thread — only the router's one topic sentence; card CTAs see nothing at all |
| "Rewrite these" returns unrelated new items | tool schema has no slot for the pack; refine engine exists but chips bypass it |
| Cited template ≠ output structure (N-1) | model sees a 130-char madlib among 4–6, told to cite honestly, never told to *follow* one, never verified |
| Cards disclaim retrieval the UI promised (F-4) | attribution is the model's choice; retrieval genuinely returned 6 rows (server log) |
| Same source ×3 (F-7) | no diversity constraint in buildProofFromSource |
| Generic-feeling output despite a 532-row corpus | each "proven video" reaches the model as ~450 chars inside a 4KB bundle; the decode→adapt briefer that would show the FULL anatomy (`adapt.ts`) is built and dead behind three unset flags — and its own header records that the raw-slice path now shipping **lost the A/B to writing cold** |
| Hooks drift into generic "viral cadence" | the proven line ships verbatim under the madlib; the measured fix (`GROUNDING_HOOKS_SURFACE=structure`) exists and is unset (`prompt.ts:264`) |
| "Ranked, strongest first" feels arbitrary | ranking = the generator's own 0–10 self-estimate; the scoring SIM was removed 2026-07-22 |
| Degraded runs look grounded | chat path discards runner `warnings` (`chat-agent-loop.ts:1130` hardcodes `[]`); hooks' `grounded: true` is granted unconditionally whenever rows return (`warrant.ts:139`) |
| 5s dead "Thinking" (F-11) | router-model latency before the earliest SSE event (peer-measured: stream opens in 0.7s) |
| "General"/turn-merge/seed "0" | stamping + persistence + validation gaps (fix list in handoff §4) |

The 4KB ceiling and the one-pass flash generation are **rational engineering for qwen3.7-flash
cost/latency** — they are also, jointly, the quality ceiling.

## 3. Staged rework

### Stage A — Contracts & honesty (no architecture change; ~1–2 days; kills the P0s)
1. Anchor contract: assembler names the anchor's role ("the script MUST open from / adapt this
   hook"); runner rejects output whose opening beat ignores the anchor (one retry, then a visible
   warning). Covers N-7.
2. Output validation: count honoring (N-4), seedHook plausibility (N-2), source diversity cap
   (F-7), and a cheap structural-match check — if the output doesn't instantiate the cited
   template's slots, drop the citation (turns N-1 from a false claim into honest "Original").
   Plus the citation-integrity pair: cap `topic`/`anchor` in `parseSkillArgs` (the direct routes
   already cap at 2000/5000) and recompute `used` after the assembler's final truncation, so a
   card can never cite an example the model wasn't shown. Surface runner `warnings` through the
   chat path instead of hardcoding `[]`.
3. Persistence: chip runs write a user-action row; chat-dispatched runs get a `runHeaderBlock`
   stamped at `chat/route.ts:496` (activeAudience is already in scope) — kills N-8 + F-3.
4. One ranking truth (N-3) + cap the post-tool closing text (F-1 containment).

### Stage B — One brain (every generation sees the conversation; ~2–4 days)
1. Route card CTAs through the agent loop with a pinned skill (`forceSkill` already exists) instead
   of the context-free one-shots — one entry point, one persistence shape, one progress UI (the
   good live card the one-shots already render can move with it).
2. Give the dispatch tool schema a `cards` slot (the pack being discussed) so "rewrite these" can
   actually carry them; wire the shipped chips to the refine path when they reference existing
   cards.
3. Cheap pre-router (heuristic or tiny prompt) for the 4.8s dead zone; stream honest pre-dispatch
   copy immediately.

### Stage C — The quality pass (the "engine rework" proper; owner picks a lane)
- **C0 · Flip the built-but-dead levers first (near-zero build cost, measure before building
  anything new):**
  - `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ADAPT=true` — wires `adapt.ts`, the decode→adapt briefer that
    shows the model each exemplar's FULL unclipped anatomy and picks a per-structure dosage
    (clone/swap/angle/none). It was built as the fix for the blind transplant the first A/B
    measured LOSING — the losing arm is what ships today. Costs one extra flash call per run.
  - `GROUNDING_HOOKS_SURFACE=structure` — stops shipping the proven line verbatim under the
    madlib (the measured cause of generic-viral-cadence drift).
  - Both are flags: A/B them against today's path with the same 10-ask probe set.
- **C1 · Judge loop:** generate → judge (anchor fidelity, template instantiation, mechanism
  diversity, ask faithfulness) → one revise pass. Same flash model as judge ≈ +1 call, +4–8s —
  hidden if cards stream as they validate. Design constraint: the removed rubric critic failed
  ~100% of the time (`hooks-runner.ts:678`) — judge on CHECKABLE properties (does the output fill
  the madlib's slots, does the opening contain the anchor), not on taste rubrics.
- **C2 · Raise the ceiling:** move generation (script first — longest output) to a stronger tier
  and lift `BUNDLE_CHAR_CAP`/`CORPUS_CHAR_BUDGET` so grounding stops being 120-char fragments.
  Re-measure latency/cost; `QWEN_REASONING_MODEL` env makes this a config experiment, and
  client.ts:47 documents the rollback.
- **C3 · One deep, five wide grounding:** adapt.ts (C0) already carries most of this; the remainder
  is feeding `teardown.narrative_structure`'s timestamped sections (present on all 532 rows, never
  rendered by any prompt slice) into the script slice specifically.
- **C4 · Real ranking:** either restore a scoring pass (cheap SIM or judge scores, separate from
  the generator's self-estimate) or stop claiming "reacted with your reactors, strongest first."
  Also replace the `fitLabel` placeholder with a computed value or remove the glyph (F-8).

  Recommended order: **C0 (measure) → C1 → C3-remainder**, with C2 as the multiplier if latency
  budget allows.

### Stage D — Corpus & measurement
1. Purge/repair the 6 meta-template rows (F-5); decide the multiplier basis (F-6 — owner; note
   `scraped_videos` does NOT carry follower data either: 0/7,439, so backfill means scraping).
2. Retrieval eval harness for ideas/script (probe-hook-transfer pattern, 10 real asks) — settles
   the 0.50-floor question the peer session correctly kept open. Note ideas/script also get plain
   cosine top-6 with NO archetype spread (`retrieve.ts:435`) — the round-robin is hooks-only; and
   chat + generation retrieve twice per turn at different floors with no sharing.
3. `scraped_videos` (7,439 rows, 7,389 embedded) as the corpus growth pool behind the existing
   curation gate.
4. Persona coverage: the fixed roster sums to 57% — decide whether the other 43% should ever be
   written for (peer residue #7).

## 4. What NOT to touch
- The empty state, accent dosage (LOCKED), zero-overflow mobile layout, the one-shot script run's
  live progress card (best progress UI in the product — reuse it, don't rebuild it).
- Benchmark set is **Claude + Perplexity only** (owner, explicit).

## 5. Open owner decisions (blocking which stage)
1. Which stage/lane first? (A is assumed safe to start; C needs the C1/C2/C3 pick.)
2. F-6 multiplier positioning (blocks part of D).
3. `composer.tsx` (3,802 lines) split as part of Stage B, or surgical only?
4. Sketch-first vs build-behind-gates for the thread feel work (conflicting memories; unresolved
   from session 1's interrupted question).
