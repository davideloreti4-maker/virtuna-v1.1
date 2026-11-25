# After posting, step 1: link the post, see what it did

Date: 2026-11-24 · Status: APPROVED by the owner 2026-11-24 ("Build as specified": the new table,
TikTok only, real numbers now, the rule for "right" later; about 8 scraper runs for the checks) · Part 6 of the new look (flag
`NEXT_PUBLIC_NEW_LOOK`). Order ruled 2026-11-24: Library, You, **the after-posting loop**, Earn,
Discover + Audience. Facts with file and line: `.scratch/next-look/part6/after-posting/seam-map.md`.
Drawing: `.scratch/next-look/part6/after-posting/drawing/after-posting-drawing.png`.

## 1. Why now

A creator simulates a piece, posts it, and Maven never hears of it again. Nothing in the app says what a
posted video did, and the database holds no posted video at all (checked 2026-11-24: 148 stored
predictions, none with a real result). The launch plan asks for exactly this before Friday: "outcome
logging on for the fleet, so every posted video gets predicted vs actual" (100 rows by Sunday).

## 2. What can be true today, and what cannot

The reference drawings show "Maven said 67%, it got 71%", a check or a cross, and "9 of 12 right". That
needs a real number on the same scale as Maven's. There is none:

- Maven says "% would stop to watch" (a hook, an idea, a script) or "% watch to the end" (a video).
- TikTok shows the public only views, likes, comments, shares and saves. "Watched the full video" is
  in the creator's private analytics, and no reader of ours can get it.

So step 1 shows what is real: **what Maven said, next to the post's public numbers and how they compare
with the account's usual views.** It gives no "got 71%", no check or cross, and no record. The rule for
"right" is set afterwards, on real pairs: this weekend's 100 posts are the first set there has ever been.
Every pair this part stores is kept so that the rule can be applied to it later.

## 3. What the creator sees

### 3.1 Saying "I posted this"

Two doors, both on a piece that has been simulated:

- its result page (a video's and a hook's): a quiet row under the result, "Posted it? Add the link";
- its chat's row in Library: "Add posted link" in the row's menu (it means the piece whose number the
  row shows).

Either opens one small sheet: a title "Posted it?", one line ("Paste the TikTok link. Maven reads the
public numbers and shows them next to what it said."), one field, one button "Add link". A link that is
not a TikTok link is refused in the sheet, before anything is saved. The link is saved at once; the
sheet closes and the piece says "Reading the post".

One post per piece. A posted piece's menu says "Remove posted link" instead (asked once more, like
Delete).

### 3.2 The states of a posted piece

| State | When | Words |
|---|---|---|
| Reading | link saved, no numbers yet | "Reading the post" |
| So far | numbers read, post younger than 72 hours | "12.4K views so far" and "Final numbers Friday" |
| Final | first read at 72 hours or later | "31K views" and "1.8× your usual" |
| Final, no usual | the account has fewer than 5 other settled posts | "31K views" |
| Not read | private or deleted, or the first read failed | "Couldn't read this post. It may be private or deleted." Try again · Remove |

72 hours is the settle time ruled on 2026-11-16. "Your usual" is the middle value (median) of the views
of the same account's other posts: from its latest 30, not pinned, each at least 72 hours old, at least
5 of them. "× your usual" is green from 1.5×, coral up to 0.6×, ink between, decided on the number
as it is shown (my thresholds; the two colours keep their one meaning, "against your usual"). A post
whose time TikTok does not give counts its 72 hours from the moment the link was added.

### 3.3 The result page (video and hook)

One card, "After posting", directly under the page's first block:

- left: "Maven said" and the number the page already shows ("67% would stop to watch");
- right: "It got" and the views, with "1.8× your usual" under them once final;
- one quiet line: likes · comments · shares · saves;
- a foot: "Posted Tue 24 Nov on TikTok, @handle" (the handle links to the post) and "final numbers",
  or the day they become final.

The post's caption is never shown (it is text from outside the app).

### 3.4 Library and Home

