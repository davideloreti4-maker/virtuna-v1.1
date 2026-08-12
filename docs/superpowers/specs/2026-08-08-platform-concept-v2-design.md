# Platform concept v2 — content-first arrival, composer-fused audience

> **Design doc, 2026-08-08.** `lane/platform-concept`. Agreed section-by-section with the owner in
> this session. Supersedes the 2026-08-08 "merged landing + run bar" sketch (which the owner
> rejected wholesale) and re-frames the arrival question the 2026-08-07 session opened.
> Builds on the verified findings in `docs/HANDOFF-2026-08-08-platform-concept.md` §2 — none of
> them are re-litigated here.
>
> **Status: CONCEPT SETTLED at mock v8 (owner: "other than that it's pretty good — prepare the
> handoff to implement everything"). Implementation handoff:
> `docs/HANDOFF-2026-08-08-concept-v8-implementation.md`. Mock artifact:
> https://claude.ai/code/artifact/6577804a-bc6d-41b2-ad0c-9e5c8cd0fd17**
>
> **v8 revision (final, owner feedback on mock v7):**
> - The skill affordance is a **properly-proportioned pill** next to ⊕ (icon + chevron, roomy
>   padding — the Perplexity reference). Not a bare glyph, not a cramped chip.
> - **A quiet model selector ("SIM-1 Flash ▾") sits left of the send button at all times**
>   (owner call, reversing the earlier only-when-price rule). When a Max-tier skill is armed it
>   carries the credit price.
> - The sub-bar's right half is the **Simulate ›** door, not a score readout.
> - ⚠️ **Concept correction that overrides earlier wording in this doc: generation NEVER
>   auto-simulates.** The sim is fire-on-demand (a card's Simulate action, or the sub-bar door),
>   playing the sealed-verdict beat only when fired. Remix's three angles arrive **unscored**.
>   Only the **nightly drops** arrive pre-scored (the proactive pipe simmed them overnight).
>   Anywhere this doc says a generation is "already scored/simmed", read it under this rule.

---

## 0. The spine

The owner picked three wow moments and they are one mechanic at three moments of a user's life:

> **proven format → adapted into *your* niche → scored by *your* audience**

- **Every return visit** — the mechanic runs *proactively*: you arrive and today's formats are
  already adapted and scored. ("Land and it's done.")
- **Any moment** — you paste a video or tap a proven outlier and it becomes *your* version, with a
  predicted score. ("Paste → your version.")
- **Day 0** — the mechanic *bootstraps* a user with no niche: proven formats adapted into 2–3
  candidate lanes; the scores tell them who to be. ("It finds your lane.")

The audience vote is deliberately **not** the headline. It is the stamp on every card — the
credibility engine, demoted from destination to evidence.

**Consequence:** the product's default output is finished, scored content. Chat is how you steer
it, not how you summon it.

## 0b. The frame (owner call, this session)

**Content-first, chat inside.** Arrival leads with output (the drops); tapping anything opens a
thread where the work happens. The composer is present on arrival but is the second door.

Rejected alternatives: chat-first with a richer empty state (arrival stays input-shaped — the
blank-prompt churn mechanism), and full-app/dashboard (heaviest rebuild, abandons the "ChatGPT for
creators" positioning, and it is the shape that already died once as `/start`).

The positioning survives because the *work surface* still feels like ChatGPT — users just never
meet it empty.

**Design order: mobile-first.** The ICP arrives from TikTok/IG link-in-bio on a phone. Desktop is
the expansion, not the origin.

**Visual bar (owner note):** Claude / Perplexity grade. We do not copy their *empty* start screen
(their users arrive carrying intent; ours arrive asking "what should I make?" — emptiness hands
the hardest problem to the least equipped user). We copy their **restraint**: the arrival page
holds exactly three things — greeting, drops, composer — and nothing else. The existing flat-warm
charcoal system (matte, near-zero accent, serif voice-moments, guarded by tests) already is this
language; no new visual direction.

---

## 1. Arrival — "Today's drops"

- **Six cards** (owner call — six, not three), drawn round-robin across archetypes
  (`rank.ts` — "six examples, six ways to open" — six *different shapes*, never six of the same).
  Single-column scrolling list on mobile (hooks need width; the shelf starts strong rather than
  fitting one screen), 2-col grid on desktop. (Revised at mock v2 — owner wants visual richness.)
- Each card is a proven format **already adapted into the user's lane, already scored**:
  - the adapted hook, in their niche, as the card's headline — serif, reads as content, not chrome
  - **the source video's real thumbnail + real view count** ("▶ 8.1M") — the receipt. Owner call
    at mock v2: the proof must be *visible*, not just cited. Tap the thumb → the original.
  - the verdict stamp ("8/10 stopped") from their calibrated audience
  - **No donor niche, ever** (locked). **No multiplier number until the §2.4 basis question is
    settled** — view count and sim score are the only numbers until then.
  - one action: tap → a thread opens seeded with this card.
- **Freshness:** rotates daily. 211 printable corpus rows ≈ months of daily sixes before repeat.
  The daily-surface cache (`getFreshSurfaceCards` + lazy warm) is exactly this machinery, already
  in the repo — first visit of the day shows warming skeletons.
- **Below the drops:** the composer (§3). Below that: nothing. No skill grid, no stat bands, no
  config furniture. The current `AmbientStartHome` arrival (audience chips + Create/Research skill
  menu) dies entirely.
- The "in progress" row (threads with unfinished work) may appear between drops and composer —
  small, text-only. Not designed yet; mock will propose.

## 2. The thread + where the sim lives

- **The thread stays the chat work surface** (owner call — reversed this session's earlier
  "card-first render" overreach; also consistent with the standing "chat stays the main surface"
  decision). Results render as rich cards inline in the conversation, as today.
- Every result card carries its next moves: **Write the script** (the `adapt.ts` shoot plan),
  **Try 3 angles** (three variants, each simmed), **Who said no?** (opens the Room), plus the
  steer field (the composer itself).
- **The verdict is an event, not furniture.** Sealed-verdict law carries over: score withheld
  while the sim runs, revealed on return — and the reveal plays **on the result card** where the
  user is looking. The audience pill (§3) pulses during flight and settles on reveal.
- **The Room is on-demand depth**, not a persistent panel — a **verdict report in three tabs**
  (v4, restoring the rail's full depth): **Audience** — verdict + ten faces (lit = stopped),
  why-they-stopped / why-they-scrolled with counts, one quote; **Brain** — the predicted-cortex
  heatmap (the existing WebGL brain, relocated) with its heat read in plain language;
  **Engagement** — predicted watch-through curve + signals 0–100 vs the user's own baseline.
  Every tab ends in an action phrased as a fix ("Fix what lost them", "Tighten the bridge") that
  feeds back into the thread as a steer. Bottom sheet mobile / overlay panel desktop; opened
  from any card's meter.
- **The persistent desktop rail (`AmbientOverviewRail`) retires.** Its four jobs relocate:
  verdict → card face · trigger → card actions · depth tabs → the Room · ledger → home's
  in-progress row. `fireSim` and the sim engine are untouched — this is a render-layer change.
- Desktop and mobile share one model. Mobile stops being the squeezed variant; it is the origin.

> **v7 revision (owner feedback on mock v6, same day; reference screenshots of Claude Cowork +
> Perplexity skills):** two corrections.
> - **The room dot-cluster is dead.** The sim + audience live in an **attached sub-bar** on the
>   composer card (the Claude-Cowork "Project · Manual · usage" pattern — and structurally the
>   mobile sim dock the product already ships, refined): one hairline strip under the foot.
>   Left half = avatars + "Your people · TikTok ▾" (tap → the audience sheet). Right half =
>   sim state — "last run 8/10 ›" idle (tap → the report), "watching…" with the breathing dot
>   in flight. Same strip mobile and desktop; desktop can additionally pin the report. The
>   top-bar audience switcher is retired; the top bar returns to nav.
> - **Skills: visible and browsable, never required.** A quiet **skill chip** (icon + ▾) sits in
>   the composer foot next to ⊕ (Perplexity's pattern) and opens the **skills panel**: two-pane —
>   list (grouped Make/Test/Research, workspace-ordered, ADS badges) + preview (visual, name,
>   one-paragraph promise, **Use** button that prefills the composer). Mobile renders the same
>   content as a sheet. **Typing `/` in the field** opens the panel as an inline autocomplete;
>   Enter turns the skill into a dismissible box in the field (the owner's slash-command ask).
>   Auto-routing remains the only *required* path. Discovery doors: chip · slash · More ▸ chip ·
>   first-run tour.
>
> **v6 revision (owner feedback on mock v5, same day):** three corrections.
> - **⊕ is attach only** (media convention wins): paste a link, upload a video/draft.
> - **Nobody selects a skill — auto-routing (already implemented) is the primary path.**
>   Selection survives as: feedback (the result card names what routing chose, and offers the
>   other path if it guessed wrong); inline disambiguation only when genuinely ambiguous (a bare
>   video link → two chips: "Test it with your people" / "Remix it"); and browsing — the catalog
>   opens from a **More ▸** chip and its rows *prefill* the composer, never arm a mode.
> - **The sim gets a permanent door on the composer: "the room"** — a compact cluster of ten
>   tiny dots + the last score in the composer foot, on every screen. Quiet at idle, breathing
>   during a run, settles with the verdict. Tap → the report (Audience surface before any run).
>   This is today's mobile sim dock, refined and unified across platforms; on desktop it is
>   also the thing you pin (§10 of the mock). Distinct jobs: top-bar switcher = choose who;
>   the room = feel them + open the sim.
>
> **v5 revision (owner feedback on mock v4, same day):** the four-mode row is dead — modes were
> categories pretending to be buttons: they spent bar space and still couldn't say what was
> inside them, and advertiser capability made that worse. Replacements:
> - **Composer = three objects** (⊕ · field · send). **⊕ opens the catalog**: attach on top,
>   then every capability as a self-describing job (name + one-line promise) under whisper
>   groups Make · Test · Research. New capability = new row (with an ADS badge where relevant);
>   the bar never changes. Rotating example chips (2–3, contextual) sit under the composer —
>   examples, never a registry. Typed text auto-routes.
> - **The sim lives in three presences:** ambient (meter on every card), contextual (the
>   three-tab report, **pinnable on desktop** — pin docks it for the session, the old rail
>   reborn as a choice), permanent (**the Audience surface**: the ten people with behaviours,
>   the accuracy ledger — predicted vs actual from real reconciliations — and recalibration).
> - **Full scope: creators + social-media marketers + advertisers.** A workspace flavor (set by
>   a role toggle at first run: Creator · Brand · Ads) re-orders the catalog, swaps the chips,
>   and reframes the drops (proven *ad* formats for the offer). A described audience *is* a
>   target segment — same machinery. **A/B compare = Test with two inputs**, verdict names the
>   winner and why, one tap to re-run against another segment. Overnight agent loops
>   (generate → sim → iterate until a bar clears) are a **behavior on existing jobs** ("keep
>   going overnight"), not a surface — later, paid tier.
> - **The remix thread's first turn is the existing skill's real output**: exactly three adapted
>   angles (`adapt.ts`), each scored, staged as a stack with the winner leading. Render change,
>   not pipeline change.
>
> **v3 revision (owner feedback on mock v2, same day):** controls must *look like controls* and
> capability must be visible. Three structural changes, reflected in the sections below and in
> mock v3: (1) **skills collapse into four modes** — Remix · Create · Test · Research — shown as
> a segmented icon group in the composer whose menu (icon + name + one-line description) is the
> complete capability map; old skill names become intents routed *inside* modes, and typed text
> auto-routes. (2) **The audience + platform switcher moves to page level** — a top-bar control
> (avatars + name ▾, platform chip beside it) opening one sheet: audiences with provenance,
> "+ New audience", platform as a segmented control. The composer no longer holds the audience
> pill. (3) **The arrival shelf is remix-forward** — named for what it does ("Tonight's
> remixes · proven videos, rebuilt for your niche"), video-first cards with an explicit Remix
> action. The v2 job-chip row dies (superseded by the mode menu).

## 3. The composer — one object, pure field, one foot row

Same component on home and in thread. **Nothing above the field, ever** (the Claude/Perplexity
anatomy). Foot row, left to right:

```
┌──────────────────────────────────────────────────────────┐
│  Paste a video, or tell me your idea…                    │
│                                                          │
│  ⊕   [◦◦◦ @yourpeople · TikTok ▾]   [✦ Ideas ▾]    SIM-1 Flash   ↑  │
└──────────────────────────────────────────────────────────┘
```

- **⊕** — bring your own: paste a link, drop a draft/video → routes to Test/Remix.
- **The audience pill** — avatar dots + audience name + platform lens, one compact object.
  - Tap the audience half → switcher: calibrated audiences (one per connected account — IG and
    TikTok followers are different people, never merged), custom described audiences, "New
    audience" (connect an account *or* describe them).
  - Tap the lens half → platform picker. **Platform is a run setting, not an audience property**
    (carried from last session): `audiences.platform` is provenance; a run whose lens ≠ provenance
    quietly notes *"calibrated on Instagram"* — extrapolating, never blocking.
  - Changes apply to the **next run only**, never retroactive. `runHeaderBlock` already stamps
    every run with its inputs; the thread renders those stamps so mid-thread switches stay legible.
  - During a run the pill pulses (the held breath); it settles on reveal. Tap → the Room.
- **No permanent skill chip** (revised at mock v2). The armed skill renders as a **dismissible
  tag inside the field** (ChatGPT's pattern) and the placeholder becomes that skill's
  instruction (`PLACEHOLDER_BY_TOOL`, already load-bearing). At rest the bar is as quiet as
  Claude's: ⊕ · audience pill · send. Nothing else.
- **The model flag** — absent while derived from the skill (no choice = no control). When a
  skill genuinely offers Flash vs Max it appears as a control **showing the credit price** — at
  that moment it is a price tag, not a model picker.

**Skill discoverability — the fresh-user answer (revised at mock v2):** a row of **job chips
directly under the composer** — "Test a video · Find outliers · Analyze an account · Script an
idea · Write hooks" — always visible on arrival, horizontally scrollable on mobile (the
ChatGPT starter-pill pattern: teach jobs without a product tour). Tapping one arms the skill
(tag in field + instruction placeholder). This is how a new user learns the product can test a
video, scrape outliers, or tear down an account — capabilities the drops alone would never
surface. Adjacency on result cards remains the in-thread mechanism; the complete registry lives
behind ⊕.

## 4. Day 0 — "It finds your lane"

Principle: **a niche is chosen by reacting to concrete content, never by filling out a form.**
**v3 revision: the audience comes first.** The audience is the product's core asset, so creating
one is the explicit first step after signup.

1. First screen: *"Let's meet the people you're creating for"* — three doors: **Connect TikTok**
   / **Connect Instagram** (calibrates from real followers, ~90s, platform recorded as
   provenance) / **Describe them** (no account needed). The connect path ends in a "Meet your
   people" reveal (avatar cluster + traits) and drops straight into the arrival shelf. The
   describe path adds one conversational question — **"What could you talk about for 20 minutes
   without notes?"** — before the lane picker below.
2. During the existing onboarding wait, the same pipe runs: answer → 2–3 candidate lanes
   (distinct angles, e.g. "the skeptical beginner" / "the numbers person" / "the storyteller") →
   proven formats adapted into each lane → simmed against a preset audience per lane.
3. **The reveal is the shelf**: the §1 drops, grouped — *"Three ways you could show up"* — each
   lane with its best cards and scores. Tapping a card is simultaneously "I like this one" and
   "this is who I am." No moment asks "so, what's your niche?"
4. The lane hardens through use: picks steer tomorrow's drops; connecting a real account later
   swaps the preset audience for a calibrated one. Same product on day 0 and day 300 — the only
   difference is how much the shelf knows.

## 5. What carries over from the 2026-08-08 session (good regardless of frame)

- Platform = run property; `audiences.platform` = provenance; extrapolation is stated, never
  blocked. One platform registry to replace the 18 inline unions + silent `→ "tiktok"` coercion.
- Mid-thread switching: free, next-run-only, never retroactive.
- Model flag rules (above).
- Hard findings that motivate later build work: platform's entire generation footprint is four
  interpolated prompt strings; platform is dropped first under token pressure; the corpus is
  genuinely multi-platform (333 IG / 177 TikTok / 22 YT).

## 6. What dies

- The `AmbientStartHome` arrival (config chips + skill menu as content).
- The persistent desktop sim rail as furniture (jobs relocate per §2).
- The skill grid as arrival content (THE_SIX starter grid included — the drops replace it).
- The 2026-08-08 run-bar-above-the-field idea (violates the nothing-above-the-field anatomy).
- The permanent skill chip in the composer foot (armed state moved into the field as a tag).
- The restored `/start` briefing as a destination: it was a review build; this concept absorbs its
  live pieces (drops ⊃ daily ideas + outliers; loop stays gated-on-receipts, placement TBD in
  mock). The route stays a redirect.

## 7. Honest open questions

1. **Multiplier basis** (handoff §2.4) — blocking for any card that prints a number. Until
   settled, proof chips carry no number.
2. **Platform rulebook is deferred** — on day one the lens changes prompt wording only. Control
   lands before behaviour; the extrapolation flag keeps it honest. Owner has not ruled on
   ship-control-first vs hold.
3. **The sim is platform-blind** (`buildReactionPanel` has no platform) — the verdict does not
   move when the lens changes. Threading platform into the panel is its own build.
4. **Drop economics** — six adapt+sim runs per user per day. Cheapest path in the product (corpus
   rows are pre-decoded), the daily cache bounds it to once/day/audience, but the per-user cost
   and free-tier stance (`BILLING_ENFORCE_QUOTA` is live) need a real number before launch.
5. **Saturation + cadence** (corpus decision doc §4) — shared library risks at scale; "today's
   drops" is a freshness promise that must be sustainable.
6. **Grounded generation has never run** (`GROUNDING_*_ENABLED` off) — flip in sandbox and read
   output before building the drops pipe on top of it.
7. **"Move calendar and your plan"** was executed as *delete* on an unconfirmed reading — if the
   owner meant *relocate*, the working-tree `/start` trim is wrong.
8. **Day-0 lane synthesis** — "answer → 2–3 lanes" needs a real producer (prompt + eval). Not
   specced here.
9. **In-progress row** on arrival — shape TBD in mock.

## 8. Design-system constraints (locked, enforced)

Flat-warm charcoal; matte; text cream, never `#fff`; accent `#FF6363` at near-zero dosage — the
only sanctioned accent on these surfaces is the single live-presence dot in the audience pill.
Primary actions neutral cream. Cards r12, inputs r8, borders `white/[0.06]`. Serif (Newsreader)
for voice moments: the greeting and the drop-card hook lines. `globals.css` is SSOT; the
token-drift guard stays green.

## 9. Next steps

1. **Mocks** (owner call): premium HTML mockup, real tokens, mobile-first frames — arrival,
   drop card anatomy, thread + verdict beat, composer states, Room, day-0 reveal. Reviewed via
   artifact link.
2. Owner review → iterate.
3. Then `superpowers:writing-plans` for the implementation plan. No implementation before mock
   approval.
