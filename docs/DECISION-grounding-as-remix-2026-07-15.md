# Decision — grounding is a shared decode→adapt service, not a per-skill prompt slice

**Date:** 2026-07-15 · **Status:** direction agreed with owner; hooks prototype in flight
**Supersedes the implied conclusion of** `docs/AB-GROUNDING-3ARM-2026-07-14.md` (which read as
"ungrounded won"). That framing was wrong — see §2.

---

## 1. What we set out to answer

Does grounding — showing the generator proven, retrieved examples before it writes — actually make
a **better hook**? The moat rests on "yes," and it had never been measured. We measured it.

## 2. What we found, and where the first read was wrong

The first A/B ([3-arm](AB-GROUNDING-3ARM-2026-07-14.md)) put **cold** (no corpus) against **grounded
as-ships** and a **structure-only** variant. On a craft read, cold looked best in every case and
grounded produced occasional nonsense.

**That verdict was measuring the wrong thing, in two ways the owner caught:**

1. **Craft ≠ virality.** The read favored writerly, original-sounding lines. The platform rewards
   *proven formats* that read as "generic" precisely because they have pulled millions of views
   ("3 levels of…", "you've been lied to about…"). Cold's lines were differentiated-from-nothing —
   "sophisticated ChatGPT." **We have no view data; neither the human read nor our Flash SIM is
   evidence of what performs.** "Ungrounded won" was never a fact.
2. **The failure was a TRANSPLANT, not grounding.** Grounded didn't lose because examples are
   poison. It lost because it was handed a **130-char madlib and nothing else**, then transplanted
   it blindly — filling in a proven skeleton without asking whether the skeleton even fit. That is a
   pipeline defect, not a verdict on the thesis.

**The owner's reframe (the real thesis):** this is **remix** — *copy what's working and adapt it for
yourself*. Sometimes a near-verbatim clone is right (swap two words); sometimes only the angle
transfers and you re-voice it entirely. A structure proven in one niche can win in another by
changing two words — **cross-niche transfer is the asset, not a leak.** The generator just needs
(a) enough information to judge fit and adapt, and (b) permission to choose how hard to borrow.

## 3. The root cause, quantified

We showed the hook writer ~1% of what we store per teardown.

| shown to the writer (clipped) | stored but WITHHELD |
|---|---|
| archetype label | the beat `skeleton` + `beats` (the actual structure) |
| madlib — clipped to 130 chars | `guidance` = **"WHEN to use this structure"** — the literal fit signal |
| "ran as" — clipped to 100 chars | the `belief ↔ reality` tension that made it travel |
| "why" — clipped to 120 chars (cut mid-sentence) | `format`, `visual_hook`; the **full** unclipped why |
| the receipt | |

We stored the fit signal and hid it, then asked the model to judge fit. It couldn't, so it
transplanted. Compounding it: the rich `template` blob (beats + guidance + skeleton) was **silently
failing its JSONB parse** on 14/300 rows and being dropped entirely — over a missing `startSec`
garnish. **Fixed 2026-07-15** (`src/lib/grounding/types.ts`: beat timings are now `.optional()`;
300/300 templates parse; regression test added). A separate lesson: the drop-warning printed the
top-level keys (all valid), hiding that the real fault was `beats.0.startSec` — a confident log that
named the wrong thing and cost a session. Now it prints the failing path.

## 4. The decision

### 4a. Grounding is a shared two-stage service, used by every skill

The current architecture has each skill reach into the raw corpus, and a **per-skill renderer**
(`src/lib/grounding/prompt.ts`) decides which few fields that skill sees — hooks→madlib,
ideas→belief↔reality, script→beats. **That upfront "this skill needs only these fields" guess is the
bug that starved hooks.** Adding Ideas and Script the same way makes the same guess three times.

Instead — mirror what the **remix skill already does** (`resolve → decode → adapt`):

- **DECODE** — the full corpus row. Already stored; the parse fix makes it whole.
- **ADAPT** — one focused call that receives the **entire** decoded row(s) + the calling skill's
  intent (*"a hook for this ask"* / *"an idea angle"* / *"the beat map"*) + the creator profile +
  the dosage rule, and returns a **compact adapted brief**. Skills consume the brief, never raw
  fields. Any other grounding source plugs into the same adapt layer.

