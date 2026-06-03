# VISION — Numen / Apollo

> The product thesis behind the Apollo milestone. Captured 2026-06-03.

## Numen *is* Apollo. Features are modes.

Numen isn't a bundle of features — it's **one expert (Apollo) you reach three ways.** Same senses, same brain; different orchestration + UI.

```
                    ┌─────────── APOLLO ───────────┐
   Omni (senses) →  │  Brain 2: Audience-Sim       │
   observe+verbatim │  Brain 1: Reasoner (grounded) │
                    └──────────────┬───────────────┘
                                   │
        ┌──────────────────┬───────┴────────┬──────────────────┐
     TEST                REMIX             CHAT              (future)
   "judge mine"      "decode + adapt"     "converse, freeform"
   = Apollo judges    = Apollo deconstructs = Apollo + engine-as-tool
     your draft         a proven reference    answers any request
     → board            + adapts it → board
```

- **Test** = Apollo judges your draft → the board.
- **Remix** = Apollo decodes why a proven video works + adapts it for you. *Already runs on the same engine (`/api/remix/adapt` uses deepseek/pipeline) — it's Apollo in "adapt" mode.*
- **Chat** = Apollo conversational, engine-as-tool ("analyze this, give me hooks"). Deferred to a later milestone; architecture anticipates it.

Building Apollo upgrades all three at once. Had we kept optimizing a score machine, each feature would have needed its own logic.

## Value, not moat

Don't over-index on a single defensible secret. **Value is the compound of the whole product.** The moat can live anywhere — Apollo's grounding, the UI/UX, speed, brand, marketing. No single axis needs to be unbeatable.

**The "but you could just prompt Gemini" test** is the right lens — and Numen wins it not on one axis but on all of them at once: a creator *can't* practically get this from a chat. They'd need to know what to ask, supply the knowledge themselves, parse a wall of text — with no audience simulation, no video breakdown, no visual board, no consistency, no specialization. Numen makes it **grounded, structured, visual, practical, and specialized — by default, every time.** That bundle is the value.

## The value pillars (what we actually build)

| Pillar | Where it lives |
|---|---|
| **Audience prediction / simulation** | Brain 2 — Audience-Sim (folded personas, grounded) |
| **Knowledge grounding** | Brain 1 — Apollo Reasoner (multi-source corpus, cached system prompt) |
| **Improvement actions** | Apollo's rewrites + actions output (absorbs the old stage11) |
| **Video breakdown** | Omni observer + verbatim + segments + heatmap |
| **Score** | the *first-glance directional read* — the entry point, not the product |

The score is just the first insight. Everything above it is the real value.

## Corpus

Multi-source (Chase Hughes + other relevant material — behavioral, persuasion, content intelligence), not a single author. It **matures over time**; we don't gate the build on it. Quality of grounding is calibrated continuously as we build, not proven once as a moat-gate. Not fine-tuning (docs/data-shaped problem). Grounded at inference via a cached system prompt.

## Build order (see ROADMAP.md)

Strip to senses → Omni verbatim → Apollo Reasoner (knowledge) → Audience-Sim fold → wire + surface. Then (later milestone) the Chat surface.
