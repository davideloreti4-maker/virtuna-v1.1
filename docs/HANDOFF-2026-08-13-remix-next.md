# Handoff — remix: what it was for, what exists, and the card rework (2026-08-13)

**Lane:** `lane/remix-shoot-sheet` · worktree `~/virtuna-remix-shoot-sheet`
**Everything below is MERGED and on `main`.** Nothing is deployed.
**Owner's new scope this session: the remix CARD needs real rework — starting with showing the
actual video.** §4 is that work; §1–§3 are the state it lands on.

---

## 0. ▶️ In one paragraph

A creator finds a video that blew up and wants their own version of it. Remix should hand them a
shot list — *say this at 0–3s, cut here at 7s, say that at 12s* — copied from the video that
already worked, but about their topic. **"Copy what's working, in minutes."** The machine that
reads the video and writes the sheet is built and merged. **Four of the design's five phases are
not built, and no human has ever seen the finished part in the running product.**

---

## 1. Where the 5-phase design actually stands

| Phase | Content | Status |
|---|---|---|
| **1** | `SourceBlueprint` + merge-to-8 beats + `remix_blueprints` + adapt rewrite + echo test + minimal text renderer | **merged; live gate never formally passed** |
| **2** | Pre-brief (D3) + the two §6 fixes | **not started** |
| **3** | Frames on the beat rows | **not started — and UNBLOCKED, see §4** |
| **4** | Policy amendment + trim route + clips + dedupe + retention | **not started — carries the D7 reversal** |
| **5** | `revise_remix` | **not started** |

Phase 1 was a 7-task SDD plan plus a controller-added Task 5.5. Tasks 1–6 and 5.5 are CLOSED.
Ledger: `.superpowers/sdd/2026-08-10-remix-shoot-sheet-phase1/progress.md` — it is long and it is
worth reading before touching `blueprint.ts`.

**Task 7 (live verification) is the open one.** Its two hard blockers were closed on 2026-08-12,
so what remains is measurement, not repair — and that measurement can only happen in production
(§3).

---

## 2. The two things Phase 1 found that matter more than Phase 1

**Remix was dead in production for two months and nothing was red.** D-R1 (2026-06-11) made the
Read a pure sensor and stopped it emitting `factors[]`; `omniOutputToStructuralInput` still
*required* that field, so it returned null on every real omni output from that day forward.
**5,964 tests missed it** because every test in the tree hand-builds its own
`OmniStructuralInput` — the suite mirrored the producer instead of tracking it. Fixed in-lane
(perception required, judgment optional).

**The adapt call is not deterministic**, despite `temperature: 0`, a fixed seed, and a comment
calling itself *"reproducible (D-04 determinism requirement)"*. Three byte-identical inputs gave
three distinct outputs. ⚠️ **One live run can never clear a gate on this path — sample N and
report a rate.** See [[adapt-call-is-nondeterministic]].

---

## 3. Phase 1's remaining verification is deploy-blocked

The last two open items are **log lines that ARE their own metrics**:

- `"no script[] despite a beat map — retrying"`
- `"adapt returned over-cap prose — trimming it"`

The handoff's words: *"neither has a prod sample yet, **because nothing here is deployed**."*
Production last shipped **2026-08-07**; ~283 commits and 33 merged PRs are behind that wall.
`numenmachines.com` 404s **by design** — verify on `virtuna-v11.vercel.app`, which serves Aug-7
code. See [[vercel-git-disconnected]].

**This is why Phase 1 cannot be judged, and Phase 4 cannot be justified.** The design says Phase 1
exists to inform whether the D7 reversal is worth paying for: *"if the remix still doesn't feel
like a cheatcode, phase 4's policy reversal never has to be paid for."* Nobody can make that call
from a probe.

---

## 4. 🔴 THE CARD REWORK — the owner's new scope

### 4.1 The play button is a lie, and this is the fastest thing to fix

`CoverFill` (`src/components/primitives/CoverFill.tsx`) renders **a still image with a decorative
Phosphor `Play` glyph underneath it**. It is `aria-hidden`, it is not a control, and **nothing
plays**. The remix card uses it in two places — the hero cover (`remix-card-block.tsx:128`) and
the `SourceStrip` (`:357`).

A creator sees a video thumbnail with a play button on it. Clicking does nothing. That is the
gap the owner is pointing at, and it is currently the card's most misleading pixel.

Three ways out, cheapest first — **this is an owner call, not an implementer's:**

1. **Open the source.** The card already knows the source URL. A click opens the real TikTok in a
   new tab. No policy work, no storage, no phase. Honest, and it makes the glyph mean something.
2. **Frames per beat (Phase 3).** See §4.2 — this is the one with real product value.
3. **Playable muted clips (Phase 4).** Needs the D7 reversal. See §4.3.

### 4.2 ✅ Frames are UNBLOCKED — the design says so explicitly

> **"Frames need no policy work at all** — `extractFrameAtTimestamp` + `uploadFrameAndGetSignedUrl`
> already persist `keyframe_uri` today, and take exactly the segment shape omni produces."
> — design §5.4

**The machinery exists and already takes the shape the blueprint has.** Phase 3 is "frames on the
beat rows", and a real frame from the source beside *"0–3s · HOOK"* is a far better answer to
"show me the video" than one cover image at the top. **Start here.** It is the highest
value-per-risk item in the whole lane.

### 4.3 Clips are policy-gated — do not start here

Phase 4 amends `derive-and-drop` / `T-03-02`, which today reads *"source media is not owned"* and
deletes a re-hosted TikTok unconditionally in a `finally`. The amendment permits **muted fragments
of ≤4s** as derived artifacts, retained on the thread that produced them. `video_storage_path` is
still never set for a scraped source.

