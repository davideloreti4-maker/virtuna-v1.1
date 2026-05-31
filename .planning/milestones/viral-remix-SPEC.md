# Milestone Seed: Viral Remix — Specification

**Created:** 2026-05-31
**Status:** SEED — fast-follow milestone, not yet activated. Formalize via `/gsd-new-milestone` off `main` once MVP Cut ships.
**Ambiguity score:** 0.21 (gate: ≤ 0.20 — see Ambiguity Report; one dimension below min by design)
**Requirements:** 8 locked

> This is a milestone seed, not a phase spec. It captures the locked "what/why" from the 2026-05-31 design session so the new milestone can be stood up with planning already grounded. Phase breakdown happens at `/gsd-new-milestone` → roadmap time.

## Goal

A creator can paste a third-party viral TikTok in an explicit **Remix mode**, and the board returns a **Decode** (why it worked, separating repeatable structure from luck) plus an **Adapt** frame of ~3 niche-adapted concepts — each of which can be developed into a real, scored analysis through the existing prediction pipeline.

This closes the *front half* of the creator loop: today Virtuna is reactive (bring your content → get graded); Remix adds proactive discovery → creation (see what works → make your version → predict it before filming).

## Background

Current state (verified 2026-05-31):

- Input (`src/components/app/tiktok-url-input.tsx`) already accepts a TikTok URL, validates it, and fetches a preview (thumbnail, creator, caption). Today that path treats the video as **the user's own content to grade**.
- `POST /api/analyze` streams SSE → a Konva board with 6 frames: Input, Engine, Audience, Verdict, Actions, Content Craft (`src/components/board/`). Mobile renders a card-stack (`BoardMobile.tsx`).
- Sidebar has New analysis + Recent history; `/analyze/[id]` permalinks every analysis (`src/components/sidebar/Sidebar.tsx`).
- Settings has a `creator-profile` tab — a place the user's niche can be sourced from.
- Engine E2E latency is high (~90–312s per full analysis — see engine-latency-optimization work). This makes "auto-score every concept" expensive and shapes requirement #4.

What does NOT exist: any notion of analyzing a video as *reference rather than self*, a Decode output, an Adapt/concept-generation output, a remix intent toggle, or parent/child lineage between analyses.

## Product spine (settled, do not re-litigate)

**Decoder → Translator → Predict.** Decode earns trust (honest "repeatable vs luck", on-brand with the Score frame's honest-number ethos). Translator delivers the magic (concrete niche-adapted concepts; **format/structure adaptation, never content copying** — framing is always "adapt this format", never "redo this video"). Predict closes it (each concept scored through the real engine).

## Requirements

1. **Remix intent toggle**: An explicit mode selector at the input front door deterministically chooses the board configuration.
   - Current: Input has no mode concept — a pasted TikTok URL is always graded as the user's own content.
   - Target: Input shows two intents — "Score my content" / "Remix a viral video." Selecting Remix routes the submission down the remix path and renders the board in remix configuration. No auto-detect / handle-matching.
   - Acceptance: With Remix selected, submitting a TikTok URL produces a board with Decode + Adapt frames (not Verdict + Actions); with Score selected, the existing grade board renders unchanged.

2. **Decode frame**: For a remix-mode video, the board explains *why it worked* and separates repeatable structure from luck.
   - Current: No Decode output exists.
   - Target: A Decode frame renders structural teardown (hook pattern, pacing/structure, the turn, emotional beat) and an explicit **repeatable-vs-luck** split (what a creator can reproduce vs what was timing/existing-audience/outlier).
   - Acceptance: For a known viral test video, the Decode frame renders non-empty structural fields AND a repeatable-vs-luck distinction; it never frames the video as something the user should "fix."

3. **Adapt frame**: The board outputs ~3 concrete concepts adapting the decoded format to the user's niche.
   - Current: No concept-generation output exists.
   - Target: An Adapt frame renders 3 distinct concepts, each adapting the *format/structure* (not the content) to the user's niche, each with enough specificity to act on (angle, hook, who it's for).
   - Acceptance: Adapt renders exactly 3 concepts for a populated niche; each references the source's structure and the user's niche; none reproduces the source's specific content/subject.

