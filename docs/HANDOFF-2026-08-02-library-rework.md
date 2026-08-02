# Library rework — handoff, 2026-08-02

**Lane:** `lane/library-rework` · worktree `~/virtuna-library-rework` · cut from `origin/main` `96ccff5b`
**State:** design converged (owner sign-off), phase 1a shipped and verified on the lane. Nothing merged to `main`.
**Sketch:** `public/_sketch-library-v2.html` — open it directly with `open`, it is self-contained.

| Commit | What |
|---|---|
| `88a206ee` | sketch rev 1 — projects over a repaired save loop |
| `d0d15f23` | sketch rev 2 — UX audit applied |
| `d88fd316` | sketch rev 3 — rows, not cards |
| `628d873a` | sketch rev 4 — craft pass ← **owner signed off on this one** |
| `a5327d72` | **phase 1a — a save records the thread and block it came from** |

---

## 1. The problem, as the owner framed it

> Users can pin a thread in the sidebar, but that is not efficient with multiple threads and a lot
> of generated output in one thread.

Correct diagnosis — the thread is the wrong unit to save. The surprise from exploration: **the app
already agrees.** A Library ships at `/library` and it already saves *individual output cards*, not
threads. The concept is not missing; the loop around it is broken and the shelf is deliberately flat.

## 2. Decisions locked (owner, via AskUserQuestion)

1. **Projects** is the organizing model — manual folders, single membership, no tags, no nesting.
2. **Outputs only.** Projects hold saved cards. Threads stay in the sidebar; every saved card
   deep-links back to its source thread instead.
3. **Fix the save loop FIRST**, then build projects on it.

**By-video was rejected as the primary axis** (viable later as a facet only). Two hard reasons:
video identity is fragmented across six tables that each mint their own id with no shared key, and
**the Test skill discards the TikTok URL** — `analysis_results` has only `video_storage_path`, so two
Tests of the same video share nothing. Also, most output (ideas, hooks, scripts from open chat) has
no video at all.

**Do NOT revive the dead `projects` table** (`supabase/migrations/20260526100000_add_projects.sql`):
zero code references, seeded `'My Boards'` rows, default colour `#FF7F50` — the *retired* Raycast
coral. Build fresh in the `saved_items` RLS idiom. The `user_bookmarks` stack (table + route + hooks
+ store) is likewise dead, 0 rows, no producer.

## 3. What ships today, and every defect in it

`/library` → `PageShell` (880px) → `SavedShelf` → `useSavedItems` → `GET /api/saved` → `saved_items`.
Flat by construction (D-07), enforced by comment in six files; the migration says a later phase
EXTENDS with separate tables, which is the sanctioned path for projects.

Live data: **10 saved rows — 0 with `ref_id`, 0 with `thread_id`** (hook 4, idea 2, read 2, script 2).
172 threads, 508 messages, 68 `analysis_results`.

Defects found (all verified against code or the live DB, not recalled):

- **Saves were orphans.** `ref_id` written by 0 of 11 renderers, `thread_id` by 1 (account-read).
  → **fixed in `a5327d72`**, see §5.
- **Save is write-only.** Saved state derives from `save.isSuccess` alone (`save-affordance.tsx:50`),
  so a saved card shows "Save" again after remount and a second click writes a **second row**. No
  UNIQUE constraint. No un-save from the source card.
- **`remix-card` saves as `item_type:"hook"`** (`remix-card-block.tsx:274`) — there is no `remix` type.
- **`format` is dead** — in the CHECK, the enum, the filter bar and the label map, but no renderer
  emits it, so that tab is always empty.
- **3 of 6 types have no forward action.** `FORWARD` (`saved-item-card.tsx:47`) maps only
  `hook → /api/tools/script`, `idea → /api/tools/ideas/develop`, `script → null`. `read`, `outlier`,
  `format` fall through to a generic "Use in thread →" that pushes `/home` and **ignores
  `item.thread_id`**, which is on the row.
