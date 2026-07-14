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

---

## 10. ✅ ROUND 5 — the specimen becomes anatomy; the card gets an instrument
### commits `251121c6` (anatomy + trace) · `fceb4f33` (polish)

Owner's steer: *"everything, and I want a really, really good UI design… even better than TRIBE v2."*
So round 5 closes §9.5's two open items and pushes past parity.

### 10.1 The egg is gone — the profile is AUTHORED

Radial Gaussian lobes were never going to draw a brain, and this is worth stating so nobody retries
it: **the sylvian notch and the temporal pole sit ~0.1 rad apart**, so any lobe stack deep enough to
cut a real notch also drags the temporal pole out into a beak. They cannot be tuned independently.

So `PROFILE` in `cortex-mesh.ts` is now an **explicit lateral outline** — frontal pole, vertex,
tapered occipital, the flat skull-base, the temporal pole, and the notch between it and the orbital
surface — converted to a smoothed periodic radius table (`profileRadius`). The anatomy now lives
somewhere it can be **read and corrected**, not tuned by feel. Edit the landmarks, not the lobes.

Also: folds went from ~8 coarse lumps to **~20+ fine ribbons** (`FOLD_FREQ` 6.6 → 9.4, amplitude
down). ⚠️ This is only possible *because* the anisotropy fix landed first — at 9.4, an isotropic
field is just a finer walnut. The sylvian is a real cleft (`SYLVIAN_DEPTH` 0.085 → 0.15) and the
temporal lobe reads as a lobe hanging under it.

**Lighting is a three-point rig** (warm key, cool bounce fill, rim) instead of one lamp + ambient.
One lamp is *why it read as chalk*: every surface facing away from it collapsed to the same flat
ambient grey. The warm/cool split across the form is most of what the eye scores as "real, and lit".

### 10.2 The map is no longer blank on arrival

A video waits for a tap, so the grounded panel opened at **t=0 — inside the haemodynamic lag**, the
one moment that is *honestly* empty. Probing the model settled it: grounded clears threshold from
~6s and stays lit for **14 of 17** sampled frames. **The model was right; we were showing the wrong
frame.** The scan now opens on its **peak** — the crisis moment the audience's own retention curve
picks out — and the video seeks to match so thumbnail and cortex agree. Only before the FIRST play;
pausing later must not yank the clock back (guarded by a `hasPlayed` ref).

### 10.3 THE TRACE — and the two versions of it that measurement killed

