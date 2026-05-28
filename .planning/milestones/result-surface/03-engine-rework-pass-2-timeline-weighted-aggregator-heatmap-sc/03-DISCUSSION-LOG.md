# Phase 3: Engine rework — Pass 2 timeline + weighted aggregator + heatmap schema + filmstrip - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc
**Areas discussed:** Pass 2 model + input strategy, Filmstrip generation strategy, Anti-virality recalibration method, Aggregator integration mode, Persona allocation + Qwen audit + carry-forward

---

## Area 1 — Pass 2 model + input strategy

### Clarification raised by user

> "whats difference between pass 1 and pass 2"

Clarified: Pass 1 = existing Wave 3 (qwen3.6-flash, 10 parallel, flat per-persona metrics). Pass 2 = new layered call producing per-segment timeline. User agreed two-pass architecture makes sense.

### Architectural pivot — discovered limitation

Initial framing: Pass 2 input options = (a) cached Wave 0 + Pass 1 (text), (b) re-feed video to qwen-vl, (c) hybrid.

User question: "qwen3.6 should have vision capability as far i remember shouldnt be a pure text model?"

Verified via web search: **qwen3.6-plus is multimodal (vision + text + thinking-mode, 1M context).** User's instinct was correct.

Discovered limitation: **Wave 0 omni currently emits no timestamped segments at all** — single `audio_description` string (50-280 chars), no scene boundaries. So option (a) is not free — requires extending Wave 0 first.

Pivoted to:

| Path | Description | Selected |
|------|-------------|----------|
| Path C — Vision-grounded thinking Pass 2 | Wave 0 omni emits segments[] with timestamped visual+audio events. Pass 2 = qwen3.6-plus thinking-mode + per-segment keyframes + cached Wave 0 segments + Pass 1 verdict. | ✓ |
| Path A — minimal Wave 0 extension + text Pass 2 | Minimal segment schema, text-only Pass 2. | |
| Path B — re-feed video to omni per persona, no thinking | 10 parallel omni calls, no thinking model. | |

| Pass 2 model | Description | Selected |
|--------------|-------------|----------|
| qwen3.6-plus thinking-mode | Already wired as QWEN_REASONING_MODEL. Enable via `extra_body`. | ✓ |
| qwq-plus dedicated thinking | New constant; reasoning-optimized. | |
| qwen3-max thinking | Top-tier; 4-5x cost. | |

**Audio loss honestly disclosed:** qwen3.6-plus is vision+text+thinking, NOT audio-modal. Audio enters as omni's text description (lossy vs raw waveform). User accepted; consistent with standard LLM stack.

---

## Area 2 — Filmstrip generation strategy

### Clarification raised by user

> "what omni and 3.6-plus analyze is one thing what the filmstrip should visually represent is another right?"
> "is omni analyzing the video at 1 fps or how are we setup?"

Clarified: omni internal frame sampling is opaque (DashScope server-side, ~2fps typical). Omni's structured output ≠ filmstrip pixels. They must visually align (column at t=4s, thumbnail at t=4s, retention curve at t=4s = same moment) but are produced via different mechanisms.

### Segment grid

| Option | Description | Selected |
|--------|-------------|----------|
| Scene-boundary semantic (i) | Omni extended to emit scene boundaries. Variable-length segments. | |
| Hybrid: scene boundaries with fixed-bucket fallback (iii) | Try scene boundaries first; fall back to 2s buckets if omni unreliable. Hook zone always separate. | ✓ |
| Fixed-bucket only (ii) | Hard-coded 2s intervals. Simple but loses narrative alignment. | |

### Keyframe source

| Option | Description | Selected |
|--------|-------------|----------|
| ffmpeg extracts at segment t_start | Background worker. Deterministic, model-cost-free, ~50ms per frame. | ✓ |
| Omni emits keyframe timestamp + ffmpeg extracts | Better semantic frame selection. | |
| Skip filmstrip pixel extraction (text-only) | Cheap but loses scrubbing feel. | |

### Extraction timing

| Option | Description | Selected |
|--------|-------------|----------|
| Background worker in parallel with Wave 3 | No SLA hit. SSE `filmstrip_segment_ready` fills entries. | ✓ |
| Synchronous in Wave 0 | Adds 1-3s TTFB. | |
| Lazy on-demand | Wait when user expands node. | |

### Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Storage `/filmstrips/<analysis_id>/<segment>.jpg`, 30-day signed URL | Matches R2.6, existing pattern. | ✓ |
| Reuse existing 'analyses' bucket | Coupled lifecycle. | |

---

## Area 3 — Anti-virality recalibration method

### Reality check

