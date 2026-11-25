# The hook card and the hook result (part 3, slice 2)

> **Superseded in part, 2026-11-21.** The thread is now one system: `2026-11-21-thread-answers-design.md`. Where
> they disagree that spec and its drawing win: Simulate all runs one after another (not in parallel); a hook's
> details open in a bottom sheet (not in place); Inter only (no serif hero); "Best" needs a 10-point lead; the
> price sits in the button's `em`. The pack card and per-row Simulate are built in rework step 1; the sheet,
> the hook result page and its endpoint (§4.2) in step 2.

Date: 2026-11-21 · Status: design approved by the owner 2026-11-21 ("continue with what you rec", on
the design below as proposed) · Build part 3 of 6, slice 2 of 5 · Slice 1:
`docs/superpowers/specs/2026-11-20-thread-field-design.md`

## 1. Where this sits

Hook cards are 63% of everything a thread produces (653 of 1,030 result blocks on the test account;
packs of five on 115 of 141 messages). Today each hook is its own card with a projected score
("7/10 stop", a band, "N% of your audience"), and its door "Simulate with your audience" fires a text
simulation and opens the old audience room. This slice gives a pack one card, lets the creator simulate
each hook (or all), and opens each simulated hook's own result page. Behind `NEXT_PUBLIC_NEW_LOOK`.

## 2. Rulings this rests on (owner)

- 2026-11-16: prepared drafts arrive WITHOUT a score; nothing is simulated unless the creator fires it.
- 2026-11-18: say "Simulate", never "Test"; one primary action per card, next steps quiet; show it
  through UI, not text; consumer-simple (about a dozen things per screen); ten viewer groups.
- 2026-11-20: part 3 in five slices; slice 2 = the hook card with a Simulate per hook that opens the hook
  result. The hook result shows the number and the audience (the ring and ten rows with a percent): no
  sentence, no Brain (part 2 spec §6, moved here).
- 2026-11-21: this design, as proposed.

## 3. Facts it must respect (measured)

- A hook simulation (`POST /api/tools/react`) takes 7 to 11 seconds, costs 1 credit, and sends no
  progress. With `persist: true` it writes the seal into `threads.sim_seals`, keyed by the trimmed hook
  text.
- **The number is `population.stopPct`** ("would stop to watch", 1,000 viewers modelled on the creator's
  audience). The answer also carries `fraction` ("7/10 stop", ten simulated viewers); the two disagree
  (70% against 30% and 24% on the same hook). Today's room shows the fraction. The new card and page show
  only `population.stopPct` and never the fraction, the band or the seal's `pct` (which held the fraction
  on older seals).
- Two runs of one hook differed by 6 points (30 and 24). Groups split all-or-nothing (Savers 100% on both
  runs, Regulars 0 to 1%).
- A seal without a population (older seals, 7 of 20 on the test account) has no number: that hook shows
  as not simulated.
- No endpoint returns one seal by thread id today; `GET /api/threads/open` covers only the open thread.

## 4. The design

### 4.1 The pack card (in the thread)

Consecutive hook cards of one answer render as ONE card (a pack; usually five, sometimes three). Old
threads render the same way: the grouping happens at render time, nothing is migrated.

- **Rows:** each hook as a row: the hook text, and at its right a small gauge (the result page's gauge
  shape). Not simulated: an empty track and the word "Simulate" (the row's button, 1 credit). Simulating:
  the gauge pulses softly (not under reduced motion); no number, no percent. Simulated: the number
  ("30%"), the arc filled to it, and the row is a link to its result page (a chevron).
- **No projected score anywhere:** no "7/10", no band, no "N% of your audience", no "Made for …".
- **The card's one primary:** "Simulate all 5 · 5 credits" while any hook is not simulated (it fires the
  missing ones in parallel; the price counts only those); once all are simulated, "Write the script for
  the best", the best being the highest number (marked "Best" on its row). It runs today's "Write the
  script" for that hook.
- **A row opened** (a tap on its text): the row expands in place with today's details, quiet: "Why it
  works" (the mechanism), the visual idea, the proven example if present (cover, handle, "4.9× vs
  followers", views), and small actions Copy · Save · "Write the script from this one". One row open at a
  time.
- A failed simulation: that row says "Could not simulate. Try again" (nothing is charged on a failure,
  as today) and keeps its Simulate.

### 4.2 The hook result page

Address `/simulation/hook/[threadId]/[key]`, the key a short hash of the trimmed hook text (10
characters of a SHA-256, base64url; 20 distinct keys for 20 stored seals). A new read-only endpoint
`GET /api/threads/[id]/seals/[key]` returns that one seal (owner-checked; 404 when the thread is not the
caller's, the key matches no seal, or the seal has no population).

- Back and the title "Hook".
- The hook text as the hero (the cards' serif).
- The gauge: the number and "would stop to watch".
- The ring of the ten groups (1,000 dots, wedges sized by each group's share, each wedge lit to its group's
  percent; ink and greys only).
- Ten rows: the group's name (`archetypeDisplayName`, never the stored display name), its percent, its
  share as a quiet second line ("18% of your audience"), sorted by percent.
- Caption: "A simulation of 1,000 viewers modelled on your audience."
- Not found: "This hook has no simulation yet." and Back.

### 4.3 What does not change

The `react` request, its price and the seal format; the hook card's other actions and what they do;
"Write the script" (a chat turn with the script skill, 2 credits); the room (it stays for other cards
until their slices).

## 5. How it is built

- Pure functions in `src/lib/hooks-result/` (or beside `src/lib/result/`): group a message's blocks into
  packs, the seal key hash, a seal's number and groups, the best hook.
- New-look components in `src/components/thread-next/` (the pack card, a hook row, the small gauge) and
  `src/components/result/` (the hook result page, reusing the gauge and the ring).
- Under the flag, `MessageBlocks` renders a run of hook cards as one pack card; the Simulate action calls
  today's fire path (`fireCardSim` → `react` with `persist: true`) and reads the seal it writes; it does
  not open the room. Flag off: unchanged.
- The endpoint and the page route, behind the flag (not found when it is off).

## 6. Not in this slice

The idea, script and remix cards (slice 4), the video card (slice 3), Home (slice 5), "your usual" for
hooks (parked), a verdict sentence, the Brain on a hook, comparing hooks side by side, sharing.

## 7. Done when

1. With the flag off the app renders exactly as before.
2. A real hooks thread shows its five hooks as one card with empty gauges, no projected score, and
   "Simulate all 5 · 5 credits".
3. Simulate on one row runs one real `react` (1 credit), the row pulses, then shows `population.stopPct`
   and links to its result page; a reload keeps it (the seal).
4. "Simulate all" runs the missing ones in parallel and charges only those; the best is marked and the
   primary becomes "Write the script for the best".
5. The result page opens from the row and from its address after a reload; it shows the number, the ring
   and ten rows that match the seal; a foreign thread or unknown key is not found.
6. Phone and desktop, light and dark, match the reference drawn for this slice
   (`.scratch/next-look/part3/slice2/hook-card-reference.png`) in a browser.
7. Keyboard and names: each row's Simulate and link are reachable and named with the hook; the card's
   primary is one button; focus visible.

## 8. Known gaps

- The number moves by several points between runs of one hook; a simulated hook is not re-run
  automatically, and a second Simulate on a simulated hook is not offered in this slice.
- Packs from before the seal format had a population show their hooks as not simulated.
- "Write the script for the best" picks by one run's number, which is noisy (§3).
