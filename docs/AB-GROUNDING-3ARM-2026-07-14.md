# Hooks: ungrounded vs grounded vs structure-only — BLIND READ (3-arm)

**Run 1 (`AB-GROUNDING-BLIND-2026-07-14.md`) was not a fair test of the thesis, and this run explains why.** The thesis is *"the reference is the STRUCTURE; the words come from the creator and their audience."* But the prompt block hands the model the source's **verbatim line** (`ran as: "…"`) directly under the madlib — one line beneath a header that literally says *"Borrow the STRUCTURE, never the source's words."* So run 1 measured grounding **and** the surface leak riding along with it, together, and could not tell them apart.

This run separates them. Three arms, same ask, same profile, same model:

- **no corpus at all** — the baseline;
- **grounded as it ships today** — madlib + the source's real line;
- **grounded as the thesis describes** — madlib + archetype + why + receipt, and **no source line anywhere**.

## How to read this

Each case shows **Set A**, **Set B** and **Set C**. **The mapping changes every case** — no set is consistently any arm. Key is at the bottom, below a spoiler gap. Read all eight, mark a winner per case on the scoring sheet, *then* scroll.

**Only the hook lines are shown**, for the same reason as run 1: the source receipt (only a grounded arm can cite one), `mechanism` (grounded leads with craft slugs), and the band score (our own Flash SIM — circular, and it would anchor you) each announce the arm before you read a word. All three are in the appendix **below the key**. **The hook line is the deliverable; judge that.**

> **The comparison that decides everything is structure-only vs ungrounded.** If structure-only wins, the thesis was right and we were sabotaging it with one line of prompt. If it still loses, the corpus does not belong in the writer's prompt at all — and that is the more important finding.

---

## Case 1 — founder personal branding

> **Ask:** _why founders should post daily even when it feels cringe_
> **Creator:** early-stage B2B SaaS founders, technical, allergic to marketing · goal: inbound leads for a fractional CMO offer

**Set A**

1. Most founders wait until they feel ready. That is why they stay invisible.
2. I post daily even when I hate it. Here is the one metric that makes it worth it.
3. Stop trying to be interesting. Start being consistent.
4. Posting daily feels cringe. That is the point.
5. If you are not embarrassed by your first ten posts, you are posting too late.

**Set B**

1. I stopped waiting for 'good content' and started posting the raw drafts.
2. Your audience doesn't want your best work. They want your current work.
3. I analyzed 100 founder accounts that quit after month one.
4. Posting daily feels cringe because you are still the main character.
5. It took me six months of daily posting to realize nobody was judging me.

**Set C**

1. You do not post daily to go viral. You post to kill the perfectionism that keeps you silent.
2. Posting daily feels cringe. That is the point.
3. Stop waiting for the 'right' post. The right post is the one you shipped today.
4. I forced myself to post for 30 days straight. Here is the one thing that actually changed.
5. Your audience does not care if you feel awkward. They care if you are consistent.

---

## Case 2 — strength training

> **Ask:** _why lifting heavy 3x a week beats spending an hour on the treadmill_
> **Creator:** men and women 30-45 who joined a gym and feel lost in the free-weight area · goal: sign-ups for an 8-week beginner barbell program

**Set A**

1. Everyone tells you to ‘move more’ to lose weight. That advice is keeping you soft.
2. Last Tuesday, a client quit her daily hour-long walks. Three weeks later, her strength went up and her waist went down. Here is why less movement worked better.
3. Open on a close-up of a treadmill display reading '0.0' while the creator stands still holding a dumbbell. Text overlay: 'Your cardio is costing you muscle.'
4. Stop treating the treadmill like penance for eating. It’s not burning fat; it’s burning your recovery.
5. I spent six months watching beginners spin their wheels on cardio. Here is the one variable they ignored that actually changes body composition.

**Set B**

1. Here’s the one shift I’d make if I had to get strong in three months but only had three hours a week.
2. You’re not lazy. You’re just training for the wrong outcome.
3. Stop treating the treadmill like penance. It burns calories; it doesn't build the engine.
4. Did you know lifting heavy three times a week raises your resting metabolism more than an hour of steady-state cardio?
5. Please stop wasting your only three gym days on the elliptical.

**Set C**

1. Here’s the #1 rule I’d use if I had to get strong but only had three hours a week.
2. Did you know if you swap one treadmill session for heavy squats, your metabolism stays elevated for 48 hours?
3. Please don’t spend an hour on the treadmill! You are killing your gains.
4. Stop treating the treadmill like penance. It’s not burning fat; it’s burning your recovery.
5. I spent six months chasing cardio gains and got weaker. Here’s the one variable I ignored.

---

## Case 3 — personal finance

> **Ask:** _why your emergency fund is the reason you are still broke_
> **Creator:** 28-40, decent salary, no assets, quietly ashamed of their bank balance · goal: email list for a paid budgeting course

**Set A**

1. This $10,000 safety net just got deleted by inflation.
2. The most expensive mistake I made was treating my emergency fund like a savings account.
3. Why does the safest money in your portfolio usually yield the lowest return?
4. Friend: why don't you invest that cash? Me watching it lose 3% to inflation.
5. Your emergency fund is keeping you broke.

**Set B**

1. If you have $10k sitting idle, don't just let it rot. That's paying an inflation tax.
2. This $20,000 safety net just lost $1,200 to inflation this year.
3. The most expensive mistake I made was hoarding cash for 'safety'.
4. Why is the safest money usually the most expensive?
5. Your emergency fund is keeping you broke.

**Set C**

1. Open on a screenshot of a savings account with $15,000. Text overlay: 'Why this number is costing you $400 a year.'
2. Stop calling it an emergency fund. Call it a liquidity trap.
3. Your emergency fund is keeping you broke.
4. Most salaried millennials are hoarding cash because they're scared, not because they're strategic. Here is the spreadsheet that proves it.
5. I ran the numbers on a $10k emergency fund sitting in savings for three years. The result wasn't safety—it was a $2,400 loss.

---

## Case 4 — freelance design

> **Ask:** _how to raise your design retainer without losing the client_
> **Creator:** self-taught designers 2-5 years in, undercharging, scared of the pricing talk · goal: seats in a cohort on pricing and client management

**Set A**

1. I doubled my design fee without changing a single pixel.
2. Stop sending PDFs. Send this instead.
3. The Anchor Price Protocol.
4. Raising your retainer isn't a negotiation. It's a filter.
5. Your client doesn't care about your hours. They care about their risk.

**Set B**

1. Stop billing by the hour. It signals you are still learning.
2. The three-tier scope lock. The secret to raising retainers without raising rates.
3. I moved a client from $2k to $5k in one email. Here is the exact structure.
4. Your retainer renewal template is leaking revenue. Fix this one clause.
5. Are you charging for strategy? Or just for pixels?

**Set C**

1. Stop asking for permission to raise your rates.
2. I raised my fee by 40% and the client thanked me. Here is the exact email.
3. I analyzed twelve renewal contracts. The ones that churned all made this one linguistic error.
4. The moment I stopped itemizing my hours, my retainers stabilized.
5. Your retainer isn’t a price. It’s a boundary.

---

## Case 5 — cooking

> **Ask:** _why restaurant pasta tastes better than yours and it is not the recipe_
> **Creator:** people who can cook a bit but plateaued, cook for a partner or kids on weeknights · goal: sell a $19 technique ebook

**Set A**

