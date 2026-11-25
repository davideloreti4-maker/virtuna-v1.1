# Audience: the viewers Maven simulates for (part 8, Audience)

Date: 2026-11-25 · Status: approved by the owner 2026-11-25 ("Build both as drawn"; hand-editing left
out; the main button "Simulate a video for them") · Plan: `docs/superpowers/plans/2026-11-25-audience.md` · Behind `NEXT_PUBLIC_NEW_LOOK` ·
Reference (approved 2026-11-18): the v11 app-screens sheet, `audience`, `audience2`, `audsheet`, `building`
on the phone and `audience` on desktop · Drawing of this proposal:
`.scratch/next-look/part8/discover-audience/drawing/discover-audience-drawing.png` · How Audience and its
data work today, with file:line: `.scratch/next-look/part8/discover-audience/seam-map.md` · Sister spec:
`2026-11-25-discover-design.md`.

## 1. What this is

Today, with the flag on, `/audience` is the old screen inside the new frame: its own header and Back link,
a list with zones "Accounts" and "Simulated", person names for the groups (Maya, Dev), small capital
labels, colours written for the dark look only, and an edit form with eight fields.

The new Audience is one page about the audience Maven is simulating for: who the 1,000 viewers are, where
that picture came from, and one step to simulate a video for them. A creator with more than one audience
switches between them from the title.

## 2. Rulings and facts it rests on

- Owner: ten viewer groups everywhere, by their ten names (2026-11-18). "Simulate", never "Test". About a
  dozen kinds of thing per screen, shown through UI, copy short and plain. Connected accounts live on You
  (2026-11-24). "Usual" is used for views only (After posting, 2026-11-24). General and presets are not
  offered as audiences (2026-11-16); the code keeps General as what Maven uses when a creator has none.
- Looked at on the live data, 2026-11-25 (shapes only): a creator has a handful of audiences at most,
  usually one. A read of a real account holds a line per group. An account has only a few daily snapshots,
  so there is no trend to draw. Archived posts carry a caption, views and a date, and no picture. In a real
  audience the ten shares lie close together (about 9% to 14%).
- Nothing today produces: a number per group across a creator's videos, a "usual" for the simulated
  number, an answer of the groups to a question, a best time to post, a score on the creator's own posts,
  an audience for Instagram or YouTube, a refresh of the figures alone, a notice that the audience changed.
  None of these is on the page.
- No database change in this part.

## 3. The screens

### 3.1 Which audience is shown

- `/audience` shows the audience that new chats use (the stored default). If none is stored, the creator's
  own account's audience; if the creator has several and no default, the newest. If the creator has no
  audience of their own: the state in 3.7.