Phase 1 D-15: outcomes corpus is empty (0 rows). Calibration script in place but cannot run. Threshold = 0.4 = fallback, NOT calibrated. Surfaced honestly to user; reframed "recalibration" question.

| Option | Description | Selected |
|--------|-------------|----------|
| Hold 0.4 + add timeline-pattern trigger | Confidence unchanged. NEW: weighted timeline can ALSO trigger anti-virality. | ✓ |
| Distribution-based cutoff on corpus | Set threshold at percentile of weighted aggregate distribution. | |
| Synthetic sweep on training-data.json | Risk: circular (AI-generated labels). | |
| Defer entirely | Anti-virality untouched in Phase 3. | |

### Outcomes schema

| Option | Description | Selected |
|--------|-------------|----------|
| Finalize outcomes schema in Phase 3 (forward-compatible) | Lock analysis_id FK, posted_at, real_*_pct, creator_rating, source. M2-III ingestion plugs in. | ✓ |
| Defer schema to M2-III | | |

---

## Area 4 — Aggregator integration mode

| Option | Description | Selected |
|--------|-------------|----------|
| Option C — additive + new canonical weighted_* fields | Heatmap fields new. New top-level weighted_completion_pct etc. UI policy explicit. Zero Phase 1 regression. | ✓ |
| Option A — pure additive, UI picks per panel | Looser contract; consumers individually decide source. | |
| Option B — replace in-place | Single source of truth; breaks Phase 1 tests + anti-virality calibration. | |

### Headline metrics source

| Option | Description | Selected |
|--------|-------------|----------|
| Pass 2 weighted timeline (R1.2 literal) | All headline chips from weighted curve. | |
| Pass 1 flat aggregate | Status quo. | |
| Hybrid: completion from Pass 2, intent metrics from Pass 1 | Each pass's natural strength. | ✓ |

---

## Area 5 — Persona allocation + Qwen audit + carry-forward

### User meta-question

> "i dont know if these approaches in general represent tiktok and ig algorithm accurately?"

Honest answer surfaced: 6/2/1/1 mix is a **viral-cold-traffic prior**, NOT a model of the TikTok algorithm. Right for "predict virality" pitch; wrong for established creators / niche-bound content. Real algorithm-accuracy work = M3 Tribe v2. User accepted reasoning.

### Persona allocation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 6/2/1/1 + enrich Pass 2 prompts + weight schema future-proof | No shape break. Pass 2 prompts add demo + time-of-day grounding. | ✓ |
| Same + creator-tier auto-weight selector | Rule-based; out of scope for Phase 3. | |
| Defer Pass 2 prompt enrichment too | Smallest scope; lose quality wins. | |

### Stage10 critique model

| Option | Description | Selected |
|--------|-------------|----------|
| Keep qwen3.6-flash | Out of Phase 3 scope. | |
| Upgrade to qwen3.6-plus thinking-mode | Tighter confidence calibration; drives anti-virality. | ✓ |

### Persona weight overrides

| Option | Description | Selected |
|--------|-------------|----------|
| Schema-only future-proof (per R2.3) | Engine config types; no UI; no DB column. | ✓ |
| Defer schema entirely | | |

---

## Claude's Discretion

- ffmpeg hosting strategy (Vercel serverless vs Supabase Edge Function vs background pg_cron worker)
- Timeline-pattern threshold values (≥40% / ≥70% starting point — corpus sweep for false-positive validation)
- Wave 0 omni prompt extension JSON shape for segments[]
- Pass 2 keyframe-injection format (image upload vs text-only descriptions)
- Outcomes table indexing strategy beyond (analysis_id)
- qwen3.6-plus thinking-mode `reasoning_effort` parameter (low/medium/high)
- Anti-virality fix-extraction mapping (timeline trigger → top-3 segment-anchored fixes via Stage11 counterfactuals)
- Pass 2 trigger relative to Pass 1 (sequential vs parallel)
- Whether to introduce a separate `QWEN_PASS2_MODEL` env constant or reuse `QWEN_REASONING_MODEL`

## Deferred Ideas

(See CONTEXT.md `<deferred>` section for the full list. Headline items below.)

- Real outcome-data-driven anti-virality recalibration → M2-III
- Demographic stratification axis in selectPersonaSlots → M3 Tribe v2
- Tribe v2 frozen-encoder grounding (V-JEPA2 + W2vec-BERT + Llama 3.2) → M3
- Audio-as-multimodal in Pass 2 → blocked on Qwen multimodal-thinking-with-audio model
- Per-creator weight override UI → Workspace milestone
- Allocation rebalance to 5/2/1/2 (more cross-niche) → M3
- Established-creator vs new-creator weight presets → M2-II or Workspace
- Wave 4 platform-fit upgrade to thinking-mode → out of Phase 3 scope
