# Discover: proven videos to make your own (part 8, Discover)

Date: 2026-11-25 · Status: approved by the owner 2026-11-25 ("Build both as drawn"; a new competitors
page is its own later part) · Plan: `docs/superpowers/plans/2026-11-25-discover.md` · Behind `NEXT_PUBLIC_NEW_LOOK` ·
Reference (approved 2026-11-18): the v11 app-screens sheet, `discover`, `video`, `collections`,
`watchlist` on the phone and `discover` on desktop · Drawing of this proposal:
`.scratch/next-look/part8/discover-audience/drawing/discover-audience-drawing.png` · How Discover and its
data work today, with file:line: `.scratch/next-look/part8/discover-audience/seam-map.md` · Sister spec:
`2026-11-25-audience-design.md`.

## 1. What this is

Today, with the flag on, `/feed` is the old hub inside the new frame: its own header, a seven-field filter
panel, a dialog for a video, two more pages for "Pull live" and "Add a source", and a set of competitor
pages with tables and charts. A video's Remix button shows on hover only, and nothing in the hub can be
saved.

The new Discover is one place to find a proven video and make a version of it: a grid, a page per video
with why it worked and how it is built, Maven's collections, and the creators the user follows.

## 2. Rulings and facts it rests on

- Owner: the places are Home, Discover, Library, Audience (2026-11-18). About a dozen kinds of thing per
  screen, shown through UI, copy short and plain. A multiple is worded "their average" or "their
  followers", never "usual" (2026-11-21). The drawings say "proven videos", not "outliers". "Pull live"
  is what search does when the library has no answer, not a page of its own (2026-11-16).
- Measured on the live data, 2026-11-25, counts only: 372 proven videos from 299 creators (208 Instagram,
  150 TikTok, 14 YouTube) in 18 niches; all have a cover, 352 of them stored by Maven. 105 collections
  (22 formats, 47 visual hooks, 30 editing styles, 6 series). Every video has a "why it works" text of
  about 550 characters and a stored structure: named beats with start and end seconds.
- Also measured: a follower count on 53 of 372 videos; 74 videos whose multiple is past 100 (a small
  account makes the number shaky); 25 whose spoken line holds a fill-in slot in brackets; 20 added in the
  last two weeks by test runs, with the wrong niche. The newest-first order of today therefore opens on
  the weakest rows.
- Remix sends every video to the engine as a TikTok link today, and 208 of the 372 are Instagram. Whether
  those remix well is not known; it is checked in the real app before the button is offered on them
  (section 10).
- The watchlist is little used so far, nothing re-reads a creator on a schedule, and some stored covers
  of watched creators are expired links.
- Nothing today produces: a fit number, an order per creator, "rising", a size match, sounds, a creator's
  own collections, what is new since the last visit, a retention curve for a library video, a player.
  None of these is on the screens.
- No database change in this part.

## 3. The screens

### 3.1 Discover (`/feed`)

Phone, top to bottom (the tab bar under it with Discover lit):

