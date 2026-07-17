# Handoff — grounding is a shared decode→adapt service (2026-07-15, session 4)

**Read `docs/DECISION-grounding-as-remix-2026-07-15.md` first — this is the "how to resume" wrapper around it.**
**Visual summary artifact:** https://claude.ai/code/artifact/1523537f-7bb7-4528-b984-e3618701a91d

---

## 0. The one-paragraph version

We tested whether grounding (showing the generator proven retrieved examples) makes a better hook.
A first A/B made it look *worse* than writing cold — but that test handed the writer a **130-char
madlib and nothing else**, and it transplanted the skeleton blindly. **The failure was the
transplant, not grounding.** The owner's reframe: this is **remix** — copy what works and *adapt* it,
choosing per-hook how hard to borrow (clone / swap / angle / none). We proved it: fed the **full
decoded anatomy** through a focused adapt stage with a dosage knob + a ≤15-word cap, and it kept the
proven formats, re-voiced them to the creator, and dropped structures that didn't fit (dosage across
40 hooks: swap 21 · angle 12 · none 7 · clone 0; 0 over the word cap). **Still unproven: whether it
gets more VIEWS — that needs a real outcome signal, not our taste or our SIM.**

---

## 1. What is DONE (committed on branch `experiment/ab-grounding-blind`)

### Real fixes — PR-worthy on their own (commit: Phase 0a)
- **`src/lib/grounding/types.ts` — `template` JSONB parse fix.** Beat timings (`startSec`/`endSec`)
  are now `.optional()`, not merely `.nullable()`. Before, 14/300 rows silently dropped their ENTIRE
  template (beats + `guidance` + skeleton) over a missing timing garnish — the `template JSONB failed
  its schema` warning that fired on every grounded run. Now **300/300 parse.** This is the §3.3 bug
  from the prior handoff, closed.
- **Same file — the drop-warning now prints the failing PATH** (`beats.0.startSec`), not the
  innocent top-level keys. The old log said "checked" while hiding the real fault — it cost a session.
- **`src/lib/grounding/__tests__/types.test.ts`** — regression test locking beats-without-timings.

