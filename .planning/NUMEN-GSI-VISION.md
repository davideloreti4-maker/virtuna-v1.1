# Numen — Generalized Special Intelligence (GSI) Vision

> **Status: EXPLORATORY — NOTHING LOCKED.** Captured 2026-06-25 from a
> design/strategy conversation. A *thinking* doc + discuss-input, not a brief.
> **Walk through every section inside the milestone** (discuss-phase); where this
> conflicts with a later deliberately-locked brief, the brief wins.
>
> **Committed direction:** B-from-the-start (see §2) — position Numen as a 1B
> company by being **horizontal from day one**, not by going vertical-first.
> Extends `NUMEN-TOOLS-VISION.md` (the creator studio) and reuses the
> `NUMEN-REWORK-BRIEF.md` Reading surface. The creator studio becomes **Anchor
> Pack #1**, not the whole product.

---

## 0. TL;DR — what GSI is

Numen's engine is not "analyze TikToks." It is three **domain-general** cognitive
primitives currently pointed at one vertical:

- **PROFILE** — evidence → a model of a person/group (build a population)
- **SIMULATE** — population + stimulus → reactions (run the population)
- **PREDICT / READ** — reactions → a scored verdict (collapse to an answer)

They already **chain** in the live pipeline (profile builds the audience → simulate
runs the video → predict scores it). Re-seen for what it is, Numen is a
**synthetic-population simulator** — *the foresight layer for any decision.*

**Generation is owned (OpenAI/Anthropic). Calibrated populations you can
interrogate are an open, ownable category.** That category is the 1B framing.

The unifying primitive is **NOT** "predict/profile/simulate anything." It is:

> **Give me a population (or evidence of one) + a stimulus, and I'll simulate the
> reaction and score it.**

Generalizing Numen ≠ answer arbitrary questions. It = **let users define arbitrary
populations and arbitrary stimuli.** That filter is what keeps GSI from becoming a
worse ChatGPT.

---

## 1. The example filter (what's Numen-shaped vs not)

Sort any use case by **where the grounded population comes from**:

| Example | Primitive | Grounding source | Numen-shaped? |
|---|---|---|---|
| Profile an ex's WhatsApp chat | PROFILE | the uploaded data IS the grounding | ✅ Strong |
| Simulate reactions to a job application | SIMULATE | authorable target population (recruiter panel) | 🟡 Works if population is built/grounded |
| Predict the Iran war outcome | open-world PREDICT | **none you own** — pure forecasting | ❌ No moat (worse Metaculus/ChatGPT) |

Profile and Simulate generalize because they carry their own grounding (uploaded
evidence, or an authorable target population). **Open-world prediction with no
owned population is the seductive trap — it feels the most "AGI" and has the least
defensible structure.** It stays OUT (see §8).

---

## 2. The 1B-from-start design — horizontal without faking depth

Three things are horizontal **day one**:
- **Category** — "the synthetic-population simulator / foresight layer," not "AI
  content tool #400." Net-new category = the 1B claim.
- **Architecture** — the engine/pack seam exists; nothing socials-specific is baked
  into the core (see §5–6).
- **Product surface** — the user can point it at domains Numen never authored (§3).

One thing **cannot** be horizontal day one, and pretending otherwise is the death
already on record (`AS competitor shut down — moat > breadth`):
- **Authored depth.** No small team deeply calibrates 8 domains at once. Every
  horizontal platform that hit 1B launched with ONE thing that visibly worked
  (AWS = S3+EC2, Stripe = card payments for devs, Figma = one editor). Horizontal
  lived in the *category + architecture*; depth was a wedge.

**The rule that keeps B survivable: breadth in the surface, depth in the anchor.**
Ship the horizontal engine + BYO-SIMs + marketplace, but keep **1–2 anchor packs
calibrated and visibly "Validated."** Anchor packs are the credibility that proves
the engine isn't a horoscope. Never let an unvalidated SIM wear the Validated badge.

---

## 3. The unlock — the *user* brings the grounding (two-tier model)

Grounding is expensive **because Numen authors it**. Flip it: let the **user define
the population and the success criteria**, and the engine is horizontal *for free*
(BYO-domain). This is Profile-from-evidence promoted into the core product. Two
grounding tiers, both shipping:

