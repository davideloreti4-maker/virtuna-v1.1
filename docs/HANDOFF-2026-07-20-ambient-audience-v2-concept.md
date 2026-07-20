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

## Still open (decide before/at build)
1. **Naming** — screen/screening/lens vs "simulate"; also tier names (Flash/Max vs
   room-flavored).
2. **`custom…` free-text question in v1** — most powerful, hardest to do honestly.
3. **Cast** — stable named 8–12 vs rotating witnesses.
4. **Mobile fold order** — outcome number below cortex (cascade-pure) vs outcome-first.
5. **Rest-state v1 scope** — composition + cast only, vs hold for standing-findings/track-record.
6. **Number on skill cards** — L2 keeps skill reactions qualitative; if persona votes exist
   anyway, is the % shown or reserved for deliberate screenings? (Lean: show if it's mere
   arithmetic on existing votes; today's Qwen quips carry no votes, so likely moot for v1.)
7. **Percentile rule across fidelities** (P82 over mixed n=1k/10k histories).
8. **Scene-mismatch treatment** — disclaimer line only, or soft block.
9. **`audience-lens/` dedup reckoning** — build-time plan for the 3-tab AmbientRoom,
   `audience-presence.tsx` (998 lines), `AudienceLensContent`, `audience-orbit`,
   `audience-breakout`, `persona-cloud`.

## Sequencing note
Next: resolve opens 1–5 (product calls, owner), then plan the build. Verify at build time:
what the skill-reaction Qwen call costs at scale (L2 assumes it stays cheap enough to be
unmetered) and what `read-to-card-reaction.ts` + skill pipelines actually emit.
