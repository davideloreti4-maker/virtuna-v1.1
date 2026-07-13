# Handoff — The Brain panel (Room's 3rd scale) · 2026-07-13

**Worktree:** `~/virtuna-brain` · **Branch:** `feat/audience-brain-panel` (off `origin/main`, unpushed)
**Commits:** `3c28a1a1` (first cut) → `3eccb5b3` (rebuild vs TRIBE v2) → **`ab24b599` (the folded 3D cortex)**
**Status:** 🟢 REBUILT AS A REAL SURFACE, AWAITING OWNER UAT (round 3). Rejected twice before for
looking fake; the object itself has now been replaced. Not pushed, no PR — owner has not approved one.

---

## 1. What this is

The ambient audience Room (`AmbientRoom`) has a **third scale, positioned first and made the landing
view**: `The brain ⇄ The people ⇄ Population · 1,000`.

It shows a **predicted cortical response** to whatever the room is reacting to, with the **stimulus
playing on it** — modeled on **TRIBE v2** (Meta FAIR's trimodal brain encoder, Algonauts 2025).

Two modes, both honest:

| Mode | Where | Stimulus | Drive |
|---|---|---|---|
| `grounded` | Video Read (`ReadingRoom`) | the **real mp4** plays, drives the scan clock | the audience's **MEASURED retention curve** (attention ← who's still watching; salience ← the breaks; default-mode ← who checked out) |
| `simulated` | Dock (hooks/ideas — no video) | the concept **plays word-by-word** on the same clock | a seeded encounter envelope shaped by the one real aggregate (stop ratio) |

Neither claims to have scanned anyone. The labels say so on screen, and a test pins them.

---

## 2. ⚠️ LICENSING — unchanged, still binding

**TRIBE v2 is CC-BY-NC-4.0 (non-commercial)** and renders on **FreeSurfer-derived fsaverage**
geometry. **Neither can ship in Maven.** Owner chose (2026-07-13) to author our own surface.

Study their *output* freely, copy **nothing**. No code, no weights, no meshes, no atlas files.
Everything under `src/lib/brain/` is ours: an ellipsoid sculpted by hand-tuned constants, gyrified
by our own Perlin field.

- Paper: https://arxiv.org/abs/2507.22229 · Demo: **https://aidemos.atmeta.com/tribev2/**
- The demo is a JS SPA — WebFetch returns nothing. **Drive it with Playwright.** It also throws a
  cookie wall that intercepts clicks; remove the `position:fixed; z-index>=100` divs from the DOM
  rather than trying to click "Decline".

---

## 3. What the TRIBE diff actually showed (done this session, don't redo it)

Screenshotted their demo and ours side by side. **One thing** makes theirs read as an organ: a big,
near-white, deeply **FOLDED**, lit 3D cortex on black. Everything else on their screen is chrome.

Two claims in the previous handoff were **wrong**, and cost nothing to drop:

- ❌ *"only 2 views, real figures show 4"* — their own demo shows **ONE** brain. Views are not the problem.
- ❌ *"they show a scrolling per-network timeseries"* — there is **no timeseries anywhere** in their demo.
  They have a colorbar (`Low → High · Activity`) and mode toggles. Nothing more.

What was right: flat / visible cell edges / weak silhouette — and all three dissolve into a single
fix, which is to stop drawing polygons and draw a folded surface. Also missed by that list: our
value structure was inverted (mid-gray on mid-gray, where theirs is a white specimen on black), and
our brain was two ~200px thumbnails where theirs is one hero object.

---

## 4. What's built now

```
src/lib/brain/cortex-mesh.ts        THE SURFACE. A 40k-vertex folded hemisphere, built at RUNTIME
                                    from pure math (memoized per seed, ~40ms). Ellipsoid → brain
                                    profile (anterior notch, temporal pole, sylvian fissure) →
                                    gyrified by our Perlin fold field → normals recomputed from the
                                    FOLDED mesh (this is what lets light see the folds) → 340 parcels
                                    (farthest-point) → per-vertex smooth blend weights.
                                    Also exports `surfaceValues()` (the signed per-vertex field) so
                                    the map math is testable headlessly.
                                    NOT baked to JSON: it would be ~500KB. It is cheaper to compute.
src/lib/brain/cortex-sim.ts         THE MODEL (unchanged in structure): per-network neural drive →
                                    canonical double-gamma HRF → predicted BOLD. Only the CONTRAST
                                    was retuned — see §5.
src/components/audience-lens/CortexCanvas.tsx   THE RENDER. three + @react-three/fiber (already
                                    dependencies, previously unused by any source file), lazy via
                                    next/dynamic `ssr: false`. Custom shader: Lambert + sulcal
                                    ambient occlusion + rim light, with the thresholded diverging map
                                    painted ON the anatomy, not replacing it.
src/components/audience-lens/BrainView.tsx      The panel. Cortex is now the hero (full width, 4:3);
                                    the stimulus is a PiP on it. Chrome (colorbar, meters, readout,
                                    verdict, honesty line) is unchanged.
scripts/preview-cortex.ts           DEV TOOL. Rasterizes the mesh to a PNG in ~1s with the SAME
                                    lighting model as the shader. `npx tsx scripts/preview-cortex.ts
                                    out.png` (env: T=, YAW=, PITCH=). Use this to tune anatomy —
                                    it is 100× faster than a dev-server + Playwright round trip.
scripts/dev-shot-brain.mjs          Drives a real browser at /dev/cards#room and shoots the panel.
```

