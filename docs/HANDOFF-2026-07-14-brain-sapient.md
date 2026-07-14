# HANDOFF — The Brain card, rebuilt against Sapient (2026-07-14)

**Worktree** `~/virtuna-brain` · **branch** `feat/audience-brain-panel` · **dev** `:3400` ·
**surface** `/dev/cards#room` · **commit** `1b21b3de` (not pushed, no PR)

**Owner's verdict on this round, verbatim:** *"better but you didnt copy sapient 1:1 as i said you should."*

That is correct, and §3 is the list of every place it is still not 1:1. Read §0 and §3. Everything
else is evidence and provenance.

---

## §0 — ⛔ THE PREVIOUS HANDOFF (`HANDOFF-2026-07-13-brain-panel.md` §18) IS WRONG. DO NOT ACT ON IT.

It says the two things blocking fidelity are **PROCUREMENT** — a higher-res mesh and a head asset —
and that *"no shader, no lighting rig and no colormap will fix it; three rounds of trying is the
proof."* **Both claims are false. One measurement killed both.**

| | Sapient (the reference) | Ours |
|---|---|---|
| Cortex vertices | **40,004** (20,002 × 2 hemis) | **65,535** |
| Faces | 80,000 | — |
| Head / skull / silhouette | **none — plain background** | had one (deleted this round) |

The mesh we condemned as "the doesn't-look-real" is **39% BIGGER** than the one whose look the owner
asked us to copy. There was nothing to procure. The head was never needed — three hand-authored SVG
potatoes, three rejections, for a device the reference does not use.

**The actual bugs were one `if` and one clamp** (both fixed in `1b21b3de` — see §2).

**THE LESSON, and it is the important artifact of this round:** the design system kept overruling the
reference — the activation threshold, the below-rest clamp and the "whisper of sheen" were each
justified in a comment citing the LOCKED accent-dosage or matte rules — and **115 green tests
asserted how MUCH cortex was painted while never once asking WHAT COLOUR IT CAME OUT.** A one-colour
specimen passed the whole suite through four rejections.

---

## §1 — WHERE THE REFERENCE IS, AND HOW TO MEASURE IT YOURSELF

`https://www.thesapientcompany.com/intelligence` — owner has a login. Free plan = **1 scan**, then a
`$29/mo` modal; **"Not now"** dismisses it and the result stays fully readable.

### Their brain data is PUBLIC and unauthenticated — just fetch it
```
https://www.thesapientcompany.com/brain/brain_mesh.json   # 2.6MB · flat vertices[] + faces[]
https://www.thesapientcompany.com/brain/roi_map.json      # Glasser / HCP-MMP1 parcellation
```
- `brain_mesh.json`: `n_vertices_lh: 20002`, `n_vertices_rh: 20002` → **40,004 verts, 80,000 faces.
  Cortex only — no cerebellum, no brainstem.**
- `roi_map.json`: `vertex_labels` (20,484 = fsaverage5 10,242 × 2) + `regions` — labels are
  **HCP-MMP1 / Glasser**: `6d`, `VIP`, `24dv`, `9-46d`, `PFm`, `10d`, `23c`…
- Rendered on a **WebGL2 canvas of only 206×340 CSS px** in the side panel. Glossy/wet specular.

> ⚠️ **THEIR MESH AND ROI MAP ARE DELIBERATELY NOT COMMITTED TO THIS REPO.** Fetching them to measure
> is research; redistributing them in our tree is not. Our surface stays the CC-BY dgallichan mesh.
> Reimplementing the LOOK is fine and is what we do — see `HANDOFF-2026-07-13` §18.3, which settled
> the licence question and is the one part of that file still worth reading.

### The probes — reproducible, committed, run from the worktree root
```
.planning/references/sapient/
  hue-probe.mjs        # hue-bucket a render's pixels. Run on THEIRS and OURS — directly comparable.
  value-probe.mjs      # the per-vertex `aVal` the shader actually paints from (the INPUT)
  measure-response.mjs # re-derive RESPONSE_P95 / SUPPRESSION_P95 from the drive model, both tails
  sapient-*.png        # their app: full result panel, cortex canvas, every section
  ours-after-rebuild.png
```
```bash
cd ~/virtuna-brain
node .planning/references/sapient/hue-probe.mjs .planning/references/sapient/sapient-09-cortex-canvas.png /tmp/shot1/app-cortex.png
node .planning/references/sapient/value-probe.mjs
node .planning/references/sapient/measure-response.mjs
OUT=/tmp/shot1 node scripts/dev-shot-brain.mjs      # dev server must be up on :3400
```

