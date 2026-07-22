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

---

# SESSION 2 (2026-07-20, same day) — ARCHITECTURE LOCKED

The owner-led discussion happened. The items below are **decided** — treat them as laws on par
with the Session-1 design laws. Reference material captured this session:
`.planning/references/artificial-societies/` (as-01…as-07: audience selector, actions menu,
survey form, TikTok sim results + variants + insights, survey results) and
`.planning/references/sapient/sapient-11…14` (result+live cortex, nine signals, raw network
activation, KPI heatmap + attention curve).

## Locked decisions

### L1 · Continuous threads, ONE audience per thread
- Thread = lab notebook bound to one room. Many experiments per notebook.
- Binding chosen at thread start (room chip default = calibrated audience), **hard-locked** for
  the thread's life. New audience = new thread. Confirmed implicitly by the first run's lens
  picker (which displays the bound audience) — no extra confirmation ceremony.
- Explicitly REJECTED: Artificial Societies' one-test-per-thread. Both competitors are
  single-shot instruments with no agent; Virtuna's moat is the continuous thread + chat compiler.
  (Note: AS is shutting down 2026-02-15 per their banner.)

### L2 · Reactions: two tiers, by cost truth
Today's auto-reaction on skills = a separate cheap Qwen call after generation (owner-confirmed,
NOT a generation byproduct). Decision:
- **Skills KEEP the automatic reaction call** — it is the Look/wow layer; a user starting a
  thread via a skill gets the room reacting with zero extra say-so. Qualitative quips, ambient.
- **Full verdicts (Screen) are on-demand everywhere** — the number/receipt/reading only exists
  when a screening deliberately runs. On skill cards: one-tap (skill preset the lens). On custom
  chat objects / pasted drafts / general requests: `Screen ▾` affordance (this closes the gap
  where custom requests had no path to the audience).
- Law survives: no verdict without a run, no run without a say-so. Skill invocation = the say-so
  for its bundled reaction only, not for a verdict.

### L3 · Two-page instrument: Brain | Population
- The **rail/receipt keeps the v4 cascade** (brain → population → voices) as the at-a-glance
  summary. Unchanged.
