# Handoff — Room surfaces rework: ① overview · ⑤ arm · ④ start (rev B+ → implement)

**Date:** 2026-08-02 · **Designed on:** `~/virtuna-slot-b` · `task/insights-rework` (tip `540232dd`)
**Status:** rev B+ is on the review artifact, owner has seen rev A/B feedback cycles; §3 is the
design contract, §5 is the implementation map. This is a SEPARATE track from the insights drill
(`docs/HANDOFF-2026-08-01-insights-rev6-kickoff.md` §15) — different surfaces, different artifact.

> ⚠️ **Two artifacts, never crossed.** The drill reviews at
> `…/artifact/f42c45fb-0d27-4d84-8a65-568e9f1e8db3`; THIS track reviews at
> `…/artifact/67ab2001-e7b7-4be2-b2ae-f7850174e418`. Each has its own mockup file and its own
> build script. Publishing either mock to the other's url kills the owner's link.

---

## 1. Where everything is

| | |
|---|---|
| The mockup | `docs/mockups/room-surfaces-2026-08-02.html` — one file, all three surfaces, all states. Open directly, no server. |
| The review link | https://claude.ai/code/artifact/67ab2001-e7b7-4be2-b2ae-f7850174e418 — republish to THIS url |
| Rebuild the link | `node scripts/build-room-surfaces-artifact.mjs` → publish `$TMPDIR/room-surfaces-review.html` (Artifact tool, favicon 🎛️). Fonts inline; no image CROP in this one. |
| Mock captures | `docs/mockups/reference-2026-08-01/mockA-*.png` (10 states) |
| Live captures | `docs/mockups/reference-2026-08-01/surf-*.png` (7 states, shot 2026-08-02 pre-rework) |
| Live review surface | `/ambient-v2` (no auth, port 3002) — chips `④ start` · `⑤ simulate` · `① overview` · `② brain` |
| The drill track | PR **#412** (open on this branch) = the detail-view redesign, rev 9.3. Not this track. |

## 2. The owner's brief (2026-08-02, verbatim intent)

Review + refine the overview screen, arm screen and start screen — "they don't look clean yet and
UX could be improved. we want something that would be released by Claude, Perplexity, ChatGPT."
Specific asks: **the 0/10 ranking is not being used anymore in the engine** so rework it off the
overview; rework the SIMULATING-NOW loading state; rework the audience header; improve the arm
page a lot; improve Start's wording/copy. Rev A follow-up: the arm page still not clean, overview
more improvements, Start copy pass — which became rev B; rev B+ completed the cold flow.

## 3. The design contract as of rev B+ (what the mock specifies)

