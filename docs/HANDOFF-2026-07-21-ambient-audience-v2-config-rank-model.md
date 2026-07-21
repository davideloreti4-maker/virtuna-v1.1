# HANDOFF 2026-07-21 — Ambient Audience v2: the CONFIG + RANK model (concept decisions)

**Status: CONCEPT DECISIONS, not yet built.** This session was pure design discussion (owner-led)
about surfaces ④ Start + ⑤ Simulate and how the audience "fires." It **evolves L2 / L4 / L6** of
the architecture SSOT. No product code changed this session; the prior session's uncommitted work
(`AmbientSimulate.tsx`, `simulate-fixture.ts`, ④ Start refinements) is untouched and still uncommitted.

- Worktree `~/virtuna-ambient-audience-v2` · branch `design/ambient-audience-v2`
- Architecture SSOT: `docs/HANDOFF-2026-07-20-ambient-audience-v2-concept.md` (L1–L6 + laws).
  **The decisions below supersede the noted parts of L2/L4/L6.**
- Surfaces-built handoff: `docs/HANDOFF-2026-07-21-ambient-audience-v2-surfaces-built.md`
- Sketch (gitignored, served :8777): `.scratch/config-options.html` — the 3 decisions + firing lanes.

---

## The headline shift (the whole point of this session)

**The auto-audience on skills stops being a "reaction" and becomes a THIN RANK. A simulation is that
rank DEVELOPED into the full instrument.** This kills the old redundancy where the auto-reaction and
a deliberate simulation returned the same *kind* of result.

- **Rank** = one bare disposition (a number / position, maybe one word). The room's quick take on a
  skill's output. Small, fast, cheap. A **triage** instrument — answers *"should I bother / which one?"*
- **Simulation** = *developing* that rank into depth: population breakdown + brain/cortex + terrain +
  voices + the customizable lens. A **decision** instrument — answers *"why · who · how do I fix it?"*
- Same underlying judgment, **two resolutions**: the rank is the tip, the simulation is the iceberg.
  One is a *preview of* the other — not two versions of one result.

### Why this is a feature, not cannibalization
Users iterating (e.g. 10 hooks) don't want to pay to simulate all 10 — they want fast ranks to narrow
to the finalist, then develop the deep sim on the one they'll actually produce/post. The rank is the
**funnel that qualifies which artifact deserves a sim.** Monetization shape is healthier: retention on
free/cheap ranks, value capture at **peak intent** (ready-to-post), not nickel-and-diming iterations.

### The design lever that protects it: **keep the rank THIN**
The rank must *provoke* "why only 6? who didn't like it?" → develop. If it grows into a mini-report
(a reason, a segment split, a why) it *satisfies* too much and cannibalizes the sim. **Rank = the
hunger (one scalar, no explanation); Sim = the answer.** If develop-rate ever drops, the fix is almost
always "the rank is telling them too much" — thin it, don't remove it.

