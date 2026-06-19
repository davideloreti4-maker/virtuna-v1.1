# Sandcastles → Adopt & Improve (P11+ candidate track)

> **Scope:** Forward-looking. This is a NET-NEW phase track for **P11+**, decoupled
> from the locked P8–P10 work. Nothing here modifies P8 (shipped), P9, or P10.
> Source: public-surface audit of sandcastles.ai (2026-06-19), independent reviews.
> UX-specific items still pending authed-product walkthrough (hybrid capture).

## Confirmed thesis

Their flow ends where memory predicted — no Read:

> Customize Feed → Find Outliers → Analyze Virality → **Write Scripts.** ∎

Two weaknesses their own independent reviews flag map 1:1 onto Numen's two moats:

| Sandcastles weakness (quoted) | Numen's answer |
|---|---|
| "Relying completely on AI scripts… leads to **highly robotic, generic** video flows" | Grounded KC + creator voice + profile (anti-slop spine) |
| "**Does not run live A/B tests**… strictly a pre-production tool" | SIM-1 synthetic-audience **Test = the Read** |

"Improve even further" ≠ matching their discover→script flow (P6/P8 already do).
It = making grounded-voice + the Read the mandatory spine *on top of* their flow,
and turning their stickiest habit mechanic into something audience-grounded.

## Their public surface (reference)

