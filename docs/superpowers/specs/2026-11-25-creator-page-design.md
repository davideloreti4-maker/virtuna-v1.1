# A creator's page (new look): the new Competitors

Status: approved by the owner as drawn, 2026-11-25 ("Build as drawn"; then "build the Competitors page
as drawn"). The drawing is the sheet shown to him that day (four frames: the Watchlist, the creator's
page, the page with an audience and a video opened, the desktop). This spec is the build's source;
where it differs from the drawing, section 7 says so.

Behind `NEXT_PUBLIC_NEW_LOOK`. Flag off renders exactly as before: the three old competitor screens
and the old Watchlist are not touched.

## 1. What this is

Under the new look the Watchlist chip of Discover is the one list of followed creators. A row there
opens a small menu today. This part gives a creator a page of their own, opened by tapping the row:
who they are, their numbers with the date Maven read them, and the videos Maven read, each measured
against that creator's own average. From the page the creator's audience can be built, a video can be
simulated for their viewers, their best videos can be pulled, and a video can be remixed.

The page shows only what Maven holds about a creator today. It replaces the old competitor board, the
old detail page and the old compare page under the flag.

## 2. Rulings and facts it rests on

- The owner: no second list. The Watchlist is the list; the page is what a row opens. The row's menu
  (Pull, Open on TikTok, Remove) moves onto the page.
- A followed creator is stored as a profile row (name, bio, picture, followers, likes, posts, the
  time of the last read, whether that read failed) and as the videos of the last read: up to twenty,
  usually twelve, each with its views, its likes and comments, a stored cover, and a multiple, which
  is its views over the median views of that read. The median is stored with every row of the read.
- The Watchlist's read (`lib/discover/watchlist-reads.ts`) already decides which creators the caller
  follows and which profile backs a row (`profileHandle`). The page uses that same decision, so a
  page exists exactly for the rows that carry a profile.
- A profile is read with the service client, narrowed to what the caller follows, as the Watchlist
  does: the row-level rule on profiles knows only the old door.
- Inside 24 hours of a creator's last read the server answers "cached" and reads nothing.
- An audience built from another creator carries that creator's handle and the date of the read in
  its stored record. The new-audience page takes a handle from its address
  (`/audience/new?door=handle&handle=<handle>`) and fills its field with it.
- The audience a simulation runs for is the caller's last chosen one. Choosing one is a stored
  setting (`useSetDefaultAudience`); Home has no address for it.
- A pulled video's sheet (`PulledSheet`) and its remix step (`RemixSheet`) already exist, and a video
  of a read has every field they draw.
- A multiple is worded once for the whole app (`lib/multiple-words.ts`, the owner's rule of
  2026-11-21): "12× their average". A card carries the ▲ badge only when the video is proven: 3× or
  more.
- On a phone the top band belongs to the shell: Back, the title, New chat. A page cannot put a
  control there.

## 3. The screens

### 3.1 The Watchlist row

- A row that carries a profile is a link to the creator's page, `/competitors/<handle>`. It looks as
  it does today (picture, `@handle`, the line, up to three covers) and is named by the handle and
  described by its line. It opens no menu.
- A row without a profile (a creator on Instagram or YouTube, followed from the Explore grid) stays
  as it is today: a button that opens the menu, so it can still be removed.

### 3.2 The creator's page, on a phone

Top to bottom:

1. The shell's band: Back, `@handle`, New chat. Back returns to the Watchlist as it was left.
2. The creator's card: the picture (or the initial on a sunken disc), the name, and one line:
   `@handle · TikTok · read 13 Jul · 12 videos`. A part that is not known is left out with its dot.
   At the card's right two round buttons: Read again, and More. Under them the bio, at most three
   lines; no bio, no line.
3. The figures, four tiles in one row: Followers, Likes, Posts, Usual views. A figure Maven does not
   hold is left out, and the rest share the row.
4. The main button, full width:
   - No audience of theirs yet: "Build their audience". Under it: "Then simulate your video for their
     viewers. About two minutes. Free." It opens the new-audience page with the handle filled in.
   - Their audience exists: "Simulate a video for their viewers". Under it: "Their audience was built
     14 Nov." It chooses that audience and opens a new chat on Home.
5. The second button, full width, quiet: "Pull their best videos · 5 credits". It arms the pull and
   opens the pull page, as the row's menu did.
