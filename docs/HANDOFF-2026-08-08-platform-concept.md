# Handoff — platform concept refinement (lane/platform-concept)

> **Opened 2026-08-08.** Worktree `~/virtuna-platform-concept`, branch `lane/platform-concept`,
> forked from `origin/main` @ `1be28832`.
> **Source:** a long strategy + product-shape session on 2026-08-07/08. This document is the SSOT
> for what was decided, what was *measured*, and what is still open. The owner starts the next
> session here with their own direction.
>
> **One line:** the product concept is settled enough to build; the work is the arrival state, the
> thread's render treatment, the audience presence, and one new pipe — everything else already
> exists.

---

## 0. Read this first — what this session actually produced

The durable output is **not** the design sketch. It is:

1. A set of **owner decisions** (§1) about what the product is and who it's for.
2. A set of **verified code and data findings** (§2) — several of which contradict the docs, and
   every one of which was checked against the repo or the database, not assumed.
3. A short list of **things the owner still owes a call on** (§4).

⚠️ `docs/mockups/maven-product-shape-2026-08-07.html` is carried over for reference only.
**The owner reviewed it and rejected it — "we won't use anything from it."** Do not build from it,
do not cite it as a target. It is kept solely because a few of its captions record findings that
are written up properly in §2 anyway. Treat §2 as the truth.

---

## 1. Decisions (owner, this session)

**Positioning / ICP**
- ICP is the **solo short-form creator**, acquired through TikTok/IG organic + link-in-bio. Not
  agencies, not advertisers — but lay foundations that don't preclude them later.
- Maven is positioned as **"the ChatGPT for social media creators."** Instantly understood,
  therefore cheap to market. Accepted with its attendant risk: it invites *"why not just use
  ChatGPT?"*, so the differentiator (proven formats + an audience that votes) has to be visible on
  the first screen, not discovered in session three.

**The core surface**
- **Chat stays the main surface.** Everything is built around it and users arrive already knowing
  how it works. This reverses an earlier suggestion in the session to demote it.
- The arrival state is what changes. **The thread must never be blank on arrival** — that is the
  one non-negotiable that survived from the discarded shape.
- The audience should be **more present, not less** — but through *behaviour*, not real estate.
  A static panel is furniture; a strip that reacts is alive. Concept not finalised.

**Evidence layer** — full rationale in `docs/DECISION-outlier-corpus-2026-08-07.md`
- Outliers are a **curated, shared, structural** library — not a per-user niche scrape. Quality
  over volume.
- **Seeded from the existing 532-row corpus** (`public.outlier_teardowns`), which is already
  human-curated and classified.
- **Domain is never shown to the user.** No "proven in 4 domains", no donor niche, anywhere.
  Naming the donor domain manufactures an objection the user didn't have. Transfer is machinery;
  machinery stays under the floor.
- On-demand scrape (`/api/discover`, `/api/tools/explore`) survives as a **power feature**, not the
  front door.

---

## 2. Verified findings — checked, not assumed

Each of these was confirmed against the repo or the live database this session.

### 2.1 🔴 The Flash SIM is platform-blind

`buildReactionPanel(profileRow, audience)` (`src/lib/engine/flash/build-reaction-panel.ts`) builds
`panel: NichePanel = { niche, contentType }`. **No platform.** `runFlashTextMode(text, framing,
panel, audienceRepaint)` takes `framing ∈ "hook"|"idea"|"chat"` — also no platform.

Platform *does* reach generation (`skill-dispatch.ts` → `ctx.platform`, typed
`"tiktok"|"instagram"|"youtube"`), so prompts differ — but **the stop/scroll verdict is identical
whichever platform the user picked, including TikTok→TikTok.**

This is not a cross-platform mismatch bug. It is a missing dimension in every case.

### 2.2 🔴 `audiences.platform` is `NOT NULL` — platform is a hard schema binding

Confirmed against the live schema. `source_account_id` exists (nullable), so the account→audience
link is already built.

**Intended model:** *who they are is portable, how they behave is not.* Audience = a portable
identity model. Platform = a **behaviour lens** applied at simulation time (hook window, sound-on
assumption, scroll velocity, what counts as a stop).

**Proposed change, needs no migration:** reinterpret the column as **provenance**
(`calibrated_from`) rather than constraint, thread platform into `buildReactionPanel()` as a
session-level lens, keep **one audience per connected account** (do not merge IG and TikTok
followers — genuinely different people), and let the lens vary per creation session.

