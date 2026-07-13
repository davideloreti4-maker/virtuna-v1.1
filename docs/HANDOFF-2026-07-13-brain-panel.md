# Handoff — The Brain panel (Room's 3rd scale) · 2026-07-13

**Worktree:** `~/virtuna-brain` · **Branch:** `feat/audience-brain-panel` (off `origin/main`, unpushed)
**Commits:** `3c28a1a1` (first cut) → `3eccb5b3` (rebuild vs TRIBE v2)
**Status:** 🟡 FUNCTIONALLY DONE, VISUALLY REJECTED. Owner UAT (2× now): *"doesn't look like a real
brain / a real process happening — a premium company wouldn't release this."* The next session's
job is a **major visual-fidelity push**, not new features.

---

## 1. What this is

The ambient audience Room (`AmbientRoom`) gained a **third scale, positioned first and made the
landing view**: `The brain ⇄ The people ⇄ Population · 1,000`.

The brain shows a **predicted cortical response** to whatever the room is reacting to, with the
**stimulus playing beside it** — modeled on **TRIBE v2** (Meta FAIR's trimodal brain encoder, winner
of Algonauts 2025).

Two modes, both honest:

| Mode | Where | Stimulus | Drive |
|---|---|---|---|
| `grounded` | Video Read (`ReadingRoom`) | the **real mp4** plays, drives the scan clock | the audience's **MEASURED retention curve** (attention ← who's still watching; salience ← the breaks; default-mode ← who checked out) |
| `simulated` | Dock (hooks/ideas — no video) | the concept **plays word-by-word** on the same clock | a seeded encounter envelope shaped by the one real aggregate (stop ratio) |

Neither claims to have scanned anyone. The labels on-screen say so, and a test pins them.

---

## 2. ⚠️ LICENSING — read before "just adopting TRIBE code"

**TRIBE v2 is CC-BY-NC-4.0 (non-commercial)** and renders on **FreeSurfer-derived fsaverage**
geometry. **Neither can ship in Maven (a commercial product).** Owner explicitly chose (2026-07-13)
to **author our own surface** rather than take the grey-area route.

So: study their *output* freely, copy **nothing**. No code, no weights, no meshes, no atlas files.
Everything under `src/lib/brain/` is ours.

- Paper: https://arxiv.org/abs/2507.22229 · Repo: https://github.com/facebookresearch/tribev2
- **Live demo: https://aidemos.atmeta.com/tribev2/** ← the visual target. It's a JS SPA, so WebFetch
  returns nothing. **Screenshot it with Playwright** in the next session and diff it against ours.

Facts worth keeping: TRIBE v1 predicted **1,000 Schaefer parcels @ TR 1.49s**; v2 moved to the full
**fsaverage5 surface (~20k vertices)** with a **~5s haemodynamic lag**; figures are cortical surface
maps colored by **Pearson r**, with RGB overlays for modality contributions.

---

## 3. What's built (all green)

```
scripts/generate-cortex-geometry.mjs   BUILD-TIME. Hand-authored cortical outlines → Poisson seeds →
                                       4× Lloyd relaxation → Voronoi → 424 parcels over lateral+medial
                                       views, assigned to the 7 Yeo networks + a medial wall.
                                       Deterministic (seeded). d3-delaunay is a devDependency, NEVER bundled.
                                       Run: node scripts/generate-cortex-geometry.mjs
src/lib/brain/cortex-geometry.json     Its output (55KB, committed).
src/lib/brain/cortex-sim.ts            The model: per-network neural drive → canonical double-gamma HRF
                                       → predicted BOLD per parcel. Pure + deterministic (SSR-safe).
src/components/audience-lens/BrainView.tsx   The render.
src/components/audience-lens/AmbientRoom.tsx `brainSource` prop + the 3rd segment (brain = landing view).
src/components/reading/reading-room.tsx      Supplies the GROUNDED source (real video + real curve).
src/app/(app)/dev/cards/page.tsx             The Room section — the visual gate (see §5).
```

Tests: `src/lib/brain/__tests__/cortex-sim.test.ts` (the HRF lag, retention-tracking, no-speckle,
determinism) + `src/components/audience-lens/__tests__/brain-view.test.tsx`.
**257 tests green · tsc 0 · eslint clean on every file touched.**
(Pre-existing, NOT mine: 4 `set-state-in-effect` in `audience-presence.tsx`, 2 in `AmbientRoom.tsx`.)

### Design decisions that must survive the redesign

