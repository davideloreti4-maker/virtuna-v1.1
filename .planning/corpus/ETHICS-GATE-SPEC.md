# ETHICS-GATE-SPEC.md

> Status: **SPEC — not built.** This document is the to-do contract for the ethics/voice gate implementation.
> Full 142-row principle register: `.planning/corpus/_mining/chase-hughes/_CRITIC-REPORT.md` (Part 2).
> Date drafted: 2026-06-11.

---

## 1. Purpose & Status

The ethics/voice gate is a **code-level enforcement layer**, not a prose commitment.

Track A (`KNOWLEDGE-CORE-2.6-behavioral-DRAFT.md`) and Track B (`BEHAVIORAL-CORE.md`) both describe the correct stance in prose. Track B §0 is excellent. Track A §intro commits to "diagnostic levers, not how-to." **That stance in prose is not a gate.** A language model generating output from those artifacts can violate the stated stance in every response and no document will stop it. The gate must exist as code.

**Both tracks are blocked from going user-facing until this gate is live.** Specifically:

- **Track A (engine scoring):** blocked until gate live + M6/M7 misses added + diagnose-don't-prescribe transform enforced at output + 14-item EXCLUDE denylist wired.
- **Track B (chat/interpretation substrate):** blocked until gate live + M1–M5 substrate additions + NEVER-COACH tags enforced.

See the promotion checklist in §5.

---

## 1.5 Enforcement Architecture — Streaming Reality (correction, 2026-06-12)

**An earlier draft of this spec said the gate is a "post-stream transform on `fullContent`." That is wrong for the chat surface and is hereby corrected.**

The chat endpoint (`src/app/api/analyze/[id]/chat/route.ts:217-223`) streams tokens to the user **live**, inside the generation loop (`send("token", { delta })`). A transform that runs after `fullContent` is assembled (`:226`) only sanitizes the **DB copy** and the **`done` frame** — the user has already read every token. **Post-hoc output checking is a logger, not a gate.**

Consequently, enforcement splits across three tiers — not one runtime code pass:

| Tier | Runs | Enforces | Why here |
|---|---|---|---|
| **Prompt prevention** (primary) | in the system prompt, every turn | M1, M3, M5, EXCLUDE refusals | Prevents *generation* of the violation; free; preserves streaming. ~95% of coverage. |
| **Realtime tripwire** (backstop) | sentence-buffered in the stream loop | M2 (EXCLUDE, imperative form only) | The only thing worth halting a stream for: catastrophic named tactics. High-precision / low-recall by design. |
| **Offline eval** (deployment gate) | async, on stored transcripts, deterministic | M1, M5 semantic verification | Semantic "diagnose vs prescribe" can't be regex'd live without an LLM-judge in the request path (latency). So it gates *deployment* (red-team violation rate under threshold before ship), not each request. |

