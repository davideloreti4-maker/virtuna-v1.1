# Next session — remix lane (copy-paste brief)

Paste the block below into a fresh session. It is written to be executed, not read.

⚠️ Not to be confused with `docs/NEXT-SESSION-2026-08-14.md`, which is the **in-thread chat** lane.
Different lane, different owner-session. This file is remix only.

---

```
Remix lane. Read docs/HANDOFF-2026-08-13-remix-card-and-frames.md FIRST — it is the entry
point and it SUPERSEDES docs/HANDOFF-2026-08-13-remix-next.md, three of whose claims are
measured false.

STATE: main 5612063d. PR #494 merged (card rework + phase 3 frames + a live probe).
tsc 0 · build 0 · 6395 passed / 42 skipped / 0 failed. Working tree clean.
Phase 3 is verified against a REAL video, not mocks: 4/4 frames, all distinct, 2.6s.

DO NOT re-investigate these — they are settled and measured:
  - The remix source strip has been a real <a> to TikTok since 51fadaf7 (2026-08-02).
    "Clicking does nothing" is a stale inherited claim.
  - CoverFill hides its play glyph UNDER the cover. That is why the strip now renders its
    own badge as a sibling. Do not "fix" CoverFill — it is shared with Account Read and
    Discover tiles.
  - Zero genuine creators have ever made a remix card (24 = e2e probe account, 7 = dev
    mock, 0 = real). Never quote 24/24 as a production rate.

WORK, in the order I'd do it:

1. [30 min, USER-VISIBLE BUG] use-remix-launch.ts:32-39 swallows HTTP errors.
   `await fetch(...)` never checks res.ok, then router.push("/home") regardless. A 402
   credit refusal or a 401 lands the creator on /home with no card and no message — it
   reads as the product being broken. pendingId also never clears on success.
   This is §6 of the design and the cheapest real fix in the lane. Write the red test first.

2. [ASK THE OWNER BEFORE BUILDING] Phase 4 clips may already be ruled ON.
   The old handoff says clips "need an explicit owner ruling". The DESIGN's §8 says:
   "Ruled: clips are worth it. Mitigations kept: ≤4s, muted, source mp4 still deleted,
   clips die with the thread, ≤8 per source." Confirm §8 still stands — it predates
   phase 1 and phase 3 — then it is an implementation job, not a decision:
   trim route + the derive-and-drop/T-03-02 amendment + rewriting three test files that
   encode the current line (analyze/__tests__/derive-and-drop.test.ts,
   analyze/__tests__/decode-route.test.ts C4 block,
   engine/__tests__/tiktok-url-branch.test.ts).
   Do NOT start on the strength of the handoff paragraph alone.

3. [Phase 2] The pre-brief has a backend and no UI. `brief` is accepted at route.ts:73
   (z.string().max(200).optional()), reaches adapt as `target` at remix-runner.ts:342, and
   NOTHING in src/components ever sends it. Build the surface, or delete the field — a
   backend with no producer is the silent-no-op shape that bit the profile columns.

4. [Owed] Retention. Nothing deletes remix_blueprints rows and the phase-3 frames inherit
   that — ≤8 JPEGs per run under a blueprintId prefix in the `filmstrips` bucket. No reaper
   exists. Flagged in beat-frames.ts, not silently left.

5. [Verify before closing §6] The multiplier fix looks DONE — both rankOutliers call sites
   attach attachOutlierReceipt (discover/route.ts:144, explore-runner.ts:179). But the
   design requires the LABEL to change with the basis ("vs their lifetime average", never
   "vs their usual views"), and outlier-receipt.ts:21 still documents a "vs their usual
   views" branch. Read that branch before calling §6 closed.

6. [Not started] Phase 5 revise_remix exists only in two code comments (blocks.ts:520,
   blueprint/[id]/route.ts:5).

KNOWN AND NOT IN SCOPE unless you decide otherwise:
  - The hero repeats as beat 0 near-verbatim. Left ON PURPOSE: it is a generation problem
    (adapt writes beat 0 as the hook), not a layout one. Fixing it in the renderer would
    hide real model behaviour.
  - beat.weakness is never rendered anywhere — factor + score stored, shown to nobody.
  - Three cards → three fetches of the same row (remix-beats.tsx:79).
  - A script entry whose index matches no beat is dropped silently, uncounted.
  - The card is 1764px tall at 390px.

RULES (each cost a previous session real time):
  - A single live run proves NOTHING. The adapt call is non-deterministic despite
    temperature 0 + a fixed seed. Sample N, report a rate.
  - vitest does not typecheck. Run tsc yourself. A green Vercel check is not a build.
  - Suite flakes under CPU load — kill the dev server first, use --maxWorkers=3, and check
    WHICH file failed before blaming your diff.
  - Open a NATIVE browser context per viewport. Resizing a loaded page is not the mobile UI.
  - /dev/cards needs the flags INLINE or you audit the flag-off UI:
      NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3007
  - [aria-label^="Remix:"] NO LONGER SELECTS THE CARD. PR #495 (d6b2e1af, F-14) replaced it
    with an sr-only <h3>. A Playwright locator that matches nothing fails as a TIMEOUT, which
    reads as "the card didn't render". Select #remix-shoot-sheet or the h3 text.
  - git fetch and re-measure every sha before branching AND before merging; a co-session is
    often active in this repo.
  - Re-derive any load-bearing claim you inherit from a doc. `git log -S'<symbol>' -- <file>`
    against the doc's own date: "never true" is an error, "true then fixed" is inheritance —
    and inheritance means every sibling claim in that document is suspect.

FREE PROBES (no Apify, no DashScope, no auth; use `node node_modules/tsx/dist/cli.mjs`,
never npx):
  node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
    --path "omni-split/59455-447571480576291.mp4"          # phase 3, ~3s, PASS/FAIL
  node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
    --path "omni-split/59455-447571480576291.mp4" --dump /tmp   # write the JPEGs to LOOK at
  node node_modules/tsx/dist/cli.mjs scripts/show-shoot-sheet.ts

🔴 BEFORE PLANNING ANYTHING BIG, SETTLE THE DEPLOY. Nothing has shipped since 2026-08-07 and
I could NOT confirm whether merging #494 changed that — the Vercel MCP 502'd, and a 200 from
virtuna-v11.vercel.app says nothing about which commit is live. Every item above builds onto
a shelf that may still be invisible to every human. Check it first; it is not a code problem.
```
