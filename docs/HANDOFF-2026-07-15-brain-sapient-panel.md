# HANDOFF — Brain card, the Sapient 1:1 pass (2026-07-15)

**Worktree** `~/virtuna-brain` · **branch** `feat/audience-brain-panel` · **dev** `:3400` ·
**surface** `/dev/cards#room` · **base of session** `12b4e742` · **tip** `0b5b1546` (NOT pushed, no PR)

Continues `HANDOFF-2026-07-14-brain-sapient.md` (the §3 GAP LIST). Read that for the deep history;
this is what changed on 2026-07-15 and what is still not 1:1.

---

## §0 — OWNER STANDING INSTRUCTION (verbatim intent)

> "Make our model basically ONE TO ONE with Sapient. Audit, review, analyze, and adopt everything
> good, but make it as 1:1 as possible on the VISUAL. Keep it in our language so it matches the
> platform — otherwise it should be a copy."

Two owner decisions locked THIS session (both were the GAP-1 / GAP-5 open questions):

1. **THEME = CHARCOAL.** Do NOT flip the app light. Their app is near-white; ours stays flat-warm
   charcoal (`#262624`), brain in the near-black well. The ramp already pops on dark — no relight
   needed. So "1:1" means **structure / layout / type / the cortex itself**, rendered charcoal.
2. **MONO ALL-CAPS labels = REINSTATED.** Reverses the earlier "the mono caps are gone" call.

Owner's last words this session, on the nine-signal grid: **"not accurate to sapient."** See §4.

---

## §1 — WHAT SHIPPED (4 commits, all verified, none pushed)

| Commit | Gap | What |
|---|---|---|
| `891b6477` | **GAP-2** grain | The cortex now reads as a real scan, not gouache. |
| `cc21bdac` | **GAP-5 + GAP-4** | Mono ALL-CAPS on every chrome micro-label; honesty line promoted to caps. |
| `0b5b1546` | **GAP-3.4** | Sapient's nine-breakdown-signals grid, filled honestly. **← owner says not yet accurate.** |
| (GAP-1) | theme | Resolved to charcoal — no code. |

Verification each: `tsc` clean, brain + audience-lens suites green (**121 tests**, +6 new signal
tests), and I LOOKED at every render (`dev-shot-brain.mjs`). matte guard green (38).

### GAP-2 — how the grain was actually fixed (the important lesson)
The old code painted **continents** because of a "smooth = real, speckle = fake" rule. The reference
is fine-grained BUT smooth. The fix, measured not guessed:
- **`PARCEL_COUNT` 400 → 1200** (`cortex-field.ts`). Grain comes from FINER PARCELS.
- **`BLEND_R_IN_SPACINGS` 2.2 → 2.4** — kept SMOOTH on purpose. **Tightening it does NOT buy grain**
  — radius 1.3 blew the mosaic guard `maxSlopePerSpacing` to 2.85 (ceiling 1.0). The guard is
  **scale-invariant** at a fixed radius-in-spacings (~0.79 at 800/1200/1600 parcels), so you add
  parcels for grain and hold the radius for smoothness.
- **Two finer SMOOTH octaves** added to `parcelTexture` (`cortex-sim.ts`, `× PARCEL_MOTTLE = 0.5`).
  **Per-parcel WHITE NOISE was tried first and rejected** — same grain, hard borders, a mosaic. The
  reference is high-FREQUENCY, not high-randomness.
- **`SPAN_WARM` 0.4 → 0.33** (`cortex-colormap.ts`) so the warm tail reaches red and the pale-
  chartreuse pile spreads into gold/amber — measured back toward the reference with `hue-probe`.

### GAP-3.4 — the nine-signal grid (new files)
- `src/lib/brain/brain-signals.ts` — pure/SSR-safe. `modeledSignals(drive,duration)` → 7 network
  cells (peak modeled BOLD → 0..100, a DESCRIPTIVE level word); `voteSignal(...)` → real-vote cells.
