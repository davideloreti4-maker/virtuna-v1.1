# Sandcastles.ai — Structural Insights (competitor teardown)

> Source: 18 product screenshots (`~/Downloads/Sandcastles.ai Screenshots/`) + help.sandcastles.ai Notion KB (rendered 2026-06-17).
> Sandcastles = Kallaway's creator SaaS: ingest competitor channels → analyze videos → generate ideas/hooks/scripts.
> Split: **CRAFT-RELEVANT** (candidate for the KC corpus, owner decides) vs **PRODUCT-ONLY** (informs product/GTM, NOT the corpus).

---

## CRAFT-RELEVANT — candidate corpus material

### 1. Deconstruction axes (their core ontology)
Every video deconstructs into orthogonal craft dimensions, each its own tab:
**Idea Analysis · Hook · Storytelling Format · Visual Layout** (+ Transcript).
→ Maps cleanly to our slice model and confirms Topic×Take×Format. Candidate for a BASE-level framing: *craft decomposes into idea / hook / format / visual layout — analyse and generate each axis distinctly.*

### 2. Idea Analysis schema (per-idea output shape) — strong candidate for ideas.md
Their structured idea deconstruction:
- **Topic** (e.g. "Social Media Funnel Strategy")
- **Idea Seed** ("Mastering the content funnel to turn views into business leads")
- **Unique Angle** ("frame the difference between success and failure as a balance of distribution, not effort/consistency")
- **Common Belief to Challenge** ("posting consistently / viral top-of-funnel is the key")
- **Contrarian Reality** ("true growth requires a balanced distribution of three content types")
- **Supporting Evidence** (TOFU/MOFU/BOFU; the 70/20/10 rule; "winners mix all three, losers focus on one")
→ Note the heavy contrarian/belief-challenge spine — matches our Counter-Intuitive archetype. This is a concrete OUTPUT CONTRACT we could adopt as the per-idea structure (complements our Actionability Contract).

### 3. Funnel + portfolio model — candidate for diversity rule / BASE
- **TOFU / MOFU / BOFU**: top-of-funnel (views) · middle (followers) · bottom (leads).
- **70/20/10 rule**: 70% proven market outliers · 20% iterations on personal wins · 10% experimental "mess around."
→ A *portfolio* lens, distinct from the per-item mechanism lens. Could extend the intra-batch diversity rule (diversify across funnel stage + risk tier, not only mechanism).

### 4. Hook taxonomy — strong candidate for **02-05 hooks slice** (not Ideas)
Hooks tagged with a **CATEGORY** + a templated **FORMULA** (placeholder slots) + spoken example + analysis. Observed categories:
**Question · Personal Experience · Secret Reveal Breakdown · Authority · Contrarian · List · Case Study · Trap Mistake.**
Example formulas (verbatim slot templates):
- Question: "What separates the [group] who [positive outcome] from the ones who [negative action/outcome]?"
- Personal Experience: "I just got the most [adjective] [noun] ever."
- Secret Reveal: "This [technique/system] has gotten me [impressive result], but [reason it is rare/secret]."
- Authority: "I'm a [Professional]. It took me [Time] to learn this and I'm gonna teach you in [Short Time]."
- Contrarian: "Everything you heard about [Subject] was a lie." / "[High %] of [industry products] are [negative attribute]. Here are the only [N] worth [action]."
- List: "These are the only [number] [category] you need to [action] if you want [outcome]."
- Case Study: "[Brand] went from [failure/zero] to [massive success] in [time] by [strategy]."
- Trap Mistake: "Never ever post [content type] on [platform] without using [tool/feature]."
→ Pattern to adopt for hooks slice: **category tag + slot-templated formula + worked example**. The category set is a real, uneven taxonomy (8 observed). Cross-references Kallaway's "Desire-Based Hook 5 variations" + "8 Universal Hook Principles."

### 5. Format ontology (2-level) — candidate for ideas.md format leg + future format slice
Top-level buckets → named format → sub-category:
- **VISUAL HOOKS** (sub: Subject Motion, Visual Effect/Transition, Graphic/Text Overlay, Pattern Interrupt, Visual Selection): 3P Crash Zoom, Camera Whip, Match Cut, Object Catch, Snap/Pop Reveal, Speed Ramp, Frame Collapse, Beat Match Switch…
- **FORMATS**: About Me, A vs B (Comparison/Graphics), Breakdowns, Case Studies, Challenge, Common Mistake/Trap, Day In The Life, Levels, Listicle, Tier List, Problem Solution, Q&A, Reaction, Scenarios, Tutorial, Yap…
- **EDITING STYLES** (sub: Studio/Set, Faceless, In-World/Vlog, Greenscreen, Other): Car Yap, Faceless Animation/Clipping, Split Screen, Stop-Motion, Vlog POV/Music/Reflective, Whiteboard, Man On Street…
- **SIGNATURE SERIES**: Case Study/Breakdown, Docuseries, Numbered Countdown, Progress Journey, Recurring Segment, Skit Universe…
→ Confirms our "~a few dozen formats, 2-3 hero formats" framing and gives a real categorisation. Don't hard-code the full list into the corpus (it's long + their data); adopt the *2-level ontology shape* and the highest-signal named formats.

### 6. "Rules" concept — architectural validation (not corpus)
Their MCP exposes a `/rules` tool = user-defined constraints applied to generation. Confirms our assembler's overrides/anchor + injection-fence design is the right shape.

---

## PRODUCT-ONLY — NOT corpus (informs product/GTM)

- **Feature IA**: Videos / Ideas / Hooks / Collections / Scripts / Projects / Exports / Channels / Persona / Automations / Settings.
- **Creation flow**: Topic → Research → Hook → Script (4-step wizard). Useful UX reference for our studio.
- **Competitor-watchlist model**: user builds a list of channels to track (4 search modes); ideal watchlist size guidance; ideas/hooks mined from the watchlist. This is their data-moat approach.
- **Distribution-in-Claude**: a Sandcastles **MCP plugin** exposing `/analyze, /topic, /hooks-global, /hooks-watchlist, /formats-global, /formats-watchlist, /channels-*, /video-suggest, /rules`. Notable GTM: they meet creators inside Claude, not only their own app. Worth a product-strategy discussion.
- **Performance multipliers** (5.3x, 290.4x…) + view counts on every hook/idea = their proprietary data layer; we cannot replicate without equivalent data.
- 3 script paths · remix vs scratch · bulk analyze · workspaces · credit system — product UX/billing.

---

## Bottom line
Corpus-worthy: the **Idea Analysis output schema** (now, ideas.md), the **hook category+formula pattern** (02-05), the **format 2-level ontology** (ideas.md + format slice), and the **funnel/70-20-10 portfolio lens** (diversity rule). Everything else is product/GTM — captured here for product decisions, kept out of the craft corpus.
