# Handoff — The Brain panel (Room's 3rd scale) · 2026-07-13

**Worktree:** `~/virtuna-brain` · **Branch:** `feat/audience-brain-panel` (off `origin/main`, unpushed)
**Commits:** `3c28a1a1` (first cut) → `3eccb5b3` (rebuild vs TRIBE v2) → `ab24b599` (the folded 3D
cortex) → `77814f06` (**round 4 — the card becomes a figure**)
**Status:** 🟡 **ROUND 4 BUILT, AWAITING UAT.** §8's brief is executed — see **§9** for what
actually shipped and what is still open. Not pushed, no PR.

> **Round 3 was 🔴 REJECTED.** Owner: *"the UI design still pretty much looks like shit… not only the
> brain visual, but also the general brain card."* The geometry rewrite was necessary but **not
> sufficient**: the card around the cortex was an undesigned stack of debug rows. §8 is the brief that
> came out of that; §9 is the answer to it.

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

- **Not yet asked:** should the brain ever become *actually* engine-grounded (a real encoder), or stay
  an honest model over retention? Today it is the latter, and labeled as such.
- **Nothing is pushed. No PR.** Owner has not approved one.

---

## 8. 🎯 THE BRIEF — a full makeover of the Brain CARD (next session's only job)

Round-3 UAT killed it again, and the scope widened: **the card, not just the cortex.** Read this
section as the job. Do not open `cortex-mesh.ts` until §8.3 is understood — the mesh is the *last*
thing to touch, not the first.

### 8.1 What the owner is looking at

`/dev/cards#room` renders the panel twice (left simulated, right grounded). Both cards, top to bottom:

```
6 of 10 would stop                          ← serif, big
Stop editing your videos. Do this instead.  ← sans
[ The brain | The people | Population ]     ← default-looking segmented control
PREDICTED CORTICAL RESPONSE ·               ← MONO CAPS, wraps mid-phrase onto 2 lines
SIMULATED                    t=4.1s · TR 1.49s
┌────────────────────────────────────┐
│ [dark PiP box, dim text]  🧠       │      ← the PiP OVERLAPS the brain
│                                    │
│              LEFT HEMISPHERE · LATERAL │  ← MONO CAPS again
└────────────────────────────────────┘
DRIFTING ▮▮▮▮▮▮▮▮▮▮▮▮ ENGAGED               ← crude red→green bar, no ticks, no unit
predicted BOLD · response trails their video by ~5s (haemodynamic
lag)                                        ← centred, wraps to 3 lines, orphan word
● Limbic — feeling & value            0.62
ATTENTION ▮▮▮▮▮▮▮▮░░░░  holding             ← 4 generic progress bars
SALIENCE  ▮▮▮▮▮░░░░░░░  pricked             ← MONO CAPS labels + right-aligned words
EMOTION   ▮▮▮▮▮▮▮▮░░░░  moved
DRIFT     ▮▮▮▮░░░░░░░░  creeping
The onset lands, then attention thins into the deci…  ← serif, CLIPPED
```

### 8.2 Honest diagnosis — why it reads as a debug panel, not a product

Ranked. My own read, standing in front of the screenshot:

1. **It is nine stacked rows with no hierarchy.** Header, subtitle, tabs, mono status line, the
   surface, colorbar, caption, readout, four meters, verdict, honesty line. Everything shouts at the
   same volume, so nothing leads. There is no answer to *"what is the ONE thing this card tells me?"*
   A premium instrument states its finding, then lets you drill. This states eleven things at once.
2. **It is OFF the design system.** `docs/DESIGN-SYSTEM.md` is explicit: **Inter for all chrome,
   Newsreader serif for voice-moments ONLY**. This card has **10 separate `font-mono` usages** —
   mono caps for the status line, the projection label, the colorbar poles, and all four meter
   labels. Mono is being used as "sciencey texture", and it reads as *terminal output*. Three type
   systems (mono + sans + serif) fight inside one 400px card. **Fixing the typography alone will do
   more for the "premium" read than anything I did to the mesh.**
3. **The card is TALLER THAN ITS OWN CONTAINER.** The clipped verdict is the `/dev/cards` harness
   (`h-[620px] overflow-hidden` — not a render bug), but it is the truth telling on us: the content
   does not fit the panel it ships in. Content must be cut, not scrolled.
