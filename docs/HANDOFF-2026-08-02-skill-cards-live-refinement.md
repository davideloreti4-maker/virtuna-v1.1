# HANDOFF — Skill cards, LIVE-renderer refinement (the sketch track is dead)

**Branch:** `lane/skill-cards-cleanup` · **Worktree:** `~/virtuna-slot-a` · **Dev port:** 3001
**Tip:** `c0278044` + this doc commit (pushed) · **Base:** `origin/main` @ `96ccff5b`
**Status:** twelve commits across two owner-review rounds (2026-08-02). Not merged.
**NEXT WORK: §H — the header contract.** The owner flagged non-uniform card headers and asked
for a fresh-context session to implement it. §H is the decided spec; do not re-litigate it, but
show the two flagged duplication trades in the preview before committing them.
⚠️ **Merging to `main` IS deploying** (no preview URLs, prod builds ~3s after merge). Verify first.

---

## 0. The pivot that defines this lane

The owner rejected the **entire v1–v9.4 sketch track** ("I'm not happy with the results we got from
all the sketches"). The instruction is now: **refine what is actually on the platform, do not build
more mockups.** The v9.x genealogy stays archived on `task/skill-cards-rework` (tip `96ebe456`,
pushed) as history — do not resume it, do not re-propose its treatments.

The rejected-treatment list in memory (`skill-cards-hierarchy-not-deletion`) still binds: no
uppercase micro-label chrome, no text-only "document" columns, no portrait-media-beside-text.

## 1. What shipped

| Commit | What |
|---|---|
| `1d6633cb` | **`sim-door.tsx`** — the four Make faces drop the projected verdict apparatus |
| `333bc6f0` | video **Test** card — label diet, glyph diet, de-boxed "why", seam paragraph removed |
| `f03aa3c4` | the door becomes an **audience band**; the two empty bands are rebuilt |
| `dcd567fd` | foot diet (band + action bar `py-3`→`py-2.5`) + the hook hero on one baseline |
| `3d84332d` | idea: the amber YOUR-TAKE pill folds into the Take cell as a dot; `·` replaces the em dash |
| `ac016d45` | script: receipt below the timeline, per-beat filming cue onto the caret, "Copy" |
| `bfcc7a44` | remix: flat source attribution; map pairs sized by **CARD width** (`@container`) |
| `131230b1` | video-test ledger splits on card width, not viewport |
| `84a89509` | brought + read + wall: jargon shed (`SIM-1 Flash`→`Simulated · N reactions`), tier badge onto the verdict row, the redundant reactions accordion DELETED, "The room" header gone |
| `54ec7236` | the audience band leads with **Made for** (locked §7.6 wording; guard re-pinned) |
| `52ad551e` | remix source strip → the family's full-width bordered tone-zone |
| `c0278044` | disclosure rows say what they hold: `Seed line & delivery` (hidden when empty) · `Opening line` · `How the original is built` |

### 1.1 The core change — why the 8/10 had to go

Since the 2026-07-22 call system, a card with `provenance: 'projected'` carries a band, a fraction
and a quote that are **the writer's generation-time estimate — no persona SIM ran.** The face wore
a scoreboard for a game never played, hedged only by a `· projected` tag on the disclosure row, and
the actual room entry was buried inside that stats box.

`SimDoor` replaces it on hook / idea / script / remix. **`proof-unit.tsx` is untouched** — Simulate
and the brought card still render it over REAL measured reactions (it is also shared with the ＋door
dial; see `proof-unit-is-shared-do-not-edit`).

### 1.2 The audience band — what the left side says, in order of what we know

1. **MEASURED** (legacy card, no `provenance`) → the room's real fraction leads:
   `● Strong  8/10 stopped · opener only`, plus the aimed-at persona's own verdict when a panel
   returned one (`· Time Poor Creator stopped`). Right: avatars + `See your audience →`.
2. **UNTESTED + `target`** → `Time Poor Creator · 34% of your audience`. Right:
   `Simulate with your audience →`.
3. **UNTESTED, no target** (General / uncalibrated) → `Not tested yet`. Never a share nobody computed.
4. **Remix** has no bound persona, so its descriptive `whoItsFor` rides the slot: `For …`.

**Why the persona is honest to show:** the run binds each unit to ONE persona from the calibrated
audience through a *structural output contract* (`runners/target-assignment.ts` — the model must name
the assignee back), not through prompt context. That mechanism is measured: blind judge 60% vs a
13.3% control. `share` is that persona's real slice. Only the reaction half (`verdict`/`quote`) is
null on the generation path, and the band stays silent about it. This retired `TargetReaction`
(deleted) and its bordered "Written for" line.

### 1.3 The two empty bands (owner-flagged with screenshots)

- **Head:** the `#1 … Copy` strip was near-empty chrome. Both are meta *about* the hook, so they now
  ride the hero's own row — rank in the left gutter, Copy pinned right. One row, not two.
- **Foot:** was three loose half-empty lines (disclosure / door / actions). The disclosure moved up
  to sit with the content it discloses; the audience band is its own hairline zone. Foot now reads
  **audience → actions.**

### 1.4 Restored by owner direction

The hook's **Visual box** is back (bordered `VISUAL · technique` + on-screen line). The shot is a
SECOND deliverable and the container is what separates it from the spoken line. Do not re-de-box it.

## 2. Traps this lane already paid for

- **A 342px card lives inside a viewport of any width**, so `sm:`/media queries cannot see the
  constraint that matters. Truncating the band ate the share (`Time Poor Creato…`) — the one number
  it exists to show. It now **wraps** (`flex-wrap` + `ml-auto` on the door). Same hazard still lives
  in remix's map (`sm:grid-cols-2`) — untouched, but know it is there.
- **`proof-unit.tsx` is shared** — change CALLERS, never it.
- The idea card's door must fire `conceptText={title}` alone (not `title\n\nangle`) or the room
  lookup silently no-ops. Guarded by a test.
- Measured cards keep their numbers. Replacing a real run result with "Not tested yet" would fake in
  the opposite direction.

## 3. Verification (all green at `f03aa3c4`)

`npx tsc --noEmit` clean · `npx vitest run src/components/thread` **360 pass** · adjacent suites
(`audience-lens`, `reading`, `app`) 638 pass · **`npm run build` compiled successfully** — the prod
build is the gate, not tsc.

Rewritten guards: `make-card-value-fields.test.tsx` (door semantics + a new audience-band suite:
shows the share, never claims a reaction, honest fallback, remix free-text) and
`idea-card-block.test.tsx`. Untouched and still green: `proof-unit-open-room`, `radius-scale`,
`section-label-scale`, `card-surface-consistency`, `no-source-note`, `ambient-card-anchors`,
`video-test-card-simulate-door`.

## 4. The preview harness (kept on disk, UNTRACKED — delete before any merge)

- `src/app/zz-preview/page.tsx` — all nine thread cards mounted with fixtures, outside the `(app)`
  group so no auth is needed. `?w=342` presets the width toggle.
- `scripts/zz-shoot.js` — Playwright, screenshots every card at 728 + 342 into a folder.
- `zz-shots/before/`, `zz-shots/after/`, `zz-shots/index.html` — the owner's before/after review page.

```bash
npm run dev -- --port 3001            # ⚠️ a launchd reaper kills it after ~10 min idle
node scripts/zz-shoot.js zz-shots/after
open zz-shots/index.html
```
Playwright notes that matter here: `waitUntil:'domcontentloaded'` (networkidle never settles),
`animations:'disabled'`, and hide `nextjs-portal` or the dev badge lands inside the bottom card.

**Before merging:** `rm -rf src/app/zz-preview scripts/zz-shoot.js zz-shots public/zz-v94-cards.html`.

## H. THE HEADER CONTRACT — the next session's build (owner-flagged 2026-08-02, round 3)

The owner's screenshots: the hook's head (`#1 · serif line · Copy`) beside the idea's (a bare
serif title) — *"headers are not uniform across all cards."* Today the five actively-generating
cards open five different ways: hook = gutter+serif+Copy · idea = bare serif · script = an
uppercase meta strip · remix = the source zone (its own serif deliverable is buried mid-map) ·
video-test = an uppercase label strip + tier pill.