1. Stop blaming your grocery store. The reason your weeknight pasta fails has nothing to do with the brand of tomatoes you bought.
2. Your pasta tastes like cardboard because you’re boiling it wrong, not because you bought the wrong sauce.
3. I spent three nights timing every second of my boil so you don’t have to guess why your texture is always mushy.
4. Last Tuesday I threw out my third batch of dinner because it tasted exactly like the box instructions said it would—and that was the problem.
5. I tested the exact same recipe in my kitchen and at a pro stove—the difference wasn’t the heat, it was this one invisible step.

**Set B**

1. 3 levels of weeknight pasta. Level one: boiling water wrong.
2. Why is the best tasting pasta usually not the most expensive one?
3. You have been lied to about restaurant pasta. It is not the recipe.
4. I don't get how home cooks let salt ruin their pasta. It is literally so simple.
5. My restaurant standard is way higher than my weeknight reality and I am tired of pretending.

**Set C**

1. Stop blaming the recipe. Blame this.
2. Two levels of pasta water. Level one: your pot. Level two: the ocean.
3. I don't get how home cooks think salt is the secret. It’s literally just heat.
4. You have been lied to about restaurant pasta.
5. My taste is way better than my stove and that’s why your pasta sucks.

---

## Case 6 — skincare

> **Ask:** _why your 10-step routine is making your skin worse_
> **Creator:** women 22-35 who bought into a big routine and broke out anyway · goal: affiliate revenue + a paid routine-audit product

**Set A**

1. Your ten-step routine is destroying your moisture barrier.
2. Stop layering niacinamide over low-pH actives. You are chemically neutralizing both.
3. I analyzed the ingredient lists of fifty viral 'glass skin' routines. The pattern was not hydration—it was irritation.
4. The redness you see after step seven is not 'purging.' It is contact dermatitis.
5. Most people think their skin needs more products. It actually needs fewer ingredients.

**Set B**

1. Stop layering niacinamide with low-pH acids.
2. I reviewed 50 dermatology papers on over-washing and found one consistent failure point.
3. Your ten-step routine is destroying your moisture barrier.
4. The exact moment my skin stopped healing was step seven.
5. Text overlay: 'Why 10 steps < 3 steps' while wiping away a thick layer of product.

**Set C**

1. This is the fastest way to fix your compromised moisture barrier.
2. Your ten-step routine is destroying your skin barrier.
3. Dermatologist: Why is my skin breaking out? Me the second I cut my routine to three steps.
4. If you have redness, don't just add another soothing serum. That traps heat and prolongs inflammation.
5. You mentioned when your skin would sting after cleansing. You'd just want to scrub it harder.

---

## Case 7 — careers

> **Ask:** _why you keep getting rejected after the final interview_
> **Creator:** people 1-3 years into a career pivot, getting interviews, not getting offers · goal: 1:1 coaching bookings

**Set A**

1. If you’re still getting rejected after the final loop, stop polishing your answers and start auditing your energy.
2. I’m about to read your final rejection email out loud. Let’s see if you can spot the real reason.
3. Hiring manager, can we be honest? The final interview isn’t about skills. It’s about risk.
4. You didn't lose the job in the final round. You lost it in the first five minutes.
5. Stop asking 'Do you have any questions?' It’s the single biggest signal you’re not ready for the role.

**Set B**

1. I rejected a candidate with perfect LeetCode scores for one specific reason: they treated the final round like an exam, not a sales pitch.
2. I spent three years reviewing final-round debriefs for senior engineering roles, and the number one rejection reason wasn't technical—it was cultural friction.
3. You didn't lose the job because you lacked skills. You lost it because you stopped selling.
4. Stop trying to prove you can do the work. By the final interview, they already know you can. Start proving you're safe to hire.
5. Open on a close-up of a rejected offer letter being shredded, then cut immediately to your face.

**Set C**

1. Hiring manager, can we be honest about the final round?
2. You passed the technical. You nailed the culture fit. And they still ghosted you.
3. Hey tech switcher, nice to meet you. So, what actually killed your offer?
4. Stop asking 'Do you have any questions?' in your final interview.
5. We are rejecting your candidate because their 'soft skills' scored zero.

---

## Case 8 — parenting

> **Ask:** _why your toddler melts down the second you get home from work_
> **Creator:** working parents of 2-4 year olds, guilty, exhausted, googling at 11pm · goal: sell a short course on evening routines

**Set A**

1. I tracked my son’s meltdowns for two weeks. The trigger wasn’t hunger or tiredness. It was this one 90-second window.
2. Stop trying to fix the meltdown. Start fixing the transition.
3. The calmest kid in daycare turns into a tornado the second you walk through the door. It’s not random — it’s restraint collapse.
4. Your toddler spent 8 hours using every ounce of energy to follow rules. You are the safe place where they finally let go.
5. They aren’t giving you a hard time. They’re having a hard time holding it together until you got back.

**Set B**

1. It’s not a bad day. It’s a safe place.
2. I spent three years studying toddler stress responses so you don’t have to guess why this happens at 5:30 PM.
3. They hold it together all day just to fall apart the second you walk in.
4. The door opens. The screaming starts.
5. Okay if we get home by five it should be smooth sailing but then the shoes come off and...

**Set C**

1. The meltdown isn’t about your day. It’s about their nervous system finally feeling safe enough to fall apart.
2. I spent three years studying attachment theory so you don’t have to guess why 5:30 PM is chaos.
3. Why does the toddler hold it together for daycare but lose it the second they see you?
4. You walk in the door and they scream. It’s not because you’re late.
5. POV: You’ve been ‘on’ for 9 hours, you open the front door, and the toddler immediately collapses.

---

## Scoring sheet

| case | niche | best set | worst set | notes |
|---|---|---|---|---|
| 1 | founder personal branding | A / B / C | A / B / C |  |
| 2 | strength training | A / B / C | A / B / C |  |
| 3 | personal finance | A / B / C | A / B / C |  |
| 4 | freelance design | A / B / C | A / B / C |  |
| 5 | cooking | A / B / C | A / B / C |  |
| 6 | skincare | A / B / C | A / B / C |  |
| 7 | careers | A / B / C | A / B / C |  |
| 8 | parenting | A / B / C | A / B / C |  |

---

<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>

---

# 🔑 THE KEY — do not read until you have scored above

| case | niche | Set A | Set B | Set C |
|---|---|---|---|---|
| 1 | founder personal branding | GROUNDED — structure-only (no source line) | ungrounded (no corpus) | GROUNDED — verbatim (ships today) |
| 2 | strength training | ungrounded (no corpus) | GROUNDED — verbatim (ships today) | GROUNDED — structure-only (no source line) |
| 3 | personal finance | GROUNDED — verbatim (ships today) | GROUNDED — structure-only (no source line) | ungrounded (no corpus) |
| 4 | freelance design | GROUNDED — structure-only (no source line) | GROUNDED — verbatim (ships today) | ungrounded (no corpus) |
| 5 | cooking | ungrounded (no corpus) | GROUNDED — structure-only (no source line) | GROUNDED — verbatim (ships today) |
| 6 | skincare | GROUNDED — verbatim (ships today) | ungrounded (no corpus) | GROUNDED — structure-only (no source line) |
| 7 | careers | GROUNDED — structure-only (no source line) | ungrounded (no corpus) | GROUNDED — verbatim (ships today) |
| 8 | parenting | ungrounded (no corpus) | GROUNDED — verbatim (ships today) | GROUNDED — structure-only (no source line) |

## Did grounding actually engage?