1. **Header.** "Discover" (the page's `<h1>`).
2. **Search.** One field, "Search videos, or paste a @handle", with the filter mark at its right end.
3. **Three chips**: Videos, Collections, Watchlist. The address keeps `?tab=`; the old value `outliers`
   means Videos.
4. The chip's content: 3.2, 3.4 or 3.5.

Desktop: the heading with the search field at the right; the chips with, at the right on Videos, "Filter"
and the order. The column is as wide as Library's; the grid has five cards a row at full width.

### 3.2 Videos

- A line: "372 proven videos" and at the right the order in words ("Most viewed"). With a filter on it
  names it ("Comedy · 85 videos") with "Clear".
- The grid: two columns on a phone. A card is the cover; at its top left the multiple ("▲ 27×"; a multiple
  past 100 is written "100×+"); at the bottom the spoken first line in two lines, then "@handle · 39.8M".
  A card whose spoken line is empty, a placeholder or holds a bracket slot shows no line. A cover that
  does not load is a neutral tile. 24 cards, then "Show more".
- A card opens the video's page (3.3).
- **Order**: Most viewed (the default), Biggest jump, Newest. In "Biggest jump" the videos past 100 come
  last.
- **Filter** (a sheet on the phone, a menu on desktop): Niche (All, then the niches that have videos,
  largest first; the two comedy niches are one "Comedy"), Platform (All, TikTok, Instagram, YouTube),
  Order, and "Show N videos". Filter and order are kept in the address, so Back from a video returns to
  the same grid.
- **Search** narrows the grid as the creator types (the spoken line, the handle, the niche and format).
  No match: "No video matches that." and "Clear". A query that is a @handle or a link, and not a creator
  already followed, puts the pull row (3.6) above the results; with no video of that creator in the
  library the line under it is "Nothing from @handle in the library yet."

### 3.3 A video (`/feed/video/[id]`)

A pushed page: no tab bar, the frame's Back to Discover, the title "Video".

- **The cover**, tall, with over its lower part the multiple and what it is measured against ("16× their
  average", "8× their followers", or the multiple alone), the spoken first line as the page's heading,
  and "@handle · 25M views · TikTok · 2020". At the cover's top right two round buttons: Save, and "Watch
  on TikTok" (the platform's name; a new tab). There is no player.
- **Why it works**: the first two sentences, then "More" opens the rest in place.
- **How it's built**, with the length at the right ("0:51"): one bar cut at the beats, in proportion, and
  under it the beats numbered with their start time. Beats stored without times are listed without the
  bar and the length. Not drawn for a video without stored beats.
- **The one main button**, ink, docked at the bottom on a phone: "Remix this · 10 credits". It opens a
  sheet "What do you want to make from this?" (three lines, optional) with "Remix"; the run then opens in
  a chat as today. No credits and a lapsed session go to the app's own walls; another failure is a toast
  "Couldn't start that remix".
- **Save** puts the video in Library under Saved ("Video · saved in Discover"), and that row opens this
  page. Tapping again removes it.
- Desktop: two columns, the cover at the left, the texts and the buttons at the right.
- A video that is not in the library: "This video isn't in the library any more." and "Back to Discover".

A past-100 multiple reads "more than 100× their average" with one quiet line under it: "A small account
makes this number shaky."

### 3.4 Collections

Four shelves by their names (Formats, Visual hooks, Editing styles, Signature series), each with "See all
22" that opens the shelf in place. A card is three covers, the collection's name as stored, and "15
videos". It opens `/feed/collection/[slug]`: a pushed page with the name as heading, the count, and the
same video cards (a video without a trusted multiple has no badge). Search on this chip filters the
collections by name; no match: "No collection matches that."

### 3.5 Watchlist

One card of rows: picture or initial, "@handle", "162M followers" and, when Maven holds measured videos of
that creator, "· 12 proven"; at the right up to three recent covers. Only covers Maven stores are drawn. A
creator that could not be read says "Couldn't be read".

- A row opens a menu: "Pull their best videos · 5 credits" (3.6), "Open on TikTok", "Remove" (asks once).
- The last row, "Follow a creator · Paste a @handle", opens a sheet with one field and "Follow". Following
  is free. While Maven reads the account the sheet says "Reading @handle" and holds; then a toast
  "Following @handle". Failures in a sentence in the sheet.
- Nobody followed: "Nobody on your watchlist yet", "Follow a creator", and quietly "372 proven videos are
  in the library", which opens Videos.
- Search on this chip filters the rows by handle or name.

### 3.6 Pulling a creator or a niche live (`/feed/discover`)

- **The offer** is a row, never a start: in search for a @handle or link ("Pull @handle's best videos ·
  Ranked against their own average. 5 credits." and "Pull"), in search for words the library has no match
  for ("Pull videos about “meal prep” · 5 credits"), and in a watched creator's menu. Arriving on the
  page by its address shows the same row; only the button starts a pull.
- **Running**: the page title is the input; a grid of outlines and "Reading @handle's videos. This can
  take a few minutes." No count, no percent.
- **Done**: "30 videos read", the order "Biggest jump", the same cards. For a handle, a "Follow" button in
  the header ("Following" once done). A card opens a sheet: the cover, the line, the numbers, "Remix this
  · 10 credits", Save, "Watch on TikTok". These videos have no "why" and no beats, and a saved one opens
  its original from Library, as today.
- **Failures**: no credits is the app's wall; the daily limit "You've pulled 20 times today. Try again
  tomorrow."; a link that is not TikTok "Only TikTok can be read right now."; nothing found "No standout
  videos for @handle."; anything else "Couldn't read @handle." and "Try again". A result served again
  within its cache costs nothing, as today.

### 3.7 Addresses under the new look

`/feed/channels` opens the Watchlist chip. `/feed/hooks` and `/discover` redirect as today. The competitor
pages (`/competitors`, one creator, compare) are not changed and nothing in the new screens links to them
(section 9).

### 3.8 Loading and failure

Loading is the screen's own outline. The library unreadable: "Couldn't load the videos." and "Try again",
with Watchlist still working, as today. The watchlist unreadable: the same for its chip.

## 4. Data

No table and no column changes. Kept reads: the library with its collections, the watchlist, the detail of
one video. Added to reads, in code only: the stored beats and the length in the video's detail; one read of
a single video for its page; the ids a watchlist row needs to be removed (a row can rest on two records,
and Remove clears both). Save stores the video's id with the saved row, so the mark survives a reload and
Library can open the page. The frame treats a video, a collection and the pull page as pushed pages. New,
pure and tested, in
`src/lib/discover-next/`: order, filter and search over the library; the card's line and badge; the
multiple's wording; the beats' bar.

## 5. What is not offered under the new look

The old screens stay for the flag off.

- The filter fields Creator, Views, Outlier score, Engagement, "Posted in last".
- The video dialog: replaced by the page.
- "Add a source" with its tabs Suggested (a fixed illustration), Describe ("coming soon"), Search, Add
  URL, and "Remove all", "Export": replaced by the Follow sheet and a row's Remove.
- The footer "Nothing auto-refreshes yet".
- The competitor pages: section 9.

## 6. Words

Proven videos (not outliers), "their average" / "their followers" (not "usual"), Remix, Save, Follow,
Watchlist, Collections, "Pull". Not used: outlier, teardown, source, channel, scrape, track.

## 7. Departures from the reference

| Reference | Here | Why |
|---|---|---|
| "Fit 72%" on a card, "For you", "Sort: Fit" | the multiple alone; a niche filter | no fit number, one library for everyone |
| chips "Rising", "Your size", "Talking"; search by sound | chips Videos, Collections, Watchlist | no trend, size on 53 of 372, no sound field |
| a "Saved" screen with the creator's own collections and "+ New" | Maven's collections as a chip; saved videos in Library | collections have no owner |
| "Watchlist · 3 new", dots on new posts | no dot | nothing records a visit, nothing re-reads on its own |
| a play button and a curve with three pins | the cover and the stored beats | no player, no curve for a library video |
| "Remix for me" | "Remix this · 10 credits" | the price is said before the tap |
| Back and Save on the cover | Back in the frame's header, Save on the cover | as the built result pages |

## 8. Not in this part

A fit number or an order per creator; refreshing the library or the watchlist on a schedule; cleaning the
library's weak rows; a creator's own collections; a player; a page per watched creator; Instagram or
YouTube for Follow and Pull (TikTok only, as today).

## 9. For the owner to rule

1. **The competitor pages are left out of the new look.** The table of competitors, the compare view and
   the charts per creator stay as they are, reachable by address, with no link from the new screens.
   Recommended: leave them out for now; the Watchlist is the one list, and a creator's page can be its own
   later part.
2. **The grid opens on "Most viewed"**, not on the newest, because the newest rows today are the weakest.
3. **"Add a source" becomes a one-field Follow sheet**; its Suggested list, Export and "Remove all" go.

## 10. Done when

- With the flag on, `/feed`, a video's page, a collection's page and the pull page are the new screens on
  phone and desktop, light and dark; with the flag off every screen is as before (compared with the
  accepted baseline).
- In the real app, on the real library: order, filter and search; a video's page with its beats; Save
  seen in Library and opened from there; two real Remix runs (10 credits each), one TikTok and one
  Instagram video, landing in a chat (if the Instagram one fails, Remix is offered on TikTok videos only
  and the owner is told); follow and remove a real creator; one real pull (5 credits) with its result, and the address of the pull page
  checked not to start one.
- Keyboard and screen reader through the grid, the filter and the sheets.
- Types, the whole test suite, lint and both production builds pass.

## 11. As built (2026-11-25): where it differs, this section wins

- **Remix works with TikTok videos.** The engine reads a TikTok source only, so `Remix this` is offered on
  a TikTok video with a link. A video of another platform shows one quiet line in the button's place,
  `Remix works with TikTok videos for now.`; Save and the watch link stay.
- **`Remix this` opens a new chat.** The page leaves the link, the platform and the brief in memory (never
  in an address: an address must not be able to start a paid run) and opens a new chat; Home runs its own
  Remix there, so the link shows as the creator's turn, the run waits in the chat, and the credit and
  session walls are Home's. Nothing is sent from Discover.
- **Back** from a video, a collection and the pull page goes back in history: the grid returns with its
  chip, order, filter, search, the cards shown and its scroll. With no history it opens `/feed`.
- **A pull is asked once.** The press arms it for 15 seconds; it is then held in memory by what was asked
  (while it reads, and its cards for 30 minutes), so leaving and coming back never asks, or pays, twice.
  A reload shows the offer again. A lone `@`, or a handle that cannot be one, offers no pull; a link that
  is not TikTok says so and has no Pull.
- **A handle with nothing in the library** says `Nothing from @handle in the library yet.` under the pull
  row; every other search with no match keeps `No video matches that.`
- **The watchlist** shows its failure state (`Couldn't load the watchlist.`, `Try again`) when Maven could
  not tell whom the creator follows, never the empty state. Remove clears every record the row rests on.
  A refused follow says `Couldn't follow @handle. Try again.`
- **Save** says so when it is refused (`Couldn't save this video.`, `Couldn't remove this video.`). A video
  saved here opens its own page from Library.
- **Collections.** A collection whose name is not known is titled `Collection`; a gone one leads back to
  `/feed?tab=collections`.
- **The frame.** Only `/feed` itself shows the tab bar; `/feed/channels` opens `/feed?tab=watchlist`.
- **Competitor pages** are not linked from here; a new Competitors page is its own later part. Carried to
  it: a watchlist row holds no platform.
