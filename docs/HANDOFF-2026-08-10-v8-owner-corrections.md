# Handoff — 2026-08-10 owner correction round: the shelf receipt + the composer room

> **Written 2026-08-10, after the owner's live preview of v8 (flag-on, localhost).** The owner
> reviewed the shelf and composer in the browser and issued a correction round that REVERSES
> several previously-locked rulings. All of it is implemented, gated, verified in-browser at
> 1440×900 and 393×852, and on `lane/platform-concept` as `deafa713` + `d75b2d35` (auto-pushed).
> This doc is the ruling record — future sessions must not "fix" these back.

## 1. The new rulings (supersede 2026-08-09 and parts of the SSOT)

1. **The sim is COMPLETELY SEPARATE from the drops.** No sim runs for remixes — the nightly
   warm fires NO Flash batch; drops arrive UNSCORED (no /10, no meter, no personas). The old
   "drops are the only pre-scored surface" law is dead.
2. **The multiplier PRINTS.** Owner call #1 (multiplier basis) is RESOLVED: the card's receipt
   is "N× their usual views" (corpus `baseline_label` basis — follower baselines don't exist).
   Shelf selection = `outlier_multiplier > 3` only (`DROP_MIN_MULTIPLIER`, drop-select.ts).
   The "no corpus multiplier numbers anywhere" lock is retired.
3. **The v8 three-tab report is NOT the sim's door.** Owner verbatim: "the report page is
   exactly what we didn't want. we already had the exact simulation room in the rail before."
   The room returns — the shipped mobile-dock concept — but presented as **the composer
   opening up into a card**, never a full page/sheet/overlay, on every viewport.
4. **"Nothing above the field" is dead.** The composer regains its attached TOP bar
   (@audience · CALIBRATED · lens ▾ · caret) — the bar is the room's door; the lens zone
   opens the audience/platform sheet. The sub-bar (below the foot) is deleted.
5. **Quick-action chips sit ABOVE the composer** on the start page (hidden while the room
   is open — the bottom-anchored dock would shove them over the shelf).
6. **Cards must be watchable**: thumb → the original post in a new tab (hover "Watch ↗"
   reveal makes the affordance explicit).
7. **Skills panel must answer "do I have to pick?" first**: the auto-routing promise moved
   from the footer whisper to the panel header.

## 2. What was built (all flag-gated, `CONCEPT_V8_ENABLED`)

- `v8/composer-room.tsx` (NEW): collapsed bar ⇄ in-flow room card (`h-[min(560px,62dvh)]`,
  300px when nothing ranked) hosting the REAL `AmbientOverviewRail presentation="sheet"` —
  same live descriptors/seals wiring the old header/rail had. Esc + the room's own caret close.
- `drop-shelf.tsx`: meter/report door deleted; receipt (`↗ N× their usual views`, guarded for
  pre-field cache rows), hover Watch reveal, "Remixing…" busy label, tighter grid.
- `drop-reactions.ts`: Flash batch + `flashBatch` dep deleted; `DROP_SPARES = 3` second-wave
  salvage (spares adapted ONLY on first-wave failure). Cost per warm: 1 embed + ≤9 adapt.
- `adapt.ts`: `stripPartialProduction` — a partial `production` object (the live 5/6-shelf
  cause: `setup` omitted on all 3 concepts, both attempts) is stripped pre-Zod, never fatal.
- `arrival.tsx`: the greeting's name suffix no longer leaks into the shelf headline
  ("Tonight's remixes, E2E." defect).
- `composer.tsx`: remix handler gained `setOpenThreadId` + sidebar invalidation (parity with
  `ensureThreadForSend`) — the seeded thread reliably takes the view now.
- `drop-seed.ts`: the seeded thread's proof now carries multiplier + baselineLabel.

## 3. Verified (signed-in browser, e2e account, clean .next)

6/6 cards with printed receipts (75×/121×/7.1×/75×/50×/4.4×) · no /10 anywhere on the shelf ·
bar collapsed/open matches the owner's two reference screenshots · room opens IN the box, chips
hide, closes from its own caret · Remix → the seeded 3-angle thread takes the view · headline
clean · chips above composer · no h-scroll at 393×852 · gates: tsc clean, build clean, vitest
5642 passed / 1 pre-existing routing-cut failure (the uncommitted `/start` files).

## 4. Open follow-ups (not blockers, decide next session)

1. **Fired in-thread sims still land in `VerdictReport`** (the sheet). The ruling implies they
   should land IN the room; kept this pass so the sealed-verdict flow stayed working. Follow-up:
   route `openRoomForCard`/`fireSim` results into the composer room, then delete VerdictReport.
2. **Day-0 lane cards still carry the old pre-score meter** (`lane-reveal.tsx`,
   `buildLaneDrops`'s Flash batch). If "sim is separate" extends to day-0, that batch dies too —
   owner call (it changes the "pre-tested" reveal kicker).
3. The centered empty-home leaves a tall gap between shelf and bottom-docked composer at
   1440×900 — standard chat-dock pattern, but flag if the owner still reads it as unclean.
4. Copy review + drop economics remain open (see
   `docs/OWNER-REVIEW-2026-08-10-v8-copy-and-economics.md`; economics now CHEAPER — the Flash
   batch left the warm).
5. From the lane eval (`docs/EVAL-2026-08-10-lane-synthesis.md`): `pickLane` prefills the
   audience description with `lane.who` (posture shorthand); real output says `lane.niche` is
   the field that reads as a description. One-line change, owner call.

## 5. Session-close state + ops (2026-08-10, end of session)

- **Branch `lane/platform-concept` @ `872e26af`**, auto-pushed, in sync with origin. This
  session's commits: `efbda73c` (lane eval + no-subject decline) · `f896ed52` (stopQuote
  schema fix) · `99f0bce0` (owner prep pack) · `deafa713` (un-sim + receipt + salvage) ·
  `d75b2d35` (top bar + composer room + card redesign + chips + skills header) · `872e26af`
  (this doc). Gates ran before every commit; baseline = exactly 1 pre-existing routing-cut
  failure (the two protected uncommitted `/start` files).
- **The owner has a NEW refinement round pending** — they reviewed the corrected build live
  and will dictate refinements at the top of the next session. Take those as the work list;
  §4 above is the backlog behind them.
- **Preview recipe** (what actually worked): dev server with
  `NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 30XX`
  (⚠️ check `lsof -ti:PORT` — **3007 belongs to ~/virtuna-landing's dev server**). Signed-in
  browser: `scripts/zz-mint-cookie.ts` (UNTRACKED, keep it that way) mints the e2e cookie
  JSON; the MCP browser can't read files or fetch — serve the scratchpad via
  `python3 -m http.server 8765`, navigate the page to the JSON, `JSON.parse(document.body
  .innerText)` → `context.addCookies` + `maven_active_thread=__new__`. Hand-pasting the
  token into run_code corrupts it — don't.
- The drops cache was cleared once (2026-08-10) so new-shape cards warm; old cached rows
  without `multiplier` render no receipt by design.
- The launchd reaper kills idle dev servers ~10 min; restart + clear `.next/` before
  judging flag behavior (a prod `npm run build` clobbers a running dev server's `.next`).

## 6. Kickoff prompt for the fresh refinement session

```
Platform concept v8 — owner refinement round 2, worktree ~/virtuna-platform-concept
(branch lane/platform-concept — git fetch first; HEAD ≈ 872e26af, all pushed;
flags NEXT_PUBLIC_CONCEPT_V8 + NEXT_PUBLIC_AMBIENT_V2; nothing deployed, Vercel
git DISCONNECTED).

Read, in order:
1. docs/HANDOFF-2026-08-10-v8-owner-corrections.md  (THE RULING RECORD + state —
   the 2026-08-10 owner round REVERSED older rulings; never "fix" these back)
2. docs/HANDOFF-2026-08-09-v8-refinement-merged.md   (prior state, background)
3. docs/HANDOFF-2026-08-08-concept-v8-implementation.md  (SSOT — where it
   contradicts doc 1, doc 1 wins)

I will give you the refinement list at the start of the session — that is the
work list. Behind it, the open backlog is doc 1 §4 (fired sims → the composer
room then delete VerdictReport; day-0 lane meters owner call; desktop shelf/dock
gap; copy review; drop economics; lane who→niche prefill).

Rulings in force (2026-08-10): drops are UNSCORED and the sim is COMPLETELY
SEPARATE (no Flash batch in the warm; no /10 on cards); the card's receipt is
"N× their usual views", selection > 3× only (multiplier basis RESOLVED — the
old no-corpus-numbers lock is retired); the composer carries its attached TOP
bar (@audience · CALIBRATED · lens ▾ · caret) and opens INTO the sim room card
(v8/composer-room.tsx) — never a page/overlay ("nothing above the field" is
dead); chips sit ABOVE the composer; thumbs open the source post; the skills
panel leads with the auto-routing promise.

Still binding: fire-on-demand (navigation never fires a sim); accent dosage
LOCKED (live dot + brand mark only, primary actions neutral cream, matte); type
from the roles, no fractional px; Flash sim platform-blind; donor niche/handle
never rendered; flag-off byte-identical; Phases 4 + 6 stay SKIPPED; audit the
live product before building any mock section.

Ops traps: a post-commit hook AUTO-PUSHES every commit — run the gates BEFORE
git commit (tsc --noEmit · npm run build · npx vitest run, baseline = exactly
one pre-existing routing-cut failure). Never commit the two uncommitted /start
files or scripts/zz-mint-cookie.ts — explicit git add paths only. Clear .next/
before judging flag behavior; one dev server per port (3007 = the LANDING
repo's server, not ours). Signed-in preview recipe: handoff doc 1 §5.
Screenshot at 393x852 AND 1440x900 in native contexts and JUDGE the
composition, not only the measurements.
```
