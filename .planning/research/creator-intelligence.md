<!--
PROVENANCE — Recovered 2026-05-31 by transcript archaeology.
Original authored 2026-05-20; lived at ~/virtuna-engine-foundation/.planning/research/creator-intelligence.md
in the now-deleted `virtuna-engine-foundation` worktree. That file and worktree no longer exist on disk.
This file is re-materialized VERBATIM from the Claude Code transcripts:
  - Synthesis (spine, below):   ~/.claude/projects/-Users-davideloreti/3b521feb-1e96-4415-82f7-16a070fae4e6/subagents/agent-ae7d815da816a58ce.jsonl  (Write tool call, input.content)
  - Jenny Hoyos dossier:        .../subagents/agent-a6fa3bf74b92d8dfa.jsonl
  - Ava Yuergens dossier:       .../subagents/agent-a6dfd06d103406d17.jsonl
  - Alex Hormozi dossier:       .../subagents/agent-a93d5eb7a930b32b3.jsonl
  - Master research session:    ~/.claude/projects/-Users-davideloreti/3b521feb-1e96-4415-82f7-16a070fae4e6.jsonl
Subjects: Ava Yuergens (@personalbrandlaunch / @avayuergens), Jenny Hoyos (@jennyhoyos), Alex Hormozi (@alexhormozi).
The SYNTHESIS spine (Sections: Purpose → Prompt Design Recommendations) is the authoritative 5,195-word original, preserved byte-for-byte.
The PER-CREATOR DOSSIERS appended at the end are the full source extractions, included so this document is self-contained.
NOTE: the synthesis spine preserves the original transcript's "@personalbranchlaunch" spelling; the correct handle is @personalbrandlaunch / @avayuergens.
-->

# Creator Intelligence Reference

## Purpose

This document consolidates publicly stated viral content frameworks, rules, and numerical benchmarks from three elite short-form creators: **Ava Yuergens** (@personalbranchlaunch), **Jenny Hoyos** (@jennyhoyos), and **Alex Hormozi** (@alexhormozi).

It is the source-of-truth knowledge base for V3 (DeepSeek Chat) prompt templates in the Virtuna content-analysis engine. Three downstream prompt types consume it:

1. **Counterfactual suggestions** — "what specific changes would improve this video"
2. **Self-critique** — "flag internal inconsistencies in this prediction"
3. **Platform algorithm-fit** — "how well does this video fit TikTok / IG / YT"

Every specific claim from the three source documents is preserved below. Nothing is summarized away. When V3 prompts cite a rule, they should cite the creator and (where possible) the framework name so suggestions remain grounded in real, attributable creator knowledge.

---

## Hook Formulas

### Ava Yuergens — Three-Hook Stack (first 3 seconds)
Stack three hooks simultaneously in the first three seconds:
1. **Visual hook** — "something to see" (now carries more weight than verbal lines, per her statement)
2. **Text-on-screen hook** — "something to read"
3. **Verbal/audio hook** — "something to hear"

### Ava Yuergens — Seven Named Hook Patterns ("Steal These Viral Hooks", LinkedIn Apr 2024)
1. **Exchange/Comparison Hook:** "For this you can have this" — present trade-offs or value exchanges.
2. **Specificity Hook:** "For this croissant you can have all these raspberries with this much whipped cream" — concrete details and visuals over abstractions.
3. **Cause-and-Effect Hook:** "This is what happens when you [X]" — demonstrate results or consequences.
4. **Environmental/Contextual Hook:** "This is what happens when you play Italian music in a cafe" — setting drives outcome.
5. **Pricing Challenge Hook:** "Can you do X for $20?" — monetary constraint, specific dollar amount.
6. **Regret/Hindsight Hook:** "What I wish I knew at age X instead of Y" (e.g., "I wish I knew about my body at 43 instead of 53").
7. **Quantified Challenge Hook:** "Day one of drinking [specific quantity]" — combines personal challenge with metrics/follower counts.

Underlying mechanic Ava cites: hooks work via **contrast, specificity, curiosity, emotional resonance**.

### Ava Yuergens — Broad → Narrow → Niche Funnel
- **Broad hook** to maximize watch time and distribution.
- **Narrow body** to deliver value for the ideal customer profile.
- **Niche CTA** to convert only qualified viewers.

### Jenny Hoyos — Hook Rules (deep)
- **First frame = visual title.** Must be readable on mute. "A good hook should be so clear that viewers understand the video even on mute."
- **Lead with the most recognizable element, not your face.**
- **Sketch hooks like thumbnails on iPad before filming.**
- **No more than 3 objects in the frame.**
- **First 5 seconds = multiple scene changes**, each serving context, interest, or narrative purpose.
- **Power words:** **banned, free, one dollar, secret, cheap**.
- **She will change the entire video idea** if she can't get a strong hook for it.
- **Hook + foreshadow combined = ≤3 seconds total.**
- **Test multiple hook variants** and measure swipe-away percentage on each.
- **Hook with a question** (TED framework) — "the more surprising or shocking the question, the better."

### Jenny Hoyos — Visual Hook Criteria (4 elements)
1. **Simplicity** — clean, easy to grasp at a glance.
2. **Alignment** — logos and text centered.
3. **Irony / Juxtaposition** — clever or unexpected combinations.
4. **Foreshadowing** — hint at what's coming later.

### Alex Hormozi — Five Awareness-Based Hook Types
1. **Unaware** — curiosity / pattern interrupt.
2. **Problem-Aware** — agitate the pain.
3. **Solution-Aware** — promise/benefit-driven.
4. **Product-Aware** — proof/testimonial-driven.
5. **Most Aware** — offer/urgency-driven.

### Alex Hormozi — Two-Part Hook Structure
**[Call out audience/problem] + [Condition for Value / Promise] = Hook.**
Example: "Gym owners making less than $10K/month — here's the 3-step playbook."

### Alex Hormozi — Lead Magnet Naming Formula (transferable to hooks)
**[Number] + [Adjective] + [Audience] + [Outcome] + [Timeframe]**

### Alex Hormozi — Documented Hook Examples
- "You can beat 99% of people by…"
- "My company sold for $46,200,000."
- "My first business failed."
- "You only need 3 things to win."
- "How I made $100K from one video."
- Curiosity bridge: "I learned this tactic from Eminem that he used in rap but actually makes sales way more effective."
- Contrarian wake-up: "If you have no money, you should have no shame."

### Alex Hormozi — Hook Pattern Taxonomy
- Bold contrarian statement
- Surprising statistic
- Pain-point question
- Personal authority ("How I…", "My…")
- Curiosity bridge (juxtapose unrelated domains)
- Direct call-out of audience identity
- Bold promise (specific outcome + timeframe)

---

## Retention Mechanics

### Jenny Hoyos — Core 5-Part Short Structure
1. **Hook** (visual + verbal, ≤3 seconds)
2. **Foreshadow** (2 lines that hint at the payoff)
3. **Transition that progresses the story** (no "let's get started" — replace with content)
4. **Narrative built on "But / Therefore" (or "But / So")**
5. **Ending / Payoff with a twist**

### Jenny Hoyos — "But / Therefore" Storytelling
- "I went on a walk, **but** it started raining. **Therefore**, I started running back home" — engaging.
- vs. "I went on a walk, **then** it started raining" — boring.
- "When you use 'but' in your story, it stops someone from scrolling. They immediately think 'But what?' and have to keep watching."
- Other transitional words: **"That's when"** (anticipation), **"Instead"** (unexpected turn).

### Jenny Hoyos — TED 60-Second Storytelling Framework
1. **Hook with a question** — surprising/shocking better.
2. **Build progression** — constant movement toward resolving the question.
3. **Add conflict** — "if everything is smooth sailing, then nobody cares."
4. **Create uncertainty** — answer feels uncertain before a satisfying conclusion.
5. **Resolve concisely** — "viewers wanted an answer, so I gave it to them quickly and concisely."

Capstone: *"If it takes longer to tell your story than it does to make a burger, then you're probably overcooking both."*

### Jenny Hoyos — B-Storyline / B-Plot Technique
Parallel subplot creates dual tension: will A-plot resolve AND will B-plot resolve. "You're now not only invested in the competition but also curious to see what's going to happen."

### Jenny Hoyos — Pacing / Peak-End Structure
- **Hook:** fast-paced.
- **Middle:** medium-paced.
- **Peak:** **fast-paced, placed in the MIDDLE of the video.**
- **Resolution:** medium-paced.
- **Ending:** fast-paced.
- "People only remember their favorite part of a movie and the ending."
- "The viewer will decide how they felt about the video based on the intensity of the emotion at the end."

### Jenny Hoyos — Mechanism Concept
A "mechanism" = structural device pushing viewers to watch until the end. Examples: "3 steps / 3 things" format, MrBeast's closing red countdown circle, constant visual progress toward the promised outcome.

### Alex Hormozi — Hook → Retain → Reward
- **Hook:** stop the scroll in first few seconds.
- **Retain:** maintain engagement via story, open loops, pacing.
- **Reward:** deliver more value than expected — "give 10x more value than your audience expects."

### Alex Hormozi — Retention Tactics
- **Open loops / tease-then-payoff.**
- **Cut every 3–4 seconds.**
- **Text overlays on key phrases** (bold, color highlights, emojis).
- **Sound design:** "whoosh," "pop," "click" as retention micro-hooks.
- **No filler intros** — eliminate "hey guys, today we're going to…" entirely.
- **One key takeaway per video** (especially short-form).
- **Punchy short sentences,** no qualifiers, no hedging.
- **Pattern interrupt** every few seconds.

### Alex Hormozi — Proof → Promise → Plan (intro framework)
- **Proof:** prove credibility; give people a reason to believe you.
- **Promise:** tell them what they'll learn / get.
- **Plan:** set expectations for what happens next.

### Alex Hormozi — Value Equation (applied to hooks)
Increase the top two, decrease the bottom two:
- **Dream Outcome** (↑)
- **Perceived Likelihood of Achievement** (↑)
- **Time Delay** (↓)
- **Effort & Sacrifice** (↓)

---

## Platform Algorithm Insights

### Ava Yuergens — Platform Rules
- **Instagram preferred** for follower loyalty.
- **YouTube Shorts can harm long-form channel health** if Shorts attract a misaligned audience to a long-form channel (cautionary anti-pattern).
- **Format constraint:** 60 seconds or less, **9:16 vertical ratio**.
- **Posting cadence (tiered DFY packages):** 15, 20, or 30 short-form videos per month + 7, 10, or 15 sales-focused Stories per month.
- **Stories as "daily cash register"** — daily before/after images + links generate ~500 clicks/day.
- **Real-life cadence:** once a quarter ship a tasteful real-life reaction with fast turn and honest caption.