### Their colormap, measured off their own pixels (40,727 cortex px)
| hue | share | mean | | hue | share | mean |
|---|---|---|---|---|---|---|
| 0° | 2.1% | `#cd483a` | | 165° | 3.9% | `#7ec5b5` |
| 15° | 9.0% | `#d0633b` | | 180° | 9.8% | `#4fc1c6` |
| 30° | 15.5% | `#d38a40` | | 195° | 10.1% | `#409eb7` |
| 45° | **26.3%** | `#d7b54e` ← their dominant tone | | 210° | 1.7% | `#65a0d1` |
| 60° | 15.8% | `#cfcc6d` | | **90–150°** | **~0.5% TOTAL** | ← the tell |
| 75° | 5.3% | `#becd87` | | | | |

**warm 74% / cool 26% · mean saturation 0.59 · mean luminance 0.57**

The empty 90–150° green band identifies it: **RdYlBu-reversed, NOT jet** (jet carries a broad
saturated green through its middle). ⚠️ Bucket **means are duller than the true stops** — they average
lit crowns with shaded sulci. Our ramp restores chroma ×1.45 with hues untouched
(`src/lib/brain/cortex-colormap.ts`).

**Ours after the rebuild: warm 85% / cool 15% · saturation 0.51 · luminance 0.62.** Before: **100/0 ·
0.37.**

---

## §2 — WHAT `1b21b3de` ACTUALLY FIXED

1. **THE SHADER NEVER PAINTED THE BRAIN.** It kept a cream anatomical base and composited colour in
   only where `|value| > ACTIVATION_THRESHOLD (0.42)`. Measured: almost nothing ever cleared it. The
   cortex rendered cream-white with a single orange smudge — *"color mesh doesnt look good at all and
   is only one color?"* was **literally true**, and it was this if-statement, not the mesh. Now every
   vertex is painted from one continuous diverging ramp, always. `ACTIVATION_THRESHOLD` is gone.
2. **`contrastBold` CLAMPED BELOW-REST TO ZERO**, deliberately, to protect the accent-dosage rule.
   That deletes **default-mode suppression** — the most reliable effect in the task-vs-rest
   literature and *the only thing that can paint a cortex blue*. A diverging colormap that cannot
   produce a negative is a sequential one in costume. It is signed now.
   - Each tail gets its **own measured normaliser**: `SUPPRESSION_P95` (new). Reusing the positive
     `RESPONSE_P95` for both **pegged the DMN at exactly −1.000 on every frame** — full deep blue,
     permanently, zero dynamic range.
   - `parcelValue`'s `clamp01` would have **silently eaten every negative** on the way to the shader.
     Now `[-1, 1]`.
3. **The head ghost is deleted.** The polarity flip is deleted (it made a two-sided map impossible).
   Gloss is real now (0.05 → 0.30 specular). `FIT_RADIUS` 0.74 → 1.08 (the specimen was backing off
   to leave room for a cranium that no longer exists).
4. **One ramp module** — `cortex-colormap.ts`. The colorbar's comment used to *promise* it matched the
   shader with no mechanism to keep that promise; the GLSL is now generated from the same stops.
5. **The tests now pin the DISTRIBUTION OF COLOUR** — ramp p05..p95 must span > 0.35, no decile may
   hold > 55% of the surface, and an engaged brain must paint real cortex cold.
6. **`dev-shot-brain.mjs` pins the clock** (`reducedMotion`). Without it the response animates and two
   runs of *identical code* give different colour statistics — I measured a "regression" that turned
   out to be two shots taken 3 seconds apart.

---

## §3 — 🎯 THE 1:1 GAP LIST. THIS IS THE WORK.

Ordered by how much each one costs us against *"just copy them"*.

