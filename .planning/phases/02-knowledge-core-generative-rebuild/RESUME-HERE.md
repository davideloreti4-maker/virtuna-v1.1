# RESUME HERE — Phase 02, mid-02-04 (KC blind gate)

**Written:** 2026-06-17 · **Resume cmd:** `/gsd-execute-phase 2` (it discovers incomplete 02-04/02-05 and resumes)

## Where we are
- **Wave 1 ✅** 02-01 (KC code spine) + 02-02 (live-tier assembler, 25 tests).
- **Wave 2 ✅** 02-03 (BASE + Ideas pilot) — authored, research-grounded (Kallaway + Sandcastles), owner-curated, byte-stable. Committed.
- **Wave 3 �◆ 02-04 IN PROGRESS** — blind gate. Gate script built + committed (`9ced6af8`). Ran once (1 prompt). **Result = conditional fail → fixes applied → RE-GATE pending.**
- **Wave 4 ○** 02-05 (replicate shape to hooks.md + chat.md — still skeletons). BLOCKED until 02-04 passes.

## What happened in the gate (the key finding)
Blind ran 1 prompt × 3 arms on **qwen3.7-plus** (new-KC vs current-KC vs raw-LLM, shuffled). Owner read all three:
- **new-KC had the best craft substance** (most specific, contrarian, on-brief) BUT **lost on deliverable** — it dumped its internal scaffolding to the user (`[ARCHETYPE]` tags, `Topic/Angle/Mechanism/Fit/Substance` skeleton, a meta-note narrating its own diversity rule). Read like a strategy memo, not creator output.
- **raw-LLM** was cleanest-presented but conventional ideas + engagement-bait CTA.
- One new-KC idea ("index funds keep you poor, make asymmetric bets with your first $1000") was engagement-potent but **financially reckless** — the honesty discipline didn't flag it.
- Verdict: **the gate did its job** — caught a fixable output-contract flaw BEFORE replicating to hooks/chat.

## Fixes applied (committed `7f5dd58f`)
1. **BASE → "Output Discipline — Scaffolding Is Private":** reason with the apparatus privately, ship a clean deliverable; no tags/labels/§-refs/meta-commentary. (In BASE so hooks+chat inherit.)
2. **BASE → "Provocation, not recklessness":** comment-driving stances can't depend on advice that harms the audience; flag risk / give the defensible version.
3. **Ideas slice:** Output Schema reframed as *internal reasoning scaffold → clean deliverable* (ship concept + hook + one plain-language why-it-works line, no scaffolding); responsibility guard added to the Counter-Intuitive archetype.
4. `kc-gate.ts` per-call timeout 120s→300s (qwen3.7-plus + ~7.4k-token KC prompt is slow; the new-KC arm needs it).

## NEXT STEP (do this on resume)
**Re-run the gate, owner blind-ranks again:**
```bash
npx tsx scripts/kc-gate.ts --prompts "Give me 5 ideas for a personal finance creator on TikTok who helps 25-35 year-olds invest their first \$1000. I want to break out of generic money-tip content." --no-flash
```
(Flash sanity OFF for the *blind gate* only — a SIM score next to each output anchors the owner's rank. NOTE: SIM-1 Flash *text-mode* CAN score text and IS the product's verifier — keeping it out is a gate-integrity choice, not a capability limit. See the product-loop reminder below.)

Then open `kc-gate-BLIND.txt`, rank best→worst, decode `kc-gate-KEY.txt`.
**Watch for:** (a) new-KC now ships CLEAN (no `[ARCHETYPE]`/schema-label/meta-note leak); (b) the reckless-advice idea now flags risk or is replaced with a defensible version; (c) substance still strong; (d) ideas now push PAST the obvious-for-niche tropes and carry a non-fakeable concrete (new BASE Prohibition 6 + Test B).

**Better re-gate (recommended):** cold-start under-sells the KC. If feasible, re-run WITH a realistic creator profile + 1-2 real exemplars to measure the product's true delta, not the corpus floor. See `.planning/research/kc-improvement-levers.md` (the cold-start caveat + the 8 levers to beat raw LLM "by a lot"; two free ones — anti-slop + specificity — already shipped in BASE).

- **Gate PASS** = new-KC clearly best on substance AND presentation → mark 02-04 done, write SUMMARY, advance to **02-05** (replicate clean shape to hooks/chat; lean on parked hook taxonomy + format ontology in `.planning/research/`).
- **Still failing** = note which dimension, loop back to `ideas.md`/BASE, re-gate.

## Key references
- Corpus: `.planning/corpus/base.md` (now ~260 lines), `ideas.md` (~250). Compiler: `scripts/regen-kc.ts` (structure-agnostic, byte-stable). Run after any `.md` edit.
- Research (also feeds 02-05): `.planning/research/kallaway-craft-extraction.md`, `sandcastles-structural-insights.md`.
- Memory: `[[kc-corpus-authoring]]` (method + quality bar + state).
- Config: USE_WORKTREES=false (sequential on main tree), executor=sonnet, verifier=opus, branch `milestone/numen-tools`, no branching.
- Throwaway gate outputs `kc-gate-BLIND.txt` / `kc-gate-KEY.txt` are gitignored/transient — regenerate, don't trust stale ones.

## ⭐ Product-loop reminder (owner flag, don't lose)
The KC is only GENERATE. The moat = **generate → simulate against the SIM audience → rank + why**.
That SIM verification loop is a downstream PRODUCT feature (Ideas/Test tool, "Chat & Test" slice),
NOT the 02-04 corpus gate (which validates the generator by owner taste). SIM-1 Flash text-mode
exists (Phase 1) and is the verifier. Altitude: SIM reacts to CONTENT (hook/script) — render an
idea into its hook before SIM-ranking. Full note: `.planning/research/kc-improvement-levers.md` (§ "the product loop that IS the moat").