### The honesty law that makes it safe (owner flagged this as important)
The rank **must be a genuine preview the simulation REFINES — never contradicts.** A hook ranked 8/10
that develops to 3/10 destroys trust instantly. Engineering: the rank is the *headline of a real,
light run*; **develop = expand n + open the breakdown**, keeping the headline stable within its CI.
The rank *narrows into* the sim; it is never overturned by it. (= sealed-verdict / "modeled not
measured" law applied across the two tiers.) This trust is what makes triaging-without-simming a good
experience instead of a gamble.

---

## The locked model — invariants

1. **Skills auto-produce a THIN RANK** (unless silenced — see toggle). Nothing else auto-fires.
2. **Every full simulation is armed through ⑤** — the single universal develop/spend gateway.
   **Nothing ever auto-sims.** Even developing from a skill (lens preset) opens ⑤ *pre-filled*
   (one tap to run) — because ⑤ is the **spend moment**, it must always be visible + deliberate.
3. **Rank narrows into the sim, never contradicted** (honesty law above).
4. **Per-thread toggle** `auto-rank ON/OFF` lives on ④ Start / the persistent strip. OFF = the room
   stays silent until the user Screens (serves the "just give me quick outputs" user).

### This SIMPLIFIES the old L2
L2's fiddly three-way (auto-quip / one-tap-verdict / deliberate-Screen) collapses into a clean
**binary**: *automatic = the thin rank* · *deliberate = develop → ⑤ → sim*. This also **resolves the
old express-vs-deliberate open decision** — there is no straight-fire-to-verdict anymore; the only
automatic thing is the rank, and every verdict goes through ⑤.

### Maps onto surfaces already built (no new architecture)
- **Overview ranked list** (`Hook A ── 8/10`) **= the ranks.**
- **Detail (Brain | Audience) = the developed simulation.**
- **"develop the rank into a simulation" = the Overview → Detail drill-in that already exists**, with
  ⑤ inserted as the arm/spend step in between. The model *names the relationship* between the two
  surfaces already built; it doesn't add a surface.

---

## The three config decisions (from `.scratch/config-options.html`)

**D1 · ④ Start layout → Variant B (Societies-explicit).**
Standing **conditions block** up top (WHO · where · how — "Testing against") + the **skill/ACTIONS
grid as the hero** ("what would you like to simulate?"). Cockpit, not the greeting-hero-with-quiet-
furniture of the built version (variant A). Serif greeting demoted / folded.

**D2 · In-thread conditions → PERSISTENT STRIP (Fork A = B).**
A pinned one-liner at the top of the thread always answers *who · where · how* (`Your audience ·
TikTok · SIM-1 Flash`). Audience locked (L1); scene/model tap-to-change inline. Bends L6's "config
quiet after birth" only slightly — the strip is a *quiet always-on legend*, not a second loud config;
it serves L4's legibility test. Steals Artificial Societies' single best move (you never lose track of
which society you're testing). Replaces the "fade into tiny composer chips" behavior.

**D3 · In-thread config card → ⑤ arm-a-run (Fork B = iii).** The three candidates were a *sequence*,
not rivals:
- (i) **re-config scene/model** → **dissolves into the persistent strip** (tap inline). Not a card.
- (ii) **skill grid ("new test")** → a **launcher**, not config. Lives on ④ + a summonable in-thread
  `+`. Feeds ⑤.
- (iii) **arm-a-run = ⑤** → **THE config card.** Header = standing conditions (tap-to-override per
  L4), body = stimulus + lens + slice (+ scene/fidelity override). This is the one config surface.

### Skill scope: **PER-RUN, not thread-locked**
Skill is *chosen* per run (tap in the grid), never a form. Per-run is cheap because everything is
**inherited** (audience always; scene/model from the strip; skills preset lens+slice) — only the 1–2
genuinely-different things surface. Thread-locked skill was rejected: it rebuilds AS's one-test-per-
thread, the exact thing L1 killed. The audience is the thread constant; the skill is what varies.

---

## Firing model — the three lanes (see Section 4 of the sketch)

| Source | Auto | Develop → full sim |
|---|---|---|
| **Skill** (hook/script/test-a-video) | **thin rank** (fast/cheap; toggle to silence) | `develop ›` → **⑤ pre-filled** (lens preset) → sim |
| **Paste / custom object** (draft, competitor reel) | nothing | `Screen ▾` → **⑤** (pick lens) → sim |
| **Chat request** ("would skeptics pay $25?") | nothing | chat compiles a lens → **⑤ pre-filled** → sim |

⑤ is the constant in every develop path.

---

## Naming — OPEN (owner's call, park)
The light layer needs a word that is **NOT "read"** (Reading is already a skill / the read-family
cards). Candidates: **rank · pulse · first take**. Decide at build time.

## L-law reconciliation (what this session changed vs the SSOT)
- **L2** — evolved: reaction → *thin rank*; three-way firing → binary (auto-rank / develop-through-⑤);
  express-vs-deliberate open = RESOLVED (no straight-fire verdict).
- **L4** — intact; the strip owns thread config in ONE place, ⑤ overrides per-run (locked tap-to-
  override), nothing configurable twice.
- **L6** — bent slightly: adds the *persistent strip* (quiet always-on legend) alongside "loud once
  at birth." ④ Start moves to variant B.
- **L1 / L3 / L5 / laws 1–9** — untouched.

---

## Where to continue (options presented to owner at session end)
1. **Go deeper on this model (recommended):** sketch the NEW connective tissue — a **skill card
   carrying a thin rank + `develop ›` → ⑤**. It's the only part of the model that no built surface
   shows yet; seeing it confirms/breaks the "thin rank" feel (the make-or-break). Then rework ④ Start
   → variant B + strip + toggle, and wire the develop affordance into Overview.
2. **Refine the 5 built cards:** the P1/P2/P3 room-surface marks (Overview watching · Brain σ→plain
   words · terrain declutter) + ④ Start refinements.

**Coupling note:** the new model *changes the role* of ④ Start (→ variant B), ⑤ (→ develop gateway),
and Overview (→ ranks + develop affordance). Refining those now risks polishing a role that just
changed. The Brain σ→plain-words (P2) and terrain declutter (P3) depth refinements are **independent**
of the config/rank model and safe to do anytime. Recommended order: lock the model visually (option 1)
→ rework ④ → then P2/P3 depth refinement.

---

# UPDATE (later same session, 2026-07-21) — ④ Option 1, the Simulate door, and the DOMAIN architecture

## ④ Start — REFINED to "Option 1" (built variant B first, then rethought)
Variant B was built in code (`AmbientStart.tsx`) + verified live, then the owner pushed further. Decisions:
- **Auto-rank toggle → REMOVED. The thin rank is always-on**, intrinsic to every skill (the ambient
  soul + the funnel into a sim). A quiet-mode, if ever needed, is a Settings preference — never a
  start-screen dial. (Supersedes the invariant-4 "④ toggle" above.)
- **The ④ grid had a concept bug:** it mixed **MAKE** (skills — *Hook/Script/Caption*, content
  generation) with **TEST/ASK** (simulations — *test a video / ask the room*), under a header that
  said "simulate" over things you *make*. Skills and simulation are **different verbs** and must read
  as different verbs.
- **Chosen layout = Option 1** (sketch `.scratch/start-options.html`, owner picked over 2 zones / a
  Make|Simulate mode-switch): a **clean AS-style card** = the **Make skill grid** (grows by vertical)
  + composer, plus **ONE visually-distinct "Test something against your audience →" door**. Rationale:
  it scales — the Make grid grows while the single Simulate door stays fixed and unmistakably separate;
  Option 2's SIMULATE zone gets swamped as skills multiply, Option 3 buries sim behind a mode switch.

## The three kinds of action on the surface (the differentiation)
- **Skill** — structured maker in a vertical (grows a lot) → the Make grid. A thin rank rides every output.
- **General request** — free chat / paste → the composer.
- **Simulation** — the separate deliberate screening → **kept separate** (the door + the develop path).

## Where the Simulate door leads (cold-start intake → ⑤)
The door is only for the **cold-start** (no skill output to develop yet). Flow:
`door → intake ("what are you testing?" — a video/upload · a draft/paste · ask the room/type · survey/build)
→ collects the stimulus → **⑤** (the SAME arming gateway as develop-a-rank, entered cold) → Simulate →
① Overview watching → ② Detail`. The **primary** route to a sim stays *develop a skill's rank → ⑤*;
the door just adds an intake front-step because there's nothing to develop. Invariant preserved: every
full simulation is armed through ⑤. Nuance to resolve at ⑤-build: *screen* (video/draft → lens → full
brain/pop read) vs *query* (ask/survey → a lighter Q&A arm → a survey-results surface) may fork one
level down — both still simulations, different output surfaces.

## DOMAIN GENERALIZATION — the horizontal core + per-domain bundles (NEW design law)
The dilemma: the simulation should generalize across **every domain** (hook · video · pricing · A/B ·
product launch · market research), yet the **insight must be domain-useful**. Resolution = **layer it**,
don't choose:

1. **CORE (generalized · ONE build):** `population × stimulus × lens → per-agent dispositions` + the
   universal primitive kit (distribution · segments · cortex · voices · CI · percentile). Domain-agnostic.
   This is ⑤'s mechanics + the read's primitive library.
2. **LENS = the domain plug** (this is L4's "intent dissolves into the lens axis," generalized). The
   mechanism is one; the **lens SET is per-domain data**. Creator = stop/finish/share/follow/buy ·
   Pricing = too-dear/too-cheap/just-right/would-pay-$X · A/B = same lens ×2 comparative.
3. **READ = a domain TEMPLATE over shared primitives** — picks which primitives to show, how to label
   them, the headline metric. Creator template ships v1; pricing/A-B templates slot in later.

**A "vertical" = a config bundle `{ stimulusIntake, lensSet, readTemplate }`.** Adding a domain =
authoring a bundle, NOT rebuilding the engine — the same discipline as skills (add-a-skill = one meta
entry). A/B = the core run on **2+ stimuli** + a comparative read-template.

**The honest limit (the real cost):** generalization is **bounded by CALIBRATION.** The engine can run
any lens, but trust depends on whether the population is calibrated for that decision — a scroll-
calibrated audience can't credibly predict pricing willingness-to-pay. Reuse the scene-mismatch
guardrail one axis wider: `modeled · pricing decision · engagement-calibrated`. Some domains
(business/pricing/market-research) need their **own calibration source**. The moat is NOT "one sim
predicts everything" — it's **"one sim ARMS anything; calibrated audiences make specific domains
trustworthy."**

## Brain & Population = INVARIANT ROLES, swappable FIGURES (the resolution to "different stuff inside")
The content differs per domain (a demand curve ≠ an attention curve; A/B needs an overlay creator
content never has) — but the **roles are invariant, and they ARE the locked cascade:**
- **Brain answers *why*** (the cognitive cause) · **Population answers *who / how many*** (decision
  distributed over the society) · **Voices** = exemplars. Every domain has all three.
- What changes = **which figure fills each role**, drawn from a shared figure-library. Shared across
  domains: terrain · segments · voices · cast · ask-why chat. Domain-specific additions: demand curve
  (pricing) · comparative overlay (A/B) · reasoning clusters (survey).
- So it's a **platform + templates** — a new domain **inherits** the two-page why/who scaffold,
  cascade, society/cast/voices/chat, layout grammar, honesty laws, ⑤'s arming; it **adds** its lens
  set + intake + a template (which may bring 1–2 new figure-types). Never from scratch.
- **The fit-test:** a request belongs on Brain/Population only if it has (a) a cognitive cause, (b) a
  decision spread over a population, (c) exemplar voices. Pricing/A-B/product/"is this funny" ✓; a pure
  factual lookup ✗ (a different surface — don't force it in).
- **Build implication:** build the **creator template concretely + well (ship it)**, but structure
  Brain/Population as **role-frames filled by figures (slots + props)** — don't weld "attention curve"
  *into* the page; let the creator template *supply* it. Then domain #2 costs a template, not a fork.

## AUDIENCE SCOPE — beyond creators (product-scope note)
The users are **not only creators**: also **businesses, marketing agencies, and market-research** use
cases (the last is underserved so far and a deliberate expansion target). The domain architecture above
is what lets one product serve all of them — each gets a bundle + a domain-useful read, on the shared
platform. Design Brain/Population to deliver **max value per domain**, not creator-only.

---

## STATE at session end (2026-07-21) — code vs decision (READ THIS)
- **All decisions above are CONCEPT — mostly UNBUILT.** Sketches only; the sketches are gitignored in
  `.scratch/` (serve `cd .scratch && python3 -m http.server 8777`):
  - `config-options.html` — the 3 config decisions + firing lanes
  - `start-options.html` — ④ Start Option 1/2/3 (Option 1 chosen)
  - `domain-scaffold.html` — Brain/Population one-scaffold / per-domain figures (creator vs pricing + A/B + market-research plug-ins) — VALIDATED by owner
- **⚠️ CODE ↔ DECISION DRIFT on ④ Start:** `AmbientStart.tsx` currently holds **variant B** (built +
  verified live this session: conditions block + skill grid + auto-rank toggle). The DECISION then
  evolved to **Option 1** (clean AS card · skill grid + ONE "Test something →" door · **auto-rank
  toggle REMOVED**). So the fresh session must **rebuild ④ from variant-B → Option 1**. Fixture
  `start-fixture.ts` + dev wiring `page.tsx` are on the variant-B shape.
- **⑤ Simulate** (`AmbientSimulate.tsx`, prior session) is built but pre-dates the model — needs
  reframing as the develop/spend gateway + a **cold-start intake** (video/draft/ask/survey) + the
  domain seam (lens set = injected data, already is).
- **② Brain / ③ Audience** (`BrainTab.tsx`, `AudienceTab.tsx`) are built creator-specific — to become
  **role-frames (slots + props)** per the domain-scaffold sketch.
- **Everything is UNCOMMITTED** (this session + the prior ⑤/④ session). Recommend an atomic checkpoint
  commit before/at fresh-session start so nothing is lost.
- **Parallel-session boundary:** another session owns the **skill-card UIs + everything rendering in
  the product thread** (incl. the live thin-rank component — `● Strong 8/10 stopped · "…" · See the
  room →`). **Do NOT touch it.** The v2 surfaces here are a standalone dev route (`/ambient-v2`), not
  yet wired into the product — reconciliation is a later step.
- **Env gotchas:** macOS has NO `setsid` — launch dev with `nohup` (see below). Worktree needed
  `pnpm install` + a gitignored `.env.local` copied from a sibling. Gates: `tsc --noEmit` 0 · eslint
  clean · matte guard 38/38 (`node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts`).

## Next-session protocol (recommended sequence)
1. Read this doc top-to-bottom (esp. the UPDATE block + STATE above) + architecture SSOT (concept doc, L1–L6). Recall memory `ambient-audience-v2-concept`.
2. Relaunch dev on :3007 (`nohup node node_modules/next/dist/bin/next dev -p 3007 &`), open `/ambient-v2`. Serve `.scratch` on :8777 for the sketches.
3. **Step 1 (bounded warm-up): rebuild ④ Start → Option 1** — clean AS card, Make skill grid, the one distinct "Test something against your audience →" door, auto-rank removed. Verify live (Playwright DOM asserts; screenshots hang on this app).
4. **Step 2 (the payoff): restructure ② Brain / ③ Population as role-frames** (slots + props) per `domain-scaffold.html`; ship the **creator template** as template #1 on the platform. Then **reframe ⑤** as the develop gateway + cold-start intake.
5. Keep the r4 grammar laws + every invariant above (thin rank always-on · ⑤ = universal sim gateway · rank never contradicted by sim · domain core horizontal / bundle per domain · calibration-bounded honesty).

---

# BUILD UPDATE (2026-07-21, later same-day session) — Steps 1 & 2 BUILT + pushed

Checkpoint committed first (`a68e6431`, preserves variant-B ④ + ⑤ Simulate + this doc), then:

**Step 1 — ④ Start rebuilt variant-B → Option 1 (`227d3ac9`).** `AmbientStart.tsx`:
- auto-rank toggle REMOVED (`StartConditions.autoRank` dropped — rank is always-on, never a start dial);
- concept bug fixed — the maker grid no longer sits under a "what would you like to simulate?" hero;
  quiet **"Make something"** kicker over a 2-col grid (Hook·Script·Caption·Idea·Thumbnail·Repurpose);
- ONE distinct **Simulate DOOR** ("Test something against your audience →"); clean AS card shell;
- fixture reshaped to `{ makeLabel, makeSkills, simDoor }`; `onTestDoor` added; glyphs `idea`·`frame`.
- Live-verified (DOM asserts): toggle gone, Make grid + door present, composer "…or just ask".

**Step 2 — ②/③ Detail → role-frames + creator template #1 (`32eb84cf`).**
- **`domain-template.ts` (new) = the platform contract.** `DomainTemplate` bundles verdict +
  `BrainFrameData` + `PopulationFrameData`; swap slots are discriminated unions (`BrainDriver`,
  `PopulationMain`). A new domain = ONE template object (new figures into swap slots), never a fork.
- `BrainTab.tsx` → exports **`BrainFrame`** (slots: ● cortex · ◇ driver `BrainDriverSlot` · ◇ signals ·
  ◇ networks optional · ● ask-why `AskWhyStub` deferred/disabled · ● footer).
- `AudienceTab.tsx` → exports **`PopulationFrame`** (slots: ● terrain · ◇ main `PopulationMainSlot` ·
  ◇ segments · ● voices · ● footer). *(filenames unchanged; only exports renamed.)*
- `AmbientDetail.tsx` consumes a `DomainTemplate` (verdict label swaps per domain).
- `detail-fixture.ts` → **`CREATOR_TEMPLATE`** (template #1) — r4 values UNCHANGED, so the creator
  view renders **identically** (regression anchor). Live-verified both tabs; 0 console errors.
- Scope (owner-picked): **creator template only**; networks kept, ask-why deferred as a stub.

**Still OPEN after this session:**
- **Reframe ⑤ Simulate** (`AmbientSimulate.tsx`) as the develop/spend gateway + cold-start intake
  (video/draft/ask/survey) + the ⑤ screen-vs-query fork. Still on its pre-model shape.
- **Prove the swap with a 2nd DomainTemplate** (pricing: demand curve · resistance curve · WTP tiers)
  + a dev toggle — deferred this session; the seam is ready for it (add a `kind` + a template object).
- **P2/P3 depth refinements** (Brain σ→plain-words · terrain declutter) — model-independent, anytime.
- **Naming** for the light layer (rank · pulse · first take) — still owner's call.
- Wiring the v2 route into the product (later; parallel session owns the product-thread rank comp).

**Git tip:** `32eb84cf` on `design/ambient-audience-v2` (pushed to origin). Gates all green.
