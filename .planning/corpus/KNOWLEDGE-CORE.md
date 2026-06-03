# Apollo Knowledge Core — v0 (template)

> The distilled brain Apollo reasons with. Phase 3 loads this into the **stable, cached system prompt** (score-mode reasoner + Remix decode + adapt all share it). Keep it distilled — target 3–8k tokens. Fill the sections; delete this blockquote when v1 is real. See `HOW-TO-BUILD.md`.

**Status:** template / not yet filled · **Sources feeding it:** _(list below)_

---

## 1. Persona & Voice
*Who Apollo is and how it speaks — the "feels like our expert" layer. Tone, stance, what it never does (e.g. no generic AI hedging, no fabricated specifics).*

- Identity:
- Voice rules:
- Never:

## 2. Behavioral Frameworks (the core knowledge)
*The load-bearing principles, distilled from the sources, applied to short-form video. Why things work — mechanisms, not platitudes.*

### 2.1 Hooks (first ~3s)
*Pattern interrupt, curiosity gap, stakes, specificity… what makes an opening stop the scroll.*

### 2.2 Retention / structure
*Open loops, tension, pacing, the turn, payoff — what keeps watch-through.*

### 2.3 Sharing / engagement triggers
*Identity signaling, emotion, social currency, "tag someone", controversy-with-payoff — what drives shares/comments/saves.*

### 2.4 CTA / conversion
*What makes a close land without killing retention.*

## 3. Scoring Dimensions & Rubric
*The named dimensions the composite 0–100 is built from (R5). For each: what it measures + what strong/mid/weak looks like. This is how the score becomes explainable, not a black-box number.*

| Dimension | Measures | Strong | Weak |
|---|---|---|---|
| Hook | | | |
| Retention | | | |
| Share-pull | | | |
| … | | | |

*Confidence: how Apollo signals certainty (signal coverage, ambiguity).*

## 4. Decode Lens (Remix decode — R12)
*The framework for analyzing WHY a reference video worked. Fold the existing `decode-prompts.ts` structure in + ground it here.*

- **4 beats:** hook_pattern · structure_pacing · the_turn · emotional_beat
- **Repeatable vs Luck:** how to separate reproducible craft from unrepeatable factors (timing/trend, existing reach, algorithmic outlier, zeitgeist).

## 5. Rewrite & Action Principles
*How Apollo turns critique into action (R2). Quote the creator's real line, offer 2–3 directional variants, stay authentic (no robotic AI-script feel). What makes a good rewrite vs generic advice.*

## 6. Audience knowledge (Brain 2 — cross-ref)
*Brain 2's archetype knowledge lives in `src/lib/engine/wave3/persona-registry.ts` (already built). Note here anything the Audience-Sim should additionally know; otherwise this section just points to the registry as the source of truth.*

## 7. Sources & Provenance
*What raw material fed each section (IP hygiene — ground-to-inform, not regurgitate; also makes the core updatable).*

- Chase Hughes — _(which works/sections)_ → feeds §2, §5
- _(other sources)_ →
