# Thread answers, step 2: the details sheet and the result page of a text simulation

Date: 2026-11-22 · Status: written on the owner's word "go with your recommendation" (2026-11-22), to be shown
to him before the build · Behind `NEXT_PUBLIC_NEW_LOOK` · Step 1: `2026-11-21-thread-answers-design.md` (built,
`4f5913ff`) · Drawing (approved 2026-11-21): `.scratch/next-look/part3/answers/answer-system.png`, screens
**P6** (a hook opened, `renders/ax-p6.png`) and **P7** (the hook result, `renders/ax-p7.png` + "P7 scrolled" on
the sheet) · Earlier design of the same page: `2026-11-21-hook-card-design.md` §4.2 (superseded where this
spec differs) · Seam map: `.scratch/next-look/part3/slice2/seam-map.md` §3-§5.

## 1. What step 2 adds

1. **A row opens its details.** A tap on a hook or an idea row in a pack opens a sheet with everything the old
   card carried, quietly, and the one action "Script this one".
2. **A simulated text has a result page.** The number, the ring of 1,000 viewers lit by group, and the ten
   groups with their percent. Reached from the sheet, and from a simulated script opener or remix hook.
3. **"Script this one" works from the page too:** it returns to the thread and runs the script there.

Step 1's rules hold (one card, one ink primary with its price, Inter, ink and greys, no "usual", no projected
score, "Simulate" never "Test").

## 2. Rulings and facts it rests on

- Owner: nothing is simulated unless the creator fires it; consumer-simple (about a dozen things per screen);
  a hook result shows the number and the audience (ring + ten rows), no sentence, no Brain; ten viewer groups
  by their display names; the result page is where depth lives.
- The number is `population.stopPct` ("would stop to watch"), never the seal's `pct`, `fraction` or `band`.
  A seal without a population has no number (shown as not simulated, no page).
- Seals live in `threads.sim_seals`, keyed by the trimmed text; no endpoint returns one seal by thread id today.
- Leaving `/home` unmounts the composer; a run can only start from the thread's composer.

## 3. The details sheet (P6)

**Opens from:** a tap anywhere on a hook or idea row except its gauge (the row is one button, named "Open: <text>",
with a chevron at its right, as drawn on P5). The empty gauge stays the row's Simulate button (step 1).
**Where:** a bottom sheet on the phone (as More), a centred dialog 560 wide from 768 up (same content). Escape,
the scrim and the grab handle close it; focus returns to the row.

**A hook's sheet, top to bottom:**
1. The hook text, large (the drawing's 19 / 26 at 620; built 18 / 26 at 620, the type scale's step the remix hook uses).
2. The gauge row: the small gauge, then
   - simulated: "would stop to watch ›", a link to the result page;
   - not simulated: "Simulate" with "1 credit" (fires the same queue as the row);
   - waiting / running: "Simulating", no link;
   - failed: "Couldn't simulate" and the Simulate action;
   then, at the right, **Copy** and **Save** as round icon buttons (44 px).
3. **Why it works:** `mechanism`, its first sentence with "More" when it has more (expands in place).
4. **Visual:** `visualHook.onScreen` (omitted when the hook has no visual).
5. **Proven:** the proof row: cover, `@handle`, "{multiplier}× {basis} · {views} views" (basis worded as step 1:
   "their followers", "their average", never "usual"), an external-link mark; the row opens `videoUrl` in a new
   tab (omitted when there is no proof).
6. The primary **"Script this one" · "2 credits"**: today's write-script turn for this hook (closes the sheet,
   the script lands at the bottom of the thread).

Not shown: fraction, band, scroll quote, target ("Made for …"), rank, seed line, channel.

**An idea's sheet:** the title, the gauge row (as above), **The take** (`take`, whole), **Why it fits**
(`whyItFits`, first sentence + More), **Format** (`format`, when present), then "Script this one" with the idea's
`seedHook` (else its title), as the pack's own "Script idea K". Save stores it as an idea.

