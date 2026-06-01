# Phase 2: Remix Mode + One-Board-Two-Config - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

An explicit **Score / Remix** intent selector at the input routes a remix submission down the remix path; the board reconfigures **one board, two configs** — keeps Input/Engine/Audience/Content Craft and swaps **Verdict+Actions → Decode+Adapt (empty shells this phase)** on both the desktop Konva canvas and the mobile card-stack, with **no separate route**. The grade-mode board is entirely unchanged. `mode` is persisted, folded into the content hash, and survives a permalink reload.

**Delivers:** REMIX-01 (explicit intent selector → remix path + persisted `mode='remix'`), REMIX-02 (one-board-two-config swap on desktop + mobile, score board unchanged).

**Explicitly NOT this phase:** Decode frame *content* (Phase 3), Adapt frame *content* + niche (Phase 4), Develop/lineage (Phase 5). Decode/Adapt are rendered as titled empty shells only.

</domain>

<decisions>
## Implementation Decisions

### Intent Selector (REMIX-01)
- **D-01:** A **top-level segmented control** ("Score my content" / "Remix a viral video") sits **above** the existing text/Video/URL input tabs. Intent is the primary choice; ingestion method is secondary. No auto-detect (explicitly rejected — see REQUIREMENTS Out of Scope).
- **D-02:** Default intent on a fresh dashboard load is **Score** — preserves current behavior, zero regression. Remix is opt-in. (No last-used persistence this phase.)
- **D-03:** Score mode is **unchanged**: text/Video/URL tabs in current order, caption field on video upload, existing grade flow intact.

### Remix Input Coupling (REMIX-01)
- **D-04:** When **Remix** is selected, the input shows **Video + Link only** (tab order: 1. Video, 2. Link). **Text is hidden** — a caption/text input yields no video signal and cannot produce a structural Decode (DECODE-01/02 are video-structure teardowns), so Remix+Text would be a guaranteed dead end. Rationale: make invalid states unrepresentable.
- **D-05:** In Remix, there is **no caption / additional text field** for either video or link — pasting a link or picking a file is the entire interaction. The user's niche comes from the creator-profile (ADAPT-02), not a caption; we decode the *source's* structure, not the user's framing.
- **D-06:** Both Video upload and Link produce real Omni video signal (INGEST-01), so both are valid remix sources. (Link is the canonical "paste a third-party viral TikTok" path; upload is the symmetric file path.)

### Mode-Aware Board Layout (REMIX-02)
- **D-07:** **1:1 positional swap** on the desktop Konva canvas — **Decode takes Verdict's exact bounds** (right-column hero), **Adapt takes Actions' exact bounds** (tall, below). Input/Engine/Audience/Content Craft positions are unchanged. Phase 3/4 may re-space if real content demands it.
- **D-08:** Mode drives layout via an extended **`resolveBoardLayout(mode)`** — single source of truth returning the score frame set (verdict+actions) or the remix frame set (decode+adapt), consumed by both desktop and mobile. Avoids scattering mode logic into the render layer.
- **D-09:** On the **mobile card-stack** (`BoardMobile.tsx`, <768px), Decode + Adapt occupy the **exact slots** Verdict + Actions held in score-mode card order; every shared card is identical. Mirrors the desktop swap.

### Decode/Adapt Empty Shells (REMIX-02, this phase)
- **D-10:** Each shell renders a **titled frame** (Decode / Adapt) + **one quiet, muted descriptor line** of what it will hold (Decode → structural teardown of why the video worked; Adapt → niche concept ideas). Honest intentional empty state — **no skeleton/shimmer** (would falsely imply loading) and not a bare empty frame (would read as broken).
- **D-11:** Descriptor copy is a **neutral "what this is for" line with no "coming soon" / no date promise** — ages well if Phase 3/4 timing shifts. Same treatment on desktop and mobile.

### Data Model & Persistence (REMIX-02, success criterion 5)
- **D-12:** Add a **new `mode` column** to `analysis_results` — stored as text with `CHECK (mode IN ('score','remix'))`, `NOT NULL DEFAULT 'score'`. Distinct from existing `input_mode` (input_mode = *how content arrives*: text/tiktok_url/video_upload; mode = *user intent*: score/remix). Column named `mode` to match spec/ROADMAP/REQUIREMENTS wording referenced by Phases 3-5.
- **D-13:** **Backfill all existing rows to `'score'`** in the same migration. Column is total (never null) → no null-coalesce at read sites; every historical analysis renders the unchanged grade board.
- **D-14:** **Fold `mode` into the content hash** in `prediction-cache.ts` — segment `mode` into the hashed input string so the same URL under Score vs Remix yields a different `content_hash` and the two cache entries do not collapse. The hash *is* the content identity (kept in one place); L2 already keys on `content_hash`, so no cache-query-layer change.
- **D-15:** **`/analyze/[id]` reads `mode` from the persisted row** as the source of truth and renders the matching board config. Live board and permalink reload must agree on mode.

### Claude's Discretion
- Exact visual styling of the segmented control (must follow Raycast design language — 6% borders, 8px radius, Inter; see BRAND-BIBLE / CLAUDE.md design rules).
- Exact descriptor copy strings for the Decode/Adapt shells (neutral, no promise — D-11).
- Migration filename/timestamp and whether `mode` is threaded as a typed union in TS (`'score' | 'remix'`).
- How the segmented control state is held (local component state vs form state) — provided default is Score and it threads to `input_mode`/submit correctly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — REMIX-01, REMIX-02 acceptance; Out of Scope (auto-detect rejected, TikTok-only, no separate route, derive-and-drop IP boundary).
- `.planning/ROADMAP.md` §"Phase 2: Remix Mode + One-Board-Two-Config" — goal + 5 success criteria.
- `.planning/milestones/viral-remix-SPEC.md` — locked seed requirements (req 1 = intent selector, req 6 = one-board-two-config).