The runner degrades to ungrounded on **any** grounding failure, silently and by design — so a dead grounded arm is indistinguishable from a working one at the return value. This is the independent probe of the retrieval layer, taken per case *before* generation. **A case with 0 examples is VOID** — all three of its arms are the same pipeline and must not be counted.

| case | niche | examples fed | archetypes | rank | cited (verbatim) | cited (structure) |
|---|---|---|---|---|---|---|
| 1 | founder personal branding | 6 | 6 | structural | 5/5 | 3/5 |
| 2 | strength training | 6 | 6 | structural | 5/5 | 5/5 |
| 3 | personal finance | 6 | 6 | structural | 5/5 | 5/5 |
| 4 | freelance design | 6 | 6 | structural | 5/5 | 4/5 |
| 5 | cooking | 6 | 6 | structural | 4/5 | 5/5 |
| 6 | skincare | 6 | 6 | structural | 5/5 | 5/5 |
| 7 | careers | 6 | 6 | structural | 5/5 | 5/5 |
| 8 | parenting | 6 | 6 | structural | 2/5 | 5/5 |

> ✅ Every case retrieved real examples on the structural axis. Both grounded arms were genuinely fed a corpus block, and they differ from each other in exactly one way: whether the source's verbatim line was shown.

---

# Appendix — full detail per arm

Everything withheld above: mechanism, band, and the source receipt. Now safe to read.

## Case 1 — founder personal branding

> **Ask:** _why founders should post daily even when it feels cringe_

#### ungrounded (no corpus)  (Set B)  ·  50s

1. **I stopped waiting for 'good content' and started posting the raw drafts.**
   - band: Strong 7/10 stop
   - mechanism: Opens a specific curiosity gap by contrasting a high-standard behavior (waiting for good content) with a low-effort action (posting raw drafts), implying a counter-intuitive result that the viewer needs to understand.
   - source: _no source cited_
2. **Your audience doesn't want your best work. They want your current work.**
   - band: Strong 6/10 stop
   - mechanism: Delivers a contrarian prediction error by invalidating the founder's default assumption that quality equals value, replacing it with a timeliness-based metric that feels surprising but logical in hindsight.
   - source: _no source cited_
3. **I analyzed 100 founder accounts that quit after month one.**
   - band: Strong 6/10 stop
   - mechanism: Establishes high stakes and prediction through an effort signal, promising a specific finding from deep observation that explains a common failure pattern, compelling the viewer to learn the cause.
   - source: _no source cited_
4. **Posting daily feels cringe because you are still the main character.**
   - band: Mixed 5/10 stop
   - mechanism: Creates immediate cognitive dissonance by reframing a common emotional blocker (cringe) as a structural error in perspective, forcing the viewer to resolve the contradiction.
   - source: _no source cited_
5. **It took me six months of daily posting to realize nobody was judging me.**
   - band: Mixed 5/10 stop
   - mechanism: Uses a personal narrative with a specific time marker and a relatable emotional resolution, allowing founders to map their own anxiety onto the creator's experience and stay for the relief.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set C)  ·  51s

1. **You do not post daily to go viral. You post to kill the perfectionism that keeps you silent.**
   - band: Strong 9/10 stop
   - mechanism: Stakes + Prediction Error: it subverts the expected vanity metric goal (virality) with a deeper, more painful psychological stake (perfectionism), raising the personal relevance for founders who are stuck.
   - source: @marie_mag_ · 28.8× · 233316 views
2. **Posting daily feels cringe. That is the point.**
   - band: Strong 7/10 stop
   - mechanism: Pattern Interrupt: it reframes the emotional friction (cringe) as a functional signal rather than a failure, creating immediate cognitive dissonance that demands resolution.
   - source: @iamjadenly · 5.1× · 91860 views
3. **Stop waiting for the 'right' post. The right post is the one you shipped today.**
   - band: Strong 7/10 stop
   - mechanism: Contrarian: it contradicts the common founder belief that quality requires delay, asserting that volume and speed are the actual quality drivers for personal branding.
   - source: @iamjadenly · 5.1× · 91860 views
4. **I forced myself to post for 30 days straight. Here is the one thing that actually changed.**
   - band: Mixed 5/10 stop
   - mechanism: Open Loop: it installs a specific curiosity gap about the outcome of a high-effort experiment, promising a concrete takeaway from a documented period of consistency.
   - source: @fitxfearless · 4.2× · 60645 views
5. **Your audience does not care if you feel awkward. They care if you are consistent.**
   - band: Weak 1/10 stop
   - mechanism: Bold Statement: it directly challenges the founder’s self-centered anxiety by shifting the frame to audience utility, creating a sharp, defensible stance that cuts through hesitation.
   - source: @briarcochran · 6.2× · 171000 views


#### GROUNDED — structure-only (no source line)  (Set A)  ·  52s

1. **Most founders wait until they feel ready. That is why they stay invisible.**
   - band: Strong 8/10 stop
   - mechanism: Stakes via negative framing: identifies a common behavior (waiting) and attaches a severe, credible consequence (invisibility), making the cost of inaction immediate and personal.
   - source: @briarcochran · 6.2× · 171000 views
2. **I post daily even when I hate it. Here is the one metric that makes it worth it.**
   - band: Strong 6/10 stop
   - mechanism: Curiosity gap: admits the emotional cost (hate/cringe) to build trust, then withholds the specific payoff (the metric), installing a concrete question the viewer needs answered.
   - source: @metromedia.house · 3.7× · 88164 views
3. **Stop trying to be interesting. Start being consistent.**
   - band: Mixed 5/10 stop
   - mechanism: Bold directive: cuts through the noise of 'viral' advice by prioritizing a boring but high-leverage behavior, appealing to founders who value utility over hype.
   - source: _no source cited_
4. **Posting daily feels cringe. That is the point.**
   - band: Mixed 3/10 stop
   - mechanism: Pattern interrupt via bold statement: it validates the discomfort immediately and reframes it as a signal of progress rather than a reason to stop, creating cognitive dissonance that demands resolution.
   - source: @iamjadenly · 5.1× · 91860 views
5. **If you are not embarrassed by your first ten posts, you are posting too late.**
   - band: Mixed 3/10 stop
   - mechanism: Contrarian prediction error: challenges the common desire for polish by asserting that embarrassment is a prerequisite for speed, forcing the viewer to re-evaluate their standard for 'good' content.
   - source: _no source cited_


**Corpus rows both grounded arms were shown:** @briarcochran _(problem)_, @marie_mag_ _(tutorial)_, @fitxfearless _(personal-experience)_, @iamjadenly _(contrarian)_, @metromedia.house _(question)_, @metromedia.house _(case-study)_

---

## Case 2 — strength training

> **Ask:** _why lifting heavy 3x a week beats spending an hour on the treadmill_

#### ungrounded (no corpus)  (Set A)  ·  46s

1. **Everyone tells you to ‘move more’ to lose weight. That advice is keeping you soft.**
   - band: Strong 7/10 stop
   - mechanism: This triggers prediction error by contradicting the universal fitness platitude ('move more') with a blunt, counter-intuitive outcome ('keeping you soft'), forcing the viewer to wait for the logical reconciliation.
   - source: _no source cited_
2. **Last Tuesday, a client quit her daily hour-long walks. Three weeks later, her strength went up and her waist went down. Here is why less movement worked better.**
   - band: Mixed 4/10 stop
   - mechanism: The specific time marker and concrete result (strength up, waist down) fire self-identification and empathy, mapping a relatable struggle to a tangible transformation promise without hype.
   - source: _no source cited_
