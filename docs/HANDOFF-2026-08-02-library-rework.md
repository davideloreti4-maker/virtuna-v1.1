# Library rework — handoff, 2026-08-02

**Lane:** `lane/library-rework` · worktree `~/virtuna-library-rework` · cut from `origin/main` `96ccff5b`
**State:** **phase 1 and phase 2 both COMPLETE on the lane** — rev 5 design, the repaired save loop,
projects, the project detail route. tsc clean · **4996 tests pass, 0 fail** · verified live signed in.
Nothing merged to `main`. ⚠️ The four DDL changes are ALREADY APPLIED to the shared prod database
(see §11) — they are additive and backward-compatible with what `main` currently serves.
**Sketch:** `public/_sketch-library-v5.html` is the build target. Rev 4 (`_sketch-library-v2.html`)
is kept for comparison; §10 lists the eleven things rev 5 changed and how each was found.

| Commit | What |
|---|---|
| `88a206ee` | sketch rev 1 — projects over a repaired save loop |
| `d0d15f23` | sketch rev 2 — UX audit applied |
| `d88fd316` | sketch rev 3 — rows, not cards |
| `628d873a` | sketch rev 4 — craft pass ← **owner signed off on this one** |
| `a5327d72` | **phase 1a — a save records the thread and block it came from** |
| this session | **rev 5 + phase 1 remaining + phase 2** — §9–§11 |

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

Open questions — **all three RULED ON this session** (owner: "go for your recommendation"):
- **Grouping-by-type wins** in project detail; the filter row is gone there. Order is the pipeline
  (§R5-7). Chips stay on the Unfiled shelf, where the list is mixed and unordered.
- **No manual ordering.** The pipeline already tells the sequence story a hand-sorted list would,
  and it needs no `position` column, no drag library, and no reordering-under-optimistic-updates
  reconciliation. Revisit only if the fixed order proves wrong in use.
- **Unfiled stays visible.** It is the inbox you are meant to clear; collapsing it hides the work
  the rework exists to make easy. Its *label* is omitted when no projects exist — "Unfiled" means
  nothing when nothing is filed.

A fourth decision the sketch never posed: **clicking a row expands it in place** (§R5-4). Rev 4
justified its two-fact subtitle by moving rank and archetype "to the detail view" and then never
drew one. Expanding beats navigating because filing is the point — a click that leaves the shelf
costs you your place and your selection.

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

## 6. Phase 1 — remaining items, ALL SHIPPED this session

Every numbered item below is done. Kept as written so the original scope is auditable; §9 records
what each turned into, including the two that were **wrong as specified**.

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

---

## 9. What shipped this session

**Two items in §6 were wrong as specified.** Both were found by checking the codebase instead of
implementing the instruction:

- **§6.5 "resolve `thread_id` to `/home?thread=…`" — that route does not exist.** Nothing in the app
  reads a thread search param (`grep -rn searchParams src/app/(app)/home/` is empty). Linking there
  would have opened whichever thread was already active and looked like a working deep link. The
  real contract is a four-step client handshake, which only `Sidebar.handleOpenThread` implemented:
  `setActiveThreadCookie(id)` → `setActiveThreadId(id)` → `switchThread()` → `router.push('/home')`.
  Extracted to **`src/hooks/useOpenThread.ts`** so the Library and the sidebar cannot drift; a
  hand-rolled second copy that forgets `switchThread()` opens the thread server-side while the
  composer keeps rendering the previous one. Deliberately does NOT POST `/activate` — re-opening a
  thread must not bump `updated_at` and jump it to the top of history.
- **§6.4 `format`** — dropped from the TS union, the zod enum and the filter bar, but **left in the
  DB CHECK**. Narrowing a constraint buys nothing and would reject a legacy write. 0 rows exist.

The rest, as specified:

| § | What landed |
|---|---|
| 6.1 | Partial `UNIQUE (user_id, item_type, ref_id) WHERE ref_id IS NOT NULL`. The 10 pre-provenance rows are **grandfathered, not backfilled** — their origin is genuinely unknown and a full index would have collapsed them into one row per (user, type), silently deleting saves. `createSavedItem` now treats a 23505 as **idempotent**: it returns the existing row, so a double-click converges instead of 500ing. |
| 6.2 | `useSavedItemByRef(item_type, ref_id)` derives saved state from the store, so a card renders filled **on mount**, a second click un-saves, and no duplicate is written. An identity-less block (a live run, `/dev/cards`) keeps the old per-mount flag and does not offer un-save — it has no row id. |
| 6.3 | `remix` is a real type end to end: DB CHECK, union, zod, label, icon, plural, pipeline slot, and its own forward step ("Write hooks for this"). `remix-card-block` stopped saving as `hook`. |
| 6.6 | `library/loading.tsx` now renders the **same `PageShell` + `ShelfSkeleton`** the page renders. It was wrong twice over — `max-w-5xl` (1024px) against an 880px page, and a masonry-card shape — while its own comment claimed it matched "verbatim". Correct by construction now, not by assertion. |

**Phase 2** — `library_projects` (new table, `saved_items` RLS idiom), nullable
`saved_items.project_id`, `/api/projects` + `/api/projects/[id]`, `PATCH /api/saved` for bulk
filing, the rev-5 shelf, `/library/[projectId]`, and the destination picker. The dead
`public.projects` table is untouched (still 2 seeded `'My Boards'` rows on `#FF7F50`).

