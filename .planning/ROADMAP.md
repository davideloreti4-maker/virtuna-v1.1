# Roadmap — Viral Remix (v3.2)

**Branch:** `milestone/viral-remix`
**Worktree:** `~/virtuna-viral-remix/`
**Phase range:** 1–5 (milestone-scoped numbering)
**Forks from:** `feat/actions-frame-inline-redesign` @ `9626c92` (NOT `main` — see MILESTONE.md "Why this base")

## Overview

Close the *front half* of the creator loop: paste a third-party viral TikTok in an explicit Remix mode → **Decode** (why it worked, repeatable structure vs luck) → **Adapt** (3 niche-adapted concepts, format-not-content) → per-concept **Develop & predict** through the existing engine → parent/child lineage ("remixed from" chip). Product spine is settled: **Decoder → Translator → Predict.**

This is overwhelmingly a *wiring* milestone, not a build-new-infrastructure one. Research traced every capability to installed deps and existing seams. New surface area is strictly limited to: the Decode frame, the Adapt frame, the remix toggle, and the `parent_id` lineage column. The board, SSE pipeline, scoring engine, mobile card-stack, sidebar, and permalink routing are **reconfigured, not rebuilt**. No new npm dependencies. Any new model call (decode/adapt generation) is **Qwen-only**.

## The hard gate: INGEST-01 blocks everything downstream

Research VERIFIED (4 agents, file+line grounded) that the `tiktok_url` path today analyzes **caption text only**. The multimodal Omni call is gated on `signedVideoUrl` (`pipeline.ts:520`), populated only for `video_upload`; a non-owned URL yields `video_signals: null` and all-false `signalAvailability`. There is no frame, no transcript, no segment. **A structural Decode is impossible on a caption string.**

Therefore req #8 is reframed from spike → **BUILD**, and it is **Phase 1, alone**. Every Decode-, Adapt-, and Develop-dependent requirement (DECODE-01/02, ADAPT-01/02, DEVELOP-01/02) is **BLOCKED until INGEST-01 lands** and a non-owned URL demonstrably produces real Omni segments. No Decode prompt schema is even written until Phase 1 inspects real Omni output. This dependency is non-negotiable and is reflected in every downstream phase's "Depends on" line.

The only IP-introducing risk in the milestone is born here: the instant Phase 1 adds a download step, the pipeline handles third-party MP4s. **Derive-and-drop is mandatory** — source media is derived and dropped, never persisted (no `video_storage_path` on a remix row; delete in `finally`).

## Parallelization Plan

```
   feat/actions-frame-inline-redesign @ 9626c92
                    │
                    ▼
              Phase 1  (HARD GATE — ingestion BUILD, sequential, alone)
              INGEST-01
              non-owned URL → real Omni segments; derive-and-drop
                    │
                    ▼
              Phase 2  (remix mode + one-board-two-config plumbing)
              REMIX-01 / REMIX-02
              toggle UI · mode flag thread · mode-aware frame registry · empty Decode/Adapt shells
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
       Phase 3             Phase 4          (parallelizable once Phase 2 lands)
       DECODE-01/02        ADAPT-01/02
       Decode frame        Adapt frame + niche
       (also needs P1)     (needs P2 shell only)
          └─────────┬─────────┘
                    ▼
              Phase 5  (composes everything — sequential, last)
              DEVELOP-01 / DEVELOP-02
              per-concept Develop & predict · parent_id lineage · regression sweep
```

- **Phase 1 (INGEST-01)** forks first and runs alone. Hard gate; live Apify actor confirmation required before any Decode code.
- **Phase 2 (REMIX-01/02)** is pure plumbing (type/schema/UI + mode-aware registry + empty frame shells). It has no engine dependency and could technically begin alongside Phase 1, but it is sequenced after to keep one clean integration point and because its checkpoint (remix board renders the correct 6-frame layout) is the skeleton Phases 3/4 plug into.
- **Phase 3 (DECODE-01/02)** is blocked on **both** Phase 1 (needs confirmed ingestion signal) and Phase 2 (needs the frame shell).
- **Phase 4 (ADAPT-01/02)** is blocked on Phase 2 only (needs the shell). It can run in parallel with Phase 3. Adapt consumes Decode's repeatable-lane output, so if run truly concurrently it stubs against a fixed decode fixture until Phase 3 lands.
- **Phase 5 (DEVELOP-01/02)** composes Phase 3 + Phase 4 output plus the `parent_id` migration. Sequenced last; also owns the grade-mode regression sweep and Raycast/mobile/error-boundary polish on the two new frames.