### Jenny Hoyos — Platform-Specific Rules
- **YouTube Shorts:** favors longer (>20s, ideal ~34s), slower pace, story-driven, more mature audience.
- **TikTok:** "did not like videos over 30 seconds;" shorter (10–20s), information-dense, fewer jokes, scroll-optimized.
- **Instagram Reels:** assume muted viewing; heavy visual storytelling, subtitles every second, prioritize shareability.

### Jenny Hoyos — Analytics / Measurement
- **Three viewer-satisfaction metrics:** retention, rewatchability, subscribability.
- **Retention graphs are the key analytic** for finding 1-second dead spots to trim.
- **48-hour window:** look for "videos that are a bit old but performing in the last 48 hours" — signal of late-bloomer viral lift.
- **Hypothesis:** shareability matters more than retention for true virality.

### Jenny Hoyos — Posting Cadence
- ~10 videos/month produced; 1 upload/week, **Saturdays 10:00 AM EST**.

### Alex Hormozi — Five Phases of Content Marketing
- **Phase 1:** Make something & post it.
- **Phase 2:** Post consistently (minimum 1x/week, batch one day/week).
- **Phase 3:** Post reliably on ALL platforms (6+ months minimum).
- **Phase 4:** Maximize output — short-form: **5–10/day**; long-form: **1–2/day**.
- **Phase 5:** "Quality + quantity wins every time." Include CTA in every piece.

### Alex Hormozi — Audio-Off Rule
- **50% of TikTok/Instagram viewers watch with audio off** → always burn-in text overlays.

### Alex Hormozi — Distribution Rules
- **Twitter is the R&D lab:** post raw tweets, identify winners, convert top-performers into short-form video scripts.
- **Repurposing tree:** one long-form → podcast → 2,000-word blog → 5–10 social clips → 5-part email sequence → LinkedIn carousel.
- **Repost winners** with different framing/imagery rather than constantly creating net-new.
- **"Give first… to lots of people for free… without asking for anything."**
- **Daily Twitter mix:** 1–3 attention tweets + 1 nurture-lead tweet + 1 story tweet.

---

## Content Structure Systems

### Ava Yuergens — Impact Priority Order
**Hook → Script → Format → Editing.** Allocate creative effort in this exact order. Hook dominates; editing is least important.

### Ava Yuergens — Script Document Structure
Each script includes:
- (a) format / filming notes
- (b) bulleted line-by-line delivery script
- (c) caption text
- (d) subtitles

### Ava Yuergens — Production Workflow
- **Day 1–2 (Research):** Instagram Explore → pull 100+ Reels with >1M views in niche; log hook, view count, topic, format; apply 5x Rule.
- **Day 3 (Scripts):** Write 15–30 scripts reusing proven hooks, injecting the client's domain expertise.
- **Day 4 (Film):** Film 5 talking-head versions first, then 5 in a second format (B-roll voiceover, walk-and-talk).
- **Edit & Upload:** Agency edits; uploads IG / TikTok / Shorts / Facebook / LinkedIn.
- **Repurpose principle:** "Viral hooks + your niche expertise."

### Ava Yuergens — The 5x Rule (outlier identification)
"An outlier video is one that gets at least 5 times more views than an account's total follower count." Filters out vanity reach.

### Jenny Hoyos — Scripting Workflow
1. Write the **hook first** (very short).
2. Write the **last line** using template: "Then I [action] and [blank for reaction]."
3. Write the **foreshadow** (2 lines bridging hook to ending).
4. Either a **full rough script** OR a **bullet-point outline**.
5. **Film chronologically** for clear journey / character development.
6. **Editing decisions are best made by a storyteller, not just a video editor.**

### Jenny Hoyos — Content Buckets System
"Buckets are repeatable formats. For example, my series could be '$1 fast food items.'" 2–4 buckets reasonable for weekly uploaders. **Metadata must be consistent across bucket videos** so the algorithm links them.

### Jenny Hoyos — Blue Ocean Strategy
Avoid saturated niches. Find underserved markets. "Nobody's doing it for kids" — shifted to finance content for children.

### Jenny Hoyos — Idea Funnel
**1,000 → 100 → 25 → 10.** Idea bank 1,000+ concepts.

### Jenny Hoyos — Idea Selection (6-question filter)
1. Do I want to make it?
2. Logistically possible?
3. Strong hook?
4. Good mechanism?
5. Rewatch value?
6. Virality potential?

### Alex Hormozi — 5-Step Short-Form Script
1. **Hook / question**
2. **Hammer / humor** (intensifier)
3. **Read the tweet** (the core thesis)
4. **Example** (specific, concrete, often personal)
5. **Explanation** (why it works / the principle)

### Alex Hormozi — Long-Form Structure
**Proof → Promise → Plan → Body (lists/steps) → CTA.**

### Alex Hormozi — Hormozi Ad Assembly (same logic for organic creative)
- 6 angles × 5 hooks = 30 ads → film 2 versions = **60 total**.
- **70/20/10 allocation:**
  - **70%** = slight variations of top 2 performers.
  - **20%** = significant variations of winners.
  - **10%** = entirely new angle tests.

### Alex Hormozi — Six Content Lessons ("7.8M followers in 40 months")
1. Edutainment → **Education** (converts better for B2B).
2. "For Us" → **"For You"** (clear thumbnails, Proof-Promise-Plan intros, lists/steps).
3. Wide → **Narrow** (one topical lane).
4. Views → **Revenue** (track RPM, not raw views).
5. Shorts → **Longs** (long-form converts; shorts retain short viewers).
6. "Assume More" → **"Assume Nothing"** (re-introduce yourself, repost winners).

---

## Virality Triggers

### Jenny Hoyos — Four Criteria for Viral Content
1. **Novelty**
2. **Uncertainty**
3. **Knowledge Gaps**
4. **Complexity**

### Jenny Hoyos — Shareability Hypothesis
Shareability matters more than retention for true virality. One video example: **20% shares-to-view ratio + 92% growth rate**.

### Jenny Hoyos — Specificity Beats General
"Specific beats general every time." Garden series: engagement dropped showing the entire garden; **skyrocketed when focused on three specific elements.**

### Ava Yuergens — Stated Mechanism Loop
"Outlier research → precise hooks and scripts → simple formats → a friction-free CTA that lands on proof."

### Alex Hormozi — Rule of 100
"100 primary actions every day, for 100 days in a row."

### Alex Hormozi — Meta Rules
- "An ounce of pre-work is worth a pound of post."
- "Quality + quantity wins every time."
- "Give away the secrets, sell the implementation."
- Core question: "With the resources I have, how can I maximize the RIGHT people finding out about my stuff?"

### Alex Hormozi — Value-to-Ask Ratio
- Short-form: **98% value : 2% ask**.
- Long-form: **3:1**.

---

## Anti-Patterns

### Ava Yuergens
- Don't let AI write final scripts (research-only).
- Don't cross-post Shorts to a long-form YouTube channel if audiences are misaligned.
- Don't pad with editing flourishes — Hook > Script > Format > Editing.
- Don't write above **5th-grade reading level**.

### Jenny Hoyos
- Don't talk fast — talk MORE CONCISE. Cut filler.
- Don't pack multiple messages into one Short — kills virality.
- Don't general-target — "specific beats general every time."
- Don't show your face first if a logo/object is more universally recognizable.
- Don't use pace-breaking transitions ("now we're going to," "let's start by").
- Don't crowd the frame — **max 3 objects**.
- Don't obsess over retention alone — satisfaction matters more.
- Don't write above 5th-grade level.

### Alex Hormozi
- Don't preach — share "this is what I did," not "this is what you should do."
- No exaggerated claims that break credibility.
- No filler / no fluff — eliminate intros, throat-clearing.
- No inside jokes — assume audience is brand new.
- Don't optimize for views — optimize for RPM / revenue / right-audience reach.
- Don't dilute the niche — wide → narrow.
- Don't try to be both edutainment AND education — pick one.
- Don't lean on production value — structure beats lighting/gear.

---

## Numerical Rules