**Deleting a project never deletes work.** `project_id` is `ON DELETE SET NULL`, so its items unfile
and reappear under Unfiled. Verified live: deleted a project holding 3 filed items → 10 saved rows
still present, 0 filed. The toast says so, because deleting a folder otherwise reads like deleting
what is in it.

### Verified live, signed in, on the real 10 rows — not just asserted

| Claim | Measured |
|---|---|
| the rail's numbers form a column | all 10 metric right edges at **1056px**, identical |
| entering selection does not move content (§R5-2) | content left **463px** selected *and* unselected |
| selected ≠ hovered (§R5-1) | `rgba(255,99,99,0.055)` + inset accent ring vs `#252524` |
| the expansion aligns with its row | **0px** on both edges; detail text indent **0px** vs row content |
| the unused poster column was waste | dropping it took content **440px → 486px** |
| type is on-scale | header **22px**, content line **16px**, zero half-pixel sizes |
| the sort is fixed | 10 stamps strictly descending; no `columns-*` in the DOM |
| the projects loop works | created a project, ⇧-range-selected 3, filed them (Unfiled 10→7), project read "2 hooks · 1 read", detail grouped **Hooks → Reads** |

## 10. Rev 5 — the eleven changes to a signed-off design

Rev 4 was signed off, so nothing in rev 5 is taste. Each item was measured. Full annotated list is
in the sketch's own audit section; the three that matter most to a reader:

- **§R5-3 the band is not read-only data.** Rev 4 called the band dot "the read's proof — the only
  colour on the shelf". The live store says **8 of 10 rows carry a band**: hook, idea and script
  snapshots all persist `band`/`fraction`/`scrollQuote`. Rendered rev 4's way that is colour on
  almost every row; dropped, it discards the product's core signal. It moved to the **right rail**
  as one string with the tone on one word, sharing the column with the outlier's measured
  multiplier. **Found by querying the database, not by reading the sketch.**
- **§R5-2 selection reflowed 16px** while rev 4's own note claimed "same position, same footprint,
  no reflow" — an 18px checkbox replacing a 34px tile moved the body 173px→157px. The checkbox now
  centres inside a fixed 34px slot.
- **§R5-10 the rail was ragged.** As a flex row, a wider hover action ("Develop into hooks →" vs
  "Write script →") pushed the metric leftward, so tabular numbers never formed a column. It is a
  grid with fixed columns, reserved **per surface** — a column no row on the page uses is not
  reserved at all.

Two bugs in rev 5's own first pass, both caught the same way:
- the expansion panel rendered **12px wider than its own row** on each side (a second `-12px`
  margin on top of the list's);
- rev 4's in-thread bookmark overlapped the hook text by **10px of actual glyphs** (my first
  measurement said 14px — that was the box edge, not the text; a `Range` over the text node is what
  answers this).

## 11. ⚠️ Read this before merging: the DDL is already applied

Four schema changes are **live on the shared prod database** (`qyxvxleheckijapurisj`), applied via
`execute_sql` — the SQL-editor equivalent, per the house rule. **`supabase db push` was NOT used**
and must not be: 48 local-only / 41 remote-only migrations mean it would try to recreate `threads`.
`apply_migration` was also avoided, because it writes to an already badly-drifted remote ledger.

So the migration files exist for the record and are **already applied**:
`20260802120000_library_projects.sql` · `20260802120100_saved_items_integrity.sql`.

They are safe against the code `main` currently serves: a new table it does not know about, a
nullable column it ignores, a **widened** CHECK, and a partial unique index that never applies to
prod's writes because `main` lacks phase 1a and writes `ref_id` as NULL every time.

Verified after applying: `library_projects` has RLS on with `library_projects_all_own`;
`saved_items.project_id` is nullable uuid; the CHECK includes `remix`;
`saved_items_user_type_ref_uniq` exists; 10 saved rows and the dead `projects` table both untouched.

## 12. New traps found this session

- **`.rv-in` creates a STACKING CONTEXT** (it animates a transform), and the surface's sections are
  `.rv-in` siblings. A popover positioned `absolute … z-30` inside the first section can never
  render above the second — **no z-index value fixes this**, because z-index only orders within a
  context. Playwright found it as *"a `<span>5 days ago</span>` … intercepts pointer events"* on the
  Create button: the project picker was literally unclickable. Portal out of the tree
  (`ProjectPickerPopover`), do not raise the z-index.
- **A `selectMode`-gated checkbox is unreachable.** Rendering it only `if (selectMode)` is a
  chicken-and-egg: `selectMode` is true only once something is selected, and nothing can be selected
  without a checkbox. Both the tile and the checkbox render; CSS swaps them on hover/focus.
- **`text-[16.5px]` fails a repo guard.** `src/components/__tests__/type-scale.test.ts` bans
  half-pixel font sizes **everywhere** under `src/`, and arbitrary px sizes inside
  `app/home`, `app/settings`, `audience`, `sidebar`, `thread`. The sketch is written in half-pixels;
  the app has **nine named type roles** (`text-micro`…`text-stat`) and they are the translation.
  Adopting a role is a rename, not a resize.
- **A test that asserts `fetch.mock.calls[0]` is asserting call ORDER by accident.**
  `account-read-write-strengths.test.tsx` broke because SaveAffordance now GETs `/api/saved` on
  mount, which lands before the Ideas POST. Find the call by URL.
- **The dev server is reaped after ~10 min idle** — a vanished server logs a clean exit, not a
  crash. Check the log before debugging.
- Measuring a **box** cannot detect **text** overlap: `padding-right` shrinks the text area while
  the box's right edge stays put. Use a `Range` over the text node and compare glyph rects.