- `src/components/audience-lens/SignalGrid.tsx` — the 3-col grid, charcoal.
- Wired into `BrainView.tsx`: built a `signals` useMemo, passed to `RoomReadoutPanel`, replaced the
  old core/reach two-card mini-grid.
- **Honesty design (do not undo without re-reading `room-readout.ts` §5):** modeled cells get a
  LEVEL word (commanding/holding/surging), NEVER a good/bad grade — scoring networks against a
  "what's good" threshold needs a benchmark we don't have. Only REAL-VOTE cells get verdicts.

---

## §2 — THE MEASUREMENT LOOP (use it; do not eyeball source)

```bash
# dev server (dies between long sessions — just relaunch)
cd ~/virtuna-brain && NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack -p 3400
# login e2e-test@virtuna.local / e2e-test-password-2026

# shoot the real WebGL render (Playwright MCP HANGS on this app — never use it)
OUT=/tmp/shot node scripts/dev-shot-brain.mjs
#   → /tmp/shot/app-room.png (both cards) · app-brain-sim.png · app-brain-grounded.png · app-cortex.png

# measure the cortex colour against theirs
node .planning/references/sapient/hue-probe.mjs \
  .planning/references/sapient/sapient-09-cortex-canvas.png /tmp/shot/app-cortex.png
```
**Fast grain/diagnostics sweep** (no browser): I used a throwaway vitest that builds the field and
writes `fieldDiagnostics` to `/tmp/grain.json` — recreate it to tune `PARCEL_COUNT` / radius / mottle
without slow shots. Its assertions: `maxSlopePerSpacing < 1.0`, `maxDecile < 0.55`, `range > 0.3`.

⚠️ `dev-shot-brain.mjs` element screenshots capture a TALL element — a long grid looks "clipped with
black below" in the single-card shot but is fine in `app-room.png`. Trust the room shot.

---

## §3 — WHAT'S LEFT ON GAP-3 (the result panel), in order

Reference IA, top→bottom (`.planning/references/sapient/sapient-{03,05,06,07,08,10}*.png`):

1. **Synced hero (GAP-3.1)** — `THE CLIP | LIVE CORTEX` SIDE BY SIDE, ONE playhead, one pause. Caption
   `7 NETWORKS · LIT AT T = 00:00`. **Ours stacks the stimulus BELOW the brain — this is the biggest
   structural miss.** Grounded-mode has a real clip; simulated shows the concept text in the clip pane.
2. **Transcript line** at the playhead, in quotes.
3. **HOW TO READ THESE NUMBERS** — expander row ABOVE the grid.
4. **THE NINE BREAKDOWN SIGNALS** — BUILT, but see §4 (not accurate yet).
5. **Per-second network σ bars (GAP-3.5 + GAP-6)** — 7 rows, z-scored vs THE CLIP'S OWN baseline,
   plain language (`+0.38σ · slightly above`), + a `WHY THIS SECOND` prose box. **HONEST IN GROUNDED
   MODE** (measured axis span 0.93 — real structure). ⚠️ In SIMULATED mode the BOLD barely moves, so
   z-scoring it manufactures signal — the trap `buildTrace §890` documents. So σ bars = grounded only.
6. **KPI heatmap** — 10 rows × one cell per second, WEAK→STRONG ramp. Same per-second data as σ bars.
7. **Attention curve** — we HAVE this (retention). Honest.
8. **Reward/"buy" curve** — no purchase data; only as a clearly-disclaimed reward proxy (limbic), or omit.
9. **Manipulation lens** — no such data; omit unless owner wants a disclaimed attention-capture read.
10. **GO DEEPER WITH AN AGENT** → Copy for Claude / ChatGPT / raw JSON. Honest export of our readout.

Owner's honesty ruling (2026-07-15): **"1:1 + honest equivalents, clearly marked modeled."** Build
their layout, fill with OUR real metrics, mark modeled clearly. Never fabricate a score.

---