### GAP-1 · THE THEME — ⚠️ OWNER DECISION, AND IT IS THE BIGGEST SINGLE DELTA
**Them:** the whole app is **light** — near-white canvas (`#eef1f4`-ish), black text, colour only in
the cortex and in one red alarm pill. **Us:** flat-warm charcoal (`#262624`), cream text; the brain
sits in a near-black well (`#131210`).

Earlier this session I asked and the owner chose *"keep charcoal, port their structure"* — and then,
on seeing it, said *"you didnt copy sapient 1:1 as i said you should."* **These two instructions
conflict. Resolve this FIRST, before touching anything else** — it changes every other decision on
this list (a light canvas needs a different ramp luminance, a different rim, a different gloss).

### GAP-2 · SPATIAL FREQUENCY — the specimen still doesn't *look* like theirs
**Them:** a fine-grained, speckled, high-frequency map. That noise is most of why it reads as a real
scan. It comes from painting activation onto **~360 Glasser parcels** with per-vertex labels.
**Us:** smooth continental blobs, because `cortex-field.ts` blends each vertex over `blendK` nearest
parcels with a wide `blendR` (the radius exists to defeat a mosaic, and it overshot into a smear).

This is the **single biggest remaining visual gap** and it is code, not procurement.
→ Raise the parcel count and **tighten `blendR`** toward `spacing` (the test allows `spacing < blendR
< spacing × 3` — we sit high in that band). Re-run `hue-probe`; their render puts only 26% of pixels
in its top hue bucket, ours puts 34%. Then LOOK.
→ The principled version: build a **Glasser-style parcellation on our own mesh** (their `roi_map.json`
shows the shape of the answer; do not ship their file). ~360 parcels instead of our current count.

### GAP-3 · THE RESULT PANEL — NOT BUILT AT ALL
Their `/intelligence` right-hand panel, top to bottom. Ours has none of it.
1. **Synced hero:** `THE CLIP` | `LIVE CORTEX` **side by side, one playhead, one pause button.**
   Caption `7 NETWORKS · LIT AT T = 00:00`. *(Ours stacks the stimulus BELOW the brain.)*
2. Transcript line at the playhead, in quotes.
3. `HOW TO READ THESE NUMBERS` — expander.
4. **THE NINE BREAKDOWN SIGNALS** — 3×3 grid. Each card: big light numeral (`38`), ALL-CAPS mono label
   (`VISUAL PULL`), a verdict word (`WEAKNESS` / `OKAY` / `STRONG`), a thin underline bar,
   `WHY THIS SCORE →`. Their nine: Visual Pull · Voice Impact · Cognitive Grip · Emotional Hit ·
   Memorability · Attention · Buy Signal · Hesitation/Risk · Mental Effort.
5. **Per-second network σ bars** — 7 rows (Yeo-7), centred on zero, `+0.38σ · slightly above`,
   `−1.14σ · clearly below`. Plus a `WHY THIS SECOND` prose box that names the standout network and
   quotes the transcript at that second.
6. **KPI heatmap** — 10 rows × one cell per second (74 for a 74s clip), green WEAK→STRONG ramp,
   `EACH CELL = 1 SEC`.
7. **Attention curve** — black line, dots on the peaks, peak-second chips.
8. **Buy-moment curve** — green line + area fill + dashed threshold line, peak chips (`0:05 · 73`).
9. **Manipulation lens** — the ONLY red on their entire page (`SOVEREIGNTY COMPROMISED` pill).
10. `GO DEEPER WITH AN AGENT` → **Copy for Claude / Copy for ChatGPT / Copy raw JSON**.

### GAP-4 · 💡 THE HONESTY PATTERN — CHEAPEST WIN ON THE LIST, DO IT FIRST
**Every claim card of theirs states what it is NOT**, in mono all-caps under the number:
> `A PREDICTED SIGNAL FROM THE ATTENTION NETWORKS, SCORED WITHIN THIS CLIP. NOT MEASURED WATCH-TIME.`
> `REWARD MINUS HESITATION PER SECOND… A CORTICAL PROXY, NOT MEASURED PURCHASES.`
> `A DIRECTIONAL READ ON VALIDATED CONSTRUCTS, NOT VERTEX-LEVEL FMRI.`

