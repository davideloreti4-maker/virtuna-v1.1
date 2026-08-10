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

## 6. Open follow-ups

1. **Day-0 lane cards still carry the old pre-score meter** (`lane-reveal.tsx`,
   `buildLaneDrops`'s Flash batch) — unchanged owner call from the last round. If "the sim is
   separate" extends to day-0, that batch dies too.
2. The centered empty home still leaves a tall gap between shelf and bottom-docked composer
   at 1440×900 — visible in this round's screenshots, still unflagged by the owner.
3. Copy review + drop economics (`docs/OWNER-REVIEW-2026-08-10-v8-copy-and-economics.md`).
   Add to it: `AUTO_LABEL` / `AUTO_DESC` and the rewritten `PROMISE_BY_TOOL.chat`.
4. `pickLane` prefills the audience description with `lane.who`; real output says `lane.niche`
   reads as the description. One-line change, owner call.
5. The desktop arrival has no rail (no thread yet), so the foot chip is the only place the
   audience is named there. Watch whether that reads as thin once the owner sees it.

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
