# HANDOFF — Audience Simulation v2 (fresh-session starter)

**Paste this to start:** *"Read `docs/HANDOFF-2026-07-15-audience-sim-v2.md`, then
`docs/DESIGN-2026-07-15-audience-simulation-v2.md`. We're mid-pivot on the audience simulation. Pick up
at Phase 1 (tighten the scorer + re-run the spike). Do NOT touch the feedback loop yet — it's last."*

**Worktree:** `~/virtuna-explore-b` · **Branch:** `feat/per-persona-ideas-script` · **Written:** 2026-07-15
**SSOT design doc:** `docs/DESIGN-2026-07-15-audience-simulation-v2.md` (read it — it has the schema, the
locked decisions, the current-engine map with file:line, and the spike result).

---

## 1 · What this is (the pivot, in 5 lines)

The calibrated audience today = **10 fixed archetypes, synthesized by ONE LLM call from the creator's
OWN video engagement ratios. It captures ZERO real audience data** (the "Zach King scrape" pulls Zach's
videos, not his viewers). So going 10→1000 personas does **nothing for accuracy** — same guess, higher
resolution. **Decision: "generated, not measured."** One unified LLM generator builds a rich, steerable
synthetic population of **200–1000 reacting personas** from *whatever context exists*; a cheap
transparent scoring function reacts all of them per content test (~1 LLM call/test). Honesty via a
`provenance` stamp. "Accurate" is earned LATER by a feedback loop (see Phase 6 — last, and unsolved).

## 2 · What's DONE this session

- **Design locked** — `docs/DESIGN-2026-07-15-audience-simulation-v2.md` (§6 lists all 8 locked decisions).
- **Spike built + run + PASSED** — `scripts/spike-persona-population.ts`. Proved the two riskiest
  assumptions against real Qwen output:
  - Q1 (generation produces varied, context-sensitive segments) ✅
  - Q2 (cheap scoring produces differentiated per-segment reactions) ✅ — e.g. a craft hook drove the
    "How'd they do that?" segment 7%→**89%**→0% across three hooks.
  - Run it: `npx tsx scripts/spike-persona-population.ts` (2 generator + 6 characterization calls, ~cents, ~2min).
- **Two calibration problems found** (both TUNING, not architecture) — see Phase 1.

## 3 · The branch (READ THIS before committing/pushing)

`feat/per-persona-ideas-script`, **4 commits, NOT pushed**, tree clean:
1. `refactor(audience)` — shared per-persona target machinery
2. `feat(ideas)` — per-persona idea targeting, measured 75%, live-verified (SHIPS; independent of this pivot)
3. `feat(script)` — script targeting built, measured 6.7% (fails), dormant/unwired
4. `docs(audience)` — the v2 design doc

⚠️ Branch is **behind `origin/main`** (the explore-a CLOSEOUT PRs merged after it was cut) but touches
DISJOINT files → clean rebase. The **ideas work (commits 1–3) is shippable on its own** and re-bases onto
the new audience model (targeting is representation-agnostic). Two independent decisions:
(a) rebase + PR the ideas work now? (b) does the v2 pivot get its own branch/worktree? — it's a new
milestone-sized effort and arguably shouldn't ride the ideas branch. **Ask the owner.**

## 4 · Roadmap (ORDERED — feedback loop is LAST and unsolved)

