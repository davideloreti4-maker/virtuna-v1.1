# Handoff — /audience, after P1–P3 + the rollup + the platform guard

**Updated:** 2026-07-14 (session 3) · **Worktree:** `~/virtuna-explore-b`
**Spec:** `docs/SPEC-2026-07-13-audience-redesign.md` — ⚠️ **its P2 divergence design is WRONG.** See §4.
**Shipped:** P1 (#280) · mode seam (#281) · archetype binding (#282) · progress+receipts (#284)
· the Read rollup (#286) · the calibrate platform guard (#289) · the divergence panel (#294)
· **the dead route-test layer + the dropped `grounded` prop (#298)**
· **PER-PERSONA HOOK GENERATION (#299) — the audience now steers the WRITING, measured**
· the 10 personas' human names (#302).

> ⚠️ **This document lied to its last reader once already.** Everything in it is code- or
> live-verified. **If you add a claim here, say how you verified it.** "I read the code" is not
> verification in this subsystem — **six times now**, the code read fine and the live run was broken.
>
> **The two rules are equal partners, and session 3 needed both:**
> 1. **RUN IT FOR REAL.** Caught #299's binding bug — the model returned `"[lurker]"` with brackets,
>    every target silently dropped, 3,600 tests green.
> 2. **MEASURE YOUR INSTRUMENT.** The per-persona result (60%) is only meaningful because a CONTROL
>    arm scored 13.3% — *below* chance. Without it, 60% is a number with no scale.

---

## 0 · START HERE — the one rule that matters

**NOTHING IS DONE UNTIL IT HAS BEEN RUN ONCE AGAINST REAL DATA.** Not a mocked test. A real call, a
real row, eyes on the output.

The base rate is not a figure of speech: **every single feature in this subsystem that was run
against reality for the first time was broken.** Four for four. tsc, eslint and 3,400 unit tests
caught **none** of them. One live run caught **each** of them, usually in under two minutes.

---

## 1 · The pattern that has now produced FOUR bugs — read this first

**The one input that makes the feature the feature, dropped in silence, with every test green.**

> ### 🔴 THE RULE THIS DOCUMENT GOT WRONG — the touchpoint list is **FIVE**, not four
>
> #287 taught that a new card prop has four touchpoints (schema → runner → parse → `toBlocks`).
> **That list is missing the route.** Found 2026-07-14 (#298): the SSE `content` event hand-builds
> its props field-by-field in the route, and it **omitted `grounded`** — so #287's own no-source
> note could only ever appear *after a reload*, never on the live stream. The line directly above
> it fixes the identical bug for `proof`, with a comment saying so. Fixed once; reintroduced one
> field later.
>
> ```
> schema → runner → ROUTE SSE EMIT → stream parse → toBlocks
>                   ^^^^^^^^^^^^^^ the one everybody forgets
> ```
>
> **And the reason nobody caught it: the route test layer had been DEAD for months.** Every
> `/api/tools/*` route opens with `maybeMockSkillRun()` → `await cookies()`, which throws outside a
> Next request scope, and no test file anywhere mocked `next/headers`. The throw fired before any
> route body ran. On `main` @ `ea61c970`: **`src/app/api/tools` = 15 passed / 73 failed**; full suite
> **3548 passed / 72 failed**. That includes the **7/8 explore failures §4b logged as unexplained** —
> 7 failures, 7 `cookies` errors, one line. Fixed in #298 (now 88/88, full suite 3639/0).
>
> ⚠️ **THE GATE COMMAND IN §7 WAS PART OF THE PROBLEM** — it runs `src/lib/tools` but **not**
> `src/app/api/tools`. The route layer was outside the gate *and* untested. §7 is now corrected.

- **#281** — the Read never steered. A `niche: null` fall-through silently discarded the persona
  repaint, and the weights were computed then thrown away (`void resolved`). Every Read compared
  General to General and relabelled one side. **10/10 identical verdicts**, live.
- **#282** — `archetype` is the engine's **binding key**. A slug outside the fixed 10 matched no slot
  in any niche, so its repaint reached the model *never*. One prod row had **45% of its own declared
  share** dead.
- **#284** — the SSE progress copy named the wrong phase for **126 of 128 seconds**, and
  `isPersonaGrounded` had zero callers.
- **#289** — **`platform` reached nothing that scrapes.** Picking *Instagram* in the new-audience form
  ran a **TikTok** scrape: `scrapeBundle(handle, limit)` is `clockworks/tiktok-profile-scraper` and
  takes no platform. `platform` was written onto the audience row, the connected account, and its
  snapshot — and passed to the scraper never. Live: `@zachking` + `platform:"instagram"` → **HTTP 200
  in 75s**, 10 personas, and a snapshot of **86.1M followers / 610 posts / 1.3B hearts — TikTok's
  numbers exactly** (his real IG is 30.7M, and Instagram has no "hearts" metric at all).
  **And a handle is NOT one identity across platforms** — so the real failure was building a
  *stranger's* audience and presenting it as the user's own. Now refused in 1s, honestly.

**When auditing this subsystem, ask of every input: does it actually reach the model / the scraper /
the prompt, and what happens if it doesn't?** Grep for silent fall-throughs (`?? stock`,
`if (!x) return DEFAULT`) and for parameters that are destructured, stored, and never passed on.

---

## 2 · ✅ THE MOAT WORKS — proven live, 2026-07-14

Before this date **no audience in prod had ever been scrape-calibrated.** Every signature had
`videos_analyzed: 0` and an empty provenance handle; no row had `calibration.source = 'scrape'`. The
whole pipeline was built, unit-tested with mocked I/O, and **never once run against reality.**

One real calibration (`POST /api/audiences/calibrate`, handle `zachking`, real Apify + DashScope):

| | |
|---|---|
| **128.8s**, HTTP 200 | `calibration.source = "scrape"` — the first in the database |
| provenance | `handle: zachking · videos_analyzed: 12 · videos_watched: 5 · sub_coverage: 8/12` |
| **the omni video-watch works** | the fragile part (Apify KV mp4 + `?token=` + SSRF allowlist) |
| **10/10 personas carry REAL evidence** | *"Massive view counts (8M–45M) dwarfing active engagement metrics."* |
| repaints are account-specific | *"Skeptical of the 'magic,' looking for glitches to debunk the illusion."* |

Cost ≈ $0.05–0.15 + one Apify scrape. **The Qwen client reads `DASHSCOPE_API_KEY`** (not
`QWEN_API_KEY` — that one is absent and unused). Row: `6b1114e6-…` ("Zach King").

---

## 3 · The facts the design rests on (corrected)

| | |
|---|---|
| **F1** | `persona_weights` {fyp, niche, loyalist, cross_niche} Σ=1.0 is the prediction dial (`resolve-audience-weights.ts:63`). `personas[].share` is NOT. |
| **F3** | The engine emits **bands, never scores** — `Strong\|Mixed\|Weak`. The block schema is `.strict()` and rejects a smuggled 0-100 (`blocks.ts:49`). **Never design a numeric score.** |
| **F5** | Audience is pinned **per thread** (`threads.active_audience_id`). `last_audience_id` only *seeds* new threads. |
| **F7** | `personas[].repaint` reaches the SIM. `label` never does. **`archetype` is the BINDING KEY** — outside the 10-slug `ARCHETYPES` enum it binds to nothing (#282). |
| **F10** | ~~"No runner branches on `mode`."~~ **WAS ALWAYS WRONG** — `predict` always did. The seam is now CLOSED (#281): a `mode:general` audience reads **single**, gets a general reaction frame, and socials-only skills refuse it server-side (400). Cross-mode pairs → 400. |

---

## 4 · What's next, in the order I'd do it

### P2 — make the workspace alive  ← **the ROLLUP (the data half) is SHIPPED. UI is what's left.**

**Shipped (ROLLUP-01):** `GET /api/audiences/[id]/rollup` + `src/lib/audience/read-rollup.ts`.
Returns per-persona latest reactions (verdict + quote) and audience-vs-other divergence, bands only.
Live-verified 2026-07-14 against real Flash runs on the scrape-calibrated **Zach King** audience.

Three things the build had to fix before the rollup could exist at all — each verified in the DB:

- **The block carried no audience id.** Entries had `name` only, so a rollup could only have keyed on
  a *user-editable display string* — silently re-attributing history on rename, and inheriting a
  deleted audience's Reads to a new one of the same name. Added `audienceId` (optional, additive) per
  entry; `"general"` is the sentinel, so **both sides of a compare are attributable**.
- **The concept was persisted NOWHERE.** The Read route writes only the assistant block and (unlike
  `/api/tools/chat`) never a user turn. A panel keyed on "the two verdicts per concept" had no
  concept. Added `concept` to `props` (run-level, beside `model`/`tier` — the per-audience entry is
  `.strict()`).
- **⚠️ THE BODY IS NOT AN ARRAY.** `insertMessage` writes `{kcGenVersion, blocks:[…]}` whenever a KC
  stamp is passed — which every tools route does. **All 7 Read blocks in prod are in the wrapper
  shape; ZERO are bare arrays.** So `body @> '[{"type":"multi-audience-read"}]'` matches **nothing**
  and looks exactly like "this user has never run a Read." Unwrap both shapes.

**🔴 The finding that changes the P2 spec — A MATCHING BAND IS NOT AGREEMENT.**
The spec's divergence metric (compare the two bands) **under-reports, and would have shipped a panel
that lies.** The band aggregates 10 persona verdicts, so **offsetting flips cancel out.** The very
first live Read proved it: Zach King and General **both landed Strong at 7/10** — while disagreeing
about *who* stopped (`niche_deep_buyer` stopped for Zach, scrolled for General; `tough_crowd` did the
reverse). Band-only says *"agreed."* Across the 2 live Reads: **band-diverged 0/2, persona-diverged
1/2.** So the rollup returns BOTH: `diverged` (the aggregate moved) and **`personaDiverged` + per-case
`personaFlips`** (your people wanted something different) — pair by **archetype**, never by array
index (the two Flash runs carry no ordering guarantee). **Build the panel on `personaFlips`.**

**Legacy rows are EXCLUDED, not name-matched.** The 7 pre-existing blocks (all `e2e-test@`, all
2026-07-13) carry no id — and they all predate #281, when both sides ran the identical prompt, so
4 of their 5 two-sided rows "agree" *as an artifact of the bug*. Folding them in would render a bug
as a finding. The rollup reports them as `legacyUnattributed` (live: 7) and never guesses.

**✅ SHIPPED — the UI (`audience-reads.tsx`), and the MEASUREMENT that had to come first.**

Before writing a line of UI, the question in step 2 below got answered, because a boring panel and a
lying panel are both worth knowing about *before* you build one. `scripts/measure-divergence.ts` ran
**10 concepts × 2 independent pairs** against the scrape-calibrated Zach King row (real DashScope,
real audience). Both numbers matter:

| | |
|---|---|
| **bands moved** | **1/10 Reads** |
| **personas diverged** | **8/10 Reads** — and all 8 **reproduced** on an independent re-run |
| noise floor | **0.2 flips/Read** — the same audience compared against *itself* |
| treatment | **1.5 flips/Read** · **80% of them survive a re-run** |

**Divergence is real signal, not sampler jitter — and the spec's band-based design would have been a
disaster.** It would have told the user *"your audience agrees with the generic crowd"* on **nine
Reads out of ten**, while their people were plainly disagreeing underneath. The panel is therefore
built on **`personaFlips`**, and `diverged` (the band count) is never the headline.

⚠️ **RUN THE NOISE ARM IF YOU EVER RE-MEASURE.** `runFlashTextMode` sets `temperature:0` + a pinned
seed — but that is a *request*, not a guarantee, and my FIRST pass (3 control concepts) hit an
outlier that put the noise floor at 1.3 flips/Read, which made real signal look like pure jitter.
The paired 10-concept design corrected it to 0.2. **A noise estimate off a tiny control arm will
tell you whatever it wants to.**

The three live states are verified in the browser, not just in tests: **populated** (5 Reads on the
e2e user), **empty** (`reads: 0` — the main state), and **custom** (`mode: general` → nothing to
compare against). The tag on each case reads `verdict moved` / **`same verdict, different people`** /
`agreed` — the middle one is the case the band panel hides, and a mutation test locks it (regress the
tag to band-only logic and exactly that test goes red).

### P4 — 🔴 DO NOT "dissolve the account tab" as specced. It cannot work.

**The spec says: fold the account numbers into the audience as provenance, drop the tab. That is
impossible, and the #289 bug is what proves it.**

**An Instagram/YouTube account can have analytics but CANNOT have an audience.** Calibration is
TikTok-only (#289 — the scrape stack takes no platform, and the IG/YT actors return a profile with
**no videos**, which enrichment requires). So an IG account has **no audience to fold into**. Dissolve
the tab and every non-TikTok account loses its only home — along with **Connect** itself.

**Verified live, 2026-07-14 — multi-account WORKS (first time ever run):**
`POST /api/connected-accounts/connect {platform:"instagram", handle:"zachking"}` → **200 in 11.2s**,
real IG data (`cdninstagram.com` avatar), snapshot **30.7M followers · 1,306 posts · heart_count 0**
— *nothing like* TikTok's 86.1M/610/1.3B. The connect route and the refresh cron **do** branch per
platform, correctly (`scrapeInstagramProfile` / `scrapeYouTubeChannel`). The `/audience?tab=account`
switcher appears with 2 accounts, `?account=<id>` switches the panel, and **the "Likes" tile
disappears for Instagram** rather than fabricating a zero. This path is honest and it works.

**The shape of the data (live-verified):**
- `connected_accounts` — unique per (user × platform × handle), `is_primary`. **Multi-account is real.**
- `audiences.source_account_id` → set **only** when `type === 'personal'` && platform ≠ custom && the
  scrape returned a profile (`calibrate/route.ts:163`). **Scraping a competitor (`target`) never
  creates a connected account** — verified: Fitness Creators / Marcus Reyes / Maya all have `null`.
- **One account backs MANY audiences (N:1, not 1:1)** — `zachking/tiktok` already backs *two*
  ("Zach King" + "test"). ⚠️ This kills the tempting idea "the personal audience IS the account page":
  there is no single audience to be it.

**What P4 should actually be:**
- **"What to do next" + Content pillars → `/start`.** They are *actions*; they don't belong on a
  numbers page. (This part of the spec was always right.)
- **The account view SHRINKS to a roster, it does not die.** It is the home for Connect, and for
  accounts that cannot have people (IG/YT).
- The follower/post counts **also** ride as provenance on the TikTok audience built from them.
  Duplication is fine — provenance in one place, inventory in the other.

**🔴 OWNER DECISION, and it gates this whole ticket:** *is a connected account allowed to back more
than one personal audience?* If **no** → enforce it, and the account collapses into its (single)
audience for TikTok. If **yes** → the account stays first-class forever. Today the schema says yes
and the data already has a case.

### 🎯 The ledger of what's been settled

1. ~~**P2's UI**~~ — ✅ **SHIPPED** (§4). Built on `personaFlips`; empty state designed first; three
   live states browser-verified.
2. ~~**Sanity-check that divergence is INTERESTING**~~ — ✅ **ANSWERED, and it is** (§4): 8/10 Reads
   diverge persona-wise, 80% reproducible, against a 0.2 flips/Read noise floor. **Calibration moves
   the verdict — but it moves it under the band, which is why the band never saw it.**
3. ~~**Does the calibrated audience steer anything OTHER than the Read?**~~ — ✅ **MEASURED. See §4c.
   NO for generation-as-context, YES for ranking — and now YES for generation-as-ASSIGNMENT (#299).**
4. ~~**Per-persona generation**~~ — ✅ **SHIPPED + MEASURED (#299).** 60% vs a 13.3% control. See §4c.

### 🎯 What I'd do next, in order (written 2026-07-14, session 3)

1. ~~**The archetype display names**~~ — ✅ **SHIPPED (#302).** SSOT `src/lib/audience/archetype-names.ts`:
   Quiet Watchers · Savers · Commenters · Sharers · Tough Crowd · Purposeful Viewers · Deep Fans ·
   Scouts · Regulars · Passers-by. Typed `Record<Archetype,string>` — a new engine archetype without
   a name is a **type error**, not a card that shouts a slug. ⚠️ It also fixed a flaw #299 shipped:
   the label was SNAPSHOTTED onto the block, so improving the names would have left old cards reading
   "NICHE DEEP BUYER" forever. Now only a CREATOR-SET name is persisted (that's history); ours is
   resolved at RENDER (that's vocabulary) — so future naming improvements are retroactive.

2. **▶ START HERE — fan the assignment out to `ideas` and `script`.** They share the exact runner shape, the same
   `overrides` seam, and the same 5-touchpoint prop path — and `select-hook-targets.ts` is already
   generic. The measurement harness generalises with a one-line change of pipeline.
   ⚠️ **Re-run `scripts/measure-hook-targeting.ts` per skill.** A script is not a hook; do not
   assume the effect transfers because it worked here. **Measure it.**
3. **Settle whether the effect survives OFF-niche topics + a fresh audience.** #299's n=6 were all
   on-niche Zach King (best case), and one topic scored *below chance*. Before the product copy
   claims anything, run the harness on a second calibrated audience and on off-niche asks.
4. **A judge from a different model family.** #299's judge is the same family as the writer. The
   control rules out phantom-matching, not self-preference. This is the cheapest remaining hole.
5. **P4, reframed** (§4) — and only after the owner answers the N:1 question.
6. **Keep live-firing.** The paths never run for real are where the bugs are. Known-unrun: the
   **audience-drift cron** (calls `calibrateFromScrape`; prod crons are dead for a missing
   `SUPABASE_SERVICE_ROLE_KEY`), and **grounding with the flag ON** (#298 fixed a prop it needs).

---

## 4c · 🔴 THE AUDIENCE DOES NOT STEER *GENERATION* — only the RANKING (measured 2026-07-14)

**The moat on hooks / ideas / script is SELECTION, not WRITING. And the obvious fix is a proven dead
end — do not retry it blind.**

**Setup:** 20 runs through the REAL route (10 pinned to calibrated *Zach King*, 10 to General), the ask
held constant, compared two independent ways — hook-line embeddings + permutation test, and a **blind
LLM judge** *told exactly who Zach's audience is* and asked to classify each hook set.

| | embeddings (within-arm − cross-arm) | blind judge (chance = 50%) |
|---|---|---|
| **BEFORE** — repaints reach only the SIM | +0.0007, **p = 0.27** | 11/20 = **55%**, p = 0.41 |
| **AFTER** — all 10 repaints fed to the WRITER | +0.0003, **p = 0.43** | 9/20 = **45%**, p = 0.75 |

Both methods, both arms: **indistinguishable from chance.** The fix (fold the persona repaints into
`overrides`) was **REVERTED** — ~900 tokens on every calibrated run for a measured effect of zero.

⚠️ **THE STEP THAT MAKES THIS A FINDING AND NOT A GUESS: I dumped the real prompt before believing the
null.** All 10 personas + repaints **were present**; General stayed byte-identical (307 chars, no leak).
The data reaches the writer — **the writer ignores it.** Note the calibrated prompt ALREADY carried the
creator's writing voice + niche: **2,267 chars vs General's 307.** A 7× richer, deeply creator-specific
prompt still produced hooks nobody can tell apart.

**What IS steered (proven):** the RANKING + the SIM verdicts — the same Flash path measured at 8/10
persona divergence (§4). So the honest description of these surfaces is *"generate generic candidates →
rank them for your people."* A legitimate architecture — but **not** "we write bespoke content for your
audience." Don't let the copy imply the latter.

**⛔ DEAD END:** *"just put more audience text in the generation prompt."* Measured. Null. Reverted.
**▶ THE DIRECTION THE EVIDENCE SUPPORTS: make the audience EXPLICIT IN THE OUTPUT** — generate
per-persona ("the hook for your skeptics" / "for your frame-by-frame savers") instead of hoping an
implicit steer leaks through a prompt. It *structurally guarantees* the differentiation, and it SHOWS the
user the audience model is doing something. Untried; the harness to test it already exists.

**Caveats, honestly:** one topic, n=10 per arm, the judge's CI is wide. But two differently-shaped
methods agree and the prompt was verified to contain the data.

### ✅ 4c-RESOLVED — PER-PERSONA GENERATION WORKS (measured 2026-07-14, PR #299)

The direction §4c pointed at was built and **measured against a control arm.** It works.

| arm | blind judge matches hook → persona |
|---|---|
| chance (1 of 5) | 20.0% |
| **CONTROL** — hooks written for nobody | **13.3%** (4/30) ← the instrument's phantom rate |
| **TREATMENT** — hooks written per-persona | **60.0%** (18/30); two topics matched **5/5** |

**The control landing BELOW chance is the load-bearing number** — the judge is not finding phantom
structure in hooks where none was put, so 60% is signal and not an instrument that flatters whatever
you feed it. (Rule 2, applied: a win from one blunt look is no more a finding than a null is.)

**What changed vs the §4c dead end:** the persona stopped being ambient CONTEXT the writer could
ignore and became a **structural ASSIGNMENT carried by the output contract** — hook N is written for
person N, and the model must echo `targetArchetype` back. Differentiation is guaranteed by the schema
instead of prayed for. **Do not** re-read this as "so more audience text does work after all." It
does not. The contract is the mechanism.

Harness: **`scripts/measure-hook-targeting.ts`** (committed — re-run it before trusting any change here).

**Caveats, stated:** n=6 topics, all on-niche (best case); **one topic scored 1/5 — BELOW chance**, so
the effect is large but NOT uniform; the 5 matches within a topic are dependent (forced 1:1
permutation); and **the judge is the same model family as the writer** — the control rules out generic
phantom-matching but NOT same-model self-preference. A human rater would settle that.

**🔴 THE BUG THE LIVE RUN CAUGHT — the 6th of the §1 shape, and the sharpest yet.**
The assignment list renders each person as `1. [lurker] …` and the contract said *"use the exact
bracketed slug"* — so the model returned `"targetArchetype": "[lurker]"`, **brackets and all**. The
assignment map is keyed on the bare slug, every lookup missed, and **every card silently lost its
target line.** The writer had complied *perfectly* (its own reasoning cited "the lurker", "the
loyalist", "the niche buyer" by name) — **the BINDING broke, not the generation.** tsc, eslint and
3,600 tests were green; the feature was **100% dead on the only path a user watches.**

⚠️ **The generalisable lesson: an exact-match lookup on free-form model output is a silent-failure
machine.** Brackets, quotes, case and spacing must never decide whether a value binds
(`normalizeTargetArchetype` absorbs them). What must STILL fail loudly is a value we never assigned —
a writer that ignores its brief yields a card with **no target line**, never a generic hook wearing a
personalised label.

**⚠️ OPEN DESIGN CALL (owner):** the scraped audience carries no creator-set labels, so the card falls
back to archetype-derived names and the eyebrow reads **"FOR YOUR CROSS NICHE CURIOSITY"** —
engineering vocabulary leaking to users. Honest, but not good. Needs a human display-name map for the
10 archetypes, or calibration prompted to name them. **Product-voice call — names deliberately NOT
invented.**

⚠️ **METHOD LESSON — it cost me a wrong conclusion twice in one day.** I first called this null from the
embedding metric alone. That metric was **topic-dominated**: two runs of the SAME condition scored only
0.91 similar, because every hook about one topic lands in the same corner of the vector space. **A null
from ONE blunt metric is not a finding.** It became one only when a second, differently-shaped method
agreed *and* the prompt dump proved the input had arrived. (Same shape as the divergence noise floor in
§4: a 3-concept control arm gave a 6× wrong answer. **Measure your instrument before you trust it.**)

## 4b · State I left behind (so you don't chase ghosts)

- **The e2e test user now has TWO connected accounts** — `zachking/tiktok` (primary) and
  `zachking/instagram`. The IG one I created deliberately: it is **real, correct data** and the only
  multi-account fixture in the DB. **Keep it** — it's what makes the switcher testable.
- **Two real Reads** exist on that user (waterfall concept + "5 morning habits"), correctly
  id-attributed. They are what the rollup returns today.
- **Deleted:** the fabricated `Zach King (IG)` audience + its connected account + snapshot, created by
  the pre-#289 IG calibration (TikTok data labelled Instagram). Gone; don't look for them.
- ~~⚠️ **`src/app/api/tools/explore` — 7 of 8 tests FAIL on `main`**~~ — **SOLVED 2026-07-14 (#298).**
  Not mysterious and not specific to explore: **7 failures, 7 `cookies` errors.** Every `/api/tools/*`
  route opens with `maybeMockSkillRun()` → `await cookies()`, which throws outside a Next request
  scope, and nothing mocked `next/headers`. The whole tools route-test surface was dead
  (**73 failing**). One line in `src/test/setup.ts` fixed all of them.
- ⚠️ **Running two vitest scopes concurrently produces phantom failures** (call-count assertions in
  hooks/script/steer runners go red under load). If you see 5 mystery failures, re-run serially before
  believing them. I did; they vanished across 3 consecutive clean runs.

---

## 5 · Open questions — 2 of 3 are now ANSWERED

1. ~~**The general-mode control**~~ — **ANSWERED (owner, 2026-07-13):** a custom audience is compared
   against **nothing** — it reads single. A real general-mode control needs an authored general panel,
   which belongs to the **General pack** (`packs/index.ts` still throws on any id but `"socials"`).
2. ~~**`SignatureProvenance` in prod**~~ — **ANSWERED (live, 2026-07-14): YES, fully populated.**
   `videos_analyzed: 12`, `videos_watched: 5`, `scraped_at`, `sub_coverage: 8/12`. The source line
   renders them correctly. See §2.
3. ~~**Persona `evidence` — "no audience in live data carries it"**~~ — **THAT WAS FALSE.** Every
   signature carries it (3/3, 4/4, 4/4 on the authored rows; **10/10 on the scraped one**). The
   authored rows' "evidence" is conversational quotes; **the scraped row's is genuine
   engagement-ratio proof.** It is now RENDERED per-persona in the workspace (#284), and shown *only*
   when a scrape actually earned it — a described audience shows none and claims none.

**Still genuinely open:** the 10-slot Flash schema means a 6-persona audience repaints 6 slots and
inherits 4 neutral ones. Collapsing the panel to only the audience's real personas = the General pack.

---

## 6 · Traps (every one of these cost real time)

- **A grep that excludes the obvious place is not evidence.** I "proved" `getPersonaRoster` was dead
  code by grepping every file *except its own* — it has **5 callers** there. Deleting it would have
  broken the module. **Verify a claim before acting on it, especially a claim about deleting.**
- **A test that asserts presence is not a test.** The old route test asserted
  `statusEvents.length >= 2` — which the **broken ordering satisfied happily**. Ask whether your test
  would still pass if the things happened in the wrong order, or described the wrong thing.
- **Test the shape the CALLER actually sends.** #281 shipped a guard on a branch that never fires,
  because its unit test used a shape the route never sends (the route always passes a 2-element
  array). `persona-edit-form` PATCHes the **full** personas array — one bad sibling fails the payload.
- **`bg-cream` is NOT a token.** It compiles to `rgba(0,0,0,0)`. Probe with
  `getComputedStyle(el).backgroundColor` before trusting any colour class you didn't grep for.
- **A `signature` does not prove a scrape.** The authored customs (Marcus Reyes, Maya) carry one with
  an **empty provenance handle**. The **handle** is the evidence.
- **Persona `temperature`/`disposition` are USER-EDITABLE** (`persona-edit-form.tsx`) — a value that
  differs from `TEMPERATURE_DISPOSITION` may be deliberate, not drift. Only realign them when the
  **archetype itself** was wrong.
- **Never `npm test` / `npx vitest`** — a shim prints fake results. Use
  `node ./node_modules/vitest/vitest.mjs run <path>`.

---

## 7 · Run & verify

```bash
NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3007
```
**Auth:** `npx tsx e2e/create-test-user.ts` → `/login` with `e2e-test@virtuna.local` /
`e2e-test-password-2026`. **Routes:** `/audience` · `/audience/[id]`.

**Screenshots hang** (ambient animations never settle) — inject before capturing:
```js
const s=document.createElement('style');
s.textContent=`*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}`;
document.head.appendChild(s);
```

**Green gates before any commit:**
```bash
npx tsc --noEmit                                   # 0
npx eslint <changed files>                         # 0 errors

# ⚠️ CORRECTED 2026-07-14 — the old gate ran `src/lib/tools` but NOT `src/app/api/tools`.
# The ROUTE layer was outside the gate AND its tests were dead (73 failing, see §1), which is
# exactly how the route's hand-built SSE `content` map silently dropped a card prop and stayed
# green. The route is where props go to die. GATE IT.
node ./node_modules/vitest/vitest.mjs run src/lib/audience src/components/audience \
  src/app/api/audiences src/app/api/tools src/lib/engine/flash src/lib/tools

# Better still, when a change touches a shared file (e.g. src/test/setup.ts) — run EVERYTHING:
node ./node_modules/vitest/vitest.mjs run          # 3639 passed / 0 failed @ a97609cd
```
**Run the suites SERIALLY.** Two vitest scopes at once → phantom failures (see §4b).

⚠️ **Before chasing ANY failure, confirm it against the base commit** — `git stash` and re-run. That
one habit saved this session twice: 5 "failures" were concurrency phantoms, and 7 explore-route
failures turned out to be pre-existing on `main`. The old note here — *"the pre-existing failures pass
in isolation"* — **is false** for the explore ones; they fail in isolation too.

---

## 8 · Design mockups (throwaway, kept for reference)

`docs/audit-2026-07-13/mockup-audience-v3.html` — the agreed concept (index + workspace).
Serve with: `python3 -m http.server 8099` inside `docs/audit-2026-07-13/`.