| | **Anchor packs** (Numen-authored) | **User-built SIMs** (BYO-grounding) |
|---|---|---|
| Grounding | deep, calibrated, validated | shallow, user-supplied |
| Domains | 1–2 (Socials now, Marketing next) | infinite tail (recruiters, your ex, voters, customers…) |
| Cost to Numen | high (the moat investment) | ~zero (user/data supplies it) |
| Trust label | **"Validated"** — calibration-backed | **"Directional"** — honest about being ungrounded |
| Role | showcase + credibility anchor | horizontal breadth + the 1B TAM |

The breadth comes from the crowd, not Numen's authoring backlog. The honesty
(Validated vs Directional) turns the grounding gap into a feature — **the
calibration layer is the moat even over user content.**

---

## 4. The marketplace flywheel — SIM as hero object

```
User builds a SIM (population)  →  runs stimuli through it  →  gets a Read
        ↑                                                          ↓
   shares / sells the SIM in a marketplace  ←  outcomes feed back, SIM improves
```

- **SIM = the hero object and the unit of the marketplace** — a named synthetic
  population anyone can build, run, share, sell. (Matches the brand spine: *SIMs =
  user-built audience personas, hero object.*)
- **Network effects:** more users → more SIMs → more domains → more outcome data →
  better-calibrated SIMs → more users. The crowd grounds the horizontal Numen
  can't author.
- **Moat is three-layered:** (1) the calibrated engine, (2) proprietary calibration
  data on anchor packs, (3) the SIM marketplace + outcome flywheel. Layers 2–3 are
  what make it un-cloneable and 1B-shaped — not the model.

---

## 5. The hard engine bet (the core technical risk)

Generalization narrows — **verified against the live codebase (§6)** — to exactly
two things. Everything else is built.

1. **Pluggable population.** `audiences` today hardcodes socials enums
   (`platform IN tiktok…`, `goal_intent IN grow|sell…`) + 4 fixed PersonaWeights
   (`fyp/niche/loyalist/cross_niche`). The `signature` jsonb (reactors +
   reaction_frame + evidence + provenance) **already generalizes**; the relational
   enums + 4-weight model are the socials lock to factor into a pack.
2. **Pluggable scoring — the deep one.** Today the verdict is hardwired to socials:
   Apollo dimensions + `overall_score = follower_count × quality read` +
   anti-virality gate (aggregator.ts ~66K, apollo-core.ts ~31K). A horizontal engine
   **cannot hardcode "virality."** The success metric must be **supplied by the pack
   or the user** — "% of recruiters who advance you," "sentiment/intent of your ex,"
   "purchase pull of this ad." The Fold reacting to an arbitrary stimulus with a
   **swappable success criterion** is the whole engine generalization.

A **Domain Pack** is the abstraction that holds the socials-specific half:
```
DomainPack = {
  populations:   archetype templates (10 audience archetypes → recruiter panel → …)
  grounding:     the Knowledge-Core slice — what "good" means here, mechanisms, bands
  stimulusTypes: what you feed it (video / script / pitch / message / decision)
  reactionFrame: per-mode viewing-moment + question ("scrolling, first 2s, stop?")
  scoring:       the success criterion + aggregation for this domain   ← the new seam
  outputSchema:  + renderer for this domain's Reading
  calibration:   known stimulus→outcome pairs that validate the pack
}
```
Today there is **exactly one pack ("Socials") hardwired into the engine.** GSI Phase 0
is **extraction, not addition**: pull the socials assumptions into Pack #1 on a
domain-blind engine. The day Socials is "just Pack #1," Numen is horizontal-capable —
and can stay *positioned* as a creator product until Pack #2 is grounded. **Horizontal
is a refactor, not a repositioning.**

---

## 6. Verified architecture reality (2026-06-25 — what already exists)

The rails are further along than the thesis assumed. Verified on `main` +
`rework/engine-core`:

**Already shipped (horizontal-ready):**
- **Universal-door thread:** `threads.type` (`grounded` | `open`) + nullable
  `reading_id` (`src/lib/threads/threads.ts`, migrations `20260617/18`). Open threads
  (no anchoring video) already modeled.
- **Typed-block renderers:** `src/lib/tools/blocks.ts` + `block-registry.ts` +
  `chain-handoff.ts` (`SkillId`). General tool→renderer abstraction is real (NOT
  model-generated UI). Reading blocks reusable across packs.