- **Diverging map on the task-positive / default-mode axis.** A real anticorrelation. Engaged cortex
  → sage; the default-mode system (mind-wandering = the audience you're losing) → **coral**. This is
  what lets the LOCKED accent-dosage rule hold without an exception. **Do not** introduce a
  red/yellow "hot" colormap that makes coral mean "good".
- **Thresholded** (`ACTIVATION_THRESHOLD = 0.42`): most of the cortex sits at baseline gray; only
  parcels clearing threshold get painted. Colouring every parcel = stained glass.
- **Spatially smooth parcel bias** → contiguous clusters. Per-parcel randomness = salt-and-pepper
  speckle, the clearest tell of a fake map. Pinned by a test.
- **The HRF lag is real** (peaks ~5s), because the UI *claims* it on screen. Pinned by a test.

### Two bugs already found (don't regress them)

1. The looping simulated stimulus sat **dead** ("quiet/flat/cold" forever) — the HRF was integrating
   backwards past `t=0` into pre-stimulus rest. Its drive must be **periodic**. Test pins it.
2. Meters **pegged at 1.00** — a saturated network says nothing. Gain cut to 1.12, drive retuned
   around the HRF's low-pass.

---

## 4. 🎯 THE JOB: why it still looks fake, and how to fix it

Current render = flat 2D Voronoi cells with a fake per-parcel "curvature" gray. Ranked by how much
each defect costs us:

1. **It's flat. A real brain reads as a 3D volume.** TRIBE renders a lit, inflated 3D surface with
   real shading. Ours has no normals, no light, no ambient occlusion — so it reads as a *leaf* or a
   *potato*. **Biggest single win.** Options, cheapest first:
   - Pre-compute a per-parcel **surface normal** in the generator (treat the outline as the silhouette
     of an ellipsoid; N = f(x,y)) → Lambert shade the base gray + add a rim/ambient-occlusion darkening
     near the outline. Pure data change + fill math; no new runtime deps.
   - Or go real: a parametric 3D cortical mesh, projected with lighting. Heavier, best fidelity.
2. **Visible cell edges.** Real maps are smooth **per-vertex** heat (20k vertices), not ~200 chunky
   polygons. Fix by either (a) an SVG `feGaussianBlur` over the parcel layer *inside* the clip — cheap,
   kills the mosaic instantly; or (b) render to `<canvas>` with RBF/IDW interpolation between parcel
   centroids; or (c) raise parcel count to ~2–4k (watch perf: fills currently update at TR/4 = 372ms).
3. **Only 2 views.** Real figures show **4**: LH+RH × lateral+medial. Ours is left-hemisphere only.
4. **The silhouettes are weak.** The lateral outline lost its temporal lobe to Chaikin over-smoothing.
   Re-author the control polygons (`LATERAL_CTRL` / `MEDIAL_CTRL`) with a real sylvian notch, and
   drop to 2 Chaikin iterations so the anatomy survives.
5. **No scientific chrome.** A real figure has a colorbar with **numeric ticks and a unit**
   ("predicted BOLD (z)" / "Pearson r"), a network legend, and often a **timeseries plot** (predicted
   vs. observed) under the brain. The TRIBE demo shows a per-network timeseries scrolling with the
   video — we dropped our traces in the rebuild and the panel got less "instrument-like" as a result.
6. **The process isn't legible.** Owner wants it to look like *a real process happening*. Consider: a
   TR tick indicator that visibly steps, a scrolling timeseries, a "hemodynamic lag" ghost showing the
   stimulus position vs the response position, per-network timecourses.

**First move for the next session:** Playwright-screenshot https://aidemos.atmeta.com/tribev2/ and
put it side by side with `/dev/cards#room`. Diff them honestly, then attack the list above in order.

---

## 5. How to run / verify (this is all proven)

```bash
cd ~/virtuna-brain
# .env.local is copied from the trunk (gitignored). If missing: cp ~/virtuna-v1.1/.env.local .
NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3400
```

- **Visual gate: http://localhost:3400/dev/cards#room** — the Room section mounts the REAL
  `<AmbientRoom>` twice: left = simulated (text stimulus), right = **grounded** (real video).
- ⚠️ `/dev/cards` is **auth-walled** (307 → `/login`). Seeded test user:
  `e2e-test@virtuna.local` / `e2e-test-password-2026` (`npx tsx e2e/create-test-user.ts` to (re)make).
- ⚠️ The grounded preview's mp4 is `public/dev/sample-video.mp4` — a **gitignored local dev asset**
  (copied from `~/Downloads/TikTok Video Downloader.mp4`). Blank on a fresh clone; that's fine.
- ⚠️ **The dev server dies between sessions.** Always re-check `curl -s -o /dev/null -w "%{http_code}"
  http://localhost:3400/login` before telling the owner to preview.
- Tests: `node ./node_modules/vitest/vitest.mjs run src/lib/brain/ src/components/audience-lens/`
  (`npm test` prints fake results — see the vitest-rtk-shim memory).
- Screenshots: Playwright MCP **hangs** on this app (ambient animations never settle). Use raw
  Playwright with `animations: 'disabled'`, importing by absolute path:
  `await import('/Users/davideloreti/virtuna-brain/node_modules/playwright/index.mjs')`.
  Working scripts from this session are in the session scratchpad (`shot-brain2.mjs`, `measure.mjs`).

---

## 6. Open decisions for the owner

- **Where the brain lives** is settled: dock (simulated) + video Read (grounded). Shipped.
- **Not yet asked:** should the brain ever become *actually* engine-grounded (a real encoder), or stay
  an honest model over retention? Today it is the latter, and labeled as such.
- Nothing is pushed. No PR yet. Owner has not approved a push.