### Experimental — proves the direction, NOT production (commit: Phase 0b)
- **`src/lib/grounding/prompt.ts`** — `GROUNDING_HOOKS_SURFACE=structure` flag (default-off, inert;
  suppresses the source's verbatim line). Used by the experiment; keep or delete when Phase 1 lands.
- **`scripts/proto-adapt-hooks.ts`** — THE PROTOTYPE. The adapt stage: full anatomy in, dosed hooks
  out, ≤15-word cap. This is the thing to promote in Phase 1. NOT wired to any runner.
- **`scripts/ab-grounded-hooks-blind.ts`** — the 3-arm harness (cold / verbatim / structure-only).
- **`scripts/ab-grounding-remix.ts`** — the labelled harness that A/B'd remix vs the cached arms.
- **`docs/AB-GROUNDING-3ARM-2026-07-14.md`**, **`docs/AB-GROUNDING-REMIX-2026-07-15.md`** — results.
- **`docs/DECISION-grounding-as-remix-2026-07-15.md`** — the decision (READ FIRST).
- **`docs/grounding-readout.html`** — the visual artifact.

**91 grounding tests green. Prod grounding flags remain OFF. No user-facing change. Nothing pushed.**

---

## 2. The architecture decision (what to build)

Every skill funnels through ONE shared seam: `gatherCorpusForRun({ skill })` in
`src/lib/grounding/gather-for-run.ts` → returns a `corpus` block → injected into the writer bundle.
The only per-skill difference is which slice `prompt.ts` renders (`renderHooks/renderIdeas/
renderScript`) + the ranking axis. **Generalizing = replace the render step with an ADAPT step at
that single choke point.** Change one module, all skills inherit it.

### The full-platform picture — ONE corpus, THREE consumption modes

The platform's skills (runners): chat, explore, hooks, ideas, predict, profile, remix, script,
simulate. They do NOT all consume the corpus the same way:

1. **Generate-by-remix** (borrow a proven STRUCTURE, dose it to the creator): **hooks, ideas, script,
   and remix itself** (remix is the origin pattern — decode→adapt on a user-pasted video; the others
   apply it to the *retrieved* corpus). → the shared **decode→adapt** core. This is what we prototyped.
2. **Retrieve-to-cite / inspire** (surface real proven examples as evidence/inspiration, no dosage):
   **chat** (ground advice — the long-dead "M2 RAG"), **explore** (adjacent-niche proofs as fuel).
3. **Judge-by-benchmark** (score content against what "proven" looks like): **predict, simulate.**
   This is the "corpus as judge" idea — its home is the *scorers*, never the writers. (**profile**
   barely needs it.)

**Shared foundation under all three: retrieval + the decoded corpus (the DECODE half, now un-starved).**
"Apply to all skills" is NOT one adapt-stage bolted onto everything — it is one corpus/retrieval/
decode foundation with three consumption adapters. Do NOT force modes 2 and 3 through the generate
adapter.

---

## 3. The plan — ranked

### Phase 1 — promote the prototype to a shared adapt module (hooks first, flag-gated)
Move `proto-adapt-hooks.ts` → `src/lib/grounding/adapt.ts`; wire it INSIDE `gatherCorpusForRun`,
gated by a flag. **Key decision — I recommend ADAPT-AS-BRIEFER:** the adapt stage does the
full-anatomy fit + dosage reasoning and emits a COMPACT brief; each skill's EXISTING writer consumes
the brief in place of today's raw slice. This preserves the SIM gate, the receipts/`sourceIndex`
wiring, and per-persona targeting — all of which adapt-as-writer (what the prototype currently is)
would bypass. Cost: +1 light model call when grounding is on. Thread `sourceIndex` through the brief
so the on-card receipt still maps to the exemplar used.

### Phase 2 — generalize to ideas + script (job-specs, not rewrites)
Because it's at the shared seam, each skill = an intent + output-brief shape + dosage rule. LOCKED
constraints:
- **Ideas stays subject-bound** — belief↔reality tension matched to the creator's TOPIC. Do NOT give
  ideas the structural cross-niche axis (this was measured and locked in the prior handoff).
- **Script finally gets its beats** — the parse fix keeps `template.beats` alive now. Map the
  creator's Hook→Setup→Turn→Payoff→CTA onto the proven beat rhythm.

### Phase 3 — the honest gate (before ANY prod flag flips on)
Wire a real outcome signal: which hooks users PICK / POST / PERFORM. Craft-read and our own Flash SIM
cannot certify "it performs." Until this exists, everything stays behind flags / the sandbox.

### Later — modes 2 & 3
Chat/explore = retrieval-to-cite over the same decoded corpus (revive M2 RAG). Predict/simulate =
corpus as benchmark distribution. Separate builds; do not block Phase 1–2 on them.

---

## 4. Gotchas / how to run

- **Tests:** `node ./node_modules/vitest/vitest.mjs run src/lib/grounding` (NOT `npm test` — it
  prints fake results in this repo).
- **Scripts need `.env.local`:** `DASHSCOPE_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + URL. Raw A/B
  dumps write OUTSIDE the repo (`../ab-grounding-*-raw.json`).
- **Retrieval probes clean:** all real asks retrieve 6 examples across 6 archetypes on the structural
  axis (hooks). The corpus table is `outlier_teardowns`; RPC `match_shared_teardowns`.
- **Every defect this whole track was invisible in code review and green in CI** — found only by
  RENDERING the block or RUNNING the pipeline. Keep verifying by rendering, not by reading source.
- **Escape hatches (default-off):** `GROUNDING_HOOKS_SURFACE=structure`, `GROUNDING_HOOKS_RANK=topical`.
- Branch note: `lane/explore-c` is stale — branch Phase 1 off `main` (or off this branch's Phase-0a
  fix commit, which is independently PR-worthy).

---

## 5. Immediate next action for the fresh session

Start Phase 1: create `src/lib/grounding/adapt.ts` from `scripts/proto-adapt-hooks.ts`, wire it into
`gather-for-run.ts` as **adapt-as-briefer** behind a flag, keep hooks' SIM/receipts intact, and
re-run the labelled A/B to confirm parity with the prototype before touching ideas/script.
