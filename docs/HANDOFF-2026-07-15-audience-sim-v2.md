# HANDOFF — Audience Simulation v2 (fresh-session starter)

**Paste this to start:** *"Read `docs/HANDOFF-2026-07-15-audience-sim-v2.md` §0 (STAGED PLAN), then
`docs/DESIGN-2026-07-15-audience-simulation-v2.md`. Audience Sim v2 is now a STAGED, ship-fast plan
(owner-approved): keep the 10 fixed slots, make each CUSTOM per creator, then layer population math.
Stage 1 (custom personas — generation + ambient display) is DONE + committed. Pick up at Stage 1's
remaining display sites / profile-bake mirror, or start Stage 2 (population math). Do NOT touch the
feedback loop — it's last."*

**Worktree:** `~/virtuna-audience-sim-v2` · **Branch:** `feat/audience-sim-v2` · **Written:** 2026-07-15 · **Updated:** 2026-07-16 (Stage 1)
**SSOT design doc:** `docs/DESIGN-2026-07-15-audience-simulation-v2.md` (read it — it has the schema, the
locked decisions, the current-engine map with file:line, and the spike result **incl. §8.2 Phase 1**).

> ⚠️ **This is a fresh worktree.** `node_modules` is symlinked from `~/virtuna-explore-b` and `.env.local`
> was copied in (both gitignored). If either is missing, redo: `ln -sfn ~/virtuna-explore-b/node_modules
> ./node_modules && cp ~/virtuna-explore-b/.env.local ./.env.local`. Run the spike with
> `./node_modules/.bin/tsx scripts/spike-persona-population.ts` (NOT bare `npx tsx` — it re-installs).

---

## 0 · THE STAGED PLAN (owner-approved 2026-07-16 — supersedes the P2–P5 roadmap in §4 for now)