**Save** is a new-look button over the existing saved-items hooks (same `ref_id` from the block's origin, same
thread provenance): outline bookmark, filled bookmark in ink when saved (no accent), "Saved" announced. **Copy**
copies the hook text (an idea: its title) and announces "Copied".

## 4. The result page (P7)

**Address:** `/simulation/hook/[threadId]/[key]` for a hook or a remix hook, `?as=idea` for an idea,
`?as=opening` for a script's opening line. `key` = the first 10 characters of the base64url SHA-256 of the
trimmed text (one pure async function shared by every link and the endpoint). Behind the flag; not found when
it is off.

**Endpoint:** `GET /api/threads/[id]/seals/[key]`: signed in (401), the thread is the caller's (any status,
open or archived), the key matches a text seal (not a video seal) that has a `population` with a numeric
`stopPct`; returns `{ text, at, population, open }` (`open`: the thread's type is "open"); anything else 404 (a foreign thread, an unknown key, a seal
without a population, an anonymous funnel visitor, a malformed id or key). Read-only, no CSRF guard (GET).

**The page, top to bottom (phone; desktop the same column, 640 wide, with the desktop result header):**
1. Header: Back and the title "Hook" ("Idea", "Opening line"). No Share (nothing can be shared yet).
2. Card: the text as the hero (same size as the sheet's), a hairline, the big gauge (the result page's `Gauge`,
   `Math.round(stopPct)`, "would stop to watch"), and the primary **"Script this one" · "2 credits"** (not on
   an opening line: it is already a script; not on an archived thread: a new turn can only land in an open one).
3. Card: the ring of 1,000 dots, one wedge per group sized by its share (the ten groups, in the ring order the
   video page uses), each wedge lit to its group's percent, ink and greys only; "1,000 viewers" in the centre;
   the caption "Each dot is a viewer. Dark ones would stop."
4. Card: **"Would stop, by group"**: ten rows sorted by percent, highest first: the group's display name
   (`groupName`, never the stored display name), "{share}% of your audience" under it, the percent at the right.
5. Loading: the three cards as quiet blocks (no fake numbers). Not found: "This simulation isn't here." and Back.

**"Script this one" from the page:** sets the active thread to the page's thread and goes to
`/home?scriptFrom=<the text>`; the composer reads the parameter once, after that thread has loaded, runs
today's write-script turn with it, and removes the parameter from the address. Behind the flag; a missing or
empty parameter does nothing.

## 5. What changes in the thread

- Pack rows (hooks, ideas): the row becomes a button that opens its sheet, with a chevron; the gauge keeps its
  role (empty: Simulate; done: the number, not a separate link).
- A simulated script opener and a simulated remix hook: their gauge slot's label becomes a link to the result
  page ("would stop to watch ›"), as in the sheet.
- No change to the queue, the prices, "Simulate all", Best, the sentence or the chips.

## 5b. Resolved while planning (2026-11-22, controller; the owner's to overturn)

- Text size: the drawing (19 / 26 at 620) wins over this spec's first 22 / 28; built 18 / 26 (type scale).
- An archived thread's page has no "Script this one" (the active-thread cookie steers only to open threads).
- An idea's page scripts from the idea's title (the seal stores no seed hook); its sheet uses the seed hook.

## 6. Not in step 2

Re-simulating a simulated text; Share; the Brain on a text; comparing texts; the hook/idea sheet for packs
outside a thread (Library); "Why?" and other chips without a curated entry; the video card (built in step 1);
Home and the new chat (slice 5).

## 7. Done when

1. Flag off renders and behaves exactly as before (flag-off suites green; flag-off production build matches
   the baseline; the new route and endpoint are not found).
2. `/dev/answers` renders P6 (hook sheet, simulated and not), an idea sheet and P7 (page, phone and desktop,
   light and dark), and they match the drawing in a full-window side-by-side.
3. On a real thread: a row opens its sheet; Simulate in the sheet runs one `react` (1 credit) and the gauge
   fills; "would stop to watch ›" opens the page; the page's number and ten groups equal the stored seal;
   a reload of the page shows the same; a foreign thread id or unknown key shows "This simulation isn't here."
