# Handoff — Apple-grammar lane: phase 2 + the overlay z-scale (2026-08-21)

**Lane:** Apple-HIG design pass over the signed-in surfaces.
**Worktree:** none — this ran in the trunk `~/virtuna-v1.1` and (for the last PR) a temporary
worktree that has since been removed.
**Shipped and MERGED this lane:** **#528** (phase 1) · **#532** (phase 2, merge `b9e8cc1d`) ·
**#534** (⌘K scrim, merge `48deb7bb`) · **#537** (overlay z-scale, merge `55dbdca2`).
**Nothing is left open on this lane.** The next step is a design call, not a fix.

---

## ▶️ PASTE THIS TO START

```
Read docs/HANDOFF-2026-08-21-apple-grammar-and-overlay-z.md.

This is the Apple-grammar design lane. Four PRs merged (#528, #532, #534, #537); the
lane is at a clean stop. The whole premise is the LOCKED accent-dosage rule in
CLAUDE.md: monochrome by default, at most one accent element visible at a time.
Colour used decoratively is a bug here, not a style choice.

⚠️ main moves CONSTANTLY — 17 commits landed under this branch in five days, and a
co-session works in the same trunk. git fetch && git rev-parse origin/main before
branching AND before opening a PR. Never `git add -A` in the trunk: a co-session's
untracked files sit there and get swept into your commit.

⚠️ The deploy is OWNER-CONFIRMED OFF. Merging does NOT deploy. Never make "watch it
in production" a success criterion.

RECOMMENDED NEXT — /audience gets the unified hairline panel:
  This is the only open item that needs NO ruling from the owner. Phase 1 already
  gave /library the panel and the owner approved it (5e95afc5, "unified shelf panel,
  pill facets, colour only on Weak"). /audience never got it and still renders
  individually-bordered floating cards: audience-index.tsx:208
  (`min-h-[172px] … rounded-2xl px-4 pt-4` + `border … bg-surface-elevated`).
  Copy the shape, do not invent one:
    - the panel + `divide-y` hairlines: saved-shelf.tsx:475
    - rows drop their own radius inside it: saved-row.tsx:151, :343
    - the same panel reused by a second host: project-detail.tsx:254
  /audience is `src/app/(app)/audience/page.tsx` → `AudienceManager` → `audience-index`.
  While in there: the measured colour census puts /audience at 5 coloured elements
  (/library is 1, /settings is 0). audience-index.tsx:239 uses --color-accent for a
  dot and :257 uses --color-positive. Decide each against the dosage rule.

TWO CALLS THAT ARE THE OWNER'S — ask, do not decide:
  1. Discover's 17 green multipliers. The rule says quiet them; the counter is that
     the multiplier IS the tile's point. The useful fact: the extreme 100× rows on
     that SAME surface already render neutral, so a colourless version exists to
     look at before ruling.
  2. The motion contract. A lane, not a task — zero `active:` press feedback on any
     signed-in route, no entrance motion on ⌘K / project picker / account menu, and
     `prefers-reduced-transparency` + `prefers-contrast` have ZERO occurrences
     app-wide (that half is accessibility, not polish).

DO NOT:
  - Do not re-attempt the right-rail collapse. Vetoed by the 2026-08-12 owner ruling
    written INSIDE AmbientOverview.tsx (complete frames that scroll; name+% alone was
    explicitly rejected).
  - Do not file the thread cards' coloured verdict band as a live defect. It is a
    LEGACY shape — live runs emit `projected`, which prints no band at all.
  - Do not file the "six home-tile Remix pills". Stale in both halves: /home has zero,
    and /discover's 24 are already hover-revealed by deliberate design.
  - Do not raise embedded-composer.tsx's `fixed inset-0 z-10`. It is a TRANSPARENT
    click-catcher and must stay below the chrome.

GATE BEFORE ANY PR (run all three; tsc clean does NOT imply the build passes here):
  node node_modules/typescript/bin/tsc --noEmit ; echo "exit $?"
  node node_modules/vitest/vitest.mjs run --maxWorkers=3
  npm run build
```

---

## 1. What shipped

### #532 — phase 2, the live/interactive layer (merge `b9e8cc1d`)

- **`.rv-in` no longer strands a page blank.** Its base was `opacity: 0` plus a `forwards`
  keyframe, so any case where the animation did not run to completion left content permanently
  invisible. Measured on /library: cancelling the running animations left the page header,
  Projects and the entire saved shelf at opacity 0. Now the landing's `.lp-reveal` shape.
  All 25 call sites unchanged.
- **/discover collapsed to ONE toolbar**, filters a disclosure at every width. Measured at 1440
  with the panel closed: the grid went **3 → 4 columns**. This restored what the 2026-08-04 owner
  note in that same file already specified; the code had drifted from it.
