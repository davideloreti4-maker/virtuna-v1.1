# Handoff — 2026-08-12: the day-0 meter dies, and the rail rows say what the sim reads

> **Session of 2026-08-12, worktree `~/virtuna-platform-concept`, branch `lane/platform-concept`.**
> Everything below is on the lane branch. **Nothing is deployed** — Vercel git is disconnected
> because the owner is switching accounts. That is deliberate; do not "fix" it.
>
> **Precedence.** `docs/HANDOFF-2026-08-11-v8-rail-restored.md` remains the ruling record for the
> v8 *shape*. This doc is the ruling record for everything below and outranks the 2026-08-11 pair
> on the day-0 lane card, the rail's resting rows, and the arrival copy it touched.

---

## 1. Owner ruling 1 — the day-0 pre-score meter is DEAD

Doc 1 §2.1 asked for a read of `lane-reveal.tsx` before ruling. The read said: once the meter goes
the card is a thumb, a view count and a hook, over an empty foot — because `mt-auto` on the meter
row was the only thing holding the bottom of a 96px box.

**Ruled: kill it, and the foot takes the outlier receipt.**

### What the read turned up, and why the ruling was easy

1. **The meter was the ONLY consumer of the batched Flash.** `pickLane` reads `shelf.lane.niche`
   and nothing else; `personas` existed on the lane card for the meter and for no other purpose.
   So this was never "remove a number" — it was "remove the billed call".
2. **Removing it makes the reveal strictly more robust.** A Flash failure used to `return []`,
   collapsing the *whole* reveal to its empty state and dumping the user on the describe-yourself
   door — after already paying the embedding and up to three adapt calls. And a partial failure
   silently deleted individual lanes (a lane whose row got no sim result dropped itself). Both
   failure modes are gone.
3. **The replacement was free and already ruled.** `v8/drop-shelf.tsx` solved this exact problem
   when drops went unscored: its foot carries `N× their usual views`. `buildLaneDrops` already
   holds the corpus row carrying `outlier_multiplier` + `baseline_label`, and
   `selectDailyDrops → isDropReady` guarantees `> 3×` non-null on every pick. **Zero extra calls.**

### What changed

- `lane-drops.ts` — Flash batch deleted. The `creator_profiles` read went with it (it existed
  solely to build the Flash panel), so the signature is now **`buildLaneDrops(lanes, deps)`** —
  no supabase client, no userId, because there is no user-scoped read left. `flashBatch` is off
  `BuildLaneDropsDeps`. Cards now carry `multiplier` + `baselineLabel`, never `personas`.
- `lane-reveal.tsx` — meter out, receipt in, plus the three r5b rulings this file never received:
  radius `rounded-2xl`(16) → `rounded-lg`(12) · hook `font-serif` → Inter on the `title` role ·
  mono dropped from the card's numbers.
- **`LiveDropCard.personas` is GONE from the type**, replaced by a comment saying why. Nothing
  read it any more. Cached rows may still carry the key on disk; nothing looks.
- **The caption was a truth bug the moment the meter died.** It read `pre-tested · pick the one
  that sounds like you` — a word earned by the Flash score. Now `proven videos · …`, which is true
  of the source. ⚠️ Other `pre-tested` strings in the app are on surfaces that DO carry a real sim
  (calendar, /start ideas); they are fine. This one was the odd one out.

**Verified in-browser** on a fixture at the real 400px onboarding width, 1440×900 and 393×852:
radius 12px · hook Inter 16/500 · receipt Inter · **0 meter dots, no `/10` in the DOM** · card 96px
min-height honoured, 113px on a 3-line hook · no h-scroll at either width.

---

## 2. Owner ruling 2 — the rail's resting rows

Owner: *"whats the best way to showcase the audience accurate to the algorithm and that it gives
value to users"* and *"these labels just sound weird, algorithm feeder is saying nothing"*.

### The finding — the board was showing the two fields the algorithm does not use

Traced through `buildReactionPanel`. The Flash sim receives exactly `panel = {niche, contentType}`
and `audienceRepaint = Record<archetype, repaint>`. Therefore:

| field | reaches the model? | evidence |
|---|---|---|
| `label` ("The Passive Dopamine Hit") | **never** | `archetype-names.ts`: "THIS NEVER REACHES THE MODEL" (F7) |
| `share` (12%) | **never** | `select-persona-targets.ts:50`: "`persona_weights` — not `personas[].share` — is the PREDICTION dial… the question is not 'who decides the verdict', it is 'who is a big chunk of my audience'". `selectPersonaSlots(contentType, nicheSlug)` takes no audience at all. |
| `repaint` | **yes — it is the whole brief** | `buildAudienceRepaint` |

The resting board printed `label` + `share` and hid `repaint`. So *accurate to the algorithm* and
*valuable to the creator* turned out to be the same change: the string the model is briefed with is
also the only one a creator can act on. "Dismisses low-effort posts immediately" is writable
against; "The Skeptical Scroller — 8%" is not.

⚠️ **`display_name` is NULL on every persona row** (verified by SQL against the live audience). An
earlier read in this session claimed calibration writes `display_name` and that it wins — wrong.
The rendered field is `label`. Do not repeat that diagnosis.

### What changed

- **Row names come from the CURATED table**, `archetypeDisplayName()` — Commenters · Quiet Watchers
  · Sharers · Deep Fans · Passers-by · Regulars · Purposeful Viewers · Savers · Tough Crowd ·
  Scouts. That table exists precisely because "the machine's name for a person, shown to the
  person's creator" is wrong, and its docblock reserves `label` for a name a **creator** set — which
  a scraped audience's generated label never was.
  ⚠️ **Scoped to the resting board only.** `AudienceMeta.segments[].label` is untouched, so
  Simulate's segment picker and the persona edit form are unchanged. A test locks that scoping.
- **Each row carries its `repaint`, VERBATIM.** Do not reword it for display — the moment it is
  prettified it stops being the thing the model was given, which is the entire argument for showing
  it. A segment with no stored frame prints none rather than a plausible invention.
- `AudienceMeta.segments[]` and `RoomSegment` both gained `repaint: string`.

### ⚠️ The board SCROLLS at 900px, and that is the ruling

Measured: ten rows at 76px overrun the 825px scroll region by **~155px**, so the last row, the rest
line and the ＋ door are one scroll down on the desktop arrival. The alternative — clamping each
frame to one line — fits exactly (rows 62px, zero overflow, door visible) **and truncates every row
precisely where its payload is**: `"dismisses low-…"`. Owner ruled full text.

**Do not "fix" this with a line-clamp.** Row padding is `py-[10px]` rather than the board's usual
13 for the same reason — it buys 60px of the overrun back at no cost to the text.

⚠️ **An earlier estimate in this session said it would fit (181px free, ~170px needed). That was
wrong** — it assumed one line per repaint; they wrap to two at 400px, so rows went 48 → 86px.
Measure `getBoundingClientRect` on the real strings; never project a wrap count.

---

## 3. Owner ruling 3 — arrival copy

| slot | was | is |
|---|---|---|
| rail header | `1,000 minds · calibrated · reads on TikTok` | `1,000 viewers · calibrated · simulating for TikTok` |
| rail rest line | `Nothing simulated yet. Results land here, ranked.` | `Nothing simulated yet. Send anything you make to the room and their verdict lands here.` |
| ＋ door | `Test something of your own` | `Show them your own work` |
| greeting | `Good afternoon, E2E.` | **unchanged** (ruled: r5d built it as the Claude/ChatGPT-style welcome deliberately) |
| shelf caption | `Proven videos, rebuilt for your niche` | **unchanged** (ruled in r5) |

Two things worth keeping:

- **"ranked" came out because generations don't get ranked.** Ranking is a comparison *across*
  sealed runs — one send produces a verdict, not a rank — and nothing is sent automatically: the
  creator makes something in the thread, then chooses to put it in front of the room. Copy that
  implies writing fires a sim is wrong here.
- **The door's ruled wording did not fit.** `"Put your own work in front of them"` wraps to two
  lines in a 400px rail and collides with the `a draft, a video, or a link` hint. Keep the label
  ≤ ~24 characters.

---