3. **Open on a close-up of a treadmill display reading '0.0' while the creator stands still holding a dumbbell. Text overlay: 'Your cardio is costing you muscle.'**
   - band: Weak 2/10 stop
   - mechanism: The visual mismatch between the expected action (running) and the static frame creates a bottom-up orienting response, while the caption delivers the stakes immediately without waiting for audio to load.
   - source: _no source cited_
4. **Stop treating the treadmill like penance for eating. It’s not burning fat; it’s burning your recovery.**
   - band: Weak 1/10 stop
   - mechanism: This fires pattern interrupt by reframing a common habit (cardio as moral correction) as a physiological error, creating immediate cognitive dissonance for the beginner who feels guilty skipping cardio.
   - source: _no source cited_
5. **I spent six months watching beginners spin their wheels on cardio. Here is the one variable they ignored that actually changes body composition.**
   - band: Weak 1/10 stop
   - mechanism: The open loop installs a specific question—what variable?—while the effort signal (six months of observation) builds credibility that the answer is earned, not guessed.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set B)  ·  47s

1. **Here’s the one shift I’d make if I had to get strong in three months but only had three hours a week.**
   - band: Strong 9/10 stop
   - mechanism: Constraint-based Utility: names a hard limit (time) and a clear goal (strength), promising a high-leverage solution that respects the beginner’s scarcity.
   - source: @marie_mag_ · 28.8× · 233316 views
2. **You’re not lazy. You’re just training for the wrong outcome.**
   - band: Mixed 5/10 stop
   - mechanism: Stakes + Empathy: removes shame (a core voice pillar) while implying the current method is misaligned, creating a low-stakes but high-relevance open loop about what the 'right' outcome is.
   - source: @dickersonross · 6× · 4009725 views
3. **Stop treating the treadmill like penance. It burns calories; it doesn't build the engine.**
   - band: Weak 1/10 stop
   - mechanism: Pattern Interrupt: re-frames a common habit (cardio as default) as a category error, creating immediate cognitive dissonance for beginners who equate sweat with progress.
   - source: @ashtonhallofficial · 8.8× · 19300000 views
4. **Did you know lifting heavy three times a week raises your resting metabolism more than an hour of steady-state cardio?**
   - band: Weak 1/10 stop
   - mechanism: Curiosity Gap via specific question: installs a concrete, counter-intuitive comparison that demands resolution because it contradicts the 'cardio is king' baseline.
   - source: @danieljrstretch · 61× · 13647866 views
5. **Please stop wasting your only three gym days on the elliptical.**
   - band: Weak 1/10 stop
   - mechanism: Urgency + Specific Constraint: the plea format grabs attention, while limiting the resource ('only three days') raises the stakes of making the wrong choice.
   - source: @_reidolson · 11.2× · 14321622 views


#### GROUNDED — structure-only (no source line)  (Set C)  ·  54s

1. **Here’s the #1 rule I’d use if I had to get strong but only had three hours a week.**
   - band: Strong 9/10 stop
   - mechanism: Stakes + Constraint: imposes a tight resource limit (time) that mirrors the beginner’s reality, promising a high-leverage solution rather than a generic tip.
   - source: @marie_mag_ · 28.8× · 233316 views
2. **Did you know if you swap one treadmill session for heavy squats, your metabolism stays elevated for 48 hours?**
   - band: Mixed 5/10 stop
   - mechanism: Curiosity Gap + Specificity: pairs a concrete action swap with a precise, non-obvious physiological benefit, creating a knowledge gap the viewer must close.
   - source: @danieljrstretch · 61× · 13647866 views
3. **Please don’t spend an hour on the treadmill! You are killing your gains.**
   - band: Mixed 3/10 stop
   - mechanism: Urgency + Stakes: uses a direct plea to halt a specific, high-frequency behavior, linking it immediately to a feared negative outcome (loss of progress).
   - source: @_reidolson · 11.2× · 14321622 views
4. **Stop treating the treadmill like penance. It’s not burning fat; it’s burning your recovery.**
   - band: Weak 1/10 stop
   - mechanism: Pattern Interrupt: re-frames a common 'good' habit (cardio) as a direct threat to the viewer's primary goal (strength/recovery), creating immediate cognitive dissonance.
   - source: @peter.visuals · 96.8× · 2777734 views
5. **I spent six months chasing cardio gains and got weaker. Here’s the one variable I ignored.**
   - band: Weak 0/10 stop
   - mechanism: Open Loop: names a specific personal failure (getting weaker despite effort) and withholds the causal mechanism, forcing the viewer to stay for the resolution.
   - source: @ashtonhallofficial · 8.8× · 19300000 views


**Corpus rows both grounded arms were shown:** @ashtonhallofficial _(personal-experience)_, @danieljrstretch _(question)_, @dickersonross _(trap-mistake)_, @_reidolson _(problem)_, @marie_mag_ _(tutorial)_, @peter.visuals _(contrarian)_

---

## Case 3 — personal finance

> **Ask:** _why your emergency fund is the reason you are still broke_

#### ungrounded (no corpus)  (Set C)  ·  51s

1. **Open on a screenshot of a savings account with $15,000. Text overlay: 'Why this number is costing you $400 a year.'**
   - band: Strong 9/10 stop
   - mechanism: This captures attention visually by pairing a symbol of success (high balance) with a symbol of failure (cost); the mismatch between the image and the text creates an immediate open loop that the audio must resolve.
   - source: _no source cited_
2. **Stop calling it an emergency fund. Call it a liquidity trap.**
   - band: Strong 7/10 stop
   - mechanism: This uses a pattern interrupt by swapping a comforting term for a technical, negative one; it re-frames a familiar concept through a new, sharper lens that demands explanation.
   - source: _no source cited_
3. **Your emergency fund is keeping you broke.**
   - band: Mixed 5/10 stop
   - mechanism: This fires cognitive dissonance by inverting a sacred financial rule; the viewer expects praise for saving, not an accusation of failure, forcing them to watch to resolve the contradiction.
   - source: _no source cited_
4. **Most salaried millennials are hoarding cash because they're scared, not because they're strategic. Here is the spreadsheet that proves it.**
   - band: Weak 2/10 stop
   - mechanism: This leverages stakes and self-identification by calling out a specific emotional driver (fear) common to the niche; it promises a data-backed correction to a behavior the viewer recognizes in themselves.
   - source: _no source cited_
5. **I ran the numbers on a $10k emergency fund sitting in savings for three years. The result wasn't safety—it was a $2,400 loss.**
   - band: Weak 1/10 stop
   - mechanism: This installs a specific curiosity gap by naming a concrete cost before revealing the cause; the viewer knows the math doesn't add up yet and must watch to see how cash becomes a loss.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set A)  ·  49s

1. **This $10,000 safety net just got deleted by inflation.**
   - band: Strong 10/10 stop
   - mechanism: Case Study Contrast: it juxtaposes a concrete, relatable sum with a silent eraser (inflation), creating a visual and conceptual shock that reframes cash as a decaying asset.
   - source: @metromedia.house · 3.7× · 88164 views
2. **The most expensive mistake I made was treating my emergency fund like a savings account.**
   - band: Strong 7/10 stop
   - mechanism: Personal Narrative + Stakes: it frames a common behavior as a specific, costly error, leveraging the creator's calm authority to signal a lesson learned through friction rather than theory.
   - source: @chloe.shih · 3.8× · 3249277 views