4. **The stimulus PiP is an accident.** A dark rounded box dumped on top of the brain's frontal lobe,
   with dim unreadable text, occluding the object it is supposed to accompany. It reads as a bug.
   TRIBE puts the stimulus in a *separate, deliberate* pane.
5. **The colorbar is a temperature slider, not a legend.** A raw red→green gradient with two shouty
   mono words and no ticks, no numbers, no unit. A real figure's colorbar carries a scale.
6. **The meters are generic progress bars.** Four identical grey tracks with caps labels and
   right-aligned adjectives. This is the least designed element on the card and it occupies the most
   vertical space.
7. **Alignment is inconsistent** — left-aligned rows, then a centred caption, then left again.
8. **The brain itself still isn't right.** It reads as a *walnut / cauliflower*: the gyri are lumpy
   isotropic blobs, not the long ribbons of a real cortex. It is muddy beige at low contrast against
   the dark card, and it floats small in a big empty frame. TRIBE's is a bright, high-contrast
   specimen that fills its frame.

### 8.3 The order of work (do NOT start with the mesh)

The mesh is #8 on that list, and it is the expensive one. Attack in this order:

1. **Decide what the card SAYS.** One headline finding, in the room's voice. Everything else is
   support or drill-down. This is a design decision — get the owner to confirm it before building.
2. **Typography + system compliance.** Kill the mono. Inter for chrome; serif reserved for the one
   voice-moment. Fix the wrapping/orphans. This is cheap and high-leverage.
3. **Layout + hierarchy.** Cut rows. Make it fit 620px with air. Give the stimulus a deliberate home
   instead of dropping it on the cortex.
4. **The instrument details.** A real colorbar (ticks + unit), meters that look measured rather than
   generic.
5. **Only then, the mesh:** fold anisotropy (ribbons, not lumps), contrast/brightness (theirs is
   near-white), and framing (fill the frame).

### 8.4 Before writing any code

- **Look at it in a browser first.** `OUT=<dir> node scripts/dev-shot-brain.mjs` — and read
  `docs/DESIGN-SYSTEM.md` + `src/app/globals.css` (`@theme`) as the source of truth. `BRAND-BIBLE.md`,
  `docs/tokens.md`, `docs/components.md` are **STALE** (they describe the dead Raycast system).
- **Study a reference for the CARD, not just the brain.** Last session's win came from diffing
  against the real target instead of theorising. Do the same for the card: find 2–3 premium
  scientific/analytical instruments and diff.
- **Offer the owner an ASCII/sketch preview before building** (their standing preference — see the
  `ui-ship-design-grade` memory). They have rejected this surface three times; do not build a fourth
  version on a guess.

### 8.5 Constraints that are NOT up for negotiation

- The **four invariants** in §4 (diverging sage/coral axis, thresholded, spatially smooth, real HRF
  lag) — all pinned by tests.
