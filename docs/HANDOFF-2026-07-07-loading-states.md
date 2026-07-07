# Handoff — Premium loading states + cleaner thread model (2026-07-07)

**Worktree:** `~/virtuna-explore-a` · **Branch:** `lane/explore-a` · **Dev:** `:3001`
**Status:** ✅ shipped to `main` (see PR link in the merge commit). Nothing left open on this thread.

## What shipped

A full rework of the in-thread skill loading experience (the most-watched surface) to a
Perplexity/Claude-grade rhythm, plus a cleaner generated-card layout. All 5 skill surfaces
(hooks, ideas, script, remix, explore).

### 1. Real per-phase progress (the big one)
The routes used to emit `Generating: active`, run the **entire pipeline in one opaque await**,
then burst every remaining stage done at the end — so the spine hung on "Generating" then flashed.
Fixed by threading an **`onStage` callback** through every runner, firing at the **real await
boundaries**, and rewiring routes to stream them live (no more end-of-run burst).

- `src/lib/tools/runners/{hooks,ideas,script,remix}-runner.ts` — new optional
  `onStage?: (name, status) => void` on each `*PipelineInput`; called around the real phases.
- `src/app/api/tools/{hooks,ideas,script,remix/run}/route.ts` — pass
  `onStage: (name, status) => send("stage", {name, status})`; deleted the manual stage burst.
- **Dropped the fictional "Self-judge" step** (removed from the engine in S3′ — it had no real
  duration and caused the wait-then-flash). Real plans now in `STAGE_PLANS`:
  - hooks/ideas: `Generating → Simulating your audience → Ranking`
  - script: `Generating → Simulating your audience`
  - remix: `Resolving → Decoding → Adapting → Simulating your audience`
  - explore: `Pulling outliers → Scoring for your audience`
- Honesty spine (D-02) preserved: every transition fires at a true boundary, never a fake timer.

### 2. Premium spine UI (`src/components/thread/progress-checklist.tsx`)
- **Seeded plan up front** (`plan` prop + `STAGE_PLANS`): the whole pipeline is visible from frame
  1 (current step active, rest pending ahead) — legible roadmap, not a lone spinner.
- **Morphing node**: one persistent element that transitions pending→active→done (color/fill/
  opacity) instead of hard-swapping 3 elements. Calm `stage-breathe` on the active dot.
- **Shimmer** on the active step label (`text-shimmer` in globals.css) — the "working now" cue,
  cream-toned, matte, reduced-motion safe.
- **Rotating sub-copy** (`STAGE_COPY_ROTATION`): the active step cycles honest sub-phases every
  ~2.6s with a soft fade (e.g. Simulating → "Reacting with your 10 reactors" → "Weighing
  stop-scroll against skip" → "Collecting their verbatim reactions").
- **`SkillProgress`** component owns the lifecycle: live spine while streaming → **collapses to a
  receipt** on completion (`✓ Ran your audience · N steps ▾`), expandable to a clean compact
  checklist. Receipt only shows for a live run (ephemeral stages; rehydrate → nothing).

### 3. Cleaner thread model
- Removed the big `SkillResultCard` wrapper ("Hooks · General" box + "New hooks" label) around
  generated cards — cards now render **bare** directly in the assistant turn.
- Generated-card background → `#1a1a19` via `bg-surface-sunken` (`hook/idea/script/remix-card-block.tsx`).
- Result content reveals **after** the spine (`reading-reveal`, gated on `!isStreaming`) — never
  mid-generation. The intent line types out (`WordFade`, `conversational-frame.tsx`).

### Bug fixed along the way
`var(--color-cream)` **does not exist** (real token: `--color-cream-primary`) — done-node fills
resolved to transparent, so completed checks rendered as hollow rings. Fixed in progress-checklist.tsx.

## Verification
- `tsc --noEmit` clean · eslint clean on all changed files
- `node ./node_modules/vitest/vitest.mjs run src/components/thread src/lib/tools/runners reading/__tests__/reskin-matte.test.ts` → **184 pass**
- New test: `src/components/thread/__tests__/progress-checklist.test.tsx` (seeded-plan behavior)
- Live-verified on `:3001` with real hooks/ideas runs (owner confirmed timing "way better")

## Notes for next session
- A dev-only `/loading-preview` route existed during this work and was **removed before merge**
  (didn't want an unlinked route live in prod). Recreate from git history of this branch if you
  want the design sandbox back — it rendered the real `ProgressChecklist`/`SkillProgress` across
  all skills + an end-to-end rhythm demo.
- The `stage.detail` seam is still open: when the engine can stream a **true live** per-stage
  status, `onStage` could pass a 3rd arg → `StageState.detail` overrides the rotating copy.
- Run `pnpm`/npm test broadly if touching runners — the `onStage` calls are the only new
  behavior and are optional/no-op, so existing runner tests were unaffected.
- Dev server launch: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3001` (direct node, not npx).