- `/audience/[id]` shows that audience as a pushed page (no tab bar, the frame's Back to Audience, the
  audience's name as the title) with the same content. Old links and the old redirects land here: an
  address that holds a connected account's id keeps redirecting to that account's audience, and
  `?tab=account` keeps redirecting, as today.
- General and the presets have no page under the new look: `/audience/general` shows 3.7.

### 3.2 Phone, top to bottom (the tab bar under it with Audience lit)

1. **Header.** "Audience" (the page's `<h1>`, same size as Library's). At the right a pill with the
   audience's name and a caret (opens 3.5), then a round More button (3.8). The pill is drawn only when the
   creator has an audience. An account's picture is shown where one is stored; today most have none, so
   the initial is the usual case.
2. **The ring.** One card: the 1,000 dots in ten wedges, each wedge as wide as its group's share, the
   largest first, clockwise from the top. In the middle "1,000" over "viewers". A wedge can be tapped.
3. **Where it came from.** One card, by kind:
   - the creator's own account: picture or initial, "@handle", "TikTok · read 14 Aug · 12 videos", and a
     round "Read again" button (3.6);
   - another creator's account: the same, the line starting "Another creator";
   - a description: the name, "Described by you", and under it the description, three lines then "More".
4. **Four figures**, when the audience is tied to an account that has a snapshot: Followers, Likes (TikTok
   only), Posts, Usual views. "Usual views" is the middle value of the views of the posts that were read,
   shown from three posts up. With fewer figures the row has fewer tiles; with none it is not drawn.
5. **The one main button**, ink: "Simulate a video for them". It opens Home with Simulate picked. When
   the audience on the page is not the one new chats use (a creator who is on general viewers, or an
   audience opened by its own address), the button first makes it that, and a second, quiet button sits
   above it: "Use for new chats".
6. **Groups.** A card "Groups", at its right "share of your viewers" ("their viewers" for another
   creator, "the viewers" for a description). Rows by share, largest first: a dot, the group's name in
   sentence case, under it the group's own line when the read wrote one, at the right the share as a whole
   percent. Four rows, then "All 10", which opens the rest in place. A row can be tapped.
7. **What works with them / What falls flat.** One card, two short texts from the read: the first
   sentence, then "More" opens the rest in place. A text that is missing is left out; with both missing
   the card is not drawn.
8. **Your videos Maven read** (an account's audience with archived posts): the count at the right, the
   three most viewed as rows (the caption's first line without hashtags, the views, "20× your usual"),
   and under them what the account posts about as chips with a count each. For another creator the
   heading is "Their videos Maven read" and the multiple reads "their usual".

### 3.3 A group

Tapping a row or its wedge dims the other nine wedges, puts the group's count and name in the middle of
the ring ("114" over "Savers"), and opens a sheet (phone: from the bottom; desktop: a centred dialog, as
the hook details): the name, "114 of 1,000 viewers", the group's line as a quote, "How they judge a video",
and "Seen in your numbers" ("their numbers" for another creator). A part with no text is left out. Closing
the sheet lights the whole ring again. Nothing here can be edited.

The ten counts add up to 1,000 and are the same numbers the ring draws.

### 3.4 Desktop

From 920 px two columns, as the result page: left the source card, the figures, "What works", the read
videos; right the ring with the main button under it, then Groups. The title row holds the heading, the
pill and More. The column is as wide as Library's.

### 3.5 Switching

The pill opens a sheet (desktop: a menu under the pill) "Audience · Whose viewers Maven simulates": the
creator's audiences, their own account first; each with picture or initial, name, and a line ("TikTok ·
12 videos read", "Another creator · TikTok", "Described by you"); a check on the one new chats use; a last
row "New audience · From an account or a description". Picking one makes it the audience new chats use
and shows it, as picking an audience in the message field does, and answers with the toast "New chats use
@handle".

### 3.6 New audience, and reading again

`/audience/new` is a pushed page (no tab bar, the frame's Back, title "New audience"):

- three choices as one card of rows: "Your TikTok account · Built from your own videos", "Another creator
  · Any public TikTok account", "Describe them · Write who they are"; under it one field for the choice
  (a handle, or three lines of text with "Who are they, and what makes them stop scrolling?"); the ink
  button "Build audience"; the line "About two minutes. Free."
- TikTok only. Under the card, quietly: "Instagram and YouTube can't be read into an audience yet." with
  a link "Connect them on You".
- The old address forms (`?door=`, `?source=account&handle=`, `?mode=general`) keep choosing a row.

Building replaces the form in place: "Building your audience"; the ring with ten equal wedges that light
as the three real steps finish; the account's picture or initial in the middle; the three steps as a list
(done, now, next) in the words the server already uses; and, once the read has delivered them, a card
"From your videos · N read" with their covers. No count of viewers, no percent, no time left. After three
minutes one more line: "Taking longer than usual." The page asks to stay open while it runs.

- Done: the new audience becomes the one new chats use, and `/audience` shows it.
- Too little to read: "Couldn't read enough yet", one sentence why, "Use general viewers" and "Try another
  account".
- Failure: the server's sentence, else "Account not found. Check the handle. Private accounts can't be
  read.", and "Try again".

"Read again" on an account's audience asks first ("Maven reads @handle again and rebuilds the groups.
About two minutes."), then runs the same building state on that audience and returns to its page.

### 3.7 No audience yet

The heading; the ring pale, ten equal wedges, nothing in the middle; "These are general viewers"; "Read
your TikTok account and Maven simulates for the people who watch you. About two minutes, free."; the ink
button "Build my audience" and under it "Describe one instead". No pill, no More.

### 3.8 More

Rename (the name in a field, Save); Read again (an account's audience); and, by kind, "Disconnect
@handle" or "Delete audience", which asks first: "Chats that use this audience go back to general viewers.
This can't be undone." What each does to the data is what the old screen does today.

### 3.9 Loading and failure

Loading is the screen's own outline (the screen in its loading state, as Library). A failed read:
"Couldn't load your audience." and "Try again".

## 4. Data

No table and no column changes. The page's server read keeps today's functions (the audience, the
connected accounts, snapshots, the archived posts, what the account posts about). New, pure and tested, in
`src/lib/audience-next/`: one function that turns those into the page's model: the ten groups in order with
name, line, share, count; the figures; usual views; the three rows of read videos with their multiple; the
source line by kind. The ring and the text read the same counts. The ring is the built one
(`src/lib/result/ring-layout.ts`), fed with the shares instead of a simulation.

In code only: the account read also returns the stored picture; the building state gets its own reader of
the server's stream (today's two copies inside the old screens are left alone); the main button uses the
existing way to open Home with Simulate picked.

General stores no groups; it is never drawn as an audience, only as 3.7.

## 5. What is not offered under the new look

The old screens stay for the flag off, and no data is touched.

- The list page with its zones: replaced by the pill.
- The edit form (type, goal, "what good means", notes) and editing a group (name, temperament,
  description): section 9.
- Person names for groups, the share bar, the dot cloud, capital labels, amber warnings, "Refresh Daily"
  (nothing refreshes on a schedule), "Pinned 3 threads".
- Connecting Instagram or YouTube from here: it is on You.

## 6. Words

Audience (not Audiences), viewers, groups, "read" for what Maven does to an account, "Build audience",
"Read again", "Described by you", "Another creator", "general viewers". Not used: persona, calibrate,
sync, simulated (as a kind of audience), source, test.

## 7. Departures from the reference

| Reference | Here | Why |
|---|---|---|
| "TikTok" switch in the title | the audience's name | only TikTok can be read into an audience |
| one wedge in coral, "160 Regulars" at rest | all ink, "1,000 viewers" at rest; a tapped group dims the rest | the built ring picks a group by dimming; no group is the lead by default |
| tiles "Avg views", "Usual 58%", "Posts/wk" | Followers, Likes, Posts, Usual views | no usual for the simulated number; what the account read holds |
| "Ask them" | "Simulate a video for them" | nothing answers a question per group |
| a gauge per group, "watching at 3s" | the share and the group's line | group numbers exist per simulation only |
| "What works for you" as covers with a score | the read videos with views against the usual, and the read's two texts | own posts carry no score and no picture |
| "Best time to post" | left out | nothing reads the account's posting times |
| "640 of 1,000 viewers" while building | the three real steps | no invented progress |

## 8. Not in this part

Asking the audience; a number per group over time; best time to post; an audience for Instagram or
YouTube; refreshing the figures without a new read; a notice that the audience changed; editing groups.

## 9. For the owner to rule

1. **Editing by hand is left out.** Today a creator can edit an audience's goal and notes and each group's
   name and temperament. Under the new look only Rename, Read again and Delete remain. Recommended: leave
   it out; a creator's own facts now live on You.
2. **The main button is "Simulate a video for them"**, because "Ask them" has nothing behind it.
3. **General viewers have no page**; a creator without an audience sees the invitation to build one.
4. **A new audience is used at once**: after building, new chats use it without a second step, and picking
   an audience in the title does the same.

## 10. Done when

- With the flag on, `/audience`, `/audience/[id]` and `/audience/new` are the new screens on phone and
  desktop, light and dark; with the flag off every screen is as before (compared with the accepted
  baseline).
- A real account's audience shows its ten groups with counts that add up to 1,000, in ring and text.
- In the real app: build an audience from a real public account (one read), switch between two audiences,
  make one the default and see Home's field use it, rename, read again, delete; the three failure states
  of building seen.
- Keyboard and screen reader: the ring's groups are reachable as the rows; the sheet returns focus.
- Types, the whole test suite, lint and both production builds pass.

## 11. As built (2026-11-25): where it differs, this section wins

- **Pictures.** No stored picture is read: the page and the switcher show the account's initial. Only the
  building state shows a picture, the one the read delivers.
- **A thin read** (too few posts to read from) shows no video count, no figures and no videos card: the
  numbers Maven holds for it are not that account's.
- **Usual views** leave pinned posts out and need three posts that are not pinned.
- **While a read runs** the page holds a leave (`beforeunload`) and says `Keep this page open.` A read on its
  way is remembered across pages and is never started twice: asking again says `Maven is still reading
  @handle.` or `Maven is still building that audience.`
- **A new audience** becomes the one new chats use the moment its read reports it made, also when the
  creator has left the page (then a toast, no navigation). Read again never changes which audience new
  chats use.
- **A failed build** also offers the way back to the form with the field kept (`Try another account`,
  `Change the description`).
- **Read again** is offered for an audience with an account behind it; an own audience with none has no
  Read again.
- **`Use general viewers`** is offered only to a creator with no audience in use.
- **The main button** (`Simulate a video for them`) makes this audience the one new chats use when it is
  not already, then opens a NEW chat on Home; it never continues the chat that was open last.
- **More** is Library's row menu with the trigger given by the page (`renderTrigger`, one optional prop).
- **Refusals** say what was not done in a toast; a session that ended raises the app's own dialog and no
  toast.