4. "Script this one" from the sheet and from the page each runs one write-script turn (2 credits) in the right
   thread; from the page it lands back in the thread with the script at the bottom.
5. Keyboard: rows, sheet controls, Copy, Save, the page's primary and Back are reachable, named, ≥ 44 px on
   touch, focus visible; the sheet returns focus to its row.
6. An independent critic reviewed the full-window renders; its points applied or answered.

## 8. As built (2026-11-23): where the build departs from the sections above

Built by the plan's six tasks, each reviewed, then a review pass by the controller on real threads. The
sections above are the design as approved; this section is what the code does where it differs.

**Departures decided while building (the owner's to overturn):**

1. **"Script this one" from the page never travels in the address** (§4 said `/home?scriptFrom=<the text>`).
   An address that starts a paid turn could be sent to a creator as a link. The page leaves the text for its
   thread in the tab's session storage (`leaveScriptFrom`), points the active thread at it and goes to plain
   `/home`; the composer takes it once that thread has loaded (`takeScriptFrom`). The entry names its thread,
   is removed by the first reader, and expires after 60 seconds, so a click can never run a turn later or
   elsewhere. `/home?scriptFrom=…` does nothing.
2. **A simulated row's number is a link to its result page** (§5 said "the number, not a separate link").
   A tap on the number answers "who would stop" in one step; the row still opens its details. The gauge
   column passes every other tap through to the row.
3. **The sheet's sections run Proven, Visual, Why it works** (§3 said why, visual, proven). On real hooks
   "why it works" is the model's reasoning, usually one sentence of forty words; the proof is a real video
   with its numbers. Trust first, then what to shoot, then the theory, folded.
4. **"Why it works" and "Why it fits" fold by length too**: the first sentence when the text goes on and it
   fits in 120 characters, else the words that fit and "…" (`foldLead`). A fold by sentence alone showed a
   forty-word sentence whole.
5. **An idea's "Why it fits" is not shown when it is the ideas runner's audience line** ("Because: your tiktok
   audience — …" and a list of tags). It is the same line on every idea of a pack and not a reason a creator
   can read.
6. **The result page is two columns where its body has 920 px of room** (§4 said one 640 column): the text,
   the number and the ring on the left, the ten groups on the right, so the picture and its key are on screen
   together. Narrower, one column as drawn.
7. **The ring has a key.** A group can be looked at from its row (a button) or its wedge (a tap area): the
   other wedges step back and the ring's centre shows that group's percent and name. A mouse over a row or a
   wedge looks without picking. Ink and greys only.
8. **A result with a number but no known group shows the first card only** (no ring of outlines, no empty list).
9. **The sheet focuses its heading when it opens**, not its first control (which can be the paid Simulate).
10. **A database error on the endpoint answers 500 "Server error"**; the database's text goes to the server log.
11. **The grab handle is 28 px tall**, a documented exception to the 44 px rule: it is the sheet's full width,
    for a pointer only, and sits under the scrim, which closes the sheet too.

**The same review pass changed step 1's cards** (spec `2026-11-21-thread-answers-design.md`):

- The sentence under a simulated pack always says who is ahead: "Hook 3 leads by 15 points.", "It's close.
  Hook 1 is ahead by 7 points." or "It's a tie." ("No clear winner." left the creator with nothing.)
- A row's and the sheet's gauge show "%" after the number.
- The script card has Copy (the whole script as plain text). Before, there was no way to take a script out.
- A video sent without words is its tile alone (no bubble with the file's name). A tile with no stored frame
  shows the video mark; the video card shows the stored video's own first frame.
- The running card says "about a minute" under its clock, and "taking longer" past 90 seconds.
- The remix steps are one column on a phone when a step's name is long.
- On a desk a thread card's primary is as wide as its content (the drawing shows a bar across the card).
- Sidebar: inside a thread only the thread is marked, not Home. A thread title cut at the stored 48 characters
  ends on a whole word and "…".