It also **rewrites three test files that encode the current line and will fail by design**:
`analyze/__tests__/derive-and-drop.test.ts`, `analyze/__tests__/decode-route.test.ts` (C4 block),
`engine/__tests__/tiktok-url-branch.test.ts`.

And it moves lifecycle ownership: the trim route downloads/trims/uploads/deletes, and the runner's
`finally` fires only if the trim route was never reached.

**This is a policy reversal with legal-ish shape. It needs an explicit owner ruling, and Phase 1's
live judgement is supposed to be the input to it.**

### 4.4 Card defects already on record — not yet fixed

From the Task 6 ledger entries, all still true:

- **No loading state.** The card renders, then the sheet appears when the fetch lands — the card
  visibly grows. Deliberate (a skeleton for a row that may not exist was the worse option), but
  never measured against a real network.
- **Three cards, three fetches of the same row.** Correct and cheap at phase-1 volume; the obvious
  fold-in when phase 3 collapses the three cards into one ranked sheet.
- **A script entry whose `index` matches no beat is dropped silently.** The reverse case (a beat
  with no line) renders *"No line was written for this beat."* Nothing counts or reports the drop.
- **`weakness.factor` is never rendered anywhere**, so Task 1's deferred minor (it stores raw
  casing/whitespace) is still untouched.
- **A fabricated sheet says so** (`from_fixed_buckets === true` → *"We couldn't read this video's
  timing…"*). Keep that. It is the one absence with a cause worth naming.

### 4.5 ⚠️ What was NEVER verified about this card

Stated plainly in the ledger, and it is the reason a browser pass comes first:

- **No live remix run, no signed-in card, no real row read through the route.** The rendered sheet
  was fed a **stubbed fetch** — the payload shape it rendered is the shape the implementer wrote,
  not one PostgREST produced.
- **Never opened at mobile width.** Measured at a 418px card, but *"measured narrow is not opened
  at 390px."* See [[screenshot-viewport-must-be-native]] — resizing a loaded page does not give you
  the mobile UI; open a native context at that size.

**So: do not trust any existing statement about how this card looks. Go and look at it.**

---

## 5. How to look at it — the shortest path

`/dev/cards` → **Skills → Remix · shoot sheet** renders the sheet from a fixture shaped from a
**real generated sheet** (`scripts/show-shoot-sheet.ts`), not invented: four beats, uneven
durations, one beat the source left silent, one WEAK beat carrying its repair note. Landed in
PR #486 today, precisely because the sheet had been unviewable in the gallery since it shipped.

⚠️ **An earlier handoff claims `/dev/cards` "renders only the app shell" and will not mount. That
was instrument error, not a defect** — `innerText` is layout-aware and hid a fully-mounted surface
(2516 chars reported against 24825 actual). Use `textContent`. See
[[innertext-hides-a-mounted-surface]].

Dev server flags — a bare `npm run dev` silently serves the **flag-off** UI and it looks like a
legitimate surface:

```bash
NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3007
```

then hard-reload (⌘⇧R). Check `lsof -ti:3007` first — one dev server per port, and a launchd
reaper kills idle ones after 10 minutes ([[dev-server-reaper]]).

**Free probes** (no Apify, no dev server, no auth; ~2¢ a run, and `node node_modules/tsx/dist/cli.mjs`,
never `npx` — [[npx-wrapper-eats-output]]):

```bash
OBJ="omni-split/59455-447571480576291.mp4"   # 28s, three speakers, real speech
node node_modules/tsx/dist/cli.mjs scripts/probe-perceived-segments.ts --path "$OBJ"
node node_modules/tsx/dist/cli.mjs scripts/probe-echo-check.ts --path "$OBJ" --niche fitness
node node_modules/tsx/dist/cli.mjs scripts/show-shoot-sheet.ts
```

---

## 6. Recommended order

1. **Look at the card in a browser, signed in, at 390px and at desktop.** Produce a real findings
   list. Everything in §4.4 is second-hand; the owner says the card needs "a lot" of work and
   nobody has audited it.
2. **Kill the fake play button** — decide between §4.1's three options with the owner. Option 1
   (open the source) is a same-session fix.
3. **Phase 3 frames.** Unblocked, machinery exists, best value-per-risk in the lane.
4. **Then** re-open the Phase 1 gate and Phase 4's policy question — both need a deploy.

⚠️ **Deploy is the gate behind items 3 and 4**, and it is not a code problem. Consider settling it
before building more onto a six-day-old shelf.

---

## 7. Traps carried forward

- **`.scratch/` is gitignored and holds the only copy of many runs.** Copy files out before any
  `git worktree remove` — it deletes gitignored files ([[worktree-untracked-files-are-load-bearing]]).
- **vitest does not typecheck.** This lane caught three separate literals that green tests sailed
  through and only `tsc` saw. Run `tsc` yourself; a green Vercel check is not a build.
- **The suite flakes on a loaded box.** Use `--maxWorkers=3`, and check *which* files failed before
  blaming your diff ([[suite-flakes-scraping-omni]]).
- **A single live run proves nothing here.** Sample N, report a rate.
- **`main` moves under you** — a co-session is active in this repo. `git fetch` and re-measure
  every sha before branching and before merging ([[co-sessions-move-refs-underneath-you]]).
- The `remix_blueprints` migration is **applied** (2026-08-11, verified: rls on, 1 policy, both
  FKs, 4 indexes). Rows accumulate and **nothing deletes them** — no retention story yet.
