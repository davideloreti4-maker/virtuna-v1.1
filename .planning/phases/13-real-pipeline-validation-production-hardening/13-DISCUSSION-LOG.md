# Phase 13: Real Pipeline Validation + Production Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `13-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 13-Real Pipeline Validation + Production Hardening
**Areas discussed:** Stage 11 rebuild, Stage 11 UI wiring, Acceptance threshold, Infra hardening, Three-mode contract, Caption demotion + audit, Retrieval handling, Signal weight re-tuning, Phase 12 reconciliation, Cost + upload limits, Earlier-phase findings

---

## Initial gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Stage 11 rebuild — prompt + model + behavior | Which signal fields, which model, suggestion shape across bands | ✓ |
| Stage 11 UI wiring — where does it render? | result.counterfactuals is populated but no UI reads it | ✓ |
| Phase 13 acceptance threshold — what is 'pass'? | 10 videos, no labeled ground truth | ✓ |
| Gemini IDs + DeepSeek hangs — infra hardening | Provisional IDs + 30-60s reasoner hangs | ✓ |

**User's choice:** all four + asked to wait for additional session context (prior conversation paste explaining Stage 11 + benchmark issues).

---

## Stage 11 architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Wave 1 `fileUri` — fresh Gemini call | Zero re-upload, Stage 11 sees video | ✓ |
| Single combined Wave 1 call | Wave 1 returns counterfactuals too | |
| Metadata-only — Wave 1 outputs as text | No video access, cheapest | |

**User's choice:** Option 1. Asked clarifying question: "so the video gets seen 2 times by gemini?"
**Notes:** Confirmed — uploaded once, visually processed twice (Wave 1 + Stage 11). Cost = one additional vision pass.

---

## Stage 11 model

| Option | Description | Selected |
|--------|-------------|----------|
| `gemini-3.1-pro` | Flagship reasoning, ~$0.13/analysis | ✓ |
| `deepseek-reasoner` | Stronger CoT but DeepSeek hang risk unresolved | |
| `gemini-3-flash` | Solid visual reasoning, ~$0.04/analysis | |

**User's choice:** `gemini-3.1-pro`. Asked follow-up about full pipeline model lineup.
**Notes:** WebSearch verified May 2026 Gemini lineup: 3.1 Pro flagship, 3 Pro tier-2, 3 Flash, 3.1 Flash-Lite, 2.5 family legacy. No `3.5-flash` exists (user mentioned but not a real model).

---

## Pipeline-wide Gemini assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Lock proposed config | Wave 0 → 3.1 Flash-Lite, hook → 3.1 Pro, body/CTA → 3 Flash, Stage 11 → 3.1 Pro | ✓ |
| Quality-maxed (everything Pro) | ~$0.45+ per analysis | |
| Keep current split, update IDs only | Wave 0 stays on 3 Flash | |

**User's choice:** Option 1.
**Notes:** User flagged silent fallback bug: "when gemini 3 or 3.1 was called it falled back to 2.5". Captured as Plan 1 investigation task (D-10).

---

## Stage 11 shape

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive by score band | <50 → 3 fixes; 50-70 → 2 fixes + 1 reinforcement; ≥70 → 1 stretch + 2-3 reinforcements | ✓ |
| Fixed split: 3 changes + 2 reinforcements always | Same shape regardless of score | |
| Always 3 hyper-specific items, framing varies | Lowest UI work | |

**User's choice:** Adaptive by score band.

---

## Stage 11 UI wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Replace — Stage 11 owns SuggestionsSection | result.counterfactuals replaces legacy result.suggestions[] | ✓ |
| Two separate blocks | Both surfaces visible | |
| Merge into one ranked list | Aggregator merges, UI unchanged | |

**User's choice:** Replace.

---

## UI scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full UI-SPEC pass via /gsd-ui-phase 13 | Design contract before planning | ✓ |
| Minimal visual change — swap data, keep layout | Fastest | |
| Custom rebuild inside Phase 13 — no UI-SPEC | Ad-hoc during build | |

**User's choice:** Full UI-SPEC pass.

---

## Per-video pass criteria

| Option | Description | Selected |
|--------|-------------|----------|
| Crash-free + signal-completeness checklist | All waves complete + chip list correct + Stage 11 shape valid + user thumbs-up on suggestion relevance | ✓ |
| Pure subjective thumbs-up | User watches + ≥8/10 | |
| Hard checklist only — no subjective gate | Mechanical | |

**User's choice:** Option 1.
**Notes:** User contributed crucial workflow: download TikTok video locally → upload via UI → paste URL back to me → I scrape post-publish metrics. Gives real ground truth even without labeled corpus. Asked: "should i download manually the video and send you the link so you can scrape post analytics?"

---

## Video set strategy

| Option | Description | Selected |
|--------|-------------|----------|
| User-picked, score-band stratified | Loose target 3-4 low + 3-4 high + 2-3 mid across 3+ niches | ✓ |
| User-picked, no stratification | Whatever feels relevant | |
| Pull 10 random rows from Phase 1 corpus | Pre-baked but old | |

**User's choice:** User-picked, stratified.

---

## Gemini + DeepSeek hardening

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini upfront, DeepSeek deferred | Self-test gates E2E, DeepSeek mitigated when first hang manifests | ✓ |
| Both upfront in Plan 1 | Build mitigation ahead of evidence | |
| Both deferred to first E2E run | No pre-flight checks | |

