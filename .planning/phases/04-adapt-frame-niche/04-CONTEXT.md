# Phase 4: Adapt Frame + Niche - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

> **Parallel-work note:** This phase is being built in a dedicated worktree
> (`~/virtuna-viral-remix-adapt`, branch `milestone/viral-remix-adapt`) **in
> parallel with Phase 3 (Decode)**. The Decode→Adapt contract (D-01..D-03) is
> the integration seam between the two worktrees and must be honored verbatim
> on both sides.

<domain>
## Phase Boundary

The **Adapt frame body** in remix mode: render **exactly 3 concepts**, each adapting the source video's *format/structure* (never its content) to the user's niche, each carrying `hook` / `angle` / `who_its_for` / `format_borrowed`. Concepts are generated **Qwen-only** in `engine/remix/adapt.ts`, drawn from **Decode's repeatable lane** (not luck-attributed elements), and persisted to `variants.remix.adapt`. When the creator-profile niche is empty, an **inline niche prompt** appears before concepts generate; Decode keeps rendering niche-free meanwhile.

**Delivers:** ADAPT-01 (exactly 3 format-adapted concepts with the 4 fields), ADAPT-02 (niche from creator-profile; inline prompt when empty).

**Explicitly NOT this phase:** Decode frame *content* (Phase 3 — consumed here via a fixed fixture until it lands); "Develop & predict →" per-concept scoring + `parent_id` lineage + "remixed from" chip (Phase 5); concept regeneration/reroll (deferred); the grade-mode board (unchanged).

</domain>

<decisions>
## Implementation Decisions

### Decode→Adapt Contract (the parallel-work linchpin)
- **D-01:** Adapt's input is the **4 structural fields** (`hook_pattern`, `structure`, `the_turn`, `emotional_beat`) **plus the `repeatable[]` lane items** — and *nothing else*. The **luck lane is excluded** and the **raw source caption is never passed**. This makes content-copying structurally impossible (satisfies ADAPT-01 success criterion 2) and guarantees concepts draw only from repeatable structure (criterion 3).
- **D-02:** The contract is pinned as a **canonical TypeScript type** in a **new file `src/lib/engine/remix/decode-types.ts`** (new path → near-zero merge-conflict surface across the two worktrees) **plus a realistic `decode.fixture.ts`** in the same dir. Phase 4 builds the Adapt path against the fixture.
- **D-03:** **Phase 3 (Decode) MUST import the type from `decode-types.ts` — it must NOT redefine its own decode output shape.** Single source of truth; both worktrees converge on merge. (Cross-worktree coordination requirement — see Parallel-work note above.)

### Generation Trigger & Flow
- **D-04:** Concepts **auto-generate** once Decode completes, **when a niche is present** — the remix board feels complete on load with no extra click. Adapt is a single lightweight Qwen call (NOT `runPredictionPipeline`), so auto-generation cost/latency is negligible.
- **D-05:** Adapt output is **persisted to `variants.remix.adapt`** and **rehydrated on permalink reload** — not regenerated on reload (mirrors Phase 2 D-15: persisted row is the source of truth).
- **D-06:** The **Adapt frame fails independently of Decode** — a malformed/failed adapt generation renders an Adapt-frame error/empty state while **Decode still renders** (criterion 4 requires Decode to render niche-free in the meantime; frames are independent).
- **D-07:** **No regenerate/reroll** affordance this phase (deferred). Auto-generate produces one set of 3 concepts.

### Concept Card Anatomy (UI — Adapt occupies Actions' old tall right-column bounds, per Phase 2 D-07)
- **D-08:** The 3 concepts render as **three stacked cards**, all fully visible (no accordion, no tabs) — fits the tall right column, zero interaction to compare all 3, matches Raycast card language (12px radius, 6% border).
- **D-09:** Within each card: the **`hook` is the bold headline** (the punchy opening line), **`format_borrowed` is a small chip/label** that ties the concept back to the source structure (e.g. "Borrowed: open-loop cold open"), and **`angle` + `who_its_for` render as quiet muted sub-rows**. Leads with the most actionable element and makes the format-not-content link explicit.
- **D-10:** Mobile card-stack (`BoardMobile.tsx`, <768px) mirrors desktop — the 3 stacked concept cards occupy the slot Adapt holds in the remix card order (carries forward Phase 2 D-09).