## Phases

- [x] **Phase 1: Ingestion BUILD (HARD GATE)** — A non-owned TikTok URL yields real frame/segment/transcript signal through `analyzeVideoWithOmni`; source media derived-and-dropped, never persisted
- [ ] **Phase 2: Remix Mode + One-Board-Two-Config** — Explicit "Score / Remix" toggle routes the remix path; board swaps Verdict+Actions → Decode+Adapt (empty shells) on desktop canvas + mobile card-stack; grade board unchanged
- [ ] **Phase 3: Decode Frame** — Lightweight Qwen decode path renders a structural teardown + an explicit repeatable-vs-luck split; never "fix this" framing
- [ ] **Phase 4: Adapt Frame + Niche** — Exactly 3 format-adapted (not content-copied) concepts grounded in the creator-profile niche, with inline fallback prompt when niche is empty
- [ ] **Phase 5: Develop & Predict + Lineage** — Per-concept "Develop & predict →" scores one concept via the existing pipeline; child stores `parent_id`, shows a working "remixed from" chip, appears in Recent; grade-mode regression confirmed

## Phase Details

### Phase 1: Ingestion BUILD (HARD GATE)
**Goal**: For a non-owned TikTok URL submitted on the remix/decode path, the pipeline obtains real frame/segment/transcript signal through `analyzeVideoWithOmni` — sufficient for a structural Decode — with source media derived and dropped, never persisted.
**Depends on**: Nothing (forks first from `feat/actions-frame-inline-redesign` @ `9626c92`). This is the hard gate; nothing downstream begins until it lands.
**Requirements**: INGEST-01
**Success Criteria** (what must be TRUE):
  1. A non-owned TikTok URL fed through the new path produces non-empty `video_signals`/segments via `analyzeVideoWithOmni` (not caption text) — verified by a spike artifact documenting the exact signal obtained
  2. The same ingestion on two structurally-different viral videos produces *different* structural signal (guards against caption-only hallucination, pitfall C1 — identical fields = no real signal)
  3. Source media is derive-and-drop: no `video_storage_path`/persisted MP4 on a remix/decode row; the downloaded file is deleted in a `finally` block (IP boundary, pitfall C4)
  4. A documented failure-mode taxonomy exists (private, region-locked, carousel, 404, `vm.` short link) with confirmed Clockworks reliability + URL-TTL behavior across ≥5 varied live URLs, and the resolve-hop latency is measured against `maxDuration=300` (async resolve or re-host applied if needed)
  5. The grade-mode `video_upload` path and existing analyze flow are unchanged (no regression)
**Plans**: 3 plans
- [x] 01-01-PLAN.md — Live ingestion spike (resolve A1-A5: Clockworks contract, mp4 field, URL TTL, resolve+Omni latency vs maxDuration=300, C1 two-video differential) → 01-INGESTION-SPIKE.md [autonomous: false — billable live Apify run, gates the build]
- [x] 01-02-PLAN.md — Single-URL resolveVideoUrl on ApifyScrapingProvider + apifyVideoSchema mp4 field + typed failure taxonomy + SSRF host allowlist (Wave-0 scraping tests)
- [x] 01-03-PLAN.md — Additive tiktok_url Omni branch in pipeline.ts + derive-and-drop finally + cost-exhaustion 429 reuse + regression freeze (derive-and-drop test)
**Research flag**: NEEDS live Apify actor test (Clockworks `tiktok-scraper`, `shouldDownloadVideos:true`, read `mediaUrls[0]`) across ≥5 varied URLs, plus Omni structured-output fidelity inspection, BEFORE any Decode-phase code is written.

