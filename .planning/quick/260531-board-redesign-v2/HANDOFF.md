---
handoff: board-redesign-v2
date: 2026-05-31
branch: feat/actions-frame-inline-redesign
status: SHIPPED to branch (committed + pushed) · follow-ups remain
model_policy: Opus 4.8 for ALL work incl. execution agents
---

# Board Redesign v2 — Session Handoff

Read this top-to-bottom to resume cold. Design contract lives in `./PLAN.md` (same dir). Persistent note: `~/.claude/projects/-Users-davideloreti-virtuna-v1-1/memory/board-redesign-v2.md`.

## 1. What this was
Second rework of the prediction **board** (the results view after a video is analyzed). User felt the prior board was "too busy / doesn't feel premium." Root cause: every frame rolled its own cards/bars/charts → visual divergence. Fix = one shared design language + ruthless hierarchy, extracted from analytics refs (TikTok, YouTube, Instagram, Stripe, Linear, **Artificial Societies** = the north star — same product category, dark + single accent + persona node-graph).

**Locked decisions (user-approved):**
- Every frame = **Hero + tile-row + tabbed depth**.
- All 5 frames redesigned in parallel, on top of a shared kit built first.
- Audience hero = **Artificial-Societies persona node-graph**; retention curve → a tab.
- Accent rule: **coral is the only accent**; reserved for the one thing to act on (weak link). Deltas use green/red, not coral.

## 2. Current state — DONE & on the branch
**7 atomic commits `3a5de50..99d6c6c`, pushed to `origin/feat/actions-frame-inline-redesign`:**
```
3a5de50 feat(board): shared design-system kit — hero, tiles, tabs, trend, persona graph, keyframes
239cfec feat(board): redesign Score frame to hero + tiles + tabs
1090698 feat(board): redesign Audience — persona node-graph hero + drop keyframes
0bca80b feat(board): redesign Actions — one-move hero + per-fix keyframes
709ecb4 feat(board): redesign Input+Engine — Top% hero, tiles, calm stepper, video poster
87bb66c feat(board): refine Content craft to kit — pillar tiles + keyframe strip
99d6c6c chore(board): dev design-language preview + redesign plan
```
Note: a `.githooks/post-commit` hook auto-pushes after every commit (project convention). `core.hooksPath=.githooks`.

