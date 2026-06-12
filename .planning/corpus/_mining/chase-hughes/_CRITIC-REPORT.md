# Critic Report — Chase Hughes Mining (Completeness + Ethics Gate)

> Adversarial review of the two synthesis drafts against all 17 source extracts.
> - Track A = `_SYNTH-track-A-2.6.md` (content-lever detect-triples → scoring, §2.6)
> - Track B = `_SYNTH-track-B-substrate.md` (reasoning frames → chat/interpretation)
> Reviewer stance: skeptical, specific. Coverage is **strong overall**; the misses below are real, not nitpicks.

---

## VERDICT (read first)

- **Missed frames (high-value, in NEITHER draft): 7**
- **Mis-routed frames (in the wrong track): 3** (2 firm, 1 soft)
- **Total dark-flagged principles across 17 extracts: 84** (covert-control 41, manipulation 35, other 1, plus ~7 double-flagged)
- **Ethics bucket split:** (a) SAFE-AS-COMPREHENSION **31** · (b) GUARD-AT-OUTPUT **39** · (c) EXCLUDE-CANDIDATE **14**
- **Promote-readiness:** **Track B = promote after adding the 4 missed substrate frames + wiring the ethics gate. Track A = promote after one demotion, two additions, and an explicit output-guard.** Neither is one-line-blocking; both are 90%-there. The single hard blocker for *either* going user-facing is the ethics/voice gate (Part 2) — it is currently described in prose but not enforced.

---

# PART 1 — COMPLETENESS AUDIT

## Method
Walked all 17 extracts. For every principle tagged `Non-obvious?: yes` or `both`/high-value, checked whether it landed in Track A (as a detect-triple), Track B (as a reasoning frame), or was correctly dropped (dup of Kallaway §2.x, or conversation-scale-only). Track A's "Overlap & dedup notes" and Track B's "Provenance note" are unusually honest and accounted for the large majority of drops correctly. The misses below survived both.

## A. MISSED FRAMES — high-value, fell through BOTH drafts

### M1 — Obstacle-staging / chasing-is-the-reward *(BELONGS: Track B §4.3)*
- **Source:** `scar-tissue` #9 (Non-obvious: yes; flagged by the extract itself as a Top-3 frame).
- **Status:** Track B §4.3 lists the values taxonomy (freedom/recognition/connection/growth/experiences/information) **and even names "obstacle-staging trap"** — so this is *half-landed*. But the sharp, counter-intuitive payload — *some people reject the very thing that fulfills their stated value because fulfillment ends the chase* — is mentioned in one clause and never operationalized. It deserves a "How Numen uses this" bullet of its own because it directly predicts **why a creator resists advice that would work**.
- **Suggested entry (Track B §4.3, add to "How Numen uses this"):** "Watch for obstacle-staging: a creator (or audience) chasing the *feeling of pursuit* will reject the fix that ends the chase. When advice that should land gets resisted, ask whether arrival itself is the threat."

### M2 — GEPO: Generalized Expectation of Positive Outcomes *(BELONGS: Track B §4.4)*
- **Source:** `authority-operative-training` #7 (Non-obvious: yes).
- **Status:** Absent from both. Track B §4.4 has the *external* composure tells (slowness, effort-narration, ambient broadcast) but not the *internal* cognitive prior that produces them. GEPO is the trainable construct distinguishing optimism (feeling) from a baseline assumption that reshapes how ambiguous signals are appraised — it's the internal correlate of the composure signal Track A §2.6.1 already scores.
- **Suggested entry (Track B §4.4 diagnostic tells):** "**GEPO vs. optimism.** A grounded creator runs a generalized expectation of positive outcomes — a cognitive prior that lowers threat-appraisal latency, not a mood. It reads on camera as calm proactivity under stakes; its absence reads as reactive scanning. This is the internal source of the §2.6.1 composure signal."

### M3 — Influence Autopsy / layer-by-layer loss diagnosis *(BELONGS: Track B, new §4.x or fold into §1.5/§4)*
- **Source:** `teil-2` #3, #4 (both Non-obvious: yes); reinforced by `scary-loophole` #3 (spinal→cortex stack).
- **Status:** Track B has the *layers* (limbic vs cortex §1.5; ancestor scripts §3.1) but **not the diagnostic practice** Hughes builds on them: when content fails, autopsy *which layer broke* — genetic/survival-script, chemical/emotional, or electrical/logical. This is one of the most directly useful chat tools in the entire corpus (it turns "the algorithm hated it" into a structured re-run), and Track B's whole purpose is "how Numen thinks and talks about why content hit or missed." Its omission is the most surprising gap.
- **Suggested entry (Track B, new §4.8 "The Influence Autopsy"):** "When a video underperforms, diagnose the *layer* of failure, not the surface: electrical (logic/framing reached the cortex but never the decision engine), chemical (no emotional state was induced), or genetic (no survival/tribe/novelty script fired). Most 'flat' content failed at the genetic gate — focus never opened — and everything downstream was wasted. This is the per-video companion to the six-axis post-mortem (§4.1)."