**Phase 1 — Tighten the scorer + broaden vocab (cheap, no engine changes). ← START HERE.**
In `scripts/spike-persona-population.ts`: (a) rebalance `pStop()` so a strong hook can carry a stop
without topical interest (kill the "many segments at exactly 0%" collapse — the 3.2× interest coef
dominates everything). (b) Make the generator's `topicVocab` broad enough to catch off-niche content
(the sparse magic vocab missed a VFX hook → 14.7%). (c) Co-design the content-characterization axes ↔
persona `ReactionProfile` axes so they line up. Re-run until the distribution *feels* right (a postable
hook shouldn't have 90% scrolling). This is throwaway-tuning to build confidence — not production.

**Phase 2 — Firm the schema.** Promote the design-doc strawman (`Segment`, `Persona`, `Provenance`,
`ReactionProfile`, `BehaviorProfile`, `AudiencePopulation`) to real types. Decide storage: **persist
segments, deterministically (seeded) sample individuals** at run time (locked decision #5).

**Phase 3 — Engine integration (the big one).** Replace the frozen 10-archetype signature + the SIM.
Must break: `flash-schema.ts` `.length(10)`; `persona-registry.ts:526` `selectPersonaSlots` (throws if
≠10); the fixed 10-archetype taxonomy (`persona-registry.ts:22-33`). Calibration writes the new
population; the reaction call becomes *characterize-content (1 LLM call) → cheap-score N individuals →
aggregate*. **Back-compat:** today's 10-archetype signatures map to 10 segments + synthesized individuals
so nothing breaks day one. ENGINE_VERSION bump required (cache replays old results otherwise).

**Phase 4 — Surfaces.** Wire the population into the reaction-panel UI + re-base per-persona generation
(`select-persona-targets`) onto segments. Provenance drives honest cold-start framing ("typical VFX
audience — calibrate to make it yours").

**Phase 5 — Virality layer.** TikTok-ALGORITHM amplification (FYP pushes on early signals: watch-through,
share, save) — NOT a follower-graph cascade. Sum behavioral propensities → model the amplification
decision. This is a real differentiator vs Artificial Societies (who do LinkedIn/X follower cascades).

**Phase 6 — Feedback loop (LAST, and UNSOLVED — do not start).** Predicted-vs-actual: creator posts →
ingest real views/engagement → compare to prediction → fit the scorer constants to truth. This is the
ONLY thing that earns the word "accurate", but it needs real post-outcome ingestion we don't have.
Owner's words: *"one of the last steps, and something we need to figure out how we make it work even."*

## 5 · Locked decisions (don't re-litigate — see design-doc §6 for the full 8)

Generated-not-measured · ONE unified generator (context-in → population-out, no per-source branching) ·
two levels (LLM segments + procedurally-sampled individuals; granularity **(a)**) · named/scored features
NOT embeddings (auditable) · ~8–15 segments, N=300→1000 · cold-start = populate-but-loudly-labeled ·
privacy hard rule (real people only back a segment in aggregate; display names always synthetic).

## 6 · Key files

- `scripts/spike-persona-population.ts` — the spike (Phase 1 lives here).
- `docs/DESIGN-2026-07-15-audience-simulation-v2.md` — SSOT (schema §4.3, engine map §3, decisions §6).
- Current engine to eventually replace: `src/lib/engine/flash/run-flash-text-mode.ts` (the 1-call SIM),
  `flash-schema.ts` (`.length(10)`), `src/lib/engine/wave3/persona-registry.ts` (10-archetype taxonomy),
  `src/lib/audience/enrich-signature.ts` (the synth-from-creator-content bake), `calibration.ts`.

## 7 · Gates + how to run

- Spike: `npx tsx scripts/spike-persona-population.ts` (needs `.env.local` DashScope key — auto-loaded).
- Tests: `node ./node_modules/vitest/vitest.mjs run <scope>` — NEVER `npm test` (fake shim). Serially.
- The ideas work's gate (if you touch it): `... run src/lib/audience src/app/api/tools src/lib/tools`.
- Dev server: `NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3007`.

## 8 · Context / honesty spine (why this codebase is the way it is)

Everything here obeys one rule: **never present synthesis as a measurement.** That's why generated
personas carry `provenance`, why misses are shown as plainly as hits, and why "accurate" is deferred to
the feedback loop instead of claimed now. Keep it. See memory `[[green-test-is-the-accomplice]]` and
`[[per-persona-hook-generation]]` for the pattern of "green tests hid a dead feature — run it for real."