## 4. Answered — the mobile arrival's composer (doc 1 §2.2)

**Reproduced:** field at y=1130 in an 852px viewport, `scrollY` 0. The scroller is `<main>`
(`canScroll: 408`) — **not** the body and **not** `composer-thread-region` (which measures
`canScroll: 0`). It IS reachable: one full scroll and the dock sits clear with 86px under it.

**Verdict: the fold is defensible, but two adjacent facts are not.**

The fold is structural, not accidental — the dock is in normal flow, the single-column shelf is
875px, and pinning the composer would put the chat frame back on top of the surface the shelf work
exists to lead with. On desktop the 2-col shelf makes it moot.

1. **DEFECT — the sixth drop card's action is permanently unreachable.** At `scrollTop ===
   maxScroll`: last card bottom **644**, dock top **616** → **28px of overlap**, and the card's
   receipt + Remix sit under the chips row with no scroll left. `composer-thread-region` reserves
   `pb-[184px]`; the arrival's dock (chips + audience plate + field + foot) measures **220px**.
   The reserve is short by ~36px. ⚠️ Fixing it touches the region shared with every chat thread.
   **Not fixed this session — no ruling was asked for.**
2. **CORRECTION to doc 1 §4.** That closed "the mobile arrival states the audience nowhere" as
   FALSE because `audience-header-slot` is mounted at 45px. It is mounted — **at y=1077**, i.e.
   off-screen on the first screen. The closure was right about existence and never measured
   position. The phone's first screen carries: hamburger, brand mark, greeting, one caption, four
   cards. Nothing naming the audience, and nothing to type into. Open question, owner's call.

---

## 5. Traps this session paid for

1. **A wrap count is not a measurement.** "It fits" was computed from one line per string; the real
   strings wrap to two at 400px and the board overran by 155px. Measure the rendered box.
2. **`display_name` was a red herring** — null on every row; `label` is what renders. Query the data
   before diagnosing from the write path.
3. **The mobile scroller is `<main>`, not the body and not `composer-thread-region`.** A probe that
   only walks `div`s finds nothing and reports the surface as unscrollable. Walk `*`.
4. **A throwaway fixture under `src/app/` is a REAL ROUTE.** `src/app/zz-lane/page.tsx` was created
   to render `LaneReveal` at its true 400px width without a billed onboarding run — worth doing, but
   it ships if you forget it. Deleted; verify `git status` before committing.
5. All the 2026-08-11 traps still hold: `NEXT_PUBLIC_CONCEPT_V8` is not in `.env.local` · the
   arrival is a **cookie** state (`maven_active_thread=__new__`) · no named helpers inside
   `page.evaluate()` · the drops route is a real POST, wait ≥6s · the launchd reaper kills idle dev
   servers (it fired three times this session) · `npm run build` clobbers a running dev server's
   `.next`.

---

## 6. Gates

`tsc --noEmit` clean · `npm run build` clean · vitest run **twice**, identical both times:
**5803 passed / 1 failed** = the `routing-cut` baseline from the two protected uncommitted `/start`
files. **Zero flakes in either run.**

## 7. State of the tree

**Nothing is committed.** Working tree carries the changes above plus, as always:

- `src/app/(app)/start/page.tsx` and `src/components/surfaces/start-page.tsx` — **NEVER COMMIT.**
  The sole cause of the 1 baseline failure.
- `scripts/zz-{mint-cookie,shot,measure,devpage,mobile}.ts` — untracked throwaways.
  **Explicit `git add` paths only. Never `git add -A`.**
- `.githooks/post-commit` **AUTO-PUSHES**. Gates before commit, always.

## 8. Still open

- The mobile dock's 36px under-reserve (§4.1) — a real defect, needs a ruling because the fix
  touches the shared thread region.
- Whether the phone's first screen should name the audience (§4.2).
- Phases 4 and 6 stay **SKIPPED**. Audit the live product before building any mock section.
- The repaint prose is analyst third person ("Consumes content passively"). Improving it means
  changing the generator prompt in `enrich-signature.ts`, which changes what the model receives and
  needs recalibration of existing audiences. Separate job, not a display fix.