### Phase 1 (dependency — INGEST-01, complete)
- `.planning/STATE.md` §Decisions — Plan 01-03 ingestion decisions (tiktok_url Omni branch, Supabase re-host, derive-and-drop, mode-agnostic 429 branch).
- `src/lib/engine/pipeline.ts` — `tiktok_url` Omni branch + derive-and-drop (the remix ingestion path).

### Input & Form
- `src/components/app/content-form.tsx` — existing text/Video/URL tab UI (`activeTab`, `input_mode`, `INPUT_MODES`, `handleTabChange`); where the intent selector + remix coupling land.
- `src/hooks/queries/use-analyze.ts`, `src/hooks/queries/use-analysis-stream.ts` — mutation/stream that must carry `mode` to the API.
- `src/app/api/analyze/route.ts` — auth/validation/persistence; where `mode` is validated + written to the row.

### Board (desktop + mobile)
- `src/components/board/board-constants.ts` — `GROUP_FRAMES`, `resolveBoardLayout()`, `computePresetTargets()` (the mode-aware layout hook D-08; Verdict bounds x:864 hero, Actions bounds below).
- `src/components/board/Board.tsx` — Konva canvas board; frame component wiring (`VerdictNode`, `ActionsNode`, etc.) to swap by mode.
- `src/components/board/BoardMobile.tsx` — mobile card-stack order (D-09).
- `src/components/board/verdict/VerdictNode.tsx`, `src/components/board/actions/ActionsNode.tsx` — the frames being swapped out in remix mode (reference for shell structure).
- `src/components/board/_kit/FrameHero.tsx` — shared frame kit (likely basis for Decode/Adapt shell chrome).

### Data & Cache
- `src/lib/engine/cache/prediction-cache.ts` — content-hash builder (D-14: fold mode in) + L2 lookup.
- `src/types/database.types.ts` — `analysis_results` row type (add `mode`; currently has `input_mode`, no `mode`, no `parent_id`).
- `supabase/migrations/` — latest is `20260531000003_*`; new migration adds `mode` column + backfill (D-12/D-13).
- `src/app/(app)/analyze/[id]/page.tsx` + `result-card.tsx` — permalink rehydrate (D-15: read mode from row).

### Design language
- `CLAUDE.md` §"Raycast Design Language Rules" + `BRAND-BIBLE.md` — segmented control + shell styling must conform (6% borders, 8px radius, Inter, no glow/tint).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`resolveBoardLayout()`** (`board-constants.ts`) already accepts a params object — extend with `mode` rather than building a new layout system.
- **`GROUP_FRAMES` bounds** — Verdict (label 'Score', right-column hero) + Actions (tall, fills right column) bounds can be reused 1:1 for Decode + Adapt (D-07).
- **`content-form.tsx` tab pattern** (`INPUT_MODES`, `handleTabChange`) — the segmented control can follow the same controlled-state pattern one level up.
- **`FrameHero` / `_kit`** board frame primitives — basis for titled empty shells.
- **`input_mode` column + content-hash branching** (`prediction-cache.ts` already switches on `input_mode`) — `mode` plugs into the same hash-building seam.

### Established Patterns
- **Mode-agnostic API plumbing** — Plan 03 confirmed the 429/rate-limit branch is mode-agnostic; `mode` is additive metadata on the same `/api/analyze` path (no new route — REQUIREMENTS).
- **Server components by default, client only when interactive** — the selector is client (interactive); board is already client/Konva.
- **Supabase migrations are timestamped, additive** — `mode` column follows the existing `input_mode`/heatmap migration style.

### Integration Points
- `content-form` selector → form data (`mode`) → `use-analyze` mutation → `/api/analyze` validation → `analysis_results.mode` + content hash.
- `analysis_results.mode` → SSE/stream + `/analyze/[id]` fetch → `resolveBoardLayout(mode)` → Board (desktop) + BoardMobile (mobile) frame set.

</code_context>

<specifics>
## Specific Ideas

- User's framing on input ordering: "video, link, text" — Score keeps all three in that order; Remix shows Video + Link only, no caption (D-04/D-05).
- Design north star explicitly invoked: "what would Apple, Linear, or Raycast do" → favor reducing choices, removing dead-ends, making invalid states unrepresentable. Applied to dropping Text from Remix and to the quiet (non-skeleton) empty shells.

</specifics>

<deferred>
## Deferred Ideas

- **Last-used intent persistence** (remember Score/Remix across sessions) — deferred; default-to-Score is sufficient this phase (D-02).
- **Decode frame content** — Phase 3 (DECODE-01/02).
- **Adapt frame content + niche prompt** — Phase 4 (ADAPT-01/02).
- **Develop & predict + lineage (`parent_id`, "remixed from" chip)** — Phase 5 (DEVELOP-01/02). Note: `parent_id` column is NOT added this phase.
- **Mode analytics/telemetry** — not in scope; can layer on later.

</deferred>

---

*Phase: 02-remix-mode-one-board-two-config*
*Context gathered: 2026-06-01*