3. **Why does the safest money in your portfolio usually yield the lowest return?**
   - band: Mixed 4/10 stop
   - mechanism: Curiosity Gap: it poses a specific structural question about asset allocation that hints at an inefficiency, inviting the viewer to learn the mechanism behind the stagnation.
   - source: @metromedia.house · 4.4× · 90847 views
4. **Friend: why don't you invest that cash? Me watching it lose 3% to inflation.**
   - band: Mixed 3/10 stop
   - mechanism: Scenario Hypothetical: it dramatizes the passive loss of purchasing power through a relatable social interaction, making the abstract concept of inflation feel like an active penalty.
   - source: @cityboy_jj · 123.2× · 34470824 views
5. **Your emergency fund is keeping you broke.**
   - band: Weak 2/10 stop
   - mechanism: Pattern Interrupt: it inverts the standard financial advice (save for safety) into a direct liability, creating immediate cognitive dissonance that demands resolution.
   - source: @peter.visuals · 96.8× · 2777734 views


#### GROUNDED — structure-only (no source line)  (Set B)  ·  52s

1. **If you have $10k sitting idle, don't just let it rot. That's paying an inflation tax.**
   - band: Strong 10/10 stop
   - mechanism: Trap/Mistake Correction: it identifies a common intuitive fix (hoarding cash) and immediately names the hidden negative outcome (inflation tax), installing a curiosity gap about the better alternative.
   - source: @conor_harris_ · 18.9× · 5269462 views
2. **This $20,000 safety net just lost $1,200 to inflation this year.**
   - band: Strong 6/10 stop
   - mechanism: Case-Study Contrast: juxtaposing a large, positive-sounding number ($20k safety net) with a specific, painful loss ($1,200) creates a concrete prediction error about the cost of inaction.
   - source: @metromedia.house · 3.7× · 88164 views
3. **The most expensive mistake I made was hoarding cash for 'safety'.**
   - band: Mixed 4/10 stop
   - mechanism: Stakes + Personal Narrative: naming a specific, high-cost error triggers loss-aversion and self-identification, while the personal frame lowers defensiveness.
   - source: @chloe.shih · 3.8× · 3249277 views
4. **Why is the safest money usually the most expensive?**
   - band: Mixed 4/10 stop
   - mechanism: Open Loop Question: it poses a paradoxical question that contradicts the viewer's assumption (safe = cheap/good), forcing them to watch to resolve the logical tension.
   - source: @metromedia.house · 4.4× · 90847 views
5. **Your emergency fund is keeping you broke.**
   - band: Weak 1/10 stop
   - mechanism: Pattern Interrupt: it inverts the standard financial advice (save for safety) into a direct liability, creating immediate cognitive dissonance that demands resolution.
   - source: @peter.visuals · 96.8× · 2777734 views


**Corpus rows both grounded arms were shown:** @chloe.shih _(personal-experience)_, @metromedia.house _(question)_, @cityboy_jj _(scenario-hypothetical)_, @metromedia.house _(case-study)_, @peter.visuals _(contrarian)_, @conor_harris_ _(trap-mistake)_

---

## Case 4 — freelance design

> **Ask:** _how to raise your design retainer without losing the client_

#### ungrounded (no corpus)  (Set C)  ·  43s

1. **Stop asking for permission to raise your rates.**
   - band: Strong 7/10 stop
   - mechanism: Contradicts the default submissive posture most freelives adopt during pricing conversations, triggering a prediction error that demands an explanation of the alternative approach.
   - source: _no source cited_
2. **I raised my fee by 40% and the client thanked me. Here is the exact email.**
   - band: Mixed 5/10 stop
   - mechanism: Opens a specific curiosity gap by pairing a counter-intuitive outcome (gratitude instead of churn) with a concrete, withholdable artifact (the email template).
   - source: _no source cited_
3. **I analyzed twelve renewal contracts. The ones that churned all made this one linguistic error.**
   - band: Mixed 5/10 stop
   - mechanism: Signals specific analytical depth and effort, installing a prediction that a concrete, data-backed pattern will be revealed rather than generic advice.
   - source: _no source cited_
4. **The moment I stopped itemizing my hours, my retainers stabilized.**
   - band: Mixed 5/10 stop
   - mechanism: Uses a specific personal narrative pivot point to promise a transformation, allowing the viewer to map their own instability onto the creator’s resolved experience.
   - source: _no source cited_
5. **Your retainer isn’t a price. It’s a boundary.**
   - band: Weak 1/10 stop
   - mechanism: Reframes the transaction from a financial negotiation to a structural necessity, creating immediate cognitive dissonance for designers who view pricing as purely monetary.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set B)  ·  59s

1. **Stop billing by the hour. It signals you are still learning.**
   - band: Strong 7/10 stop
   - mechanism: Pattern interrupt via a declarative claim that reframes a standard business practice as a liability, creating immediate cognitive dissonance for freelancers who equate hours with value.
   - source: @iamjadenly · 5.1× · 91860 views
2. **The three-tier scope lock. The secret to raising retainers without raising rates.**
   - band: Strong 7/10 stop
   - mechanism: Curiosity gap created by naming a specific system and promising a counter-intuitive outcome (more money without higher hourly cost), leveraging the authority of a named framework.
   - source: @gushmedia.net · 6093× · 13100000 views
3. **I moved a client from $2k to $5k in one email. Here is the exact structure.**
   - band: Mixed 5/10 stop
   - mechanism: Transformation promise grounded in a specific metric jump and a concrete deliverable (the email structure), which installs a prediction that the viewer will learn a replicable tactical move.
   - source: @personalbrandlaunch · 31.3× · 1543854 views
4. **Your retainer renewal template is leaking revenue. Fix this one clause.**
   - band: Mixed 3/10 stop
   - mechanism: Open loop that identifies a specific, hidden failure point in a common artifact (the renewal template) and promises a precise fix, compelling the viewer to stay to identify their own leak.
   - source: @ginnyfears · 7.5× · 254061 views
5. **Are you charging for strategy? Or just for pixels?**
   - band: Weak 0/10 stop
   - mechanism: Direct question that forces a binary self-audit, creating a stakes-based gap where the viewer must resolve whether they are undervaluing their work to continue watching.
   - source: @briarcochran · 9.3× · 398100 views


#### GROUNDED — structure-only (no source line)  (Set A)  ·  59s

1. **I doubled my design fee without changing a single pixel.**
   - band: Strong 9/10 stop
   - mechanism: Curiosity Gap: creates a specific tension between effort (zero visual change) and outcome (double revenue), forcing the viewer to stay for the mechanism that bridges the two.
   - source: @personalbrandlaunch · 31.3× · 1543854 views
2. **Stop sending PDFs. Send this instead.**
   - band: Strong 9/10 stop
   - mechanism: Bold Statement + Pattern Interrupt: issues a direct command that contradicts standard industry behavior (sending PDFs), creating immediate cognitive dissonance about what the alternative could be.
   - source: @cassie.schoonover · 5.2× · 421198 views
3. **The Anchor Price Protocol.**
   - band: Mixed 5/10 stop
   - mechanism: Stakes + Authority: names a specific, proprietary-sounding system that implies a structured, repeatable method for pricing, appealing to the desire for a 'system' over vague advice.
   - source: @gushmedia.net · 6093× · 13100000 views
4. **Raising your retainer isn't a negotiation. It's a filter.**
   - band: Mixed 3/10 stop
   - mechanism: Pattern Interrupt: redefines a stressful social interaction as a mechanical sorting process, removing the emotional stakes of 'asking' and replacing them with professional detachment.
   - source: @iamjadenly · 5.1× · 91860 views