The fix is a PRIMITIVE, not five hand-rolled rows — that is exactly how the feet stopped
drifting (`CardActionBar`) and it is how the heads stop.

**1. Add `CardHero` to `card-primitives.tsx`.** One row inside the card's `px-4 pt-4` face:
`flex items-baseline gap-3` — optional left gutter meta (`text-label font-semibold tabular-nums
text-foreground-muted`), the serif hero (`font-serif text-heading font-medium leading-[1.3]
tracking-[-0.005em] text-foreground`, `min-w-0 flex-1`), optional right affordance.

**2. Extract `CopyAffordance` into `card-primitives.tsx`** — the copy button is hand-rolled
three times (hook, script header, remix map cell): icon 13 + `text-label font-medium
text-foreground-muted`, flips to `Check + Copied` for 1600ms, clipboard guarded for happy-dom.

**3. Refit the five:**

| Card | gutter | serif hero | right |
|---|---|---|---|
| Hook | `#N` | `hookLine` | Copy (the line) — **unchanged; this row IS the reference** |
| Idea | — | `title` | — (an idea is a brief, not a line you lift; empty right slot is sanctioned) |
| Script | — | opener (`openingBeatSeed ?? beats[0].content`) | Copy (the whole beat sheet) |
| Remix | — | `adaptedHook` | Copy (the adapted hook) |
| Video test | *exception* | — | — |

