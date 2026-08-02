# HANDOFF — Skill cards, LIVE-renderer refinement (the sketch track is dead)

**Branch:** `lane/skill-cards-cleanup` · **Worktree:** `~/virtuna-slot-a` · **Dev port:** 3001
**Tip:** `f03aa3c4` (pushed) · **Base:** `origin/main` @ `96ccff5b`
**Status:** three commits, **owner-reviewed and approved 2026-08-02**. Not merged.
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

## 5. What is NOT done — the next session's menu

1. **Merge decision.** Nothing blocks it; it needs the throwaway deletion above and the owner's go.
   Merge = deploy.
2. **`SIM-1 Flash` provenance tags on the MEASURED cards** (brought / Simulate / Read / Predict).
   Real provenance, so it was left alone — but it is the same jargon the Make faces just shed.
   Three tests pin the string (`brought-card-block`, `reaction-distribution-block` ×2).
3. **Read (`multi-audience-read`) + Predict (`prediction-gauge`) polish** — both still carry the
   label/density debt the Make cards just lost: uppercase section headers, a boxed "Assumptions"
   panel, `text-2xl` band word as a hero (Predict), nested bordered drills. Recommended as its own
   pass, not folded into a merge.
4. **The `reaction_frame` engine follow-up** (from the old lane) stays deferred; nothing here needs it.

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
git rev-parse HEAD                      # expect 06849fec (or later)
npm run dev -- --port 3001              # reaped after ~10 min idle
open http://localhost:3001/zz-preview   # all 9 cards, width toggle 728/342
open zz-shots/index.html                # the approved before/after
```
Verify with: `npx tsc --noEmit` · `npx vitest run src/components/thread` · `npm run build` (the gate).
Commit style: `type(cards): …`, atomic, stage by NAME (never `git add -A` — untracked throwaways live
in the tree). Auto-push hook is on.