4. **Develop & predict (per-concept)**: Each adapted concept can be turned into a real scored analysis on demand — not auto-scored in bulk.
   - Current: No path from a generated concept to a score.
   - Target: Each concept exposes a "Develop & predict →" action that runs that single concept through the existing `/api/analyze` pipeline, producing a real `/analyze/[id]` board with a score. Concepts are NOT all auto-scored on generation (engine latency/cost makes bulk scoring prohibitive).
   - Acceptance: Clicking Develop on one concept creates exactly one new analysis with a score and navigates to its board; the other concepts are not scored unless separately developed.

5. **Remix lineage**: A developed concept records its origin and surfaces it in history.
   - Current: Analyses have no parent/child relationship.
   - Target: A child analysis created via Develop stores a `parent_id` (the source remix analysis) and renders a "remixed from" chip linking back; child analyses appear in the sidebar Recent list.
   - Acceptance: A developed concept's row has a non-null `parent_id`; its board shows a working "remixed from" link to the source; it appears in Recent.

6. **One board, two configurations**: Remix reuses the existing board; it does not create a separate app/surface and does not merely bolt frames on.
   - Current: The board has one fixed 6-frame configuration.
   - Target: Remix mode keeps the shared frames (Input, Engine, Audience, Content Craft) and **swaps** Verdict + Actions → Decode + Adapt. The Konva grid reflows; the mobile card-stack absorbs the swapped frames as cards.
   - Acceptance: Remix board renders Input + Engine + Audience + Content Craft + Decode + Adapt on desktop (canvas) and mobile (card-stack) with no separate route; grade board is unchanged.

7. **Niche source**: Adapt is grounded in the user's niche, sourced from existing profile data.
   - Current: A `creator-profile` settings tab exists; nothing feeds niche into analysis.
   - Target: Adapt reads the user's niche from the creator-profile; if absent/empty, the user is prompted to supply it inline before concepts generate.
   - Acceptance: With a populated creator-profile, Adapt generates without asking; with an empty profile, the user is prompted and concepts generate after the niche is provided.

8. **Ingestion sufficiency (SPIKE)**: The pipeline pulls enough signal from a third-party URL to *decode* it, not just metadata. ⚠ **Unresolved — milestone's first spike.**
   - Current: The input fetches preview metadata (thumbnail, creator, caption) for URLs; it is unconfirmed whether the analyze pipeline ingests frames/transcript for an *arbitrary, non-owned* video sufficient for structural decode.
   - Target: Confirmed (or built) ingestion that yields the frame/transcript signal Decode requires for a third-party video.
   - Acceptance: A spike documents exactly what signal `/api/analyze` obtains for a non-owned TikTok URL; if insufficient for Decode, the gap and remediation are documented before Decode is planned.

## Boundaries

**In scope:**
- Remix intent toggle at input ("Score my content" / "Remix a viral video")
- Decode frame (structural teardown + repeatable-vs-luck)
- Adapt frame (~3 niche-adapted concepts, format-not-content)
- Per-concept "Develop & predict →" → one child analysis via existing pipeline
- Parent/child lineage (`parent_id`, "remixed from" chip, Recent list)
- One-board-two-configuration frame swap (desktop canvas + mobile card-stack)
- Niche sourced from existing creator-profile (inline prompt fallback)
- Ingestion-sufficiency spike

**Out of scope:**
- **Radar / trend feed** (daily "winning in your niche" surface) — future milestone; this milestone is pull-only (user pastes). Sidebar nav hook only, no build.
- **Pattern Playbook** (accumulated niche formulas across many videos) — future milestone; lands in the stubbed Pinned/Projects sidebar later.
- **Auto-detect mine-vs-theirs** — explicitly rejected in favor of the toggle.
- **Separate "Studio/Discover" app surface** — rejected; reconfigure the existing board instead. Revisit only when Radar lands.
- **Bulk auto-scoring of all concepts** — cost/latency prohibitive; scoring is per-concept on demand.
- **Storing/redistributing the source video** — derive structural analysis only (transformative, legally safer); do not persist or rebroadcast third-party media.
- **Non-TikTok platforms** (Reels, Shorts) — TikTok only for this milestone.

