# The thread frame and the message field (part 3, slice 1)

Date: 2026-11-20 · Status: design approved by the owner 2026-11-20 ("Approve"); built 2026-11-21 (plan `docs/superpowers/plans/2026-11-20-thread-field.md`, section "Result") · Build part 3 of 6,
slice 1 of 5 · Foundation: `docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md`

## 1. Where this sits

Part 3 rebuilds Home, the thread's cards and the message field in the new look, behind
`NEXT_PUBLIC_NEW_LOOK`. Ruled by the owner on 2026-11-20, after an inventory of real threads
(`.scratch/next-look/part3/inventory.md`, on disk only): part 3 is built in five slices, each
designed, built and shipped on its own, in this order:

1. **The thread frame and the message field** (this spec).
2. The hook card: one card per pack, a Simulate per hook that opens the hook result.
3. The video card as a small result.
4. Script, remix and idea cards.
5. Home.

Out of part 3: Ask your audience (its producer was removed in July) and the rare or dormant cards
(outlier grid, profile, account and multi-audience reads), which keep their current rendering inside
the new frame.

## 2. Rulings this rests on (owner)

- 2026-11-18: tools are visible in the field, not hidden behind a button; one primary action per card,
  next steps as quiet chips under the card; a new chat one tap away; a docked field only inside a
  thread, never together with the tab bar; say "Simulate", never "Test"; nothing is simulated unless
  the creator fires it; buttons are ink or white, never coral.
- 2026-11-20: part 3 in the five slices above, starting with this one.
- 2026-11-20: **"+" adds a video to simulate.** (Today it attaches a file for a profile read.)

## 3. What the inventory found that this slice must respect

- The field today is part of one component of 4,120 lines (`src/components/app/home/composer.tsx`)
  that also runs the thread, the audience room and every request. Nothing inside it reads the
  new-look flag; under the flag it is the old field in new colours.
- A skill is armed for exactly one send (`armFired`); a plain send goes to chat. Prices
  (`CREDIT_COSTS`, `src/lib/pricing.ts`): hooks 1, ideas 1, script 2, remix 10, explore 1 (5 when it
  scrapes), your account 5, profile read 2, a video simulation 10. Chat itself is free.
- No voice input exists in the app. The mock's mic has no source.
- Real threads: median 3 messages, largest 119. Hook cards are 63% of all results.

## 4. The design

### 4.1 The field

Docked at the bottom of a thread; in the middle of Home until slice 5 rebuilds Home around it. One
component in both places.

- **Row 1:** `+` · the text · send. Placeholder "Message Maven"; while a tool is selected, that tool's
  short placeholder (today's `PLACEHOLDER_BY_TOOL`, copy shortened). Enter sends, Shift+Enter is a new
  line, a leading `/` opens the skill list. The send button becomes Stop while a run streams, as today.
- **Row 2:** the tools **Simulate · Hooks · Script · Remix** as visible pills · **More**.
- (Changed from the approved text after the drawing: `+` and send sit in row 1 because row 2 with all
  seven items needs 463 px on a 393 phone and has 345. Reference:
  `.scratch/next-look/part3/field-reference.png`.)
- No mic.
- Glass is allowed here (it floats over the thread): the foundation's field radius (`--radius-4xl`,
  32) and `--shadow-float`. The pills follow the foundation's `Chip`.

### 4.2 `+`