The per-skill difference becomes an **instruction to the adapt stage**, not a hand-curated column
slice. "Give it everything and let it reason" happens in the one stage built to afford it.

### 4b. Why the full data must NOT go straight into the writer's prompt

The writer bundle has a hard `BUNDLE_CHAR_CAP` (4000). On overflow, `assembler.ts` drops the
creator's **PROFILE roles** from the tail first — so a fat corpus **evicts the creator's own voice**,
the exact half that makes a hook theirs. The adapt stage has its own budget and emits a small output,
so it sidesteps the collision. (The standing "invert the assembler drop-order" debt is mitigated, not
resolved, by this move.)

### 4c. The dosage knob

The adapt stage chooses, per output, how hard to borrow: **clone** (a proven line already fits; swap
the subject) · **swap** (keep the structure, new line in the creator's voice) · **angle** (take only
the tension, fully re-voice) · **none** (nothing fit; write original). Fit is judged against
`guidance`. Remix's own adapt is hardcoded to one setting ("format only, always distinct"); this adds
the dial it lacks.

### 4d. Every skill on the platform — one corpus, three consumption modes

"Apply to all skills" is not one adapt-stage bolted onto everything. The platform's skills (chat,
explore, hooks, ideas, predict, profile, remix, script, simulate) consume the corpus in **three
distinct modes** over one shared retrieval+decode foundation:

| mode | skills | what it does | needs the adapt stage? |
|---|---|---|---|
| **generate-by-remix** | hooks · ideas · script · **remix** | borrow a proven STRUCTURE, dose it (clone/swap/angle/none) to the creator | **yes — this is §4a** |
| **retrieve-to-cite / inspire** | chat · explore | surface real proven examples as evidence / ideation fuel | no — retrieval + citation, no dosage |
| **judge-by-benchmark** | predict · simulate | score content against what "proven" looks like | no — corpus as reference distribution |

`remix` is the ORIGIN of mode 1 (decode→adapt on a user-pasted video); grounding-as-remix is the same
core pointed at the *retrieved* corpus. `profile` barely needs the corpus. **Do not force modes 2 and
3 through the generate adapter** — they share the decoded foundation, not the adapt stage.

## 5. What is proven vs still open

- **Proven:** retrieval is good (6 archetypes, 524/532 rows reachable, real cross-niche transfer);
  the transplant defect is real and diagnosed; the parse bug is fixed; the full anatomy now survives.
- **Prototype (in flight):** `scripts/proto-adapt-hooks.ts` — the adapt stage for hooks, A/B'd
  against cold + transplant in `docs/AB-GROUNDING-REMIX-2026-07-15.md`. Early single-case read: it
  varies the dial, reasons about fit, and re-voices borrowings instead of transplanting.
- **STILL OPEN — the honest gate:** *which approach actually gets more views.* That needs a real
  outcome signal (which hooks users pick/post/perform), or at minimum a blind panel of social-native
  people. Neither our taste nor our SIM settles it. **Do not treat "remix wins the eyeball test" as
  proof it wins the feed.**

## 6. Next

1. Land the hooks adapt prototype behind a flag; read the labelled A/B with the owner.
2. If it holds, promote the adapt stage into `src/lib/grounding/` as the shared service; migrate
   hooks off the per-skill renderer to consume the brief.
3. Wire a real outcome signal before declaring victory.
4. Then, and only then, extend the same adapt layer to Ideas and Script.

## Appendix — artifacts & code

- `docs/AB-GROUNDING-3ARM-2026-07-14.md` — cold vs transplant vs structure-only (the run that
  mismeasured).
- `docs/AB-GROUNDING-REMIX-2026-07-15.md` — cold vs transplant vs **remix** (this direction).
- `scripts/proto-adapt-hooks.ts` — the prototype adapt stage (NOT wired to prod).
- `scripts/ab-grounding-remix.ts` — the labelled harness (reuses the cached arms).
- `src/lib/grounding/types.ts` — the parse fix + regression test (`__tests__/types.test.ts`).
- Escape hatches, all default-off: `GROUNDING_HOOKS_SURFACE=structure`, `GROUNDING_HOOKS_RANK=topical`.