## Constraints

- **Reuse, don't rebuild**: must use the existing TikTok URL input, SSE pipeline, scoring engine, board canvas, mobile card-stack, history sidebar, and permalink routing. New surface area limited to Decode frame, Adapt frame, remix toggle, and lineage column.
- **Engine latency** (~90–312s E2E) forbids auto-scoring all concepts — per-concept develop only (requirement #4).
- **Design language**: Raycast — 6% borders, 10% hover, 12px card radius, Inter, minimal chrome. New frames match existing frame styling.
- **Legal/IP**: structural analysis only; never copy source content; framing is "adapt this format," never "redo this video."
- **Qwen-only pipeline**: any new model calls (decode/adapt generation) stay within the Qwen-only constraint — no Gemini/DeepSeek.
- **Ingestion depth is unverified** — see requirement #8; this constraint is the milestone's first research task.

## Acceptance Criteria

- [ ] Input exposes an explicit "Score my content" / "Remix a viral video" toggle; Remix routes to the remix path
- [ ] Remix board renders Input + Engine + Audience + Content Craft + Decode + Adapt (Verdict + Actions swapped out), on both desktop canvas and mobile card-stack
- [ ] Decode frame renders structural teardown + an explicit repeatable-vs-luck split for a known viral test video
- [ ] Adapt frame renders exactly 3 niche-adapted concepts that reference source structure (not source content)
- [ ] Each concept has a working "Develop & predict →" that creates exactly one scored child analysis and navigates to it
- [ ] A developed child analysis has non-null `parent_id`, shows a "remixed from" link, and appears in Recent
- [ ] With an empty creator-profile, the user is prompted for niche before concepts generate
- [ ] Grade-mode board and existing analyze flow are unchanged (no regression)
- [ ] Spike artifact documents the exact ingestion signal available for a non-owned TikTok URL and whether it is sufficient for Decode

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Spine + flow settled in design session                       |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit in/out lists; Radar + Playbook deferred             |
| Constraint Clarity | 0.62  | 0.65 | ⚠      | Ingestion depth for 3rd-party video unverified — see req #8  |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 9 pass/fail criteria                                         |
| **Ambiguity**      | 0.21  | ≤0.20| ⚠      | Single gap = ingestion spike; resolve at milestone activation |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption / first spike)

**Reasoned-default assumptions (overridable):** N concepts = 3; develop = per-concept on demand (not bulk); niche from creator-profile with inline fallback; Audience frame retained in remix mode (persona retention of the *viral* video serves Decode); TikTok-only.

## Interview Log

| Round | Perspective    | Question summary                                   | Decision locked                                                        |
|-------|----------------|----------------------------------------------------|------------------------------------------------------------------------|
| 1     | Researcher     | What does the feature add to the loop?             | Front-half: discovery → creation; paste viral → decode → adapt → predict |
| 2     | Simplifier     | Which product personality / minimum spine?         | Decoder → Translator → Predict; Radar + Pattern Playbook deferred       |
| 3     | Boundary Keeper| How to integrate into the UI surface?              | One board, two configs; swap Verdict+Actions → Decode+Adapt; no new app |
| 3     | Boundary Keeper| Mine-vs-theirs intent resolution?                  | Explicit toggle at input (auto-detect + separate surface rejected)      |
| 4     | Failure Analyst| Biggest risk / what invalidates the spec?          | 3rd-party ingestion depth (frames/transcript vs metadata) — spike #8    |
| 4     | Failure Analyst| Cost/latency failure of scoring concepts?          | Per-concept develop only; no bulk auto-scoring (engine ~90–312s)        |
| —     | Placement      | Where does this live in GSD?                       | New fast-follow milestone after MVP Cut ships; this is its seed         |

---

*Milestone seed: viral-remix*
*Spec created: 2026-05-31*
*Next step: ship MVP Cut → `/gsd-new-milestone` off `main` (seed from this SPEC) → resolve req #8 spike first → roadmap → discuss-phase*