- **/competitors: three defects.** `formatCount` had no billions branch — 1.3B printed as
  **"1300.0M"**. The *other* copy of that function already pinned this exact case in a test noted
  `regression: was "1300M"`; the fix had never crossed to the copy **eight** surfaces import.
  Plus `isStale` 48h → 14d (warning was the resting state), and a separator between
  "Updated 5w ago" and "Scrape failed", which rendered as one run-on string.
  Coloured elements on that page: **6 → 3**.
- **/library's empty PROJECTS heading folded** — it was the top quarter of the first screen at 393px.

### #534 — the ⌘K scrim (merge `48deb7bb`)

The palette's overlay carried a hardcoded `z-50` while the left nav sits on `--z-sidebar` (**250**),
so the scrim painted *under* the app's own chrome: ⌘K dimmed `<main>` and the right rail while the
sidebar stayed at full contrast, reading as if the chrome were on top of the modal.

**Geometry was never the problem.** Measured signed-in at 1440×900, probing the sidebar's own
centre (110, 450):

| | overlay `z` | `elementFromPoint(110,450)` |
|---|---|---|
| before | `50` | `span.truncate flex-1` — **a sidebar node** |
| after | `400` | the scrim |

The overlay's rect covered `0,0→1440,900` in *both* runs. Only the stacking changed.

🔑 **The reason this sat unfixed is a wrong cost estimate.** The phase-2 write-up called it "a
z-index change under every route", so it was deferred as an owner call. It is one class on an
element that is `createPortal`'d to `document.body` — nothing about the sidebar, the header or any
route layout is involved. **Price a fix before deferring on its price.**

### #537 — the rest of the class (merge `55dbdca2`)

⌘K was never special; it was the one that got measured. Four more overlays sat below the chrome:

| overlay | was | now |
|---|---|---|
| `ui/sheet.tsx` overlay | `z-50` | `--z-modal-backdrop` (300) |
| `ui/sheet.tsx` content | `z-50` | `--z-modal` (400) |
| `audience-lens/v2/SimulateDoorHost.tsx` | `z-50` | `--z-modal` |
| `surfaces/room-drawer.tsx` | `z-40` | `--z-modal` |
| `app/home/audience-chip.tsx` mobile sheet | `z-50` | `--z-modal` |
| `app/home/audience-chip.tsx` backdrop | `z-40` | `--z-modal-backdrop` |