### Phase 2: Remix Mode + One-Board-Two-Config
**Goal**: An explicit intent selector at the input routes a remix submission down the remix path; the board renders one-board-two-configs — keeps Input/Engine/Audience/Content Craft and swaps Verdict+Actions → Decode+Adapt (as empty shells this phase) on both desktop canvas and mobile card-stack — with no separate route, and the grade-mode board entirely unchanged.
**Depends on**: Phase 1 (sequenced after to keep a single clean integration point; the remix mode is only meaningful once a remix URL can actually be ingested).
**Requirements**: REMIX-01, REMIX-02
**Success Criteria** (what must be TRUE):
  1. The input shows an explicit "Score my content" / "Remix a viral video" selector with no auto-detect; choosing Remix routes the submission down the remix path and persists a row with `mode='remix'`
  2. With Remix selected, the board renders Input + Engine + Audience + Content Craft + Decode + Adapt (Verdict + Actions swapped out) on the desktop Konva canvas; the layout reflows correctly via the mode-aware remix column plan
  3. The mobile card-stack (<768px) absorbs the swapped Decode + Adapt as cards in the correct order
  4. With Score selected, the existing grade board renders unchanged (Verdict + Actions present, no Decode/Adapt) — no regression on the score path
  5. `mode` is included in the content hash so a remix-decode and a score of the same URL do not collapse into one cache entry; mode survives a permalink reload (live and `/analyze/[id]` agree)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Decode Frame
**Goal**: For a remix-mode video, the Decode frame renders a structural teardown (hook pattern, pacing/structure, the turn, emotional beat) plus an explicit repeatable-vs-luck split — on its own lightweight Qwen path, never the full ~332s scoring pipeline, and never framing the video as something the user should "fix."
**Depends on**: Phase 1 (needs confirmed real Omni ingestion signal) AND Phase 2 (needs the Decode frame shell + mode routing). Can run in parallel with Phase 4.
**Requirements**: DECODE-01, DECODE-02
**Success Criteria** (what must be TRUE):
  1. For a known viral test video, the Decode frame renders non-empty structural fields (hook pattern, structure/pacing, the turn, emotional beat) — generated by a dedicated Qwen decode call in `engine/remix/decode.ts`, persisted to `variants.remix.decode`
  2. Decode runs on a lightweight path (Omni segment call → one Qwen decode call), NOT `runPredictionPipeline`; it does not touch `usage_tracking`/`DAILY_LIMITS` and completes well under the full scoring pipeline's latency (pitfall C2)
  3. The frame renders an explicit repeatable-vs-luck split (reproducible structure vs timing / existing-audience / outlier) with a non-empty luck column — never collapsing everything into "repeatable" (pitfall: luck hallucination)
  4. Decode never frames the video as something to "fix"; copy is honest teardown of why it worked, on-brand with the Score frame's honest-number ethos
  5. The grade-mode board and existing analyze flow remain unchanged (no regression)
**Plans**: TBD
**Research flag**: Write the decode prompt schema only after inspecting real Omni output from Phase 1 on a non-owned URL (determines whether a Qwen ASR transcript is needed for hook-line fidelity).
**UI hint**: yes

