# PLAN — R1′: Modernize the Read fold + consolidate the model stack

> Status (2026-06-25): **PART A SHIPPED** on `fix/r1-fold-modernize`; **PART B (audience unify) = follow-up.**
> Decision evolved during design (the analysis below is kept as reference):
> - A/B testing **skipped** (user call: "no testing, make it work").
> - Model = **`qwen3.7-plus`, NOT flash** — pricing showed plus ≈ flash for text + cheaper output, and a
>   smarter model fixes the diversity collapse more robustly than flash + temperature hacks. `omni-plus`
>   (the paid audio model) was never in play. 3.6-flash retired platform-wide → see `docs/MODEL-POLICY.md`.
>
> **Part A — SHIPPED (commits on this branch):** SIM + fold → 3.7-plus; fold thinking-off + independence
> directive + real (temperature-perturbing) diversity retry + max_tokens 8000; no-video text-analyze gaps
> fixed; dead `wave3.ts` cut; `QWEN_FAST_MODEL` retired. MODEL-POLICY.md rewritten.
>
> **Part B — NOT yet built (the audience unification):** repaint the fold's 10 archetypes with the
> calibrated `AudienceSignature` (General → no repaint → byte-identical) so the Read simulates the user's
> real audience, and surface the Read audience reaction on the thread with the `SIM-1 Max` badge. Needs
> the Read pipeline to load the active audience. See §"The decision" + §"R1′ implementation" below.

## TL;DR

The fold collapses on flash not because the model is weak but because the **call envelope** is old
(greedy decoding + single 10-persona call + no independence directive + a no-op retry). Separately,
the Read sends the **whole video to the model 3×** (Wave 0, Apollo, fold). The fold doesn't need to
re-watch — Wave 0 already distilled the video into a skeleton. Move the fold to **`qwen3.6-flash` +
video (no audio, audio via the skeleton's `audio_event`) + an independence directive**. omni (the
only audio-capable, priciest model) then runs at exactly one place — Wave 0, the sensor.

## The Read pipeline — model topology (verified)

Model constants (`src/lib/engine/qwen/client.ts:28-50`):

| Constant | Value | Capability |
|----------|-------|-----------|
| `QWEN_OMNI_MODEL` | `qwen3.5-omni-flash` | video + **audio** (sense-complete) |
| `QWEN_APOLLO_MODEL` | `qwen3.7-plus` | video, **deaf** (no audio) — reasoning |
| `QWEN_REASONING_MODEL` | `qwen3.7-plus` | video, deaf — chat/decode/adapt/text-mode |
| `QWEN_FAST_MODEL` | `qwen3.6-flash` | video, deaf — the SIM model (S3) |
| `QWEN_SEED` | `7` | fixed seed, paired with temp:0 |

> DashScope-confirmed (user, 2026-06-25): both `-plus` and `-flash` accept `video_url`; only `-omni`
> ingests audio. So a sighted-deaf flash fold is viable (does NOT collapse to text-only).

Call chain for a video upload (entry `src/app/api/analyze/route.ts` → `src/lib/engine/pipeline.ts`):

| Stage | file:line | Model | Video | Audio | thinking | max_tokens | timeout | calls |
|-------|-----------|-------|-------|-------|----------|-----------|---------|-------|
| Wave 0 — read | `pipeline.ts:554` | omni-flash | ✅ | ✅ | off | 8000 | 60s | 1 (+1 drift retry) |
| Wave 2 — Apollo | `pipeline.ts:688`, `deepseek.ts` | 3.7-plus | ✅ (`pipeline.ts:722`) | ✗ | **on** (budget 1500) | 3000 | 120s | 1 (+≤2 retry) |
| Wave 3 — **fold** | `pipeline.ts:776`, `wave3/fold.ts:305` | omni-flash | ✅ (`pipeline.ts:781`) | ✅ | off (default) | 4000 | 90s | 1 (+1 retry) |
| Aggregate | `aggregator.ts` | — | — | — | — | — | — | — |

**Finding: the video is sent to the model 3× per Read** (Wave 0, Apollo, fold). Video tokens dominate
multimodal cost — this is the single biggest cost lever in the pipeline.

## Fold I/O (the call we're changing) — `wave3/fold.ts` + `wave3/fold-prompts.ts`

**Input**
- System prompt `STABLE_FOLD_SYSTEM_PROMPT` (byte-stable cache prefix): 10 ARCHETYPE_DEFINITIONS +
  "Critical Divergence Requirement (D-06)" + a worked JSON schema example.
- User content `buildFoldUserContent(slots, segments, verbatim, emotionArc, videoUrl)`:
  - `## Verbatim Content` — transcript/hook
  - `## Segment Grid` — JSON per segment: `idx, t_start, t_end, visual_event, audio_event, is_hook_zone`
  - `## Emotion Arc` — JSON
  - `## Persona Slot Assignments` — 10× `archetype | slot_type | persona_id | niche`
  - **+ the video itself** when `videoUrl` present (prepended as a `video_url` content item).

**Output** (`FoldResponseSchema`, exactly 10 personas):
```
{ personas: [ {
    archetype, persona_id,
    watch_through_pct, share_intent, comment_intent, save_intent, rewatch_intent,  // 0-100
    scroll_past_second,                                                            // >=0
    segment_reactions: [ { attention: 0-1, swipe_predicted: bool } ]              // one per segment
} ] }
```
`coerceFoldResponse` salvages small-model type sloppiness (string→number, bare array → `{personas}`)
before Zod. Output feeds the audience score (the fold's blend: 0.50·completion + 0.25·share +
0.15·save + 0.10·comment) → the top-level ensemble (0.5·apollo + 0.5·fold) in `aggregator.ts`.