**Shared grammar** (the drill's settled system, now extended to these surfaces):
sentence-case section headers (13px/500, cream .92) with right-meta (11.5px faint) ONLY where the
label is data; **zero mono-uppercase anywhere**; tiny type tags are plain faint text (`.kt`), the
only chip fills left are ACTIONS (`Simulate →`) and object tags (`hook` on the stimulus card);
matte (0 gradients / 0 shadows / 0 blur — probed); one accent: coral appears exactly once across
all three surfaces (Start's live-room dot), sage is gone.

**① Overview (440):**
- Header = room facts, not badges: name row (glyph · "Your audience" · caret), then
  "**1,000 minds** · calibrated 3d ago · reads on TikTok" (12px faint). The `CALIBRATED` pill,
  the micro-avatar cast cluster and the cast footer are all dead.
- **Simulating now**: kicker (breathing cream dot + "Simulating now" / right "SIM-1 Flash"), card
  `#1d1d1c` with: title (2-line clamp) → **dot field** (24×5 grid, one dot ≈ 8 minds, fill =
  real progress, undecided dots 13% ghost) → phase line in plain words ("Reading the hook" →
  "1,000 minds deciding" → "Counting the votes" → "Sealing the verdict") + "459 of 1,000" right →
  hairline → "🔒 Sealed until all 1,000 decide", which swaps to "**31.7%** would stop" at n-of-n.
  No stage-stepper, no gradient scan.
- **Ranked**: "Ranked" / right "% who would stop · 5 sealed". Row = rank numeral · title (ellipsis,
  now the widest element) · plain-text kind · (`viral 91` for video) · bold %. Bar under, 3px,
  normalized to the board's winner (not BAR_REF=50); winner = cream .92, rest .45.
- **Not simulated yet**: "3 queued" right-meta. Row = dim title · kind · `Simulate →` chip-button.
  **No bar, no number** (video keeps `viral 84` — a real native score). Rows stay one line.
- **＋ door**: quiet filled row — "＋ Test something of your own · a draft, a video, or a link".

**⑤ Arm (460) — shape: what → question → settings → go:**
- Header "Test against your audience" + ✕ (cold adds ‹ back).
- Stimulus card (`#212120`): kind tag + text (3-line clamp). Develop entry adds ONE faint line
  under it: "From your Hooks run — this deepens that read" (**no band, no 8/10**).
- "The question": segmented [Stop·Finish·Share·Follow·Buy], then ONE caption line
  ("Would they stop scrolling? — the first 2 seconds"), then "or ask your own question" as a
  faint text-button that expands into the input on tap.
- **Settings card** (`#1d1d1c`, internal hairlines, label-left / control-right):
  Audience `[Everyone · 1,000 minds ▾]` · Platform `[TikTok ▾]` · Model `SIM-1 Flash 🔒`.
  The locked tier is a ROW like the others, not a floating footnote; the dev-speak reason line
  ("Max for text isn't wired yet") does not ship.
- Footer: "Reads in a few seconds." + full-width cream **Simulate ↑**.
- **Video arm**: stimulus = filename; question section is one line ("Every behaviour, scored at
  once — the whole curve, not one dial"); all three settings rows LOCKED (The whole room / TikTok /
  SIM-1 Max) with ONE reason line under the card: "A full video read locks its dials — ten
  reactors watch it end to end." Footer: "Takes 1–3 minutes — it lands on your board when it's done."
- **The doors** (cold step 1): title "What are you testing?", sub "Pick what to put in front of
  your audience.", five door rows (video / draft live; Compare two · Ask the room · Run a survey
  dimmed `soon`). The SCREEN/COMPARE/QUERY family kickers are gone from the UI.
- **Collect** (cold step 2): "Paste the draft" + ‹ + ✕, sub "A hook, script, or caption — your
  audience reads it cold.", textarea, `0 / 2,000` counter, full-width **Continue →**.

**④ Start (760):**
- Serif greeting unchanged.
- Conditions: kicker "**Your audience**" (was "Testing against"), ONE row of two adjacent pills
  `[• General ▾] [on TikTok ▾]` — the label-left/pill-far-right void is dead.
- Groups renamed **Create** / **Research** (were Content / Intel). Copy: Ideas "Ranked before you
  film", Script "Written to hold attention" (rest unchanged).
- The door carries the SAME name as the board's door: "**Test something of your own** · A draft,
  a video, or a link — read by your audience", and must render on Start (the `/ambient-v2` dev
  page never passed `onSimDoor`, so it was invisible in review shots).

## 4. Settled calls — do not silently undo

1. **The 0/10 rank is dead** (owner). Nothing renders `personaStops`, `N/10`, or a band derived
   from it. Queued rows carry no fabricated score and no bar; the develop tie-back names its
   source skill instead.
2. **No mono-uppercase chrome on these surfaces** — the rev-4 "Bloomberg terminal" tell.
3. **One accent**: sage is gone; the winner reads by rank position + full-strength cream.
   Coral = Start's live dot only (allow-listed liveness), nothing else.
4. **Loading = honest progress**: dot-field fill is real progress, verdict sealed until n-of-n
   (the engine emits terminal snapshots — never fabricate a partial).
5. **The locked tier is a settings row**, grouped with audience + platform; lock reasons compress
   to at most one product-language line (video arm), zero for text.
6. **Both doors share one name**: "Test something of your own".
7. Chip fills are for actions and object tags only; type/score annotations are plain faint text.

## 5. Implementation map — verified pointers (re-verify line numbers before editing)

