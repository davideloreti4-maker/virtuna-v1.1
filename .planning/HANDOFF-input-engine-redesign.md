# HANDOFF — Input & Engine frame redesign

**Branch:** `feat/actions-frame-inline-redesign`
**Date:** 2026-05-30
**Status:** ✅ **BUILT + VERIFIED** (form chosen, components shipped, uncommitted).

## ✅ SESSION 2026-05-30 (build) — what shipped
- **Form chosen by user:** **A-led hero + C data rows** (monumental percentile + quiet supporting rows + Engine findings rows).
- **Final static system:** `.playwright-mcp/input-engine-final.html` (prose killed, uppercase-eyebrows killed, real 240px width).
- **Built in real components:**
  - `InputResultCard.tsx` — full rewrite to the scorecard: confident (count-in hero "Top X%" = strongest percentile + 3 rows + `confidence_label · confidence`), gated ("Hold" coral + edge-flag + dimmed directional-only metrics + low-conf foot), streaming ("● Analyzing"), idle ("Awaiting analysis"). No video, no prose. Mount fade-in + rAF count-in (reduced-motion safe).
  - `EngineGroup.tsx` — rewrite to 3 states; killed green-check stepper + "Pipeline complete" + latency headline. Split into pure **`EngineView`** (running: active stage + coral segmented progress; complete: "N of M signals" → expandable findings rows; idle). Kept `deriveEngineStageStatus`, aria-live, STAGE_UPDATE push, camera auto-pan.
  - `board-constants.ts` — Input(312)+Engine(128) now content-sized + added to `AUTO_HEIGHT_FRAMES`; `engine.y = input.height + GUTTER` keeps `resolveBoardLayout({})` ≡ GROUP_FRAMES.
  - `Board.tsx` — removed the Input Konva-node path (`InputNodeShape` + `InputNodeOverlay`/`NodeOverlay`/`GlassPanel` card-in-card); Input now renders as a frame-child like Engine. Deleted `InputNode.tsx`. Extended `inputCard` with `confidence`/`confidenceLabel`/`gated`.
  - `BoardMobile.tsx` + `BoardMobileInput` — new prop shape.
- **Verification:** tsc clean (my files), eslint clean, 44 board tests green (board-constants 25 / EngineGroup 9 / BoardMobile 5 / Board 5). Rewrote EngineGroup.test + board-constants.test to the new contract. Live proof: `/dev/input-engine-preview` (throwaway page, mock data, real components) → `.playwright-mcp/live-frames.png`.

### Remaining / next session
- **Authed real-board screenshot:** `/analyze/[id]` needs login (307→/login); only verified via `/dev` preview + units. Confirm the *composed* board (Konva frames + auto-height reflow + camera presets) on a logged-in `/analyze/z05dIjbz4v4W`.
- **Tune `bodyHeight`/floor:** preview pinned 276px clipped the 4-row gated foot — real app is auto-height so it grows, but sanity-check the input constant (312) floor vs both states live.
- **Cleanup:** delete throwaway `src/app/dev/input-engine-preview/page.tsx` before ship. Dev server left running (port 3000) for live viewing.
- **Not committed** — parallel session also has uncommitted work on this branch (actions + verdict/score redesign). Commit only the 7 Input/Engine files when ready.

---

### (Pre-build context below — kept for reference)
**Prior status:** Critical audit done · 7 HTML sketches done · awaiting user pick of a design FORM (3 finalists).

> ⚠️ **Parallel session active on this branch** — auto-commits + auto-pushes with well-formed messages. HEAD moves between sessions. `git log` before assuming state. All my sketch work is uncommitted HTML in `.playwright-mcp/` (gitignored), so no merge risk.

---

## 0. THE GOAL (don't lose this)

UI/UX rework of **all** board frames; **this session = Input + Engine frames only**, from the ground up. Bar set by the user: must look like something **Apple / Linear / Raycast / Revolut / Stripe / Loom / Anthropic** would ship. The user rejected three rounds for "AI slop" — the bar is *craft*, not feature-completeness.

Current (pre-redesign) frames — screenshot intent:
- **Input** (240×440): TikTok-style video card + 4 predicted-engagement percentiles. Dominant real state = **"VIDEO UNAVAILABLE"** black box (video deleted post-analysis).
- **Engine** (240×328→fills to y800): 5-stage pipeline stepper with green checks + "Qwen · 5 stages · 211.8s".

---

## 1. THE AUDIT (settled findings — these are the brief)

**Both frames describe the machine, not the creator's video.** The full critique lives in this session; the load-bearing conclusions:

### Input frame
- **Confidence is invisible** — the #1 omission. `confidence` (0-1) + `confidence_label` (HIGH/MED/LOW) exist on every result (`src/lib/engine/types.ts:220-221`); we show `top X%` as hard fact and hide the model's own certainty.
- **Numbers have no anchor** — bare percentile, no raw %, no verdict word, no "good/bad" frame.
- **"Input" frame shows OUTPUT** (predicted engagement). Naming/content mismatch.
- **Empty state IS the steady state** — video is deleted post-analysis (`InputResultCard.tsx:71`), so "no media" is the normal permalink view but is coded as the degraded fallback.
- Heart=Completion icon is a semantic lie (`InputResultCard.tsx:64`).