**Deleted:** `scripts/generate-cortex-geometry.mjs` + `src/lib/brain/cortex-geometry.json` (the old
Voronoi surface — dead). `d3-delaunay` is now an unused devDependency; left in `package.json`
deliberately (config change, owner's call).

### The four invariants — ALL still hold, all still pinned by tests

- **Diverging** on the task-positive / default-mode axis (a real anticorrelation). Engaged → sage,
  the default-mode system (mind-wandering = the audience you're losing) → coral. This is what lets
  the LOCKED accent-dosage rule hold with no exception. **No red/yellow "hot" colormap.**
- **Thresholded.** Most of the cortex sits at bare anatomy.
- **Spatially smooth.** No speckle, no parcel edges.
- **The HRF lag is real** (peaks ~5s), because the UI claims it on screen.

---

## 5. 🔬 The bugs that measurement caught (and eyeballing would not have)

Each of these had **silently rebuilt the very mosaic the rewrite existed to remove.** If you touch
the blending or the colour ramp, re-run the probes before trusting your eyes.

1. **The blend kernel collapsed to nearest-parcel.** An inverse-distance kernel (`w = 1/d²`) is so
   peaked that a vertex just *takes* its nearest parcel's value — so adjacent vertices jumped a full
   **1.0** where a task-positive parcel abutted a default-mode one. The hard edges were still there,
   in a "smooth" field. **Any kernel whose bandwidth is set by the nearest neighbour fails the same
   way.** Fix: a FIXED bandwidth (`BLEND_R = 0.26`, ~2 parcel widths) that decays to exactly zero at
   its edge, with `BLEND_K = 24` > the ~18 parcels inside that radius (or the kernel truncates, and
   *which* parcels get cut flips between adjacent vertices — same discontinuity, different hat).
2. **Parcels seeded only on the visible face.** The whole medial wall then fell outside the blend
   radius, where the kernel degenerated to nearest-parcel. Seed the **whole closed surface** (340).
3. **The curvature smoothstep SATURATED.** Everything clear of a sulcus clamped to exactly 1.0 →
   large perfectly **flat plateaus** → a conspicuous smooth panel across the middle of the render,
   the single clearest "this is generated" tell. Gyral crowns are *rounded*: carry a non-saturating
   term alongside the crease term.
4. **The colour ramp washed out.** It ran threshold→1.0, but predicted BOLD lives at **0.55–0.85**
   after the HRF (a low-pass), so every real response sat stranded at the pale end. Fix:
   `ACTIVATION_SPAN = 0.30` — ramp over the values that actually occur. Also widened the parcel bias
   (`0.35–1.40`, was `0.78–1.28`): a narrow band puts every parcel on the same side of the threshold
   at once, so the whole cortex tints uniformly instead of forming clusters.

**Why the smoothness test is a GRADIENT test.** The map is *allowed* to swing hard from sage to
coral at a network border. What it may never do is **step**. A hard parcel edge is a step change over
~zero distance — an unbounded gradient. A raw-delta bound conflates the two and fails an honest map.
Measured now: mean ≈ 1.0, max ≈ 9. The broken kernels ran past 50.

---

## 6. How to run / verify

```bash
cd ~/virtuna-brain
# .env.local is copied from the trunk (gitignored). If missing: cp ~/virtuna-v1.1/.env.local .
NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3400
```

- **Visual gate: http://localhost:3400/dev/cards#room** — mounts the REAL `<AmbientRoom>` twice:
  left = simulated (text stimulus), right = **grounded** (real video).
- ⚠️ `/dev/cards` is **auth-walled** (307 → `/login`). Seeded test user:
  `e2e-test@virtuna.local` / `e2e-test-password-2026` (`npx tsx e2e/create-test-user.ts` to remake).
- ⚠️ The grounded preview's mp4 is `public/dev/sample-video.mp4` — a **gitignored local dev asset**.
  Blank on a fresh clone; that's fine.
- ⚠️ **The dev server dies between sessions** (and dies if you `git stash` under it). Always
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:3400/login` before telling the owner to look.
- **Screenshots:** Playwright MCP **hangs** on this app (ambient animations never settle) and WebGL is
  invisible to jsdom/happy-dom anyway. Use `OUT=<dir> node scripts/dev-shot-brain.mjs`.
- ⚠️ **Don't trust `gl.readPixels` to prove the canvas painted** — WebGL clears its drawing buffer
  after compositing, so it reads empty without `preserveDrawingBuffer`. The probe in
  `dev-shot-brain.mjs` reports `coverage: 0` for this reason. **Look at the screenshot.**
- Tests: `node ./node_modules/vitest/vitest.mjs run src/lib/brain/ src/components/audience-lens/`
  (`npm test` prints fake results — see the vitest-rtk-shim memory).

**State at commit `ab24b599`:** 91 brain tests green · tsc 0 · eslint clean on every file touched.
Full suite: 3367 pass, **1 pre-existing failure** (`api/tools/remix/run` SSE route — verified it
fails identically on the tree *without* these changes; not ours).
Pre-existing, not ours: `set-state-in-effect` lint errors in `audience-presence.tsx` + `AmbientRoom.tsx`.

---

## 7. Open decisions for the owner

- **Round-3 UAT is the gate.** Does the cortex now read as a real brain / a real process?
- **Deliberately NOT built** (owner scoped this session to the object only): per-network timeseries,
  a stepping TR tick, an HRF-lag ghost. Worth noting TRIBE's own demo has **none** of these — they
  are not why theirs reads as real.
- If it still falls short, the next lever is **fidelity of the fold field** (the gyri are a little
  more "coral-like" and less ribbon-like than a real cortex) and **brightness** (TRIBE's cortex is
  near-white; ours is a dimmer cream to sit on the charcoal panel).
- **Not yet asked:** should the brain ever become *actually* engine-grounded (a real encoder), or stay
  an honest model over retention? Today it is the latter, and labeled as such.
- **Nothing is pushed. No PR.** Owner has not approved one.