**Verification (all green):** board suite **375/375** · `tsc` clean (only pre-existing `predict-sweep.ts` errors, unrelated) · `next build` clean · ESLint **0 errors** (5 pre-existing `_camera`/`_layout` warnings — every frame's signature, not new).

Re-run:
```bash
npx vitest run src/components/board
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v predict-sweep.ts
npm run build
npx eslint src/components/board/_kit src/components/board/{verdict,audience,actions,content-analysis,input} src/components/board/{InputResultCard,EngineGroup}.tsx
```

## 3. The shared kit — `src/components/board/_kit/`
The keystone. All frames import from `_kit/index.ts`. 21 tests in `_kit/__tests__/kit.test.tsx`.
- **`Delta`** — ▲/▼ + green/red; `dir='auto'`, `invert` (down=good).
- **`FrameHero`** — `{ label, prefix?, value?, unit?, delta?, status?{word,tone}, insight?, children? }`. `children` slot = custom hero visual (Audience passes PersonaGraph). `prefix` = small lead-in (e.g. "Top").
- **`StatTile` / `StatTileRow`** — caps label · big tabular value · optional delta. Grid: 2 tiles→2-up, 3→3-up, 4→2-up `@[420px]:`4-up (container query — needs width-constrained parent). Labels wrap (no truncate). `tone:'accent'` = coral highlight.
- **`FrameTabs` / `FrameTabPanel`** — underline-style tabs on raw Radix (the shared `ui/tabs` is pill-styled).
- **`TrendChart`** — recharts area; current=coral line+fill, previous=dotted muted. `isAnimationActive={false}`.
- **`MiniSparkline`**, **`DataTable`** — table primitives.
- **`PersonaGraph`** — SVG persona node-cloud (golden-angle deterministic layout, seeded `mulberry32` — SSR-safe), starfield + nearest-neighbour links, hover glass card, `reducedMotion` kills the `<animate>` pulse, sr-only mirror list. `PersonaNode = {id,label,weight,watchThrough,segment?,dropAt?,tone?}`.
- **`KeyframeImage`** — real `<img>` (signed URLs, plain img not next/image) with energy grade + **filmic fallback gradient** on error/no-src. Props: `src, ratio('vertical'|'square'|'wide'), energy, label, timecode, badge, play, marked, fallbackScene`.
- **`keyframe.ts` → `resolveKeyframeUrl(filmstrips, segments, target)`** — pure. `target='first'`|ms. **Units: segments `t_start/t_end` = SECONDS; fix timestamps = MS; filmstrips = `Record<number,string>` (segment idx → signed URL).**

## 4. Per-frame changes (what each became)
Each frame keeps its data hooks (`useAnalysisStream` + `usePermalinkAnalysis`) + derive helpers; only presentation re-composed. Sub-components (FactorBars, ScoreDistribution, RetentionChart, CraftFilmstrip, etc.) largely kept, restyled to tokens.
- **Score** `verdict/` — hero=overall_score/100 + niche delta + band status (crit if anti-virality gated, folds AV header + top-fix into hero); tiles=Share/Completion/Comment/Save percentiles; tabs=Breakdown(FactorBars+SignalTiles) / Distribution(ScoreDistribution) / History(VsHistory, only if prior). Added selectors in `verdict-derive.ts`.
- **Audience** `audience/` — hero=`PersonaGraph` + overlaid watch-through % + status; tiles=Niche completion/Finishing/Biggest drop; tabs=Retention(curve) / Who leaves(SegmentTable+cohort keyframes) / Mix(weight override). **NEW `DropStrip.tsx`** = "Where they drop" keyframe row. `audience-derive.ts` adds `buildPersonaNodes`, `buildDropMoments`, `cohortDropFrame`.
- **Actions** `actions/` — hero=one move verb (tone by band); best-time card; fix rows each with a keyframe at its timestamp. `ActionsNode` sources filmstrips; `actions-derive.ts` adds `deriveActionsHero`/`deriveActionsRows`. All view-kinds share one layout.
- **Input+Engine** — `InputResultCard.tsx` hero="Top X%" (prefix/value/unit, `useCountIn`) + percentile tiles + **9:16 video poster** (self-sourced first keyframe, no Board.tsx change); `EngineGroup.tsx` = calm Linear-style stepper; new `src/components/board/input/` (`input-derive.ts`, `EngineStepper.tsx`).
- **Content craft** `content-analysis/` — `CraftFilmstrip` hero kept (real keyframes already); `CraftRail` bars → `StatTileRow` pillar tiles (weak link = coral).

## 5. Keyframes (the "show the video" work)
Wired live in all frames via `resolveKeyframeUrl` + `KeyframeImage`. **Every placement is GATED on real video** (`Object.keys(mergedFilmstrips).length > 0`) — text/tiktok-url modes render exactly as before, no broken placeholders. filmstrips sourced via `useAnalysisStream().filmstrips` merged with `usePermalinkFilmstrips()` (the `ContentAnalysisFrame` pattern). Proven by tests (frames appear with filmstrips, vanish without).
- Content = real `<img>` filmstrip (was already there). NEW: Input poster, Actions per-fix thumb, Audience DropStrip + cohort thumbs.

## 6. Dev preview route — `src/app/(marketing)/board-preview/page.tsx`
Design-language showcase using **faux gradient stills** (`FilmCell`/`VideoPoster` — preview-only; the live frames use the real `KeyframeImage`). It does NOT use live data/hooks (renders the kit with representative inline data). Run: `PORT=3100 npm run dev` → `localhost:3100/board-preview`. **MUST env-gate or delete before merging to main** (it's publicly routable under the `(marketing)` group). Screenshots from this session live in `.playwright-mcp/` (`r2-*`, `r3-*`, `r4-*`).

## 7. CRITICAL constraints / gotchas
- **Opus 4.8 for ALL work** including spawned agents (override the CLAUDE.md sonnet-for-executors routing).
- **Cannot screenshot the authed `/analyze/[id]` board** (auth-blocked — known). The `/board-preview` route is the only self-serve visual surface. So the live keyframe wiring is **test-verified only**.
- Frames are **world-space px** scaled by camera (`GroupFrameOverlay`); use px sizing.
- **Do NOT bundle** the pre-existing uncommitted work in the tree: `src/lib/engine/*`, `src/app/api/analyze/route.ts`, `scripts/measure-pipeline.ts`, `.planning/*.md` handoffs, loose `*.png` sketches. Those belong to other efforts — leave them alone.
- Branch is `feat/actions-frame-inline-redesign` (NOT main). Commits auto-push.

## 8. REMAINING WORK (prioritized — pick up here)
1. **Mobile / responsive pass** ✅ VERIFIED 2026-05-31 (kit visually + measured; live nodes structurally). Source audit: every live Node is `w-full` fluid (canvas applies fixed `bounds.width` via `GroupFrameOverlay`; mobile `MobileFrameCard` lets nodes fill ~342px). Kit primitives all fluid — `PersonaGraph` (viewBox + `preserveAspectRatio`), `TrendChart` (`ResponsiveContainer`), `StatTileRow` (`@container`), `InputResultCard` hero+poster (`flex-1` + `w-[60px] shrink-0`), `DropStrip` (`grid-cols-3`). Made `/board-preview` viewport-capping (`maxWidth:'100%'` per Frame + responsive padding) so it's a real mobile QA surface, then measured at 390px via Playwright: **no horizontal overflow** (docScrollWidth 375 ≤ 390, zero offending elements); **4-up tiles correctly fall back to 2-up** (`150px 150px`) below the 420px container query; 3-up stays `97px×3`; PersonaGraph/keyframe strips/charts/hero all reflow. Desktop preview unregressed. Screenshot: `mobile-390-full.png` (repo root). No mobile fixes were needed — components were already fluid. NOTE: live `BoardMobile` path (real Nodes + sub-components SignalTiles/FactorBars/RetentionChart/SegmentTable/CraftFilmstrip) is read-verified fluid + test-covered (375 tests) but its *visual* mobile QA still needs the authed env → folds into item #6.
2. **Reduced-motion + a11y (axe)** ✅ DONE 2026-05-31. Verified wiring end-to-end: `AudienceNode:76` (`reducedMotion = prefersReducedMotion || perfTier==='low'`) → `AudienceHero:241` → `PersonaGraph:59` → gates the `<animate>` at `PersonaGraph:169`. Added 2 kit tests (`_kit/__tests__/kit.test.tsx`): (a) `<animate>` pulse present by default = one per node, stripped to 0 under `reducedMotion` (the contract); (b) SVG `role="img"` + aria-label `/3 .*personas/`. Existing `Board.a11y.test.tsx` axe run on the full Board stays green. `KeyframeImage` alt is decorative `alt=""` (correct). Board suite now **378/378**. NOTE remaining-optional: a *populated-state* axe pass (Board.a11y currently renders idle/empty — PersonaGraph doesn't mount there) would need analysis-result mocking; kit primitive is now axe/role-covered so this is low-value.
3. **Edge/empty/gated states audit** ✅ DONE 2026-05-31. All gates verified by source audit: (a) **keyframe gates hold in text-mode** — Input poster gated on `posterUrl` (null in text mode); Actions `if (hasVideo)` before `resolveKeyframeUrl` (ActionsContent:237, `hasVideo = Object.keys(mergedFilmstrips).length>0`); Audience `dropMoments.length>0 && <DropStrip>` + DropStrip's own null-guard. No broken placeholders. (b) **Score delta omitted w/o niche** — `nicheDelta` returns null when `!niche || !Number.isFinite(niche.median)`; VerdictNode renders `{delta != null && delta !== 0 && …}`; per-metric tile deltas intentionally NOT fabricated (honest). (c) **History tab gated** — `...(analysisId && hasHistory ? [tab] : [])` + matching panel guard; `hasHistory = (comparisons?.history?.length ?? 0) > 0`. (d) **AV gated hero** — `tone:'crit'` → coral (FrameHero TONE_TEXT). (e) **<3 personas** — PersonaGraph lays out any n≥1 (`Math.max(personas.length,1)`). **FIX SHIPPED (commit 78bca69):** added `size?: 'display'|'prose'` to `FrameHero` (`_kit/FrameHero.tsx`); Actions passes `size="prose"` so verb heroes render at 26px instead of 44px. Verified in `/board-preview`: longest verb "Fix before posting" = 217px on ONE line in the 378px frame (`wrapped:false`); fits mobile too (217<~318px). Kit test added (display vs prose size). Board suite **379/379**.
4. **Keyframe interaction**. "tap a frame to jump" (Actions) is **dead copy** — wire click→seek (reuse `TopFixesList`'s existing filmstrip-jump anchor pattern) or soften the copy. Don't ship a dead affordance.
5. **Cleanup**. Env-gate/remove `/board-preview`; delete now-dead exports (`deriveOneMove`, `formatTimestamp`, removed `one-move-banner` in verdict); **document the kit in `BRAND-BIBLE.md`** so future frames reuse it (this is what stops re-divergence — the original "not premium" cause).
6. **Live visual QA** (needs your authed dev env). Open a real completed `/analyze/[id]` and eyeball keyframe poster/thumbnail sizing on real video; confirm streaming/skeleton states look right.

## 9. Quick orientation commands
```bash
git log --oneline -7                       # the 7 commits
git status --short -- src/components/board  # should be clean (all committed)
cat .planning/quick/260531-board-redesign-v2/PLAN.md   # full design contract + per-frame spec
ls src/components/board/_kit                # the shared kit
PORT=3100 npm run dev                       # → localhost:3100/board-preview
```
