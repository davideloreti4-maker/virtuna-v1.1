## Task 7: Live verification

**Files:** none — this task produces evidence, not code.

A green suite proves nothing here. Blueprint assembly has only ever been exercised against handwritten fixtures, and the known failure modes of this pipeline are all shape failures from a real model response: `structure` returned as a list where an object was expected, subtitles served in two formats, a partial `production` block failing the whole parse. **The first real run is the test that counts.**

- [ ] **Step 1: Confirm every gate is green before spending money**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. A live run against a broken build wastes an Apify credit and an Omni call.

- [ ] **Step 2: Start the dev server on a free port**

```bash
lsof -ti:3000   # if occupied, pick another
npm run dev -- --port 3001
```

- [ ] **Step 3: Run a real remix and capture the evidence**

Sign in, go to `/feed`, tap **Remix** on any outlier tile. Wait for the card. Then capture:

- the runner's log line for beat count and `has_speech`
- the `remix_blueprints` row: `select id, jsonb_array_length(blueprint->'beats') as beats, jsonb_array_length(script) as variants from remix_blueprints order by created_at desc limit 1;`
- a screenshot of the card showing the beat rows

- [ ] **Step 4: Verify the four things fixtures cannot prove**

- [ ] Beat count is **≤ 8** on a real video, and the timeline has no gaps.
- [ ] `spoken` on the source beats holds **real transcribed speech**, not nulls — if every beat is null on a talking-head video, the omni response is not carrying `spoken_text` and Task 1's input assumption is wrong.
- [ ] Adapted lines are **duration-plausible**: read each aloud against its beat length.
- [ ] Run `sharedContentTokens(sourceBeat.spoken, adaptedBeat.spoken)` over each pair. **More than one shared token on any beat means the model is paraphrasing the source's topic** — the D-01 reversal has failed and the prompt needs a stronger separation instruction before this ships.

- [ ] **Step 5: Record the result honestly**

Append the measured numbers to the spec under a new "Phase 1 live run" heading — beat counts, whether speech was present, the echo-token result, and anything that failed. If a check failed, say so and stop; do not proceed to phase 2 on a failed echo check.

- [ ] **Step 6: Commit the evidence**

```bash
git add docs/superpowers/specs/2026-08-10-remix-shoot-sheet-design.md
git commit -m "test(remix): phase 1 live run — measured beat counts and echo check"
```

---

## Done when

- `npx tsc --noEmit` clean and `npm test` green.
- The migration has been applied by hand and RLS verified (Task 4, Step 6).
- A real remix produces ≤8 beats with real speech, and the echo check passes on every beat.
- A remix card persisted before this lane still renders identically — no `blueprintId`, no beat rows, no error.

## Deliberately not in this plan

Pre-brief UI, the multiplier and `res.ok` fixes (phase 2), frames (phase 3), clips and the `derive-and-drop` amendment (phase 4), `revise_remix` (phase 5). Phase 1 exists to answer one question — *does a duration-matched, beat-mapped remix actually read as a faithful copy?* — before any of those are paid for.