### Engine frame
- **A permanent loading spinner** — after `isComplete`, 5 green checks = a receipt. Information content = 0 (`EngineGroup.tsx:144-156`).
- **Latency as a headline** ("211.8s") — a brag/apology, not user value.
- **Dev-facing vocabulary** ("Qwen-VL segmentation", "Aggregator").
- **Findings discarded** — hook decomposition, niche/content-type, persona reasoning, signal coverage all computed + persisted, none shown.

### Design-language gaps (the "slop" tells, in priority order)
1. **The UI narrates in prose.** Full explanatory sentences inside components ("The share loop drives reach", "Fix the open before you ship") = the biggest tell. Apple/Linear/Raycast use **labels + values + ≤3-word status**, never sentences. **KILL ALL PROSE.**
2. **Generic stacked-card template** — eyebrow → big stat → paragraph → list → footer. Every SaaS dashboard. The named brands each commit to a distinct **form**.
3. Box-in-box-in-box; colored tint fills; chips/pills with borders.
4. Tracked-uppercase eyebrows everywhere (dated).
5. Decorative glyphs/emoji/arrows (`◇ ⌖ ⇪`, 🏋, `↑`).
6. No spacing system; flat type with no real hierarchy.
7. Green-checkmark wall = dashboard cliché.

---

## 2. THE DESIGN SYSTEM (locked — apply when building)