## §4 — 🎯 WHY THE GRID IS "NOT ACCURATE TO SAPIENT" (start here next session)

Measured deltas, ours (`0b5b1546`) vs `sapient-03-result.png` / `sapient-10-expanded.png`:

1. **Cells are too DENSE.** Sapient cells are WIDE, SHORT, airy — big numeral, lots of whitespace, a
   couple of small lines. Ours are portrait and cramped because we put the full `MODELED … — NOT X`
   line INSIDE every cell. → Move the disclaimer behind a **`WHY THIS SCORE →`** affordance (which is
   what Sapient actually has in that slot), and let the compact cell breathe.
2. **Numeral too small.** Theirs is large and thin; ours is `26px`. Go bigger (~34–40px), thinner.
3. **The verdict word.** Theirs: `WEAKNESS / OKAY / STRONG` (a graded word, coloured). Ours: a level
   word for modeled cells. This is the honesty divergence — but the OWNER may want the graded look.
   Options: keep levels but style them in the exact colour/size slot; OR give modeled cells a
   graded-LOOKING but honest word. **Ask the owner which.** Do not silently grade a modeled network.
4. **Missing the surrounding structure** — the grid without the synced hero (§3.1), the
   `HOW TO READ THESE NUMBERS` row (§3.3) above it, and the σ bars (§3.5) below it does not read as
   Sapient's panel. The grid is one block of a tall panel; we've built one block.
5. **Not a clean 3×3.** Sapient is exactly nine in a tidy 3×3. Ours is 7 modeled + 0–2 vote cells =
   a ragged last row when votes are absent. Decide a stable nine (or make the ragged row deliberate).
6. **Header text.** Theirs `THE NINE BREAKDOWN SIGNALS`; ours `THE BREAKDOWN SIGNALS · MODELED + REAL
   VOTES`. Ours is honest but not their words — reconcile.

**Recommended next-session order:** (a) fix the grid per §4.1–4.3 and LOOK; (b) build the synced hero
(§3.1) — the biggest structural win; (c) σ bars (§3.5 + GAP-6). Ask the owner about §4.3 first.

---

## §5 — TRAPS CARRIED FORWARD (each cost real time)

- **A COMMENT IS NOT A MEASUREMENT.** Every constant changed this round had a comment asserting the
  OLD value's rationale; all were rewritten. Grep headers after any change.
- **The mosaic guard (`maxSlopePerSpacing < 1.0`) is a real test — do not relax it to pass.** It
  correctly rejects a tighter blend radius. Buy grain with PARCEL_COUNT instead.
- **`room-readout.ts §5` rejected the scored grid; `buildTrace §890` rejected normalized per-second
  series.** Both are honesty landmines. Modeled cells → levels not grades. Per-second viz → grounded
  only, with a flatness guard.
- **Playwright MCP hangs on this app.** Only `dev-shot-brain.mjs`. Element shots look black-clipped;
  use `app-room.png`.
- **Dev server dies between long sessions.** Just relaunch (command in §2).
- **Backticks in `git commit -m "…"` run as shell substitution** — dropped a word this session; had
  to amend. Use single quotes or no backticks.
- **CSS `uppercase` leaves textContent unchanged** — a11y text + `getByText` assertions survive. Good.
  But if you SHORTEN a label's text (I changed "Predicted cortical response · modeled" → "Predicted
  cortex" to stop it colliding with the clock), update the test that asserts it.

---

## §6 — FILES TOUCHED THIS SESSION

`src/lib/brain/cortex-field.ts` · `cortex-sim.ts` · `cortex-colormap.ts` · **`brain-signals.ts` (new)** ·
`src/components/audience-lens/BrainView.tsx` · **`SignalGrid.tsx` (new)** ·
`src/lib/brain/__tests__/brain-signals.test.ts` (new) · `src/components/audience-lens/__tests__/brain-view.test.tsx`

Reference captures + probes live in `.planning/references/sapient/` (do NOT commit their
`brain_mesh.json` / `roi_map.json` — research only).