- **Features:** channel discovery (IG/TikTok/YT Shorts), outlier DB ("millions of
  videos"), hook generation, watchlist/feed, transcript downloads, script writing,
  viral analysis, project/collections, AI agents (auto feed exploration — Pro tier).
- **Pricing:** Pro $49/mo (100 credits) · Visionary $99/mo (250) · Titan $499/mo
  (1,500). 1 credit = 1 action (analyze or script). 100k+ users, 4.9/5.
- **Explicitly NOT:** full production, publishing, native A/B testing.

## ADOPT (they do well; Numen is thinner)

1. **Persistent watchlist + AI auto-exploration** — their stickiest mechanic; a
   *daily habit* feed of tracked channels. Numen's P8 Discover is a one-shot pull.
2. **Collections / project organization** — organize winning ideas/channels into
   collections (a creator-grade org primitive).
3. **One-click "find outliers instantly"** affordance — match the *feel* of instant
   discovery (not the index size).
4. **Simple credit meter legibility** — 1 credit = 1 action. Pressure-test vs our
   Readings meter for clarity.

## P11+ CANDIDATE PHASES

### P11 — Living Research Feed (the flagship adopt)
Turn one-shot Discover into a **returning, living surface**: persistent tracked
channels + auto-exploration agents. **Improvement over Sandcastles:** every
surfaced outlier scored *relative to YOUR audience* (not generic view-count
outlier) with an **inline Read** ("would your audience bite — and why-not"). Their
feed says "this popped." Numen's says "this popped, and here's if it lands for you."
Becomes the daily-habit entry door the studio currently lacks.

### P12 — Collections & Research Workspace (adopt their org primitive)
Organize tracked channels / outliers / remixes / saved Reads into collections.
**Overlap flag:** P10's Saved shelf is lean; this is richer project-org. Decide at
discuss-time — P10 absorbs it, or P12 extends it. Don't double-build.

## Cross-cutting (NOT a phase)

**Positioning / messaging:** lead on the validation gap — "they stop at the script;
Numen tells you if it'll land, before you film." That's their reviewers' #1 complaint
handed to us. Feeds landing/marketing, not a build phase.

## Open: authed-product gaps

Need authed walkthrough to refine UX-level adopt list: real feed UX feel, actual
script output quality, the analyze-virality screen. (Hybrid capture — owner's half.)

---

## Authed walkthrough — RESEARCH section (2026-06-19)

Their Research section is a full reverse-engineering workspace (deeper than public site). Spine metric = **outlier score** (views vs channel baseline) on every artifact.

- **Videos:** analyze-grid, 32,796 analyzed from tracked channels; filters = outlier-score(0-100x)/views/engagement/recency/platform/analyzed-status; badges = outlier·views·eng%; Bulk Analyze + Export.
- **Ideas:** inbox triage (keyboard S/D/A/C), ideas auto-gen from analyzed videos; detail = structured framework (Content Positioning·Unique Angle / Storytelling Format·Why It Works / Contrast Mechanism: Common Belief vs Contrarian Reality / Hook Alignment / How-to-Personalize Option 1/2). All descriptive, never tested.
- **Video detail:** tabs Transcript/Idea Analysis/Hook/Storytelling Format/Visual Layout; actions incl. "Export for LLM".
- **Hooks:** vault of bracket-templates ("What separates the [group] who [outcome]...") + category tag + proven outlier-multiple + views + "inspired by @channel"; 26 defaults + own.
- **Collections:** editorial craft taxonomy (3P Crash Zoom, Beat Match Visual Switch, A vs B, Breakdowns, Camera Whip) grouped format/visual-hook/editing-style.

ADOPT→improve: outlier score (→ relative to YOUR audience + Read); idea reverse-engineer framework (→ personalize-options land on a Read); hook bracket-template abstraction (→ score fresh vs audience); collections craft taxonomy (→ expose Numen KC craft-frames as browsable lib); inbox triage UX (→ P11 Living Feed shortlist/discard). SKIP: Export-for-LLM (don't bleed the closed loop).

**P11 rescope:** "Living Research Feed" is bigger than first drafted — it's analyze-grid + idea-inbox + hook-vault + collections on the outlier spine, with the Read at every node (they attach nothing).

**⚠️ FLAG — "Persona" in their Setup nav (singular).** Likely creator self-voice, not a 10-archetype simulated audience. Single most important screen for moat assessment — review FIRST when reaching Setup.

---

## Authed walkthrough — CREATE section (2026-06-19)

**Scripts = 4-step linear wizard: Topic → Research → Hook → Script** (+ "Fix an existing script" entry).
1. Topic: free-text video description.
2. Research: auto-gen grounding brief (Executive Summary / How to Engage Viewers / Surprising Facts / Contrast Moments) — real topical facts, editable.
3. Hook: 6 options each "Inspired by @creator · N.NM views" + text; pick one.
4. Script: full script + Rewrite/Edit + conversational refine ("what changes?") + reorder/translate icons.
- **Projects:** user's own folders (scripts/videos container), per-project export. (vs Collections=editorial.)
- **Exports:** "work with data off-platform" — Find videos to export / Export your scripts.

**DECISIVE:** entire Create flow has ZERO validation — Topic→Research→Hook→Script then film blind. Hook "proof" (9.2M views) = SOURCE creator's historical views = borrowed/survivorship proof, NOT a prediction for the user's video. Exactly the gap the Read fills; Numen Ideas→Hooks→Script→Test (P3-P6) beats it structurally.

ADOPT→improve:
- **Research step** (auto Surprising Facts + Contrast Moments pre-script) — genuinely novel, possibly a GAP in Numen Script. Improve: ground in what surprises THIS audience + cite. ⚠️ ACTION: check if P6 Script has a topical-research grounding pass or only craft grounding — could be near-term, not just P11+.
- **Hook proof past-vs-predicted**: their card = "9.2M views (someone else)"; Numen card = "pull-score N (your audience)". Sharpens positioning into concrete UI contrast.
- **Conversational refine + translate**: P5 already does (theirs untested rewrite, Numen re-scores); translate/multi-lang worth noting.
- **"Fix an existing script" entry**: paste-own-script → Read/improve. Low-friction door to the Read.
- **Projects = org primitive** → P12 Workspace / P10 Saved shelf.
SKIP: Exports/off-platform (bleed-the-loop).

**Most actionable adopts so far:** (1) the Research/topical-fact grounding step (codebase check P6); (2) hook proof past→predicted framing.

---

## Authed walkthrough — SETUP section + FULL-PRODUCT SYNTHESIS (2026-06-19)

**Channels:** watchlist builder (Suggested-by-category / Describe-your-niche / Search / Add URL); feeds the Videos analyze-grid; right-rail "Your Watchlist".
**Persona** (PAID): three creator-grounding fields, each tagged by where used —
- Content description `[Research]` ("social media marketing and content strategy") → grounds discovery + idea analysis.
- Context `[Scripting]` (brand/voice/expertise/avoid block, e.g. "My voice: direct, slightly contrarian, no hype...") → grounds all scripts.
- Writing style `[Scripting]` → VERBATIM script sample to emulate ("only include a script you want to sound like").
**Automations:** threshold rules, daily-capped. Default "Top Daily Performers — Outlier≥1, Views≥25k, Eng≥2%, daily limit 3" = auto-explore habit engine.
**Settings:** v4.3.0; Profile/Workspaces/Subscription/Feature Flags/Connectors; verified-account ownership (bio-code, 10-acct cap).

### 🎯 MOAT VERDICT (decisive)
Their architecture: INPUT (Watchlist + Creator-Persona + Automation rules) → RESEARCH (auto-analyze outliers, descriptive) → CREATE (Topic→Research→Hook→Script) → OUT (script + export).
**They model the CREATOR and borrow proof from OUTLIERS. They NEVER model the AUDIENCE and NEVER validate output.** No simulated viewer, no reaction, no predicted pull, no post→measure loop. Numen has BOTH layers their architecture structurally lacks (SIM-1 audience + the Read). Durable daylight, not a patchable feature gap. Their "Persona" == Numen's *creator profile* only; Numen also has the *audience*.

### Setup adopt signals
- **Persona writing-sample-to-emulate** — strongest anti-slop mechanic they have. ⚠️ check Numen P7 captures voice via verbatim sample, not just attributes.
- **Field-level "where used" tags** (Research/Scripting) — legibility UX, adopt.
- **Automation rules + daily cap** → P11 habit engine; improve = rule scored vs YOUR audience ("surface outliers my audience would bite on"), not raw outlier≥1.
- **Channels watchlist + Describe→suggested** → P11 input; improve = suggested-by-audience-fit.
- **Connectors / verified ownership** → prereq for P10 Account Read (own the account to self-optimize).

### P11+ track — final shape (3 phases)
Principle: adopt their surface, attach the two things they can't do (audience score + Read) at every node.
1. **P11 Living Research Feed** = Channels+Automations+Videos+Ideas+Hooks+Collections, every outlier scored vs your audience + Read inline; the daily habit.
2. **P12 Creator Persona+ & Workspace** = adopt Persona (esp. writing-sample voice capture) + field-level legibility + Projects org; Numen layers AUDIENCE on top of CREATOR model. Reconcile w/ P7 + P10 Saved shelf.
3. **Positioning** (cross-cutting) = past-vs-predicted, concrete: their card "9.2M views (someone else, past)" vs Numen "pull-score N (your audience, predicted)".

### NEAR-TERM action (not P11, surfaced twice) — codebase check
Does Numen (a) run a topical-fact research pass before scripting (their "Research" step), and (b) capture creator voice via a verbatim writing sample (their Persona "Writing style")? Both cheap adds; both directly counter their two reviewer-flagged weaknesses (generic output / no validation already covered by the Read).

---

## Codebase check results (2026-06-19) — both gaps CONFIRMED

**(a) Topical-fact research pass → ABSENT.** Script grounds on craft + creator profile only (niche/audience/wins-flops-as-URLs); one-pass, no web search, no fact/stat/contrarian gathering. `src/lib/tools/runners/script-runner.ts:240-253`. Slot: new pre-pipeline stage → `research_context` into assembleBundle.

**(b) Verbatim writing-sample voice capture → ABSENT.** Voice only as structured attrs (`content_style` picker, `reference_creators` URLs, `pain_points`); no writing_sample field; 6 profile roles, none is "a script to sound like." `src/lib/kc/profile-role-map.ts:148-155`, `assembler.ts:108-114`. Slot: new `writing_voice_sample` column + `voice` role + fenced formatter + add to idea/hooks/script/remix MODE_ROLES + UI card (10th).

**KEY IMPROVE INSIGHT — beat, don't copy.** Numen Script has an HONESTY SPINE that refuses to fabricate facts (`src/lib/kc/compiled.ts:1274`). Sandcastles' Research step generates "Surprising Facts" with ZERO sourcing = exactly the confident-unverified claim Numen rejects. So adopt = a GROUNDED, CITED research pass (real sourced facts), turning their weakness (ungrounded fact-gen) into Numen's grounded-model strength. Voice: adopt their sample→emulate AND test result on audience.

**RECOMMENDATION — both NEAR-TERM (not P11), harden moat now:**
1. Voice sample FIRST — smallest change, biggest anti-slop payoff, kills "robotic output" complaint (~1 col + 1 role + 1 UI card).
2. Cited research pass — bigger; their one novel feature, reframed to Numen's grounded thesis.

---

## STRATEGIC DIRECTION — brainstorm synthesis (2026-06-19)

### Four strategic theses
1. **Don't out-research them.** Their compounding asset = the corpus (32k videos, outlier-at-scale). We can't catch it and shouldn't try. Adopt their *mechanics*, not their research-maximizing spine.
2. **Our moat is calibration accuracy, not corpus breadth.** The SIM sharpens every Read + every posted outcome (P10 loop) — a per-creator, outcome-grounded data moat they structurally can't build (no audience). Pour energy into the loop that makes the SIM smarter.
3. **We're the test, not the script writer.** Their category (research+scriptwriting) is a crowded output-quality arms race. Numen's category = foresight / "will it land." Generation = on-ramp; the Read = destination. Every surface pulls toward "will it land," never "more content faster."
4. **Grounded-and-honest vs. slop is a brand wedge.** Numen refuses to fabricate; Sandcastles generates unsourced "Surprising Facts." They are polished slop-at-scale. "We won't make things up — we'll tell you what your audience actually does." Name the enemy.

### A-vs-B fork → RESOLVED (dissolved into one skill)
Their whole Research section exists because they have no audience model — the human is the filter. Numen has the SIM, so the audience can filter. BUT a separate "Feed" surface fights the one-conversation metaphor. RESOLUTION: **audience-curated discovery = the Explore skill, in-thread, customizable.** Customizable params = the A-on-tap control + serendipity valve. No feed dashboard. The A-vs-B tension collapses into one skill.

### UX evolution — conversation-spine + ambient audience + proactive Numen (Direction #2, evolved)
- **Spine:** the single conversation thread (v6.0 studio) — preserved.
- **Audience:** ambient companion — reacts on every card, always felt (not summoned).
- **Discovery/feed/habit:** Explore skill in-thread (audience-curated, customizable).
- **Proactive layer:** Numen INITIATES — morning drop "3 things stirring your people would bite on." Ambient audience + proactive Numen = thread alive even when not typing = their watchlist/automations stickiness, in-conversation, no dashboard.
- **Deep audience view:** P9 persona-cloud Lens = consult the audience directly.
- **North-star:** everything resolves to a Read; **minimize time-to-confidence** (their UX maximizes time-in-research; ours minimizes clicks from "I have a thought" → "I know if my audience bites").

### The Acts/State principle (resolves "thread vs separate surfaces")
- **Acts** (transient, generative: generate/explore/test/refine/chat) → **the thread.**
- **State** (persistent, referenceable: watchlist, saved work, audience, settings) → **surfaces.**
- Sandcastles' error: puts Acts on surfaces too (Scripts builder, Ideas inbox = destinations) = dashboard over-reach.
- Thread-purism error: puts State in the thread (watchlist lost in scrollback).
- Numen: acts in thread, state on surfaces, **wired together.**

### IA — 4 items (collapse from their 11 sections)
```
Thread (home/acts)  ·  Audience (state)  ·  Library (state)  ·  Settings (state)
```
- **Thread** — all skills (Explore, Ideas, Hooks, Script, Remix, Test, Chat) + ambient audience + proactive drops.
- **Audience** — profile (voice) + SIM + persona-cloud Lens (P9).
- **Library** — saved nouns (Reads/ideas/hooks/scripts) + tracked accounts/watchlist (P10 shelf, extended).
- **Settings** — incl. Connectors/verified-accounts (P10 Account Read prereq).

### Surface↔thread wiring (surfaces are launchpads + catchers, NOT dead dashboards)
- Every surface item is **actionable INTO the thread** (click tracked account → "Explore its outliers" fires in-thread).
- Every thread output is **savable TO a surface** (love a hook → save to Library; Explore surfaces an account → add to watchlist).

### Start-screen set-actions (new-thread empty state)
Audience-aware quick-actions so the blank thread is never intimidating + the "feed" is one tap, no feed surface:
- "Top performers in my niche today" (Explore, audience-curated)
- "What are my competitors shipping" (Explore over watchlist)
- "Develop an idea" (Ideas) · "Test something I'm about to film" (Test)

### Section mapping — verb→thread, noun→Library, Collections→skill-knowledge
| Sandcastles | Verb (Act)→thread skill | Noun (State)→Library |
|---|---|---|
| Ideas | generate ideas → Ideas skill | saved ideas |
| Hooks | generate hooks → Hooks skill | saved hooks (their "vault") |
| Scripts | write script → Script skill | saved scripts |
| Channels | — | tracked accounts/watchlist |
| Collections | — | NEITHER — craft = knowledge inside skills, whispered in-thread |
| Videos | Explore skill (audience-curated) | saved Reads |
| Projects | — | thread = project + Library shelf (no heavy folders) |
| Exports | card action (copy/send) | — (skip data-liberation) |
| Persona | — | Audience surface (profile + SIM) |
| Automations | proactive Explore (morning drops) | — |

### Near-term gaps (codebase-confirmed; harden moat now, independent of UX work)
- **N1 Creator voice** — verbatim writing-sample capture (new `writing_voice_sample` col + `voice` role + fenced formatter + UI card). Counters "robotic output." SMALL.
- **N2 Cited research pass** — grounded/sourced topical facts pre-script (NOT fabricated like theirs). Counters unsourced fact-gen + fits grounded thesis. MEDIUM.

### Positioning (cross-cutting, not a phase)
Past-vs-predicted, concrete: their card "9.2M views (someone else, past)" vs Numen "pull-score N (your audience, predicted)."

---

## PROPOSED PHASE STRUCTURE (P11+ — provisional, for /gsd-discuss-phase later)

> Sits AFTER P9 (Living Audience) + P10 (Account Read/Saved Shelf/Flywheel), which are in flight.
> ⚠️ Reconcile overlaps: P9 already owns persona-cloud Lens + chat-with-persona; P10 already owns Saved shelf + outcome loop + Connectors. These phases BUILD ON those, must not duplicate.

**Near-term inserts (quick wins, not full phases — /gsd-quick or fold into a live phase):**
- **N1 — Creator voice (writing-sample capture).** Small. Anti-slop. Independent.
- **N2 — Cited research pass for Script.** Medium. Grounded-facts pre-script. Independent.

**P11 — Explore (Audience-Curated Discovery).** THE flagship. Explore skill = audience-curated outlier/competitor discovery in-thread; customizable params; start-screen set-actions; each result card carries ambient audience reaction + lands on a Read. Includes tracked-accounts/watchlist as input State (lives in Library). Reframes the old "Living Research Feed" correctly as a skill — no feed surface. Depends on P9 (audience reactions) + SIM.

**P12 — Library & Acts/State IA.** The State home + the nav collapse. Library = saved nouns (Reads/ideas/hooks/scripts) + tracked accounts/watchlist, sectioned. Surface↔thread wiring (launch-into-thread + save-to-Library). Crystallizes the 4-item IA (Thread/Audience/Library/Settings). Extends P10's saved shelf — reconcile.

**P13 — Proactive Numen (Ambient + Initiated).** Ambient audience reaction on every skill card (if not landed in P9) + proactive morning drops / scheduled Explore (their Automations equivalent) = daily-habit engine, in-conversation. Depends on P11 + P9.

**Cross-cutting:** craft-as-skill-knowledge (KC enhancement, ride P11 or N-slice); positioning (landing/marketing, not a build phase).