### Phase 4: Adapt Frame + Niche
**Goal**: The Adapt frame renders exactly 3 concepts, each adapting the source's *format/structure* (not its content) to the user's niche with actionable specificity (angle, hook, who-it's-for, `format_borrowed`), grounded in the creator-profile niche — and when the profile niche is empty, the user is prompted inline before concepts generate.
**Depends on**: Phase 2 (needs the Adapt frame shell + mode routing). Consumes Phase 3's Decode repeatable-lane output; if run concurrently with Phase 3 it stubs against a fixed decode fixture until Phase 3 lands.
**Requirements**: ADAPT-01, ADAPT-02
**Success Criteria** (what must be TRUE):
  1. For a populated niche, the Adapt frame renders exactly 3 distinct concepts, each with `hook`, `angle`, `who_its_for`, and `format_borrowed`, generated Qwen-only in `engine/remix/adapt.ts`
  2. Each concept adapts the source's *format/structure* and references the user's niche; none reproduces the source's specific content/subject — enforced at the prompt level (the adapt prompt receives structural fields only, never the source caption)
  3. Concepts are drawn from the Decode repeatable lane (not luck-attributed elements)
  4. With an empty creator-profile niche, the user is prompted inline before concepts generate; once a niche is supplied, the 3 concepts generate (Decode still renders niche-free in the meantime)
  5. The grade-mode board and existing analyze flow remain unchanged (no regression)
**Plans**: TBD
**UI hint**: yes

### Phase 5: Develop & Predict + Lineage
**Goal**: Each concept exposes "Develop & predict →" that runs that single concept through the existing `/api/analyze` pipeline, producing one scored `/analyze/[id]` board and navigating to it (no bulk scoring); the developed child stores a non-null `parent_id`, shows a working "remixed from" chip linking back, and appears in the sidebar Recent list. This phase also owns the grade-mode regression sweep and Raycast/mobile/error-boundary polish on the two new frames.
**Depends on**: Phase 3 AND Phase 4 (composes Decode + Adapt output) plus the `parent_id` migration. Sequenced last.
**Requirements**: DEVELOP-01, DEVELOP-02
**Success Criteria** (what must be TRUE):
  1. Clicking "Develop & predict →" on one concept creates exactly one new analysis through the existing `/api/analyze` SSE pipeline and navigates to its `/analyze/[id]` board; the other concepts are NOT scored unless separately developed (zero streams open until click, then exactly 1 — pitfall C3)
  2. The developed child row has a non-null `parent_id` set to the **source remix analysis id** (stable, known before Develop starts — NOT derived from the child's `started` SSE frame), written at all insert sites
  3. The child board shows a working "remixed from" chip linking back to the source remix analysis (`/api/analysis/[id]` returns the minimal parent summary)
  4. The developed child appears in the sidebar Recent list; a decode/remix row hydrates correctly on permalink reload via a distinct completion marker (`variants.remix != null`, since `overall_score` is null on decode rows — pitfall m3) and the polling ceiling is lifted for remix-developed children
  5. Full regression confirmed: grade-mode board and existing analyze flow unchanged; both new frames pass Raycast styling, render error boundaries, and verify on the mobile card-stack at <768px
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phase 1 (hard gate) → Phase 2 (plumbing) → Phases 3 + 4 (parallelizable, Phase 3 additionally gated on Phase 1) → Phase 5 (composes 3+4, sequenced last).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ingestion BUILD (HARD GATE) | 3/3 | Complete | 2026-06-01 |
| 2. Remix Mode + One-Board-Two-Config | 0/TBD | Not started | - |
| 3. Decode Frame | 0/TBD | Not started | - |
| 4. Adapt Frame + Niche | 0/TBD | Not started | - |
| 5. Develop & Predict + Lineage | 0/TBD | Not started | - |

## Coverage

All 9 v1 requirements mapped to exactly one phase. No orphans. No duplicates. Every Decode/Adapt/Develop requirement is gated on Phase 1 (INGEST-01).

| REQ-ID | Category | Phase | Notes |
|--------|----------|-------|-------|
| INGEST-01 | Ingestion | 1 | HARD GATE. Non-owned URL → real Omni segments; derive-and-drop IP boundary. Blocks DECODE/ADAPT/DEVELOP. |
| REMIX-01 | Remix mode & board | 2 | Explicit "Score / Remix" toggle; no auto-detect; routes the remix path. |
| REMIX-02 | Remix mode & board | 2 | One board, two configs; swap Verdict+Actions → Decode+Adapt (shells); desktop + mobile; grade board unchanged. |
| DECODE-01 | Decode | 3 | Structural teardown on a lightweight Qwen path (NOT the 332s scorer). Gated on Phase 1. |
| DECODE-02 | Decode | 3 | Explicit repeatable-vs-luck split; never "fix this" framing. Gated on Phase 1. |
| ADAPT-01 | Adapt | 4 | Exactly 3 format-adapted (not content-copied) concepts with angle/hook/who-it's-for/format_borrowed. Gated on Phase 1. |
| ADAPT-02 | Adapt | 4 | Niche from creator-profile; inline fallback prompt when empty. Gated on Phase 1. |
| DEVELOP-01 | Develop & lineage | 5 | Per-concept "Develop & predict →" → one scored child via existing pipeline; no bulk scoring. Gated on Phase 1. |
| DEVELOP-02 | Develop & lineage | 5 | Child stores non-null `parent_id`, shows "remixed from" chip, appears in Recent. Gated on Phase 1. |

**Coverage:** 9/9 v1 requirements mapped. 0 unmapped. No duplicates.

---
*Roadmap created: 2026-05-31 — derived from REQUIREMENTS.md (9 locked reqs), viral-remix-SPEC.md acceptance criteria, and research/SUMMARY.md converged build order. Granularity: fine. INGEST-01 is the hard first gate; all Decode/Adapt/Develop work is blocked until it lands.*