The original P2→P3 (firm schema → break `.length(10)`) was reframed with the owner into a **ship-fast
staged plan**. Driving insight (verified against the code): **the "10" is NOT a display count — it is
load-bearing in the SCORING math** (each archetype → a slot_type → `persona-weighting.ts` weights every
reactor's verdict by its slot share; also `flash-schema.ts` `.length(10)`, `selectPersonaSlots` throws
≠10, the fold's D-01, and ~15 display/runner/flywheel files key on the fixed slugs). So **do NOT relax
the count** — it's a big, risky change with no user payoff right now. Instead:

- **Stage 1 — custom-fill the 10 (DONE this session, 2 commits).** Keep the 10 as fixed STRUCTURAL slots
  (aggregation/chat/fold untouched, `archetype` stays as the bridge slug), but make each slot
  **custom-generated per creator** + carry scored axes.
  - **Generation** (`75cf76d8`): `enrich-signature.ts` SYNTH_SYSTEM now writes per persona a custom
    `display_name` + `blurb` + `reaction`/`behavior` axes, and a `topic_vocab`. New OPTIONAL fields on
    `SignaturePersona` (`display_name`, `blurb`, `reaction`, `behavior`) + `SignatureAudience.topic_vocab`
    (`audience-types.ts`) — legacy/General/preset safe, no DB migration (signature is a JSON blob).
    VERIFIED live: `./node_modules/.bin/tsx scripts/verify-custom-personas.ts` → 10/10 custom names
    (0 echoed the slug), 10/10 axes, invariants held.
  - **Display** (`0690090c`): the ambient audience renders `audience.personas` (the projected roster),
    NOT `signature.audience.personas`. Bridge = `calibration.ts personasFromSignature` — it now seeds
    each row's `label` from `display_name`. One seam lights BOTH name paths in `audience-presence.tsx`
    (`personaNameMap` override @243 + per-row `resolvePersonaName(p.archetype, p.label)` @366). So a
    calibrated creator now sees "The Archive Builder", not "Saver". Presentation-only (engine never
    reads `label`); manual rename (AUD-EDIT-01) still wins.
  - **Stage 1 REMAINING (small):** (a) sweep the other persona surfaces to confirm they read
    `audience.personas[].label` (chat drawer, workspace, reads, reveal — many likely already do since
    they share the roster; verify + a render check). (b) Mirror the generation change into
    `profile-bake.ts` (the person/manual calibration path — parallel SYNTH + schema + mapping). Lower
    priority: it's the secondary path, not the critical scrape flow.

- **Stage 2 — population math (NEXT big piece).** The scored axes are now STORED on every signature
  persona (`reaction`/`behavior`) + `topic_vocab`. Expand the 10 rich groups → ~1000 sampled individuals
  (the spike's `expand()` = centroid + jitter) and score with the tuned `pStop()` (spike Phase 1) to
  produce the honest aggregate ("847 of 1,000 would keep watching"). Add ONE `characterize(content)` LLM
  call → cheap O(N) score → aggregate, ALONGSIDE the existing LLM group-reaction (keep chat/quotes).
  Honesty: label it a projection of the groups, not 1,000 independent minds (`provenance`).
  Reference impl for the whole shape: `scripts/spike-persona-population.ts` (already tuned + passing).

- **Feedback loop = still LAST + unsolved.** Do not start.

**Also this session (branch hygiene):** the ideas-targeting work shipped separately as **PR #312**
(rebased clean onto main, 619 green) — it is NOT on this branch.

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

## 3 · The branch — RESOLVED 2026-07-16 (both owner decisions taken)

The two decisions were made and executed:
- **(a) Ideas work → SHIPPED as its own PR.** `feat/per-persona-ideas-script` was rebased onto current
  `origin/main` (clean, 619 tests green) and opened as **PR #312** (refactor + ideas + script commits;
  the dormant 6.7% script commit rides along with an honest "drop it if you don't want unwired code on
  main" note for the owner).
- **(b) v2 pivot → its OWN worktree/branch.** `~/virtuna-audience-sim-v2` on **`feat/audience-sim-v2`**
  (off `origin/main`), carrying only the design doc + spike (cherry-picked) + Phase 1 tuning. This is
  where all v2 work happens now. It does NOT ride the ideas branch.

So this handoff now lives on `feat/audience-sim-v2`. The ideas targeting is representation-agnostic and
re-bases onto whatever audience model v2 produces.

## 4 · Roadmap (ORDERED — feedback loop is LAST and unsolved)

**Phase 1 — Tighten the scorer + broaden vocab. ✅ DONE 2026-07-16 (see design-doc §8.2).**
All three sub-tasks landed in `scripts/spike-persona-population.ts`: (a) `pStop()` rebalanced to two
independent stop-drivers — a strong hook now carries a stop via `2.4·(hookStrength·hookAppetite)`,
`hookAppetite = 1 − attentionSpan`, so scrollers stop on spectacle with zero topic interest while
craft students don't; (b) `topicVocab` now carries cross-cutting APPEAL registers (spectacle/humor/
relatable/…) so off-niche content finds purchase (the 14.7% VFX hook → 41–52%); (c) axes were already
1:1 — completed by making hookStrength bidirectional + interest-gating the skepticism penalty
(`skepticism·hype·(1−interestMatch)`) so engaged debunkers lean in instead of being repelled.
**Result:** postable hooks stop 41–53% overall; each hook lights up a different segment set; 0%-segments
rotate by hook. Confidence built — the pivot's cheap-scoring shape is sound. (Do NOT keep hand-tuning:
it over-fits 3 hooks + LLM characterization noise; the constants get *fit* by the feedback loop, Phase 6.)

**Phase 2 — Firm the schema. ← START HERE.** Promote the design-doc strawman (`Segment`, `Persona`,
`Provenance`, `ReactionProfile`, `BehaviorProfile`, `AudiencePopulation`) to real types. Decide storage:
**persist segments, deterministically (seeded) sample individuals** at run time (locked decision #5).
The spike's inline interfaces (top of `spike-persona-population.ts`) are the tested starting shape —
note the spike added a `spread` field on `Segment` (drives per-individual jitter) not yet in the doc strawman.

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