**Components (all in `src/components/audience-lens/v2/`):**
- `AmbientOverview.tsx` (723) — `Kicker` (mono-uppercase, `:127`) → sentence-case; header block
  `:597-637` (kill provenance pill, add facts line); `WatchingCard` `:215-325` rebuild (dot field;
  keep the rAF/transform pattern and reduced-motion frame; delete `StageStepper` `:169` + the
  gradient scan `:292-299` — the mock's phase cuts are `.12/.55/.96`); `SealedRow` — sage
  `TONE.sage :115` + `BAR_REF :123` die, bars normalize to `sealed[0].stopPct`; `QueuedRow`
  `:423-505` — delete the N/10 slot + muted bar + underline cue, add the `Simulate →` chip;
  `RankedStimulus.personaStops` type field dies; cast footer `:694-720` dies.
- `AmbientSimulate.tsx` (823) — `ArmCard` restructure per §3; `DevelopContext` (`:80-84`,
  `band/value/lensLabel`) reshapes to a source label (e.g. `{ sourceLabel: "Hooks run" }`);
  `VIDEO_LOCK` three-paragraph reasons (`:165-169`) collapse to the one-line locknote; the
  fidelity chip + `lock.reason` footer (`:727-743`) fold into the settings card's Model row.
- `SimulateIntake.tsx` — `IntakeStep` drops the family kickers, door rows restyle; `CollectStep`
  restyles (title/sub/counter/Continue) — its collect logic (draft vs file vs url exclusivity)
  is behavioral and stays.
- `AmbientStart.tsx` (677) — `ConditionsStrip`/`ConditionRow` `:374-456` → adjacent-pills row;
  the greeting, `AudiencePick` grouping/tier logic, and `SkillTile` anatomy stay.
- Sheet presentation: `AmbientOverviewSheet` + `presentation="sheet"` paths must keep working —
  the mock draws rail geometry only; keep every change presentation-agnostic.

**View-model / copy producers (`src/lib/surfaces/ambient-v2-adapters.ts`):**
- `parsePersonaStops` `:60-62` and its use in the queued mapping `:145` — delete with the field.
- `buildOverviewData` `:126` — sort queued rows without `personaStops` (ledger order or recency).
- `START_SKILL_GROUPS` `:285+` — group labels + the two lens lines change here (⚠️ tile `id`s are
  composer **ToolIds** — `idea` singular; do not touch ids, F-017).
- Header facts line needs data `OverviewData` doesn't carry today: minds (`TIER_N[tier]`),
  calibration recency (`provenance` string already exists), and the SCENE ("reads on TikTok") —
  extend `OverviewData`/`AudienceMeta` mapping rather than hardcoding.
- `AmbientOverviewRail.tsx` — `bandFromStops` `:94-99` + the `develop:` tie-back `:503`
  (`` `${stops}/10` ``) produce the dead rank; replace with the source-label shape. The rail is
  mounted at `composer.tsx:2581`; Start mounts via `AmbientStartHome` (`composer.tsx:121`).
- **Engine side:** `blocks.ts` fraction fields (`"6/10 stop"`) and the runners' `personaStops`
  self-estimates still EXIST in schemas. The owner says the engine no longer uses the rank —
  verify what the current engine emits before deleting producer fields; the UI can stop
  rendering them regardless. Do not delete schema fields the routes still parse.

**Mount blast radius:** these three surfaces ship in `composer.tsx` (app rail + empty home),
`app/ambient-v2/page.tsx`, `app/(app)/dev/cards/page.tsx`. The /go offer pages mount the DRILL
(`AmbientDetail`), not these — but `offer/ambient-panel.tsx` documents the rail flow; eyeball /go
after anyway. The drill's own four-mount warning lives in the other handoff §15.

**Gates:** `AmbientOverviewRail.test.tsx` (22K — the big one) · `AmbientOverviewRail.credit-wall`
· `AmbientOverviewSheet` · `AmbientSimulate.cold` · `AmbientStartHome` · `sim-door.test.tsx` (20K)
· `ambient-v2-adapters` start-skill-ids. Run `npx tsc --noEmit` AND the vitest files AND
`npm run build` (the `src/lib/surfaces/*`-import-in-route trap breaks only the prod build; vitest
does not typecheck; a green Vercel check is not a build). ⚠️ **Merging to main is deploying** —
verify BEFORE merge.

## 6. Traps (this track's own; §12/§13 of the drill handoff still apply)

- **Duplicate class names bit AGAIN** (`.st` collided with the Start card, cost a probe run).
  Prefix any new mock class; grep the file first.
- The path-guard hook rejects Writes outside the worktree — temp scripts at `scripts/tmp-*.mjs`
  (rm after), memory via `python3` through Bash.
- `import { chromium } from '.../playwright/index.js'` fails (CJS) — `import pw from …` then
  destructure.
- The dot-field mock uses `performance.now()` in a rAF loop — fine in browsers; keep
  `animations:'disabled'` screenshots away from asserting a specific fill frame.
- A launchd reaper kills the :3002 dev server after ~10 min idle — `lsof -ti:3002` first.
- This track's build script has NO image CROP step — do not copy the drill script's hero
  inlining machinery back in.

## 7. The loop for a mock adjustment

1. Edit `docs/mockups/room-surfaces-2026-08-02.html` (one file).
2. Recreate a shoot/probe script at `scripts/tmp-shoot-mock.mjs`, run, `rm`. Probe: law walk
   (backgroundImage/boxShadow/backdropFilter = 0), coral census (exactly 1, Start), uppercase
   census (0), `/10` census inside surfaces (0), queued-bar count (0), routing round-trip.
3. `node scripts/build-room-surfaces-artifact.mjs` → Artifact tool → the §1 url.
4. Commit atomically; auto-push runs — verify `git rev-parse origin/task/insights-rework`.

## 8. Open — the owner has not ruled

- **Queued-row ordering** once `personaStops` dies (ledger order vs recency vs kind-grouped).
- **The stop-quote** (`stopQuote` rides every generation) is rendered nowhere — cheap value if a
  queued row ever wants a one-line voice.
- Whether the cast/slice avatars return anywhere (the mock folded the room's identity into the
  facts line and deleted them).
- Rest-state header ("at rest" state currently just drops the sim card — no first-run empty state
  was designed for a board with zero sealed rows).