- A fifth chip: All · Drafts · Simulated · **Posted** · Saved. On a phone the chips scroll sideways.
- A posted chat's stage is "Posted": it leaves "Simulated" (one stage per chat, as today).
- Its second line: "Posted 2d ago · 31K views · 1.8× your usual" (or "· 12.4K views so far", or
  "· reading the post", or "· couldn't read the post"). The gauge stays what Maven said.
- Desktop: a fourth column, "After posting": the views, and under them "1.8× your usual".
- Home's Recent uses the same rows, so it gets the same line.

## 4. How the numbers come back

There is no scheduled job (none is registered, and production is not deployed), so reads happen when
somebody looks:

1. **At the link:** one read of that post. It gives the account, the post's id and time, and the first
   numbers.
2. **While it is younger than 72 hours:** when the creator opens Library or the piece, and the account
   was last read more than 12 hours ago, one read of the account's latest 30 posts updates every linked
   post of that account at once.
3. **At 72 hours or later:** the same account read makes the numbers final and gives the usual. A post
   that is no longer among the latest 30 is read alone.

Each read is kept (time, views, likes, comments, shares, saves; the newest 12), so "views after 24
hours" can be answered later. Reading costs the creator no credits (like connecting an account). It
costs us one scraper run per read: at most 20 links a day per person, and the limits above.

## 5. Data (a database change, his word needed)

One new table, `piece_posts`; nothing existing changes.

| Column | What |
|---|---|
| `id`, `user_id`, `created_at`, `updated_at` | own rows only (row level security, like `connected_accounts`) |
| `thread_id`, `piece_key`, `piece_kind` | the piece: the chat, the stored simulation's key, hook / idea / script / remix / video |
| `said_number`, `said_measure`, `said_at` | what Maven said, copied when the link is added (0 to 100; "stop" or "end") |
| `platform` | "tiktok" only for now |
| `post_url`, `post_id`, `handle`, `posted_at` | the post; the link shown is built from handle and id, never from the pasted text |
| `views`, `likes`, `comments`, `shares`, `saves`, `read_at` | the latest numbers |
| `reads` | the kept reads (see section 4) |
| `settled_at`, `usual_views`, `usual_posts` | when it became final; the usual and how many posts it rests on |
| `attempts`, `read_error`, `last_attempt_at` | failed reads; "gone" or "failed" |
| `removed_at` | set when the creator removes the link; the row is kept, so removing a link never raises the day's allowance of 20 |

One live row per person, chat and piece. Deleting a chat deletes its rows. The older outcome tables
(`outcome_signatures`, `reconciliations`, `outcomes`) and the code around them are not touched.

## 6. Rules

- Flag off: no route answers (404), nothing renders, nothing reads the table. Flag off looks and behaves
  exactly as before.
- Only a `https` link on a TikTok host reaches the reader (the existing check).
- A person can link, read and remove only their own pieces and rows.
- "Said" is copied once, at the link. Simulating the piece again does not change it. `said_at` and
  `posted_at` are both kept, so the later record can count only calls made before the post.
- Numbers are never invented: no usual below 5 posts, no "final" before 72 hours.

## 7. Departures from the reference drawings

1. No "got 71%", no check or cross, no "9 of 12 right", no record page (section 2).
2. The gauge of a posted row stays what Maven said; the reference turns it into what the post got.
3. No "Post to TikTok", no scheduling: Maven does not post.
4. No picking the post from the account's latest posts, and no offer when the account posts something
   that looks like a piece: the link is pasted.

## 8. Not in this part

Instagram and YouTube posts (no reader for a single post exists; the launch plan's 200 posts are half
Instagram: its own small part next). More than one post per piece. The creator typing "watched the
full video" from their own analytics. The record and the rule for "right". "Make another like this".
A scheduled job. Feeding the engine (the older outcome code stays as it is).

## 9. For the owner to rule

1. **The new table** (section 5). Recommended: yes. Without it nothing can be remembered about a post.
2. **Real public numbers now; "right or wrong" after the weekend's posts.** Recommended: yes. The
   alternative, grading today, means inventing a rule with no post to test it on.