- The **honesty labels** ("a modeled response · a sketch, not a measurement" / "modeled from your
  audience's real retention · not a brain measurement"). These may be *restyled*, never removed.
- The **locked accent-dosage rule** (`docs/DESIGN-SYSTEM.md`). Coral means "you are losing them",
  everywhere, always.
- **TRIBE is CC-BY-NC + FreeSurfer** — study the output, copy nothing (§2).

---

## 9. ✅ ROUND 4 — what shipped (commit `77814f06`)

The owner's steer this round was one line: *"I want it to look way more like TRIBE v2."* So the
session started by driving their demo with Playwright and diffing the **CARD**, not the brain.

### 9.1 The finding that reframed everything

**TRIBE's brain is only ~60% of its frame.** What fills the frame is a ghosted **HEAD**, with the
brain sitting in its cranial vault. Their chrome is *three annotations and a stimulus pane* — no
meters, no status line, no caption. The specimen carries the message; everything else labels it.

That inverts §8.2's item 8. The instinct "it floats small → make it huge" is **wrong**: a
frame-filling brain reads as a 3D asset. A brain **in a head** reads as anatomy. Do not undo this.

### 9.2 What was done, in §8.3's order (the mesh really was last)

| # | §8.2 defect | Fix |
|---|---|---|
| 1 | nine rows, no hierarchy | Rebuilt as a **figure**: header → the well → stimulus pane → 4-up strip → verdict → honesty. The verdict is the finding; everything above is evidence. |
| 2 | off the design system (10× mono) | **font-mono: 10 → 0.** Inter, sentence case. `font-serif` is now exactly **1** usage (the verdict — the single voice-moment). Verified in-browser: only `Inter` + `Newsreader` on any leaf node. |
| 3 | taller than its 620px panel | **Fixed and measured.** Was 554px in a 516px box. Now **465px in both modes, `scrollH === clientH`.** |
| 4 | stimulus dumped on the cortex | Its **own pane**, below. Fixed height in BOTH modes (see 9.4). |
| 5 | colorbar = temperature slider | A real colorbar: **ticks + the unit** (`predicted BOLD`), living in the well's top-right corner. |
| 6 | generic progress bars | Collapsed to a **4-up instrument strip** (was 69px of stacked bars). |
| 7 | inconsistent alignment | One left-aligned spine; the centred caption is gone. |
| 8 | reads as a walnut | Fold anisotropy **2:1 → 4.5:1** + a **domain warp** → long meandering ribbons. Tone curve stopped multiplying AO into lambert (it was crushing crowns to mud): **sulci ≈36, crowns ≈241**. |

**THE WELL** (`WELL_BG = #131210`) is the single move that made the rest work. TRIBE's specimen is
near-white on **black**; ours was mid-beige on mid-charcoal — *the same value as its surroundings*, so
it had no silhouette. **No amount of mesh work could have fixed that.** The well is a matte tone-zone,
so the app stays flat-warm charcoal and only the instrument gets its black sky.

**The specimen is MIRRORED** (`scale={[-1,1,1]}`, material `DoubleSide`, and the parallax `useFrame`
base yaw is **negative** — it overwrites `rotation.y` every frame, so flipping the sign there is not
optional). It had been seated backwards in a head that faces left. The mirror also makes the
long-standing `left hemisphere · lateral` label true.

### 9.3 🔬 Two bugs measurement caught that eyeballing did not

Same lesson as §5 — and note the first one **survived three rounds of visual review**:

1. **The activation alpha opened at `0.35 + 0.65*s`** — so the instant the field crossed threshold the
   colour jumped straight to 35% opacity. Probing the rendered pixels: **~92% of the colour swing
   completed in ONE pixel.** That hard step is why the map read as flat translucent shapes *pasted on*
   the anatomy, with the network boundaries showing through as seams. **The field was always smooth —
   the gradient test was right, and the discontinuity was manufactured in the paint.** Alpha now ramps
   from **zero** (`smoothstep(0.0, 0.22, s) * (0.45 + 0.55*s)`): zero slope at the contour → no edge to
   see, then it climbs hard so the cluster core is unmistakably painted. Soft edge, strong body.
   Probed after: max 1px jump **12.0 → 2.0**. ⚠️ A plain linear ramp from 0 removes the step but also
   removes the MAP — clusters fade to a hint. The curve matters as much as the zero.
2. **The GROUNDED card still overflowed** (530px in a 516px box) *after* the simulated one fit — the
   video thumb's intrinsic aspect was driving the flex row. **Always measure both modes.** The
   stimulus pane is now a fixed `h-[64px]` in both.

### 9.4 Gates

`91 brain tests green · tsc 0 · eslint clean · full suite 3367 pass` — with the **one pre-existing
`api/tools/remix/run` SSE failure unchanged** (it fails identically without these changes).
**All four invariants hold and are still pinned**; honesty labels restyled, never removed.

### 9.5 Still open / next

- **The silhouette is still an egg.** The ribbons and the value are right, but the outline lacks lobar
  structure — no temporal lobe hanging below a clear sylvian fissure. This is `shape()` in
  `cortex-mesh.ts`, and it is the last real fidelity gap. Cheapest next win.
- **Grounded mode often paints nothing.** With threshold `0.45`, an early-video frame where every
  network sits at 0.2–0.36 clears nothing and the cortex is bare. That is *honest* (thresholded is an
  invariant) but it means the map is frequently invisible in the Read. Worth an owner call: is a bare
  cortex an acceptable "nothing is firing yet", or should the threshold track the drive?
- Tune the mesh with `npx tsx scripts/preview-cortex.ts out.png` — ~1s per iteration, and its lighting
  is now **synced to the shader** (it was flattering the old muddy render by compositing onto the
  charcoal card bg; it now previews on the well's near-black).
- ⚠️ **Backticks inside the GLSL template literal terminate it** and TS then parses the shader as JS.
  Cost two build breaks this session. No backticks in shader comments.