6. "Their videos", and at the right of that heading "Biggest jump". A grid of the videos of the last
   read, two in a row, ordered by the multiple, largest first. A card is the Discover card: the
   cover, the ▲ badge on a proven video, the caption in two lines, and under it the views
   ("106K views", the count as Discover's cards round it). The handle is not repeated on a card.

A video opens the sheet a pulled video has: the cover, the multiple in words on a proven video, the
numbers, "Remix this · 10 credits", Save, "Watch on TikTok". Remix goes the way it goes from the pull
page: the short brief, then a new chat on Home that runs the remix.

More holds "Open on TikTok" (a new tab) and "Remove". Remove asks once more ("Remove @handle?",
Cancel, Remove; the confirming Remove ignores presses for half a second, as on the row). Confirmed:
the creator leaves the watchlist and the Watchlist opens. Refused: a toast says so and the page stays.

### 3.3 Read again

- Pressed: the button turns and is busy, the line says "Reading…" where the date stood, and a second
  press does nothing. A read can take a few minutes; leaving the page does not stop it.
- Done: the page reads itself again; the date, the figures and the videos are the new ones.
- Inside 24 hours of the last read the button is dimmed. Pressed, it answers with one sentence:
  "Read today. Maven reads a creator once a day."
- Failed: a toast, "Couldn't read @handle. Try again later." The page keeps what it showed.
- A lapsed session is the app's own dialog.

### 3.4 The page's other states

- Loading: the outline of the card, the tiles, the two buttons and the grid.
- The creator's read failed and nothing was kept (the Watchlist says "Couldn't be read"): the card
  with the initial, `@handle`, "Couldn't be read", Read again and More; under it one sentence,
  "Maven couldn't read this account. Read again, or remove it." No figures, no buttons, no videos.
- No videos of a read yet (a creator followed through the old door): the card, the figures and the
  buttons; where the grid would be, "No videos read yet. Read again to get their latest."
- Not on the caller's watchlist, or no such creator: "This creator isn't on your watchlist." and a
  link "Watchlist". Not the 404 page: Back from the Watchlist after a Remove lands here.
- The page's own read failed: "Couldn't load this creator." and "Try again".

### 3.5 On a desktop

From a 768 window the page has its own header: Back, `@handle` as the heading, More at the right. The
body is at most 980 wide. Where the body is 760 wide or more it is two columns: at the left the creator's
card (with Read again), the figures, the main button with its line and the pull button; at the right "Their
videos" with its grid, as many in a row as the column gives. A narrower body (a tablet, or a small window
beside the open sidebar) is one column, as on a phone, every block the body's width. The sheet is a
centred dialog, the menus stand on their buttons.

### 3.6 The old addresses

Under the flag `/competitors` and `/competitors/compare` open the Watchlist (`/feed?tab=watchlist`).
`/competitors/<handle>` is the new page. With the flag off all three render the old screens.

## 4. Data

- One server read for the page. It takes the Watchlist's read and finds the row whose profile has the
  handle of the address; none: the "not on your watchlist" state. A Watchlist read that could not
  tell whom the caller follows is the page's failure.
- Then, side by side: the profile's row (service client, by the id the row names), the videos (the
  caller's client; the creator's handle and, where a followed spelling folded into the profile, that
  spelling too; TikTok only), and the caller's audiences.
- The videos shown are those of the last read: the rows that carry the newest read time. Rows of
  older reads are measured against an older median and are not mixed in. "12 videos" is their count,
  and "Usual views" is the median stored with them.
- Their audience: among the caller's audiences, one built from another creator whose handle is this
  creator's. Two or more: the one read last. Its date is the date of its read.
- "Read again" may be pressed when the profile was never read or its last read is 24 hours old; the
  server read says which, so the browser's clock is not asked.
- Nothing new is stored. No table, column or route is added or changed. One hook is added beside the
  existing follow hook: it sends the read alone, without following.

## 5. What is not offered under the new look

Each for the same reason: it rests on numbers nothing refreshes.

- The follower growth chart and the growth figure (they need a reading every day; nothing takes one).
- Posting times, hashtags, video lengths (counted from one old set of videos).
- Comparing two creators, or a creator with the caller (built on the same numbers).
- The four model cards: strategy, viral detection, hashtag gap, recommendations. The chat is the
  place to ask.
- A second list of competitors, its grid and table views and its sorting.
- A page for a creator on Instagram or YouTube. Maven reads TikTok creators only.

## 6. Words

All in `lib/discover-next/discover-words.ts`, under one new block. Fixed strings as written in
section 3. "read 13 Jul" and "built 14 Nov" are a UTC day and a three-letter month, with the year
when it is not this year's. Counts are written as the Audience page writes its figures. The multiple
is never worded here: the card and the sheet word it.

## 7. Departures from the drawing

1. The ▲ badge stands on a proven video only, 3× or more, as everywhere in Discover and as the row's
   "2 proven" counts. The drawing put it on every video above about 1.5×.