Engagement across the whole encounter, filled **sage above zero and coral below**: the *same*
diverging axis the cortex is painted on and the colorbar is scaled to, so the card speaks one
language and the trace costs nothing to learn. In grounded it **crosses zero twice** — negative,
positive through the middle, negative again — which is *"you lose them in the back half"*, drawn.
The colorbar also gains a **live marker**: a legend tells you how to read the map; this one also
tells you the reading. (TRIBE's is inert. Cheapest place to beat it.)

⚠️ **It is the THIRD series I tried. The first two were wrong, and only measurement caught it:**

1. **drive-vs-BOLD, each min-max normalized.** Made the lag pop, and was a **LIE**. Measured: the
   drive swings 0.23→0.89 but BOLD only moves **0.590→0.645** (the HRF is a 16s low-pass that eats
   nearly all the structure), while the series' own numerical wobble is **~18% of that 0.055 span**.
   The normalization was amplifying **rounding noise into a full-height zigzag** — a manufactured
   signal, drawn as data.
2. **Both replotted on a common absolute scale.** Honest, and **inert**: a spiking stimulus and a
   flat line. True, and worth nothing to a creator.

The axis is well-conditioned (span **0.93** grounded, roughness **~1.4% of span**) and carries the
story. **Probe a series before you plot it** — "it looks like signal" is exactly how noise gets shipped.

The trace **auto-ranges in amplitude, anchored at zero** (±1 is the axis's arithmetic limit, not its
practical range — it lives inside ±0.55). The **zero line never moves**: the sign IS the meaning.
A floor (`TRACE_MIN_RANGE`) stops a near-silent encounter being amplified into false drama.

### 10.4 Gates

Both modes **474px in the 516px box**, identical shape, no overflow · fonts on every leaf node are
**Inter + Newsreader only** · 91 brain tests green · tsc 0 · eslint clean · full suite **3367 pass**
with the one pre-existing `api/tools/remix/run` SSE failure unchanged.
All four invariants hold; honesty labels restyled, never removed.

### 10.5 Still open

- **Mesh build is ~500ms** (measured, `cortexMesh` + parcel blend at SUBDIV 6). It is memoized per
  seed and runs behind a lazy `ssr:false` import, but it *does* block the main thread on first open.
  SUBDIV cannot go up (7 would be ~2s). The cost is the O(V×P) farthest-point + blend (40,962 × 340).
  A spatial grid would fix it — but that is the code the §5 bugs lived in, so **re-run the gradient
  probes if you touch it.**
- The **simulated** trace is a quiet plateau (its axis never crosses zero — the synthetic encounter
  has no real timeline). Honest, but the trace only truly earns its place in **grounded**.

---

# 11. 🔴 ROUND 5 REJECTED — AND THE APPROACH IS THE BUG

**Read this section before you touch anything. It supersedes the "next steps" in §9 and §10.**

Owner, looking at `/dev/cards#room` in the real app: *"The UI design still looks really weird and not
good at all… compared to TRIBE v2 this is not good at all."* **Fifth rejection.**

## 11.1 The finding: we are generating a brain. Both references DISPLAY a scanned one.

This is the thing five sessions missed, and it is not a parameter:

| | What it actually is |
|---|---|
| **TRIBE v2** | A real **FreeSurfer cortical surface**, reconstructed from real MRI |
| **The Sapient Company** (https://www.thesapientcompany.com/) | A real **volumetric MRI render** — translucent skull, brain glowing inside |
| **Us** | An **ellipsoid + Perlin noise**, sculpted by hand-tuned constants |

**You cannot procedurally noise your way to something that survives being placed next to real MRI.**
Every round improved the *fake* — anisotropic ribbons, an authored profile, a three-point rig, a
near-black well — and every round was still rejected, because "a better fake" and "good" are
different axes. What ships today is the **uncanny valley**: at real scale in the real app it reads as
a tan, bark-textured blob floating in front of an amorphous dark smudge that does not read as a head.

**Stop tuning `cortex-mesh.ts`. The file is the problem.**

## 11.2 What is actually wrong in the shipped render (for the record)

Observed at real scale in the app (NOT in an isolated screenshot — that is part of why it kept
passing my own review):
- the cortex reads **tan/brown and muddy**, not the near-white of the references (the charcoal card
  surrounding the well drags the perceived value down; it looked cream in isolation);
- the gyri read as **high-frequency bark / brain-coral noise**, not as cortex;
- the **head ghost does not read as a head** — at card scale it is an ambiguous dark smudge that
  looks like a render artifact or a drop shadow;
- the colorbar is crammed into the top-right and visually collides with the specimen;
- two cards side by side make the noise *more* obvious, not less.

## 11.3 The three ways forward (owner must pick — do not guess)

### ▶ A. SOURCE REAL GEOMETRY (recommended)
**The brain mesh is a PROCUREMENT problem, not an engineering problem.**
- A royalty-free cortical mesh on **TurboSquid / CGTrader**: ~$20–100, commercial licence, ours to use.
- Or a permissive/free anatomical model: **BodyParts3D/Anatomography** (CC-BY-SA), **Z-Anatomy**
  (CC-BY-SA), **Sketchfab CC0** MRI-derived scans. ⚠️ Check each licence — **FreeSurfer/fsaverage is
  still OUT** (§2), and CC-BY-**NC** is out.
- Load as glTF/OBJ, light it with the shader **we already have**, and it looks right on day one.
- Five sessions of Perlin tuning have already cost far more than $100.

**⚠️ MOST OF THIS SESSION'S WORK SURVIVES OPTION A.** Only `src/lib/brain/cortex-mesh.ts` (procedural
geometry) is thrown away. These all stay: the card layout, the near-black well, the colorbar + live
marker, the engagement trace, `cortex-sim.ts` (the response model), `CortexCanvas.tsx`'s shader and
three-point rig, the honesty spine, the tests. The swap is contained.

**What a replacement mesh must supply** (so the rest keeps working):
1. positions + indices (obviously);
2. a **per-vertex curvature scalar** — the shader's `aCurv` drives all sulcal shading. A real mesh
   does not ship this; compute **mean curvature** from the geometry once at load and cache it.
3. **parcels → networks.** Today `ANCHORS` maps a shaped (x, y) to a Yeo-7 network. With a real mesh,
   re-anchor in ITS coordinate frame (normalize the mesh's bbox first). The blend kernel
   (`BLEND_R`/`BLEND_K`) and its four invariants port unchanged — **but re-run the gradient probes**
   (§5), because the parcel spacing changes with the geometry and that is exactly what broke it before.

### B. STOP BEING PHOTOREAL — draw a confident schematic
A deliberate 2.5D/flat diagram in our own design language never enters the uncanny valley; a failed
render lives there. Cheaper, fully on-brand, zero licence risk. Sapient's site is the tonal reference
for *restraint* (white, huge light-weight sans, one hero object, enormous negative space) even though
its brain image is a real MRI.

### C. KILL THE BRAIN SCALE
The Room already has **The people** and **Population · 1,000**. The brain is a metaphor that demands
a fidelity we have now failed to reach five times. It is a legitimate outcome to cut it. **Ask the
owner whether the brain earns its place at all before rebuilding it a sixth time.**

## 11.4 Do NOT repeat these

- ❌ Do not tune `FOLD_FREQ` / `SULCUS_WIDTH` / `PROFILE` / the lighting again. Five rounds of evidence.
- ❌ Do not review the render in an **isolated screenshot**. It flattered the work every single time.
  Judge it at real scale, in the app, next to the other cards — that is where it falls apart.
- ❌ Do not add more chrome to compensate for a weak specimen.
- ✅ Diff against the real reference **first** — that step produced every genuine finding in this
  document (the folding, "fill the head not the frame", and now this one).
- ✅ **Probe a series before you plot it** (§10.3) — two of three trace designs were noise drawn as data.

## 11.5 State at handoff

Branch `feat/audience-brain-panel`, **unpushed, no PR**. Commits this session:
`77814f06` (card→figure) · `d68d77da` (docs) · `251121c6` (authored profile, 3-pt rig, trace,
peak-frame open) · `fceb4f33` (polish) · `1c01dc40` (docs).

Green but rejected: both modes **474px in the 516px box** · Inter+Newsreader only · 91 brain tests ·
tsc 0 · eslint clean · full suite 3367 pass with the one pre-existing `api/tools/remix/run` SSE
failure. **Passing gates is not the problem. The object is.**

Known, unfixed: **mesh build ~500ms** blocks the main thread on first open (moot under option A).

---

# 12. ✅ THE DECISION (2026-07-13, owner) — REAL MESH + TRIBE'S UI, REIMPLEMENTED

Owner rejected the procedural approach AND my schematic counter-proposal (option B), on sight, at real
scale — correctly. A hand-authored bezier cortex is the same error as Perlin noise with a different
tool: a sixth fake. The owner then supplied a THIRD reference (a Dribbble "Medical AI / Neural
Diagnostics" UI) which is also a **real 3D brain mesh** rendered near-white on black. Three references,
three real meshes, zero drawings. The geometry must be real. **Option A. Settled.**

## 12.1 The mesh — CHOSEN

**[Brain Areas — Versal](https://sketchfab.com/3d-models/d64608a3978b47d8a39c5a15795ca8c4)** ·
**CC Attribution 4.0** · 94,716 tris / 47,383 verts / 3.1MB glb. Near-white cortical surface, real
gyri/sulci, right poly budget for the web (no decimation). Owner downloads → `public/brain/cortex.glb`
(Sketchfab gates downloads behind a login; the agent cannot fetch it).
**A CC-BY credit line for Versal is owed and must ship.**

Runners-up (if Versal disappoints): `dgallichan` (CC-BY, 377k tris, a REAL FreeSurfer surface from a
T1 MRI — highest fidelity but needs decimation + an owner call on the §2 FreeSurfer tripwire) and
"Brain Point Cloud" (CC-BY, a different register entirely — an instrument, not a specimen).

## 12.2 ⚠️ LICENCE — the line, precisely

**TRIBE v2 is CC-BY-NC.** Maven is commercial (pricing shipped), so NC excludes us. But the owner's ask
is legitimate and the distinction matters: **UI design ideas are not ownable; files are.**
- ✅ ALLOWED: study their demo, reimplement the layout/motion/controls in our own code.
- ⛔ FORBIDDEN: pasting their JS/CSS/shader, or shipping their fsaverage mesh (FreeSurfer, §2).
This is why we bought our own geometry.

## 12.3 What their demo actually does (dissected 2026-07-13 — nobody had done this)

Captured via CDP (their WebGL loop hangs a normal Playwright screenshot — same failure as our app).

1. **THE SPECIMEN OWNS THE FRAME.** Their brain is ~600×550px in a 1440px viewport — *half the screen*.
   Ours is ~430×310 in a 474px card — **a quarter of the area.** ⚠️ **No mesh reads at our size.** We have
   been fighting a fidelity war in a frame too small to show fidelity. **A real mesh alone will NOT fix
   the card. The brain scale needs more room** — this is a layout decision, still OPEN with the owner.
2. **Camera is a 3/4 perspective from slightly above** — not our flat lateral. Most of why theirs reads
   as a volumetric object and ours reads as a sticker.
3. **Controls = three segmented pill groups in ONE quiet row beneath the specimen**
   (`True|Compare|Predicted` · `Normal|Inflated` · `Open|Close`). Take the PATTERN.
   Only **`Normal | Inflated`** has meaning for us. `True|Compare` requires a ground-truth scan we do
   not have (offering it would be a lie); `Open|Close` is for two hemispheres; we show one.
4. **The INFLATED surface is the find.** A smooth balloon with curvature-derived shading that STILL
   reads as a brain — because the silhouette and the curvature are real. It is what our procedural mesh
   was imitating without the real curvature underneath. Ship it as the second view.
5. **Their head ghost is LARGE and SOFT** — a big low-contrast mass, much bigger than the brain. Ours is
   a hard-edged path at 8.5%, too small and too defined → reads as a smudge. Fix: bigger, softer, lower.
6. Resting cortex is light gray-white; activation is small hot patches. Most of the brain is UNLIT
   (we already threshold — but our resting tone was mid-tan, which is half the muddiness).
7. Their colorbar (tiny, `Low → High`, unit "Activity") is INERT. **Ours is better** — ticks, unit, and a
   live marker. Keep ours.

## 12.4 Deliberately NOT taken
The red/orange/yellow **hot colormap** (breaks the LOCKED accent-dosage rule — we keep the diverging
sage/coral axis, §8.5), their font, and the two-brain true-vs-predicted comparison (dishonest for us).

## 12.5 Order of work (when the .glb lands)
1. Load glTF (three.js is already a dep) → **compute per-vertex mean curvature once at load, cache it**
   (feeds the shader's `aCurv`; a real mesh does not ship curvature).
2. **Re-anchor** parcels→networks in ITS bbox → **RE-RUN THE GRADIENT PROBES** (§5). Parcel spacing
   changes with geometry and that is what silently broke the map before. Non-negotiable.
3. Delete `cortex-mesh.ts` (688 lines) + the ~500ms main-thread build. Rewrite `cortex-mesh.test.ts`.
4. Camera → 3/4 perspective. Head ghost → bigger + softer. Add the `Normal | Inflated` segment.
5. **Judge at real scale at `/dev/cards#room`, beside the other cards.** Never in an isolated screenshot.
SURVIVES UNTOUCHED: the well, colorbar + live marker, HRF trace, `cortex-sim.ts`, the shader + 3-pt rig,
the honesty spine, `cortex-sim.test.ts`, `brain-view.test.tsx`.

---

# 13. ✅ SHIPPED — THE BRAIN IS REAL (2026-07-14)

The specimen is now a **real FreeSurfer cortical surface from a T1-weighted MRI** (`public/brain/cortex.glb`,
CC-BY dgallichan). Verified in the app at `/dev/cards`, at real scale, beside the other cards — in both
`simulated` and `grounded` modes. `cortex-mesh.ts` (688 lines, the ellipsoid + Perlin noise) is DELETED,
along with its ~500ms per-open build.

## 13.1 What is on disk
| | |
|---|---|
| `public/brain/cortex.glb` | 1.84MB · 64,397 verts / 92,127 tris · 16-bit indices · curvature baked as `_CURV` |
| `public/brain/LICENSE.txt` | the CC-BY credit, shipped next to the asset |
| `scripts/build-cortex-mesh.mjs` | the pipeline (weld → simplify → curvature → LEVEL → strip → quantize) |
| `src/lib/brain/cortex-field.ts` | parcels → networks → self-tuning blend → signed per-vertex field |
| `src/lib/brain/__tests__/cortex-field.test.ts` | 12 tests incl. the gradient probes + the four invariants |
| Settings → Account | the CC-BY credit line (the licence's price; it is not optional) |

## 13.2 ⚠️ THE BUGS THAT RENDER SOMETHING PLAUSIBLE AND THROW NOTHING
Every one of these produced a *believable wrong picture*. If you touch this code, these are the traps.

1. **`pos.array` on a quantized mesh is INTERLEAVED** — position+normal+curvature woven together. Fed to
   `buildField` it gives a garbage bbox, every anchor misses its hemisphere, and the field comes back with
   zero networks. **Always read via `getX/getY/getZ`.**
2. **`geometry.clone()` does not survive interleaved buffers** → the mesh drew as a *shattered cube*.
   Rebuild from the accessors.
3. **The node matrix IS the dequantizer.** Lift the geometry out without it and the brain is thousands of
   units wide with the camera inside it — **the well renders EMPTY and nothing throws.**
4. **three colour-manages `THREE.Color` uniforms into LINEAR space**, but a custom ShaderMaterial writes
   `gl_FragColor` raw → we dumped linear values at an sRGB display and **the specimen rendered BLACK.**
   Two rounds were lost blaming the lighting. Bisecting the shader term-by-term found it: the light term
   looked fine (Vector3 uniforms are *not* colour-managed), the BASE term was near-zero.
   Fix: **`#include <colorspace_fragment>`**.
5. **The mesh was TILTED** (native scanner space, nose-down). A tilt shears the normalised anatomical frame
   the anchors live in, so "visual cortex at the occipital pole" quietly stops being true. Levelled by PCA.
6. **Sketchfab's root node carries its own rotation.** Rotating vertex data without clearing it is a LIE:
   three re-applies the rotation at load (file said 140×133×188, three saw 140×188×133 — Y/Z swapped).

## 13.3 The axis signs — MEASURED ON THE OUTPUT, never predicted
An earlier version predicted the signs from the input cloud and came out **inverted**. A wrong sign mirrors
the brain and *nothing on screen looks like an error*. The discriminators that actually separate:
- **LEFT-RIGHT** — mirror symmetry across the sagittal plane (92.7% vs 79.0%). A brain mirrors side-to-side; it does not mirror top-to-bottom. ⚠️ PCA *variance* cannot tell L-R (140mm) from S-I (133mm) apart, and the **bbox does not catch the mistake** because a swapped pair looks equally plausible.
- **UP** — the broad dome vs the narrow brainstem cap (2267 vs 601).
- **POSTERIOR** — the cerebellar **VERMIS** at the midline (2683 vs 1357). ⚠️ Rejected as coin flips: *"the inferior mass leans posterior"* (it leans ANTERIOR — the temporal lobes dominate the bottom of a brain) and *"the posterior end hangs lower"* (a tie: 48.6 vs 48.5).
- Flips negate **TWO** axes, never one — a single flip would mirror a left hemisphere into a right one.

## 13.4 The §5 landmine, defused
The blend bandwidth was a CONSTANT tuned to the old mesh's unit scale. It is now **self-tuned**, and the real
constraint turned out to be the **STRIDE**, not the radius. Both walls measured: a wide radius truncates the
K-nearest set (mosaic, maxStep 0.279); a narrow radius lets the nearest parcel dominate (worse, 0.555). The
stride is now sized to the measured worst-case crowding, with headroom.
⚠️ **The gradient probe measures the SLOPE, not the per-edge step.** Decimation leaves long triangles, so a
raw `|Δv|` per edge conflates "the field jumped" with "that edge was long" — it failed a *perfectly smooth
field* for exactly that reason.

## 13.5 Still open
- **`Normal | Inflated`** (TRIBE's toggle, and their best idea) needs a SECOND geometry — an inflated surface
  with matching vertex order, lerped as a morph target. A Blender/build-script step; not faked.
- The **map lights ~50% of cortex in the engaged state**. Honest to the model (six of seven networks run
  task-positive), but TRIBE's map is sparser. If the owner wants sparsity, the lever is a contrast against a
  resting baseline — a change to `cortex-sim`, i.e. a change to what the card CLAIMS. Owner call.
- Camera could sit slightly more lateral; the specimen could grow a little more in frame.

---

# 14. ▶ THE NEXT BRIEF — MOTION, SMOOTHNESS, AND THE CARD'S UI (owner, 2026-07-14)

Owner verdict on the shipped mesh: **"this looks way better"** — the specimen is ACCEPTED. The geometry
fight is over; do not reopen it. What is NOT accepted: **"ui design, animation, smoothness, motion and more
still needs a lot of work."**

⛔ **DO NOT touch the geometry, the axes, or the blend kernel to "improve" this.** They are correct, measured
and pinned (§13). The remaining work is MOTION and CHROME.

## 14.1 🔴 THE PERFORMANCE BUG — start here, it is most of "smoothness"

**`buildField` blocks the main thread for 2,427ms on first open. Measured.** We deleted the old ~500ms mesh
build and silently replaced it with something five times worse.

The cause is not the parcel count — it is the K-nearest insertion loop: **every one of 64,397 vertices tests
all 400 parcels**, and each hit does an O(K) insertion into a stride-43 list. ≈1.1 BILLION operations.

**The fix is a spatial grid.** Bucket the parcels into a uniform grid with cell size = `blendR`; each vertex
then only tests the parcels in its own cell + neighbours (~27 cells, a handful of parcels each). Expect
**<100ms**. ⚠️ §5 warns that a spatial grid is exactly where the old bugs lived — but we now HAVE the
gradient probes (`cortex-field.test.ts`), so **re-run them after** and they will catch a regression.

Also measured: `surfaceValues` = **4.6ms per tick**, and blend arrays cost **16.6MB** at stride 43. Both are
survivable; the 2.4s is not.

## 14.2 🔴 THE MAP STEPS — it does not flow
The scan clock ticks at `TR/4` (~372ms) and each tick **snaps** a whole new `aVal` buffer into the geometry.
Nothing interpolates between ticks, so the activation moves in visible 372ms jumps. BOLD is genuinely slow —
that is honest — but the *rendering* of it should be continuous. Lerp `aVal` toward its target in `useFrame`
(the buffer is already mutated in place; interpolate rather than assign), or drive a continuous clock and
sample the model at frame time.

## 14.3 The motion, honestly
- **The drift is a raw sine** on yaw + pitch (`CortexCanvas`, `useFrame`). Mechanical, no easing, no variation.
  TRIBE uses **OrbitControls** — the user can grab and turn the specimen. That is a real affordance and we
  have none: the brain is currently a thing you watch, not a thing you handle.
- **There is no entrance.** `Suspense fallback={null}` → the well sits empty, then a brain pops in. It needs
  a settle: fade + a small scale-in, and a skeleton in the well while the mesh loads (1.84MB + the field build).
- **Everything eases LINEAR** — the colorbar's live marker (260ms linear), the trace playhead (200ms linear),
  the stimulus words. Linear is the tell of un-designed motion.
- `reducedMotion` holds the response at the stimulus midpoint and runs the canvas on `demand`. Keep that.

## 14.4 The card's UI (owner: "improve the brain card's UI design")
Unresolved from §11.2 and still true:
- the **colorbar is crammed into the top-right and collides with the specimen**;
- the well's four corners carry four separate annotations (colorbar, lag claim, projection, hover readout) —
  it works as a *figure*, but it has never been *designed*;
- there is no **`Normal | Inflated`** toggle. It is TRIBE's best idea and it needs a SECOND GEOMETRY —
  an inflated surface with **matching vertex order**, shipped as a morph target and lerped. A build-script
  step (`scripts/build-cortex-mesh.mjs`). **Do not fake it with a shader.**
- the specimen could sit slightly larger and more lateral in the frame.

## 14.5 The one OWNER-GATED question
The engaged map lights **~50% of the cortex** (measured). That is honest to the model — six of the seven
networks are task-positive — but TRIBE's map is far sparser. Making ours sparser means painting a CONTRAST
against a resting baseline, which changes what the card CLAIMS. **That is the owner's call, not the
implementer's.** Do not quietly retune the threshold to make it look better.

## 14.6 The rule that earned everything in §13
**Judge it at real scale, in the real app, beside the other cards.** Never in an isolated screenshot — that
flattered five straight rounds of bad work. And when something looks wrong, **measure it** rather than tune
constants: every real finding in this document came from a probe, and every wasted round came from a guess.

---

# 15. ✅ MOTION, THE MAP, AND THE CARD (2026-07-14) — and the one thing that got CUT

Brief was §14: *"ui design, animation, smoothness, motion and more still needs a lot of work"*, with the
standing ask to get **as close to TRIBE v2 as we can**. The geometry fight stayed closed — the mesh,
the axes and the blend kernel were not touched.

## 15.1 What shipped

| | before | after |
|---|---|---|
| **Main-thread block on open** | **2,605ms** (measured) | **~240ms** — a spatial grid over the parcels |
| **Cortex lit when engaged** | **57%** (continents) | **26% at a strong hook's peak, ~8% typical** (a map) |
| **The map between ticks** | snapped a new buffer every 372ms | lerped every frame toward its target |
| **Turning the specimen** | you could not | **OrbitControls** — grab it; the drift yields, then resumes |
| **Arrival** | empty well, then a brain pops in | skeleton → CSS fade + settle, on a real *ready* signal |
| **Easing** | every transition `linear` | one ease-out curve, shared |
| **Colorbar** | jammed in the well's top-right, colliding with the specimen | its own row under the figure, where a legend goes |
| **Default camera** | ¾ of the brain's **top** | the **lateral plate** — which is where the map actually lives |

**buildField:** the kernel is compactly supported, so only parcels inside `blendR` can matter. Bucket
them into a grid whose cell IS `blendR` and each vertex tests ~38 candidates instead of 400, with no
sorted insertion (hence `field.nearest`). Diagnostics came back **identical** — the grid changed the
cost, not the field.

**The map is now a CONTRAST against rest** (owner-approved, §14.5) — and that is what an fMRI figure has
always been. Two further corrections were forced by measurement, not taste:
- each network is scaled by **its own p95 response** (`RESPONSE_P95`), because a map is a *normalised*
  statistic. Without it the DMN — ceiling 0.27, versus attention's 0.74 — **mathematically could not
  clear the threshold**;
- `ACTIVATION_SPAN` 0.5 → 0.3, because the painted quantity's range changed underneath it and a vertex
  that had just cleared threshold was painting at **alpha 0.004**. Lit in every histogram, invisible on
  screen.

## 15.2 🔴 THE NEAR-MISS, and the test lesson worth more than any of the code

Re-basing the map onto a contrast **silently deleted the one thing the card exists to say.** On a real
encounter where the audience visibly walks out, the surface painted **0.0% coral**. "You are losing
them" simply stopped rendering.

**Every test stayed green.** They asserted against hand-written vectors (`default: 0.83`) that are
**hotter than anything `predictedBold` can actually produce**. A fixture that cannot occur is not a
test — it is a second, imaginary model, and we were regression-testing that one.

The fixtures in `cortex-field.test.ts` are now **sampled from the drive model itself**, at the moments
that matter, and there is a floor on the coral. Do not replace them with numbers you typed.

## 15.3 ⛔ WHAT GOT CUT: `Normal | Inflated`

TRIBE's best idea, and we do not have it. It was built — a Taubin inflation baked as a glTF morph
target, `scripts/build-inflated-mesh.mjs` — and it **shreds the brain**: our mesh is a *decimated whole
brain*, its sulci are full of slivers, smoothing turns them inside out (2.3% of triangles at 20 steps),
and culled back-faces render as **holes**. It passed every gate the script had (roughness −80%, shape
1.00) and was obviously broken the instant it was on screen.

**The fix is procurement, not engineering — again.** FreeSurfer *emits* `lh/rh.inflated` alongside the
surface this mesh came from, with exact vertex correspondence. Source the subject's actual surfaces
(not a Sketchfab export), decimate both with a shared mapping, and the toggle is trivial and correct.
The script stays in the repo with its measurements; it is not wired to anything.

## 15.4 New traps (all cost real time)

1. **NEVER gate visibility on a value only the render loop advances.** The entrance fade started as a
   uniform (`col * uFade`). On a page with several canvases one loop stalls and **freezes on the frame
   it last drew** — which was `uFade ≈ 0`. The brain sat there as a perfect **black silhouette**, right
   shape, fully lit, completely invisible, nothing thrown. The entrance is now a **CSS transition on
   the wrapper**: the compositor owns it, and a stalled canvas now freezes on a *lit* brain.
2. An **alpha** fade on a transparent ShaderMaterial in an alpha canvas made the specimen vanish
   outright. The well is near-black; fade *brightness*, or better, fade in the DOM.
3. **The shader is a template literal — NO BACKTICKS IN ITS COMMENTS.** It is warned about at the top
   of the file and it still bit twice in one session.
4. `blendIdx[v * blendK]` is **no longer the nearest parcel** (the list is unsorted now — that is where
   the 2.4s went). Use `field.nearest`, or the hover readout names a real but *wrong* region.
5. The projection label (*"left hemisphere · lateral"*) is **deleted and stays deleted**: the mesh is a
   whole brain, and with OrbitControls the viewer picks the projection. A claim the UI cannot keep is
   worse than no claim.

## 15.5 Still open
- The **inflated view** (§15.3) — needs the real FreeSurfer surface.
- The card is **509px in its 516px box**. It has ~7px of headroom. Anything you add to the chrome comes
  out of the specimen, or clips the verdict.
- The specimen could still grow; `FIT_RADIUS` is 1.15 and the well is `20/19`.

## 15.6 Gates
tsc **0** · eslint clean · **98 brain/lens tests** · full suite **3,374 pass** with the one pre-existing
`api/tools/remix/run` SSE failure. Verified in the real app at `/dev/cards`, at real scale, beside the
other cards — hover reads out live (`Visual Δ1.00`), the orbit drag works, both modes fit their box.
