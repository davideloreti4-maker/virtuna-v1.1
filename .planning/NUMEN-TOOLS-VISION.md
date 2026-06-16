# Numen — Creator Tools + Open Chat Vision

> **Status: EXPLORATORY — NOTHING LOCKED.** Captured 2026-06-15 from a
> design/strategy conversation. This is a *thinking* doc, not a brief.
> **Intent: revisit and walk through every section in detail inside the milestone**
> (discuss-phase), not treat any of it as settled. Where this conflicts with a
> later, deliberately-locked brief, the brief wins.
>
> Prereq: ships **on top of** the numen-rework Reading surface (v5.0, `main`),
> which it reuses heavily. See `NUMEN-REWORK-BRIEF.md`.

---

## 0. TL;DR — what this milestone explores

**Open Numen beyond "analyze a recorded video" into a creator *studio*: a suite of
tools that generate ideas/hooks/scripts/remixes, where the differentiator is that
*every output is tested on a synthetic audience (SIM-1) before the creator acts on it.*
Plus general chat that works with no prior video.**

The product stops being a single-purpose analyzer and becomes a guided
pre-production studio that ends in a prediction. Generation is the surface;
**SIM-1-on-everything is the moat.**

Product sentence (draft): *"The only place where every idea, hook, and script is
tested on a synthetic audience before you ever hit record."*

**Engine:** SIM-1 (the audience model) is the existing 10-archetype Fold, branded +
extended. Scoring engine stays frozen (3.19.0) as a substrate; new work is a
**generation + grounding + open-thread layer on top**, plus a fast text-mode SIM-1
tier. No changes to how a recorded video is scored.

---

## 1. Why — the expansion

- Numen today is hard-coupled to an existing video: no video → no value. That
  caps the funnel to creators who already filmed.
- The highest-leverage creator moments are **pre-production** (what to make, the
  hook, the script) and **trend-chasing** (I saw this blow up). Numen owns none yet.
- The moat (audience simulation) is reusable *earlier* in the workflow. "Test
  before you post" → "test before you **shoot**."
- Risk if done naively: become a worse ChatGPT. The defense is **grounding** —
  see §5, the heart of the milestone.

---

## 2. Working decisions (DIRECTIONAL — revisit each in milestone)

### 2.1 Naming system — "System A" (plain, output-noun)
Tools named by what the creator walks away with; brand voice lives in microcopy,
not tool names. Scales as tools are added (Captions, Repurpose just fit).

```
Ideas · Hooks · Scripts · Remix   →   Test
  ── generators (SIM-1 Flash inline) ──     (SIM-1 Max)
```

- **SIM-1** = the named synthetic-audience model (the moat, marketable). The
  10-archetype Fold, personified + extended.
- **Test** = the tool/action that runs content through SIM-1. (Replaces the word
  "Simulation" as a tool name — de-overloads it.) Keep the plain name "Test"
  (considered "Screen Test" — too cute).
