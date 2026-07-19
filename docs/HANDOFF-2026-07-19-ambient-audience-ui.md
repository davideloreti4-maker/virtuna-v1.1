# Handoff — Ambient audience production design pass (brain · people · population)

**2026-07-19 · branch `design/ambient-audience-ui` · worktree `~/virtuna-audience-ui` · dev :3050**
Feature commit `22ba99e2` (+ integration merge of main `d843a281`). Owner previewed live and
approved ("looks good").

## What this was

The three views of the ambient audience panel (`AmbientRoom` scales: **The brain ⇄ The people ⇄
The population**) reworked to a production bar — the quiet Anthropic/Perplexity register the rest
of the app has been converging on (Reading #327, Make cards #329, audience manager #333).

The audit was measured, not eyeballed (census script, see Harnesses):

| | before | after |
|---|---|---|
| Brain stack in the 340px rail | 1,302px | **887px** |
| Brain mono-caps text runs | 36 | **~11** (figure annotations only) |
| Brain distinct font sizes | 14 | ~8 |
| Population accent-painted elements | **82** (green+red checkerboard) | coral tail only |
| People `ask →` repeats | ×10 | hover/focus reveal + 1 teach line |

## The design language (applies to every Room view)

**Cream is the room; coral is where you lose them.** One diverging pair everywhere: anything
positive/neutral renders cream (the audience at rest); coral appears ONLY on the people being
lost — bounce dots, the bounce count, the crowd's tail, weakness flags, ≤40% meters. **Sage
(`--color-positive`) is evicted from the Room** — the AmbientRoom header's own locked dosage rule
("no green en masse; everything positive stays calm cream") had drifted into the code. The cortex
ramp is exempt (owner ruling 2026-07-14: a rendered specimen is not chrome).

Grammar: **a document, not a form** (the ranked view was the owner's named reference). Hairline
`border-t` sections with sans-caps kickers (`text-[10px] font-medium uppercase tracking-[0.12em]`),
no boxes-in-boxes; one focal frame per view (brain = the well; people = the voices; population =
the crowd field).

## Per-view

### The brain (`BrainView.tsx` + SignalGrid/HowToRead/SigmaBars/SignalHeatmap/AttentionCurve)
- **Legend + live marker moved INTO the well** (bottom-left, on black — where a figure's legend
  reads as instrumentation); unit shortened to `predicted BOLD` (the poles beside it carry
  "vs rest"). The **lag claim is a full-width caption under the well** — it truncated to "~5…" in
  the corner, and a load-bearing claim that cannot be read is not being made.
- **Scan clock (t/TR) is GROUNDED-only.** A hook has no 6.7 seconds; fake precision was the
  debug-panel smell. The word-by-word stimulus play stays (it drives the charm, claims nothing).
- **HRF trace is GROUNDED-only** — plotting the model's response to an invented 15s envelope is a
  manufactured signal (the same judgment `buildTrace` already passed on its first two series).
  Fills recolored cream/coral (ramp-end fills smeared brown at 13% alpha on charcoal).
- **THE ROOM (10 real votes) PROMOTED above every modeled section** and de-boxed. The card's
  hierarchy is its honesty spine: the true count may not whisper under nine modeled numbers.
  Objection verbatim is **serif** (the app's voice idiom); chip neutral-unless-weak; rewrite CTA
  neutral cream.
- **Nine signals: display tiles → index rows** (name · meter · value). The 36px numerals ×9 are
  gone; weakness flags coral (word + meter), strength is just a long bar — good news is not a
  colour. Derivation survives on each row's hover title. Section title "Signal breakdown".
- **HowToRead demoted** from the loudest boxed button to a quiet text disclosure, placed under
  the numbers it explains, just above the verdict.
- σ / heatmap / curve de-boxed to hairline sections; duplicate inner headers removed; sage → cream
  (bars, heatmap ramp, curve fill). Serif verdict + mono-caps honesty foot unchanged (locked).

### The people (`AmbientRoom.tsx` PeopleView)
- **Verdict is STRUCTURE:** two hairline groups — `Stopped · N` / `Scrolled past · N` — answer
  "which four?" at a glance (closes ambient-room §3.4 properly). Cascade replay fills the top
  group then the bottom; group counts are stable (from the full room) while rows stream.
- Identity dots: **cream for a stop** (spec restored — the code had drifted to green), coral only
  on a bounce. `ask →` reveals on row hover/focus; one teach line "Tap anyone to ask them why."
  replaces the ×10 repeat. The dashed absence pill (NoSourceNote spine) is untouched.

### The population (`AmbientRoom.tsx` PopulationView)
- Crowd field: **cream dots with the coral tail pooling at the end** — the bleed reads without a
  legend. Airier grid (5px dots · 3px gap).
- **The stats bar is DELETED** — it restated the exact split the field above it draws (the
  §3.2 / PR #306 "same fact, two sources" family). Headline stays: `600` cream serif / `400`
  accent-text serif.
- Segment meters cream; weak-spot names cream-secondary with the same coral person-dot the crowd
  and People rows use — one mark for "a person you lost", everywhere.

### Shared
- **Tab `Population · 1,000` → `The population`** — a hardcoded count beside a view whose real
  total varies (`real.total`) is a second source that can disagree. (The video-Read's embedded
  `AudienceLensContent` toggle still says "Population · 1,000" — different surface, out of scope,
  harmonize when it gets its pass.)
- Ranked meters: cream, coral only ≤40% — length carries the order, coral marks the problem.

## Proof
- tsc 0 · lens suites 10/10, 116 green (+ matte guard) — labels updated; the SignalGrid source
  guard REWRITTEN to the new contract (requires `data-signal-row`; bans tile grid, `text-[36px]`,
  `font-extralight`, per-cell WHY THIS SCORE). All fail against the old code by construction.
- Live `/home`, authed, SwiftShader WebGL, both breakpoints, **pre- and post-merge**: desktop rail
  324px (brain focus, all 3 tabs, 0 page errors, 0 h-scroll) · mobile 390 header sheet opens
  (lands on ranked overview per `initialCompareOpen` — expected), 0/0.
- Overflow probe at rail width across all 3 views: 12 flagged, all sr-only 1×1 mirrors (benign).

## Harnesses (in `~/virtuna-audience-ui/.scratch/`, gitignored)
- `audit-full.cjs` — full-height shots of all 3 views from `/dev/cards#rail-drill` (grows the box
  to unclip) **+ the census**: type combos, mono-caps counts, accent/green element counts per
  view. The census is what turned "looks busy" into 36/14/82.
- `audit-extra.cjs` — grounded-brain + ranked shots + the overflow probe.
- `verify-live.cjs` — authed `/home` DOM measurement at 1440 + 390 (minted `@supabase/ssr` cookie).
- Shots in `.scratch/audit/` (`v2-*.png`, `live-rail.png`).
- ⚠️ Dev server on :3050 kept dying between tool calls (detached AND run_in_background both);
  re-launch via `.scratch/start-dev.cjs` or a real terminal.

## Deliberately untouched
- Idle "Meet your room" state, stepper/score/concept header, switcher bar (all recently
  owner-approved), `PopulationSwarm.tsx` (video-Read surface — already cream-language),
  `AudienceLensContent.tsx`, PersonaChatDrawer.
- **Persona VOICE quality** (quotes read like a model grading homework) — owner-flagged, a PROMPT
  problem, explicitly out of scope of this design pass.

## ▶ Next
1. ~~Owner review~~ ✅ → PR → squash-merge to main (this session).
2. Embedded video-Read audience section (`AudienceLensContent`) — carry the same language when
   that surface gets its pass (label, sage swarm accents, panel grammar).
3. Persona voice prompt work (separate session, owner-scoped).