| # | Rule | Source |
|---|------|--------|
| 1 | **Outlier = ≥5× follower count in views** | Ava (5x Rule) |
| 2 | **Hook stack = 3 hooks in first 3 seconds** (see / read / hear) | Ava |
| 3 | **5th-grade reading level** for scripts | Ava + Jenny |
| 4 | **MrBeast readability = 1st-grade level** | Jenny |
| 5 | **Optimal Short length = 34 seconds** | Jenny |
| 6 | **Shorts under 30s require ~100% retention to go viral** | Jenny |
| 7 | **Retention benchmark for virality = 90%+** (Jenny's avg = 95%+) | Jenny |
| 8 | **Scroll-through rate target = 70%+** (Jenny's avg = 85%) | Jenny |
| 9 | **Hook duration ≤3 seconds** (ideally first second; Hormozi: ≤2s) | Jenny + Hormozi |
| 10 | **Hook + foreshadow combined = ≤3 seconds total** | Jenny |
| 11 | **First 5 seconds = multiple scene changes** | Jenny |
| 12 | **Maximum 3 objects in frame** | Jenny |
| 13 | **Power words: banned, free, one dollar, secret, cheap** | Jenny |
| 14 | **Idea funnel: 1,000 → 100 → 25 → 10** | Jenny |
| 15 | **Cadence: 1 upload/week, Saturdays 10:00 AM EST** | Jenny |
| 16 | **Hooks = ~80% of an ad's performance** | Hormozi |
| 17 | **5× more people read headline than body** | Hormozi |
| 18 | **Attention window = 3 seconds (ads), first 2 seconds (short-form)** | Hormozi |
| 19 | **50% of TikTok/IG viewers watch with audio off** → burn-in text | Hormozi |
| 20 | **Clean cuts every 3–4 seconds** | Hormozi |
| 21 | **30-second short format target** | Hormozi |
| 22 | **"No such thing as too long, only too boring"** | Hormozi |
| 23 | **Value:Ask ratio — short-form 98:2, long-form 3:1** | Hormozi |
| 24 | **Posting cadence — short-form 5–10/day; long-form 1–2/day; min 1/week** | Hormozi |
| 25 | **Time horizon: 18 months minimum to build momentum** | Hormozi |
| 26 | **Cross-platform reliability: 6+ months minimum** | Hormozi |
| 27 | **Ad math: 6 angles × 5 hooks × 2 versions = 60 ads** | Hormozi |
| 28 | **70/20/10 creative allocation** (variations / significant variants / new angles) | Hormozi |
| 29 | **Daily Twitter mix: 1–3 attention + 1 nurture + 1 story** | Hormozi |
| 30 | **Rule of 100: 100 primary actions/day for 100 days** | Hormozi |
| 31 | **Ava DFY tiers: 15 / 20 / 30 videos per month + 7 / 10 / 15 stories** | Ava |
| 32 | **Hook trim example: -1s dead time → retention 83% → 88%** | Jenny |
| 33 | **One viral video case: 7.9M views → 13,000 leads → ~$2M annualized** | Ava |
| 34 | **$1 Fast Food series ≈ 12M views/video; Kitchen Fundraising ≈ 15M/video; Burger comparison Short = 45M views** | Jenny |
| 35 | **Shareability example: 20% shares-to-view ratio + 92% growth** | Jenny |
| 36 | **Acquisition.com content budget ≈ $70k/month; 35,000 pieces in 40 months → 7.8M followers** | Hormozi |
| 37 | **Format constraint: 60s or less, 9:16 vertical** | Ava |
| 38 | **Ava Stories generate ~500 daily clicks** | Ava |
| 39 | **Ava research labor: 10–12 hours per client per month; 20 min/day personal scroll** | Ava |
| 40 | **Jenny avg views per Short = 10M; 600M+ views in 1 year** | Jenny |

---

## Cross-Creator Consensus

These rules appear (in some form) across ALL THREE creators. Treat as highest-confidence signals for V3 prompts.

### 1. The Hook Decides Everything
- Ava: "Hook → Script → Format → Editing" priority order.
- Jenny: "The first three seconds determine if you'll get three million views or three thousand."
- Hormozi: "Hooks = ~80% of an ad's performance."
- **Consensus:** First 2–3 seconds is where 80%+ of performance is decided.

### 2. Three-Second Window is Sacred
- Ava: 3-hook stack in first 3 seconds.
- Jenny: Hook ≤3 seconds, ideally first second.
- Hormozi: 2–3 second attention window; ad hook ≤2s.

### 3. Specificity > Generality
- Ava: Specificity Hook = concrete details over abstractions.
- Jenny: "Specific beats general every time."
- Hormozi: Lead Magnet Formula demands [Number] + [Audience] + [Outcome] + [Timeframe].

### 4. Numbers and Concrete Outcomes in Hooks
- Ava: "Can you do X for $20?", "Day one of drinking [quantity]."
- Jenny: "$1 fast food items," "45M views."
- Hormozi: "My company sold for $46,200,000," "How I made $100K from one video."

### 5. Assume Audio-Off / Visual-First Delivery
- Ava: Three-hook stack includes "something to see" + "something to read" alongside audio.
- Jenny: "A good hook should be so clear that viewers understand the video even on mute."
- Hormozi: "50% of TikTok/IG viewers watch with audio off" → always burn-in text overlays.

### 6. Low Reading Level
- Ava: 5th grade target (uses Hemingway).
- Jenny: 5th grade or below; MrBeast benchmark = 1st grade.
- Hormozi: Punchy short sentences, no qualifiers, no hedging.

### 7. Cut the Filler / Pace-Break Intros
- Ava: Editing is least important — don't pad with flourishes.
- Jenny: No "let's get started," "now we're going to," "let's start by."
- Hormozi: Eliminate "hey guys, today we're going to…" entirely.

### 8. Niche / Narrow Targeting Wins Conversion
- Ava: Broad hook → narrow body → niche CTA.
- Jenny: Blue Ocean — find underserved sub-niches.
- Hormozi: "Wide → Narrow" — one topical lane.

### 9. Repurpose Winners Rather Than Always Going Net-New
- Ava: Reuse proven outlier hooks, swap in client expertise.
- Jenny: 2–4 content buckets with consistent metadata.
- Hormozi: 70% of creative = slight variations of top 2; repost winners with different framing.

### 10. Volume Discipline
- Ava: 15–30 short-form videos/month per client.
- Jenny: ~10 videos/month, 1 upload/week.
- Hormozi: Short-form 5–10/day; minimum 1/week.
- **Consensus:** Sustained cadence at a defensible volume; never zero, never spam.

### 11. CTA / Conversion Architecture Must Be Built In
- Ava: Niche CTA at end + Stories as daily cash register.
- Jenny: Mechanism keeps viewers to the end; ending is where emotion is decided.
- Hormozi: Include a CTA in every piece (Phase 5).

---

## Conflicts / Disagreements

Where the three creators contradict each other. V3 prompts should treat these as **platform-dependent** or **goal-dependent** decisions, not universals.

### 1. Optimal Short Length
- **Jenny:** **34 seconds optimal**; Shorts <30s require near-100% retention.
- **Hormozi:** **30-second target**, BUT also "no such thing as too long, only too boring" (length is unconstrained if it stays engaging).
- **Ava:** **60 seconds or less** (uses full minute as ceiling).
- **Resolution rule for V3:** Use platform-specific target — YT Shorts ≈ 34s, TikTok 10–20s (per Jenny), IG Reels up to 60s (per Ava). Hormozi's "no such thing as too long" applies primarily to long-form.

### 2. Posting Cadence
- **Hormozi:** Maximize output — **5–10 short-form per day**.
- **Jenny:** **1 upload/week** (Saturdays 10am EST), ~10/month.
- **Ava:** **15–30/month per client** (≈ 0.5–1/day).
- **Resolution rule for V3:** Hormozi's volume is a B2B education play; Jenny's restraint is an entertainment / virality optimization. Match the creator's monetization model to the cadence recommendation.

### 3. Retention vs Shareability as North Star
- **Jenny:** Retention is primary in production; but **hypothesizes shareability matters more for virality** (20% share-rate observation).
- **Hormozi:** Optimize for **RPM / revenue**, NOT views.
- **Ava:** Optimize for **conversions** (leads → clients), measured at the CTA layer.
- **Resolution rule for V3:** "Right metric" depends on stage — pure-reach phase uses retention; growth phase uses share rate; monetization phase uses RPM / lead conversion.

### 4. Edutainment vs Education
- **Hormozi explicitly:** Pick ONE — don't try to be both.
- **Jenny:** Inherently edutainment (kids' finance, $1 fast food entertainment).
- **Ava:** Implicitly education-leaning (B2B founders, niche expertise).
- **Resolution rule for V3:** Surface this as a deliberate choice when video appears to straddle both — flag as a strategic inconsistency.

### 5. Face-First vs Object-First
- **Jenny:** **Don't show your face first** if a logo / object is more universally recognizable.
- **Ava:** Talking-head is one of the two primary filming formats; she films **5 talking-head versions first**.
- **Resolution rule for V3:** Object-first wins for entertainment / discovery content (Jenny's domain). Face-first wins for personal-brand / expert-positioning content (Ava's domain).

### 6. AI in the Pipeline
- **Ava:** **Do NOT let AI write your final scripts.** Research only.
- **Hormozi:** Not explicitly stated, but uses systematic ad assembly (60-ad batches) that implies tooling tolerance.
- **Jenny:** Not addressed.
- **Resolution rule for V3:** When the engine generates script counterfactuals, frame as "directional suggestions for a human writer to refine," not as drop-in copy.

---

## Prompt Design Recommendations

How to encode this knowledge into V3 DeepSeek Chat system prompts for the three downstream tasks.

### General Encoding Principles

1. **Cite the creator** when applying a rule. E.g., *"Per Jenny Hoyos, hooks ≤3 seconds; this hook runs 4.8s."* This makes outputs auditable and reduces hallucinated authority.
2. **Use the numerical table (40 rules above) as a checklist** the model can scan against the input video's parsed structure.
3. **Distinguish consensus rules (high confidence) from disagreements (platform/goal-dependent).** Always treat the 11 consensus items as defaults.
4. **Anchor every suggestion to a named framework** (e.g., "But/Therefore," "Hook → Retain → Reward," "Three-Hook Stack") so suggestions remain specific, not generic.
5. **Never output generic feedback** like "improve your hook." Output rule-grounded feedback: *"Your hook violates Hormozi's 2-second attention window — current verbal hook ends at 3.8s."*

### (a) Counterfactual Suggestion Prompts

**System prompt scaffolding:**

> You are a content optimization expert trained on the explicit teachings of Ava Yuergens, Jenny Hoyos, and Alex Hormozi. For each video segment you analyze, produce counterfactual suggestions of the form: **"Change X to Y because [named framework / numerical rule]."**

**Required behaviors:**
- For the **hook segment (0–3s)**, run all three hook frameworks in parallel:
  - Does it satisfy Ava's three-hook stack (visual + text + audio)?
  - Does it match one of Ava's 7 named patterns OR Hormozi's 5 awareness types?
  - Does it pass Jenny's visual-hook 4-criteria (simplicity / alignment / irony / foreshadow)?
  - Does it fit Hormozi's two-part structure (call-out + promise)?
- For the **body**, evaluate against Jenny's 5-part structure AND Hormozi's 5-step script.
- For the **ending**, evaluate against Jenny's fast-paced ending + payoff-with-twist rule.
- Output counterfactuals in this format:
  ```
  ISSUE: [specific problem with timestamp]
  RULE: [named framework / numerical rule + creator attribution]
  COUNTERFACTUAL: [specific change to make]
  EXPECTED EFFECT: [predicted retention/share lift]
  ```
- **Cap suggestions at 5 per video** — match Hormozi's "one key takeaway" principle for the engine's own output.
- Use the **Lead Magnet Formula** ([Number] + [Adjective] + [Audience] + [Outcome] + [Timeframe]) as a hook-rewrite template when the input hook is vague.
- When proposing script rewrites, **flag them as directional, not drop-in** (per Ava's anti-AI-script rule).

### (b) Self-Critique Prompts

**System prompt scaffolding:**

> Before finalizing your prediction, audit it against the Creator Intelligence Reference. Flag any internal inconsistencies, contradictions with consensus rules, or violations of the numerical benchmarks.

**Required self-critique checks:**
1. **Consistency-with-consensus check.** Does your prediction contradict any of the 11 Cross-Creator Consensus items? If so, you need stronger evidence than a single-creator contradiction.
2. **Conflict-awareness check.** If your suggestion sits on one side of a Conflicts/Disagreements axis (e.g., recommending 60s when target platform is TikTok), explicitly justify the platform/goal context.
3. **Numerical-claim audit.** For every numerical claim in your output, verify it traces to a row in the Numerical Rules table. If it does not, downgrade confidence or remove the claim.
4. **Creator-attribution audit.** Every cited "rule" must name the creator. Anonymous "best practices" are not allowed.
5. **Hook-vs-body proportionality.** Per Hormozi (hooks = 80% of performance), at least 50% of your critique should target the first 3 seconds. If your critique is body-heavy, re-weight it.
6. **Anti-pattern scan.** Run the input through the union of all 19 anti-patterns. Any unflagged anti-pattern in the input = a miss; flag it.
7. **Reading-level check.** If your suggested rewrite exceeds 5th-grade reading level, regenerate.
8. **Specificity check.** Per "specific beats general every time" — if any suggestion contains a hedging word (maybe / could / try / consider), rewrite it imperative + concrete.

Output a `self_critique` JSON block with `{passed: bool, issues: [], adjustments_made: []}` before the final answer.

### (c) Platform Algorithm-Fit Scoring Prompts

**System prompt scaffolding:**

> Score the input video's fit to each platform (TikTok / Instagram Reels / YouTube Shorts) on a 0–100 scale, using the platform-specific rules below. Return a per-platform breakdown with rule-by-rule scores.

**Platform-specific rubrics (encode directly):**

**TikTok rubric (Jenny + Hormozi rules):**
- Length 10–20s? (Jenny: TikTok dislikes >30s.) [weight: 20]
- Information density high? (Jenny: TikTok prefers info-dense over jokes.) [weight: 15]
- Hook ≤2s? (Hormozi.) [weight: 25]
- Burned-in text overlays for 50% audio-off viewers? (Hormozi.) [weight: 15]
- Cuts every 3–4s? (Hormozi.) [weight: 10]
- One key takeaway only? (Hormozi.) [weight: 15]

**Instagram Reels rubric (Ava + Jenny rules):**
- 9:16 vertical, ≤60s? (Ava.) [weight: 10]
- Visually storyable on mute? (Jenny.) [weight: 25]
- Subtitles present every second? (Jenny.) [weight: 15]
- Three-hook stack present? (Ava.) [weight: 20]
- Shareable / has a "tag a friend" moment? (Jenny shareability hypothesis.) [weight: 20]
- Cross-posted from a long-form YT channel? → flag as risk (Ava cautionary anti-pattern). [weight: 10]

**YouTube Shorts rubric (Jenny + Hormozi rules):**
- Length ~34s ideal? Sub-30s = needs ~100% retention warning. [weight: 25]
- Story-driven (But/Therefore present)? (Jenny.) [weight: 20]
- Peak placed in middle? (Jenny pacing.) [weight: 15]
- Fast-paced ending? (Jenny.) [weight: 10]
- Foreshadow within first 3s? (Jenny.) [weight: 15]
- Mechanism (3-things / countdown / progress device) present? (Jenny.) [weight: 15]

**Output format:**
```json
{
  "tiktok": {"score": 0-100, "rule_scores": {...}, "top_3_blockers": [...]},
  "reels":  {"score": 0-100, "rule_scores": {...}, "top_3_blockers": [...]},
  "shorts": {"score": 0-100, "rule_scores": {...}, "top_3_blockers": [...]},
  "recommended_primary_platform": "...",
  "rationale": "..."
}
```

**Critical platform-fit guardrails:**
- Never average platforms into a single score — viewers behave differently per platform.
- The "recommended_primary_platform" choice must cite which creator's platform rule drove it.
- If the input video has a face-first hook AND no recognizable object, downgrade Shorts score (Jenny's recognizable-element rule).
- If the input is edutainment-styled but targets B2B education, flag the Hormozi edutainment-vs-education conflict.

### Final Implementation Notes

- Load this document as a **system-prompt context block** (or RAG-retrieved chunk) for every V3 inference. Frameworks are short enough to fit in-context without retrieval.
- Version the document. When new creator claims are added (e.g., MrBeast, Colin & Samir), preserve the same structure: Frameworks → Numerical → Anti-Patterns → Consensus → Conflicts.
- The **Numerical Rules table is the primary checklist asset** — every prompt should reference it explicitly.
- The **Conflicts / Disagreements section is the primary disambiguation asset** — every prompt should resolve conflicts using platform + goal context, never by averaging.

---

# Per-Creator Dossiers (full source extractions)

_Appended for self-containment. These are the verbatim research outputs from the three per-creator research agents that fed the synthesis above. The synthesis spine is the operative reference; these dossiers are the underlying evidence with sources._

## Dossier: Jenny Hoyos (@jennyhoyos)

### Jenny Hoyos: Viral Short-Form Content System — Full Public Extraction

**Subject:** Jenny Hoyos (@jennyhoyos) — YouTube Shorts creator, ~9M+ subscribers (as of 2025 references), ~10M average views per Short, ~600M+ views in a year, TEDNext 2024 speaker. Compiled exclusively from her stated frameworks across interviews, podcasts, TED talk, course pages, and articles citing her.

---

#### 1. NAMED FRAMEWORKS / SIGNATURE SYSTEMS

##### 1.1 The Core 4/5-Part Short Structure
Jenny's repeating skeleton for every Short:
1. **Hook** (visual + verbal, ≤3 seconds)
2. **Foreshadow** (2 lines that hint at the payoff)
3. **Transition that progresses the story** (no "let's get started" — replace with content)
4. **Narrative built on "But / Therefore" (or "But / So")**
5. **Ending / Payoff with a twist**

Category: content structure. Sources: [Creator Science podcast notes](https://podcast.creatorscience.com/jenny-hoyos/), [Jay Clouse LinkedIn](https://www.linkedin.com/posts/jayclouse_jenny-hoyos-gave-me-her-exact-script-that-activity-7262878750684459010-NIZu), [Marketing Examined Playbook](https://www.marketingexamined.com/blog/jenny-hoyos-short-form-video-playbook).

##### 1.2 "But / Therefore" (and "But / So") Storytelling
**Exact quote, paraphrased across sources:** "I went on a walk, but it started raining. Therefore, I started running back home" — engaging — vs. "I went on a walk, then it started raining" — boring. She also says: *"When you use 'but' in your story, it stops someone from scrolling. They immediately think 'But what?' and have to keep watching."* Other transitional words she names: **"That's when"** (builds anticipation), **"Instead"** (unexpected turn).
Category: retention / narrative mechanics.

##### 1.3 The TED 60-Second Storytelling Framework
From her TEDNext 2024 talk "The secret to telling a great story — in less than 60 seconds":
1. **Hook with a question** — "begin with a question that makes people stick around for the answer. The more surprising or shocking the question, the better."
2. **Build progression** — "a sense of constant progression—showing movement toward resolving the initial question."
3. **Add conflict** — *"if everything is smooth sailing, then nobody cares."*
4. **Create uncertainty** — make "the answer feel uncertain before providing a satisfying conclusion."
5. **Resolve concisely** — *"The viewers wanted an answer, so I gave it to them quickly and concisely, in an engaging way."*

Capstone line: *"If it takes longer to tell your story than it does to make a burger, then you're probably overcooking both."*
Category: hook formula + content structure. Source: [TED](https://www.ted.com/talks/jenny_hoyos_the_secret_to_telling_a_great_story_in_less_than_60_seconds), [ContentGrip recap](https://www.contentgrip.com/how-to-tell-a-great-story-in-60-seconds/).

##### 1.4 B-Storyline / B-Plot Technique
She introduces a parallel subplot (in TED demo: her mom's reactions while she cooks a burger) to create **dual tension**: will the A-plot resolve AND will the B-plot resolve. *"You're now not only invested in the competition but also curious to see what's going to happen between my mom and I."*
Category: retention. Source: [Heather Parady podcast](https://www.heatherparady.com/blog/120), TED talk.

##### 1.5 Four Criteria for Viral Content
**Novelty, Uncertainty, Knowledge Gaps, Complexity** — named as the essential elements for virality.
Category: virality trigger. Source: [PodPulse — My First Million notes](https://podpulse.ai/podcast-notes-and-takeaways/my-first-million-the-formula-to-break-100-million-views-on-shorts-ft-jenny-hoyos).

##### 1.6 Visual Hook Criteria (4 elements)
1. **Simplicity** — clean, easy to grasp at a glance; avoid clutter
2. **Alignment** — logos and text centered; intentional placement
3. **Irony / Juxtaposition** — clever or unexpected combinations (fast food item in front of restaurant location)
4. **Foreshadowing** — hint at what's coming later

Category: hook formula. Source: [FinalLayer](https://finallayer.com/blog/jenny-hoyos-the-18-year-old-phenomenon-who-achieved-viral-success).

##### 1.7 Content Buckets System
*"Buckets are repeatable formats. For example, my series could be '$1 fast food items.'"* Two to four buckets is reasonable for weekly uploaders. Metadata (keywords, descriptions, tags) must be consistent across bucket videos so the algorithm links them.
Category: algorithm insight + content structure. Source: [Marketing Examined](https://www.marketingexamined.com/blog/jenny-hoyos-short-form-video-playbook), [vidIQ](https://vidiq.com/blog/post/how-jenny-hoyos-gets-10m-views-per-youtube-short/).

##### 1.8 Blue Ocean Strategy
Avoid red oceans (saturated niches). Find blue oceans (underserved markets). Her example: she stopped competing with Graham Stephan and shifted to "**finance content tailored for kids**" because "nobody's doing it for kids."
Category: content structure / positioning. Source: [vidIQ](https://vidiq.com/blog/post/how-jenny-hoyos-gets-10m-views-per-youtube-short/), [HookSounds](https://www.hooksounds.com/blog/jenny-hoyos-tips-and-tricks-from-a-viral-superstar/).

##### 1.9 Pacing / Peak-End Structure (5-phase)
- Hook: **fast-paced**
- Middle: medium-paced
- Peak: **fast-paced, memorable, placed in the MIDDLE of the video**
- Resolution: medium-paced
- Ending: **fast-paced**

Her principle: *"People only remember their favorite part of a movie and the ending"* (peak-end reasoning, though she calls it variously). Also: *"The viewer will decide how they felt about the video based on the intensity of the emotion at the end."*
Category: retention. Source: [vidIQ](https://vidiq.com/blog/post/how-jenny-hoyos-gets-10m-views-per-youtube-short/), [Marketing Examined](https://www.marketingexamined.com/blog/jenny-hoyos-short-form-video-playbook).

##### 1.10 Mechanism Concept
A "mechanism" = a structural device that **pushes viewers to watch until the end**. Examples she names: **"3 steps / 3 things" format**, **MrBeast's closing red countdown circle**, and **constant visual progress toward the promised outcome**.
Category: retention / content structure. Source: [Creator Science](https://podcast.creatorscience.com/jenny-hoyos/).

---

#### 2. NUMERICAL CLAIMS (verbatim where possible)

| Metric | Claim | Source |
|---|---|---|
| Optimal Short length | **34 seconds** | Multiple |
| Sub-30s threshold | Shorts under 30s "require ~100% retention to go viral" — why she extended past 30s | Jay Clouse, vidIQ |
| Retention benchmark | **90%+** for viral potential | Multiple |
| Her own avg retention | **95%+** | Marketing Examined |
| Scroll-through rate target | **70%+** average | Multiple |
| Her own scroll-through rate | **85% avg** | Marketing Examined |
| Hook duration | **≤3 seconds**, ideally first second | Multiple |
| Readability target | **5th grade or below** | Multiple |
| MrBeast readability benchmark | **1st grade level** | Marketing Examined |
| Idea bank size | **1,000+ concepts** | Creator Science |
| Idea funnel | **1,000 → 100 → 25 → 10** | Creator Science |
| Output cadence | ~10 videos/month produced; 1 upload/week, **Saturdays 10:00 AM EST** | Marketing Examined |
| Avg views per Short | **10 million** | Multiple |
| Annual views | **600M+ in 1 year** at 18; later **billions** lifetime | Multiple |
| Ad revenue | ~**$5,000–$10,000/month** from ad revenue alone on 50–100M monthly views; she also cites "**~$100 per millions-of-views Short**" in older numbers | vidIQ, Marketing Examined |
| Sponsored Short ceiling | Cites creators making "**$1 million per sponsored Short**" | Marketing Examined |
| First 1,000 followers → next 1,000 | "First 1,000: $50 earnings. Next 1,000: $10,000 earnings" — quality > quantity | 10xquality Medium |
| Garden series finding | Engagement dropped when showing entire garden; **skyrocketed when focusing on three elements** | Marketing Examined |
| $1 Fast Food series | Averages **12M views/video** | Marketing Examined |
| Kitchen Fundraising series | Averaged **15M views/video** | Marketing Examined |
| McDonald's recreation Short | **30M views** | Marketing Examined |
| Burger comparison Short | **45M views** (cited in TED) | ContentGrip |
| Hook trim example | Cut **1 second** of dead time → retention **83% → 88%** | Creator Science |

---

#### 3. HOOK FORMULA (deep)

- **First frame = visual title.** Must be readable on mute. *"A good hook should be so clear that viewers understand the video even on mute."*
- **Lead with the most recognizable element, not your face.** Example: a Chick-fil-A logo or storefront, not her face, because "more people know the fast food location than they know me."
- **Sketch hooks like thumbnails** on iPad before filming.
- **No more than 3 objects in the frame.** Center logos and text.
- **First 5 seconds = multiple scene changes**, each serving context, interest, or narrative purpose.
- **Power words** (the canonical list she repeats): **banned, free, one dollar, secret, cheap**.
- **She will change the entire video idea** if she can't get a strong hook for it.
- **Hook + foreshadow combined = ≤3 seconds total.**
- **Test multiple hook variants** and measure swipe-away percentage on each.

Example hook scripts she has shared:
- *"$1 chicken sandwich"* (with sandwich held next to Chick-fil-A sign)
- *"Chick-fil-A has the best chicken sandwiches, but I am not paying $6. So, I am gonna make it with $1 then compare them."*
- *"My grandmother thinks that Christmas is expensive. So I'm going to prove her wrong by giving her the best Christmas gift for 5 dollars."*
- *"So I started cooking illegally"* (used as a transition, replacing "let's get started")
- *"I'm going to remake a $5 McDonald's meal and sell it for $10"*

---

#### 4. SCRIPTING WORKFLOW (her stated order)

1. Write the **hook first** (very short).
2. Write the **last line** using her template: *"Then I [action] and [blank for reaction]."*
3. Write the **foreshadow** (2 lines bridging hook to ending).
4. Either a **full rough script** OR a **bullet-point outline** (she scripts in full **less than 50% of the time**).
5. **Film chronologically** for clear journey/character development.
6. **Revisit script after filming**, revise, send to edit.
7. **Editing decisions are best made by a storyteller, not just a video editor.**

Category: content structure. Source: [Creator Science](https://podcast.creatorscience.com/jenny-hoyos/), [nednex](https://nednex.com/en/how-to-go-viral-on-youtube-shorts-consistently-jenny-hoyos-averages-10-million-views-per-video/).

---

#### 5. PLATFORM-SPECIFIC RULES

- **YouTube Shorts:** favors **longer (>20s, ideal ~34s)**, **slower pace**, **story-driven**, more mature audience.
- **TikTok:** *"did not like videos over 30 seconds";* shorter (10–20s), information-dense, fewer jokes, scroll-optimized.
- **Instagram Reels:** **assume muted viewing**; heavy visual storytelling, subtitles every second, prioritize shareability.

Category: algorithm insight. Source: [Creator Science](https://podcast.creatorscience.com/jenny-hoyos/), [Marketing Examined](https://www.marketingexamined.com/blog/jenny-hoyos-short-form-video-playbook).

---

#### 6. AI WORKFLOW

- **Primary tool: Google Gemini.** *"I love all of them, but Google Gemini is really good."*
- Use case 1 (ideation): give AI a trend and ask *"give me different hooks or ways I can execute this."*
- Use case 2 (hooks): *"what's a viral hook, what's gonna shock people"* → generate variants.
- Use case 3 (payoffs): pick a hook → ask AI for **different payoff ideas.**
- Use case 4 (scripting): **fill in line-by-line gaps** with AI, not full scripts.
- **Critical filter:** *"It's not always good"* — she curates aggressively, never accepts wholesale.
- Films on phone, edits in Adobe Premiere Pro.

Source: [Yahoo / Business Insider](https://www.yahoo.com/lifestyle/articles/jenny-hoyos-uses-ai-content-005452995.html).

---

#### 7. ANALYTICS / MEASUREMENT

- **Three viewer-satisfaction metrics:** retention, rewatchability, subscribability.
- **Transcript-mining trick:** change a Short URL from `watch?v=` (Shorts) to the watch page to access full transcripts; she scraped transcripts of **thousands** of Shorts (MrBeast, Ryan Trahan) and ran them through a readability checker.
- **Retention graphs are the key analytic** for finding 1-second dead spots to trim.
- **48-hour window:** look for "videos that are a bit old but performing in the last 48 hours" — signal of late-bloomer viral lift.
- Tracks: scroll-through rate, retention, rewatch value, audience growth, revenue per video.
- **Hypothesis (unvalidated by her):** **shareability matters more than retention** for true virality. Observed a video with **20% shares-to-view ratio + 92% growth rate.** Also: friends with 100%+ retention don't always hit 10M views, while her ~70% early-retention videos do (because returning viewers).

Category: algorithm insight / numerical claim. Source: [Creator Science](https://podcast.creatorscience.com/jenny-hoyos/).

---

#### 8. ANTI-PATTERNS (her stated don'ts)

- **Don't talk fast — talk MORE CONCISE.** Cut filler.
- **Don't pack multiple messages** into one Short — kills virality.
- **Don't general-target** — *"specific beats general every time."*
- **Don't show your face first** if a logo/object is more universally recognizable.
- **Don't use pace-breaking transitions** ("now we're going to," "let's start by," "let's get cooking" — though earlier sources cite "let's get cooking" as acceptable, she later replaced it with content-bearing transitions like "so I cooked illegally").
- **Don't crowd the frame** — max 3 objects.
- **Don't obsess over retention alone** — some viral videos don't have perfect retention; satisfaction matters more.
- **Don't fail to brainstorm enough** — multiple ideas enable better selection.
- **Don't write above 5th-grade level.**
- **Don't assume Short subscribers transition to long-form** — different audience.

Category: anti-patterns. Source: [Marketing Examined](https://www.marketingexamined.com/blog/jenny-hoyos-short-form-video-playbook), [nednex](https://nednex.com/en/how-to-go-viral-on-youtube-shorts-consistently-jenny-hoyos-averages-10-million-views-per-video/).

---

#### 9. AUDIENCE AVATAR

- Targets her **younger self** and her **nieces (ages 7 and 10), non-native English speakers**.
- Test: *"If they understand this, it's probably really good."*
- Focus on **how to speak to them**, not on their dreams/desires.
- Rationale for radical simplicity: native-English-as-second-language viewers globally.

Category: content structure. Source: [Creator Science](https://podcast.creatorscience.com/jenny-hoyos/), [Facu Rubin Medium](https://medium.com/@facurubinn/heres-how-an-18-year-old-youtuber-amassed-10-million-views-using-youtube-shorts-848f190b5b8b).

---

#### 10. IDEA SELECTION (priority order)

Her stated 6-question filter for picking which of 1,000 ideas to make:
1. Do I want to make it?
2. Logistically possible?
3. Strong hook?
4. Good mechanism?
5. Rewatch value?
6. Virality potential?

Editor narrows from 25 → 10 on: "simple yet complex" concept viability + shareability.
Category: content structure. Source: [Creator Science](https://podcast.creatorscience.com/jenny-hoyos/).

---

#### 11. COURSE / PRODUCT (where her teaching lives)

- **21 Days to Viral Challenge** (nas.io / nas.com): 21 daily video lessons, exclusive framework PDF, private Discord, 3 live weekly sessions with Jenny, 7-day money-back guarantee.
- **1:1 Coaching Calls + Group Coaching** at jennyhoyos.com/coaching.
- **TED Talk:** "The secret to telling a great story — in less than 60 seconds" (TEDNext 2024).
- **Podcast appearances:** Creator Science Ep. 167 (Jay Clouse), Work Less Earn More Ep. 202 (Gillian Perkins), My First Million, Orbit for Creators, Heather Parady Ep. 120, and the YouTube interview with Colin & Samir / Todd Sherman / "Meet the YouTuber Who Solved Shorts."

---

#### 12. KEY VERBATIM QUOTES (high-value for prompt design)

- *"I don't ask if you'll go viral. I can figure out how to make it viral."*
- *"You can make a video about anything if there's a story around it and if the viewer is invested."*
- *"It's just adding story and a twist."*
- *"When you use 'but' in your story, it stops someone from scrolling."*
- *"If everything is smooth sailing, then nobody cares."*
- *"If it takes longer to tell your story than it does to make a burger, then you're probably overcooking both."*
- *"Do not talk fast — just talk more concise."*
- *"Leave them satisfied, but surprised."*
- *"The first three seconds determine if you'll get three million views or three thousand."*
- *"Specific beats general every time."*
- *"Whatever you say you're going to do, end it right after you do it."*
- *"Money is not the reason why — I don't even care how much I'm making."*

---

#### Source URLs (all consulted)

- https://www.marketingexamined.com/blog/jenny-hoyos-short-form-video-playbook
- https://podcast.creatorscience.com/jenny-hoyos/
- https://www.ted.com/talks/jenny_hoyos_the_secret_to_telling_a_great_story_in_less_than_60_seconds
- https://www.contentgrip.com/how-to-tell-a-great-story-in-60-seconds/
- https://finallayer.com/blog/jenny-hoyos-the-18-year-old-phenomenon-who-achieved-viral-success
- https://medium.com/@10xquality/600m-viral-youtube-shorts-views-in-only-1-year-jenny-cracked-the-code-bcb43708f298
- https://medium.com/@facurubinn/heres-how-an-18-year-old-youtuber-amassed-10-million-views-using-youtube-shorts-848f190b5b8b
- https://medium.com/@ammarsheikhs/the-secrets-of-youtube-short-sensation-jenny-hoyos-e6026a855e9b
- https://vidiq.com/blog/post/how-jenny-hoyos-gets-10m-views-per-youtube-short/
- https://www.hooksounds.com/blog/jenny-hoyos-tips-and-tricks-from-a-viral-superstar/
- https://www.heatherparady.com/blog/120
- https://www.linkedin.com/posts/jayclouse_jenny-hoyos-gave-me-her-exact-script-that-activity-7262878750684459010-NIZu
- https://www.linkedin.com/posts/jayclouse_i-interviewed-jenny-hoyos-and-learned-a-ton-activity-7117486580600119296-QIS9
- https://www.yahoo.com/lifestyle/articles/jenny-hoyos-uses-ai-content-005452995.html
- https://nas.io/jenny/challenges/21-days-to-viral
- https://jennyhoyos.com/coaching
- https://podpulse.ai/podcast-notes-and-takeaways/my-first-million-the-formula-to-break-100-million-views-on-shorts-ft-jenny-hoyos
- https://thedailystory.net/guide-to-youtube-success-with-jenny-hoyos/
- https://nednex.com/en/how-to-go-viral-on-youtube-shorts-consistently-jenny-hoyos-averages-10-million-views-per-video/
- https://summarize.ing/video-69997-Meet-the-Girl-Who-Cracked-YouTube-Shorts-Jenny-Hoyos-Interview-

---

## Dossier: Ava Yuergens (@personalbrandlaunch / @avayuergens)

### Ava Yuergens (@personalbranchlaunch / @avayuergens) — Public Frameworks, Hooks, and Virality Rules

**Research date:** 2026-05-20
**Subject:** Ava Yuergens, founder/CEO of Personal Brand Launch (PBL), pblaunch.com. Instagram growth strategist. Real estate investor at 15; pivoted to social media DFY service.
**Scope:** Only stated frameworks, written/spoken advice, course/template content, interviews. No analysis of her videos.

---

#### 1. NAMED FRAMEWORKS & RULES

##### The 5x Rule (outlier identification)
- **Category:** algorithm insight / research methodology
- **Source:** Jack Neel Podcast appearance; startupspells.com $2M Reel Playbook recap
- **Stated rule:** "An outlier video is one that gets at least 5 times more views than an account's total follower count."
- **Operational use:** Used to qualify which videos to clone hooks from during research. Filters out vanity views from accounts with huge baseline reach.

##### Hook → Script → Format → Editing (impact priority order)
- **Category:** content structure / hook formula
- **Source:** startupspells.com recap of her stated process; podcast
- **Rule:** Allocate creative effort in this exact order. Hook dominates; editing is the least important variable.

##### Three-Hook Stack in First 3 Seconds
- **Category:** hook formula
- **Quote/paraphrase:** "Stack three hooks in the first three seconds — something to see, something to read, something to hear."
- **Components:**
  1. **Visual hook** (something to see) — now carries more weight than verbal lines per her statement
  2. **Text-on-screen hook** (something to read)
  3. **Verbal/audio hook** (something to hear)
- **Source:** startupspells.com; podcast appearance

##### Broad → Narrow → Niche (script funnel architecture)
- **Category:** content structure
- **Rule:** "Start with a broad hook to maximize watch time, deliver narrow value for your ideal customer profile, then use a niche CTA."
- **Logic:** Broad hook = maximize distribution; narrow body = filter for ICP; niche CTA = convert qualified viewers only.
- **Source:** startupspells.com $2M Reel Playbook

##### Daily Stories as "Cash Register"
- **Category:** distribution / conversion
- **Rule:** Treat Instagram Stories like "a daily cash register." Use before/after images and links daily.
- **Numerical claim:** ~500 daily clicks generated from this practice.

---

#### 2. RESEARCH & PRODUCTION WORKFLOW (stated process)

Stated step-by-step (per podcast and Personal Brand Launch service description):

- **Day 1–2 (Research):** Go to Instagram Explore page within the niche. Pull 100+ Reels with over 1 million views. Log: hook, view count, topic, format. Apply 5x Rule to qualify outliers.
- **Day 3 (Scripts):** Write 15–30 scripts that reuse the proven hooks from outlier mining, but inject the client's own niche expertise / concrete know-how.
- **Day 4 (Film):** Film 5 talking-head versions first, then 5 in a second format (e.g., B-roll voiceover, walk-and-talk). Multiple format variants per hook.
- **Edit & Upload:** Agency edits; uploads across IG/TikTok/Shorts/Facebook/LinkedIn.

**Time investment claim:** 10–12 hours per client per month spent on outlier research alone.
**Personal practice claim:** 20 minutes per day of "intentional scrolling" for hook collection.

---

#### 3. SCRIPTING RULES

- **Reading level target:** 5th grade. She uses Hemingway editor (or equivalent) for clarity.
- **Anti-pattern:** "Don't let AI write your scripts. It's fine for research, but the final script needs a human voice."
- **Script document structure:** Each script includes (a) format/filming notes, (b) bulleted line-by-line delivery script, (c) caption text, (d) subtitles.
- **Repurpose principle:** Reuse the proven hook structure but replace the body with the client's domain expertise. "Viral hooks + your niche expertise."

---

#### 4. HOOK FORMULAS (specific named patterns from "Steal These Viral Hooks" LinkedIn post)

Source: LinkedIn post "Steal These Viral Hooks" (Apr 2024)

1. **Exchange/Comparison Hook:** "For this you can have this" — present trade-offs or value exchanges to create curiosity.
2. **Specificity Hook:** "For this croissant you can have all these raspberries with this much whipped cream" — concrete details and visuals over abstractions.
3. **Cause-and-Effect Hook:** "This is what happens when you [X]" — demonstrate results or consequences.
4. **Environmental/Contextual Hook:** "This is what happens when you play Italian music in a cafe" — setting drives outcome.
5. **Pricing Challenge Hook:** "Can you do X for $20?" — monetary constraints / specific dollar challenge.
6. **Regret/Hindsight Hook:** "What I wish I knew at age X instead of Y" — example given: "I wish I knew about my body at 43 instead of 53."
7. **Quantified Challenge Hook:** "Day one of drinking [specific quantity]" — combines personal challenge with metrics/follower counts.

**Underlying mechanic she states:** Hooks work via contrast, specificity, curiosity, emotional resonance.

---

#### 5. CHATGPT PROMPTS FRAMEWORK (LinkedIn post)

Three prompts she publishes for clients/followers:

- **Prompt 1 (Bio generation):** "Please act as a social media expert for my business. Please write me 15 instagram bios, no more than 150 characters, including emojis." Structured as 3-line format, each line opens with emoji, one audience benefit per line.
- **Prompt 2 (Topic discovery):** "Please act as a social media expert and strategist for my business." Asks for 30 niche-relevant topics with 5 related keywords each.
- **Prompt 3 (Seven Content Ideas):** "Please generate 7 content ideas related to [niche topic]." The seven mandated categories: (1) common audience mistakes, (2) widespread myths, (3) tips and strategies, (4) how-to tutorials, (5) resource lists, (6) problem identification, (7) frequently searched questions.

---

#### 6. PLATFORM & POSTING RULES

- **Platform preference:** Instagram preferred for follower loyalty.
- **Cross-post warning:** "YouTube Shorts can harm long-form channel health" if shorts attract a misaligned audience to a long-form channel. Stated as cautionary anti-pattern.
- **Posting volume (tiered DFY packages):** 15, 20, or 30 short-form videos per month + 7, 10, or 15 sales-focused Stories per month.
- **Format constraint:** 60 seconds or less, 9:16 vertical ratio.
- **Real-life content cadence:** "Once a quarter, ship a tasteful real-life reaction with a fast turn and an honest caption." Stated as a balance to systematized content.

---

#### 7. ANTI-PATTERNS (explicitly stated)

- Do not let AI write final scripts.
- Do not cross-post Shorts to a long-form YouTube channel if audiences are misaligned.
- Do not pad with editing flourishes — Hook > Script > Format > Editing in priority.
- Do not write above 5th-grade reading level.

---

#### 8. NUMERICAL CLAIMS (all from her own statements / her agency's recap)

- **August 2024 viral Reel:** 7.9M views → 13,000 leads (via comments) → ~100–200 clients converted at $2,000–$4,000/month.
- **Single video annualized revenue:** ~$2M from that one Reel.
- **March 2025 monthly revenue:** ~$700,000 with expenses just under 50% of revenue.
- **Monthly revenue (alt source):** $543K/month referenced in a third-party YouTube title.
- **Wedding video views:** ~50M Instagram + ~60M TikTok (separately reported 40M+ TikTok as of one source).
- **Outlier research depth:** 100+ million-view Reels logged per niche.
- **Research labor:** 10–12 hours/client/month.
- **Personal scroll time:** 20 min/day intentional research.
- **Client roster:** 350–400 business owners on retainer.
- **Team size:** 82 employees at Personal Brand Launch (per RocketReach).
- **Account growth claim:** Business IG grew 0 → 500k followers in 2 years.
- **Stories daily clicks:** ~500/day.

##### Service pricing (published on pblaunch.com)
| Package | Videos/mo | Stories/mo | Price/mo |
|---|---|---|---|
| GROW | 15 | 7 | $2,995 |
| SCALE | 20 | 10 | $3,495 |
| DOMINATE | 30 | 15 | $4,495 |

---

#### 9. PUBLISHED PRODUCTS (where she teaches publicly)

- **Gumroad "Content Creation Template"** at `personalbrandlaunch.gumroad.com/l/migwpy` — template product (content not fully scrapeable, but the page exists as a public asset).
- **YouTube:** `youtube.com/@avayuergens` and `youtube.com/@personalbrandlaunch` and `youtube.com/@personalbrandlaunchshorts`.
- **TikTok:** `@avayuergens` (note: handle is `avayuergens`, not `personalbranchlaunch` as the user-provided handle suggests — possible typo for `personalbrandlaunch`).
- **LinkedIn:** `linkedin.com/in/ava-yuergens-641721206/` — extensive series of long-form posts.
- **Website:** `pblaunch.com` and `pblaunch.com/callform` (sales funnel).

---

#### 10. STATED MECHANISM (her summarized "what works" loop)

From the startupspells.com recap of her own statements, her end-to-end virality mechanism is:

> "outlier research → precise hooks and scripts → simple formats → a friction-free CTA that lands on proof"

Breakdown:
- **Outlier research:** the 5x Rule + Explore page mining
- **Precise hooks:** triple-stack visual/text/audio in 3 sec
- **Simple formats:** talking-head primary, second format variant
- **Friction-free CTA:** narrow CTA at end of broad-to-narrow funnel, landing on social proof (testimonials, results)

---

#### 11. GAPS / NOT FOUND

- No retention curve methodology stated (e.g., no specific "mid-roll pattern interrupt" or loop-ending tactic surfaced in scraped sources).
- No proprietary named methodology beyond "5x Rule" and the unnamed Hook/Script/Format/Editing priority.
- Podcast transcripts were not directly scrapeable (YouTube blocked transcript fetch; Podscan returned 403). Primary source for podcast claims is the startupspells.com recap, which paraphrases her stated framework.
- No published course/cohort program found; the public products are the DFY agency service and the Gumroad template.

---

#### Sources

- [Ava Yuergens — Steal These Viral Hooks (LinkedIn)](https://www.linkedin.com/posts/ava-yuergens-641721206_steal-these-viral-hooks-activity-7182785041947668481-TwA5)
- [$2M Instagram Reel Playbook (StartupSpells recap of her framework)](https://startupspells.com/p/instagram-reel-playbook-viral-revenue)
- [Reels Expert: I Made $2M With One Video — Jack Neel Podcast (YouTube)](https://www.youtube.com/watch?v=HzoQgQS8czE)
- [Reels Expert — Jack Neel Podcast (Apple Podcasts)](https://podcasts.apple.com/ua/podcast/reels-expert-i-made-%242m-with-one-video-steal-this-viral-hook/id1771315770?i=1000718392567)
- [Reels Expert — Jack Neel Podcast (Podscan)](https://podscan.fm/podcasts/jack-neel-podcast/episodes/reels-expert-i-made-2m-with-one-video-steal-this-viral-hook)
- [Content Creation Template — Gumroad](https://personalbrandlaunch.gumroad.com/l/migwpy)
- [Personal Brand Launch — pblaunch.com homepage](https://pblaunch.com)
- [Ava Yuergens ChatGPT Prompts post (LinkedIn)](https://www.linkedin.com/posts/ava-yuergens-641721206_businessowner-entrepreneur-onlinebusiness-activity-7167848354293436417-A3XG)
- [Ava Yuergens 19 Lessons series (LinkedIn)](https://www.linkedin.com/posts/ava-yuergens-641721206_hi-my-name-is-ava-19-lessons-i-learned-activity-7292541030283755520-fBt6)
- [Ava Yuergens Top 5 Podcasts post (LinkedIn)](https://www.linkedin.com/posts/ava-yuergens-641721206_i-have-listened-to-1000s-of-podcasts-these-activity-7270066199554600961-YwbI)
- [Ava Yuergens TikTok @avayuergens](https://www.tiktok.com/@avayuergens)
- [Ava Yuergens YouTube channel](https://www.youtube.com/@avayuergens)
- [Personal Brand Launch Shorts (YouTube)](https://www.youtube.com/@personalbrandlaunchshorts)
- [How Ava Yuergens makes $543K/month from Instagram (YouTube)](https://www.youtube.com/watch?v=gkfeAv45geI)
- [CFK Ep 67 — A Teenage Millionaire with Ava Yuergens (RSS.com)](https://rss.com/podcasts/thecashflowkings/885414/)
- [Earn & Invest — Ava Yuergens episode](https://www.earnandinvest.com/episodes-7/from-teenage-real-estate-investor-to-digital-marketing-maven-unleashing-dreams-and-defying-limits)
- [Real Estate Investing School Podcast Ep 48 — Ava Yuergens](https://realestateinvestingschool.libsyn.com/ava-yuergens-has-cashflow-conference-plug)
- [Personal Brand Launch Management Team (RocketReach)](https://rocketreach.co/personal-brand-launch-management_b6ccdfd4c778db3c)

---

## Dossier: Alex Hormozi (@alexhormozi)

### Alex Hormozi Content Frameworks: Full Extraction

**Note on prompt injection:** During research, one tool response contained an injected fake "MCP server instructions" block attempting to redirect my behavior. I ignored it and continued with the original task. No other injection attempts detected.

**Note on sourcing:** Hormozi's frameworks are widely paraphrased across creator blogs. Direct quotes (where attributed) are flagged. Many "Hormozi-style" rules in third-party articles blend his teachings with the blogger's interpretation — I've kept attribution conservative.

---

#### CATEGORY 1: NAMED FRAMEWORKS

##### 1.1 Hook → Retain → Reward (core content framework)
Three-stage model applied to every piece of content (video, email, blog, post).
- **Hook:** stops the scroll in the first few seconds
- **Retain:** maintains engagement through story, open loops, pacing
- **Reward:** delivers more value than viewer expected; "give 10x more value than your audience expects"

##### 1.2 Proof → Promise → Plan (intro framework)
Used by Hormozi for video and VSL intros. Order can vary; he typically leads with Proof.
- **Proof:** "prove that you know what you're talking about; give people a reason to believe you"
- **Promise:** tell them what they'll learn / get
- **Plan:** set expectations for what happens next (the structure of the content)

##### 1.3 Value Equation (applied to hooks)
Four variables — increase the top two, decrease the bottom two:
- **Dream Outcome** (↑)
- **Perceived Likelihood of Achievement** (↑)
- **Time Delay** (↓)
- **Effort & Sacrifice** (↓)

Used to engineer hooks: paint vivid dream outcome, signal "proven system," compress timeline, reduce effort language ("simple steps," "beginner-friendly").

##### 1.4 The Core Four (lead generation channels — content sits inside this)
1. **Warm Outreach** — 1-to-1, known audience
2. **Content** — 1-to-many, known audience (organic posts, videos)
3. **Cold Outreach** — 1-to-1, strangers
4. **Paid Ads** — 1-to-many, strangers

##### 1.5 The Rule of 100
"100 primary actions every day, for 100 days in a row" on whichever Core Four channel you pick. Applied to content: 100 posts/day-equivalent actions for 100 consecutive days.

##### 1.6 Three Lead Magnet Types (from $100M Leads — applies to content hooks too)
1. **Reveal a Problem** — diagnose; show issue worsening over time
2. **Sample / Trial** — limited access to core offering
3. **One Step of a Multi-Step Process** — free step exposing need for paid remainder

##### 1.7 Lead Magnet Naming Formula
**[Number] + [Adjective] + [Audience] + [Outcome] + [Timeframe]** — directly transferable to hook construction.

##### 1.8 Proof. Promise. Plan. (sales/pitch variant)
For pitching ideas/products: social proof → likely-to-fulfill promise → exact plan to achieve it.

##### 1.9 3A Framework (sales-adjacent, used in content monologue close)
Acknowledge → Associate → Ask.

##### 1.10 Five Phases of Content Marketing
- **Phase 1:** Make something & post it
- **Phase 2:** Post consistently (minimum 1x/week, batch one day/week)
- **Phase 3:** Post reliably on ALL platforms (6+ months minimum, adapted per platform)
- **Phase 4:** Maximize output — short-form (Twitter/TikTok): **5–10/day**; long-form (FB/IG): **1–2/day**. "Crank up the volume."
- **Phase 5:** Capturing & creating — "Quality + quantity wins every time." Include CTA in every piece.

##### 1.11 Six Content Lessons (from his "7.8M followers in 40 months" talk)
1. Edutainment → Education (pick a side; education converts better for B2B)
2. "For Us" → "For You" (clear thumbnails, Proof-Promise-Plan intros, lists/steps, less B-roll, "ounce of pre-work = pound of post")
3. Wide → Narrow (one topical lane)
4. Views → Revenue (track RPM, not raw views)
5. Shorts → Longs (long-form converts; shorts retain short viewers)
6. "Assume More" → "Assume Nothing" (re-introduce yourself, no inside jokes, repost winners)

##### 1.12 Hormozi Ad Assembly Process (paid, but same logic for organic creative)
- 6 angles × 5 hooks = 30 ads → film 2 versions = 60 total
- Run each in own ad set; rank 1–30
- **70/20/10 allocation:**
  - **70%** = slight variations of top 2 performers
  - **20%** = significant variations of winners
  - **10%** = entirely new angle tests
- Weekly cycle, indefinitely

##### 1.13 Five Awareness-Based Hook Types (Hormozi-attributed, adapted from Schwartz)
1. **Unaware** — curiosity / pattern interrupt
2. **Problem-Aware** — agitate the pain
3. **Solution-Aware** — promise/benefit-driven
4. **Product-Aware** — proof/testimonial-driven
5. **Most Aware** — offer/urgency-driven

##### 1.14 Two-Part Hook Structure
**[Call Out audience/problem] + [Condition for Value / Promise] = Hook.** Example: "Gym owners making less than $10K/month — here's the 3-step playbook."

---

#### CATEGORY 2: NUMERICAL CLAIMS & RULES

- **Hooks = ~80% of an ad's performance.** Optimize hook before anything else.
- **5x more people read your headline** than the body — test headlines first.
- **Attention window: 3 seconds** for ad hooks. Some sources say first 2 seconds for short-form.
- **50% of TikTok/Instagram viewers watch with audio off** → always burn-in text overlays.
- **Hook duration target:** ≤ 2 seconds; explicit outcome + number + timeframe in first 5 seconds.
- **Clean cuts every 3–4 seconds** (text overlays, minimal graphics) — pacing standard for Hormozi-style edits.
- **30-second short format** is the production target.
- **Content length philosophy:** "There's no such thing as too long, only too boring."
- **Value-to-ask ratio:** **98% value : 2% ask** for short-form; long-form can run TV-standard **3:1**.
- **Posting cadence:** short-form 5–10/day; long-form 1–2/day; minimum 1/week to be "serious."
- **Time horizon:** "18 months minimum to build momentum."
- **35,000 pieces of content** in 40 months → 7.8M followers.
- **Acquisition.com content budget:** ~$70,000/month.
- **Daily Twitter mix:** 1–3 attention tweets + 1 nurture-lead tweet + 1 story tweet.
- **Format split (LinkedIn analysis):** 40% text, 34% image, 25% video. Carousels best performer.
- **Post length:** typically <200 characters on X/LinkedIn short posts.
- **Follow-up rule:** contact leads **5–7 times minimum** — "money is in the follow-up."
- **80% of leads don't buy on first contact.**
- **Speed-to-lead:** contact within **60 seconds**; conversion drops from **~70% → ~20%** if prospect leaves without booking.
- **CLV should be 3x CAC** (lifetime value : acquisition cost).
- **Value stack target:** offer perceived value **10x** the price.
- **Page-speed lever:** 7% revenue drop per 1 second of page-load delay (Google study he cites).
- **Above-the-fold:** "80% of optimization happens above the fold" on landing pages.

---

#### CATEGORY 3: HOOK PATTERNS (DOCUMENTED EXAMPLES)

Verbatim or near-verbatim hooks Hormozi uses:
- "You can beat 99% of people by…"
- "Throwback from seven years ago…"
- "The biggest risk to your future isn't your competition…"
- "My company sold for $46,200,000."
- "My first business failed."
- "Maybe your stress isn't a problem."
- "You only need 3 things to win."
- "She has 5,800 followers; her average post gets 19 likes."
- "A message for friends of entrepreneurs:"
- "How I" (credibility-claiming opener, e.g. "How I made $100K from one video")
- Curiosity bridge: "I learned this tactic from Eminem that he used in rap but actually makes sales way more effective."
- Contrarian wake-up: "If you have no money, you should have no shame."

**Pattern types he relies on:**
- Bold contrarian statement
- Surprising statistic
- Pain-point question
- Personal authority ("How I…", "My…")
- Curiosity bridge (juxtapose unrelated domains)
- Direct call-out of audience identity ("Gym owners making <$10K…")
- Bold promise (specific outcome + timeframe)

---

#### CATEGORY 4: RETENTION TACTICS

- **Open loops / tease-then-payoff:** "Start with a teaser, build the narrative, save the main takeaway for the end."
- **Cut every 3–4 seconds.**
- **Text overlays on key phrases** (bold, color highlights, emojis).
- **Sound design:** "whoosh," "pop," "click" as retention micro-hooks.
- **No filler intros** — eliminate "hey guys, today we're going to…" entirely.
- **One key takeaway per video** (especially short-form).
- **Punchy short sentences,** no qualifiers, no hedging.
- **Pattern interrupt** every few seconds (visual, audio, or verbal).
- **Speak with urgency.**

---

#### CATEGORY 5: CTA / VIRALITY TRIGGERS

- **Self-contained clips:** one problem, one insight, one CTA per piece.
- **CTA must contain:** (1) clear action, (2) reason to act now.
- **Lock CTA to one lead magnet for 30–60 days** to build "muscle memory" with audience.
- **CTA examples:** "Subscribe for more frameworks," "Watch the full breakdown," "Share this if it helped."
- **Strong-CTA close pattern (5-step viral structure):**
  1. Hook with wake-up call (contrarian)
  2. Call out the pain point
  3. Reframe the problem (remove fear of failure)
  4. Create emotional contrast (inaction vs action stakes)
  5. Strong CTA (challenge, not weak request)

---

#### CATEGORY 6: CONTENT STRUCTURE (THE 5-STEP SHORT-FORM SCRIPT)

Hormozi's documented short-form video skeleton:
1. **Hook / question**
2. **Hammer / humor** (intensifier; sometimes a joke or one-line punch)
3. **Read the tweet** (the core thesis, often the source tweet itself)
4. **Example** (specific, concrete, often personal)
5. **Explanation** (why it works / the principle)

Long-form follows: **Proof → Promise → Plan → Body (lists/steps) → CTA.**

---

#### CATEGORY 7: ANTI-PATTERNS (THINGS HORMOZI SAYS NOT TO DO)

- **Don't preach** — share "this is what I did," not "this is what you should do."
- **No exaggerated claims** that break credibility ("4-year degree in 4 minutes" — kills the Value Equation).
- **No filler / no fluff** — eliminate intros, throat-clearing, "hey guys."
- **No inside jokes** — assume audience is brand new.
- **No distracting B-roll** when concrete lists/steps serve the viewer better.
- **Don't optimize for views** — optimize for RPM / revenue / right-audience reach.
- **Don't dilute the niche** — wide → narrow.
- **Don't try to be both edutainment and education** — pick one; their viewers want opposite things.
- **Don't trade value for asks early** — give until they ask.
- **Don't lean on production value** — structure beats lighting/gear.
- **Don't ghostwrite** — Hormozi tweets himself, no AI/copywriters on his personal account.

---

#### CATEGORY 8: DISTRIBUTION / ATTENTION ECONOMICS

- **Twitter is the R&D lab:** post raw tweets, identify winners by engagement, convert top-performers into short-form video scripts.
- **Repurposing tree:** one long-form → podcast → 2,000-word blog → 5–10 social clips → 5-part email sequence → LinkedIn carousel.
- **Platform-specific CTAs:** adapt the CTA language to each platform's culture.
- **Repost winners with different framing/imagery** rather than constantly creating net-new.
- **"Give first… to lots of people for free… without asking for anything"** until someone asks for more — then you've earned the right to charge.
- **Content as profit center, not cost:** Acquisition.com treats due diligence, internal training, and operational documentation as content fuel — "due diligence converted to $10M+ annual free cash flow via workshops."

---

#### CATEGORY 9: STATE-OF-THE-GAME / META RULES

- **"An ounce of pre-work is worth a pound of post."** (research/structure > post-production polish)
- **"Quality + quantity wins every time."** (not either/or)
- **"Playing at a 10 on things most people do at a 7 is the ultimate compounding advantage."**
- **"Attention is everything."** Hooks are "the sale before the sale."
- **"Give away the secrets, sell the implementation."**
- **"The more you give, the more you grow."**
- **Methodology loop:** try → identify what works → scale until diminishing returns → move to next.
- **Core question Hormozi asks:** "With the resources I have, how can I maximize the RIGHT people finding out about my stuff?"

---

#### Sources

- [Hook Retain Reward — itsmostly](https://itsmostly.com/blog/alex-hormozis-content-strategy-hook-retain-and-reward-explained)
- [Value Equation for Hooks — David Schwertfeger](https://davidschwertfeger.com/newsletter/alex-hormozis-value-equation-to-write-viral-hooks/)
- [Viral Video Framework — Coach Danny](https://coachdannydnewsletter.kit.com/posts/steal-alex-hormozi-s-viral-video-framework)
- [3 Strategies for Hormozi Shorts — Reap](https://www.reap.video/blog/3-simple-strategies-to-create-viral-youtube-shorts-inspired-by-alex-hormozi)
- [3 Easy Ways Hormozi Shorts — OpusClip](https://www.opus.pro/blog/3-easy-ways-to-make-viral-youtube-shorts-like-alex-hormozi)
- [$45K Workshop Notes — Dickie Bush](https://dickiebush.substack.com/p/i-invested-45000-in-alex-hormozis)
- [6 Content Lessons / 7.8M followers — Course Creator Lab](https://www.coursecreatorlab.co/blog/alex-hormozis-6-content-lessons-from-gaining-78m-followers-in-40-months)
- [Five Phases of Content Marketing — Evan Cox](https://evancoxconsulting.com/the-five-phases-of-content-marketing-according-to-alex-hormozi/)
- [$70K/month content strategy — Ryan Porter / Medium](https://medium.com/swlh/alex-hormozis-70-000-month-content-strategy-in-2-minutes-f54dd4d48bfb)
- [Hormozi LinkedIn Writing — MagicPost](https://magicpost.in/blog/how-to-write-like-alex-hormozi)
- [Proof Promise Plan — AmpliFire](https://ampifire.com/blog/alex-hormozi-proof-promise-plan-framework-to-sell-your-idea/)
- [Hook Writing Method — Solopreneur Code](https://solopreneurcode.substack.com/p/how-i-write-hooks-that-actually-work)
- [$100M Leads Book Summary — Manas Saloi](https://manassaloi.com/booksummaries/2025/07/27/million-leads-hormozi.html)
- [Lead Generation Blueprint — Niko Fischer](https://nikofischer.com/alex-hormozi-lead-generation-blueprint)
- [Acquisition.com Content Playbook — Stormy](https://stormy.ai/blog/alex-hormozi-acquisition-content-profit-center-playbook)
- [A+ Content Strategy — Cait Mack](https://caitmack.medium.com/alex-hormozis-a-content-strategy-5101ab590de1)
- [Brand Strategy / 5 Rules — Coach Jessica Campos](https://www.coachjessicacampos.com/alex-hormozi-brand-strategy/)
- [Give First Tweet — Hormozi on X](https://x.com/AlexHormozi/status/1661423103887409186)
- [Skool VSL 11-step framework](https://www.skool.com/community/heres-hormozis-11-step-vsl-framework)
- [Skool Proof Promise Plan thread](https://www.skool.com/community/proof-promise-plan-hormozi-framework)