`sheet.tsx` alone feeds `drill-sheet`, `AudienceLens` and `PersonaChatDrawer`. Verified live on the
＋ door: host z 50 → 400, hit at the nav's centre flipped from a sidebar `span` to the scrim, and
the screenshot shows the page dimming uniformly with the nav included. Re-verified a second time
**after `ONE_BRAIN` went default-ON (#538)**, because that flag changes the very surface the probe
drives.

## 2. 🔴 Traps this session paid for — read before writing any probe

- **A probe that names the wrong element still prints a confident verdict.** The first version of
  the scrim probe used `document.querySelector("aside")`, which on /home finds the **400px right
  rail**, not the left nav — and the scrim already covered that. It printed `VERDICT: COVERS`
  against a surface that was still broken. Find the sidebar by its shape (`position:fixed`, `x=0`,
  computed `z-index === "250"`), never by tag.
- **A z-bump is only real if nothing between the overlay and `<body>` creates a stacking context.**
  Two of the four overlays are NOT portaled, so that was measured before anything changed:
  `scripts/probe-overlay-stacking-context.mjs` walks the ancestor chain and reports every
  context-creating element. It found **0** above the composer, so no portal was needed. `.rv-in` is
  a known offender elsewhere in this codebase — this is not a theoretical concern.
- **Not every `fixed inset-0` is a scrim.** `embedded-composer.tsx`'s `z-10` is a transparent
  click-catcher and must stay BELOW the chrome: covering the nav would turn the first tap on a nav
  item into a dismiss instead of a navigation. The rule is "**dimming background ⇒ modal layer**",
  never "full-viewport ⇒ modal layer".
- **The ratchet guarding this cannot see two of the four shapes it was written for.** It keys on a
  dimming class sitting on the same node as the z, so it catches `sheet.tsx` and `audience-chip.tsx`
  and **misses** `room-drawer` (scrim is a CHILD element) and `SimulateDoorHost` (inline `style`
  background). Verified by stashing the fixes and re-running. That limit is written into the test
  file. Its green is a net for the common shape, not proof.
- **`git diff HEAD..origin/main -- <files>` is a TREE diff and echoes your own changes back**, which
  reads exactly like a five-file collision. Use `git show --stat <sha>` to ask what a commit
  actually touched.
- **`gh pr merge --delete-branch` can report `fatal: 'main' is already used by worktree` and still
  have merged.** That error is its post-merge attempt to switch the local checkout, not the merge.
  Check `gh pr view <n> --json state` before reacting; delete the branch separately.
- **An rgb-only colour census reports ZERO ambers and reds.** Tailwind v4 serialises
  `--color-warning`/`--color-error` as `lab()`. Handle `lab()`, `oklch()` and `rgb()`, and treat an
  unparseable colour as SUSPECT, never neutral. Cross-check every census against a screenshot.
- **A `grep -c "FAIL"` over a vitest log counts test NAMES.** `quota.test.ts > safety > FAILS OPEN
  when the count blows up` matched and read as a failure. Parse the summary block, not the stream.

## 3. Measured facts worth not re-deriving

**Colour census** — coloured elements at first render, 1440, signed in:
/discover **17** · /home 9 · /competitors 3 (was 6) · **/audience 5** · **/library 1** ·
**/settings 0** · /dev/cards ~100. Library and Settings prove the grammar is achievable;
Discover is the open call.

**Motion** — ⌘K palette, project picker and account menu measure `animationName: none` / `0s`.
Add-Competitor is a 200ms `ease` keyframe. `active:` press feedback exists on 10 elements, **all on
marketing routes, zero signed-in**. `prefers-reduced-transparency` and `prefers-contrast`: zero
occurrences app-wide. `--ease-spring` is an OVERSHOOT curve (`0.34,1.56,0.64,1`) with no consumers
— a trap, not a defect.

**The z-scale** (`globals.css`): base 0 · dropdown 100 · sticky 200 · **sidebar 250** ·
modal-backdrop 300 · modal 400 · toast 500 · tooltip 600. The sidebar sitting above `sticky` is
deliberate; modals must clear 250, which is the whole point of this lane's last two PRs.

## 4. Verification recipes that worked

**Signed-in browser session** — the login UI cannot be driven in dev (emailed-code-first; the
password toggle never hydrates). Use the committed minter, which reads `.env.local` itself so no
credential passes through a transcript:

```bash
node scripts/mint-auth-state.mjs http://localhost:3011   # writes .scratch/auth-state.json
```

**Reaching the ＋ door** (the only cheap way to measure `SimulateDoorHost` live):
it renders only from `AmbientStartHome`, i.e. the arrival home, which is the
`maven_active_thread=__new__` **cookie** state — not a route. Its trigger then sits at y≈1041 on a
900px viewport inside an inner scroller, so a `mouse.click` at the measured coordinate **misses**;
use a locator click, which auto-scrolls. Opening it is free — it lands on the intake step. Only
arming bills.

**Probes committed by this lane:**
- `scripts/probe-cmdk-scrim-layer.mjs` — hit-test the ⌘K scrim against the sidebar
- `scripts/probe-simdoor-layer.mjs` — the same for the ＋ door
- `scripts/probe-overlay-stacking-context.mjs` — ancestor chain, before touching any z

**Dev server:** one per port; a launchd reaper kills idle servers after ~10 minutes, so a
"crash" mid-probe is usually that. Check the port before blaming the app.

## 5. Gate

Run on the tree you are about to merge, not the pre-merge one — main moves under you.

```bash
node node_modules/typescript/bin/tsc --noEmit ; echo "exit $?"   # 0, and ZERO lines
node node_modules/vitest/vitest.mjs run --maxWorkers=3
npm run build                                                    # exit 0
```

At `55dbdca2` (this lane's last merge): tsc exit 0 / 0 lines · **6640 passed, 42 skipped, 0 failed**
(573 files) · build exit 0. Expect the count to have grown — other lanes add tests daily.

⚠️ `tsc` clean + suite green does **not** imply the build passes here: a `src/lib/surfaces/*` import
into an API route breaks `npm run build` while both stay green. Run all three.
⚠️ The suite flakes 0–7 tests non-deterministically in two known families. Re-run any failure in
isolation and ask whether that file can even reach your diff before blaming it.

## 6. Co-session hazard — this is not hypothetical

A second session ran against `~/virtuna-v1.1` throughout. In one sitting it: pushed this branch
mid-edit (capturing a commit that did not typecheck), merged a PR before the local session got
there, renamed the trunk checkout to a different branch, and swept two stray untracked scripts into
its own commit. Nothing was lost, but every one of those was a near-miss.

- Commit early, on your own branch.
- Never `git add -A` in the trunk.
- If a push is rejected as "behind", **investigate** — the remote may hold your own pre-amend
  commit. Land a follow-up commit rather than force-pushing.
- Long or multi-step work belongs in its own worktree. A new one needs its own `pnpm install`
  (~6s, shared store) and its own `.env.local` copied in — and `git worktree remove` destroys that
  copy, so copy it out first if it is not a duplicate of the trunk's.