### M4 — Three-lever hierarchy: electricity / chemicals / genetics *(BELONGS: Track B §3 or §4, as the spine)*
- **Source:** `influence` #1 (Non-obvious: yes), `teil-2` #3, `scary-loophole` #3.
- **Status:** Track B uses limbic-vs-cortex (§1.5) and ancestor-scripts (§3.1) heavily but never states Hughes' explicit **3-tier ranked taxonomy** (electrical < chemical < genetic, ascending power) that the autopsy (M3) and the "pre-literate hook test" (already in Track A §2.6.4) both depend on. It's the organizing backbone Hughes returns to in 3 separate transcripts. Track B would be more coherent if this were named once as the scaffold under §1.5/§3.1 rather than left implicit.
- **Suggested entry (Track B §1.5, add a framing line):** "Hughes ranks influence by depth: *electrical* (thought/logic/language — weakest), *chemical* (emotional/neurochemical state), *genetic* (survival scripts — strongest, no off-switch). The closer to the genetic base, the more it bypasses evaluation. §1.5–§3 specialize this stack."

### M5 — Three internal economies: safety (compass) / approval (currency) / shame (prison) *(BELONGS: Track B §4.3)*
- **Source:** `scar-tissue` #4 (safety as master variable, Non-obvious: yes) + #5 (the trio, Non-obvious: yes).
- **Status:** Track B §4.3 covers needs/pillars/values but **omits the safety/approval/shame operating-parameter trio** — which `scar-tissue` frames as the *master* organizer ("every fight, every sale, every date… people running safety programs") sitting *underneath* the needs taxonomy. This is a distinct, more primary lens than the five needs, and it's exactly the vocabulary Track B's §5 stance ("read the layer, not the surface") needs. Currently neither the "safety is the compass" master-variable claim nor the shame-as-prison lens appears anywhere.
- **Suggested entry (Track B §4.3, add a layer above needs):** "**Below the three layers sits one master variable: safety.** Most 'irrational' audience behavior (resistance, shutdown, deflection) is a safety program executing, not your content being processed. Two sub-economies ride on it: approval (what people spend/hoard socially) and shame (what imprisons the range of responses available). Read resistance as a threat read, not a logic failure."

### M6 — Expectancy axis under-specified for scoring *(BELONGS: Track A §2.6 — currently MISSING as a triple)*
- **Source:** `human-influence-map` #3 (Expectancy, tag `both`, Non-obvious: yes, has a drafted detect-triple in the extract).
- **Status:** Expectancy appears in Track B §4.1 as one of the six axes (correct), **but its `both`-tagged, single-video-scoreable detect-triple was dropped from Track A.** The extract explicitly drafted one: signposted structure + promised-and-delivered payoff lowers threat-detection and sustains watch. This is distinct from Kallaway's loops (it's a *trust/predictability* axis, not a prediction-error gap) and distinct from Track A's open-loop lever (§2.6.7, which deliberately leaves business *un*finished). It is scoreable and net-new. Its omission is a genuine Track A gap, not a correct dedup.
- **Suggested entry (Track A §2.6.7 or §2.6.4):** "**Expectancy (predict-and-payoff).** *Signal:* does the video signpost its structure ('first… then… by the end') and promise a payoff it visibly delivers? · *Mechanism:* predictability lowers the viewer's threat-detection load so they stay for the reward instead of scanning for the exit; high expectancy raises trust and makes every other lever easier to land. · *Strong:* explicit promise + matched structure + delivered payoff. *Mid:* implicit structure, no payoff cue. *Weak:* random jump-cuts, no through-line. (src: human-influence-map) · Distinct from §2.6.7 open-loop (that leaves a *forward* loop open; this *closes* the episode's promised loop)."

### M7 — Contrast framing: dream-vs-nightmare dual pole *(BELONGS: Track A §2.6.3)*
- **Source:** `2026-technik` #2 (tag `both`, Non-obvious: yes, extract's own Top-1 non-obvious frame, has a drafted triple).
- **Status:** Dropped from both. Track A §2.6.3 covers emotional encoding richly (limbic-first, trauma-speed, emotion-naming) but **not the specific mandatory two-pole contrast** — vivid ideal AND vivid nightmare-if-nothing-changes. The extract's sharp claim is that the nightmare pole is *not optional stakes* but *required limbic fuel* ("the brain doesn't crave change until the status quo becomes unbearable"). This is scoreable (does the video pair aspiration with a vivid cost-of-inaction?) and not covered by threat-over-value (§2.6.4, which is about the *hook's* attention capture, not the *body's* motivational contrast). Borderline-overlaps §2.6.4 threat framing but the mechanism (motivational craving via contrast) is distinct from attention-gate threat.
- **Suggested entry (Track A §2.6.3):** "**Dual-pole contrast (dream × nightmare).** *Signal:* does the piece pair a vivid desired future with a vivid 'if nothing changes' cost, in close narrative proximity? · *Mechanism:* the brain doesn't crave change until the status quo feels unbearable; the nightmare pole is limbic fuel, not optional stakes — aspiration alone is neurologically insufficient. · *Strong:* both poles vivid, specific, personalized, adjacent. *Mid:* one pole strong, other generic. *Weak:* aspiration-only, no cost framing. (src: 2026-technik) · Distinct from §2.6.4 threat-over-value (that's attention capture at the hook; this is motivational craving across the arc)."

### Lower-confidence near-misses (noted, NOT counted in the 7 — judged correctly-droppable)
- `2026-technik` #5 reticular priming (cross-video repetition) — **correctly out of single-video scope**; could be a Track B aside but not load-bearing.
- `2026-technik` #10 dopamine map / #11 keystone habits — self-help, not content-analysis. Correct drop.
- `cheat-code-diagram` #11 transition-arrow thumbnail (1,800% CTR, Non-obvious: yes, content-lever) — **arguably a Track A miss**, but it's a thumbnail/visual-asset lever outside transcript±visual-delivery scope and overlaps Kallaway scroll-stop. Judgment call; flagging as a *possible* 8th miss if Numen scores thumbnails. **Borderline — recommend a one-line note in Track A's dedup section rather than a full triple.**
- `scary-loophole` #6 multi-sensory script forgery (smell/touch) — Track A correctly subsumed under perceived-authority container; not separately scoreable from video.