Opens the camera roll (video files in the formats today's upload accepts, up to 200 MB). An attached video
shows as a small tile above the text with its length and a remove button. A video in the field can
only be simulated, so attaching one selects Simulate. Pasting a TikTok link with Simulate selected
works as today.

### 4.3 The tools

- Tapping a pill selects that skill for the next message: the pill is filled, it carries its price
  ("Hooks · 1", "Script · 2", "Remix · 10", "Simulate · 10"), and the placeholder changes. Tapping it
  again goes back to plain chat. After one send the field returns to chat (today's one-shot).
- **Simulate** needs a video or a link. Selected without one, the placeholder says "Add a video or
  paste a link" and the send button stays disabled. Simulating a typed hook is not a field action; it
  lives on the hook card (slice 2).
- **More** opens one sheet: every other skill (Ideas, Explore, Your account, the profile read) with
  its price and one line on what it makes, then the audience choice for the next run (today's
  audience sheet and platform lens). Picking a skill there selects it like a pill.

### 4.4 The thread frame

- Header: Back, the thread's title, New chat (the foundation's pushed header, as built).
- Your message: a bubble, right-aligned. An attached video shows as its tile above the bubble.
- Each answer: a small "Maven" label above it.
- Next-step chips under the last answer: quiet pills, the existing curated prompts (`FollowupRow`).
- The cards themselves keep their current rendering inside this frame until slices 2 to 4.

### 4.5 What does not change

Every request path, every price, the one-shot, the audience room's logic, and how a video simulation
runs: you stay in the thread and its card appears when the run finishes (slice 3 restyles that card;
its door opens `/simulation/[id]`).

## 5. How it is built

- New components for the field, the bubble, the answer label and the chips, on the new-look tokens.
- The composer keeps its state and its request paths. Under the flag it renders the new field in
  place of its own box and passes its existing state and handlers to it (selected tool, text, the
  staged video, submit, stop, the skill and audience sheets). No request logic moves.
- With the flag off nothing changes.
- Rejected: rewriting the composer first (high risk, nothing visible gained); a second controller for
  the new look (two copies of every request path).

## 6. Not in this slice

The hook card and the hook result (slice 2), the video card (slice 3), script / remix / idea cards
(slice 4), Home's layout around the field and the phone's account entry (slice 5), a mic, Ask your
audience, sharing a thread.

## 7. Done when

1. With the flag off the app renders exactly as before.
2. In a real thread (phone 393 and desktop 1440, light and dark) the field, the bubble, the label and
   the chips match the reference drawn for this slice (`.scratch/next-look/part3/field-reference.png`,
   source `.scratch/next-look/part3/design/`), measured in a browser.
3. Each tool pill selects its skill with its price shown; a second tap clears it; after one send the
   field is back to chat; `/` still opens the skill list.
4. `+` attaches a video, selects Simulate, shows 10 credits; sending it runs today's video simulation
   and its card arrives in the thread.
5. More lists the other skills with prices and the audience choice; picking one selects it.
6. Simulate without a video or link cannot be sent.
7. Every request path of the inventory's table B3 still works through the new field (tests on the
   seams; one real chat send and one real Hooks run in a browser).
8. Keyboard: Tab reaches the text, every pill, More and send in order, with a visible focus ring;
   Enter sends; Escape closes the sheet.

## 8. Known gaps

- The composer stays one large component; this slice adds a seam, it does not shrink it.
- The profile read loses its one-tap entry (it moves into More); it occurs 11 times in the test
  account's 321 threads.
- Home around the field stays legacy until slice 5.

## 9. Decisions taken while planning (from the seam map, `.scratch/next-look/part3/seam-map.md`)

- The phone's audience room stays mounted under the flag, without its old strip above the field, so
  a hook card's door still opens it (it charges 1 credit before opening). Slice 2 replaces that door.
- A skill picked from More shows on the More button while it is selected, with its price
  ("Ideas · 1"), so the field always says what the next send costs.
- A video dropped on the field becomes the video to simulate; any other file still goes to the
  profile read.
- The send button and Enter keep their two paths (the button reads a staged file first; Enter does
  not); Stop keeps its guard against a second paid run.
- The marketing page's sample thread keeps its current look (it shares the bubble component).
- The space reserved under the thread is re-measured for the new field (today 184 or 240 px).
- Next-step chips show under the last answer only (spec 4.4); earlier answers lose theirs.
- Explore shows its base price, 1.