- **Masonry silently breaks the sort.** The grid is `columns-1 sm:columns-2 lg:columns-3 xl:columns-4`
  (CSS multicol), which fills column-by-column — so under "Recent" the second-newest sits *below* the
  newest, not beside it.
- **Zero test coverage.** `src/components/saved/__tests__/` does not exist. Nothing tests
  `SavedShelf`, `SavedItemCard`, `buildVM`, or `/api/saved`. `PATCH /api/threads/[id]` (pin/rename)
  has no route test either.
- **`library/loading.tsx:14` is stale** — `max-w-5xl` (1024px) against the page's 880px `PageShell`.
  Its own comment claims it matches "verbatim"; that stopped being true when `658e7f23` (PR #407)
  swapped the page to `PageShell`.
- **`saved-item-card.tsx:6` cites `public/_sketch-library.html`, which does not exist.** The rev 4
  sketch supersedes it.

## 4. The design — sketch rev 4

Four screens: Library home · selection/filing · inside a project · saving + first-run states.

Direction, and what was rejected on the way (keep these, they cost four revisions):

- **rev 1/2 — card grid: rejected.** Two columns at 880px gives each item a 420px box, but most
  saved output is **one line of text**, so every hook wrapped mid-sentence under a kicker, a segment
  tag and a footer.
- **rev 3 — dense rows: rejected as "not premium".** It was legible but had the idiom of an admin
  table: a divider under every row, four facts middot-chained into one grey string
  (`Hook · Contrarian, ranked 2 of 6 · Hook ideas for Q3 · 4d`), one visual weight throughout.
- **rev 4 — accepted.** Borderless rows separated by space with a rounded hover surface; a 34px icon
  tile per type carrying identity without spending the accent; content 16.5px on a 56-character
  measure; subtitle cut to **two facts** (source + time), with rank and archetype moved to the detail
  view. Media and metrics sit on the **right** so every content line shares a left edge.

System rules re-verified against `globals.css` and used throughout:
cards `#1a1a19` are **darker** than the page `#1f1f1e`; controls `#2c2c2b` are lighter; accent
`#FF6363` is **liveness and interactive state only** (checked box, in-thread bookmark, save
confirmation — never a bookmark on a shelf row, where every item is saved by definition); band tones
are `--color-success/warning/error` and are the only data colour; `--muted` `#8a857c` is restricted
to timestamps and counts.

Interactions specified in the sketch:
**bulk selection** (click, shift-range, ⌘A over the active facet) — the interaction the rework exists
for; **thread-aware save default** (if this thread already feeds a project, that one wins, badged
"this thread" — "last used" would silently misfile); **grouping by type inside a project**, replacing
filter chips; **global search results mode** badging each hit with its project.

Open questions the owner has not ruled on:
- Does grouping-by-type in project detail beat keeping filter chips there?
- Should a project support **manual ordering**? For a launch video, hook → script → read is a
  sequence, not a set.
- Should the Unfiled shelf collapse behind a toggle once projects exist?

## 5. Phase 1a — SHIPPED (`a5327d72`)

**A save now records the thread and the block it came from.**

🔑 **No API or DB change was needed.** `messages.id` was already on the wire — `loadMessages`
(`src/lib/threads/messages.ts:169`) selects it and `GET /api/threads/open` returns it verbatim.
`RehydrateMessage` simply never declared the field, so every consumer dropped it.

- **`ref_id` = `` `${messageId}:${index}` ``** — stable across reloads, because message bodies are
  immutable. Distinguishes two blocks in the same message, which the dedup key depends on: a
  five-hook run persists five blocks in ONE body.
- **The index is per-MESSAGE, not per-turn.** `orderedTurns` merges consecutive assistant messages,
  so a block's position in the merged array (0,1,2,3) diverges from its position in its own body
  (0,1 then 0,1). The merged position names the wrong row. Tested explicitly.
- **Provenance rides context, not props.** `MessageBlocks` invokes all eleven renderers as
  `<Component block={block} />` — a deliberately uniform signature, so the ids are not in scope at
  any call site. New `src/lib/save-provenance-context.tsx` provides `ThreadIdContext` (once, at the
  composer root) + `BlockOriginContext` (per block, from `MessageBlocks`), composed by
  `SaveAffordance`. **Zero renderer changes.** Same pattern as the existing `AmbientCardIdContext`.
- **Origins survive the body transforms.** `splitTrailingOutro` drops the trailing block and the
  live-run filter drops every non-markdown one; either would shift every ref by one. Tracked as
  indices into the original `blocks` array so the two cannot drift.
- **Unpersisted blocks record `null`, never a guess** — a live run has no message row yet.
- An explicit `ref_id`/`thread_id` prop still wins, for callers with a truer id (an outlier tile's
  `platformVideoId` identifies the video across threads).

Files: `save-provenance-context.tsx` (new) · `rehydrate-thread.ts` · `message-blocks.tsx` ·
`thread-turn.tsx` · `persisted-thread-stream.tsx` · `composer.tsx` · `save-affordance.tsx`
Tests: `rehydrate-thread.test.ts` (+8) · `save-provenance.test.tsx` (new, 4).

**Verified:** `tsc --noEmit` clean · full suite **4967 passed, 0 failed** (448 files, 1 skipped).
The new tests assert the **mutation payload, not the DOM** — a card that renders Save perfectly and
posts a null ref is the exact bug being fixed, and it is invisible to any test that only checks the
button exists.

## 6. Phase 1 — REMAINING

1. **UNIQUE `(user_id, item_type, ref_id)`** + decide backfill vs grandfather for the 10 existing
   rows (all have `ref_id = null`, so a partial index `WHERE ref_id IS NOT NULL` is the clean move).
2. **Saved state reads the store**, not `save.isSuccess` → filled-on-mount everywhere, un-save from
   the source card, no duplicate on second click.
3. **`remix` item type** — new CHECK value; stop saving remixes as `hook`.
4. **`format`** — give it a writer or drop it from the enum and the filter bar.
5. **Deep link back** — the provenance line resolves `thread_id` to `/home?thread=…`; the shelf's
   generic "Use in thread →" currently ignores it.
6. **Fix `library/loading.tsx`** to 880px.

⚠️ Items 1 and 3 need migrations. **`supabase db push` is UNSAFE in this repo** (48 local-only /
41 remote-only migrations; it would recreate `threads`). Single migrations via the Supabase SQL
editor only.

Then **phase 2**: the `projects` table (new, `saved_items` RLS idiom, nullable `project_id` on
`saved_items`) and the rev 4 UI.

## 7. Traps this session cost real time on

- **`git stash push -- <file>` on an already-committed file is a NO-OP that exits 0.** It silently
  "verified" my own code instead of the base. Use `git checkout HEAD~1 -- <file>`, run, then
  `git checkout HEAD -- <file>`.
- **`composer.test.tsx` emits 3 unhandled `.catch` rejections that are PRE-EXISTING** — confirmed by
  reproducing them against `HEAD~1`. The suite still reports 0 failed. Do not chase them.
- **`messages.body` has two envelope shapes in production** — 384 object-wrapped
  `{kcGenVersion, blocks}` vs 124 bare arrays. Any new reader must use `unwrapBody`
  (`src/lib/threads/messages.ts:133`) or it silently sees 75% of messages as empty.
- **`hook-card` fixtures need `model: "sim1-flash"`** — it is a `z.literal`, and any other string
  makes the block render as "Unsupported content" with no obvious cause.
- Component tests opt into a DOM with `/** @vitest-environment happy-dom */`; the default is `node`.
- Run vitest as `node node_modules/vitest/vitest.mjs` — the npx wrapper swallows output.
- **Five skill-id namespaces exist**, not two: `ToolId` spells ideas **`idea`** (singular);
  `SKILL_RUN_META`, `ChatTurnKind` and `STAGE_PLANS` spell it **`ideas`**.

## 8. Verify before merging

`main` deploys on merge — production builds ~3s later and there are no preview URLs. A green Vercel
check on a PR is **not** a build (`ignoreCommand` skips and posts success), so run `tsc` yourself;
vitest does not typecheck.
