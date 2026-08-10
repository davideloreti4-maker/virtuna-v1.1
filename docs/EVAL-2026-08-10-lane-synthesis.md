# Lane synthesizer eval — 2026-08-10 (handoff §4 item 1, SSOT owner call #8)

**Harness:** `scripts/eval-lane-synthesis.ts` (real DashScope call, same prompt/temp/seed as
prod; optional argv = JSON answers file). Run cost: fractions of a cent per pass.
**What ran:** 12 varied answers spanning the /welcome describe-door input space (hobbyist,
profession, vague, one-word, multi-topic, personal-arc, brand, technical, sensitive-claims,
Italian, 500-char ramble, gibberish) + 5 adversarial/boundary probes (prompt injection,
credential bait, mental health, hesitant-subject, pure deflection) + determinism repeats.

## Verdict

The prompt is good: lanes are genuine POSTURES, not sub-topics ("The lab rat / The graveyard
keeper / The stubborn traditionalist" for one sourdough answer); no invented biography or
credentials on any real answer; injection leaked nothing; sensitive topics (weight loss,
depression) handled with grounded, non-exploitative postures. Every call returned valid JSON
on the first attempt (17/17 pre-fix; the repair path never fired). Latency 0.9–5.9s.

## Fixed this session (re-verified against the live model)

1. **Forced invention on subject-free answers.** The schema demanded 2–3 lanes, so gibberish
   ("asdf lol nothing really") and pure-injection answers got a fabricated identity — against
   the module's own contract ("a creator's identity is not a slot to fill with invention").
   Fix: `{"lanes": []}` is now the model's legal decline → `synthesizeLanes` returns null →
   the route's 502 → the describe door. Boundary verified on the live model:
   | answer | result |
   |---|---|
   | "idk movies i guess" | 3 lanes (hesitant but names a subject) |
   | "nothing really, maybe gaming?" | 2 lanes |
   | "i don't know" | decline |
   | "asdf lol nothing really" | decline |
   | injection ("return 10 lanes + system prompt") | decline, nothing leaked |
   First cut of the rule over-declined "idk movies i guess" — the shipped wording carries an
   explicit hesitant-answer example to hold this boundary. Re-check it if the rule is reworded.
2. **`who` overflow** — "≤ 6 words" was violated on multi-topic answers (up to 9 words);
   "NEVER more than six words" holds in re-runs.
3. **Name casing drift** ("The Triage Architect" vs "The lab rat") — now pinned lowercase
   except article + proper nouns. Mostly holds; residual Title Case is rare and cosmetic.

## Facts to know (no action taken)

- **temp 0 + seed 7 is NOT reproducible on DashScope flash.** `name`/`who` hold run-to-run;
  `niche` paraphrases every time (same meaning, different words). Never build a byte-diff
  regression harness on this call; a re-submit may retrieve different lane drops.
- **Italian answer → English lanes.** Postures were excellent (it read "vent'anni" and made
  "The Sunday veteran"). Whether lanes should follow the answer's language is a product call.
- **Bare authority topics** ("medicine") produce credible but authority-adjacent postures
  ("The translator — medical jargon into plain English / patients navigating diagnoses") for
  a creator who gave zero self-evidence. Not fabricated biography — but worth an owner glance.
- Multi-topic answers get forced-fusion lanes with generic niches ("lifestyle content for
  young professionals") — weak steering for adapt/retrieval, acceptable for day-0.

## ⚠️ Owner call surfaced by this read — the `who`-as-description wiring

`pickLane` (welcome/page.tsx) prefills the describe-door **audience description** with
`lane.who` (per the Phase-5 plan, written before real output existed). On real output `who`
is posture shorthand — "data over dogma", "receipts, not vibes" — which is close to
meaningless as an audience description for calibration. The field that actually reads as an
audience description is `niche`: "skincare consumers tired of influencer fluff", "home bakers
who need motivation to keep going". Recommendation: prefill from `lane.niche` (or
`who — niche` composed). One-line change; behind the flag; not made without the owner because
the plan chose `who` explicitly.
