# Handoff — 2026-08-11 owner refinement round 2: the rail comes back

> **Written 2026-08-11, after the owner's second live preview of v8 (flag-on, localhost).**
> This round REVERSES the 2026-08-09 "NO RAIL" ruling and the 2026-08-10 "composer room card"
> ruling. Both of those were v8's attempts to replace the shipped audience-sim surface; the
> owner has now rejected all of them and put the original back. **This doc is the ruling
> record — do not "fix" any of it back.** Where it contradicts
> `HANDOFF-2026-08-10-v8-owner-corrections.md` or the 2026-08-08 SSOT, this doc wins.

## 1. The refinement list, verbatim → what it became

| # | Owner said | Resolution |
|---|---|---|
| 1 | "turn back the old color for the composer background" | Box fill `surface-sunken` #1a1a19 → **`surface-elevated` #2c2c2b**, the shipped tone. |
| 2 | "the top bar isnt working clean and the ui desing doesnt look premium yet" | The top bar is **deleted**. The rail/dock carry identity again; the lens moved to a foot chip. |
| 3 | "same goes for this menue" (skills panel) | Craft pass — see §3. |
| 4 | "the option that you went for with the disclaimer isnt a clean solution … show that skills get auto routed and that they can select skills with /" | The two-line header is **deleted**. Both facts are now structural — see §3. |
| 5 | "find a better icon" (the ✦ skill pill) | ✦ → a **2×2 catalogue grid**. Measured against a `/` keycap at the real 15px; see §3. |
| 6 | "and chat shouldnt be a skill right?" | Correct. `chat` **is** `DEFAULT_TOOL` — it leads the panel as **Auto** and is hidden from the `/` menu. |
| 7 | "this ui desing could also be done better" (audience sheet) | Craft pass + re-anchored — see §4. |
| 8 | "change back that the audience sim is in a rail next to the thread and on mobile connected to the card same ui design as it was before" | **Done.** See §2. |

## 2. The rail is back (the structural reversal)

**Almost nothing had to be rebuilt.** `AmbientOverviewRail`, `AmbientOverviewSheet` (the
attached dock), the plate in `composer.tsx`, and the 400px `<aside>` in `home-page-layout.tsx`
were all still on disk and intact — v8 had only gated them off with two booleans:

- `composer.tsx` `useHeader` — dropped `&& !CONCEPT_V8_ENABLED` (added by `092d78c6`).
- `composer.tsx` the rail portal — dropped the `CONCEPT_V8_ENABLED ? null :` wrapper (added
  by `17c6f2d3`). The flag no longer appears in either.

