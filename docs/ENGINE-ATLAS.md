# Numen — Engine Atlas (trace-level)

> Detailed, execution-order trace of every platform flow. One level deeper than
> `PLATFORM-MAP.md` (structure) — this is the **sequence**: what's captured →
> which functions fire (`file:line`) → what enters Qwen → what returns → what
> persists → how it influences downstream. Every section carries a **Lean lens**
> (cut-candidates) because the goal is a clean, lean core.
>
> Generated 2026-06-22 from a 5-agent live-code trace. Sections live in
> `docs/atlas/`. Where this contradicts `PLATFORM-MAP.md`, **this wins**
> (it's newer + read the code directly).
>
> **This is a living document.** It is the spine of the live engine dissection
> (see §"Dissection method" at the bottom). The audience **target model** below
> is the yardstick we measure the live code against — gap between target and
> trace = work.

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
| 01 | Envelope + threads spine | [`atlas/01-envelope-threads-spine.md`](atlas/01-envelope-threads-spine.md) | shared route envelope, threads/messages/blocks model, triple block-validation, `active_audience_id` set/read |
| 02 | Audience subsystem | [`atlas/02-audience-subsystem.md`](atlas/02-audience-subsystem.md) | create→calibrate→personas→**influence**→flywheel/drift |
| 03 | Generative skills + Flash SIM | [`atlas/03-generative-skills-flash-sim.md`](atlas/03-generative-skills-flash-sim.md) | hooks full trace, SIM internals, other skills as deltas, latency/parallelism |
| 04 | The Read (video pipeline) | [`atlas/04-the-read-video-pipeline.md`](atlas/04-the-read-video-pipeline.md) | Omni→Apollo→Fold→aggregate→cache, scoring math, latency |
| 05 | Grounding (KC) + lean cut-list | [`atlas/05-grounding-and-lean-cutlist.md`](atlas/05-grounding-and-lean-cutlist.md) | KC compile/assemble/niches, RAG-disabled, **cross-cutting cut-list** |

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
  wall-clock ≈ slowest single call (~8–17s).
- The **follow-up chat blocks `done`** — on the critical path for no UX reason.
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

## 🎯 Audience — Target Model (locked 2026-06-22)

> The design answer to "what position does the audience take?" The audience is now an
> **ambient, always-present lens over the composer** — so it must be a *first-class
> persistent object that influences every stage*, not a thing that only reacts.
> It works the engine in **three positions**. Today two are hollow; the target makes
> all three real, with REACT as the visible hero.

**Integrity rule (non-negotiable):** STEER and REACT are **separate model calls**. The
generator must never know it is being graded — otherwise the test stops being honest.
That separation *is* the moat. Latency reworks must preserve it.

| Position | Role | Target behaviour | Today (trace) | Work |
|---|---|---|---|---|
| **1. STEER** (pre-generation) | shape *what gets written* | audience attributes (persona mix, temperature, dispositions, niche, goal_intent) materially change the generation prompt → a cold-skeptical-finance audience yields visibly different hooks than a hot-collector-beauty one | ⚠️ **hollow** — identical grounding line for every audience; `deriveAudienceProfile` ignores the scrape | make grounding line carry real audience attributes; fix `deriveAudienceProfile` to use scraped signal |
| **2. REACT** (the test = the Read) | *test* the output | personas react stop/scroll → **band + fraction + why**. The signature foresight beat | ✅ real, but the 8-call fan-out is wrong (see below) | rework SIM fan-out → one batched call; keep band/why |
| **3. REFINE** (post-output loop) | *learn* + close the loop | rewrite-for-audience (regenerate steered harder); flywheel learns from real outcomes | 🟡 partial — rewrite exists; numeric weights `void`-ed | wire weights into REACT aggregation + flywheel |

**The numeric-weights decision (Atlas open-decision #1, resolved):** weights drive
**REACT + REFINE** (simulation aggregation + flywheel learning), *not* generation. STEER
is made real via audience **attributes**, not the 4 weights. This keeps every position
meaningful without building the unbuilt "weights-into-generation (Max)" path.

### Flash SIM fan-out rework (target)
Today the hooks gate fires **8 parallel `runFlashTextMode` calls** — one per candidate
hook (each call internally simulates all 10 personas). Latency is fine (parallel) but
it's 8 API calls/run = cost + rate-limit exposure + architectural inconsistency (the
Read's Fold already does *one* call → 10 archetypes).

- **Target:** collapse to **one batched simulation call** — all candidates + the panel
  in a single prompt → N reactions back. Matches Fold's pattern. 8→1 calls.
- **Risk:** per-candidate attention may drop in a batched prompt → **gate behind an eval**
  (compare band verdicts batched-vs-fan-out on a fixture set before switching).
- **Fallback:** cheap heuristic pre-filter → SIM only top 3–4 candidates.

> ⚠️ This target model is provisional — to be pressure-tested during the live dissection
> of §02 (audience) and §03 (skills). Update here as reality forces adjustments.

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

1. ✅ **RESOLVED** — Audience numeric weights drive REACT+REFINE; STEER via attributes. (See Target Model.)
2. **Is M2 corpus-grounding (RAG) alive?** If dead → ~2K LOC of `_dormant` +
   pgvector + corpus scripts become hard cuts. If alive → keep + schedule.
3. **Rubric critic: revive or delete?** 255 LOC + dual-branch gates in two runners.
4. **`FOLD_MODEL` flip** to omni-plus (+ the cost) — yes/no.
5. **Drop the follow-up chat from the hooks/ideas critical path** (stream it after
   `done`)? Cheap latency win.
6. Behavioral-vs-Apollo double-count + uncalibrated 0.5/0.5 blend — investigate.

---

## Dissection method (how we work this)

This is a **living engine dissection**, not a fixed-scope build. Process:

1. **Spine** = this Atlas (target model + per-subsystem trace). Updated as we learn.
2. **Backlog** = `docs/DISSECTION-BACKLOG.md` — every refinement / bug / cut spotted is
   captured immediately (severity + `file:line`). Solves the "lost audit" problem.
3. **Per-session loop:** pick a subsystem (order: **audience → each skill end-to-end →
   backend wiring/calls → grounding/KC → cuts**) → owner drives the live dev server,
   Claude reads the trace as each call fires → spot issues → *obvious* = fix inline
   (atomic commit) · *larger* = capture to backlog.
4. **Batch** backlog clusters into focused execution when one grows big enough to warrant
   a plan (e.g. "audience rework").
5. **One worktree** for the whole effort; dev server runs there; PR coherent chunks to main.