- **Space:** 4 / 8 / 12 / 16 / 24 / 32 only. ~22px card padding, ~16px row rhythm.
- **Type:** Inter (variable, opsz). Scale ≈ 56 display / 21 prefix / 15 title / 13 body / 11 label. Display gets **negative tracking (−0.035em)**, tabular numerals (`font-variant-numeric:tabular-nums`).
- **Color:** monochrome — white @ **95 / 56 / 38 / 22%**. Big contrast jumps. **Coral (#FF7F50) = "needs attention NOW" only** — live/active progress, or the gated warning. **A healthy, finished result has ZERO coral.** Green removed entirely.
- **Surface (material, not flat):** `radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,.025), transparent 60%)` + `linear-gradient(180deg,#17181a,#141517)`, 1px `rgba(255,255,255,.055)` border, `inset 0 1px 0 rgba(255,255,255,.06)` + soft depth shadow. 14px radius.
- **Chrome:** no internal borders/chips/pills/tints. Separation = space + ≤1 hairline (4%). No icons in data rows. **No prose. No emoji. No arrows.**
- **Frame title recedes** (12px, t2) — content owns the card, not the label.

---

## 3. WHERE WE LANDED — THE OPEN DECISION

The user can't yet articulate the target but rejected all "polished card" attempts. Final move: **3 distinct FORMS** of the Input "result-is-in" state, all zero-prose, same craft. **User must pick one** before any code.

**File: `.playwright-mcp/input-concepts.html`** (serve, see §5)

| Form | Reference | Feel |
|---|---|---|
| **A · Monumental** | Apple Health summary | One huge number owns the surface; rest is a quiet list. Sparse, calm. |
| **B · Radial** | Revolut / Apple Watch | Result is a single crafted object (coral arc = stronger-than-95%); 3 supporting stats. |
| **C · Data** | Linear / Stripe panel | Dense, structural; every metric a row + thin percentile meter; lead signal in coral. |

➡️ **NEXT ACTION: ask the user which form (A/B/C), or which is closest + what's still off.** Then build the full system (gated + Engine states) in that language.

---

## 4. DATA OWNERSHIP (decided — respect these boundaries)

The board has dedicated frames; Input/Engine must NOT duplicate them:
- **Input** = engagement scorecard. Owns the 4 percentiles (locked contract w/ Audience redesign) **+ qualifies its own numbers with confidence**. Does NOT render the go/no-go verdict.
- **Engine** = coverage + detection (niche, format, hook headline, signals N/M). **No confidence here** (lives on Input — avoids double-count). No latency headline. No green checks.
- **Score frame** owns the go/no-go verdict ("Final virality call").
- **Content Analysis frame** owns the hook "why" breakdown.

**Engine is state-aware (two lives):** live stepper while streaming (it earns its keep — drives camera auto-pan, `EngineGroup.tsx:96-115`) → collapses to one line on complete → expand for a findings list (same row rhythm as the scorecard = the consistency *is* the polish).

**Both states must be drawn**, incl. the **gated / LOW-confidence "Hold — don't post yet"** state (`anti_virality_gated`, `types.ts:254`) — the highest-value screen, dimmed metrics + "directional only".

---

## 5. SKETCH FILES + HOW TO VIEW

All in `.playwright-mcp/` (gitignored, persist on disk):
- `input-concepts.html` ← **the 3 finalists (A/B/C). START HERE.**
- `input-engine-premium.html` ← best full pass (Input confident+gated, Engine 3 states) — still "card-y" but the material/type baseline.
- `input-engine-refined.html` ← prior pass (monochrome, prose still present — rejected).
- `input-engine-sketches.html` ← original A/B/C + composite D (all rejected as slop; useful as "what not to do").

**Serve + screenshot (MCP browser is locked by the parallel session — use headless shell):**
```bash
cd /Users/davideloreti/virtuna-v1.1/.playwright-mcp
(lsof -ti:8101 | xargs kill -9 2>/dev/null); nohup python3 -m http.server 8101 >/dev/null 2>&1 &
BIN="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell"
"$BIN" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1140,860 --user-data-dir=/tmp/cc-shot --screenshot=shot.png \
  "http://localhost:8101/input-concepts.html"
# then Read shot.png
```
(`mcp__playwright__*` errors with "Browser is already in use" — the other session holds the profile. Headless shell binary is `chrome-headless-shell`, NOT `headless_shell`.)

---

## 6. COMPONENT MAP (what to touch when building)

| File | Role | Lines |
|---|---|---|
| `src/components/board/InputResultCard.tsx` | Input body — video card + percentiles + no-media branch | 213 |
| `src/components/board/InputNode.tsx` | Input Konva shape + DOM overlay wrapper | 57 |
| `src/components/board/EngineGroup.tsx` | Engine stepper, live status derivation, camera auto-pan | 159 |
| `src/components/board/EngineStageGlyph.tsx` | one stepper row | 84 |
| `src/components/board/GroupFrameOverlay.tsx` | frame chrome: title bar, empty-state copy, auto-height measure | 205 |
| `src/components/board/board-constants.ts` | frame bounds, layout reflow, AUTO_HEIGHT_FRAMES | 179 |
| `src/components/board/MobileFrameCard.tsx` | mobile card wrapper (reuses same children) | 57 |

**Layout note:** Input + Engine are **fixed-height** today (`board-constants.ts:76-83`, NOT in `AUTO_HEIGHT_FRAMES`). The premium scorecard is taller than today's slot, and Engine-collapse implies reflow → **building any of A/B/C likely requires adding input/engine to auto-height + reflow + camera-preset recompute** (`resolveBoardLayout`, `computePresetTargets`). Scope this.

**Empty-state gap:** `GroupFrameOverlay.tsx:30-31` — input & engine are the only frames with blank empty-state copy (every other frame has crafted title+sub at `:13-29`). Give them real ones.

---

## 7. DATA REFERENCE (fields available, mostly unsurfaced)

`PredictionResult` (`src/lib/engine/types.ts:217-339`), persisted to `analysis_results`:
- `confidence` 0-1 + `confidence_label` HIGH/MED/LOW (`:220-221`)
- `anti_virality_gated` bool + `anti_virality_reason` (`:254-257`) → "Hold" state
- `behavioral_predictions`: `{completion,share,comment,save}_pct` (raw 0-100) + `_percentile` ("top 5%") + optional `loop_pct/loop_percentile` (`:576-590`)
- `signal_availability`: ~15 booleans (`:350-392`) → "9 of 11 signals"
- `hook_decomposition`: visual/audio/text/speech scores + `weakest_modality` + `cognitive_load` (`:323`)
- `wave0`: `content_type` + `niche` (+ confidence) → "Fitness · talking-head"
- `heatmap.segments[]` (beats, hook zones, keyframe_uri), `persona_simulation_results[].reasoning`
- `latency_ms` (`:294`) — currently the headline; DEMOTE to expand-on-demand.

**Keyframe for Input media:** `thumbnailUrl` already wired (`InputResultCard.tsx:13`); real frames come from `analysis_results.variants.filmstrip_segments` (keyframe streaming bug fixed earlier this branch, commit `5fe6051`). Confident state still needs to decide where video/keyframe lives when present.

---

## 8. IMMEDIATE NEXT STEPS (fresh session)

1. Serve `input-concepts.html` (§5), show the user, **get the A/B/C pick** (or closest + what's off).
2. Once a form is chosen: design the **gated** Input state and the **Engine** (streaming / collapsed / findings) in that same language — zero prose, the §2 system.
3. Confirm the full set as static, then **build in real components** (§6) with **motion** (200ms ease transitions, number count-up, progress fill) — the static mocks undersell it; it only fully lands as Loom/Linear-tier in the running app (`npm run dev` → localhost:3000, test permalink `/analyze/z05dIjbz4v4W`).
4. Handle the fixed→auto-height layout change (§6) + mobile parity (`MobileFrameCard`).
5. Run checks: `npx tsc --noEmit` · `npx eslint <files>` · `npx vitest run src/components/board`.

**Do NOT:** reintroduce prose sentences, tinted card-in-card, green checks, latency headlines, or tracked-uppercase eyebrow stacks. That's the slop the user rejected three times.
