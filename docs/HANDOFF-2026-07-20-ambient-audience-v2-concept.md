# HANDOFF 2026-07-20 — Ambient Audience v2: concept converged, discussion before build

**Status: CONCEPT ONLY.** Zero product code touched, zero commits to components. One design
session (this doc's session) took the ambient audience from "restart from zero" through 8 sketch
iterations to a converged concept. **Owner directive for the next session: START WITH DISCUSSION —
the owner has items to address before any execution.** Do not open product components, do not
build, until that discussion has happened.

- Worktree: `~/virtuna-ambient-audience-v2` · branch `design/ambient-audience-v2`
- Predecessor context: `ambient-room-concept-restart` memory (the failed pass-2 session) —
  its directive ("start from the job, 2–3 different concepts") was executed here.

---

## The concept (current state = v4 + v5 sketches)

### The instrument (v4 — `.scratch/rail-v4-cascade.html`)

The rail is a **simulation instrument**. Everything it watches is a **stimulus** (a hook, an idea,
a product, a competitor's reel — the rail has no content nouns anywhere). Every reading renders
the simulation **cascade, in causal order** (owner's mental model: simulation starts at the brain):

```
STIMULUS · <text> · Lens: <question> · <audience>
BRAIN        cortex figure (locked CortexCanvas rainbow) + 3 universal signal chips
             (attention · emotion · credibility)
POPULATION   one big outcome number (38.2% would stop) + rank vs own history (P82 · 4th of 41)
             + terrain map (persistent node layout, lit by the run)
VOICES       one serif verbatim + who it speaks for (Maya +253) · interview ›
footer       ≤2 ask-chips · ONE mono disclaimer line
```

- **One figure per level, <60 words of chrome per rail.** v3 died of caption overload — method
  captions only on load-bearing figures, sentence-case headlines, mono-caps for kickers/disclaimers only.
- **Fixed organs, states change intensity** (v2 law): at rest / watching / verdict all render the
  same slots in the same order. The cortex never moves — it rests, blooms in place during a run,
  becomes the replay+why after.
- **Terrain map**: nodes = your people (1 node = 10 agents), clustered by taste, SAME layout every
  run — content lights the map, never rearranges it. Per-cluster lit % = where it landed.
  Coral = only the loudest-no cluster (loss moves per stimulus — skeptics on the hook example,
  scrollers on the subscription-price example).
- **Watching (loading) state** — owner explicitly likes it: cortex lights, population fills with a
  ragged frontier, cast flips to "decided" one by one. **Verdicts stay sealed until everyone's in** —
  no fake early reveals (unseal progressively only if the engine ever streams real partial votes).
- **Cast** (recurring named personas, ~8–12 spanning the cohorts) + **interview ›** affordance =
  the persona chat surface. Brain's chat job = "ask why" (modeled signals explain, never overrule).

### The loop (v5 — `.scratch/thread-loop-v5.html`)

**A lens = Question × Audience.** The entire customization surface, built only from horizontal
primitives:

- Question: `stop · want · believe · share · buy` (+ `custom…` — free text compiled to nearest
  endpoint; v1 inclusion is an OPEN DECISION)
- Audience: all 1,000 · a segment · saved custom slices

Skills preset the lens (hooks → stop/all · ideas → want/all). Users override at handoff. Saved
lenses = the user's own verticals; **we never ship a creator lens.** Same mechanism as Sapient's
"+ Lens", multiplied by the audience axis they don't have.

**Thread ↔ instrument division of labor:**

| Surface | Role |
|---|---|
| Thread | **Lab notebook** — every screening drops a compact receipt card (stimulus · lens · number · one voice), persistent + addressable (re-screen, compare, open in room) |
| Rail | **Bench** — live state during runs, the latest reading after; never duplicates thread history |
| Chat | **Compiler** — "would the skeptics pay $25?" compiles to a lens and runs; rail elements prefill chat back (interview Maya · why P82) |

**Two verbs, one rule:** **Look** (free, automatic — the room turns to whatever appears/gets focus;
no verdict) vs **Screen** (paid, deliberate — lens picker → run → receipt + reading).
*No verdict without a run · no run without a say-so · anything can be handed off.*

**Vertical/horizontal split:** skill cards keep ALL content-specific detail (retention curves, beat
timelines, hook anatomy). The rail keeps only the disposition. "Left at 0:04" belongs to the test
card, never the rail.

---

## The journey — rejections that shaped it (do NOT re-propose these)

1. **A/B/C jobs-concepts** (reaction-layer-on-cards / objection-focus-group / pre-post gate) —
   rejected: all three killed the ambient presence to rescue utility.
2. Direction reset: owner wants the in-thread experience, Sapient screenshots as reference
   (`.planning/references/sapient/`, best = 03/05/07/10).
3. **3 visual languages** (`rail-concepts.html`): Census (crowd-as-material) ✓ owner liked ·
   Minutes (transcript) ✗ · Instrument (drop-off column) ✗.
4. **Census full rail** (`rail-concept-a-full.html`) — personas-as-zoom + brain-as-explanation.
   Feedback: too vertical (beat timeline leaked in), "just population."
5. **Horizontal six-slot** (`rail-horizontal.html`) — proof: same anatomy for hooks/ideas/idle.
   Feedback: brain + chattable personas went missing; loading state (liked!) missing.
6. **Room-states organism** (`rail-room-states.html`) — cast + pulse in all 3 states.
   Feedback: **slot order inconsistent between states** (cortex bottom in one, top in another).
7. **v2 fixed organs + node map + look/screen** (`rail-room-v2.html`) — better; feedback: UI text
   overload, no clear concept, and the cascade order insight: **simulation starts at the brain**.
8. **v3 scientific register** (`rail-instrument-v3.html`) — value density right (CI, percentile,
   distribution, coded reasons, MAE), but "completely overloaded with text, no structure."
9. **v4 cascade** — "seems cleaner" ✓ current best rail.
10. **v5 loop** — delivered end of session; owner has NOT yet given detailed feedback → next session.

**Owner's recurring constraints** (violate any of these and the iteration gets rejected):
- Horizontal, never creator-vertical. The model must simulate ANYTHING (hook vs product launch).
- Simulation cascade starts at the BRAIN level → population/personas.
- Clean UI: few words, clear structure, one strong element per section (Sapient's actual recipe).
- Brain + personas must be present AND chattable.
- The loading/watching state is a feature, keep it.
- 🔒 Cortex rainbow ramp is owner-locked (×4 rejections of mono) — never de-rainbow.

---

## Design laws locked this session

1. Cascade order: **brain → population → voices** (rail reads as the simulation's causality).
2. **Organs never move** — states only change intensity.
3. One figure per level · <60 words chrome · one disclaimer line · sentence-case headlines,
   mono-caps only for kickers/disclaimers.
4. **Cream is the room, coral is where you lose them** — coral = the loudest-no cluster + loss
   numbers only, one semantic zone per view.
5. **No verdict without a run, no run without a say-so** (look = free, screen = paid).
6. Stimulus/lens vocabulary — zero content nouns in the rail.
7. Sealed verdicts during watching — theater never fabricates.
8. Terrain layout is stable across runs — content lights it, never moves it.
9. Serif = voice only (verbatims); type floor 12px (the restart audit found 5 sizes below it).

---

## Data contracts the concept needs (sequencing, not blockers)

| Contract | Status |
|---|---|
| Split / voices / segments / signals per run | exists in engine today |
| CI on the outcome (bootstrap over agents) | cheap, data exists |
| Percentile vs own screening history | cheap join on run history |
| Per-agent response intensity (0–100) | partially exists (per-persona votes) — verify |
| Coded reasons w/ counts (objection clustering) | NEW — LLM work, same prompt surface as persona-voice problem |
| Standing findings ("numbers-first +9.8 pts, n=41") | NEW — LLM synthesis over history |
| Track record (7/9 directional, MAE) | NEW — prediction-vs-actual join (outlier-baseline work is adjacent) |
| Terrain map layout (taste embedding → stable 2D clusters) | NEW — from persona embeddings; must be stable across runs |
| Chat → lens compilation | NEW — chat-side intent parsing |
| Live fill during watching | only if engine SSE streams partials; else neutral fill + sealed caption |

---

## Open decisions (owner to call — raise in the discussion)

1. **Naming**: screen / screening / lens / the room — or unify on "simulate"?
2. **Picker behavior**: show picker on every Screen, or one-tap run with defaults + ▾ for override?
3. **`custom…` question in v1** — most powerful, hardest to implement honestly?
4. **Cast**: stable named 8–12 spanning cohorts (relationships compound) vs rotating witnesses?
5. **Mobile/fold order**: cascade puts the outcome number below the cortex — acceptable, or
   outcome-first on short viewports?
6. **v1 scope of rest state**: composition + cast only until standing-findings/track-record
   contracts land, or hold for them?
7. **Build target**: this concept replaces `audience-lens/` 3-tab AmbientRoom; the duplication set
   (`audience-presence.tsx` 998 lines, `AudienceLensContent`, `audience-orbit`, `audience-breakout`,
   `persona-cloud`) needs a reckoning plan at build time.

---

## Artifacts

Sketches (gitignored, live in THIS worktree's `.scratch/` — serve with
`cd .scratch && python3 -m http.server 8777`, may still be running):

- `rail-v4-cascade.html` — **CURRENT BEST: the instrument** (hook vs product vs rest)
- `thread-loop-v5.html` — **CURRENT BEST: the loop** (receipts + lens picker + bench)
- Earlier iterations (reference only): `rail-concepts.html`, `rail-concept-a-full.html`,
  `rail-horizontal.html`, `rail-room-states.html`, `rail-room-v2.html`, `rail-instrument-v3.html`
- Screenshots: `.scratch/*.png` (v1/v2 shots per iteration)
- Sapient reference shots: `.planning/references/sapient/` (01, 03, 05, 07, 09, 10)

Code that exists today (untouched, build-time context): `src/components/audience-lens/`
(AmbientRoom + BrainView + PopulationSwarm + CortexCanvas 🔒), `src/components/reading/`
(the Sapient-shaped report + retention-scrubber), `src/lib/room-contract/read-to-card-reaction.ts`.

---

## Next session protocol (owner directive)

1. Read this doc.
2. View `rail-v4-cascade.html` + `thread-loop-v5.html` (serve `.scratch` on :8777).
3. **DISCUSSION FIRST** — the owner has items to address. Do not build, do not open product
   components until the discussion concludes with explicit direction.