So the shape is the pre-v8 one, on both flags: **rail ≥xl beside the thread**
(`presentation="rail"`, its own left hairline), **plate + attached dock <xl** (bar fused to
the composer's top edge, room opens as the portaled full-screen sheet).

**Deleted, because the ruling left them with no job:**

- `v8/composer-room.tsx` — the in-composer room card + its top bar (yesterday's ruling).
- `v8/verdict-report.tsx` + its test — the three-tab report. It keyed off `roomExpanded`,
  which is once again the ROOM's own open flag, so leaving it mounted opened both surfaces
  on one tap. `src/lib/surfaces/v8-report.ts` **stays** — `PopulationFrame` uses
  `personasToReportRead` for the personas grade.
- `openRoomForCard`'s v8 branch — a card's door drills the ROOM again. Fire-on-demand
  survives: an unmeasured card still spends exactly one run, and the verdict lands in the
  room under the sealed-verdict law.

**New:** `v8/audience-lens-chip.tsx` — the audience + platform door, in the composer foot.
The deleted top bar was the only way into the audience sheet, so the door had to go
somewhere; the foot is where a run's settings already live. It prints the audience name
**only when no room surface is showing it** (`!useHeader && !useRail`) — i.e. on the desktop
arrival alone. Printing it under the dock bar truncated the chip to a stray bracket at 393px.

## 3. The skills panel

- **The disclaimer paragraph is gone.** Both facts it stated are structural now:
  **Auto** is the first row, above the groups, carrying the check whenever nothing is armed
  (the default state reads as *a choice already made*, not an absence); and the **selected
  row + the preview pane both print the skill's `/command`**, so the shortcut is on screen
  the whole time you browse.
- **Chat → Auto.** `chat` is `DEFAULT_TOOL`; arming it arms nothing (`armedSkill` is null),
  so listing it under "Ask" as a peer was a taxonomy claim the router does not back. With it
  promoted, **the Ask group is empty and disappears** — the verbs are now Make / Test.
  ⚠️ The registry (`SKILLS`, `VERB_BY_TOOL`) is **untouched** — it is the SSOT the legacy `/`
  menu also reads and flag-off must stay byte-identical. The renaming lives in the panel; the
  `/` menu hides `chat` via a new opt-in `hideIds` prop that legacy never passes.
- **Pill icon ✦ → grid.** Rendered both candidates at their real 15px in the pill: a `/`
  keycap's rect and diagonal collide into an ambiguous blob closer to a cancel mark, while
  four squares stay crisp. The freed ✦ now marks the **Auto** row, where "automatic" is a
  meaning it actually carries. (A one-in-two-out router glyph was tried there first and read
  as the iOS share icon.)

## 4. The audience sheet

Was floating at screen bottom-centre, unattached to anything clicked; rows were undifferentiated
text; the sheet, the segmented track and the selected segment were three near-identical
charcoals so the control had no visible container. Now: rises from the composer's top edge
left-aligned (same geometry as the skills panel), initial tiles anchor each row, a rule
separates yours from the presets, the track sits darker inside an `surface-elevated` sheet,
and section labels dropped mono to match the skills panel exactly.

## 5. Verified (signed-in browser, e2e account, clean .next, both viewports)

Native contexts at **1440×900** and **393×852**, judged not just measured:
composer fill measured `rgb(44,44,43)` ✓ · desktop arrival has no top bar, foot reads
`@mrbeast · TikTok` ✓ · **desktop thread shows the 400px rail** (`data-presentation="rail"`,
ranked board, "1 sealed", 6 queued Simulate rows) ✓ · **mobile shows the plate + attached
bar** with nested radii, room opens as the shipped sheet ("1,000 minds · calibrated · reads
on TikTok") ✓ · mobile foot uncramped, no h-scroll ✓ · skills panel: Auto checked, `/remix`
on the selected row and in the preview, no Chat, no Ask ✓ · audience sheet anchored, tiles,
segmented track visible ✓.

**Gates:** `tsc --noEmit` clean · `npm run build` clean · vitest **5635 passed / 1 failure**
= the baseline `routing-cut` from the two protected uncommitted `/start` files.
⚠️ Two other tests (`composer-fold-on-close`, `omni-analysis-emotion-arc`) fail
*intermittently under full-suite load only* and pass isolated — timeout flakes, not
regressions. Don't chase them; re-run isolated before believing them.

## 5b. Second craft round, same day (`ba3b2229` → this commit)

The owner reviewed the above and sent three more. **The two "it looks AI-made" complaints were
design-system DRIFT, not taste** — `docs/DESIGN-SYSTEM.md` already had both answers, and the v8
surfaces had quietly ignored them. Worth remembering: when the owner says a surface looks
generic, check the system before redesigning anything.

1. **The Auto row** — renamed **"Auto routing"**, its subline deleted, and the check replaced by
   a real **switch** (`role="switch"`, `aria-checked`). It acts on click on BOTH viewports
   (arming the default lane *is* disarming), because a visible switch that did nothing until you
   pressed "Use" would be a lie.
2. **The audience sheet** — the pseudo-avatar initial tiles are gone (they carried no information
   and collided: "General" and "Growth Audience" were both a grey "G") and rows are ONE line,
   name left / provenance right, with a reserved check column so the right edge stays straight.
   **488px → 368px tall, nothing lost.**
3. **The drop cards** — both complaints were system violations:
   - Radius scale is `cards 12, inputs/buttons 8`. Cards were 16 and the Remix button was a full
     pill. ⚠️ **The Tailwind radius tokens here are shifted one step from the class names**:
     `rounded-lg` = 12, `rounded-md` = 8 (`rounded-xl` is 16). I got this wrong on the first pass
     and only caught it by measuring `getComputedStyle` in the browser — do not assume.
   - Serif is **voice-moments only (greeting/hero), never body/chrome**. The hook was `font-serif`,
     which put a display face on six stacked chrome rows and made a third family fight the mono
     receipt and the sans button. Hook is now Inter on the `title` role; the receipt dropped mono
     and its `↗`. One family carries the card. "Tonight's remixes." above it stays the voice moment.
   - The same radius correction was applied to both panels (rows 8, popovers 12, sheets 20).

Re-verified in-browser at both viewports: card 12px / button 8px / hook `Inter 16px` measured,
switch reads `aria-checked=true` with nothing armed, no h-scroll at 393. Gates: tsc clean, build
clean, vitest **5636 passed / 1** (the routing-cut baseline).

## 5c. Third round, same day — the rail mounts on the DESKTOP ARRIVAL

Owner ruling on §6.5 ("watch whether the foot chip reads thin on the arrival"): **show the rail
there, ready.** Desktop only — the owner explicitly ruled mobile out of this round, so the phone
arrival is untouched.

**Why it was the right call.** The arrival was a greeting, a shelf and a composer — the shape of
every chat app. The one fact that makes this a different product, that a thousand calibrated people
read what you write, was invisible until after the first send and carried only by a ~200px chip in
the composer foot.

**The trap, and what it changed.** The rail's ranked board is built from the open thread's
descriptor ledger, so on the arrival it has no rows. Mounting it as-is gives an honest header over a
700px void — the failed-to-load read, which is *worse* than the chip. And it cannot be filled by
running something: navigation never fires a sim. So the board got a **resting state** that answers
the question it can answer for free — **who is in the room** — from `audience.personas`, which
carries archetype + label + share off calibration. Ten rows, name left / share right, then
"Nothing simulated yet. Results land here, ranked.", then the existing ＋ door.

- This **resolves the cast question parked at §8**. The cast comes back with NAMES and SHARES.
  `CastMember` / `deriveCast` / `castOverflow` are deleted — initials were tried in the audience
  sheet in §5b and cut the same day for carrying no information and colliding.
- Percentages are apportioned by **largest remainder**, targeting `round(sum)` and **not** a
  hardcoded 100: a column of real numbers that doesn't add up is what makes a real number look
  fabricated, but inflating a signature that genuinely sums to 0.9 would be inventing coverage.
  Three tests cover this (adds-up, never-inflates, no-slices).
- **Adjacent fix, same defect class:** the board rendered `Ranked · 0 sealed` unconditionally, so a
  thread carrying only queued work opened on an empty section head over a void and *then* the real
  content. A section with no rows is not a section — it is now conditional.

**Layout.** `home-page-layout.tsx` only: `arrivalRail = CONCEPT_V8_ENABLED && emptyHome &&
!threadMode`. Every class it adds is `xl:`-gated because the `<aside>` already `hidden`s under xl —
a bare `flex-row`/`h-full` would have hit the phone too. No component moved: the layout's greeting
slot is already inert under `AMBIENT_V2_ENABLED`, so the composer keeps its stable child index and
never remounts. The foot chip drops the audience name on the desktop arrival automatically —
`showName={!useHeader && !useRail}` was already the rule, and `useRail` is simply true there now.

**Verified in-browser, signed-in, v8 flag ON, clean `.next`, native contexts at 1440×900 and
393×852:** desktop arrival rail measured `400×900` `data-presentation="rail"` · the ONLY section
head is "In the room", 10 real segments summing to **exactly 100** · rest line present · foot chip
reads `TikTok` (the rail names the audience) · **mobile arrival `aside` is `display:none`, no rail,
unchanged** · a queued-only thread's only head is now "Not simulated yet" · no h-scroll at either
width. Flag-OFF was observed separately and correctly showed **no** arrival rail.

**Gates:** `tsc --noEmit` clean · `npm run build` clean · vitest **5631 passed / 9 failed**, and 8
of those 9 are the documented full-suite-load timeout flakes — all 54 tests across the six files
**pass isolated** (re-verified this round, and the flake set is not stable between runs). The 9th is
the `routing-cut` baseline from the two protected uncommitted `/start` files.

⚠️ Four untracked verification throwaways now live in `scripts/` — `zz-mint-cookie.ts` (mints the
signed-in cookie), `zz-shot.ts` (both viewports + the thread state), `zz-measure.ts` (box geometry),
`zz-devpage.ts` (the `/ambient-v2` fixture page). **Never commit any of them; explicit `git add`
paths only.** Three traps they encode:
- The arrival is a **cookie** state (`maven_active_thread=__new__`), not localStorage. Without it the
  server rehydrates the newest open thread, which looks like the arrival unless you check the
  sidebar. That cost a full verification pass.
- **`NEXT_PUBLIC_CONCEPT_V8` is NOT in `.env.local`** — pass it inline (`NEXT_PUBLIC_CONCEPT_V8=true
  npm run dev -- --port 3010`) or you will verify the flag-OFF UI and think v8 regressed.
- No named helpers inside `page.evaluate()` — tsx/esbuild injects a `__name` shim that does not exist
  in the page realm and the call dies. Pass the body as a string, or use `function` expressions.

## 5d. Fourth round, same day — the welcome, the logo, and the gap

Owner, on the live arrival: *"too much empty space between the 6 videos and the composer. and i want
the section above the video (headline and subheadline) to be done better. welcome section like in
claude or chatgpt and i also want our logo to be there."*

**1 · The headline was two jobs in one slot.** `arrival.tsx` rendered a SINGLE h1 that swapped
identity: the time greeting until drops existed, then `"Tonight's remixes."` So on the screen a
creator actually meets — drops present, the normal case — there was **no welcome at all**: no mark,
no name, a shelf label wearing the hero's clothes. Split in two:
- `arrival.tsx` is now the welcome only — **brand mark over a serif greeting, centered**, always.
- `drop-shelf.tsx` owns its label, **demoted to chrome** (Inter, `title` role, `aria-labelledby`).
  A section label is not a headline, and it only exists when the section does.

The mark renders **cream, not its default accent**. The mark is a sanctioned accent use, but the
sidebar already spends the one allowed accent element on this same screen (dosage LOCKED) — the same
call `HomeGreeting` made, for the same reason. Greeting steps 26 → 30px at `sm`: a longer first name
sets past a 393px gutter at 30 and orphans onto its own line.

**2 · The gap was `pb-40` — and `justify-end` was inert.** Measured at 1440×900: the arrival's box is
`min-h-full` inside a **height:auto** ancestor, so the percentage never resolves, the box is
content-sized, and `justify-end` had nothing to push against. Its `pb-40` (160px) was therefore pure
dead space stacked on top of the scroll region's own `pb-[184px]` dock reserve. v8 now takes `pb-2`;
the **flag-off `AmbientStartHome` branch keeps `pb-40`** — that grid is taller and the ruling was not
about it. **Gap: 221px → 103px** (measured shelf-bottom to chips-top).

⚠️ The remaining 103px is **not** reclaimable by padding: the scroll region's 184px reserve is only
7px more than the dock actually occupies (chips top at y=723 of 900). It is simply content being
shorter than the region. Closing it further means making `min-h-full` resolve — an `h-full` on the
shared intermediate wrapper at `composer.tsx:3794`, which also hosts thread content. Not done: the
gain is ~60px of redistribution against a change to the most load-bearing layout in the app.

**3 · Fifth-round trims, same session.** Owner on the r4 build: *"good morning headline is way too
close to the top, and 'tonights remixes' doesn't sound good either — different wording or remove
it."*
- **Headroom.** `pt-6` → `pt-10 sm:pt-16` for v8 only (flag-off keeps `pt-6`). A 24px pad was the
  flag-off grid's clearance, and a grid does not need what a centered serif hero does. Because this
  box is content-sized, top pad also pushes the whole block down into the §5d slack — so it paid
  twice: **headroom 24 → 64px AND gap 103 → 88px.**
- **The shelf label is GONE, not reworded.** It was a title for a section that needs a caption: the
  cards already state what they are (still, real view count, outlier receipt, Remix), so a heading
  above them restated the obvious in a bigger face. What a creator does *not* already know is the
  provenance — so one muted line carries it, "Proven videos, rebuilt for your niche", and the
  greeting is the arrival's only heading. The `<section>` keeps that line as its `aria-labelledby`.

**Verified in-browser** (signed-in, v8 ON, both native viewports): welcome renders mark + serif
greeting centered at 1440×900 and 393×852 · one muted caption, no heading, above the grid · measured
headroom **64px**, gap **88px** · no h-scroll either width. **Gates:** tsc clean · build clean ·
vitest **5639 passed / 1** = the `routing-cut` baseline, no flakes.

## 6. Open follow-ups

1. **Day-0 lane cards still carry the old pre-score meter** (`lane-reveal.tsx`,
   `buildLaneDrops`'s Flash batch) — unchanged owner call from the last round. If "the sim is
   separate" extends to day-0, that batch dies too.
2. ~~Tall gap between shelf and composer~~ — **ADDRESSED in §5d** (221px → 103px). What stays open
   is the last 103px, which needs `min-h-full` to actually resolve; see the ⚠️ in §5d for why that
   was not worth the blast radius unprompted.
3. Copy review + drop economics (`docs/OWNER-REVIEW-2026-08-10-v8-copy-and-economics.md`).
   Add to it: `AUTO_LABEL` / `AUTO_DESC` and the rewritten `PROMISE_BY_TOOL.chat`.
4. `pickLane` prefills the audience description with `lane.who`; real output says `lane.niche`
   reads as the description. One-line change, owner call.
5. ~~The desktop arrival has no rail~~ — **RULED AND BUILT, see §5c.** What replaces it as the
   open question: the resting board lists **all ten** archetypes (15/12/12/10/10/10/8/8/8/7). It is
   complete and it fills the column, but ten near-even rows read as a flat distribution with nobody
   standing out. Truncating needs an overflow affordance, and the owner cut one of those in §5b —
   so it stays whole until the owner says otherwise.
6. The **mobile** arrival still states the audience nowhere until you tap (the owner scoped §5c to
   desktop). The <xl equivalent would be the attached plate on arrival.

## 7. Rules still binding

Fire-on-demand (navigation never fires a sim) · accent dosage LOCKED (live dot + brand mark
only; primary actions neutral cream; matte) · type from the roles, no fractional px · the
Flash sim is platform-blind · donor niche/handle never rendered · drops arrive UNSCORED and
the sim is a separate surface · the card receipt is "N× their usual views", selection >3× ·
chips above the composer · thumbs open the source post · flag-off byte-identical · Phases 4
and 6 stay SKIPPED · audit the live product before building any mock section.

**Ops:** a `post-commit` hook AUTO-PUSHES — run the gates BEFORE `git commit`. Never commit
the two `/start` files or `scripts/zz-mint-cookie.ts`; explicit `git add` paths only. Clear
`.next/` before judging flag behaviour, and note a prod `npm run build` clobbers a running
dev server's `.next`. Vercel git is DISCONNECTED — merging does not deploy.
