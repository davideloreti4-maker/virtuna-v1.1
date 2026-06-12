# Phase 4: Mobile Reading Thread + PWA Shell - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The core paradigm on mobile: the AI pronounces the Reading first (unprompted), engine
stages reveal as structured blocks below a reserved verdict "throne" that crystallizes
last, the Apollo expert insight is foregrounded, and a completed Reading persists as a
re-openable resting document that opens on the verdict — all inside an installable PWA.
Replaces the Konva canvas board as the primary surface.

**Requirements:** READ-01, READ-02, READ-03, READ-04, READ-05, READ-06, READ-07, SHELL-04

**This phase decides HOW the truth is staged.** The Phase-2 view-model already decides
WHAT is true (the `ReadingBlock` union + verdict derivation + identical-render contract);
Phase 4 renders and choreographs it. It does NOT re-decide block taxonomy, verdict
derivation, or the live/persisted contract — those are locked upstream (see canonical refs).

**Build-not-ship constraint:** Phase 4 may BUILD against the proven-honest real fixture
(`live-WEkihfOzJphv.json`), but MUST NOT ship to users until the deferred Phase-3 GO is
recorded (`03-GATE-DECISION.md`). Tracked: `.planning/todos/pending/phase-03-deployed-smoke-gate.md`.

**Out of scope (steered to other phases):**
- The "ask the expert" reply *functionality* / conversation logic → Phase 5/6 (P4 ships the
  input shell only, the AI's first turn, no reply round-trip).
- Home = list of past Readings, per-video routing, ingestion (upload/URL/share_target) → Phase 5.
- iOS native share-sheet ingestion → Capacitor milestone (WebKit #194593).
</domain>

<decisions>
## Implementation Decisions

### A. Thread framing & metaphor (READ-01)
- **D-01:** **Document-as-first-turn inside a minimal thread shell** (hybrid). The Reading
  renders as ONE rich, single-column structured turn (verdict throne leading, blocks below)
  — NOT 10 chat bubbles, NOT an avatar/bubble chrome. It lives inside a thread container
  that: (a) pronounces first with no user message preceding it (READ-01 — never a blank
  prompt), (b) carries the persistent "analyze new" action, (c) reserves the bottom for the
  Phase-5 "ask the expert" reply input — **present but deferred/inert in Phase 4**.
- **Rationale:** the vision is explicitly "one thread per video, the AI's first turn is the
  Reading," with a chat spine for follow-ups (Phases 5–6) — so the thread bones are
  load-bearing and must exist now. But forcing ~10 evidence blocks + a throne into bubble
  chrome reproduces exactly the "neon AI chatbot" feel the Whoop-for-content wedge rejects.
  Document-in-a-thread-shell threads the needle.
- **Rejected:** pure document with no thread shell (orphans the Phase-5 conversation, costly
  retrofit); full chat-bubble thread (fights the calm/verdict-first aesthetic).

### B. Throne reveal behavior (READ-03)
- **D-02:** **Reserved calm "forming" placeholder → crystallize last** (one motion). The
  throne is present and reserved from t0 with a quiet neutral "forming the read…" state (NO
  band, NO number). Evidence blocks stage-reveal below it. At the `complete` event the band +
  one-sentence why crystallizes into the throne via the single DS-07 calm motion — the climax.
- **Rationale:** the engine's `overall_score` only resolves at `complete`, so there is NO
  real provisional band to show mid-stream. A band that "updates" would fabricate confidence
  then revise it — the confident-lie the Phase-3 gate exists to kill. "Visibly forming"
  (READ-03) is satisfied by the throne's HELD reserved presence + anticipation, not a fake
  changing number. The crystallization is one calm motion (opacity + high-damping translate,
  no overshoot — the existing StageBlock/DS-07 motion), never a slot-machine spin.
- **D-02a:** The demoted `/100` number appears only as in-body supporting evidence within the
  verdict block (per 02 D-07), NEVER in the throne headline. "Mixed signals" is a first-class
  throne state alongside the three bands.
- **Rejected:** provisional updating band (dishonest + unavailable from the engine);
  blank-then-drop-in (loses the "forming" reservation that builds the climax).

### C. Block order & pacing (READ-02 / READ-05)
- **D-03:** **Curated narrative order + streaming-driven reveal timing.** Phase 4 OWNS the
  render order (the view-model emits pure data with NO order hints — 02 D-13). The sequence is
  FIXED; each block animates into its reserved slot as its underlying engine stage completes.
- **D-03a:** **Proposed curated order** (planner may tune within this intent):
  Throne (verdict) → **Expert insight (Apollo)** → Hook → Retention → Audience → Drivers →
  Persona-read → Fixes → Content-summary → Audio *(conditional-render)*. Reads as a composed
  argument: judgment → the expert's interpretation → supporting evidence → what to do.
- **D-03b:** **Apollo expert-insight is pinned directly beneath the throne** — foregrounded,
  never buried by late stage-completion (READ-05; the vision wedge — Apollo is the interpreter).
- **D-03c:** **Pacing = as-soon-as-ready within fixed slots.** No artificial one-at-a-time
  gating (feels slow/theatrical). Calm per-block reveal (DS-07 ease-calm). The throne
  crystallizes LAST regardless of being positioned first (reserved slot fills at the climax).
- **D-03d:** Resting-document re-open uses the SAME curated order → a re-opened Reading looks
  identical to the live render, minus the streaming delays (reinforces the DATA-02 parity feel).
- **Rationale:** raw stage-completion order buries Apollo (late stage) and is
  nondeterministic, which breaks the live/resting parity feel. Curated order satisfies READ-05
  + READ-02 simultaneously while keeping the streaming aliveness.

### D. PWA install + offline scope (SHELL-04)
- **D-04:** **Install coaching = passive, post-first-Reading hint + a quiet menu affordance.**
  A dismissible hint appears AFTER the first completed Reading (peak felt-value moment)
  coaching the iOS "Share → Add to Home Screen" flow, plus an always-available install
  affordance in the menu. NEVER a blocking modal. Dismissal is remembered.
- **D-05:** **Offline scope = app shell offline + cache-on-view of opened Readings.** Already-
  opened Readings cache as static resting documents (re-openable offline via the view-model
  from the persisted row). New analysis stays online-only (server-side engine — unavoidable).
  Serwist runtime caching of the app shell + the analysis GET route on view.
- **Rationale:** post-value is the highest-conversion, lowest-intrusion install moment; iOS
  *requires* coached manual install anyway (no native prompt). Cache-on-view is a cheap win
  reinforcing "resting document permanence."
- **Rejected:** blocking install modal (anti-calm); offline-first full-history sync (Phase 5
  owns the list — scope creep).

### Claude's Discretion
- Exact "forming" affordance visual for the throne placeholder (within D-02's calm/no-fake-band
  intent) — researcher/planner + UI-phase call.
- Exact verdict-block visual treatment of the demoted `/100` (small chip vs tap-to-expand) and
  the distinct "Mixed signals" visual — UI-phase owns the design contract.
- Precise per-block layout, the thread-shell chrome details, and the inert reply-input styling.
- Serwist config specifics (precache manifest, runtime cache strategies, `maxDuration` interplay)
  — researcher maps; this is architecture, not a visionary decision.
- Whether the curated order (D-03a) collapses/groups any low-value blocks on small viewports.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Vision & roadmap
- `.planning/NUMEN-SURFACE-VISION.md` — the authoritative milestone vision (Whoop-for-content,
  verdict-first, calm restraint, anti-theater, the Reading thread paradigm)
- `.planning/ROADMAP.md` — Phase 4 goal + success criteria (5 numbered TRUE-conditions)
- `.planning/REQUIREMENTS.md` — READ-01..07 + SHELL-04 definitions; deferred/out-of-scope notes

### Upstream locked contracts (Phase 2 — the view-model Phase 4 renders)
- `.planning/phases/02-view-model-data-contract-eng-06-d-12/02-CONTEXT.md` — block taxonomy
  (D-01), verdict derivation (D-04..07), identical-render contract (D-08..12), ReadingBlock
  strategy (D-13/14). Phase 4 does NOT re-decide these.
- `src/lib/reading/block-types.ts` — the `ReadingBlock` discriminated union (11 kinds) +
  `CanonicalReading` — the exact shapes Phase 4 renders
- `src/lib/reading/view-model.ts` — `toReadingBlocks(canonical)` (pure selector) +
  `canonicalFromLive(result)` (live adapter)
- `src/lib/reading/from-persisted-row.ts` — `fromPersistedRow(row)` (resting-document adapter)

### Upstream locked contracts (Phase 3 — verdict banding)
- `.planning/phases/03-smoke-gate-verdict-banding-calibration/03-CONTEXT.md` — dead-band /
  "Mixed signals" mechanic (D-02..05)
- `src/lib/reading/verdict-bands.ts` — `VERDICT_BANDS`, `bandFor`, `DEAD_BAND_FLOOR`, `inDeadBand`

### Design system (Phase 1 — the kit Phase 4 builds with)
- `.planning/phases/01-design-system-foundation-brand-migration/01-CONTEXT.md` — kit decisions,
  `.numen-surface` token layer, DS-07 calm motion (the stage-reveal moment)
- `src/components/numen/` — kit primitives: `surface.tsx`, `verdict-swatch.tsx`, `pill-chip.tsx`,
  `icon-button.tsx`, `stage-reveal.tsx` (StageBlock calm motion)
- `BRAND-BIBLE.md` — Raycast-extracted tokens / brand language

### Streaming (reshape, don't build transport)
- `src/hooks/queries/use-analysis-stream.ts` — the existing SSE hook; Phase 4 RESHAPES its
  `StageEvent`s into ReadingBlock reveals (does NOT build new transport)
- `src/app/api/analyze/route.ts` + `src/app/api/analysis/[id]/route.ts` — live + replay routes

### Gate constraint
- `.planning/todos/pending/phase-03-deployed-smoke-gate.md` — the deferred Phase-3 GO that
  gates SHIPPING (not building)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `use-analysis-stream.ts` hook — live SSE `StageEvent` stream; Phase 4 maps events → block reveals.
- `src/lib/reading/view-model.ts` — `toReadingBlocks` (live + replay both funnel through it,
  client-at-mount; pure). The single render input for both paths.
- `src/components/numen/` kit — `surface` (Glass, inline backdrop-filter survives Lightning CSS),
  `verdict-swatch` (the throne's band swatch), `pill-chip`, `icon-button`, `stage-reveal`
  (DS-07 calm motion = the per-block + throne crystallization moment).
- Muted verdict scale + clay accent tokens (Phase 1, APCA-validated) for the band visuals.

### Established Patterns
- **Reveal motion is already specced (DS-07):** opacity tween + high-damping spring translate
  (no overshoot), reduced-motion zeroes translate → static opacity. `--numen-ease-calm` token.
  Reuse for both per-block reveal and throne crystallization — do NOT introduce new motion.
- **Honest omit-discipline (view-model D-14):** absent signal → block omitted silently;
  whole-analysis degradation → first-class honest block. Phase 4 must not render empty shells.
- **Server components by default, client only when interactive** — the streaming thread is
  client (live SSE); the resting document can be more static.

### Integration Points
- The thread surface replaces the Konva board as the primary `/analyze`-class entry (board
  remains for desktop until Phase 7; do NOT delete it this phase).
- PWA: new `manifest.ts` + Serwist service worker (Serwist chosen over next-pwa, vision §stack).
- The inert reply-input at the thread bottom is the seam Phase 5/6 wires to "ask the expert".
</code_context>

<specifics>
## Specific Ideas

- "Whoop for content" is the north star: dark-neutral, verdict-first, sans-led, color spent
  only on the good/mixed/bad verdict scale. Explicitly NOT numinous/temple/amber theater.
- The throne crystallization is "the ONE climax" — anticipation held, then a single calm lock,
  never a spin/slot-machine.
- Apollo (the expert insight) is the product's interpretive value — it sits second, right under
  the verdict, and reads in plain language (no engine jargon, READ-07).
</specifics>

<deferred>
## Deferred Ideas

- **"Ask the expert" conversation round-trip** — the reply input ships as an inert shell in P4;
  the actual follow-up Q&A / agentic tools = Phase 5/6.
- **Home list of past Readings + per-video routing + ingestion** (SHELL-01/02/03, IN-*) = Phase 5.
- **Offline-first full-history sync** — beyond cache-on-view; deferred (Phase 5+ owns the list).
- **Desktop instrument (Konva keep-vs-retire)** = Phase 7.

### Reviewed Todos (not folded)
- `phase-03-deployed-smoke-gate.md` (weak keyword match, score 0.6) — NOT a Phase-4
  implementation decision. It is the deferred Phase-3 GO and is carried as a build-not-ship
  CONSTRAINT (see Phase Boundary), not folded into Phase-4 scope.
</deferred>

---

*Phase: 4-Mobile Reading Thread + PWA Shell*
*Context gathered: 2026-06-12*