- Drilling in opens TWO pages (replaces the old 3-tab AmbientRoom):
  - **Brain** — Sapient-depth: cortex replay, signal breakdown, per-second activation,
    "why this second", ask-why chat. (= Sapient's entire product, see sapient-11…14.)
  - **Population** — AS-depth: terrain map, segments, attention splits, the cast, voices,
    interviews. Personas fold in here — they are the population at max zoom.
- Rail routing: brain figure → Brain page; outcome number / terrain / voices → Population page.
- Strategic frame: each page is a full answer to one competitor, one roof, one agent.

### L4 · Three-shelf configuration rule
**Configuration lives at the lifetime where it changes. Nothing is configurable in two places.**

| Shelf | Lifetime | Contents | Surface |
|---|---|---|---|
| Audience | slow, reusable | WHO: niche, description, segments, taste clusters, cast roster, saved slices, **provenance badge** ("calibrated from TikTok · 3d") | Audience page — ZERO run knobs |
| Thread | per conversation | room binding · **platform/scene** (TikTok / IG / none) · **fidelity** (Flash/Max) | Composer chips — sticky defaults, every run inherits |
| Run | per screening | question · segment · stimulus (+ tap-to-override inherited chips) | Lens picker / skill preset |

- **Audience-level `intent/goal` DISSOLVES into the lens question axis** (stop/want/believe/
  share/buy IS the intent, chosen per run). The audience-level field dies once lenses exist.
- **Platform splits into two concepts**: *provenance* (fact — what the audience was calibrated
  from; badge on audience page) vs *scene* (choice — how they encounter this stimulus; composer
  chip). Scene ≠ provenance ⇒ the rail's one mono disclaimer line notes the projection.
- Skills may auto-set the scene chip (TikTok Script action → platform=TikTok).

### L5 · Fidelity tiers: Flash n=1,000 / Max n=10,000
- Composer chip, thread default, per-run override in picker footer. Honest lever: bigger n =
  tighter CI, finer segment resolution, rarer voices — priced accordingly.
- **Receipts must carry the full config sentence incl. n** (`38.2% would stop · n=1,000 · Flash`).
- Terrain layout NEVER changes with n — same clusters, more agents per node (map thickens on
  Max; that's the felt upsell).
- Percentile-vs-history across mixed n needs a rule (open — see below).

### L6 · Start screen = the guided setup surface
- Principle: **configuration is loud exactly once — at the moment its container is born.**
  Thread defaults are loud on the start screen; runs are loud in the picker; after birth,
  config is quiet chips + the receipt sentence.
- Start screen composition: time-of-day hero · thread-default chips row
  (`in [room] · as [platform] · [Flash 1,000]`, pre-filled, tappable) · composer ·
  **ACTIONS grid** (the AS "what would you like to simulate?" moment = our skill menu,
  categorized, grows as verticals are added; each action carries a preset lens and may set chips).
- In-thread: same chips collapsed into the composer row; changing them changes defaults for the
  NEXT run; room chip is not changeable (L1).
- Legibility test the layout must pass: from any receipt a user can reconstruct every choice
  (room · scene · fidelity · question · segment) and each is changeable in exactly one place.

## What the competitor screenshots were mined for (steal list)
- AS Personal-vs-Target societies split → mirror as "Your audience" (calibrated) vs custom
  societies in the room picker taxonomy (as-01).
- AS actions menu → start-screen ACTIONS grid, at the skill layer, never the rail (as-02).
- AS variants panel (Original 64 → V1 77…, "Generate New Variants") → the score→regenerate→
  rescore loop; presentation reference for compare-receipts later (as-05/06).
- AS attention Full/Partial/Ignore tri-state → honest population-level split (as-04/05).
- Sapient nine-signals + per-second surfaces → Brain page depth reference (sapient-11…14).

## Opens RESOLVED (owner calls, later same session)

1. **Naming: "simulate"** is the verb. Fidelity tiers are model-branded: **SIM-1 Flash
   (n=1,000) / SIM-1 Max (n=10,000)** in the model selector.
2. **Custom question: IN for v1** — important. Compiles visibly to the nearest preset (shows
   what it compiled to). Preset set itself needs a design pass ("choose the best presets" —
   stop/want/believe/share/buy is the draft, not the decision).
3. **Cast: stable per audience.** 8–12 representative personas picked from that audience's OWN
   calibration roster (they're already custom-generated at audience creation), spanning segments,
   fixed thereafter across all threads using that audience. Per-run spotlight moves (strongest
   reaction gets the verbatim); the roster never does. New audience → new cast automatically.
4. **Brain-first everywhere.** Mobile fold keeps cascade order. Detail view = **tab 1 Brain,
   tab 2 Audience** (3 tabs → 2; "people" folds into Audience). Population elements (%, terrain,
   voice) deep-link into tab 2.
5. **Rest state = the overview's header, not a separate screen.** See state machine below.
6. **Number on skill cards: qualitative reactions only** — the % is reserved for deliberate
   simulations (today's Qwen quips carry no votes, so nothing is withheld).
7. **Percentile across fidelities: computed within same tier.**
8. **Scene mismatch: OPEN — owner wants explicit design thought** (disclaimer vs soft-block
   undecided). Park until the picker surface is designed.

## The panel state machine (locked)

**Overview is the room's home; the rest state is its header.** One screen, layered:

```
┌─ THE ROOM ─────────────────────────┐
│ composition strip · cast on call    │  ← rest state, always present ("hand it anything")
├────────────────────────────────────┤
│ THIS THREAD · N GENERATIONS         │
│ ▓▓▓ generating… cast deciding 6/10  │  ← running item = watching state IN PLACE (overview
│ Hook A ─────────────── 10/10  ›     │     doubles as the loading screen; sealed verdicts;
│ Hook B ─────────────── 8/10   ›     │     same watching grammar as the thread)
└────────────────────────────────────┘
```

- Empty thread → room header + empty list. Buildable now; standing-findings enrich the header
  when that pipeline lands (not a launch blocker).
- **Detail is always ONE stimulus** (never bundle N hooks onto one brain/population page —
  causality dies). Comparison lives at the overview level (the ranked list IS the comparison;
  a future compare-mode also lives there). Detail keeps the `1 of N ‹ ›` pager. Detail pages
  need NO empty states — unreachable without a generation.
- **Loading/motion requirement (owner):** detail modal + overview inherit the thread's
  watching-state grammar — visible progress, real state, motion as simulation physics.

## Premium-UI mandate (owner directive, verbatim intent)

The rebuilt surfaces are the HEART of the platform and must read as billion-dollar product
design — better than Sapient AND Artificial Societies. No AI slop, no overload, no cargo-culting
the existing pages. Process obligations: proper design thought per surface, self-review against
the design laws before anything ships, sketch-first iteration (the session-1 loop) for every new
surface, measured audits at build time.

### Design doctrine (holds for every surface)
1. One hero per screen — competing elements: one is wrong.
2. The biggest type is the answer the user paid for.
3. Motion is simulation physics, never transition candy — if it doesn't report real state it
   doesn't exist (covers the loading/progress requirement).
4. Space is the luxury — flat-warm matte, 6% borders, generous air.
5. Honesty as design — sealed verdicts, `modeled · not measured`, one mono disclaimer.
6. Words are the enemy — <60 words chrome, captions only on load-bearing figures.

### Per-surface bets
- **Brain tab** = out-Sapient Sapient: their report discipline + replay scrubber + a chattable
  why-loop they can't do.
- **Audience tab** = out-AS AS: terrain full-bleed as the canvas (their spatial drama), our
  stable geography + interviewable cast.
- **Overview** = the surface neither has (ranked notebook + room breathing at top) — the screen
  users live in.
- **Start screen** = the instrument at rest: cockpit, not dashboard.
- **Simulate sheet** = arming an instrument, not filling a form.

### Sketch order & state
① overview+watching ② Brain ③ Audience → ④ start screen → ⑤ simulate sheet.
**Rounds 1–4 of ①–③ iterated same session — CURRENT BEST: `.scratch/panel-v6-round4.html`**
(r1 `panel-v6-round1.html` → owner red-marks: invented chrome, prose, disclaimers-as-banners →
r2 `panel-v6-round2.html` app-grammar rebuild → owner blue-marks: header/pager off, terrain
split, voices thin, more depth wanted → r3 `panel-v6-round3.html` batch-strip header, one
connected society (commuter nodes), curve-as-scrubber, coded reasons ×counts → r4 competitor
re-audit deep-mine).
Round-4 grammar (owner-validated direction, not yet signed off): Sapient DE-BOX (hairline
dividers, no bordered tiles) · section = mono kicker + human question + owning number ("Where
attention holds · hold 38") · figures self-label with corner chips · tappable moment chips
(0:04 28) · staged watching (reading→brains→votes→verdict, sealed) · "＋ Test a new variant"
ghost row (AS loop) · "How to read these numbers ›" trust footer · curve owns attention (no
duplicate fact in signals) · ask-chips deleted from panels — they belong to the CHAT composer
(Sapient's own placement).
Key feedback laws learned: match the app's existing grammar, never invent chrome · data not
prose · disclaimers are inline tags, said once · one person never "speaks for" N — a CODED
REASON does, the persona is its exemplar voice.

## Still open / build-time
- Scene-mismatch treatment (design thought owed — resolved open #8).
- Best preset-question set (design pass with custom-compile in mind).
- `audience-lens/` dedup reckoning — build-time plan for the 3-tab AmbientRoom,
  `audience-presence.tsx` (998 lines), `AudienceLensContent`, `audience-orbit`,
  `audience-breakout`, `persona-cloud`.
- Verify: Qwen reaction-call cost at scale (L2 assumes unmetered-cheap) + what
  `read-to-card-reaction.ts` and the skill pipelines actually emit.

---

# NEXT SESSION protocol (handoff @ session-2 end, 2026-07-20 — design iteration MID-FLIGHT)

> ⛔ **SUPERSEDED 2026-07-21 — the sketch loop is CLOSED. Do NOT keep sketching.**
> After round 5 + a focused single-page pass, the owner ended the sketch loop (sketch fidelity ≠
> implementation fidelity) and chose to BUILD the three surfaces in code, anchored on **round 4**.
> **→ Follow `docs/HANDOFF-2026-07-21-ambient-audience-v2-build.md`.** Round 5 and the p1 pass are
> rejected. This section below is kept for history only. The ARCHITECTURE (L1–L6, laws, opens) above
> remains the SSOT.

**Where we are:** all product architecture is LOCKED (L1–L6 + resolved opens above). The premium
sketch iteration for the three core surfaces is in progress — 4 rounds done, owner marked up
rounds 1 (red = wrong) and 2 (blue = improve); **round 4 is delivered but NOT yet reviewed by
the owner.** Zero product code touched; all sketches gitignored in `.scratch/`.

1. Serve sketches: `cd .scratch && python3 -m http.server 8777`.
2. Open **`http://localhost:8777/panel-v6-round4.html`** — CURRENT BEST (overview + brain +
   audience). Rounds 1–3 files exist for diffing the journey.
3. **First move: owner marks up round 4.** Iterate in the same loop (owner screenshots with
   red/blue marks → translate every mark → next round → self-review against the doctrine +
   feedback laws BEFORE presenting).
4. After ①–③ converge: sketch ④ start screen (chips row + ACTIONS grid, L6) and ⑤ simulate
   sheet (question × segment picker + SIM-1 Flash/Max selector) in the same visual grammar.
5. Then: build planning (dedup reckoning for `audience-lens/`, data-contract verification).

**Read before sketching:** the "Design doctrine", "Per-surface bets", "Sketch order & state"
(round-4 grammar + feedback laws) sections above. Competitor refs:
`.planning/references/sapient/` (03/07/10 = deepest patterns: de-boxed tiles, human-question
sections, moment chips, staged run log, trust accordion) and
`.planning/references/artificial-societies/` (as-01…07: one-organism network, variants loop,
tri-state attention, insights/conversation).

**The loop's hard-won rules (violate = rejected, learned across 4 rounds):**
match the app's existing grammar, never invent chrome · data not prose · disclaimers are inline
tags said once, never banners · one person never "speaks for" N — a coded reason does · ask-chips
belong in the chat composer, not report panels · bordered boxes are slop, hairlines are premium ·
the terrain is ONE connected society · every section = kicker + human question + owning number.
