# HANDOFF — Mobile fixes + Audience frame "Retention Story" redesign

**Branch:** `feat/actions-frame-inline-redesign`
**Date:** 2026-05-29
**Status:** 3 mobile fixes shipped; keyframe bug fixed (uncommitted); Audience redesign **mockup approved**, ready to build.

> ⚠️ **Parallel session active on this branch.** Another Claude session auto-commits to this same worktree with well-formed conventional-commit messages (and auto-pushes). My mobile-toggle work landed under commit `0fbed4d fix(sidebar):…` (mislabeled but content correct). Expect HEAD to move between sessions. Check `git log` before assuming state.

---

## 1. DONE THIS SESSION

### ✅ Mobile card-view toggle (committed — bundled in `0fbed4d`)
- `ViewModeToggle.tsx` rebuilt as a **2-way segmented control** (Board | Cards), styled like the camera-preset toolbar (glass gradient, blur, 6% border).
- Pinned **top-center**: `top-16` in board mode (under the camera switcher), `top-4` in cards mode (fills BoardMobile's reserved 56px strip).
- `Board.tsx`: removed the `(isMobile || override !== null)` visibility gate → **always visible desktop + mobile**; passes `onSelect={setOverride}` (was the broken bottom-right floating button covered by the z-200 CommandBar).
- Verified live in all 4 states (desktop/mobile × board/cards).

### ✅ No drawers in card view + frame bg parity (committed — `873b590`)
- `HeatmapDrawer.tsx`: **removed the Radix `<Sheet>` branch entirely** (+ `useIsMobile`/`Sheet` imports). The "Audience personas" drawer is gone on every viewport; the heatmap now **always expands inline within the frame** (grid-template-rows 0fr→1fr).
- `MobileFrameCard.tsx`: `bg-transparent` → `bg-[#18191a]` to match the board canvas `GroupFrame` fill.
- `HeatmapDrawer.mobile.test.tsx` rewritten to assert no-Sheet + in-frame grid on mobile.
- Verified: `sheetPresent:false`, `gridInsideAudienceFrame:true`, frame bg `rgb(24,25,26)`. 376/376 board tests pass.

### ✅ Keyframe / filmstrip blank bug — FIXED (⚠️ UNCOMMITTED on disk)
**Files (working tree, not committed):**
- `src/app/api/analyze/[id]/stream/route.ts`
- `src/app/api/analyze/__tests__/stream-route.test.ts`

**Root cause (confirmed):** The filmstrip extract route (`src/app/api/filmstrip/extract/route.ts:248-251`) persists keyframes to `analysis_results.variants.filmstrip_segments` (`{idx, keyframe_uri}[]`). The SSE stream route's reader was looking at `analysis_results.heatmap.segments` (no such field) → live runs **never emitted `filmstrip_segment_ready`**, so the Input thumbnail + keyframe row stayed blank until a reload (the permalink `/filmstrips` endpoint reads the bucket directly, which is why reload "worked").

**Fix applied:** renamed `extractHeatmapSegments`→`extractFilmstripSegments`, reads `row.variants.filmstrip_segments`. Output shape identical, so the downstream emitter is unchanged. Added a regression test (`emits filmstrip_segment_ready from variants.filmstrip_segments`) that fails on the old field. tsc + eslint clean, 7/7 stream-route tests pass.

**Still open on keyframes:**
- ⏳ **Live E2E not verified** — needs a real analysis run (video upload + engine) to watch keyframes stream live. Logically airtight (reader now matches writer) + unit-guarded, but not observed end-to-end.
- ⏳ `FILMSTRIP_EXTRACT_SECRET` is **undocumented in `.env.example`** (prod onboarding gap). `.env.local` already has it (local works). I could **not** edit `.env.example` — the path is permission-denied in this harness. Add manually:
  `FILMSTRIP_EXTRACT_SECRET=` (any shared secret; the extract route Bearer-auths against it) and ensure `NEXT_PUBLIC_APP_URL` is set in prod or extraction is skipped silently (`src/lib/engine/filmstrip/queue.ts:28-44`).

**To commit the keyframe fix:**
`git add 'src/app/api/analyze/[id]/stream/route.ts' src/app/api/analyze/__tests__/stream-route.test.ts`
suggested msg: `fix(filmstrip): SSE reads variants.filmstrip_segments so keyframes stream live`

---

## 2. AUDIENCE REDESIGN — LOCKED DECISIONS

User wants the Audience frame to be a **gamechanger / wow / cheatcode**. Approved direction: **radical fusion** into a 3-zone "Retention Story". Works for **both desktop board frame and mobile card**.

### Metric coordination (DECIDED)
- **Input frame keeps the 4 engagement percentiles** (Completion / Comments / Shares / Saves — `InputResultCard.tsx`, driven by `behavioral.*_percentile`). That's the *outcome scorecard*.
- **Audience frame = retention diagnosis only. NO engagement-% duplication.**

### Zone ① — "How it holds" (diagnostics, benchmark-led, creator language)
4 stat tiles, drop the cryptic ones:
- **Watch-through** `68% · top 15%` (was WATCH; add percentile context from `completion_percentile`)
- **Hook strength** `82% · Strong` (was HOOK; add word verdict)
- **Biggest drop-off** `0:21 · −38%` (was DROP; show time + magnitude. **Shorten label** — "Biggest drop-off" wraps)
- **Reach** `Broad · +19 vs niche` (was VS NICHE; plain language)
- **Remove `Weighted 65/20/10/5` from the headline** — it's a control, relocate to zone ③.
- (Optional 5th: **Replays** from `loop_pct` if room.)

### Zone ② — "Where & why they leave" (THE HERO — time-aligned fusion)
- Fuse **`Filmstrip` directly UNDER `RetentionCurve`**, sharing one time axis (keyframes map 1:1 to curve x-position).
- Add a **niche benchmark ghost line** (dashed) so the creator sees they beat niche-only reach. (Data: `heatmap.niche_completion_pct` / niche-slot personas.)
- **Replace the orange dot-markers** (`DropoffMarkers.ts`, cryptic clustered persona-swipe dots) with **inline labeled drop flags** — "−38% · pacing dips · 0:21", "Cross-niche leaves · 0:03". Each names *who + why + the frame*.
- **Kill all 5 `TapPopover` variants** (CellContent/MarkerContent/ClusterContent/CurvePointContent/FixChipContent) — surface the info inline instead.
- The 0:21 drop frame in the strip gets a coral outline + ⚠.

### Zone ③ — "Who's watching" (reason-first; 10 personas → 4 groups)
- Fold the 10 persona rows into the **4 slot-type groups**: New viewers (FYP) / Your niche / Loyal fans / Cross-niche.
- Each group row: name + segment label, mini retention **sparkline**, **one-line reason** (surface the currently-hidden `persona_simulation_results[].reasoning` / `segment_reasons`), group **retention %** (color: hi=green, lo=coral).
- Relocate the **`⚖ Audience mix`** control here (the old WeightOverrideDrawer; keep the slider/preset behavior + client recompute).
- Mobile hides sparkline + reason columns to stay clean (still shows name + %).

### Approach (DECIDED)
- **Sketch-first** ✅ done → **build zone-by-zone in real components** with screenshots at each step.

---

## 3. THE MOCKUP (approved, with refinements pending)

- File: **`.playwright-mcp/audience-mockup.html`** (gitignored, persists on disk).
- Serve + view:
  ```bash
  cd /Users/davideloreti/virtuna-v1.1/.playwright-mcp && python3 -m http.server 8099
  # → http://localhost:8099/audience-mockup.html  (desktop frame left, mobile right)
  ```
- **User said "looks way better" + wants refinements.** Known rough spots to fix when building:
  1. **Drop-flag placement** — the two flags in zone ② overlap the curve + benchmark line. Use leader lines into clear space, or a reserved annotation lane above the curve.
  2. **Shorten "Biggest drop-off"** — wraps to 2 lines on desktop.
  3. Keyframes are gradient placeholders in the mock; real ones come from the now-fixed pipeline.
  4. (Solicit the user's other refinements — they said "some refinements I want to make" but we paused before listing them. **Ask first.**)

---

## 4. COMPONENT INVENTORY (files to touch for the build)

Dir: `src/components/board/audience/`
| File | Role now | Redesign action |
|---|---|---|
| `AudienceNode.tsx` | container, state, event routing | recompose into 3 zones; remove popover state |
| `HeadlineChips.tsx` | WATCH/LOOP/DROP/HOOK/VS NICHE + Weighted badge | → zone ① diagnostics, renamed/benchmark-led; drop Weighted badge |
| `RetentionCurve.tsx` + `use-retention-curve-canvas.ts` | canvas curve + markers | zone ② hero; add benchmark line; remove dot-markers |
| `Filmstrip.tsx` | keyframe strip | fuse under curve, time-aligned |
| `DropoffMarkers.ts` | clustered persona-swipe dots | replace with inline drop flags |
| `HeatmapDrawer.tsx` + `PersonaRow.tsx` | 10-row orange grid | → zone ③ 4 audience-type groups, reason-first |
| `TapPopover.tsx` | 5 popover variants | **delete** (info goes inline) |
| `PersonaDetailInline.tsx` | per-persona detail | fold into group expand or remove |
| `WeightOverrideDrawer.tsx` | mix sliders + presets | relocate to zone ③ as `⚖ Audience mix` |
| `AntiViralityOverlay.tsx` | warning border + fix chips | keep; fix chips become inline flags |
| `use-audience-choreography.ts` | row/curve animation FSM | adapt to group rows |
| `use-client-weights.ts` | slider→curve recompute | keep |
| `audience-types.ts` / `audience-constants.ts` | types/colors | extend for groups/flags |

Mobile reuses the same nodes via `BoardMobile.tsx` → `MobileFrameCard.tsx` (camera `{0,0,1}`).

---

## 5. DATA MODEL REFERENCE (what the engine already produces)

Types in `src/lib/engine/types.ts`:
- `HeatmapPayload` (27-58): `segments[]` {idx, t_start, t_end, label, is_hook_zone, keyframe_uri}, `personas[]` {id, slot_type, archetype, attentions[], swipe_predicted_at, segment_reasons}, `weights`, `niche_completion_pct`, `vs_niche_diff_pct`, `weighted_curve`.
- `BehavioralPredictions` (576-592): completion/share/comment/save `_pct` + `_percentile`, optional `loop_pct`/`loop_percentile`.
- `PersonaSimulationResult` (624-639): `reasoning`, `watch_through_pct`, `scroll_past_second`, `comment_intent`, `share_intent`, `save_intent`, `rewatch_intent`.

**UNSURFACED data to exploit for "wow"** (exists, not shown):
- `persona_simulation_results[].reasoning` ← the *why* (zone ③ reasons).
- per-persona intents (save/share/comment/rewatch), `watch_through_pct`, `scroll_past_second`.
- `segments[].label` (visual event label — only in aria today).
- niche benchmark for the ghost line.
- (Input-owned, don't dup: predicted_engagement absolute numbers, factors, suggestions.)

---

## 6. INFRA / RESUME CHECKLIST (background procs die between sessions)

- Dev server: `npm run dev` → http://localhost:3000  (Next 15 + turbopack).
- Mock server: `cd .playwright-mcp && python3 -m http.server 8099`.
- Test board permalink used for verification: `/analyze/z05dIjbz4v4W` (has real data). Card mode: `localStorage.setItem('virtuna-board-view-mode','cards')`.
- Run checks: `npx tsc --noEmit -p tsconfig.json` · `npx eslint <files>` · `npx vitest run src/components/board` · `npx vitest run 'src/app/api/analyze/__tests__/stream-route.test.ts'`.
- Raycast tokens (CLAUDE.md): bg #07080a, frame #18191a, coral #FF7F50, 6% borders / 10% hover, 12px frame radius, Inter.

## 7. IMMEDIATE NEXT STEPS (fresh session)
1. (Optional) commit the keyframe fix (§1) before HEAD drifts.
2. **Ask the user for their specific refinements** to the mockup (they have some in mind).
3. Apply refinements to `.playwright-mcp/audience-mockup.html`, re-confirm.
4. Build zone-by-zone in real components (① → ② → ③), screenshot each, run tests.
5. Verify keyframes live with a real analysis run.