2. The sheet is the pulled video's sheet as built: it says "12× their average" (the owner's wording
   rule), shows likes and comments, and has Save. The drawing's sheet was a sketch of it.
3. On a phone More sits in the creator's card beside Read again. The drawing put it in the top band,
   whose right corner is New chat on every pushed page.
4. Read again is dimmed inside 24 hours of a read, with a sentence when pressed. The drawing showed
   one state.
5. After "Build their audience" the new-audience page ends where it always ends, on the Audience
   page. The way back to the creator is Discover.

## 8. Not in this part

- A daily reading of followed creators, and everything in section 5 that would rest on it.
- Any change to when a creator may be read again.
- The platform a followed handle belongs to, carried through the Watchlist's read.
- Any change to the old competitor screens, their actions and routes.

## 9. Decided by the controller (the owner said to build as drawn)

- The page lives in Discover's folder and follows its pushed pages (a server page, a container, a
  screen with its states, fixtures on the dev page).
- A creator's page exists for the rows the Watchlist's own read gives a profile; one rule for both.
- The videos of the last read only (section 4).
- Choosing their audience for "Simulate a video for their viewers" changes the caller's chosen
  audience, as choosing it anywhere does.

## 10. Done when

- A Watchlist row with a profile opens the creator's page; a row without one keeps its menu.
- The page shows the card, the figures, the right main button, the pull button and the videos of the
  last read by biggest jump, on a phone and on a desktop, in the light and the dark theme.
- A video opens the sheet; Remix starts a remix on Home; Save saves.
- Read again reads, is dimmed inside 24 hours, and says so; a failed read says so.
- More opens the creator on TikTok and removes the creator.
- Build their audience opens the form with the handle filled in; with an audience of theirs the
  button chooses it and opens a new chat.
- Each state of 3.4 is drawn and has a fixture on the dev page.
- `/competitors` and `/competitors/compare` open the Watchlist under the flag.
- Flag off: the comparison with the accepted baseline is unchanged, and the three old screens render.
- Types, the whole suite, lint, both production builds.

## 11. As built (2026-11-25): where it differs, this section wins

- **Section 7 stands, with three more.** A card's count is Discover's own ("106K views" for 106,100). The
  four figures are the Audience page's row and labels: four in a row where their column is 360 wide (a 393
  phone, a desktop), two by two below. The pull button is a white pill, as the drawing has it.
- **"Simulate a video for their viewers"** chooses their audience and opens Home on a new chat with Simulate
  picked: where the Audience page's button of the same name lands.
- **The columns** split by the body's width (760), not the window's: section 3.5 as written above. The
  first build used the video page's split from a 768 window; there the left column was too narrow for words
  and buttons.
- **The name** takes two lines before it is cut; the bio three; both break a long unbroken word.
- **A read still out** when the page is opened again shows "Reading…" and a press sends nothing. After a
  read that brought new videos, a second press before the page has read itself again sends nothing.
- **A held creator** says "Reading…" in place of "Couldn't be read" while a read is out.
- **The loading files.** Under the flag the old board's loading file draws the page's outline (Next shows
  it on the way to a creator's page) and the compare page's draws nothing.
- **Back with no history** (a pasted link) goes to Discover's Videos chip, as every pushed Discover page does.
- **The Watchlist's own "Try again"** hands the focus to the first row, link or button.
- **Shared parts lifted out of the pull page and the row**, one copy each: the pulled video's card, its
  sheet with the Remix step, the Remove question. The pull page and the row draw what they drew.
- **Reviewed with the owner on real data (2026-11-26); this wins over section 7, point 1:**
  - A video that beat their average shows its multiple from 1.5×, without the ▲; the ▲ stays on proven
    videos (3× or more) only. Seen on the test account: after a fresh read a creator's best videos sat at
    1.6× to 2×, and a page sorted by Biggest jump showed no number at all. The pull page's cards follow the
    same rule (the same card).
  - The video's sheet says when it was posted ("Posted 12 Jul"), worded on the server from its clock; a
    pull's sheet does not (its read is now).
  - A sheet's title stops at three lines on screen (a caption can run to a paragraph); the dialog is still
    named by all of it.
  - The Watchlist row's "N proven" counts the last read's proven videos only, by the page's own rule (one
    `ingested_at` per read, a basis required), so the row and the page agree.
  - The row's line breaks only between its parts: "2 proven" never splits.
- **Not built, and why:** a way back to the creator after "Build their audience" (the form ends on the
  Audience page, as it always does); the platform of a followed handle carried through the Watchlist's read.
