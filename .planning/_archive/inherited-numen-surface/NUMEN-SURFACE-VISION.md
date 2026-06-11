# Numen Surface — Rebrand & UX Rework Vision

> **Status: EXPLORATORY direction. Nothing locked.** Captured 2026-06-11 from a
> design/strategy conversation. This is the *input* for a future milestone's
> `discuss → roadmap`, not a plan. Sequenced to start **after mvp-ready Phase 1
> (engine) completes.** Treat every "lean" below as a starting position to
> pressure-test, not a decision.

---

## 1. Why this exists (the trigger)

The current UI/brand is heavily Raycast + Artificial Societies: dark, dense,
glass (5px blur everywhere), 6% borders, coral accent, Konva infinite-pan-zoom
board. It is coherent and well-built — but it stopped matching the product after
the **Virtuna → Numen** rebrand. The Raycast language says *"fast power-tool for
operators."* Numen wants to say *"trustworthy intelligence that reads your
content and tells you the truth."* The mismatch is the itch. The rebrand is a
**presentation-layer change**, not an engine change.

## 2. The fact that reframes everything

**Acquisition is mobile-first; powerusers get led to desktop.** The current
canvas board is a *desktop-poweruser paradigm* (Figma/Miro mental model: "here's
a spatial workspace, you explore the data"). It already needed a bolted-on
mobile card-stack *fallback* — the tell that the canvas isn't the natural mobile
form. If most users land on mobile, the canvas is the wrong primary surface, and
it also fights the brand: a canvas says *"you do the synthesis,"* the opposite of
an interpreter that does the work for you.

## 3. Core principle: it's a tool, beauty through restraint

**Function first. Calm and premium come from restraint and craft — not effects,
ritual, or mysticism.** "Oracle" is a useful *internal UX principle*
(verdict-first, did-the-work-for-you, trustworthy) — it must **never** become
literal mysticism on screen. An earlier exploration over-romanced this (temple /
light-as-presence / amber / solemn gravitas) and was explicitly cut as gimmicky.

**Anchor reference: WHOOP.** Numen = *Whoop for content.* Verdict-first (a
score + why + what to do), dark-neutral, calm but information-dense, sans-led,
and its only load-bearing color is the **functional verdict scale**
(Whoop's recovery green/yellow/red). That's the model.

Recalibrated reference set (serious tools, beautiful through clarity):
**Whoop, Linear, Things, Stripe, Apple-native, Perplexity/Arc (answer-first).**
Deliberately **away from**: the current Raycast/Artificial-Societies tool/sim
language, and the entire neon/purple/sci-fi "AI spaceship" category.

**Differentiation wedge:** every AI tool signals intelligence with neon
techno-futurism. Numen's wedge is **clean, calm, neutral, content-led** — the
anti-spaceship. Not spiritual; just restrained and confident.

## 4. Product surface architecture

The whole product collapses to **one thread per video**, where the AI's *first
turn is the Reading itself*. This consolidates today's three competing surfaces
(chat / board / cards) instead of adding a fourth:
- **Chat = the container** (the thread; the mobile-native spine).
- **Cards = the vocabulary** — existing card components become the rich message
  blocks inside the Reading turn.
- **Board = the desktop expansion** — the dense instrument, for powerusers only.

### The Reading (the oracle's first turn)
- It is the **same engine/frame data re-presented** in a compact, optimized,
  mobile-native layout — NOT new computation. A *composition* problem, not an
  engine problem.
- Solves the chat cold-start problem: the user never faces a blank prompt; the
  AI **pronounces first**, unprompted. Pattern = Arc "Browse for me" / Perplexity
  (synthesized answer first, dialogue second).
- **Stage-reveal, not token-typing.** At current ~45–60s pipeline latency, a
  dead spinner is a mobile bounce risk. The engine already runs in stages
  (analyze → hook → cf → script → post); each stage completing *materializes its
  block*. Latency becomes legible progress instead of dead time. (Stage-reveal
  of structured blocks — NOT chatbot text streaming.)
- **The verdict** sits in a reserved slot at the **top** ("throne"), visibly
  *forming* while evidence assembles below, then crystallizes last as the
  climax. Reveal builds *up* to the verdict; the settled document *opens on* it.
- **What the verdict says:** a **calibrated verdict band + one-sentence "why,"
  NOT a naked number.** ("This will likely travel — your hook earns the first 3
  seconds." / "Mixed signals." / "This won't spread — here's the one reason.")
  Honest about uncertainty, reads as judgment not metric, survives engine noise
  (scores are known-noisy, ~26–86). The number drops to supporting evidence.
  Confidence shows in the band's language, never as a hedge.

### Follow-ups + tools (the thread tail = the moat)
- After the Reading: **3–4 suggested follow-ups as taps, then free text.**
  Suggested prompts kill cold-start a second time and teach what the AI is good
  at; scope it to competence ("about this Reading / your content"), not an
  open assistant.
- Two species of follow-up:
  - **Instant** — re-interpret existing data ("why this score," "rewrite the
    hook," "highest-leverage fix").
  - **Agentic / tools** — go fetch more: **competitor analysis via Apify**,
    own back-catalog comparison, trends, best-post-time. Make agentic taps look
    different (they cost time + can fail).
- Tools turn the AI from *interpreter* → *investigator* — the real moat vs chat
  wrappers. Tool latency is forgiven inside a thread (a natural "working…" beat);
  **tool failures must be voiced in-persona, never red error-toasts.**

### App shell (wraps the per-video threads)
- **Home = a vertical list of past Readings**, each a compact verdict card, with
  one persistent "analyze new" action. Chat-app spine (list → conversation).
  Doubles as a portfolio of the creator's content intelligence over time; sets
  up cross-video insight later ("your hooks consistently underperform").
- **Entry ritual:** two ingestion paths — **(a) native share-sheet from
  TikTok/Reels** (the acquisition hero, lowest friction), **(b) in-app upload /
  paste URL.** Submitting kicks the stage-reveal immediately.
- **First-run:** **lead with a live demo Reading** on a recognizable viral
  video. Show the magic before asking for an upload. The Reading is the pitch.
- **Monetization** ("connect creators to monetization" is core value): an
  **oracle-initiated turn / tool inside the thread** ("your profile lands brand
  deals in X niche"), NOT a separate tab.
- **Per-video threads** (not one persistent relationship) — clean, focused,
  shareable. Cross-video patterns surface at the home/list level later.

### Desktop (poweruser)
- **Same thread, widened, + the instrument layer.** One product, two densities —
  NOT a separate app. Mobile = spacious *reading*; desktop = dense *instrument*
  (where density itself is the authority signal, à la Bloomberg/Linear cockpit).
- This is the **only** place the dense multi-frame board (today's canvas, or a
  dense linear successor) legitimately survives — for the ~10% who came for depth.

## 5. Brand / perception target

What Numen must communicate (in priority tension): **authority, calm, candor,
comprehension (understood THIS video), premium craft, native effortlessness.**

The audience is **ego-invested, anxious, time-poor, scroll-native creators with
elite visual literacy** — they judge against the most polished feeds on earth, so
**craft = credibility** and "corporate SaaS dashboard" reads as scam.

**Central resolved tension:** oracle-authority vs TikTok-native-light, and calm
vs creator-energy. Resolution → **"the calm room you step into, away from the
noise." The contrast is the value.** Calm wins, but must be *alive*:
**calm container, alive content.** The chrome recedes to near-nothing; the
**user's content (keyframes) + the verdict carry all the color and energy.**

Tone: **warm, confident mentor with weight** — not solemn/reverent (pompous =
death with creators), not a chummy buddy (no authority).

## 6. Component / design language direction (HELD LOOSE — do not lock)

This is a **ground-up component system**, not a retheme of the 36 Raycast
components. Old kit informs almost none of it.

**Derived from Numen's job, not borrowed from any reference.** The language falls
out of five functional demands of the product:

1. **The content must lead — chrome disappears.** The subject is the user's
   video; everything else recedes. → near-monochrome, low-chroma, low-contrast
   chrome. The single biggest driver.
2. **The verdict must be legible and trusted.** It IS the product. → one
   functional good/mixed/bad scale, prominent; everything else neutral so nothing
   competes with it.
3. **It must lower anxiety — calm + premium.** Anxious creator. → soft contrast
   (no harsh pure black/white voids), **warm** neutrals (warm = human/calming;
   cool = clinical), generous space, slow motion.
4. **It must read as credible to a high-taste eye.** → craft, consistency,
   typographic quality, zero cheap gradient/neon.
5. **Mobile-first, dense where needed.** → small-size legibility, sans for data,
   clear hierarchy.

**The language that falls out:**
- **Warm neutral greys, NO pure black** (from #3). Not the current cold
  `#07080a`. Base ~`#1a1714`–`#17150f`; panels 1–2 warm steps up
  (~`#211e1a`→`#2a2622`); text warm off-white (~`#f0ebe3`) + warm-grey muted.
  Contrast from elevation, not black voids. **DARK ONLY — no light mode**
  (decided 2026-06-11).
- **Color exists ONLY for the verdict + functional state** (from #1/#2). The
  load-bearing use is the **verdict scale**: muted green (travels) / amber
  (mixed) / clay-red (won't spread) — sophisticated, not neon. Everything else
  near-neutral so it can't compete with the verdict.
- **One restrained brand accent = coral matured to warm clay/terracotta**
  (evolve `#FF7F50`, don't kill it — continuity, not reset). Used sparingly:
  logo, primary action, focus.
- **The keyframes ARE the imagery/chroma** (from #1) — the user's own video
  stills are the only atmosphere (hero, accents, empty states). More Numen-native
  than any stock-photo reference; personal, ownable, already-extracted,
  impossible to clone. A load-bearing principle. Warm-neutral chrome makes the
  (often cool) content pop.
- **Sans-led** for everything functional; **serif reserved for the warm "voice"
  moments** — the greeting/hero and the verdict line (trust + human warmth where
  it counts). Cf. Anthropic app's serif greeting over a sans UI. Not decorative.
- **Component vocabulary:** soft/calm radii, **full-pill tool chips** (icon +
  label = the follow-ups/tools), circular icon buttons, hairline warm borders,
  soft elevation, generous spacing. **Glass becomes rare** — ephemeral elements
  only (composer, tool sheet); current 5px-blur-everywhere goes.
- **Motion:** calm, soft, never bouncy/snappy. The stage-reveal is the key
  motion moment. No "presence" theater.
- **Retire:** GlassPanel-everywhere, the Konva canvas board as the *primary*
  surface (→ desktop-only instrument), the chat *dock*, scattered hardcoded
  coral, and **fake macOS window chrome** (borrowed costume, no Numen-first
  reason).

> **On references:** the look is *earned from Numen's job*, and the references
> merely VALIDATE it — they are not sources. Anthropic's app confirms *warm
> neutral + no pure black*; WHOOP confirms *color-only-in-the-data*. **kero is
> NOT a source** — it was the conversation's spark, nothing more. We do not adopt
> kero's cool grey-green, its translucent-panels-over-photos staging, its stock
> imagery, or its window chrome. Any shape that overlaps (pills, composer,
> serif/sans split) is convergent good chat-UI practice, not a kero borrow.

## 7. The seam (why this sequences cleanly after engine work)

The Reading re-presents **existing engine output**. So:
- **mvp-ready Phase 1 (engine)** finalizes the *data contract* — grounding,
  determinism, honest banding, latency, drift. This is **paradigm-independent
  and prerequisite**: a confident verdict band demands a calibrated, honest
  engine, or the oracle confidently lies and trust dies.
- The rebrand only swaps *presentation*. Engine and surface don't entangle.
  Ideal milestone boundary.

## 7a. Engine findings this surface resolves (from mvp-ready Phase-1 audit)

The Phase-1 engine audit produced 47 findings (F1–F47; canonical catalog:
`virtuna-mvp-ready/.planning/phases/01-engine-pipeline/01-WALKTHROUGH-LOG.md`).
A cluster of them are **value/output-contract/user-facing** findings that should
NOT be fixed on the old board — they are **resolved by this surface design.** The
engine audit and the rebrand reached the same conclusions from two directions:

| Finding | Audit found | This surface resolves it by |
|---|---|---|
| **F36** (HIGH, open) | THREE parallel scorecards | Reading collapses to ONE verdict |
| **F41** (open) | "Verdict" tab shows *score* not verdict | verdict = band + why, not a number |
| **F45** (open) | score "/100" false precision | calibrated band; number demoted to evidence |
| **F38** (open) | engine jargon shown to user | calm restraint, plain language |
| **F43** (sched) | output bloat ~40 fields, ~10 valuable | Reading re-composes only value-bearing fields |
| **F37** (FIXED) | MOAT (Apollo insight) buried | insight = hero (aligns; keep) |
| **F39** (out-of-scope) | monetization value-gap | in-thread monetization tool |
| **F40** (deferred) | projected-views absent | strategic outcome model (still deferred) |
| **F32** (sched→P2) | board "what drives it" re-source | n/a on new surface |

These belong to the rebrand's **data-contract design**, not mvp-ready Phase 2.

## 7b. Carried forward from mvp-ready Phase 1 (preconditions + inputs)

Phase 1 is **code-complete (5/5 plans 01-01→01-05, unit-green, shipped+pushed)**.
Three items were deliberately deferred INTO this milestone rather than blocking
the engine close-out:

- **SMOKE GATE (hard precondition).** Before building any Reading-against-real-
  engine-output, run **one real-video E2E** that returns sane, honest output —
  confirms the "FIXED" findings hold live (F46/F47 read truncation, F22
  confidence, F23 §-cites) and yields the ENG-03 latency number. *Non-negotiable*
  — the stage-reveal + verdict premise rests on the contract being real. (Watch:
  **DashScope 429** risk on the live rig.) Early design/kit phases do NOT need
  this; only the data-consuming Reading build does.
- **UAT sign-off (can slip).** F42 permalink UAT (authenticated) + full
  measure-pipeline pass. Do during the milestone, not a blocker to start it.
- **ENG-06 D-12 = the data-contract design step (NOT a standalone session).**
  The "3-call prompt I/O co-review + consumed-vs-dead field prune (F27/F28/F43)"
  IS the same question as "what does the Reading consume." Fold it in here, driven
  by the surface's demand signal — don't do it twice. (The surface-independent
  sliver — prompt accuracy/token tuning — can ride along or be a quick later pass.)

## 8. Sequencing recommendation

1. **mvp-ready Phase 1 is code-complete** (5/5 plans, unit-green, shipped). Merge
   to main gated on the §7b SMOKE GATE only; UAT + ENG-06 D-12 carry forward into
   THIS milestone (see §7b), not blockers.
2. **Do NOT run mvp-ready Phases 2–5 as written** — they polish surfaces this
   rebrand replaces (Board/Test, Board/Remix, Chat dock, Raycast brand
   consistency). That's wasted work. (The milestone charter explicitly allows
   this: "requirements are a backlog, not a contract.")
3. **Launch the rebrand as its OWN milestone** (e.g. *Numen Surface* / v5.0),
   because it's a **net-new paradigm rebuild**, not the "brownfield refinement"
   mvp-ready is chartered as. Use this doc as the discuss/roadmap input.

## 9. Still-open decisions (forks not yet locked)

- Exact clay/terracotta hue for the brand accent + the exact verdict-scale
  greens/ambers/reds (calibration, not direction).
- Exact serif typeface for the voice moments (direction set: sans-led, serif for
  greeting/hero + verdict).
- How the Reading *settles* (moment reveal → document resting state) in detail.
- Shareability mechanics: exported image card vs link (the growth loop).
- Does the desktop instrument keep the Konva canvas, or a dense *linear*
  successor? (Be willing to retire the canvas entirely.)
- How much desktop diverges (lean: same thread widened, minimal divergence).

## References (VALIDATION only — the design is derived from Numen's job, §6)
- **WHOOP** — verdict-first; *color only in the data*; functional good/mixed/bad
  scale. The behavioral anchor ("Numen = Whoop for content").
- **Anthropic app** — warm neutral greys, NO pure black, soft contrast, one warm
  clay accent. Confirms the warm-neutral palette call.
- Linear, Things, Stripe, Apple-native — restraint/craft bar.
- Perplexity / Arc Search — answer-first posture.
- Spotify Wrapped — narrative + shareable structure, NOT the loud color.
- kero-ai.framer.website — **the spark only, NOT a source.** Do not adopt its
  cool tone, glass-over-photo staging, stock imagery, or window chrome.
