# Numen Studio — Vision Brief (v6.0)

> Lean north-star for the OpenSpec build. Paste/`@`-reference into `/opsx:explore`.
> Source of truth for slicing; NOT a requirements doc. Last updated 2026-06-16.

## What it is
A creator-tools studio + open chat for short-form video creators. Tools generate
content (ideas, hooks, scripts); every output can be TESTED on a synthetic audience.
That synthetic-audience test is the moat — no competitor closes the create→validate loop.

## The engine: SIM-1
- **SIM-1 Flash** — fast, inline. Powers streaming viability hints + pull-scores as you work.
- **SIM-1 Max** — deep. Powers the full "Test" (the reading), the endpoint of every chain.

## The chain (core UX)
Ideas → Hooks → Test, with "develop this →" CTAs linking each step:
- **Ideas Tool** — funnel-top idea generation, grounded on the creator profile + Knowledge-Core.
  Streaming Flash viability hint + a self-judge gate before surfacing.
- **Hooks Tool** — flagship moat demo: N ranked hook cards, each with a SIM-1 Flash pull-score.
  Chains into Test.
- **Test** — the Reading, reframed as "Test · powered by SIM-1 Max." Endpoint of every chain.
- **Open Chat** — profile-grounded conversation, NO anchoring reading.

## The value / foundation: Knowledge-Core (KC)
Ground-up GENERATIVE rebuild of the KC (shared base + per-mode slices). This is THE value
and the long pole. Grounding priority: KC rebuild > live context > voice (low relevance)
> exemplars (deprioritized). Everything else is only as good as the KC.

## Architecture
- Generalized thread model (thread-per-artifact), tool-runner, typed-block rendering,
  persistence, universal composer. Flash text-mode for inline scoring.

## Constraints / decisions
- Engine is **UNFROZEN**. Regression gate: full suite green + same-video Max score-identity
  (deterministic) before any engine change lands.
- Stack: Next.js 15, TS, Tailwind v4, Supabase. Design = flat-warm charcoal system from v5.0
  (charcoal `#262624`, coral ≈ `#d97757`, Newsreader serif). No glow/glass/shine.
- Deferred to v6.1: Scripts tool, Remix.

## Slices (build order)
1. **Spike Gate** — GO/NO-GO. SPIKE-01: SIM-1 Flash text-fidelity (gates inline scoring).
   SPIKE-02: KC generative-craft slice (validates the rebuild approach). Spike = experiment, not a build.
2. **Engine & Thread Foundation** — Flash text-mode + thread model + tool-runner + typed renderers + composer + persistence.
3. **KC Generative Rebuild** — the long pole; can run PARALLEL to slice 2 (content workstream).
4. **Ideas Tool** — depends on 2 + 3.
5. **Hooks Tool** — depends on 4.
6. **Open Chat & Test Reframe** — depends on 2 + 3.

## First action
Explore SPIKE-01: can SIM-1 Flash hit the text-fidelity bar needed for inline scoring?
Define the bar, run the minimal experiment, record GO/NO-GO. Do NOT build product yet.

## Reference (GSD-era, do not re-execute)
Prior GSD planning: `.planning/REQUIREMENTS.md` (41 reqs), `.planning/ROADMAP.md`,
`.planning/NUMEN-TOOLS-VISION.md`. Kept as reference only — the build runs on OpenSpec now.
See `~/OPENSPEC-CHEATSHEET.md` for the workflow.