## The diversity collapse — root cause (verified in `fold.ts`)

The known failure: the 10 personas' attention curves homogenize (avg curve range < `DIVERSITY_FLOOR`
= 0.10). Causes, in order of impact:

1. **No independence directive.** The S3 SIM batch spike found the independence directive *"the single
   most important quality lever"* for multi-output-in-one-call. The fold has a "don't homogenize" line
   but not the explicit per-item independence instruction the SIM batch path uses
   (`flash-prompts.ts` BATCH_INDEPENDENCE_DIRECTIVE). `fold-prompts.ts:72-81`.
2. **`temperature:0` + fixed `seed:7` = pure greedy** (`fold.ts:344,346`). Generating all 10 personas
   in one context, greedy decoding lets persona 1 prime 2-10 → they converge. (User OK'd relaxing the
   strict reproducibility requirement, so a seed-pinned temp bump is on the table.)
3. **The diversity retry-nudge is a NO-OP** (`fold.ts:426-431`). On collapse it `continue`s and retries
   — but `callParams` is unchanged (same temp:0, same seed, same prompt). A deterministic call re-run =
   byte-identical output. It burns ~40s to reproduce the exact same collapsed result, then accepts it
   (`457-461`). Confirmed bug.
4. **Single 10-persona call over the raw video.** All personas anchor on the same salient video moments
   → shared signal amplifies homogenization. Reasoning over Wave 0's structured skeleton (per archetype)
   instead of raw video likely diverges more.

## The decision — V2 for the fold (sighted-deaf flash)

Two independent axes (decoupled — earlier analysis wrongly fused them):
- **Audio axis:** omni-flash (audio) → 3.6-flash (deaf). Audio already in the skeleton's `audio_event`.
- **Video axis:** keep video (3.6-flash sees it) vs skeleton-only (cheapest, most lossy).

**Chosen default: V2 = `3.6-flash` + video + independence directive.** Rationale: attention curves are
driven by what personas *see* (pacing/cuts/hook visuals) — keep that. Audio is mostly captured in
`audio_event` — drop the redundant audio decode. Runs on the SIM-class model → the fold **converges with
the S3 text-skill shape** (same model, `enable_thinking:false`, independence directive, coercion layer).

**Apollo stays `3.7-plus`** (already sighted-deaf, V2-shaped; it reasons with thinking — don't downgrade
the expert read to a non-reasoning flash model). Pushing Apollo→3.6-flash is an OPTIONAL A/B variant
only, not the default.

## R1′ implementation (ALL bundled — lands only after A/B greenlight)

In `wave3/fold.ts` + `wave3/fold-prompts.ts`:
1. **Independence directive** in `STABLE_FOLD_SYSTEM_PROMPT` (mirror `flash-prompts.ts`
   BATCH_INDEPENDENCE_DIRECTIVE; preserves byte-stable cache prefix).
2. **Default model → `QWEN_FAST_MODEL` (3.6-flash)** for the fold; keep `FOLD_MODEL` env override.
3. **Video kept, audio dropped** by model choice (3.6-flash is deaf); `videoUrl` still passed.
   (V3 skeleton-only stays available behind a flag if the A/B prefers it.)
4. **Seed-pinned temp bump** (e.g. 0.4-0.6) — only if directive alone doesn't clear the floor.
5. **Fix the no-op retry**: either perturb the retry (bump temp on the diversity re-attempt) or drop
   the retry loop (match the SIM's single-attempt fail-fast).
6. **Delete dead thinking code** `FOLD_USE_THINKING` / `FOLD_THINKING_BUDGET` (flash can't think).
7. **Reconcile `max_tokens`** (code 4000 vs MODEL-POLICY.md 8000) — measure one real output, set rail.
8. **Fix stale comments**: `fold-prompts.ts:8-10` ("does NOT consume video" — false) and `fold.ts:81`
   ("deaf+blind text fold" — 3.6-flash is deaf, NOT blind).

Backlog hygiene (separate, no spend): R2 (double-count) + R4 (dead signals) appear already resolved
(F24/F43) but marked OPEN — verify + mark FIXED. R3 (0.5/0.5 ensemble blend) genuinely uncalibrated →
log as post-launch A/B.

## Gated A/B protocol (needs user spend approval — DashScope, one real video per variant)

Harness: existing `fold-audio-ab` pattern. One real uploaded video; run each variant; compare.

| Variant | Model | Video | Audio | Directive | Question |
|---------|-------|-------|-------|-----------|----------|
| V0 baseline | omni-flash | ✅ | ✅ | ✗ | current behavior |
| V1 | omni-flash | ✅ | ✅ | ✅ | does the directive alone fix diversity? |
| **V2 (target)** | **3.6-flash** | ✅ | ✗ | ✅ | cheap + sighted — does it track V0? |
| V3 | 3.6-flash | ✗ (skeleton) | ✗ | ✅ | cheapest — is the skeleton enough? |
| V2-temp (cond.) | 3.6-flash | ✅ | ✗ | ✅ + temp 0.5 | if V2 still collapses |

Metrics per variant: `avgCurveRange` (diversity; must clear `DIVERSITY_FLOOR` 0.10, target 0.27-0.41),
**fold audience-score vs V0** (does the cheap variant track the video baseline?), cost (¢), latency (s).
Win = V2 clears the floor, tracks V0's score, and is dramatically cheaper/faster.

Spend estimate: ~5 fold calls on one video (a few omni-flash + a few 3.6-flash). Small — exact ¢ TBD
from the first call's usage telemetry (the fold already logs `costCents`).