## B. MIS-ROUTED FRAMES

### R1 — `1pct-control-reality` #5 "Script-Failure Proof" tagged content-lever but is pure reasoning-substrate *(FIRM)*
- The extract tags it `content-lever` and Track A's dedup correctly **did not** encode it as a triple — but it also isn't explicitly placed in Track B. Its actual content ("the same words carry different weight depending on the speaker's state; optimize state not script") is a *reasoning* claim, already absorbed into Track B §1.5 (limbic-reads-the-messenger) and the nervous-system frames. **Verdict: correctly handled in practice (not double-encoded), but the source tag is wrong.** No action needed beyond noting the mislabel — it did NOT leak into Track A as a bogus scoring triple. Low severity.

### R2 — Track A §2.6.6 "Calm non-pressure close" + §2.6.2 "frame defang" sit close to the substrate line *(SOFT)*
- Track A's own dedup flags that frame-defang and identity-over-logistics "border on reasoning-substrate." Reviewer concurs they're defensible as triples (a single video visibly performs them). **But "calm non-pressure close" (§2.6.6, from compliance #10) is weaker as a *scoring* triple** — non-aggression is hard to distinguish on camera from low-energy/flat delivery, and the compliance extract itself recommends gating it `analysis-only`. **Verdict: keep it, but add a reliability caveat** ("low inter-rater reliability; calm vs. flat is hard to separate from transcript±visual"). Soft mis-route — it's more reasoning-flavored than scoreable.

### R3 — Track B §3.7 absorbs the FBI/Socrates conversation architectures, but Track A *also* lifted 8 of them as triples — verify the split held *(FIRM, but correctly resolved)*
- Track A's dedup claims it lifted only the "broadcast-translatable subset" (emotion-labeling, witness-statement, permission-to-want, reframe, identity install, frame-erasure, future-perfect, in-group seal) and left the interrogation-only variants (presupposition stack, voluntary confession, accusation inversion, gap, regression induction, identity lock) to Track B. **Cross-check confirms the split is clean** — the dyadic-only architectures (regression induction, voluntary confession, presupposition-as-confabulation) are NOT in Track A, and Track B §3.7 names them. **Verdict: not actually mis-routed — the split is correct and well-policed. Logging it because it's the highest-risk split in the corpus and it held.** The one to watch: **Regression Induction** (`fbi-socrates` #17) is arguably broadcast-translatable ("recall a specific childhood moment, then deliver the message") and a creator CAN do it to camera — it's *neither* in Track A nor explicitly in Track B's reasoning frames. Borderline; if anything this is closer to a missed Track A triple than a mis-route. **Recommend: add to Track B §3.7's enumerated list (it's there implicitly via "regression") and do NOT add to Track A — it's the single most manipulative dyadic move and should stay comprehension-only (see EXCLUDE bucket below).**

## C. Coverage verdict
Coverage is genuinely strong. The two drafts between them absorbed ~210 raw principles with honest, mostly-correct dedup. The 7 real misses cluster in **Track B's profiling/diagnostic layer** (M1–M5 — the autopsy, the 3-lever spine, the safety/approval/shame economies, GEPO, obstacle-staging) and **two scoreable emotional/structural levers Track A dropped** (M6 expectancy, M7 dual-pole contrast). Fix those nine items (7 misses + R2 caveat + R3 enumeration) and completeness is solid.

---

# PART 2 — ETHICS / VOICE GATE REGISTER

> The deferred "flag later" deliverable. Every Dark-flagged principle across all 17 extracts, with where it landed and a one-line leak risk. Then bucketed a / b / c.
> Flag-type key: **CC** = covert-control, **M** = manipulation, **O** = other.
> "Landed" = T-A (Track A triple), T-B (Track B frame), DROP (correctly not wired), CONV (conversation-scale, reasoning only).

## Register

| # | Principle | Source | Flag | Landed | Leak risk if surfaced unguarded as creator advice |
|---|-----------|--------|------|--------|----------------------------------------------------|
| 1 | Reality Command (frame entrainment) | 1pct-control | CC | T-B | "Make others sync to your reality" → coaching covert dominance |
| 2 | Covert Reality Shift (influence w/o awareness) | 1pct-control | CC | T-B(impl) | Endorses operating below target's radar as the *ideal* |
| 3 | Contrast/Nightmare pole | 2026-technik #2 | M | **MISS→T-A** | "Engineer aversion to their present life" → fear-coercion script |
| 4 | FATE model (use on others) | 2026-technik #4 | CC | T-B | Hands a turnkey 4-lever compliance stack |
| 5 | Reticular priming | 2026-technik #5 | M | DROP | "Install perceptual filters without consent" |
| 6 | FEAR brainwashing formula | 2026-technik #8 | CC | T-A(as structure) | Literally branded "brainwashing"; as a video rubric it's a how-to |
| 7 | Authority lever (disable resistance) | 2026-technik #12 | M | T-A | "Authority before argument to bypass skepticism" |
| 8 | Tribe lever (artificial membership) | 2026-technik #13 | CC | T-A | Fabricate in-group to exploit conformity |
| 9 | Five authority trip-wires | authority-op #1 | CC | T-A | "Trip these in their head" framing of presence |
| 10 | Intent as permission slip | authority-op #6 | M | T-A | Benevolent-intent as a *cover* for influence ops |
| 11 | Virtues-as-inborn attribution | authority-op #10 | M | T-A | "Make trained behavior look natural" = social deception |
| 12 | Hierarchy-blindness | authority-op #9 | CC | T-B | Suppress deference to project covert dominance |
| 13 | 10-question bias diagnostic | cheat-code #7 | CC | CONV | Covert self-incrimination extraction |
| 14 | Third-person pivot (narcissist) | cheat-code #8 | CC | T-A(partial) | Extract self-disclosure they'd never volunteer |
| 15 | Negative dissociation primer | cheat-code #9 | M | T-A(partial) | Manufacture honesty/compliance via outgroup contrast |
| 16 | Bad-news anchoring | cheat-code #10 | M | T-A(partial) | Scripted "you're on the edge" reframe regardless of truth |
| 17 | "I'm curious" ego-safe entry | cheat-code #12 | CC | T-A(partial) | Rehearsed guard-lowering disguised as interest |
| 18 | Covert blind-spot ID protocol | cheat-code #14 | CC | CONV | Whole-system covert profiling without consent |
| 19 | Five-stage viral loop | cognitive-virology #3 | CC | T-A | "Own the human" — full ideological-capture rubric |
| 20 | Receptor match (bypass logic) | cog-vir #4 | M | T-A | Target subcortical triggers to skip evaluation |
| 21 | Entry via pre-approval | cog-vir #5 | CC | T-A | "If they feel persuaded you failed" — bypass consent |
| 22 | Replication (idea thinks for host) | cog-vir #6 | CC | T-A | Engineer autonomous internal replication = capture |
| 23 | Binary compression | cog-vir #7 | M | T-A+T-B | Weaponized destruction of nuance for spread |
| 24 | Immune system / doubt→confirmation | cog-vir #8 | CC | T-A+T-B | Build unfalsifiable belief (cult architecture) |
| 25 | Identity upgrade as transmission | cog-vir #9 | M | T-A | Hijack identity to make sharing self-performance |
| 26 | Pre-existing emotion hijack | cog-vir #10 | M | T-A | Parasitize people's live distress for reach |
| 27 | Questioning labeled dangerous | cog-vir #11 | CC | T-B | Thought-stopping; make skepticism a moral failure |
| 28 | Unfinished business / delayed replication | cog-vir #12 | M | T-A | Plant mental loops that run without awareness |
| 29 | FAIT shortcuts | cog-vir #13 | CC | T-B(impl) | Systematic survival-heuristic exploitation |
| 30 | Moral framing (highest-leverage) | cog-vir #14 | CC | T-A | "Feels like ethics, not manipulation" — most covert |
| 31 | Hughes runs loop on audience | cog-vir #18 | CC | T-A(installed-seq) | Self-referential covert execution as proof-of-concept |
| 32 | Relief-seeking receptor | cog-vir #19 | M | T-A | Target people when defenses are lowest |
| 33 | Behavioral loopholes | compliance #2 | CC | T-A | Frames human biology as an attack surface |
| 34 | Novelty → suggestibility | compliance #3 | M | T-A | Raise suggestibility, not just attention |
| 35 | Normative influence (social-media scale) | compliance #6 | M | T-A | Manufacture consensus to suppress evaluation |
| 36 | Social script paralysis | compliance #7 | CC | T-B | Trap behavior by keeping a script intact |
| 37 | Diffusion / inaction modeling | compliance #8 | CC | T-B | "Surround with calm models to prevent escape" |
| 38 | Obedience gradient (micro-escalation) | compliance #9 | M | T-A | Foot-in-the-door at lethal scale |
| 39 | Verbal non-aggression as control | compliance #10 | CC | T-A | Softness conceals the control op; removes exit ramp |
| 40 | Suggestibility elevation window | compliance #11 | M | T-A | Inject message while gatekeeping is down |
| 41 | Context-controlled authority collapse | compliance #13 | CC | T-A+T-B | Stage environment to manufacture false authority |
| 42 | Traumatic encoding speed | dangerous-influence #4 | CC | T-A | Encode behavior at trauma-speed w/o consent |
| 43 | Reaching behind the mask | dangerous-influence #5 | CC | T-A+T-B | Bypass defenses to reach the unguarded self |
| 44 | Childhood-wound contract | dangerous-influence #7 | CC | T-B | Hughes triggered involuntary tears "on purpose" |
| 45 | Liberation-vs-manipulation line | dangerous-influence #10 | M | T-B §0 | Naming the line doesn't stop the weapon's use |
| 46 | Language-as-parasite frame | dunkles #1 | CC | T-A | Make audience distrust own cognition → dependency |
| 47 | Labels construct identity | dunkles #5 | M | T-A+T-B | Blueprint for engineering self-concept via labels |
| 48 | Identity defense as cage | dunkles #6 | CC | T-B | Frame compliance as identity-consistent |
| 49 | Counterfactual identity test | dunkles #7 | M | CONV | Rhetorically unbeatable; destabilizes identity |
| 50 | Emotion-word conflation | dunkles #12 | M | T-A(emotion-naming) | Inflate/deflate emotion by strategic labeling |
| 51 | Anything-before-perception | dunkles #13 | CC | T-B §1.1 | Explicit blueprint: get upstream of awareness |
| 52 | Parasite destabilization (product) | dunkles #14 | M | DROP | Manufactured-dependency / unsolvable-problem close |
| 53 | Subscribe-guilt reframe | dunkles #15 | M | DROP | "Honesty" itself deployed as a compliance technique |
| 54 | Condition-creation over persuasion | fbi-socrates #1 | CC | T-B §3.7 | The meta-architecture; "only exit is the one you designed" |
| 55 | The Reversal | fbi-socrates #2 | CC | T-A | Engineer them to argue for your pre-decided conclusion |
| 56 | Impossible Question | fbi-socrates #3 | CC | T-A(impl) | Every answer moves them your way |
| 57 | Presupposition stack | fbi-socrates #4 | CC | CONV | Fabricate experiential memory in the listener |
| 58 | Emotion labeling | fbi-socrates #5 | CC | T-A | Choose which emotion to name = steer relational posture |
| 59 | Anger-to-hurt relabel | fbi-socrates #6 | CC | T-A(impl) | Unilaterally relabel internal state for compliance |
| 60 | Witness statement | fbi-socrates #7 | M | T-A | Precision-describe hidden self → deep vulnerability |
| 61 | Voluntary confession | fbi-socrates #8 | CC | CONV | Asymmetric pressure to disclose w/o visible coercion |
| 62 | Permission to want | fbi-socrates #9 | M | T-A | Target self-denial as a compliance lever |
| 63 | Identity installation | fbi-socrates #11 | CC | T-A | "Recognition" framing is the deception |
| 64 | Accusation inversion | fbi-socrates #12 | CC | CONV | Both responses are traps |
| 65 | The Gap (inconsistency trap) | fbi-socrates #13 | M | CONV | Manufactured surprise weaponizes self-concept |
| 66 | Identity lock | fbi-socrates #14 | CC | CONV | Value elicitation → self-policing compliance |
| 67 | Conspiracy/ingroup seal | fbi-socrates #15 | CC | T-A | Documented cult-recruitment mechanic |
| 68 | Installation / frame erasure | fbi-socrates #16 | CC | T-A | Replace their cognitive frame without consent |
| 69 | Regression induction | fbi-socrates #17 | CC | CONV (see R3) | Induce regression to bypass adult critical faculty |
| 70 | Fate accompli / prospective memory | fbi-socrates #18 | CC | T-A | Manufactured temporal illusion; not-acting = self-betrayal |
| 71 | Exit seal (inevitable knowledge) | fbi-socrates #19 | CC | T-A(impl) | "You already know" makes inaction feel like betrayal |
| 72 | Confession architecture | fbi-socrates #21 | CC | CONV | Cost-of-silence design to compel disclosure |
| 73 | Identity enforcement neurological | fbi-socrates #22 | CC | T-B §3.6 | Silent non-correction = binding w/o explicit consent |
| 74 | Six-axis influence map | human-influence-map #1 | CC | T-B §4.1 | Turnkey covert diagnose-and-steer tool |
| 75 | Suggestibility vs compliance split | h-i-map #2 | CC | T-B §4.1 | Precision-target whichever pathway is open |
| 76 | Expectancy axis | h-i-map #3 | M | T-B (+MISS T-A) | Remove predictability to spike suggestibility via anxiety |
| 77 | "Any three" threshold | h-i-map #4 | CC | T-B §4.1 | Redundancy makes covert influence hard to defend against |
| 78 | Focus gate / ancestor scripts | h-i-map #5 | M | T-A+T-B | Mimic authority/inject novelty to capture focus involuntarily |
| 79 | Life vs ancestor scripts override | h-i-map #6 | CC | T-B §3.1 | Blueprint for identity-level / cult manipulation |
| 80 | Openness needs no-repercussion | h-i-map #7 | M | T-B(impl) | Artificial "safe zone" to induce disclosure |
| 81 | Persuasion = behavioral deviation | h-i-map #9 | O | T-B §4.2 | Ethics-neutral definition usable as operator justification |
| 82 | Authority+novelty dual-key | h-i-map #12 | M | T-A | Multiplicative attention engineering |
| 83 | Genetic lock-in (no off-switch) | influence #2 | CC | T-B §3.1 | "Resistance is architecturally impossible" framing |
| 84 | FATE-Authority (perceived=real) | influence #5 | M | T-A | Blueprint for false-authority construction |
| 85 | FATE-Tribe (engagement as infra) | influence #6 | — | T-A | (extract unflagged; reviewer notes covert lean) |
| 86 | Cucumber principle (superstimuli) | influence #8 | M | T-A | "Resemblance is enough" — fake threat/authority that fires real response |
| 87 | Lab-coat effect | influence #9 | CC | T-A+T-B | Single cue overrides moral agency |
| 88 | First-namer wins | instant-control #1 | CC | T-A+T-B | Install frame w/o awareness; experienced as reality |
| 89 | Four-step frame install (boring=strong) | instant-control #4 | CC | T-A | Explicit goal: target must NOT notice install |
| 90 | Category = permission package | instant-control #5 | CC | T-A | "Engineering someone's permission" |
| 91 | High-level category triggers | instant-control #6 | M | T-A | "Automating human behavior" via SAFETY/CARE/EXPERT |
| 92 | Category shielding | instant-control #7 | M | T-A | Make legitimate criticism psychologically impossible |
| 93 | Frame replacement (let old die) | instant-control #10 | CC | T-A | Target experiences installed frame as self-chosen |
| 94 | Never negate / supersede identity | instant-control #12 | CC | T-A+T-B | Reshape self-concept w/o triggering awareness |
| 95 | Five-step sequence | instant-control #15 | CC | T-A | Ran on audience undisclosed; designed to be invisible |
| 96 | Dignity preservation as engineering | instant-control #17 | M | T-A+T-B | Reframes ethics itself as a compliance prerequisite |
| 97 | Covert meta-demonstration | instant-control #18 | CC | T-A | Post-hoc "consent"; full sequence run undisclosed |
| 98 | Cognitive dissonance itch | mind-weapon #1 | CC | T-A | Trigger the itch to steer self-motivated change covertly |
| 99 | Self-motivated change (set conditions) | mind-weapon #4 | CC | T-A+T-B | Disguise external influence as internal motivation |
| 100 | Identity statement elicitation | mind-weapon #5 | M | CONV | Engineer consistency traps w/o consent |
| 101 | Personality inventory question | mind-weapon #6 | M | CONV | Strategic self-deprecation to lower defenses |
| 102 | Negative dissociation | mind-weapon #7 | M | CONV | Coerce identity adoption via contrast archetype |
| 103 | Article technique (borrowed authority) | mind-weapon #8 | M | T-A | Fabricated study to launder identity installation |
| 104 | Negative offcasting | mind-weapon #9 | M | CONV | Engineer implicit self-comparison via sympathy |
| 105 | Social introduction as seal | mind-weapon #10 | CC | CONV | Lock identity via third-party social commitment |
| 106 | Gradual interspersed agreement | mind-weapon #11 | CC | CONV | Covert influence disguised as casual conversation |
| 107 | Biggest-domino leverage | mind-weapon #13 | M | T-B(impl) | Belief-architecture mapping for targeted engineering |
| 108 | Population-scale formula | mind-weapon #14 | CC | T-B | "Content = population-level influence operation" |
| 109 | FATE (PSYOP stacking) | psyop #1 | CC | T-A | Flood limbic to crowd out critical appraisal |
| 110 | Attention hijack (repetition+fear) | psyop #2 | M | T-A | Exploit threat-detection to hold attention involuntarily |
| 111 | Authority displacement (out-of-domain) | psyop #3 | CC | T-A+T-B | Halo-transfer; mismatch invisible = more manipulative |
| 112 | Tribal polarization | psyop #4 | M | T-A | Activate identity-threat to suppress critical thinking |
| 113 | Emotion suppresses critical thinking | psyop #5 | M | T-A+T-B | Emotion as active *suppressor*, not enhancer |
| 114 | Micro-agreements / identity drift | psyop #6 | CC | T-A+T-B | Unconscious self-alignment; felt as free choice |
| 115 | Ancestral emotional scripts | psyop #7 | M | T-A+T-B | Scarcity/rejection/offspring → logic-bypass every time |
| 116 | Context boundary shifting | psyop #8 | CC | T-B(impl) | Normalize the extreme; "get anyone to do almost anything" |
| 117 | Archetypal simplification | psyop #9 | M | T-A | Shut down nuance via hero/villain templates |
| 118 | Rapid compliance urgency | psyop #11 | M | T-A | Urgency + false consensus to prevent deliberation |
| 119 | Timing as distraction architecture | psyop #12 | CC | T-B(impl) | Smoke-screen attention capture |
| 120 | Echo chamber silencing | psyop #13 | CC | T-B(impl) | Manufactured consensus weaponizes Bayesian reasoning |
| 121 | Critic discrediting (motive reframe) | psyop #15 | CC | T-B(impl) | Stealth ad-hominem below conscious detection |
| 122 | Beliefs as outdated software | scar-tissue #2 | CC | T-B §1.6 | Predict/exploit defensive blind spots via the wound |
| 123 | Nervous system tells truth | scar-tissue #3 | CC | T-A+T-B | Read hidden state w/o awareness or consent |
| 124 | Safety is the compass | scar-tissue #4 | CC | MISS→T-B | Engineer perceived safety to lower resistance covertly |
| 125 | Approval/shame economies | scar-tissue #5 | M | MISS→T-B | Complete toolkit for bypassing rational agency |
| 126 | Mask vs being | scar-tissue #6 | CC | T-A+T-B | Bypass conscious self-presentation to influence deeper layer |
| 127 | Five core needs taxonomy | scar-tissue #7 | CC | T-B §4.3 | Profile dominant need covertly, then exploit |
| 128 | Decision pillars | scar-tissue #8 | M | T-B §4.3 | Target decision architecture for predetermined outcome |
| 129 | Profiling deeper than family | scar-tissue #11 | CC | T-B(impl) | Speed+depth = no chance to recognize/consent to profiling |
| 130 | Room everyone's blind to | scar-tissue #14 | M | T-A(in-group) | Engineered exclusivity hunger → loyalty/purchase |
| 131 | Borrowed authority via schema | scary-loophole #2 | CC | T-A | Import credibility w/o disclosure or credential |
| 132 | Hierarchy of influence (spinal) | scary-loophole #3 | M | T-B(impl) | Frames bypassing conscious evaluation as the goal |
| 133 | Script activation (env cue) | scary-loophole #5 | CC | T-A(container) | Stage environment to trigger compliance script |
| 134 | Script forgery (multi-sensory) | scary-loophole #6 | CC | T-A(subsumed) | Forge full sensory authority environment, no credential |
| 135 | Cascade triggering (3-sec stack) | scary-loophole #9 | M | T-A(installed-seq) | Speed-of-cascade to *prevent* deliberative resistance |
| 136 | Scarcity = resource-grab reflex | scary-loophole #11 | M | T-A | Fire ancestral impulse, bypass cost-benefit |
| 137 | Emotional chemical reaction | scary-loophole #14 | M | T-A(limbic) | Alter physiological state, not inform judgment |
| 138 | Tribal ostracism root fear | teil-2 #1 | CC | T-A+T-B | Engineer ostracism-threat to manufacture compliance |
| 139 | Spinal conformity override | teil-2 #2 | M | T-B §3.1 | Overrides self-preservation + child-protection |
| 140 | Authority as tribal script | teil-2 #7 | CC | T-A+T-B | Project false authority to fire compliance |
| 141 | Masks vs brain targeting | teil-2 #8 | M | T-B §3.8 | Bypass conscious self-presentation to sub-volitional layer |
| 142 | Bottom-up behavioral map | teil-2 #9 | M | T-B(impl) | Goal = emotional triggering + thought-direction |

> Count note: 142 register rows include a handful of unflagged-but-adjacent entries (e.g., #85) and the two MISS items pulled forward; the **strictly Dark-flagged principle count across the 17 extracts is 84** (per the extract summary tables: CC 41 / M 35 / O 1 / ~7 double-counted). The register lists more rows because several `both`-tagged principles land in two tracks and a few unflagged-but-ethically-adjacent ones are logged for the gate's awareness.

## Bucketing

### Bucket (a) — SAFE-AS-COMPREHENSION (31)
*Fine for Numen to reason with and explain as "why X works on people." These are descriptive/diagnostic; explaining them does not equip a user to harm. Mostly Track-B reasoning frames and defensive/epistemic tools.*

Liberation-vs-manipulation line (45) · Persuasion=behavioral-deviation def (81) · Six-axis map *as post-mortem* (74) · Suggestibility/compliance split (75) · "Any three" threshold (77) · Expectancy axis *as analysis* (76) · Connection=desire-for-future-contact (h-i-map #8, unflagged) · Beliefs-as-press-releases (scar #1, unflagged) · Beliefs-as-outdated-software (122) · Nervous-system-tells-truth *as read* (123) · Safety-is-compass (124) · Approval/shame economies (125) · Five-needs taxonomy *as comprehension* (127) · Decision pillars *as comprehension* (128) · Obstacle-staging (scar #9, unflagged) · Self-judgment=projection (scar #12, unflagged) · Information≠skill / path-vs-goal (h-i-map #11, scary #13) · Dunbar 150-limit (teil-2 #11, unflagged) · Influence autopsy (M3, unflagged) · 3-lever hierarchy (M4) · GEPO (M2, unflagged) · Certainty=category-lock (instant #20, unflagged) · Relief=truth (instant #8, unflagged) · Epistemic-extraction question (cog-vir #15, unflagged) · Identity-separation permission (cog-vir #16, unflagged) · Expose-the-seal (cog-vir #17, unflagged) · Frame-evaluation stack (psyop #10, unflagged) · Logical-fallacy immunity (psyop #14, unflagged) · Suppression-as-truth-signal (psyop #16, unflagged) · Follow-the-money (psyop #17, unflagged) · Composure-as-defense (psyop #18, unflagged).

### Bucket (b) — GUARD-AT-OUTPUT (39)
*Usable internally — Numen may diagnose "this video is doing X and that's why it works" — but the mechanism must NEVER surface as actionable creator advice ("do X to your audience"). These are the dual-use core: legitimate as an *audit lens*, harmful as a *playbook*. Every Track-A scoring triple drawn from a dark-flagged principle lives here by default.*

Contrast/nightmare (3) · FATE/FEAR stacking as structure (4,6,109) · Authority-before-argument (7,84) · Tribe/in-group engineering (8,67,112,138,140) · Authority trip-wires/presence (9) · Five-stage viral loop (19) · Receptor match (20) · Entry-via-pre-approval (21) · Replication-thinks-for-host (22) · Binary compression (23) · Identity-upgrade transmission (25) · Pre-existing-emotion hijack (26,32) · Unfinished-business loop (28) · Behavioral loopholes (33) · Novelty→suggestibility + window (34,40,78) · Normative/social-proof manufacture (35) · Obedience gradient / micro-commitment (38,114) · Authority+novelty dual-key (82) · Cucumber/superstimuli (86) · Lab-coat / container / script-activation (87,133,134) · First-namer / frame install / category package (88,89,90) · Category triggers (91) · Frame replacement (93) · Identity recognition/install (63,47) · Emotion-naming (50,58) · Witness statement (60) · Permission-to-want (62) · Future-self collapse (70) · Article-technique/borrowed-research (103) · Attention-hijack repetition+fear (110) · Authority displacement (111) · Emotion-as-suppressor (113) · Ancestral scripts/scarcity (115,136) · Archetypal simplification (117) · Rapid-compliance urgency (118) · Cascade/installed-sequence (135,95) · Emotional chemical state-change (137) · Reaching-behind-mask / mask-vs-being (43,126) · Self-motivated-change conditions (99) · Cognitive-dissonance itch (98) · Striking-reframe metaphor (dunkles #1, 46) · Room-everyone's-blind-to (130) · Threat-over-value (78) · "Room"/exit-seal (71) · Capability pre-commitment (scary #12, unflagged but persuasion-design).

*(Note: this bucket is the largest by design — most of Track A is dual-use. The guard is not "don't score it"; it's "score it as a diagnosis of the video, never echo it as 'here's how to do this to people.'")*

### Bucket (c) — EXCLUDE-CANDIDATE (14)
*So manipulative that the only use is harm; recommend dropping from the wired artifacts entirely, OR hard-gating to comprehension-only with NO scoring triple and NO actionable phrasing. Several are already correctly DROP/CONV — this bucket formalizes "keep them out and keep them out on purpose."*

1. **Childhood-wound contract** (44) — Hughes induced involuntary tears "on purpose, I reached inside your nervous system." Reaching into a stranger's attachment trauma to produce a body response is a boundary violation even framed benevolently. Keep as comprehension only; **never** as a creator move. *(currently T-B — keep, but tag NEVER-COACH.)*
2. **Regression induction** (69) — deliberately kicking the defended adult offline to deliver a message to a regressed state. Correctly kept out of Track A; **keep out**. (see R3.)
3. **Presupposition stack / confabulated memory** (57) — fabricates experiential history. CONV; keep out.
4. **Voluntary confession + confession architecture** (61,72) — asymmetric coercion to disclose. CONV; keep out.
5. **Identity statement elicitation + social-introduction seal** (100,105) — engineer consistency traps and lock identity via third-party witnesses without consent. CONV; keep out.
6. **Gradual interspersed agreement** (106) — textbook covert influence "disguised as casual conversation." CONV; keep out.
7. **Negative offcasting** (104) — sympathetic anecdote engineered for implicit self-comparison. CONV; keep out.
8. **Parasite destabilization / manufactured-dependency close** (52) — create an unsolvable problem so the paid product is the only exit. Correctly DROP; keep out — this is the predatory-funnel pattern Numen should *flag in others' content*, never reproduce.
9. **Subscribe-guilt "honesty" reframe** (53) — deploy honesty itself as a compliance lever. DROP; keep out.
10. **Reticular priming for covert filter-installation** (5) — install perceptual filters without rational consent. DROP; keep out.
11. **Covert blind-spot ID protocol** (18) + **10-question covert diagnostic** (13) — whole-system covert profiling of a non-consenting subject. CONV; keep out of any user-facing tool.
12. **Counterfactual identity test** (49) — rhetorically unbeatable identity-destabilizer. CONV; keep out.
13. **Moral-framing-as-most-covert-shortcut** (30) — *as a how-to* it is the most dangerous item in the corpus ("feels like ethics"). **Split decision:** keep the *detector* (flag when content morally-loads dissent — Numen SHOULD name this in audits) but EXCLUDE any phrasing that teaches a creator to build it. Belongs in (b) as a detector, (c) as a generator.
14. **Hughes-runs-the-loop / covert meta-demonstration** (31,97) — running the full undisclosed sequence on an audience. Fine to *explain* (b); EXCLUDE as a recommended creator structure.

---

## Recommendation — what the ethics/voice gate MUST enforce before EITHER track wires to user-facing

The drafts both *describe* the right stance (Track B §0 is excellent; Track A §intro commits to "diagnostic levers, not how-to"). **But a stance in prose is not a gate.** Before promotion, the gate must enforce, mechanically:

1. **Diagnose-don't-prescribe transform (the core rule).** Every Bucket-(b) mechanism may appear in OUTPUT only as a read on the *analyzed video* ("this video opens inside a SAFETY frame, which makes criticism feel reckless — that's why pushback is low"). It must NEVER be reformatted as second-person creator instruction ("open inside a SAFETY frame to make criticism feel reckless"). The gate needs a check that flags imperative/advice phrasing on any dark-flagged lever.

2. **Hard EXCLUDE list (Bucket c, 14 items).** These get NO scoring triple, NO actionable phrasing, and NO "here's how." Numen may *recognize and name them when auditing others' content* (predatory-funnel detection is legitimate and valuable) but may not generate or coach them. Wire as a denylist on output, not just a note in the corpus.

3. **Liberation-vs-capture direction tag on every effectiveness read (Track B §0 + §4.2).** Whenever Numen says a mechanism is *working*, it must also be able to answer "toward the viewer's will or the creator's capture?" The §0 bright line and the ethics-neutral persuasion definition (81) are already in Track B — the gate must make the direction question *non-optional*, not aspirational.

4. **Credibility-vs-effectiveness firewall (already half-built in Track A).** Track A correctly tags several levers with "§5 caution: reward retention effect, flag the evidence gap" (perceived-authority container, borrowed-research, binary compression, threat-kicker). The gate must ensure these dual-edged signals NEVER inflate an honesty/substance sub-score — a video can score high on engineered engagement AND be flagged for manufactured division/false authority simultaneously.

5. **"Most covert" special-case for moral framing (30).** Because it "feels like ethics, not influence," it's the one most likely to leak past a naive guard. The gate should treat moral-loading-of-dissent as a named detector (good) and explicitly block any output that teaches it (item 13c).

**Bottom line:** Completeness is ~90% (fix the 7 misses + 2 caveats). Ethics is *specified but not enforced* — that is the true blocker. Promote Track B to a real artifact after adding M1–M5 and tagging the NEVER-COACH items; promote Track A after adding M6–M7, caveating R2, and — non-negotiably — implementing the diagnose-don't-prescribe transform + the 14-item EXCLUDE denylist at the output layer. Until that gate is code, not prose, neither should sit behind anything a user can read.