**Key correction to §4 below:** the 5 mechanisms are NOT all runtime code. Their tier assignment:
- **M1 (diagnose-don't-prescribe)** → prompt prevention + offline eval. NOT a live regex.
- **M2 (EXCLUDE denylist)** → prompt refusal + the one realtime tripwire. (Tripwire targets imperative+named-tactic only; must NOT block legitimate *detection* of these patterns in others' content — that's permitted audit use.)
- **M3 (direction tag)** → prompt stance in chat; a real non-null field only in Track A's structured score output.
- **M4 (credibility firewall)** → **N/A to chat.** It separates engagement-vs-honesty *score channels*, which exist only in Track A scoring. Deferred to Track A wiring.
- **M5 (moral-framing)** → prompt special-case + offline eval (the most camouflaged item; exactly what a judge catches and a regex misses).

**A determinism gap also applies:** chat runs `temperature: 0.3`, no seed (`route.ts:214`). Keep that for prod warmth, but the offline eval harness MUST pin `temp:0` + seed so red-team violations are reproducible.

---

## 2. The Three Buckets

The critic's register (142 rows, 84 strictly dark-flagged) resolves into three operational buckets.

### (a) SAFE-AS-COMPREHENSION — 31 principles

Numen may reason with these, explain them, and use them diagnostically. They are descriptive or epistemic: explaining *why* X works does not equip a user to harm anyone with X. Mostly Track B reasoning frames and defensive tools (influence autopsy, 3-lever hierarchy, GEPO, safety-as-compass, beliefs-as-outdated-software, liberation-vs-manipulation line, etc.).

**Operational rule:** no restriction on internal reasoning or explanatory output.

### (b) GUARD-AT-OUTPUT — 39 principles

Dual-use core. Numen may score and diagnose these internally — "this video deploys an obedience gradient, that's why compliance signals are high." They must **never** surface as actionable second-person creator instruction — "use an obedience gradient to raise compliance."

This is the default bucket for every Track A scoring triple drawn from a dark-flagged principle.

**Operational rule:** output permitted only in third-person analytical form about the analyzed content. Imperative or advisory phrasing on any Bucket-(b) lever is a gate violation.

### (c) EXCLUDE — 14 principles

So coercive or boundary-violating that no creator-facing framing is legitimate. These get:
- No scoring triple in Track A
- No actionable phrasing anywhere
- No "here's how" in any output

**Exception:** Numen MAY name and recognize these when auditing *others'* content for predatory patterns (e.g., flagging a funnel that uses manufactured-dependency close). Detection is legitimate. Generation and coaching are not.

---

## 3. The 14-Item EXCLUDE Denylist

These items are hard-excluded from scoring triples, actionable phrasing, and creator coaching. Listed by name with one-line reason.

| # | Name | Reason |
|---|------|--------|
| 1 | **Childhood-wound contract** | Reaching into a stranger's attachment trauma to produce an involuntary body response — a boundary violation regardless of intent. |
| 2 | **Regression induction** | Deliberately kicks the defended adult offline to deliver a message to a regressed psychological state. |
| 3 | **Presupposition stack / confabulated memory** | Fabricates experiential history in the listener's mind without consent. |
| 4 | **Voluntary confession + confession architecture** | Asymmetric coercion to disclose; designed so cost-of-silence compels self-incrimination. |
| 5 | **Identity statement elicitation + social-introduction seal** | Engineers consistency traps and locks identity via third-party witnesses without the subject's awareness. |
| 6 | **Gradual interspersed agreement** | Textbook covert influence disguised as casual conversation; designed to be invisible. |
| 7 | **Negative offcasting** | Sympathetic anecdote engineered for implicit self-comparison to coerce identity adoption. |
| 8 | **Parasite destabilization / manufactured-dependency close** | Creates an unsolvable problem so the paid product is the only exit — the canonical predatory-funnel pattern. |
| 9 | **Subscribe-guilt "honesty" reframe** | Deploys the appearance of honesty itself as a compliance lever. |
| 10 | **Reticular priming for covert filter-installation** | Installs perceptual filters in the audience without rational consent. |
| 11 | **Covert blind-spot ID protocol + 10-question covert diagnostic** | Whole-system covert profiling of a non-consenting subject. |
| 12 | **Counterfactual identity test** | Rhetorically unbeatable identity-destabilizer; designed to leave no safe answer. |
| 13 | **Moral-framing-as-most-covert-shortcut (generator half)** | Teaching a creator to build it is the most dangerous leak in the corpus ("feels like ethics, not manipulation"). Detector is permitted (Bucket b); generator is excluded. |
| 14 | **Hughes-runs-the-loop / covert meta-demonstration** | Running the full undisclosed influence sequence on an audience without disclosure. Fine to explain (Bucket b); excluded as a recommended creator structure. |

---

## 4. The 5 Enforcement Mechanisms (Required as Code)

Each mechanism below is lifted directly from the critic's 5 numbered requirements. Each carries an acceptance criterion the gate must satisfy.

---

### Mechanism 1 — Diagnose-Don't-Prescribe Transform

**What it does:** Every Bucket-(b) mechanism may appear in output only as a read on the analyzed video. It must never be reformatted as creator instruction.

**Examples:**
- PERMITTED: "This video opens inside a SAFETY frame, which makes pushback feel reckless — that's why resistance signals are low."
- BLOCKED: "Open inside a SAFETY frame to make pushback feel reckless."

**Acceptance criterion:** The gate must scan any output segment referencing a Bucket-(b) principle and reject (or rewrite) any clause containing second-person imperative or direct advisory phrasing tied to that principle. This applies to all output paths: scoring summaries, chat explanations, and insight copy.

---

### Mechanism 2 — Hard EXCLUDE Denylist on Output

**What it does:** The 14 items in §3 get no scoring triple, no actionable phrasing, no how-to — at the output layer, not just in the corpus documents.

**Acceptance criterion:** The gate must maintain a keyed denylist of the 14 item names (and their register IDs). Any output generation step that would produce a scoring entry, an instructional phrase, or a "how-to" segment referencing a denylist item must be blocked. Detection-mode output (auditing others' content) is permitted; the block applies to generation/coaching mode only. This must be a runtime check, not a document annotation.

---

### Mechanism 3 — Non-Optional Liberation-vs-Capture Direction Tag

**What it does:** Whenever Numen says a mechanism is *working* in a video, it must also answer "toward the viewer's autonomous benefit or toward the creator's capture of the viewer?" Track B §0 and the ethics-neutral persuasion definition (#81) name the line — the gate makes answering the question mandatory, not aspirational.

**Acceptance criterion:** Every effectiveness read on a Bucket-(b) principle in output must carry an explicit direction tag (e.g., `[liberation: viewer gains X]` / `[capture-risk: mechanism extracts Y from viewer]`). Output that scores or describes a mechanism as effective without a direction tag fails the gate. The tag format is implementation detail; the requirement is that the field is non-nullable.

---

### Mechanism 4 — Credibility-vs-Effectiveness Firewall

**What it does:** Several Track A levers are dual-edged: a video can score high on engineered engagement AND deserve a flag for manufactured division, borrowed false authority, or binary compression. These signals must never inflate the honesty/substance sub-score.

Track A already partially implements this with `§5 caution` tags on perceived-authority container, borrowed-research, binary compression, and threat-kicker.

**Acceptance criterion:** The gate must enforce structural separation between the engagement/effectiveness score channel and the honesty/substance score channel for any lever tagged dual-edged in Track A. A high engagement signal derived from a dark-flagged Bucket-(b) principle must not propagate a positive contribution to the honesty sub-score. The two channels may co-exist in the same output ("high reach mechanics, low-honesty flag") but the scores must not sum or average across the firewall.

---

### Mechanism 5 — Moral-Framing Special-Case: Detector Yes / Generator No

**What it does:** Moral framing (#30) is the single most dangerous leak because it "feels like ethics, not manipulation." A naive guard is more likely to miss it than any other item. The gate must implement an explicit named check for moral-loading-of-dissent as a detector (Bucket b — legitimate in audits) while hard-blocking any output that teaches a creator to build it (Bucket c / §3 item 13).

**Acceptance criterion:** The gate must maintain "moral-framing" as a named detector class in its audit vocabulary — Numen should surface it when content morally-loads dissent in analyzed videos. Simultaneously, any output generation step must check whether the moral-framing item appears in a coaching or instructional context and block it. The split is: recognize = allowed; teach = blocked. This is the one item that must not be handled by the general Bucket-(b) diagnose-don't-prescribe rule alone — it needs its own named gate branch because the prescriptive form is maximally camouflaged as ethical framing.

---

## 5. Promotion Checklist

### Track A (engine scoring) — gate condition for wiring to user-facing output

- [ ] Ethics gate live as code (all 5 mechanisms in §4 implemented and tested)
- [ ] M6 (Expectancy detect-triple) added to Track A §2.6
- [ ] M7 (Dual-pole contrast detect-triple) added to Track A §2.6.3
- [ ] R2 caveat added to Track A §2.6.6 (calm non-pressure close: low inter-rater reliability note)
- [ ] Diagnose-don't-prescribe transform (Mechanism 1) verified on a sample of at least 10 Bucket-(b) triples
- [ ] 14-item EXCLUDE denylist (Mechanism 2) wired at output layer and passing a blocking smoke-test
- [ ] Credibility-vs-effectiveness firewall (Mechanism 4) verified: no dark-flagged engagement lever inflates honesty sub-score in `apollo-core-smoke.ts` test run
- [ ] Engine unfrozen from determinism gate (separate precondition — see `engine-determinism-gate` memory entry)
- [ ] A/B validation via `apollo-core-smoke.ts` passes on at least 4 real videos

### Track B (chat/interpretation substrate) — gate condition for wiring to user-facing chat

- [ ] Ethics gate live as code (all 5 mechanisms in §4 implemented and tested)
- [ ] M1 (Obstacle-staging) added to Track B §4.3
- [ ] M2 (GEPO) added to Track B §4.4
- [ ] M3 (Influence autopsy) added as Track B §4.8
- [ ] M4 (3-lever hierarchy) named as scaffold in Track B §1.5
- [ ] M5 (Safety/approval/shame economies) added to Track B §4.3
- [ ] R3 enumeration: Regression Induction explicitly listed in Track B §3.7 as NEVER-COACH
- [ ] NEVER-COACH tags applied to Bucket-(c) items that currently sit in Track B (childhood-wound contract, regression induction)
- [ ] Liberation-vs-capture direction tag (Mechanism 3) non-optional on all Track B effectiveness reads
- [ ] Deliberate chat-grounding decision made: decide whether Track B wires via RAG, cached injection, or system-prompt inclusion — and document the choice before wiring (see `chat-citations-not-grounded` memory entry for why this decision is not skippable)

---

*The full 142-row principle register and source evidence remain in `.planning/corpus/_mining/chase-hughes/_CRITIC-REPORT.md`. This spec references that register by row number; do not duplicate it here.*