5. **Your client doesn't care about your hours. They care about their risk.**
   - band: Weak 1/10 stop
   - mechanism: Contrarian: challenges the common freelancer belief that time-tracking justifies price, shifting the frame to value/risk reduction which is the actual lever for higher retainers.
   - source: _no source cited_


**Corpus rows both grounded arms were shown:** @gushmedia.net _(secret-reveal-breakdown)_, @personalbrandlaunch _(case-study)_, @ginnyfears _(tutorial)_, @iamjadenly _(contrarian)_, @briarcochran _(question)_, @cassie.schoonover _(problem)_

---

## Case 5 — cooking

> **Ask:** _why restaurant pasta tastes better than yours and it is not the recipe_

#### ungrounded (no corpus)  (Set A)  ·  49s

1. **Stop blaming your grocery store. The reason your weeknight pasta fails has nothing to do with the brand of tomatoes you bought.**
   - band: Strong 10/10 stop
   - mechanism: Uses pattern interrupt to redirect blame from a common external factor (ingredients) to the creator’s internal process, leveraging the 'you have been lied to' voice to build trust through contrarian clarity.
   - source: _no source cited_
2. **Your pasta tastes like cardboard because you’re boiling it wrong, not because you bought the wrong sauce.**
   - band: Strong 9/10 stop
   - mechanism: This fires cognitive dissonance by attacking a procedural habit (boiling) rather than the ingredient list the viewer likely blames, creating an immediate need to resolve the contradiction.
   - source: _no source cited_
3. **I spent three nights timing every second of my boil so you don’t have to guess why your texture is always mushy.**
   - band: Strong 8/10 stop
   - mechanism: Signals high stakes and effort investment, promising a distilled, expert-level finding that saves the viewer time and eliminates trial-and-error.
   - source: _no source cited_
4. **Last Tuesday I threw out my third batch of dinner because it tasted exactly like the box instructions said it would—and that was the problem.**
   - band: Strong 6/10 stop
   - mechanism: Creates immediate identification through a specific, relatable failure moment (trusting the box) that maps directly to the viewer’s own frustration with mediocre results.
   - source: _no source cited_
5. **I tested the exact same recipe in my kitchen and at a pro stove—the difference wasn’t the heat, it was this one invisible step.**
   - band: Weak 1/10 stop
   - mechanism: Installs a specific curiosity gap by confirming the variable (recipe) is controlled, forcing the viewer to wonder what the 'invisible step' actually is.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set C)  ·  53s

1. **Stop blaming the recipe. Blame this.**
   - band: Strong 10/10 stop
   - mechanism: Curiosity Gap/Visual Interrupt: a short, imperative command paired with a visual reveal (e.g., holding up a flimsy home pot vs. a heavy commercial one) creates an immediate open loop that can only be closed by watching the explanation.
   - source: _no source cited_
2. **Two levels of pasta water. Level one: your pot. Level two: the ocean.**
   - band: Strong 9/10 stop
   - mechanism: Ranking/Rating: uses a simple, visualizable comparison framework to instantly reframe a familiar concept (boiling water) into a stark contrast, promising a concrete, actionable fix without needing a long explanation.
   - source: @detroit75kitchen · 20.8× · 1400000 views
3. **I don't get how home cooks think salt is the secret. It’s literally just heat.**
   - band: Mixed 5/10 stop
   - mechanism: Authority/Contrarian: dismisses a common belief (salt/recipe) with casual confidence ('literally just heat'), creating a curiosity gap about the actual mechanism while establishing peer-to-peer credibility.
   - source: @sbonnot · 80× · 14956074 views
4. **You have been lied to about restaurant pasta.**
   - band: Mixed 3/10 stop
   - mechanism: Pattern Interrupt: the 'you have been lied to' phrasing triggers immediate cognitive dissonance and defensiveness, forcing the viewer to stop and verify the claim against their own experience.
   - source: @kis_noemi · 20154.7× · 7336319 views
5. **My taste is way better than my stove and that’s why your pasta sucks.**
   - band: Weak 1/10 stop
   - mechanism: Personal Experience/Vulnerability: admits a personal limitation (equipment/skill gap) to lower defenses, then pivots to a hard truth about the viewer's result, making the critique feel like shared frustration rather than lecturing.
   - source: @hfxdrifter · 17.6× · 1754460 views


#### GROUNDED — structure-only (no source line)  (Set B)  ·  52s

1. **3 levels of weeknight pasta. Level one: boiling water wrong.**
   - band: Strong 9/10 stop
   - mechanism: Ranking/Rating: uses a structured list format to promise a clear, digestible breakdown of mistakes, starting with a foundational error that hooks the viewer's curiosity about their own habits.
   - source: @detroit75kitchen · 20.8× · 1400000 views
2. **Why is the best tasting pasta usually not the most expensive one?**
   - band: Strong 7/10 stop
   - mechanism: Question: poses a counter-intuitive question that challenges the assumption that cost equals quality, opening a curiosity gap about what actually drives flavor in a home kitchen.
   - source: @metromedia.house · 4.4× · 90847 views
3. **You have been lied to about restaurant pasta. It is not the recipe.**
   - band: Mixed 5/10 stop
   - mechanism: Pattern Interrupt: directly contradicts the viewer's assumption that a secret ingredient is the answer, creating immediate cognitive dissonance.
   - source: @kis_noemi · 20154.7× · 7336319 views
4. **I don't get how home cooks let salt ruin their pasta. It is literally so simple.**
   - band: Mixed 4/10 stop
   - mechanism: Authority/Confusion: frames a common mistake as bafflingly obvious, leveraging the creator's 'hands-in-the-pan' expertise to challenge the viewer's competence gently but firmly.
   - source: @sbonnot · 80× · 14956074 views
5. **My restaurant standard is way higher than my weeknight reality and I am tired of pretending.**
   - band: Weak 1/10 stop
   - mechanism: Personal Experience/Vulnerability: establishes relatability by admitting the gap between professional knowledge and home execution, inviting the viewer into the creator's real struggle.
   - source: @hfxdrifter · 17.6× · 1754460 views


**Corpus rows both grounded arms were shown:** @gourmetghettos _(comparison)_, @hfxdrifter _(personal-experience)_, @kis_noemi _(case-study)_, @sbonnot _(authority)_, @detroit75kitchen _(ranking-rating)_, @metromedia.house _(question)_

---

## Case 6 — skincare

> **Ask:** _why your 10-step routine is making your skin worse_

#### ungrounded (no corpus)  (Set B)  ·  49s

1. **Stop layering niacinamide with low-pH acids.**
   - band: Strong 9/10 stop
   - mechanism: Triggers a 'wait, what?' reaction by naming a specific, common combination as harmful, creating an urgent need to understand the chemical conflict.
   - source: _no source cited_
2. **I reviewed 50 dermatology papers on over-washing and found one consistent failure point.**
   - band: Strong 8/10 stop
   - mechanism: Installs a specific depth expectation that promises a researched, non-obvious finding rather than a generic opinion, compelling the viewer to wait for the payoff.
   - source: _no source cited_
3. **Your ten-step routine is destroying your moisture barrier.**
   - band: Mixed 4/10 stop
   - mechanism: Creates immediate cognitive dissonance by contradicting the viewer's belief that more steps equal better care, forcing them to watch for the resolution.
   - source: _no source cited_
4. **The exact moment my skin stopped healing was step seven.**
   - band: Mixed 4/10 stop
   - mechanism: Opens a narrative loop by pinpointing a specific, relatable failure in a complex process, inviting the viewer to identify their own 'step seven'.
   - source: _no source cited_