### 2.3 The corpus, measured (`public.outlier_teardowns`, 2026-08-07)

| Measure | Value |
|---|---|
| Rows total | 532 |
| Carry an `outlier_multiplier` | 396 — **136 have none** |
| Clear 3× | 288 |
| **Printable band (3×–50×)** | **211**, avg 14.7×, covering **all 13 archetypes** |
| Absurd tail | 46 at 50–200×, 31 above 200×, **max 20,154×** |
| Have `why_it_works` + `template` | 524 of 532 |

**211 printable rows supports a weekly feed comfortably** — six per week is ~35 weeks before a
repeat, before rotation, personalisation, or adding a row. **Cap the printable band at 50×**; a
"20,154×" badge reads as broken.

Archetype distribution is lopsided: `personal-experience` 164 rows (72 proven), `tutorial` 62 (33),
`question` 50 (28), then a tail down to `trap-mistake` 12 (7).

### 2.4 🔴 The multiplier's basis contradicts the docs

- **`follower_count` is NULL on all 532 rows** → `views ÷ followers` cannot be computed from this
  table at all.
- **`baseline_label` is only ever `"vs their usual views"` or NULL — never `"vs followers"`.**

`docs/HANDOFF-2026-07-14-sandcastles-grounding-corpus.md` records **decision F** as owner-confirmed:
the score is `views ÷ followers`, "hence `baseline_label = 'vs followers'`". The data disagrees.
**Until this is settled, any surface printing a corpus multiplier prints the wrong basis.**
Needs an owner call, not a guess.

### 2.5 Grounded generation has never actually run

`GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED` were off as of the corpus session-2 handoff, which states
plainly that *not one grounded generation has ever been run*. That handoff's own lesson: the corpus
was 12% reachable and its three richest fields never reached the model, with every test green
throughout. **Flip the flags in the sandbox and render the output before building on it** —
`scripts/preview-grounding-slices.ts "<ask>" tiktok --debug`.

### 2.6 The generation chain already exists, and does more than the docs say

- `src/lib/engine/remix/decode.ts` → 4 beats + `repeatable[]` + `luck[]`; **D-01 makes it a
  compile-time error** for `luck` to reach adapt.
- `src/lib/engine/remix/adapt.ts` → **exactly 3 concepts** (`ADAPT-01`, a Zod `.length(3)` — not
  5, not configurable), each carrying `personaStops` (a projection, explicitly not a measurement)
  **and a `production` field that is a ready-to-film shoot plan.**
- Then the Flash SIM gate for the real verdict.

**A corpus row is already decoded**, so "adapt this one" skips `resolveAndRehost` (Apify) → Omni
perception → decode entirely. That makes it the *cheapest* path in the product (adapt + sim), not
the most expensive — a remix run today is 10 credits. This is what makes a free pre-signup wow
economically survivable.

### 2.7 `rank.ts` already implements the selection rule

`src/lib/grounding/rank.ts` selects **round-robin across archetypes**, not top-N by similarity —
its own comment: *"six examples, six ways to open."* Topic is a tiebreaker, not a gate. Proven
exemplars rank first within an archetype. All 13 archetypes survive into the printable band, so it
still yields six distinct shapes.

### 2.8 The rail is four jobs, not chrome

`AmbientOverviewRail` (mounted in the composer at ≥xl, behind `AMBIENT_V2_ENABLED`; legacy
`AudiencePresence` is still the default) holds: the projected-card ledger, the "Simulate →"
trigger, the sealed-verdict display, and the depth drill (Audience/Brain/Engagement/Terrain).

Its **sealed-verdict law** — withhold the verdict while a run is in flight, reveal on return —
already exists and is the anticipation mechanic any "the room votes" moment needs. `fireSim` is
load-bearing and must survive whatever replaces the rail's UI.

### 2.9 🟢 The old dashboard is intact — and was never fairly judged

`src/components/surfaces/start-page.tsx` + all 17 sections in `sections/` are **in the repo,
unreferenced**. `/start` redirects to `/home`.

Pre-cut render order: `FirstRun · Greeting · GreetingRings · DailyIdeas · OutcomeCapture ·
Outliers · TheLoop · RecalibrationNudge · MonthCalendar · TodaysPlan · QuickActions · RoomDrawer`
(+ `StatRow`/`StatRowEmpty`).

