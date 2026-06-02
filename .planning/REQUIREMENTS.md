# Requirements: Viral Remix (v3.2)

**Defined:** 2026-05-31
**Core Value:** Close the front half of the creator loop — paste a third-party viral TikTok, decode *why* it worked (repeatable structure vs luck), adapt it into niche concepts, and predict any one of them through the existing engine.
**Seed:** `.planning/milestones/viral-remix-SPEC.md` (8 locked requirements, ambiguity 0.21)
**Research:** `.planning/research/SUMMARY.md` — verified the ingestion gap (see INGEST-01).

## v1 Requirements

Derived 1:1 from the seed SPEC's 8 locked requirements. Each was interview-grounded in the
2026-05-31 design session; research sharpened INGEST-01 from an open spike to a verified build.

### Ingestion (the hard gate)

- [x] **INGEST-01**: For a non-owned TikTok URL submitted in Remix mode, the pipeline obtains real frame/segment/transcript signal (not just preview metadata) — sufficient for a structural Decode.
  - *Verified state:* `tiktok_url` mode today analyzes **caption text only**; the multimodal Omni call is gated on `signedVideoUrl`, populated only for `video_upload` (`pipeline.ts:494–606`). This is a BUILD, not a confirm/deny spike, and it GATES every Decode-dependent requirement.
  - *Acceptance:* A non-owned TikTok URL yields non-empty `video_signals`/segments through `analyzeVideoWithOmni`; source media is derived-and-dropped, never persisted (IP boundary).

### Remix mode & board

- [x] **REMIX-01**: User selects an explicit intent at the input — "Score my content" / "Remix a viral video" — with no auto-detect; Remix routes the submission down the remix path. *(SPEC req 1)*
- [x] **REMIX-02**: Remix mode renders one board, two configurations — keeps Input/Engine/Audience/Content Craft and swaps Verdict+Actions → Decode+Adapt, on desktop canvas and mobile card-stack, with no separate route; grade-mode board is unchanged. *(SPEC req 6)*

### Decode

- [x] **DECODE-01**: The Decode frame renders a structural teardown (hook pattern, pacing/structure, the turn, emotional beat) for a remix-mode video, on its own lightweight Qwen path (NOT the full 332s scoring pipeline). *(SPEC req 2)*
- [x] **DECODE-02**: The Decode frame renders an explicit repeatable-vs-luck split (reproducible structure vs timing/existing-audience/outlier), and never frames the video as something the user should "fix." *(SPEC req 2)*

### Adapt

- [x] **ADAPT-01**: The Adapt frame renders exactly 3 concepts, each adapting the source's *format/structure* (not its content) to the user's niche, each with actionable specificity (angle, hook, who-it's-for, format_borrowed). *(SPEC req 3)*
- [x] **ADAPT-02**: Adapt is grounded in the user's niche sourced from the creator-profile; with an empty profile the user is prompted inline before concepts generate. *(SPEC req 7)*

### Develop & lineage

- [x] **DEVELOP-01**: Each concept exposes "Develop & predict →" that runs that single concept through the existing `/api/analyze` pipeline, producing one scored `/analyze/[id]` board and navigating to it; other concepts are NOT scored unless separately developed (no bulk scoring). *(SPEC req 4)*
- [x] **DEVELOP-02**: A developed child analysis stores a non-null `parent_id` (the source remix analysis), shows a working "remixed from" chip linking back, and appears in the sidebar Recent list. *(SPEC req 5)*

## v2 / Future Requirements

Deferred — tracked, not in this roadmap. (From the SPEC's explicit "future milestone" list.)

### Discovery

- **RADAR-01**: Daily "winning in your niche" trend feed (pull→push). Sidebar nav hook only this milestone; no build.
- **PLAYBOOK-01**: Pattern Playbook — accumulated niche formulas across many decoded videos.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Radar / trend feed build | Future milestone; this milestone is pull-only (user pastes) |
| Pattern Playbook | Future milestone; lands in stubbed Pinned/Projects sidebar later |
| Auto-detect mine-vs-theirs | Explicitly rejected in favor of the explicit toggle |
| Separate Studio/Discover app surface | Rejected; reconfigure the existing board instead |
| Bulk auto-scoring of all concepts | Engine E2E ~90–332s makes it cost/latency prohibitive |
| Storing/redistributing source video | Derive structural analysis only (transformative, legally safer) |
| Non-TikTok platforms (Reels, Shorts) | TikTok-only for this milestone |
| Content copying / "redo this video" framing | Legal + craft — framing is always "adapt this format" |
| New npm dependencies | Research confirmed all capabilities exist in installed deps |

## Traceability

Mapped to phases during roadmap creation (2026-05-31). See `.planning/ROADMAP.md` for phase detail.
INGEST-01 (Phase 1) is the hard gate: every Decode/Adapt/Develop requirement is BLOCKED until it lands.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGEST-01 | Phase 1 | Complete |
| REMIX-01 | Phase 2 | Validated (Phase 2) |
| REMIX-02 | Phase 2 | Validated (Phase 2) |
| DECODE-01 | Phase 3 | Complete |
| DECODE-02 | Phase 3 | Complete |
| ADAPT-01 | Phase 4 | Complete |
| ADAPT-02 | Phase 4 | Complete |
| DEVELOP-01 | Phase 5 | Complete |
| DEVELOP-02 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 9 total (8 from SPEC + INGEST-01 split out from req #8 as the gating build)
- Mapped to phases: 9 (across 5 phases — see ROADMAP.md)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-31 — derived from viral-remix-SPEC.md, sharpened by research SUMMARY.md*
*Traceability populated: 2026-05-31 — all 9 reqs mapped to phases 1–5; 0 unmapped.*