Video-test is the one card with no authored line to hero — a serif label would be fabricated
voice. It keeps its eyebrow row (`Test · frame-by-frame read` + TrustBadge) but aligned to the
same `px-4 pt-4` head geometry. If the owner pushes for full uniformity in review, the candidate
hero is the score itself — raise it in the preview, don't pre-build it.

**4. The two duplication trades — show BOTH to the owner in the preview before committing:**
- **Script:** the meta strip (`5 beats · Talking-head · Creator growth`) demotes to a quiet
  `text-label` line under the hero; Copy rides the hero row. The opener then appears twice
  (hero + the HOOK beat). Accepted by design for now — the beat row carries timing + filming
  context the hero doesn't — but it is exactly the kind of repeat the owner has flagged before.
  Fallback if rejected: the HOOK beat keeps its rail row but shows only label/timing/caret.
- **Remix:** `adaptedHook` moves OUT of the map into the hero (serif + Copy at top, source zone
  second). Map row 1 loses its right cell — render "Their hook" as a full-width single cell so
  the deliverable is not printed twice. Map reads: Their hook (full) / Their turn → Your angle /
  Their format → Your shots. The `text-subhead` serif in the map cell goes with it.

**5. Guards that will trip (update the PIN, keep the semantic):** `make-card-value-fields`
(remix map "Your hook" cell + serif assertions), `script-card` tests (the head strip + Copy
aria), anything querying the remix Copy by its map position. Same drill as the `Made for`
re-pin in `54ec7236` — read the guard's premise first, then re-pin to the new shape.

## 5. What is NOT done — the next session's menu

1. **§H — the header contract.** The owner's directed next build. Everything above it is shipped.
2. **Merge decision.** Nothing blocks it; it needs the throwaway deletion above and the owner's go.
   Merge = deploy.
3. ~~SIM-1 Flash tags~~ **DONE on the active cards** (`84a89509`): brought + read say
   `Simulated · N reactions`. `reaction-distribution` + `prediction-gauge` still carry the tag
   **deliberately** — both are HORIZONTAL verbs behind `HORIZONTAL_ENABLED=false`
   (`src/lib/flags/horizontal.ts`), render only in old persisted threads, and are OUT OF SCOPE:
   the owner scoped the lane to the skills actually generating (start grid: Ideas · Hooks ·
   Script · Remix · Video test; ＋door brought + Read are live surfaces too).
4. ~~Read polish~~ **DONE** (`84a89509`). **Predict stays untouched** — inactive (see above).
5. **The `reaction_frame` engine follow-up** (from the old lane) stays deferred; nothing here needs it.

---

## 6. Card inventory — every renderer that draws in the thread

Registry: `src/components/thread/message-blocks.tsx` maps `BlockType` → renderer. Schemas live in
`src/lib/tools/blocks.ts` (+ `profile-blocks.ts` for the profile/test family). All paths below are
`src/components/thread/`.