**User's choice:** Option 1. Asked follow-up: "where do we use deepseek and what model? v4 flash sufficient? any optimization?"
**Notes:** DeepSeek audit produced: 6 call sites (Wave 0 niche, Wave 1 rules, Wave 2 reasoning, Wave 3 personas×10, Wave 4 platform fit, Stage 10 critique). 5 of 6 on v4-flash (sufficient). Only Wave 2 needs reasoner (the 30-60s hang vector). Optimization identified: fold Wave 0 niche into Gemini.

---

## Wave 0 niche fold

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Gemini | Single Wave 0 call returns content_type + niche; removes 1 DeepSeek site | ✓ |
| Keep separate | Status quo | |
| Defer to M2 | Document only | |

**User's choice:** Fold into Gemini.
**Notes:** User contributed critical product insight: "most user wont upload a caption with their video so thats something to adress in logic". Triggered the caption-demotion line of inquiry that reshaped the rest of the discussion.

---

## Three-mode engine contract

| Option | Description | Selected |
|--------|-------------|----------|
| video_upload primary; tiktok_url + text graceful degrade | Video bytes only as primary contract | ✓ |
| video_upload + tiktok_url only — drop text-script | Scope reduction | |
| All three modes equal first-class with parity | Overengineering | |

**User's choice:** Option 1.
**Notes:** User: "there is 3 modes... in general i wouldnt value caption really, users upload tiktok videos and just type something random or emojis or hashtags etc, on video file upload there is maybe some value if they add a good caption i still think its not that trustable."

---

## Caption-less audit scope

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive — every stage audited upfront | Produces AUDIT-CAPTION-LESS.md, gates E2E | ✓ |
| Pre-audit obvious + discover during E2E | Faster start | |
| Pure discover-during-E2E | No upfront audit | |

**User's choice:** Option 1.
**Notes:** User contributed: "maybe even consider dropping caption completely and just focus on the actual video, caption doesnt have much inpact on virality or video performance anyway." Triggered the caption-demotion decision and downstream signal-weight cascade.

---

## Retrieval signal handling

| Option | Description | Selected |
|--------|-------------|----------|
| Disable retrieval in Phase 13, defer M2 re-embed | Weight=0, mirrors ML pattern | ✓ |
| Keep retrieval active but flag as text-mode-only | Confusing UX | |
| Re-embed corpus in Phase 13 (~$2300, 4-6h) | Scope balloon | |

**User's choice:** Option 1.
**Notes:** User: "lets stay away from any corpus data and just focus on actual video product (corpus data could also be sloppy / inaccurate)" — corpus trust concern based on DeepSeek-executed phases.

---

## Signal weight re-tuning

| Option | Description | Selected |
|--------|-------------|----------|
| Re-tune to proposed values | behavioral 0.40, gemini 0.35, audio 0.10, trends 0.10, platform_fit 0.05, rules/retrieval/ml=0 | ✓ |
| Keep current, let normalize() redistribute | Less opinionated | |
| Disable only retrieval, keep rules but flag broken | Confusing UX | |

**User's choice:** Re-tune to proposed values.
**Notes:** Audit revealed all 17 rules in rules.ts are caption-pattern-based. Rules disabled alongside retrieval and ml.

---

## Phase 12 artifact reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Archive as superseded, keep utility code | Keep --max-rows + Platt params (flagged), discard smoke-v3.json | ✓ |
| Full discard | Wipe everything | |
| Keep Phase 12 as in-progress, complete after Phase 13 | Re-run benchmark | |

**User's choice:** Archive as superseded.

---

## Cost budget + upload size

| Option | Description | Selected |
|--------|-------------|----------|
| $0.40 budget + 287MB upload cap | TikTok max known, $0.31 estimate buffered | ✓ |
| $0.20 budget + 200MB cap | Forces optimization | |
| Defer both decisions to post-10-video data | Risk of unplanned cost | |

**User's choice:** Option 1.

---

## Earlier-phase findings folded into Phase 13

| Option | Description | Selected |
|--------|-------------|----------|
| Cache invalidation on version flip (CRITICAL) | Bust cache on 3.0.0 flip | ✓ |
| Test suite update for caption demotion (CRITICAL) | 1191 tests need explicit update task | ✓ |
| SignalAvailability chip three-state semantics | ✓/✕/⚠ distinction | ✓ |
| tiktok_url flow verification + trending_sounds DB check | E2E tiktok_url + DB population sanity | ✓ |

**User's choice:** All four + "fold all findings and optimizations / fixes into phase 13".

---

## Validation diff tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Claude WebFetch per video (manual) | Simpler at 10-video scale | ✓ |
| Apify-based metric scrape | Reuses corpus infra | |

**User's choice:** Claude WebFetch.
**Notes:** "lets use claude for the small sample size instead, its simpler. anything else we need to adress for earlier phases?"

---

## Claude's Discretion

- Exact `engine-self-test.ts` CLI shape (single command vs subcommands per slot)
- Specific `AUDIT-CAPTION-LESS.md` structure (per-stage table vs flat findings list)
- Whether to introduce a shared `videoFileUri` field on the pipeline context or pass as function arg
- Per-band suggestion shape Zod schema details (single vs discriminated-union schema)
- Exact `WebFetch` prompt for TikTok metric extraction (will iterate per video)
- DeepSeek hang kill-path implementation when it manifests (gtimeout subprocess vs in-process timeout cascade)

## Deferred Ideas

- Re-embed corpus from video features (M2, ~$2300)
- Rebuild rules from video transcript (M2)
- Retrain Platt calibration on video-mode predictions (M2)
- Granular Sentry surface for model mismatch (M2)
- Stage 11 cache scope across users (M2)
- Pre-upload compression / video trimming UX (M2)
- Tighter cost budget after 10-video data (M2 re-tune)
- TikTok URL flow auto-fetches actuals into UI (M2)