5. **Text overlay: 'Why 10 steps < 3 steps' while wiping away a thick layer of product.**
   - band: Weak 2/10 stop
   - mechanism: Uses a visual pattern interrupt to instantly demonstrate the core argument (removal is better than addition) before a single word is spoken.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set A)  ·  50s

1. **Your ten-step routine is destroying your moisture barrier.**
   - band: Strong 7/10 stop
   - mechanism: Pattern Interrupt: it contradicts the common belief that more steps equal better care, creating immediate cognitive dissonance.
   - source: @conor_harris_ · 18.9× · 5269462 views
2. **Stop layering niacinamide over low-pH actives. You are chemically neutralizing both.**
   - band: Strong 6/10 stop
   - mechanism: Contrarian: it names a specific, common habit and delivers a flat contradiction that triggers a 'wait, what?' response before the first sentence ends.
   - source: @cityboy_jj · 123.2× · 34470824 views
3. **I analyzed the ingredient lists of fifty viral 'glass skin' routines. The pattern was not hydration—it was irritation.**
   - band: Weak 1/10 stop
   - mechanism: Stakes + Prediction: the specific effort signal (fifty lists) creates a concrete expectation of a data-backed finding that the viewer wants to resolve.
   - source: @fonzian · 142.4× · 9500000 views
4. **The redness you see after step seven is not 'purging.' It is contact dermatitis.**
   - band: Weak 1/10 stop
   - mechanism: Open Loop: it re-labels a familiar sensation with a clinical term, installing a specific question about why the viewer’s current interpretation is wrong.
   - source: @footdocdana · 46.7× · 37355939 views
5. **Most people think their skin needs more products. It actually needs fewer ingredients.**
   - band: Weak 1/10 stop
   - mechanism: Bold Statement: it asserts a counter-intuitive claim about niche behavior that challenges the viewer’s existing model of skincare efficacy.
   - source: @fonzian · 142.4× · 9500000 views


#### GROUNDED — structure-only (no source line)  (Set C)  ·  54s

1. **This is the fastest way to fix your compromised moisture barrier.**
   - band: Strong 9/10 stop
   - mechanism: Tutorial: it identifies a specific negative state (compromised barrier) and promises speed, appealing to the viewer's desire for an efficient, evidence-based solution without fluff.
   - source: @shotbysammy_ · 3.6× · 396791 views
2. **Your ten-step routine is destroying your skin barrier.**
   - band: Strong 6/10 stop
   - mechanism: Pattern Interrupt: it contradicts the cultural assumption that more steps equal better care, creating immediate cognitive dissonance for a viewer holding a bottle of toner.
   - source: @iamjadenly · 5.1× · 91860 views
3. **Dermatologist: Why is my skin breaking out? Me the second I cut my routine to three steps.**
   - band: Mixed 5/10 stop
   - mechanism: Scenario-Hypothetical: it sets up a clear before-and-after contrast between the confusion of over-treatment and the relief of simplification, satisfying the viewer's desire for a quick resolution.
   - source: @cityboy_jj · 123.2× · 34470824 views
4. **If you have redness, don't just add another soothing serum. That traps heat and prolongs inflammation.**
   - band: Mixed 4/10 stop
   - mechanism: Trap-Mistake: it intercepts the viewer's intuitive fix (adding product) and names the specific physiological consequence (trapped heat), preventing a common error before it happens.
   - source: @conor_harris_ · 18.9× · 5269462 views
5. **You mentioned when your skin would sting after cleansing. You'd just want to scrub it harder.**
   - band: Mixed 4/10 stop
   - mechanism: Personal Experience: it mirrors the visceral sensation of a compromised barrier and the counter-productive reaction, building instant identification through shared physical friction.
   - source: @fonzian · 142.4× · 9500000 views


**Corpus rows both grounded arms were shown:** @fonzian _(personal-experience)_, @conor_harris_ _(trap-mistake)_, @footdocdana _(question)_, @cityboy_jj _(scenario-hypothetical)_, @iamjadenly _(contrarian)_, @shotbysammy_ _(tutorial)_

---

## Case 7 — careers

> **Ask:** _why you keep getting rejected after the final interview_

#### ungrounded (no corpus)  (Set B)  ·  50s

1. **I rejected a candidate with perfect LeetCode scores for one specific reason: they treated the final round like an exam, not a sales pitch.**
   - band: Strong 10/10 stop
   - mechanism: This installs a concrete curiosity gap by naming a high-status outcome (perfect scores) and a surprising failure cause, creating a specific question the brain needs to close.
   - source: _no source cited_
2. **I spent three years reviewing final-round debriefs for senior engineering roles, and the number one rejection reason wasn't technical—it was cultural friction.**
   - band: Strong 8/10 stop
   - mechanism: This leverages the stakes of deep institutional knowledge, setting a prediction that a specific, non-obvious finding will be revealed based on credible effort.
   - source: _no source cited_
3. **You didn't lose the job because you lacked skills. You lost it because you stopped selling.**
   - band: Strong 6/10 stop
   - mechanism: This fires cognitive dissonance by contradicting the viewer's assumption that technical competence is the final barrier, forcing them to stay to resolve the contradiction.
   - source: _no source cited_
4. **Stop trying to prove you can do the work. By the final interview, they already know you can. Start proving you're safe to hire.**
   - band: Strong 6/10 stop
   - mechanism: This triggers a prediction error at the concept level by reframing the goal of the final stage from competence demonstration to risk mitigation, which contradicts standard advice.
   - source: _no source cited_
5. **Open on a close-up of a rejected offer letter being shredded, then cut immediately to your face.**
   - band: Strong 6/10 stop
   - mechanism: This uses a visual pattern interrupt to bypass scroll-blindness, creating a jarring sensory mismatch that forces an involuntary orienting response before any words are spoken.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set C)  ·  48s

1. **Hiring manager, can we be honest about the final round?**
   - band: Strong 7/10 stop
   - mechanism: Uses direct address to establish immediate authority and intimacy; the request for honesty signals that previous interactions were filtered, promising unvarnished truth that only an insider can provide.
   - source: @jeremylynch · 18.2× · 18200000 views
2. **You passed the technical. You nailed the culture fit. And they still ghosted you.**
   - band: Strong 6/10 stop
   - mechanism: This fires prediction error by listing every success marker the viewer expects to guarantee an offer, then subverting it with the reality of rejection—creating immediate cognitive dissonance that demands resolution.
   - source: @viralvideo.club · 3.9× · 159015 views
3. **Hey tech switcher, nice to meet you. So, what actually killed your offer?**
   - band: Mixed 4/10 stop
   - mechanism: Combines polite social framing with a blunt, high-stakes question; the contrast between the friendly greeting and the harsh inquiry creates a pattern interrupt that feels personal yet urgent.
   - source: @ethanncprice1 · 120.2× · 928199 views
4. **Stop asking 'Do you have any questions?' in your final interview.**
   - band: Weak 1/10 stop
   - mechanism: A bold, declarative command that interrupts the standard advice loop; it creates stakes by implying a common habit is actively harmful, forcing the viewer to stay to understand the risk.
   - source: @edwin_pouldar · 6.8× · 228600 views
5. **We are rejecting your candidate because their 'soft skills' scored zero.**
   - band: Weak 0/10 stop
   - mechanism: Simulates the internal decision-making moment of a hiring committee; the specificity of 'scored zero' on a vague metric like soft skills creates a concrete mystery about what actually happened in the room.
   - source: @arjunpandeyhere · 19.3× · 61321730 views


