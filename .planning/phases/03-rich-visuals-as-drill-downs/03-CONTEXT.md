# Phase 3: Rich Visuals as Drill-Downs - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Preserve every valuable rich board visual by **transplanting it into the Phase-2 disclosure seam** — the `DrillSheet` panels and the inline deeper-read — reskinned to the locked flat-warm tokens. The visuals are **already Konva-free** (DOM / React / SVG / HTML-Canvas); only the retired canvas *shell* (pan/zoom, camera, world-space) is gone. P3 **swaps P2's simple native panel content for the rich charts in the same containers** (the D-12 seam). Nothing is rebuilt; nothing already-built is re-authored from scratch.

This is the **only requirement in the phase: READ-09.** Per the P2 scout, it's a **reskin + remount, not a heavy transplant** — size it accordingly.

Presentation-layer only. Engine **FROZEN at 3.19.0** — no `lib/engine/` changes. Work in `src/components/reading/**`, `src/components/board/**` (reskin the chart components in place or move them), hooks, tokens. Mobile-first; desktop is the same thread widened, on the **locked flat-warm system** (THEME-06).

Requirements: **READ-09** (1). *(Stage-reveal of these blocks = Phase 4; follow-up/demo = Phase 5 — keep the seam intact.)*
</domain>

<decisions>
## Implementation Decisions

> Phase-3 decisions numbered D-01..D-07 below (self-contained to this phase).
> "Phase 2 D-NN" / "Phase 1 D-NN" refer to decisions in `02-CONTEXT.md` / `01-CONTEXT.md`, carried forward as locked.

### Carried forward — LOCKED, do NOT re-litigate
- **The disclosure seam is the mount point** (Phase 2 D-09/D-10/D-12): heavy visuals open in the **`DrillSheet`** (bottom sheet mobile / right drawer desktop); light reveals (deeper-read, "N more fixes") stay **inline**. P3 drops the rich charts into the **same `DrillSheet` container** that P2 wired — content swapped, container unchanged.
- **Panel state is a CLOSED allow-list union** in `reading.tsx` (Phase 2, threat T-02-12 — never reflect a raw key). P3 **extends the union** from `hook | retention | shareability | personas` to add `score` (D-02). The allow-list + `PANEL_TITLE` map grow together; nothing reflected.
- **Per-block graceful degradation, never a fabricated 0** (Phase 2 D-13): every transplanted visual either renders real data or shows the calm `PanelEmpty` ("Not available for this read") — **never throws, never a grey-cell fallback** (Roadmap SC-2). This is correctness (permalink reloads + real failures hit nulls), not polish.
- **Flat-warm THEME-06 tokens are LOCKED** (Phase 1 D-07): app `#262624` / composer `#1e1d1b` / chip `#2f2e2b`; coral `oklch(0.68 0.13 33)≈#d97757`; score zones green `oklch(0.68 0.17 145)` / amber `oklch(0.75 0.15 85)` / red `oklch(0.60 0.20 25)`; serif Newsreader (voice only). The matte taste bar: **no glow / shine / halo / ambient lighting; contrast from elevation.**
- **~760px centered column** for the thread (Phase 1 D-17) — **rich visuals MAY break wider inside the drill-down sheet/drawer** (the drawer is the focused home for a heavy chart).
- **Score-forward, NO prose narration** (D-15); product noun **"Simulation"** (Phase 1 D-09).
- **The reading cluster is board-store-free** (Phase 2 P2-04/05): no `useBoardStore` under `src/components/reading/`. **Transplanted visuals MUST NOT drag the board store / choreography hooks back in** — see the §landmine on severing `use-audience-choreography` / `use-client-weights` / `useBoardStore` couplings.

### Curation (D-01) — "nothing deleted" = in spirit, not literal
- **D-01:** **Curate, don't preserve-all.** Drop two superseded components: **`FactorBars`** (0–10 bars — replaced by Phase-2's NEW 0–100 `DriverRows`) and **`InsightHeroFrame`** (the OLD hero — replaced by the new Reading hero gauge + Fix First + deeper-read). Their *information already lives in the new Reading*, so "nothing visual is deleted" (brief §2.5) is honored — the **data survives, the redundant shell does not**. Re-mounting an old hero as a drill-down *inside* the new hero's thread would be confusing redundancy. **Keep** the distinct rich visuals: `RetentionChart`, `SegmentTable`, `PersonaGraph`, `CraftFilmstrip`, `ScoreDistribution`.