3. **TikTok only in this step.** Recommended: yes, and Instagram straight after.
4. **Scraper runs on the company's account.** Each read is one run. My checks need about 8. The
   fleet's 100 posts need a few hundred over the weekend; a comment in the code says the account is on
   the free plan with a 5 dollar monthly cap, which would not carry that. Not verified by me.

## 10. Done when

1. Flag off renders and behaves exactly as before (suites green; the flag-off production build matches
   the baseline).
2. A real public TikTok link added on the test account shows its real numbers on the result page, in
   Library (phone and desktop, light and dark) and on Home; removed, everything is as before.
3. Each state of section 3.2 is seen in the real app (reading, so far, final with and without usual,
   not read).
4. A link that is not TikTok's, somebody else's chat, and a 21st link in a day are refused.
5. Types, lint, the whole suite, both production builds.

## 11. As built (2026-11-24)

Built as specified, with the differences below. Each was ruled during the build.

**Rules that changed**

- **Removing a link keeps its row** (`removed_at`), so a removed link never gives back one of the day's 20.
  A piece can be linked again after a removal.
- **The browser can read its own rows and write none.** Every write goes through the server, which checks
  the link and the day's allowance. (The first draft let a signed-in browser write its own rows directly.)
- **One post is never read twice at the same time.** A read first claims its rows; a claim holds for four
  minutes, the longest a read may take.
- **"Try again" works at once** after a failed read, and stops after eight failed reads of one link.
- **A failed read never hides numbers that were already read.** "Couldn't read this post" is only for a post
  that was never read, or that TikTok says is gone. A post that has numbers and can no longer be read (eight
  failed reads in a row) is closed with the numbers it has: "final numbers".
- **A posted chat's row in Library and on Home is about its posted piece**: the gauge is what Maven said
  about that piece when the link was added, and it opens that piece's page, also when another piece of the
  chat was simulated later.
- **One request stays inside its time limit**: no further read starts after 110 seconds; what was not read
  is read on the next visit.
- **"Reading the post" is never a dead end**: the page asks for the row again every 10 seconds, for at most
  three minutes; the server answers "couldn't read" after one failed first read.
- **Green from 1.5×, coral up to 0.6×**, decided on the number as shown.
- **A post whose time TikTok does not give** counts its 72 hours from the moment the link was added. The
  post's time itself comes from its id, which holds it; the reader's own time field is only a fallback.

**Screens**

- The card's foot says the day, the account and "final numbers" (or the day they become final). It does not
  say how old the read is.
- Removing from a card that could not be read asks once more on the card; from a read card, in its menu.
- Library on a phone: "Posted 4d ago · 31K views", and "1.8× your usual" on its own line. On desktop the
  line is "3 hooks · posted 4d ago" and the numbers are in the "After posting" column only.
- A refused remove says "Couldn't remove the link." in the app's toast.

**Checked with real posts (7 scraper runs)**

A two-hour-old public post: numbers after 24 seconds, "so far". The same post made 80 hours old: one read
of its account, "final numbers", no usual (that account's latest 30 posts are all younger than 72 hours).
A 12-day-old post on a simulated video: "3M views · 0.1× your usual" from 29 other posts. A link to a post
that does not exist: "Couldn't read this post" after 13 seconds, "Try again", Remove. Sixteen refusals by
direct request. Library and its menus, phone and desktop, light and dark, from 320 wide.

**Known limits**

- TikTok only. An account that posts more than about 30 times in 72 hours never gets a usual.
- A video whose simulation is not stored in a chat shows its post on its result page only, not in Library.
- A read is paid by us, per read. Bounds: 20 links a day per person, three reads per request, eight failed
  reads per link, one read per account every 12 hours while a post is not final. The shared rate limiter
  is switched off where its store is not configured.
- Home's Recent was not seen with a posted row in the real app (no recent chat of the test account is
  posted); it uses the same row data and is covered by tests.
- No scheduled job: numbers come back when somebody looks.
- If the read right after adding a link is refused (offline, a server error), the card says "Reading the
  post" until the page is opened again.
- The day's allowance of 20 can be overshot by requests sent at the same instant.