Free credibility, and **precisely the thing we keep getting wrong** (we shipped a dead audience as
HIGH confidence). Our card already has one (`modeled from your audience's real retention · not a brain
measurement`) — they have one on *every* claim.

### GAP-5 · TYPE
**Them:** `ppNeueMontreal` + **mono ALL-CAPS for every micro-label**, everywhere. **Us:** Inter,
sentence case — a *deliberate* earlier decision ("the mono caps are gone — all ten of them"). Copying
them 1:1 means **reinstating mono caps**, which reverses that call. Flag it; don't do it silently.

### GAP-6 · SEMANTICS
**Them:** Yeo-7 networks, **z-scored against the clip's own baseline** (*"σ is how far this second sits
from the clip's own baseline; negative is below its usual level, positive is above"*), reported in
plain language (`clearly below`, `about normal`, `slightly above`). No corpus benchmark — the same
position we independently reached. **Us:** 7 networks, contrast-vs-rest, no σ readout.

---

## §4 — ⚠️ OPEN OWNER DECISIONS (do not guess these)

1. **GAP-1, the theme.** Light like theirs, or charcoal? The two instructions on record conflict.
2. **The colour's MEANING changed, and the label changed with it.** Warm now = *"this system is above
   its own resting level"* (what Sapient's colours mean and what they say they mean). Consequence:
   **on a drifting room, the default-mode cortex paints WARM, not coral.** The colorbar now reads
   `below rest / above rest`, and the engaged/drifting reading moved to the verdict line, in words.
   The old "coral = you are losing them" mapping **cannot coexist with a two-sided map** — the polarity
   flip is exactly what forced every value to one sign. Owner must confirm this trade.

---

## §5 — TRAPS. Every one of these cost real time.

- **A COMMENT IS NOT A MEASUREMENT.** Two constants once carried comments asserting the opposite of
  what they did (the camera yaw — a brain in a skull, backwards, for six rounds; and `uSulcus`). This
  round three more file headers still described the dead sage/coral system. **Grep the headers after
  any change.**
- **`clamp01` IS A SILENT VALUE-EATER** once anything goes signed. It ate the entire cold half and
  nothing threw.
- **A TEST THAT MEASURES AMPLITUDE CANNOT MEASURE SMOOTHNESS.** The gradient probe's `meanStep` failed
  purely because the value range doubled; `maxSlopePerSpacing` (the real mosaic guard) never moved.
  It is normalised by range now.
- **THE RENDER TOOL'S CLOCK MUST BE PINNED** or you are comparing noise, not builds. (`reducedMotion`.)
- **Playwright MCP hangs on this app** (the ambient-room animations never settle). Use
  `scripts/dev-shot-brain.mjs`. **CDP `captureScreenshot` with a `clip` DROPS the WebGL layer → BLACK**;
  shoot full viewport and crop after. Playwright's own element-screenshot *does* capture WebGL fine.
- **`--cream-primary` IS NOT A TOKEN** (it is `--color-cream-primary`). Invalid var → text silently
  inherits, but `background-color` computes to **transparent**.
- **NO BACKTICKS IN THE SHADER** — they terminate the template literal and TS parses the GLSL as JS.
- **The dev server dies between long sessions.** Restart:
  `cd ~/virtuna-brain && NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack -p 3400`
  Login: `e2e-test@virtuna.local` / `e2e-test-password-2026`.

---

## §6 — STATE

`tsc` **0 errors** · `eslint` clean on touched files (the `AmbientRoom` `set-state-in-effect` errors
are **pre-existing**) · **115 brain/lens tests pass** · full suite **3,391 pass** (1 failure:
`api/tools/remix/run` SSE — **pre-existing, not ours**).

**Files this round:** `src/lib/brain/cortex-colormap.ts` (new) · `cortex-sim.ts` · `cortex-field.ts` ·
`components/audience-lens/CortexCanvas.tsx` · `BrainView.tsx` · both `__tests__` · `scripts/dev-shot-brain.mjs`

Committed as `1b21b3de`. **Not pushed. No PR.**