### Surface set (D-02) — add a 5th drill-down panel
- **D-02:** **Add a `score` panel.** The hero **gauge gets a NEW tap target** → opens `ScoreDistribution` (niche-cohort histogram = "where your 71 sits in your niche" + confidence range). This is the most decision-relevant instrument a creator has, and the gauge was chosen (Phase 2 D-01, Davide's override of the bare number) precisely to be *read as an instrument* — a score drill-down deepens that. The confidence range surfaces honest uncertainty without prose (fits score-forward). It is otherwise homeless: the P2 union had no score/hero tap. **Wiring is new** — `score-gauge.tsx` exposes an `onOpen`; `reading.tsx` adds `'score'` to the union + a `ScorePanel`.

### The visual → surface mapping (D-03) — the phase's spine
- **D-03:** Each surface's P2 native content is replaced by the mapped rich visual(s):

| Surface (how it opens) | Rich visual(s) mounted | Replaces P2 native |
|---|---|---|
| **score** — tap the hero gauge *(NEW, D-02)* | `ScoreDistribution` (niche histogram + confidence range) | — (new panel) |
| **personas** — tap the persona cloud | `PersonaGraph` (HTML-Canvas; hover→tap on mobile) | persona list |
| **hook** — tap the Hook row | hook modality sub-scores (reskin the P2 native — already correct 0–10) | modality rows (kept, reskinned) |
| **retention** — tap the Retention row | `RetentionChart` (curve + niche/ghost overlay) **+ `CraftFilmstrip` + `SegmentTable`** — the "watch journey," composed/scrollable, timeline-aligned (D-04, D-06) | drop-segment list |
| **shareability** — tap the Share row | `share_pull` evidence + share/comment/save/loop **rate tiles** (`StatTile`; supporting data — lightest panel, no dedicated chart) | dimension text |
| **deeper read** — inline expand | clarity / substance / credibility dims — **unchanged from P2** (light inline, NOT a sheet) | — |

### Filmstrip placement (D-04)
- **D-04:** **`CraftFilmstrip` mounts in the Retention panel, timeline-paired with the curve.** Filmstrip = what's on screen across the timeline; retention curve = attention across the *same* timeline. Aligned, they answer **"they drop at 0:08 → here's the frame at 0:08."** Strongest narrative. (Not the Hook panel; not its own 6th surface — no new surface beyond `score`.)

### Emotion arc (D-05)
- **D-05:** **Emotion arc is dropped this phase.** It is **not a standalone chart** — `emotion_arc` data is woven into `ContentAnalysisFrame`, with no discrete component to transplant. Extracting it into a new chart is rebuild-ish work outside the "reskin + remount" spirit, and it's supporting-tier data. Its absence does not break the roadmap's "keep the rich visuals" intent (the visuals that *exist as components* are all kept). Revisit only if a creator clearly wants it.

### Panel density (D-06)
- **D-06:** **Composed cluster per panel** (not one-chart-per-tap). A panel holds its naturally-related set, **scrollable** (e.g. retention = curve + filmstrip + segment table) — the value is in the *relationship* between visuals; splitting them into separate taps loses it. Keep each panel **themed and calmly spaced — a curated set, not a dump.** The `DrillSheet` already takes generic children, so this is composition, not new container work.

### Reskin depth + sign-off (D-07)
- **D-07:** **Token-swap + strip-glass as the baseline; re-treat the charts that clash; human-UAT gate at P3 close.**
  - **Baseline (mechanical):** swap each chart to the flat-warm semantic tokens and strip any Raycast glass (137deg gradient / blur / inset shine).
  - **Re-treat (targeted):** charts that *fight the matte taste bar* — gradient area fills (`RetentionChart`, `TrendChart`-style area), glow/Canvas dot treatment (`PersonaGraph`), dot/area styling (`ScoreDistribution`) — get an actual visual re-treatment to flat-warm, because a pure token-swap won't catch a gradient fill or a glow.
  - **NOT** a full from-scratch redesign of every chart (that drifts toward the rebuild we stood down).
  - **Sign-off:** these reskinned charts are **net-new visual surfaces the Phase-1 shell UAT gate never covered** — so P3 ends with a **live human-UAT review of the reskinned visuals** (same shape as THEME-06: a real running surface, blocking sign-off), given the milestone's burned-twice-on-craft history.

### Claude's Discretion (planner / executor)
- **Mobile interactivity downgrade** — `PersonaGraph` hover cards → tap on mobile; `CraftFilmstrip` scrub; `SegmentTable` sort. Degrade sensibly within the calm-motion taste bar; no hover-only affordances on touch.
- **`RetentionPlayer` inclusion** — the scrubbable video-synced-to-curve player. Include **only if the uploaded video source resolves on permalink reload** (`use-uploaded-video-source.ts` — known persistence landmine); otherwise the retention panel is the static chart + filmstrip + table. Researcher to verify source availability.
- **Per-visual degraded states** — reuse the P2 `PanelEmpty` pattern; audit each transplanted visual's null/empty data paths (no throw, no grey-cell). Mechanical, follow D-13.
- **`ScoreDistribution` confidence-range text gating** — it already supports `showRangeText` (suppress the numeric "likely lo–hi" for HIGH confidence). Wire the caller's gating sensibly.
- **Drill-down panel library / motion** (Radix/shadcn/`vaul`/motion) — carried from P2 discretion; the `DrillSheet` is already built, so this is mostly settled.
- **Whether to move chart files** out of `src/components/board/**` into a shared/reading location vs reskin in place — executor's call; keep imports clean and the reading cluster board-store-free.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth & contract
- `.planning/NUMEN-REWORK-BRIEF.md` — LOCKED milestone brief. **§2.5** (disclosure + reuse: "keep ALL rich visuals … they become the drill-downs"), **§4** (reuse map — the existing chart components to transplant), **§6** (engine signal reference: CORE / SUPPORTING / CUT field lists — SUPPORTING is what the drill-downs surface). NOTE: brief prose says "Reading"; user-facing noun is "Simulation" (Phase 1 D-09).
- `.planning/REQUIREMENTS.md` — **READ-09** (this phase's single requirement: rich visuals preserved as drill-downs, nothing visual deleted).
- `.planning/ROADMAP.md` — Phase 3 goal + 3 success criteria (esp. SC-2: every visual renders outside Konva with real output, **no throwing or grey-cell fallbacks**).
- `.planning/phases/02-the-reading/02-CONTEXT.md` — **the seam this phase plugs into**: D-09/D-10 (two-tier disclosure), D-12 (native-now → rich-later swap), D-13 (graceful degrade), and the "Observation for the planner" (all board visuals already Konva-free → reskin+remount).
- `.planning/phases/01-foundation-shell/01-CONTEXT.md` — THEME-06 locked token values (the reskin target) + the matte taste bar.

### Engine data shape (read-only; engine is frozen)
- `src/lib/engine/types.ts` — `PredictionResult`. P3-relevant fields: `heatmap` (`segments[]`, `personas[]`, `weighted_top_dropoff_t`, `dropoff_segment_indices`, niche/ghost inputs), `apollo_reasoning.dimensions[]`, `hook_decomposition` (0–10 modality sub-scores), `niche` cohort + confidence inputs for `ScoreDistribution`, `emotion_arc` (present but **dropped** this phase, D-05). **CUT (never render):** `feature_vector`, dead `*_score`, `predicted_engagement`, `critique`, telemetry (READ-10 guard standing).

### The Reading seam (Phase-2 output — extend, don't rebuild)
- `src/components/reading/reading.tsx` — the container. **The closed `PanelId` union + `PANEL_TITLE` map + `PanelContent` switch** are what P3 edits: add `'score'`, swap each panel's native body for the rich visual. The single `usePermalinkAnalysis` subscription stays (children are prop-driven leaves — do NOT re-subscribe per visual).
- `src/components/reading/drill-sheet.tsx` — generic children-based container (bottom/right via `useIsMobile`); the rich charts mount as its children. **Unchanged.**
- `src/components/reading/driver-rows.tsx` (`onRowTap`), `src/components/reading/persona-cloud.tsx` (`onOpen`) — existing tap sources. `src/components/reading/score-gauge.tsx` — **needs a NEW `onOpen`** for the `score` panel (D-02).
- `src/components/reading/deeper-read.tsx` — inline 3-dim expand; **unchanged** (D-03).

### Rich visuals to transplant (existing, Konva-free — reskin/remount)
- `src/components/board/audience/RetentionChart.tsx` + `retention-geometry.ts` — retention curve **with the niche/ghost overlay built in** (niche/ghost is NOT a separate component). → retention panel.
- `src/components/board/audience/SegmentTable.tsx` — drop-segment breakdown. → retention panel.
- `src/components/board/audience/RetentionPlayer.tsx` + `use-uploaded-video-source.ts` — scrubbable player (discretionary, source-persistence landmine).
- `src/components/board/content-analysis/CraftFilmstrip.tsx` + `content-analysis-derive.ts` — energy-graded keyframe filmstrip. → retention panel (D-04).
- `src/components/board/_kit/PersonaGraph.tsx` — HTML-Canvas persona cloud (200 dots, hover cards). → personas panel.
- `src/components/board/verdict/ScoreDistribution.tsx` — `NicheCohort` decile histogram + `ConfidenceRange` (SVG). → score panel (D-02).
- `src/components/board/_kit/StatTile.tsx` — share/comment/save/loop rate tiles. → shareability panel.
- `src/components/board/audience/audience-derive.ts` — `buildPersonaNodes()`, segment groups, niche/ghost + drop derivations (the data-shaping layer; already used by the P2 reading container).
- `src/components/board/_kit/keyframe.ts` + `KeyframeImage.tsx` — keyframe URL resolution for the filmstrip (P2 `ThumbnailStrip` already uses `resolveKeyframeUrl`).

### Dropped — do NOT mount (D-01)
- `src/components/board/verdict/FactorBars.tsx` — superseded by `reading/driver-rows.tsx`.
- `src/components/board/InsightHeroFrame.tsx` — superseded by the new Reading hero.

### Data/route hooks (existing)
- `src/hooks/queries/use-permalink-analysis.ts` — the Reading's data source (single subscription in `reading.tsx`).
- `useIsMobile`, `usePrefersReducedMotion` — sheet-vs-drawer + reduced-motion for any chart animation.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (all Konva-free — reskin + remount, don't rebuild)
- **`RetentionChart`** (+ `retention-geometry.ts`) — SVG curve with the **niche/ghost curve as a built-in overlay** (resolves the roadmap's "niche/ghost curves" as part of this one component, not a separate transplant).
- **`PersonaGraph`** — **HTML Canvas** (not Konva; the golden-angle layout P2's static `PersonaCloud` already borrowed). Transplants cleanly; needs a mobile tap fallback for the hover cards.
- **`CraftFilmstrip`** — the energy-graded keyframe instrument; pairs with the retention curve on the shared timeline (D-04).
- **`ScoreDistribution`** — privacy-safe niche histogram + confidence band; pure SVG, SSR-safe (x in %, fixed-px dots). The new `score` panel's content.
- **`SegmentTable`**, **`StatTile`** — table + stat-tile primitives for the retention + shareability panels.
- **The whole P2 `reading/` cluster** is the host: `DrillSheet` (container), `reading.tsx` (panel state + the `PanelContent` switch to edit), the three tap sources.

### Established Patterns
- **The D-12 swap pattern** — P2 deliberately shipped *real native content* in each panel so P3 swaps *content inside the same container*. Follow it: edit `PanelContent`'s per-panel body, keep the `DrillSheet` + panel-state machinery.
- **Closed-union panel allow-list** (security) — extend `PanelId`/`PANEL_TITLE` together; never reflect a raw key.
- **Flat-warm `@theme` semantic tokens** — reskin charts to `--color-success/warning/error` (score zones), cream text `rgba(236,231,222,…)`, coral accent; strip Raycast gradient/blur/inset.
- **CLAUDE.md gotchas:** oklch L<0.15 miscompiles → hex for dark; Lightning CSS strips `backdrop-filter` → blur via inline `style` (rarely needed — taste bar is matte); kill dev server + clear `.next/` when CSS changes don't appear.
- **Mixed render tech** — Recharts (`TrendChart`), custom SVG (`RetentionChart`, `ScoreDistribution`), HTML Canvas (`PersonaGraph`). Reskin approach differs per type (tokens for SVG/CSS; Canvas draw-color constants for PersonaGraph).

### Integration Points
- **`reading.tsx` `PanelContent`** — the single edit locus for swapping native → rich, per panel.
- **`score-gauge.tsx`** — the one NEW tap wiring (gauge `onOpen` → `setPanel('score')`).
- **The `DrillSheet`** — already mobile/desktop responsive; rich charts mount as children, may break wider than the 760px thread column inside the drawer.
- **Phase-4 awareness** — these blocks/visuals get stage-revealed in Phase 4 (driven by `useAnalysisStream` at the container). Keep visuals prop-driven and side-effect-light so the reveal can animate them without a rewrite.
</code_context>

<specifics>
## Specific Ideas

- **The "watch journey" pairing (D-04)** is the signature drill-down: retention curve + filmstrip + segment table on one aligned timeline — *"you lose them at 0:08, and here's the frame + segment at 0:08."* This is the relationship that justifies the composed-cluster density (D-06).
- **The score panel (D-02) is the instrument move** — Davide chose the arc gauge (P2) to make the score read as an instrument; the niche histogram + confidence range behind a gauge tap is the depth that pays that off. "Where your 71 sits in your niche, and how sure we are."
- **Curate over literalism (D-01)** — preserving the *information* (FactorBars' bars → DriverRows; InsightHero's content → the new hero) satisfies "nothing deleted" more honestly than nesting an old hero inside the new one.
- **Reskin is targeted, not total (D-07)** — token-swap the obedient charts, actually re-treat the ones with gradients/glow, and prove it with a human-UAT gate. Avoid the "redesign everything" trap that sank the stood-down rebuild.
</specifics>

<deferred>
## Deferred Ideas

- **Emotion arc as a drill-down** (D-05) — not built this phase; it has no standalone chart (woven into `ContentAnalysisFrame`). Extracting it is a future touch-up if creators want it, not part of reskin+remount.
- **`RetentionPlayer` scrubbable video** — discretionary this phase; include only if the uploaded source persists on permalink reload, else a future enhancement once source persistence is solved.
- **A dedicated "Content/Craft" surface** (6th panel for the full content-craft instrument) — declined (D-04 folds the filmstrip into retention); revisit only if the retention panel gets too dense.
- **Shareable / deep-linked drill-down panels** (`?panel=…` that survives a share) — possible now that 5 panels exist; fuller "share a Reading as image/link" is a v2 growth-loop req (`SHARE-01`).
- **Naming reconciliation** (carried from Phase 1 & 2) — brief/roadmap/requirements prose + the `READ-*` IDs still say "Reading"; user-facing build uses "Simulation." A separate prose-reconciliation pass, still not done.

### Landmines for the researcher (verify before planning)
1. **Board-store / choreography coupling (highest-risk).** The P2 reading cluster is deliberately `useBoardStore`-free. The transplant targets (`RetentionChart`, `PersonaGraph`, `CraftFilmstrip`, `SegmentTable`) may import `useBoardStore`, `use-audience-choreography.ts`, `use-client-weights.ts`, or camera/cross-group state. **These must be severed / replaced with prop-driven data** (the way P2 rebuilt `DriverRows` rather than reusing `FactorBars`). Map each visual's dependency graph; a transplant that drags the board store back in violates the P2 architecture.
2. **`emotion_arc` has no component** — confirmed woven into `ContentAnalysisFrame`; do not hunt for an `EmotionArc.tsx` (D-05 drops it).
3. **niche/ghost curve is an overlay inside `RetentionChart`**, not a separate file — it comes along with the curve transplant.
4. **`ScoreGauge` has no tap target today** — adding the `score` panel (D-02) is genuinely new wiring (gauge `onOpen` + union extension), not just a content swap.
5. **`RetentionPlayer` video source persistence** — `use-uploaded-video-source.ts`; may be null on permalink reload (the source isn't re-fetched). Gate the player on a resolved source.
6. **Data-scale traps (echo P2):** hook modality sub-scores are **0–10** (P2 native already correct); `ScoreDistribution` histogram is **10 decile bins**; `ApolloDimension.score` is 0–100. Don't cross the wires.
</deferred>

---

*Phase: 3-Rich Visuals as Drill-Downs*
*Context gathered: 2026-06-14*
