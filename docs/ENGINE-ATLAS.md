# Numen — Engine Atlas (trace-level)

> Detailed, execution-order trace of every platform flow. One level deeper than
> `PLATFORM-MAP.md` (structure) — this is the **sequence**: what's captured →
> which functions fire (`file:line`) → what enters Qwen → what returns → what
> persists → how it influences downstream. Every section carries a **Lean lens**
> (cut-candidates) because the goal is a clean, lean core.
>
> Generated 2026-06-22 from a 5-agent live-code trace. Sections live in
> `.planning/atlas/`. Where this contradicts `PLATFORM-MAP.md`, **this wins**
> (it's newer + read the code directly).

---

## Master mental model

```
                         ┌──── active_audience_id (pinned on the single open thread) ────┐
                         │                                                               │
  AUDIENCE ──calibrate──►│  persona_weights (4 nums)  +  personas[].repaint (10 strings) │
  (Apify scrape +        │         │                              │                      │
   deterministic,        │    ⚠ DEAD-WIRED                  ENTERS MODELS                │
   NO LLM)               │   (void-ed in text             (the ONLY audience            │
                         │    runners; waits for           identity a model sees)       │
                         │    an unbuilt "Max" path)              │                      │
                         │                                        ▼                      │
  USER ──skill request──►  ENVELOPE (auth→csrf→caps→open-thread→load audience) ──►       │
                                        │                                                │
                          GENERATE (Qwen qwen3.7-plus, the latency cost)                 │
                                        │                                                │
                          FLASH SIM GATE (8× parallel qwen3.6-flash) ──band/fraction──►  │
                                        │                                                │
                          RANK → CARDS → SSE(content then score) → persist blocks ──► OPEN THREAD
```

The Read (video) is a separate lane: `Omni perception → {Apollo ‖ Fold} → aggregate → cache`.

---

## Section index

| # | Section | File | Covers |
|---|---------|------|--------|
| 01 | Envelope + threads spine | [`.planning/atlas/01-envelope-threads-spine.md`](../.planning/atlas/01-envelope-threads-spine.md) | shared route envelope, threads/messages/blocks model, triple block-validation, `active_audience_id` set/read |
| 02 | Audience subsystem | [`.planning/atlas/02-audience-subsystem.md`](../.planning/atlas/02-audience-subsystem.md) | create→calibrate→personas→**influence**→flywheel/drift |
| 03 | Generative skills + Flash SIM | [`.planning/atlas/03-generative-skills-flash-sim.md`](../.planning/atlas/03-generative-skills-flash-sim.md) | hooks full trace, SIM internals, other skills as deltas, latency/parallelism |
| 04 | The Read (video pipeline) | [`.planning/atlas/04-the-read-video-pipeline.md`](../.planning/atlas/04-the-read-video-pipeline.md) | Omni→Apollo→Fold→aggregate→cache, scoring math, latency |
| 05 | Grounding (KC) + lean cut-list | [`.planning/atlas/05-grounding-and-lean-cutlist.md`](../.planning/atlas/05-grounding-and-lean-cutlist.md) | KC compile/assemble/niches, RAG-disabled, **cross-cutting cut-list** |

---

## Headline findings (what the trace changed)

### 🔴 The moat is barely wired (§02 — biggest finding)
The audience is the supposed moat, but in the **live text product** its *numeric*
calibration influences **nothing**:
- `resolveAudienceWeights()` is computed then `void`-ed in every text runner — dead-wired.
- `deriveAudienceProfile()` ignores the scraped videos; temperature_mix/dispositions
  come from the fixed 10-archetype lens → **every audience gets an identical profile +
  grounding line**. Only `follower_tier` is real.
- `goal_intent` `sell` and `authority` map to **byte-identical weights**.
- Presets ship `personas:[]` → near-inert.

Net: the only thing about an audience that reaches a model is the **10 repaint
strings** folded into the Flash SIM prompt. The 4 persona-weights sit waiting for an
unbuilt "Max" path. → This is the #1 thing to fix or consciously simplify.

### 🟠 Latency truth (§03, §04 — corrects assumptions)
- **Hooks ~110s is the two `qwen3.7-plus` reasoning calls (generate + follow-up
  chat), NOT the SIM fan-out.** SIM is already 8-way parallel `qwen3.6-flash` →
  wall-clock ≈ slowest single call (~8–17s), already optimal.
- The **follow-up chat blocks `done`** — it's on the critical path for no UX reason.
- **Remix (~240s) is the real long pole** (Apify resolve+rehost + omni + thinking-decode + adapt).
- The Read: Apollo ‖ Fold already run concurrent after Omni; `tiktok_url` path ≈2× a
  `video_upload` because resolve+rehost (25–38s) serializes before Omni.

### 🟠 Quality bug: niche-blind SIM (§03)
`script` + `remix` build the SIM reaction panel inline **without `resolveNicheKey`**,
so their SIM runs niche-blind → "all Mixed". `hooks`/`ideas`/`react` use
`buildReactionPanel` correctly. Real output-quality defect.

### 🟠 Security: CSRF guard missing (§01)
`csrfGuard` is **absent on `ideas`, `ideas/develop`, `refine`, `react`** — all
state-mutating cookie-authed POSTs. The `ideas` route header even *claims* the
mitigation. Real hole.

### 🟡 Model + math mismatches
- `FOLD_MODEL` defaults to `omni-flash` (unstable-diversity variant); memory says it
  should be `omni-plus` PAID. Highest-stakes single config. (§04)
- Flash SIM model is `qwen3.6-flash` — **not** `QWEN_REASONING_MODEL` as the map said. (§03)
- Flywheel nudge is **0.05** in code vs **±0.1** in docs. (§02)
- The Read: `behavioral_score` and `apollo_score` may be **double-counting the same
  Apollo call**; the 0.5/0.5 video blend is asserted, never calibrated. (§04)

---

## Lean cut-list (consolidated, value ÷ blast-radius)

| Cut | Where | LOC | Blast | Note |
|-----|-------|-----|-------|------|
| `_dormant/` tree | `src/lib/engine/_dormant/` | ~7,300 | MED | zero real imports (3 hits are comments) |
| Dead-shipped simulation UI | `src/components/app/simulation/*` | 14 files | LOW | only `TestCreationFlow` referenced, by nothing live |
| Dead `ToolRunner`/`flashRunner` scaffolding | `flash-runner.ts` + dispatch | ~200 | LOW | P1 scaffolding superseded by raw SSE routes |
| Dead engine signals' matching logic | `aggregator.ts:1170-1253` | — | LOW–MED | `ml/rule/trend/audio_fingerprint/platform_fit` → null |
| `refresh-corpus` cron stub | `cron/refresh-corpus/route.ts:23` | 44 | LOW | no-op |
| Fake §N chat citations | `chat/seed-context.ts:90-106` | — | LOW | labels, no real RAG |
| Dead percentile UI | `simulation/behavioral-predictions.tsx` | — | LOW | `*_percentile:"N/A"` |
| Rubric critic infra | `flash/rubric-critic.ts` | 255 | MED | OFF, ~100% fail — recalibrate-or-delete |
| pgvector RAG pipeline + corpus scripts | `engine/retrieval/` | ~1,300 | LOW | **keep-for-M2** unless RAG is dead |

**Corrections to earlier assumptions:** the two remix routes are **NOT** redundant
(both live, both UI-wired). Konva/canvas + `AdaptFrameBody` are **LIVE**, not legacy.

---

## Open decisions for the owner (these gate the refactor)

1. **Is the audience meant to influence output numerically, or stay prose-only?**
   Decides whether §02's dead-wiring is a bug to fix (build the weight path) or
   theatre to delete (lean it down). Everything about the moat hangs here.
2. **Is M2 corpus-grounding (RAG) alive?** If dead → ~2K LOC of `_dormant` +
   pgvector + corpus scripts become hard cuts. If alive → keep + schedule.
3. **Rubric critic: revive or delete?** 255 LOC + dual-branch gates in two runners.
4. **`FOLD_MODEL` flip** to omni-plus (+ the cost) — yes/no.
5. **Drop the follow-up chat from the hooks/ideas critical path** (stream it after
   `done`)? Cheap latency win.
6. Behavioral-vs-Apollo double-count + uncalibrated 0.5/0.5 blend — investigate.