- **Persisted population object:** `audiences` table (migration `20260619`).
- **Profile-from-evidence (socials version):** `creator_persona` jsonb auto-derived
  from scrape + transcripts + watchNotes (migration `20260624`).

**In-flight on `rework/engine-core` (11 commits, NOT merged) — this is GSI Phase 0:**
- **`AudienceSignature`** (migration `20260624`, `signature` jsonb): bake-once
  (temp 0 + seed), scrape-derived, **10 reactor personas w/ reaction_frame +
  evidence + provenance**, derived weights, summary. **This IS the SIM primitive.**
- **Drift re-bake cron** (re-calibrates the frozen signature over time) — the
  trust-maintenance mechanism.
- Weighted-SIM aggregation spec, engine dead-code cuts (G1/G2), CSRF hardening,
  dissection docs (`docs/subsystems/audience*.md`).

**The socials lock (must generalize):** `audiences` relational enums + 4-weight
model (§5.1); Apollo/virality scoring (§5.2).

> **Implication:** the single hardest GSI bet — a real, persisted, **deterministic,
> provenance-backed, re-calibratable** population object — is ~60% built on
> `rework/engine-core`. It is not a competing track to stop; it is GSI's foundation.

---

## 7. The make-or-break open question

**How does a user build a *trustworthy* SIM with no calibration data?** This gates
the entire BYO-grounding surface (§3). Partial answer already exists in the
AudienceSignature design and should generalize:

- **Determinism** (temp 0 + seed, bake-once) → a SIM is stable, not a dice roll.
- **Provenance** (every reactor carries its evidence) → the user sees *why* the SIM
  believes what it believes; ungrounded personas are visibly ungrounded.
- **Drift re-bake** → a SIM improves as outcome data arrives (the flywheel, §4).
- **Trust tiering** (§3) → Validated (calibration-backed) vs Directional (signature
  without a calibration set). Honesty as a feature.
- **Optional self-calibration** → let a user upload their own outcome history to
  promote a Directional SIM toward Validated.

De-risk this with a small spike before committing the marketplace surface.

---

## 8. What stays OUT

**Open-world prediction** (Iran war, election-without-a-poll, "will X happen"). No
population to simulate, no stimulus, no owned calibration → no moat. It feels the
most "AGI" and is the least defensible. If ever wanted, it's a *separate forecasting
product* (Metaculus-shaped), not this engine.

---

## 9. Sequencing / worktree plan

**Do NOT stop engine-rework.** `rework/engine-core` is GSI Phase 0 (§6). Order:

1. **Land `rework/engine-core` → main.** It de-risks the single hardest GSI bet (a
   real, deterministic, provenance-backed, re-calibratable population) and is
   production-readiness work valuable regardless of horizontal. Finish the
   GSI-foundational spikes: `fix/s3-batched-sim` (SIM aggregation) and
   `change/flash-spike` (**SIM-1 Flash text tier = the non-video scoring engine
   every non-socials domain needs** — you can't run a job application through a
   video pipeline).
2. **Capture GSI vision** — this doc (done).
3. **Launch GSI as a NEW milestone from clean `main`, its own worktree** (per the
   convention — never a long-lived branch on trunk). `/gsd-new-milestone`, feeding
   this doc as discuss-input. **Phase 0 = the engine/pack seam:** extract Socials
   into Pack #1, generalize the `audiences` schema → SIM, make scoring pluggable
   (§5). Build on the now-landed signature substrate.