| Card | File | Touched this lane | State / what is still open |
|---|---|---|---|
| Hook | `hook-card-block.tsx` | ✅ | Face: hero row (rank·hook·Copy) · Visual box · target-less · receipt · Why it works · disclosure. Then audience band → actions. |
| Idea | `idea-card-block.tsx` | ✅ | Face: title + `your take` · angle+fit · Why it lands · Topic/Take/Format cells · receipt · disclosure → band → actions. Cells still carry 3 uppercase labels — deliberate (they name the formula). |
| Script | `script-card-block.tsx` | ✅ | Header (beats·format·topic + Copy) · receipt · beat timeline · How to film → band → actions. **Per-beat `filming` cue and the foot "How to film" block overlap** — candidate for a merge pass. |
| Remix | `remix-card-block.tsx` | ✅ | Source strip · decode→adapt map · disclosure · How to film → band (carries `whoItsFor`) → actions. ⚠️ map uses `sm:grid-cols-2` — a viewport query on a card-width problem. |
| Video Test | `video-test-card-block.tsx` | ✅ | Craft ring + drivers · filmstrip · working/not-working · director's fixes · "Simulate with your audience →". Already had its door. |
| Brought (＋door) | `brought-card-block.tsx` | ❌ | MEASURED — real `aggregateFlash` numbers, keeps `ProofUnit`. Still prints `SIM-1 Flash · N reactors`. |
| Read | `multi-audience-read-block.tsx` (+ `verbatim-wall.tsx`) | ❌ | MEASURED. Carries the label/density debt: uppercase headers, nested bordered drill, `· SIM-1 Flash` in the footer. **Top polish candidate.** |
| Simulate | `reaction-distribution-block.tsx` | ❌ | MEASURED and the ONE card with real per-persona reactions — keeps `ProofUnit` (correctly). Person vs panel branches. |
| Predict | `prediction-gauge-block.tsx` | ❌ | MEASURED. `text-2xl` band word as hero, boxed Assumptions panel, feathered gauge (deliberate, F-01/F-02 — do not turn it into a pointer). |
| Explore grid | `outlier-grid-block.tsx` → `SkillResultCard` | ❌ | Wraps `DiscoverGrid`; chrome lives in `discover/`. |
| Account read | `account-read-block.tsx` | ❌ | Own accordion system (`reading/`). Large, separate idiom. |
| Corpus refs | `corpus-references-block.tsx` | ❌ | Reuses `ProofReceipt` (which this lane de-boxed `NoSourceNote` in). |
| Shared | `proof-unit.tsx` ⛔ · `proof-receipt.tsx` · `card-primitives.tsx` · `sim-door.tsx` · `band-block.tsx` | partly | ⛔ = shared with Simulate + ＋door dial, never edit; change callers. `target-reaction.tsx` was DELETED this lane. |

## 7. Decisions locked this session (owner's words in quotes)

1. *"we'll just move forward by refining whats currently being used"* — the sketch track is over.
2. *"the one out of ten ranking section on all the cards needs to be replaced with something else,
   which leads the users to the simulation"* — the origin of `SimDoor`.
3. *"add the visual hook box back in"* — the de-boxing was wrong; the box stays.
4. *"find something else for made for / written for that delivers real user value and shows the user
   audience proof"* — became the audience band (persona + real share), not a deletion.
5. Two owner screenshots flagged the near-empty head strip and the three-loose-lines foot. Both
   rebuilt; the rule that came out of it: **a band must earn its height with something true.**
6. Wording that stands: `Simulate with your audience →` · `See your audience →` · `Not tested yet` ·
   "Made for" never "Written for"/"Built for" · no em dashes · room→audience.

## 8. Kickoff for the fresh session

```bash
cd ~/virtuna-slot-a && git switch lane/skill-cards-cleanup
git rev-parse HEAD                      # expect c0278044 or later (the §H doc commit)
npm run dev -- --port 3001              # reaped after ~10 min idle
open http://localhost:3001/zz-preview   # all 9 cards, width toggle 728/342
node scripts/zz-shoot.js zz-shots/<dir> # screenshot all cards at 728 + 342, then VIEW them
```
Verify with: `npx tsc --noEmit` · `npx vitest run src/components/thread` · `npm run build` (the gate).
Commit style: `type(cards): …`, atomic, stage by NAME (never `git add -A` — untracked throwaways live
in the tree). Auto-push hook is on.