| Section | Data |
|---|---|
| `StatRow` | **real** — L7D Followers/New followers/Likes/Posts (+Views), sparkline + delta from `account_snapshots` via `buildAccountStats`; honest empty state |
| `Outliers` | **real** — competitor videos *simmed against the user's audience*, Remixable into a thread; lazy sim on first visit/day, warming skeleton, honest empty state |
| `TheLoop` | **real** since 2026-07-06 — predicted-vs-actual receipts + aggregate match % |
| `DailyIdeas`, `TodaysPlan`, `MonthCalendar` | real (`month-plan.ts`) |
| `QuickActions` | static product copy — 4 doorways phrased as **jobs, not skill names** |
| `ContentPillars` | ⚠️ share bar is **MOCK** — per-pillar derivation never wired |

**The history that matters.** PR #310 (`3692c130`, 2026-07-15) did four things in one chain:
1. hid Calendar/Discover/Library → 2. **dropped Outliers, MonthCalendar and TodaysPlan** from the
briefing → 3. made the briefing the default authed landing → 4. killed it, verdict *"stats
duplicate /audience, the loop is empty for new users, quick-actions echo the composer."*

Step 2 preceded step 3. **The version that got previewed and rejected had already lost its three
most differentiated sections.** What remains after that removal is stats, an empty loop and quick
actions — precisely the complaint. The full dashboard was never actually judged.

**Restore size:** `3692c130` touched two files, `-327 / +89`. The sections were never deleted, only
the wiring and the route's server fetches.

### 2.10 Skill discoverability

If skills leave the front door, capability becomes invisible — a real risk the owner raised.
A 13-skill menu is a poor fix: a skill list is a list of **verbs**, and users think in **jobs**.

Two mechanisms, both cheap:
- **Adjacency (primary)** — every result already carries its next moves ("5 more like this", "turn
  into a script", "who said no?", the steer field). Users learn the graph by walking it.
- **`QuickActions` as the map** — because adjacency never surfaces "Test a real video" to someone
  who has only made hooks. Already written, already phrased as jobs.

---

## 3. What NOT to do

- **Do not build from the rejected sketch.** §2 is the truth; the HTML is reference only.
- **Do not reinstate `StatRow` uncritically** — "stats duplicate `/audience`" was true then and is
  still true. The rest of the removal post-mortem no longer holds (see §2.9).
- **Do not print a corpus multiplier** until §2.4 is settled.
- **Do not build the Board on a live per-user scrape** — that is the decision in §1, and Apify runs
  on rotating free accounts with a hard monthly cap where a cap-out masquerades as "check your
  handle is public."
- **Do not fire type-as-you-go reactions per keystroke** — a room reaction is priced at 1 credit.
  Debounce on pause.
- **Do not collapse WARRANT and CLAIM** back into one filter (corpus decision E): a curated row
  grounds generation because a human picked it; only a row clearing the bar may be *called* proven.
- **Do not show curated teardown prose verbatim** (corpus decision C) — cite the real public video.

---

## 4. Open — owner owes a call

1. **What is the multiplier measured against?** (§2.4) Blocking for anything that prints a number.
2. **How much of the old dashboard comes back**, given it was never fairly judged (§2.9).
3. **The audience presence concept** — "more present, through behaviour" is agreed in principle;
   the form is not.
4. **Does the decode survive cross-domain adaptation?** Never tested. Cheapest possible check:
   take ~20 corpus rows, adapt each into 3 unrelated domains, read the output. The entire evidence
   thesis rests on this and nobody has looked.
5. **Feasibility signal** — `adapt.ts` emits a shoot plan, but nothing scores whether *this*
   creator can execute it. Ranking should be predicted-stop × can-they-make-it.

---

## 5. Worktree setup

```
~/virtuna-platform-concept      branch lane/platform-concept, forked from origin/main @ 1be28832
```

- `.env.local` copied from trunk (**not** shared between worktrees).
- `npm install` run at setup.
- **One dev server per port** — check `lsof -ti:3000`, pass `--port 300X`.
- ⚠️ `git worktree remove` deletes gitignored files including `.env.local` — copy it out first.
- Gates before any push: `tsc --noEmit`, `npm run build`, tests. A green Vercel check is **not** a
  build (`ignoreCommand` can skip and still post success). Merging deploys to production (~4 min).
- `main` moves while you work — `git fetch` and re-measure `git rev-list --count HEAD..origin/main`
  before opening a PR.

**Untracked in this worktree** (carried from trunk, not yet committed anywhere):
`docs/DECISION-outlier-corpus-2026-08-07.md`, `docs/mockups/maven-product-shape-2026-08-07.html`,
and this file. Commit them on the lane branch when the owner is ready.