- **the Reading** = what Test produces (today's numen-rework output, unchanged).

### 2.2 Two model tiers (quality AND latency)
- **SIM-1 Flash** — fast, text-only prediction. Powers inline scoring in Ideas /
  Hooks / Scripts / Remix. Reduced/no-thinking fold path (already the fast path).
- **SIM-1 Max** — full sighted pipeline (video). Powers **Test**. The complete
  Reading (audience cloud + retention + Apollo + drill-downs).
- **Both tiers must produce genuinely good simulated audiences** — the personas
  ARE the value, not garnish. Nailing Flash + Max audience quality is core scope.
- **Quality of Flash = right context + right persona framing** (the two levers):
  - **Mode-specific framing** — same 10 archetypes, different viewing-moment + question
    per tool: Hook = *"scrolling, first 2s, do you stop?"* · Script = *"watching, where do
    you check out?"* (per-beat) · Idea = *"in your niche, would this make you stop/share?"*
    One generic "rate this" prompt → the score-collapse failure. Framing IS the discriminator.
  - **Honesty boundary** — text predicts CONCEPT strength, not delivery. Persona reacts to
    the idea, not hallucinated execution. So **Flash = concept ceiling** ("worth shooting?")
    vs **Max = realized result** ("did execution hit the ceiling?"). Two honest questions;
    don't oversell Flash into view-count promises it can't back.
  - **Context discipline** — tight curated slice per task (niche + the idea the hook serves
    + relevant craft frame), NOT the whole profile/Knowledge-Core (dilutes signal). Same
    per-mode grounding-assembly work as the Knowledge-Core rebuild.
- **Latency pattern:** content-first, scores-stream. Generators render content
  immediately (one generation call); SIM-1 Flash scores fill in a beat later
  (progressive enhancement). Never block content render on the score.
- **Rule:** Flash auto-fills inline; Max is explicit ("Test it →"), never auto.

### 2.3 Thread model generalizes (grounded + open)
The numen-rework model is **one thread per video**. This breaks that:

| | Grounded thread | Open thread |
|---|---|---|
| Anchor | a real video's Reading | none (creator profile) |
| Entry | upload / URL → Test | composer prompt → a generator |
| Skills | operate on the Reading | operate on the topic |

Data-model change: `thread` gets a nullable `reading_id` + a `type` discriminator.
Composer becomes the **universal door** (re-justifies the composer-only home).

### 2.4 Thread = stream of messages; rich UI via typed renderers (NOT generative UI)
- A thread is a stream of messages; each message is **markdown** (conversational
  follow-up) **or** one/more **typed blocks** (rich tool output).
- Tool outputs render through a **fixed library of typed block renderers** — the
  numen-rework Reading block library, reused. **NOT** model-generated UI (that's
  the craft trap hit twice on landing-v2). **NOT** plain text (throws away the moat).
- Each tool = `{ promptTemplate, knowledgeBundle, outputSchema, renderer }`.
  Forced structured output → typed renderer; no schema → markdown fallback.
- The Reading stops being a special page and becomes "the blocks Test emits."
  One rendering system, multiple entry points.
- Renderer reuse: Test = full Reading set (reuse). Scripts retention = reuse.
  Hooks ranked-cards + Ideas cards = ~2 new renderers.

### 2.5 The five tools (specs are DRAFT — modes/copy soft clay)

**Test · powered by SIM-1 Max** — the tester / hero
- Promise (draft): *"See how it performs before anyone sees it."*
- Modes: Video (upload / TikTok URL) → full Reading · Concept/Script (text) → pre-flight
- Output: the Reading (= numen-rework output, unchanged)
- Flow: standalone, and the endpoint every chain lands on

**Ideas** — funnel top, open-thread entry
- Promise (draft): *"Ideas built from what already works for you."*
- Modes: Auto (from profile) · Seeded (you give a topic/angle)
- Output: idea cards (title · angle · *why it fits you*) + SIM-1 Flash viability hint
- Chain CTA: "Develop this →" (Hooks)

**Hooks** — generator + inline ranking (flagship moat demo)
- Promise (draft): *"Hooks ranked by who'll actually stop scrolling."*
- Modes: From an idea · From your own topic
- Output: N ranked hook cards, each with SIM-1 Flash pull-score + archetype grabbed
- Chain CTA: "Write the script →" (Scripts) / "Test full →"

**Scripts** — generator + diagnostic
- Promise (draft): Write = *"A full script, paced to hold them."* · Diagnose =
  *"Find the second they swipe away."*
- Modes: Write (from hook/idea) · Diagnose (paste existing script)
- Output: script doc (beats + timing) + per-beat retention markers (SIM-1 Flash) +
  line-edits in Diagnose
- Chain CTA: "Test it →"

**Remix** — possibly the strongest funnel entry (catch the trend impulse)
- Promise (draft): *"Make this viral video yours."*
- Flow: paste viral URL → decode *why it worked* → generate *your* version (your
  niche/voice, new hook + script) → SIM-1 Flash score → "Test full →"
- **NOT greenfield** — prior art exists: branch `milestone/viral-remix` (P1
  Ingestion + P2 Remix Mode COMPLETE), worktree `~/virtuna-viral-remix`, plus
  `milestone/viral-remix-adapt`. **Action: scout that code for reuse before any
  rebuild.** Reviving beats rewriting.

### 2.6 Engine
SIM-1 Max scoring path frozen (3.19.0). New engine work is additive:
**SIM-1 Flash text-mode** (personas reacting to text, no video) + generation calls.

---

## 3. User journeys (to pressure-test)
- **"I have nothing"** → Ideas → pick → Hooks (scored) → pick → Scripts → film → Test
- **"I saw this blow up"** → Remix → your version → Test
- **"I have a script"** → Scripts (Diagnose) → fixes → film → Test
- **"I have a video"** (today's core, unchanged) → Test
- **"Just give me hooks"** → Hooks → done

Four+ entry points, one spine. The **chain CTAs are the product** — they turn a
menu of tools into a studio that flows.

---

## 4. Grounding stack — THE value (priority-ordered, Davide's steer)

> "The knowledge grounding is the foundation for everything." Output quality is THE
> value. This is a **content/curation workstream first, code second.**

**Priority order (highest first):**

1. **Knowledge-Core — the foundation. Likely a ground-up REDO.**
   - Today's `KNOWLEDGE-CORE.md` is a **scoring brain** (Signal·Mechanism·Bands,
     rubrics, calibration anchors). Generation needs **generative craft**, which is
     a different shape. Pointing the scoring core at generation → competent but
     generic = the commodity failure.
   - **Restructure from scratch** to serve ALL modes (5 tools) **+ general chat**
     correctly — a general base grounding shared across modes, then per-mode slices.
   - This is the single most important asset in the milestone. Everything sits on it.

2. **Live context** — where customization comes from.
   - Per-request input ("Ideas for a video about unknown gym facts") + the
     persistent profile (niche, audience, goals, wins/flops).

3. **Creator voice** — LOW reliability; use cautiously.
   - Starting creators have no/weak voice. **Never depend on it.** Graceful
     degradation when absent. A bonus when present, not a foundation.

4. **Exemplars — DEPRIORITIZED.**
   - `training-data.json` (2.6MB, currently unused) is **old data** — a liability,
     not an asset. Do **not** lean on it. Build generative craft **correctly and
     fresh, directly into the new Knowledge-Core**, rather than retrofitting stale
     scraped exemplars.

**Quality loop — SIM-1 as its own judge:** generate → SIM-1 Flash scores →
surface high-scoring outputs / regenerate weak ones. SIM-1 is both the ranker the
user sees and the internal quality gate. *Don't ship ungraded generations.*
(Depends on SIM-1 Flash text-fidelity — see §6.)

**Make grounding legible in the UI:** when an idea says *"because your audience is
18–25 gym beginners and your last 3 myth-busting videos overperformed,"* the user
*feels* the personalization. Surfacing *why* an output was made is what visibly
separates Numen from ChatGPT.

---

## 5. Onboarding / creator profile (three tiers)

Sources stack; they don't compete. Resolution = (A persistent) + (C derived)
merged, B overlays per-request.

| Tier | Source | Nature | Status |
|---|---|---|---|
| **A** | interview cards (compact) | persistent, structured | exists (`creator_profiles`, 9-card) |
| **B** | custom input per request | ephemeral | trivial |
| **C** | link social → Apify scrape | derived, auto-prefills | Apify already wired |

- **Onboarding lives in onboard, but compact** — shorten the 9-card; never a wall
  before value; scrape-prefill where possible.
- **Tier C = metadata-only if quality sufficient** (cheap); fall back to pulling
  video only if metadata too thin. Apify `ApifyScrapingProvider` exists (TikTok-URL
  mode). v1 = scrape → summarize into profile fields (stuff), not retrieve.
- Cold-start (no account, no cards) → platform baselines, graceful-degrade (engine
  already does this).

---

## 6. Risks / de-risk before full build (spikes)
1. **SIM-1 Flash text-fidelity** — does a text-only fold predict pull well enough?
   **Gates the entire inline-scoring + self-judge architecture.** Cheap fold smoke
   test first (cf. fold-validate-cheap-first). Davide's read: it'll predict fine —
   but verify before promising scored hooks. **First real engineering work.**
   **NOTE:** the spike's real question is *"what framing + minimal context makes text
   scores discriminate?"* — test 2-3 framings, don't conclude RED from one naive prompt
   ("text fails" ≠ "text fails with a flat generic frame"). The winning framing becomes
   the spec for every inline score. Verdict needs: ranking correlation (Spearman) vs known
   outcomes + score separation + same-input stability.
2. **Generation-grade Knowledge-Core** — the rebuild (§4.1). Content workstream;
   the long pole; THE value. De-risk with a small authored slice + eval early.
3. **Remix reuse scout** — assess `milestone/viral-remix` before rebuilding.

---

## 7. Open questions (NOT resolved — for the milestone)
- Exact tool modes, copy, promises (all draft above).
- Knowledge-Core new structure: shared base + per-mode slices — what's the schema?
- How SIM-1 Flash text-mode personas are prompted (the 10 archetypes currently
  react to video segments; need text-mode reactions).
- "Test" vs flavored alternatives (leaning plain Test).
- Does Remix decode reuse the engine's analysis path or the viral-remix code?
- Buyer: creators-only for this milestone (brands = separate brand-profile entity,
  deferred) — confirm.
- v1 tool subset vs all five at once.
- Where RAG eventually enters (retrieval over the creator's OWN scraped history /
  exemplar selection) — deferred until usage accumulates; not v1.

---

## 8. Launch mechanics (when ready)
1. From trunk `~/virtuna-v1.1/` on `main`, `/gsd-new-milestone`, feeding this doc
   as discuss input (NOT as a locked brief — walk through every section).
2. New worktree + branch off `main`; clean scoped `.planning/`.
3. Builds on the numen-rework Reading surface; reuses its block renderers.
4. SIM-1 Max scoring frozen 3.19.0; new work = SIM-1 Flash text tier + generation +
   open-thread + grounding rebuild.