### Empty-Niche Inline Prompt (ADAPT-02)
- **D-11:** Empty niche = **`niche_primary` AND `niche_sub` both null** on `creator_profile`. When empty, embed the **existing `NichePicker`** (compact variant) **inline in the Adapt frame** — user picks niche in place, then the 3 concepts generate. Reuses the proven taxonomy component (`src/lib/niches/taxonomy.ts`), maps cleanly to `niche_primary`/`niche_sub`, no navigating away from the board.
- **D-12:** A niche picked inline is **persisted to `creator_profile`** (PATCH `niche_primary`/`niche_sub` via the existing `/api/profile/creator-profile` route), **then** concepts generate. Creator-profile stays the single source of truth for niche; next remix won't re-prompt.

### Claude's Discretion
- Exact compact styling/density of the inline `NichePicker` inside a board frame (must conform to Raycast design language — 6% borders, 8px radius, Inter; see CLAUDE.md / BRAND-BIBLE).
- The Qwen adapt **prompt design** that enforces "exactly 3 distinct concepts" and "format not content" — structured-output schema + repair/retry strategy on malformed/short output (researcher + planner own this).
- Exact `format_borrowed` chip copy/derivation and the muted-row typography for angle/who-it's-for.
- The realistic content of `decode.fixture.ts` — hand-author a representative repeatable-lane fixture now; swap for a captured real decode once Phase 3 lands.
- Whether the Adapt source type / concept type are threaded as typed unions in TS and where `engine/remix/adapt.ts` is wired into the remix path.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — ADAPT-01, ADAPT-02 acceptance; Out of Scope (content-copying rejected, TikTok-only, no bulk scoring, no new npm deps).
- `.planning/ROADMAP.md` §"Phase 4: Adapt Frame + Niche" — goal + 5 success criteria; §"Phase 3: Decode Frame" for the upstream contract source.
- `.planning/milestones/viral-remix-SPEC.md` — locked seed requirements (req 3 = exactly 3 format-adapted concepts, req 7 = niche from creator-profile + inline prompt).

### Decode dependency (Phase 3 — PARALLEL, contract seam)
- `src/lib/engine/remix/decode-types.ts` — **(NEW — created this phase)** canonical Decode output type; the contract both worktrees import (D-02/D-03).
- `src/lib/engine/remix/decode.fixture.ts` — **(NEW — created this phase)** fixed decode fixture Adapt builds against until Phase 3 lands.
- `.planning/ROADMAP.md` §"Phase 3" criterion 3 — the repeatable-vs-luck split definition (reproducible structure vs timing/existing-audience/outlier).

