# Handoff — remix: proved live, and the plan for phases 4 + 5 (2026-08-14)

**Read this FIRST.** It follows `docs/HANDOFF-2026-08-14-remix-source-viewer.md` (still accurate —
that one describes the scrub strip + embed, merged as **#515**). This one records the first
complete live run, one bug it exposed, and everything phases 4 and 5 need.

**State:** `main` = `00416ac7` + this branch. Branch `lane/remix-clips-and-revise`, 1 commit
(the thumbnail fix). `tsc 0`. Phases 4 and 5 are **NOT started** — §4 and §5 below are the plan,
not a report.

---

## 1. ✅ "Nothing is running" is FALSE — proved, with receipts

One real run through the real UI, 2026-08-14, local dev against prod Supabase:

```
Apify tiktok-scraper runId:oEYSSMBS79RhgK0uj              ✓ resolve
decode_complete  cost_cents:0.0315                         ✓ decode
grid pass  durationS:86  gridFrames:242  resolved:38/38    ✓ frame extraction
adapt attempt 0 FAILED (SyntaxError: unterminated JSON @12204) → attempt 1 ok, 3 concepts
remix frames persisted  blueprintId:wSJ6hI2HHI0P  beatFrames:8  scrubFrames:30
POST /api/tools/remix/run 200 in 2.7min
```

It produced **`wSJ6hI2HHI0P` — the first `from_fixed_buckets: false` blueprint row this codebase
has ever written** (8 beats, 86s, 3 variants, source `@pulwasha_cooks`). Before it, the only row in
existence was a fabricated grid that renders the *"we couldn't read this video's timing"* branch.

The UI then rendered, on real data: **3 cards, 3 scrub strips (30 cells each), 24 beat rows, 3 lit
rows, 3 embed toggles, 0 iframes before click, zero page errors.** Card height **3005px at 390px**
with 8 beats — much taller than the 2036px the 4-beat fixture measured.

🔴 **The whole run takes ~2.7 minutes.** Any probe polling for a card needs a timeout well past
that; a 120s poll reports failure against a working pipeline.

🔴 **`adapt` attempt 0 failed and attempt 1 saved the run.** The retry is load-bearing.

---

## 2. One real bug, found only because the data was real

**Beat thumbnails were vertically stretched, by a different amount per row.** The `<li>` is a flex
container whose `align-items` resolves to `stretch`, which forces a flex item's cross-size — and
that overrides `aspect-ratio`, because `aspect-ratio` only derives a height while the height is
`auto`. Measured at 390px before the fix:

```
beat 0   44 x  78   ratio 0.563   ← short row, correct BY LUCK
beat 3   44 x 202   ratio 0.217
beat 4   44 x 145   ratio 0.303
```

Fixed with `self-start`; after, every row is 44×78.2 / 0.563. **Pre-existing since phase 3** and
invisible until real adapt copy made the rows tall — the `/dev/cards` fixture's short lines kept
rows near their natural height. happy-dom computes no layout, so the unit guard is a class
assertion and is labelled as the weak guard it is; the real proof is the browser measurement.

---

## 3. ⚠️ Two things I got wrong — do not repeat them

1. **The "Remix" button on a Discover tile is a deliberate MOUSE ACCELERATOR**, not an
   accessibility defect. `aria-hidden` + `tabIndex={-1}` + `pointer-events-none` until
   `group-hover` (`outliers-panel.tsx` ~344), all documented in place: an `opacity-0` button still
   takes a thumb tap, so on touch it used to fire an invisible remix. **The real, touch- and
   keyboard-reachable Remix is inside the teardown detail the tile opens.** For a probe: click the
   `article`, then the Remix button there. `getByRole("button",{name:/remix/i})` returns **0** while
   the DOM holds 24 — that looks like the Radix aria-hiding trap and is not it.
2. **Match error copy tightly.** A loose `/couldn.t/i` over `document.body.textContent` matched the
   word inside a hook template (*"I couldn't quit my lustful habits"*) and reported an on-screen
   error during a healthy run.

---

## 4. Phase 4 — clips. NOT started. The plan.

**The ruling exists and the owner reaffirmed it twice on 2026-08-14.** From the design's §8:

> **Retaining fragments of third-party video.** Raised twice, including once with the
> enforced-policy finding in hand. **Ruled: clips are worth it.** Mitigations kept: **≤4s, muted,
> source mp4 still deleted, clips die with the thread, ≤8 per source.**

Build to exactly those five mitigations. They are the ruling, not suggestions.

### What it touches

| Piece | Why |
|---|---|
| A trim step | ffmpeg `-ss <beat.t_start> -t <=4 -an` per beat. **Reuse the single-pass lesson** — the cost is the connection, not the work ([[ffmpeg-per-frame-seeks-are-the-cost]]); do not spawn 8 separate seeking ffmpegs against the remote URL. |
| `cleanup()` ownership | 🔴 **The hard part.** `remix-runner.ts:529` drops the temp mp4 unconditionally in a `finally` (T-03-02, derive-and-drop). Clips must be cut BEFORE that, exactly as `extractBeatFrames` already is — **follow the frames pattern and the invariant does not move at all.** That is the cheap route and it is why frames were built first. |
| Storage | `remix_blueprints.clip_uris` **already exists on the table** and is deliberately not read (`blueprint-repo.ts`, `BLUEPRINT_COLUMNS` comment). Bucket choice is open — `filmstrips` is for stills; a `clips` bucket is cleaner and keeps the never-reaped problem separable. |
| Route | `GET /api/remix/blueprint/[id]` adds `clips` the same way `scrubFrames` was added. |
| UI | The beat row already has a frame slot. A clip replaces the still on that row, or the stage plays it. **Decide with the owner** — the scrub stage is the obvious home. |
| Tests | Three files encode the current no-retention line and will need rewriting: `analyze/__tests__/derive-and-drop.test.ts`, `analyze/__tests__/decode-route.test.ts` (C4 block), `engine/__tests__/tiktok-url-branch.test.ts`. |

### Retention — the mitigation with no mechanism yet

*"Clips die with the thread"* and *"source mp4 still deleted"* are the two mitigations with teeth,
and **nothing today deletes a `remix_blueprints` row**, so "die with the thread" has no
implementation. Phase 4 must ship its own reaper or the ruling's mitigation is decorative. This is
the one part that is genuinely new work rather than a repeat of the frames pattern.

---

## 5. Phase 5 — `revise_remix`. NOT started.

It exists **only in two code comments**: `blocks.ts:520` and `blueprint/[id]/route.ts:5`. Nothing
implements it. There is no spec, so **this needs a brainstorm with the owner before code** — what a
revision revises (the script? one beat? the angle?), whether it re-runs adapt or edits in place,
whether it costs a billed call, and what it does to the persisted row that three cards share.

⚠️ **One row serves ALL of a run's ranked cards** — one source video, one skeleton, N adapted
scripts, indexed by `blueprintVariant`. A revision that rewrites `script` must rewrite only its own
variant, or it silently rewrites the other two cards.

---

## 6. Commands

```bash
# Free — no Apify, no DashScope. Both frame sets + the keyspace check.
node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
  --path "omni-split/59455-447571480576291.mp4"      # --dump /tmp to LOOK at the JPEGs

# Seed a real shoot sheet. ⚠️ WRITES TO THE SHARED PROD DATABASE — always --drop after.
node node_modules/tsx/dist/cli.mjs scripts/seed-remix-blueprint.ts \
  --email e2e-test@virtuna.local --path "omni-split/59455-447571480576291.mp4" \
  --source "https://www.tiktok.com/@maritimeinsight.id/video/7671258420019744021"
node node_modules/tsx/dist/cli.mjs scripts/seed-remix-blueprint.ts --drop <blueprintId>

# Signed-in browser. /dev/cards is AUTH-GATED — without this you screenshot the login page.
E2E_BASE_URL=http://localhost:3012 E2E_USER_EMAIL='e2e-test@virtuna.local' \
  E2E_USER_PASSWORD='e2e-test-password-2026' \
  node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts
NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3012
```

A LIVE run: `/feed` → click an `article` → the Remix button in the teardown detail → wait ≥3 min.
Billing does not block locally (`BILLING_ENFORCE_QUOTA` unset ⇒ `isQuotaEnforced()` false, and the
user is authenticated so not anonymous). `LIVE_SCRAPE_DEFAULT` gates *grounding* scrape only — it
does **not** gate a remix run.

---

## 7. Open

- **Phase 4 + phase 5** — §4 and §5 above. The owner wants both.
- 🔴 **`PLATFORM = "tiktok"` hardcoded** in `use-remix-launch.ts` while 63% of the corpus is
  Instagram. Doesn't break remixing (never reaches resolution) but grounds every Instagram remix as
  TikTok. Separate lane.
- **Card height is 3005px at 390px** on a real 8-beat sheet. Length has never been in scope; at
  three cards per run it is worth a decision.
- **No reaper** for `remix_blueprints`, `filmstrips`, or (phase 4) clips.
- `beat.weakness` stored and rendered to nobody · hero repeats as beat 0 (left on purpose, it is a
  generation problem) · three cards → three fetches of the same row · a script entry whose `index`
  matches no beat is dropped silently.

---

## 8. Standing rules

- **Deploy is OFF, owner-confirmed.** Merging does not deploy. Nothing may have "watch it in
  production" as its success criterion.
- **A single live run proves nothing about generation quality** — adapt is non-deterministic at
  temperature 0. Sample N, report a rate. (A single run *does* prove the plumbing runs, which is
  what §1 claims and nothing more.)
- vitest does not typecheck. Run `tsc`. A green Vercel check is not a build.
- Kill the dev server before the suite; `--maxWorkers=3`. The suite flakes 0–5 tests in
  `scraping/resolve-video` + `engine/omni-analysis-*` — check WHICH file before blaming your diff.
- **A launchd reaper kills idle dev servers after ~10 min.**
- **`.githooks/post-commit` AUTO-PUSHES**, so a later push can be rejected as non-fast-forward on a
  branch you never pushed. Check `git cherry -v HEAD origin/<branch>` (every `-` is already yours by
  patch-id), then force with an **explicit lease on the sha you inspected** and read the
  `+ <old>...<new>` line.
- `main` moved **three times** during the last session. `git fetch` and re-measure before branching
  and before merging.
- Native browser context per viewport; resizing a loaded page is not the mobile UI.