4. **`ui-restrained`** (`design/ui-restrained`, already merged via PR #36) is
   orthogonal presentation polish — does NOT block GSI; the GSI surface reuses its
   renderers. Keep or pause at will.

**Note:** the CLAUDE.md worktree table is stale (it lists `engine-rework` on
`rework/engine-core` ~8 ahead; the *folder* is currently on `fix/s3-batched-sim`,
and `rework/engine-core` is 11 ahead and unmerged). Reconcile the table when GSI
launches.

---

## 10. Risks
- **Shallow-everywhere (the AS death).** Mitigation: §2 rule — depth in the anchor,
  breadth in the surface; never ship an unvalidated SIM as Validated.
- **Pluggable-scoring is deep surgery** (Apollo/virality is load-bearing). Mitigation:
  pack-extract behind the existing frozen scoring; don't refactor the socials math,
  *wrap* it as Pack #1's scorer.
- **Marketplace cold-start** (chicken-egg). Mitigation: seed with first-party anchor
  packs; SIMs are usable solo before any marketplace exists.
- **Team focus / scope.** Engine + BYO-builder + marketplace + anchor depth is a lot.
  Mitigation: §6 shows most rails exist; the *marginal* GSI work is the pack seam +
  population generalization + a thin sharing surface — staged, not all at once.

---

## 11. Open questions (for the milestone)
- Domain Pack schema — exact shape of `populations / grounding / scoring / calibration`.
- How pluggable scoring wraps the frozen Apollo math without forking the engine.
- `audiences` schema migration → general SIM (new table vs additive columns vs jsonb-first).
- Trustworthy-SIM-without-calibration spike design (§7) — verdict criteria.
- Anchor Pack #2 = Marketing (population ≈ creators, grounding adjacent) — confirm.
- Marketplace economics (free/paid SIMs, rev-share) — defer past v1?
- BYO-population builder UX (from-description / from-evidence / from-template).

---

## 12. Launch mechanics
1. Land `rework/engine-core` + GSI-foundational spikes to `main` (§9.1).
2. From trunk `~/virtuna-v1.1/` on `main`, `/gsd-new-milestone` (e.g. *numen-gsi*),
   feeding this doc as discuss-input (NOT a locked brief — walk every section).
3. New worktree + branch off `main`; clean scoped `.planning/`.
4. Phase 0 = engine/pack seam; Socials becomes Pack #1; scoring made pluggable.
5. Reconcile the CLAUDE.md worktree table.

> **⚠️ §9 / §6 correction (2026-06-25, verified vs `origin/main`):** "11 commits
> UNMERGED" is misleading — the *content* of `rework/engine-core` is ALREADY on main
> (the dissection track landed piecemeal via squash-PRs #24/#30/#37/#39…, leaving the
> originals dangling with new SHAs). `enrich-signature.ts`, the drift cron,
> `signature.ts`, CSRF guards, and the G1 `_dormant` deletion are all present on main.
> So "land rework/engine-core" is effectively DONE at the content level — at GSI launch
> do **NOT** `git merge rework/engine-core` (replays merged work as conflicts/dupes);
> treat the branch as granular history only. The live spike `fix/s3-batched-sim` (off
> main, full signature substrate) is being expanded into the GSI-aligned
> **generate-rate-rank** SIM redesign (keep-all + batched SIMULATE primitive +
> reactions→ambient modal) — that *is* GSI Phase 0's `simulate()` core.

---

# PART II — Implementation (2026-06-25)

> Plain-words build design from the same conversation. Still EXPLORATORY; examples
> (ex-chat, football, job application) are ILLUSTRATIVE, not locked.

## 13. Terminology — the four nouns (resolves the SIM collision)

`SIM` was overloaded. Lock these:

| Noun | What it is | User selects it? |
|---|---|---|
| **SIM-1** | the **model / engine** (the brand). Auto-runs **Flash** (text) or **Max** (video). | ❌ No — a visible badge, never a choice |
| **Mode** | the **DomainPack**: `Socials` or `General`. Sets skills, reaction-frame, scorer, result cards. | ✅ but implicitly — it rides on the Audience (see §16) |
| **Audience** | a saved **population** SIM-1 simulates. Carries calibrated personas (the `signature`) + a goal/success-criterion + a trust badge. | ✅ Yes (or builds one) |
| **Skill** | the **action**, scoped to Mode: Hooks/Test/Remix (Socials) · Profile/Simulate/Predict (General). | ✅ Yes |

> Plainly: **SIM-1 is the model — you never pick it. You pick a Mode, an Audience,
> and a Skill, and SIM-1 runs them.** Earlier uses of "a SIM" in Part I = "an
> Audience" here.

---

## 14. Three verbs, one machine (the backend spine)

Simulate / Profile / Predict are NOT three products — one machine wired three ways:

> **a lens (Audience) + an input → the minds do something → a result card**

- **Simulate** = lens *reacts to* the input → "how they respond"
- **Profile** = the input *builds* the lens → "who this person is" (the lens IS the answer)
- **Predict** = lens *reasons over scenarios* of the input → "likely outcome + odds"

Same brain (SIM-1), same thread, same composer. Only the wiring + the result card change.

### 14.1 The six-box pipeline (every run, every verb)
1. **Inbox (input adapter)** — one door accepts text / link / file (video, WhatsApp
   `.txt`, screenshot, doc). Tags + normalizes into a `Stimulus`. *Today: video/URL
   only → widen to text + files.*
2. **Lens (Audience)** — saved audience, template panel, or one built on the fly
   (Profile). The `audiences`/signature object, generalized.
3. **Brain (the 3 primitives)** — one service: given `(skill, audience, stimulus)`
   runs `simulate()` / `profile()` / `predict()`, all on SIM-1 (Flash/Max auto).
4. **Formatter (pack scorer)** — raw output → typed `Verdict` (distribution / profile
   / probability). Pack-specific (§5).
5. **Result cards (typed blocks)** — fixed library; the verb picks which render.
   *Renderer system + persona/band cards already exist.*
6. **Honesty + memory** — Validated/Directional badge + provenance; every run saved
   as a thread turn; audiences live in a library.

Boxes 2/5/6 substantially exist. New: box 1 (widen inbox), box 3 (profile/predict
paths), ~3 new result cards.

### 14.2 Per-verb wiring
- **SIMULATE** — `simulate(audience, stimulus)` → reactions → distribution + themes.
  *Your core, generalized.*
- **PROFILE** — `profile(evidence)` → derived person-model (= `EvidenceSignatureBuilder`,
  but the built persona is *shown* as the deliverable, then saved as an Audience).
- **PREDICT** — `predict(panel, scenario)` = simulate an analyst panel across scenario
  branches → collapse to probability + factors + confidence. **Always Directional,
  always shows assumptions + receipts** — a reasoned forecast, never an oracle (§8).

### 14.3 Build list (already-have vs new)
| Already have | Build new |
|---|---|
| Thread (grounded/open), composer, stage-reveal | Widen **inbox** → text + file uploads |
| Typed renderers + persona/band cards | **3 result cards:** reaction-distribution · Profile · Prediction-gauge |
| `audiences`/signature (build-from-evidence) | **`profile()` + `predict()`** paths over SIM-1 Flash |
| Chain-CTA handoff | **Mode-scoped skills** + template Audiences (analyst/hiring panels) |
| Trust/provenance from signature design | **Validated/Directional badge** in the UI |

---

## 15. Product surface + PMF

### 15.1 The core move — promote the lens, scope everything to it
Do **NOT** bolt 3 more pills (Simulate/Profile/Predict) next to hooks/test/remix —
that collapses the composer. Instead the **Audience becomes the primary
context-setter**, and skills/intent/ambient scope to it. You never show Hooks AND
Predict at once → this *reduces* on-screen choices, not adds.

This works because today's socials skills ALREADY are specializations of the verbs
(Hooks/Scripts/Remix = generate→Simulate; Test = Simulate; Chat = open thread). The
verbs are the layer *beneath* the skills, surfaced only for non-creator Audiences.

### 15.2 Everything generalizes by swapping "audience" → "the active Audience"
| Today (socials-only) | Generalizes to | Creator sees |
|---|---|---|
| Audience switcher (secondary) | **Audience switcher = the front door** | their audience, pre-selected — *unchanged* |
| Skills (hooks/test/remix/chat) | **Mode-scoped skills** | their socials skills — *unchanged* |
| Intent switcher (grow/sell) | **success-criterion** (pack-defined) | grow/sell — *unchanged* |
| Ambient audience reacts to all | **ambient Audience reacts to all** | their audience reacting live — *unchanged* |

The whole generalization is one concept-level rename. Creator experience is
byte-identical; generality lives *behind* the Audience picker.

### 15.3 Two views, one composer
```
CREATOR (default — today)                  GENERAL (only on a non-creator Audience)
┌────────────────────────────┐            ┌────────────────────────────┐
│ Drop a link, file, topic…⊕ │            │ Paste the chat, or describe…⊕│
│ ◇ My TikTok audience ▾      │            │ ◇ "Alex (from chat)" ▾      │
│ [Hooks][Test][Remix] ⊕grow▾ │            │ [Profile][Simulate][Predict] ⊕reply-likely▾│
└────────────────────────────┘            └────────────────────────────┘
 ↳ audience reacts live (moat touch)        ↳ Alex's profile reacts live as you draft
```

### 15.4 PMF — don't chase it across three verbs
PMF comes from ONE undeniable use case, not breadth:
1. **Protect the creator core** (already monetizing, v6.0). Default composer untouched
   → zero new friction for the wedge. = retention + revenue.
2. **Nail ONE general "wow": Profile-a-chat → Simulate-the-reply.** Emotionally
   charged, shareable (TikTok-able), needs only a text upload. *"Profile who you're
   talking to, then test what you're about to send."* = the acquisition hook.
3. **Predict = story/breadth, Directional, NOT the PMF bet.** In the surface for the
   "simulate/profile/predict anything" narrative; no PMF effort sunk into football odds.

Same rule as the strategy: **depth in the anchor (creators), one sharp wow in the
breadth (profile-chat), narrative coverage for the rest.**

### 15.5 Home / empty state
Greeting + composer + starter chips seeded to the wow:
`[Test an idea on your audience]  [Profile a chat]  [Predict an outcome]`.
First-run demo = the profile-chat magic (not a video) — show the most visceral
horizontal moment first.

---

## 16. Object model + user logic (the part the builder needs unambiguous)

### 16.1 How the nouns nest
```
 MODE          →  AUDIENCE        →  SKILL                    →  INPUT          →  RUN
 Socials|General  (of that mode)     (of that mode)              text|link|file    SIM-1 → card

 Socials  ─→  personal / target  ─→  Hooks·Test·Remix          ─→ … ─→ Reading
 General  ─→  person / panel     ─→  Profile·Simulate·Predict  ─→ … ─→ Read
```
**Mechanically it is ONE selection, not two.** Each Audience *carries its Mode*, so
picking an Audience sets the Mode (and the skill menu). The "Mode switch" is just the
**section header in the Audience picker** — NOT a separate pill (recommended, fights
composer bloat):
```
◇ Audience ▾
 ── Socials ──   • My TikTok audience (personal)   • Gen-Z gym beginners (target)
 ── General ──   • Alex (from chat) (person)        • Hiring panel (panel, template)
 ── + Build an audience ──   (from description | from evidence)
```

### 16.2 Run resolution (each submit)
```
1. mode      = active Audience's mode          (default: Socials)
2. audience  = selected, OR the mode's DEFAULT  ← zero-setup always works
3. skill     = selected (must belong to mode)
4. input     = normalized stimulus → picks SIM-1 tier (Flash/Max)
5. run       = pack[mode].run(skill, audience.signature, input)
6. render    = mode's result cards + Validated/Directional badge
7. persist   = append to thread; if skill == Profile, SAVE the built Audience
```
**Defaults so nothing requires setup** (line 2):
- Socials default = the `General-10` baseline (already in `audiences`, `is_general`).
- General default = a built-in template panel (analyst / hiring).

### 16.3 The three flows
**A — Creator (Socials, default — unchanged):** open → Mode=Socials + personal
audience pre-selected → Skill=Hooks, type topic → SIM-1 Flash generates → simulates on
audience → ranks → cards. *Exactly today.*

**B — Profile a chat (General — the on-ramp + the wow):** Audience picker → General →
Build → "Profile a chat" → drop WhatsApp export → SIM-1 **builds a person-audience** →
Profile card with evidence quotes → **saved to General library ("Alex")** →
CTA *"Simulate a message to Alex →."*

**C — Simulate / Predict (General):** Audience = "Alex" or a template panel →
Skill=Simulate, type draft message → SIM-1 simulates Alex reacting → likely reply +
read, **Directional** badge. (Predict = skill=Predict → probability card.)

### 16.4 The key asymmetry (falls out for free)
- **Simulate / Predict:** pick Audience FIRST → then drop input.
- **Profile:** drop input FIRST → the Audience is the OUTPUT (saved to library).

So **Profile = "build a General Audience from evidence"** — the door into General that
fills the library for later Simulate/Predict. The chain (Profile → Simulate → Predict)
is the product magic and it's implied by the logic, not bolted on.

### 16.5 UI build order (all additive, low-risk)
1. Promote Audience pill → front-door picker + library (reuse audience-manager UI).
2. Mode-scope the skill pill (active Audience's mode decides the menu); creator = default.
3. Generalize the ambient reactor: audience → active Audience (rename + wiring).
4. Add the Profile on-ramp (upload chat → build Audience → Profile card) — the wow.
5. Add Simulate/Predict skills + their result cards for General Audiences.
6. Generalize intent → success-criterion (pack-defined; socials keeps grow/sell).

Steps 1–4 = creator core untouched **+** the one general wow = the PMF-shaped slice.
5–6 fill in breadth.