### Phase 2 (dependency — remix mode + shells, complete)
- `.planning/phases/02-remix-mode-one-board-two-config/02-CONTEXT.md` — D-07 (Adapt = Actions' bounds), D-09 (mobile mirror), D-12/D-14/D-15 (`mode` column, content-hash, permalink rehydrate), `variants.remix` persistence seam.
- `src/components/board/adapt/AdaptShellNode.tsx` — the Phase 2 titled shell (descriptor only) this phase fills with the concept-card body.
- `src/components/board/board-constants.ts` — `resolveBoardLayout(mode)`, Adapt frame bounds (tall right column).
- `src/components/board/Board.tsx` + `src/components/board/BoardMobile.tsx` — desktop Konva + mobile card-stack wiring for the Adapt frame.
- `src/components/board/_kit/FrameHero.tsx` + `_kit` primitives — chrome basis for the concept cards.

### Niche & creator-profile (ADAPT-02)
- `src/components/app/cards/niche-picker.tsx` — `NichePicker` component to reuse inline (D-11).
- `src/lib/niches/taxonomy.ts` — `NICHE_TREE`, `getNicheBranches`, `getPrimaryLabel`, `getSubLabel` (niche taxonomy backing the picker).
- `src/app/api/profile/creator-profile/route.ts` — GET (reads `niche_primary`/`niche_sub`) + PATCH (persists picked niche, D-12).
- `src/types/database.types.ts` — `creator_profile` row (`niche_primary`, `niche_sub`) + `analysis_results.variants` JSON (where `remix.adapt` is stored).

### Engine (Qwen-only adapt path)
- `src/lib/engine/remix/adapt.ts` — **(NEW — created this phase)** the Qwen-only concept generator.
- `src/lib/engine/pipeline.ts` — the remix path (`tiktok_url` Omni branch + derive-and-drop) Adapt chains off after Decode.
- Memory `[[qwen-only-pipeline]]` — prediction pipeline must use only Qwen models; no Gemini/DeepSeek.

### Design language
- `CLAUDE.md` §"Raycast Design Language Rules" + `BRAND-BIBLE.md` — concept cards + inline picker + chip styling must conform (6% borders, 8px/12px radius, Inter, no glow/tint).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AdaptShellNode.tsx`** — the Phase 2 titled shell (DOM component, not Konva — per Phase 2 RESEARCH Pattern 1) is the mount point; replace the descriptor body with the 3 concept cards.
- **`NichePicker` + `taxonomy.ts`** — reuse wholesale for the inline empty-niche prompt (D-11); already pure-controlled (`primary`/`sub`/`onChange`).
- **`/api/profile/creator-profile` PATCH** — existing route persists `niche_primary`/`niche_sub` (D-12) — no new route.
- **`_kit/FrameHero` + board frame primitives** — chrome basis for the stacked concept cards (D-08).
- **`variants.remix` persistence + permalink rehydrate seam** (Phase 2 D-15) — `remix.adapt` plugs into the same persisted-row-as-source-of-truth pattern (D-05).

### Established Patterns
- **Qwen-only, lightweight remix path** — Adapt is a single Qwen call, NOT `runPredictionPipeline`; does not touch `usage_tracking`/`DAILY_LIMITS` (mirrors the Phase 3 Decode lightweight-path constraint).
- **DOM (not Konva) frame bodies** — remix frame content renders as DOM overlays, per Phase 2.
- **Server components by default, client when interactive** — the inline picker is client; concept cards are static render.
- **Persisted row is source of truth on reload** — no regeneration on permalink reload (D-05, mirrors Phase 2 mode rehydrate).

### Integration Points
- Decode repeatable lane → `decode-types.ts` contract → `engine/remix/adapt.ts` (Qwen) → `variants.remix.adapt` (persist) → `AdaptShellNode` body (3 cards) on desktop + mobile.
- Empty niche → inline `NichePicker` → PATCH `creator_profile` → adapt generation unblocks.
- Adapt path chains off the remix pipeline after Decode (parallel to Decode's frame, independent failure — D-06).

</code_context>

<specifics>
## Specific Ideas

- **Hook-first cards:** the hook is the deliverable a creator actually wants front-and-center; `format_borrowed` as a chip makes the "adapt the format, not the content" principle visible at a glance (D-09).
- **No dead-ends / reuse-over-rebuild** (Phase 2 north star carried forward): reuse `NichePicker` rather than invent a new niche input; persist the picked niche so the prompt never recurs.
- **Contract-first for parallel safety:** define `decode-types.ts` as a new file so the two parallel worktrees merge cleanly; Phase 3 imports, never redefines (D-02/D-03).

</specifics>

<deferred>
## Deferred Ideas

- **Concept regenerate/reroll** — deferred; one auto-generated set of 3 this phase (D-07).
- **"Develop & predict →" per-concept scoring + `parent_id` lineage + "remixed from" chip** — Phase 5 (DEVELOP-01/02).
- **Decode frame content itself** — Phase 3 (DECODE-01/02); consumed here via fixture until it lands.
- **Free-text / richer niche capture beyond the taxonomy** — out of scope; taxonomy `NichePicker` is the niche source.

None of the above were in-scope detours — discussion stayed within the Adapt-frame domain.

</deferred>

---

*Phase: 04-adapt-frame-niche*
*Context gathered: 2026-06-02*