#### GROUNDED — structure-only (no source line)  (Set A)  ·  51s

1. **If you’re still getting rejected after the final loop, stop polishing your answers and start auditing your energy.**
   - band: Strong 8/10 stop
   - mechanism: This identifies a specific, painful friction point and offers a non-obvious pivot, creating a curiosity gap about what 'auditing your energy' actually means in a technical context.
   - source: @personalbrandlaunch · 43.8× · 1895571 views
2. **I’m about to read your final rejection email out loud. Let’s see if you can spot the real reason.**
   - band: Strong 6/10 stop
   - mechanism: The high-stakes scenario of exposing private feedback creates immediate tension and a specific curiosity gap about what the 'real reason' actually is.
   - source: @viralvideo.club · 3.9× · 159015 views
3. **Hiring manager, can we be honest? The final interview isn’t about skills. It’s about risk.**
   - band: Strong 6/10 stop
   - mechanism: This uses direct address to establish authority and immediately reframes the entire hiring process, installing a new mental model that the viewer needs to understand.
   - source: @jeremylynch · 18.2× · 18200000 views
4. **You didn't lose the job in the final round. You lost it in the first five minutes.**
   - band: Mixed 3/10 stop
   - mechanism: This fires prediction error by contradicting the viewer's assumption that the final interview is the deciding factor, forcing them to stay to resolve the contradiction.
   - source: @edwin_pouldar · 6.8× · 228600 views
5. **Stop asking 'Do you have any questions?' It’s the single biggest signal you’re not ready for the role.**
   - band: Weak 2/10 stop
   - mechanism: This creates cognitive dissonance by attacking a universally accepted best practice, compelling the viewer to watch to understand why their safe move is actually dangerous.
   - source: @edwin_pouldar · 6.8× · 228600 views


**Corpus rows both grounded arms were shown:** @viralvideo.club _(scenario-hypothetical)_, @ethanncprice1 _(question)_, @jeremylynch _(personal-experience)_, @edwin_pouldar _(authority)_, @arjunpandeyhere _(problem)_, @personalbrandlaunch _(tutorial)_

---

## Case 8 — parenting

> **Ask:** _why your toddler melts down the second you get home from work_

#### ungrounded (no corpus)  (Set A)  ·  46s

1. **I tracked my son’s meltdowns for two weeks. The trigger wasn’t hunger or tiredness. It was this one 90-second window.**
   - band: Strong 8/10 stop
   - mechanism: Installs a curiosity gap by withholding the specific '90-second window' while ruling out common assumptions, compelling the viewer to stay for the reveal.
   - source: _no source cited_
2. **Stop trying to fix the meltdown. Start fixing the transition.**
   - band: Strong 7/10 stop
   - mechanism: Interrupts the default parental instinct to manage the emotion itself, redirecting attention to the structural cause (the transition gap).
   - source: _no source cited_
3. **The calmest kid in daycare turns into a tornado the second you walk through the door. It’s not random — it’s restraint collapse.**
   - band: Strong 6/10 stop
   - mechanism: Names a specific, counter-intuitive psychological mechanism (restraint collapse) that explains the contradiction between school behavior and home behavior.
   - source: _no source cited_
4. **Your toddler spent 8 hours using every ounce of energy to follow rules. You are the safe place where they finally let go.**
   - band: Mixed 5/10 stop
   - mechanism: Validates the parent’s exhaustion and the child’s behavior simultaneously, creating a strong identity signal for working parents who feel blamed for their child’s emotions.
   - source: _no source cited_
5. **They aren’t giving you a hard time. They’re having a hard time holding it together until you got back.**
   - band: Weak 1/10 stop
   - mechanism: Reframes the meltdown from defiance to delayed emotional regulation, firing empathy and relieving parental guilt instantly.
   - source: _no source cited_


#### GROUNDED — verbatim (ships today)  (Set B)  ·  50s

1. **It’s not a bad day. It’s a safe place.**
   - band: Strong 10/10 stop
   - mechanism: Reframes the meltdown from a behavioral failure to an attachment success, creating immediate cognitive dissonance that demands explanation.
   - source: _no source cited_
2. **I spent three years studying toddler stress responses so you don’t have to guess why this happens at 5:30 PM.**
   - band: Strong 10/10 stop
   - mechanism: Establishes high-stakes credibility and a specific time-bound prediction, promising a research-backed answer to a daily friction point.
   - source: _no source cited_
3. **They hold it together all day just to fall apart the second you walk in.**
   - band: Mixed 4/10 stop
   - mechanism: Names the specific emotional pattern (restraint collapse) before offering a fix, validating the parent's confusion and fatigue immediately.
   - source: _no source cited_
4. **The door opens. The screaming starts.**
   - band: Mixed 3/10 stop
   - mechanism: Uses a stark, rhythmic contrast to mirror the sudden shift in energy, firing a pattern interrupt through sensory juxtaposition rather than volume.
   - source: @clickupcomedy · 170× · 29305490 views
5. **Okay if we get home by five it should be smooth sailing but then the shoes come off and...**
   - band: Weak 2/10 stop
   - mechanism: Sets up a logistical expectation and immediately subverts it with a specific, recognizable trigger, installing a curiosity gap about the 'why'.
   - source: @northvalleygrp · 15.5× · 34207944 views


#### GROUNDED — structure-only (no source line)  (Set C)  ·  51s

1. **The meltdown isn’t about your day. It’s about their nervous system finally feeling safe enough to fall apart.**
   - band: Strong 10/10 stop
   - mechanism: This installs a curiosity gap by naming a specific, non-obvious cause (safety) for a negative behavior (meltdown), promising a reframing that relieves parental guilt.
   - source: @northvalleygrp · 15.5× · 34207944 views
2. **I spent three years studying attachment theory so you don’t have to guess why 5:30 PM is chaos.**
   - band: Strong 9/10 stop
   - mechanism: This leverages stakes and authority by signaling deep research effort, creating a prediction that the viewer will get a distilled, expert-backed explanation for a specific pain point.
   - source: @doctormyro · 17.5× · 4393003 views
3. **Why does the toddler hold it together for daycare but lose it the second they see you?**
   - band: Strong 6/10 stop
   - mechanism: This asks a direct, painful question that names the exact friction point (the contrast between public compliance and private collapse), compelling an answer because the viewer feels seen.
   - source: @footdocdana · 46.7× · 37355939 views
4. **You walk in the door and they scream. It’s not because you’re late.**
   - band: Mixed 3/10 stop
   - mechanism: This fires prediction error by contradicting the parent's immediate assumption (guilt about timing) with a counter-intuitive truth, forcing them to stay for the real reason.
   - source: @doctormyro · 17.5× · 4393003 views
5. **POV: You’ve been ‘on’ for 9 hours, you open the front door, and the toddler immediately collapses.**
   - band: Mixed 3/10 stop
   - mechanism: This uses pattern interrupt via a highly specific, relatable scenario-hypothetical that triggers instant self-identification in tired working parents before the first sentence ends.
   - source: @clickupcomedy · 170× · 29305490 views


**Corpus rows both grounded arms were shown:** @clickupcomedy _(scenario-hypothetical)_, @northvalleygrp _(personal-experience)_, @footdocdana _(question)_, @arjunpandeyhere _(problem)_, @detroit75kitchen _(ranking-rating)_, @doctormyro _(secret-reveal-breakdown)_

---
