# The editor's screens, slice A: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A creator on the allow-list attaches a raw take on Home, gets a first cut on its own page `/edit/[id]`, changes it by asking, fixes a word, picks a look, exports the file, and finds the edit again as a card in its chat and a row in Library (spec `docs/superpowers/specs/2026-11-24-editor-screens-design.md`, slice A).

**Architecture:** The server keeps the edit: two new tables (`edits`, `edit_turns`), a pure module of the turns' rules (`src/lib/edit/turns.ts`), and thin routes under `/api/edit/edits/` that call the same agent, door, review and render code the stateless `POST /api/edit/agent` and `POST /api/edit/renders` call (helpers extracted, not copied). Every route that changes an edit answers the whole `EditView`, so the page holds one pure reducer over the last view read (`src/components/editor/edit-session.ts`) and a hook of calls around it (`use-edit.ts`); an upload holder outside any page (`uploads.ts`) carries the take from Home to the editor. The page is new-look only, one tree laid out by CSS for phone and desktop, so the Player is never mounted again on a resize.

**Tech Stack:** Next.js 16.1.5 (app router, route handlers), React 19.2.3, TypeScript, Tailwind v4 (new-look tokens under `NEXT_PUBLIC_NEW_LOOK`), Supabase (supabase-js, PostgREST, RLS), zod 4, Remotion Player 4.0.545 (`EditPlayer`), Vitest 4 with happy-dom and Testing Library, the worker on Modal (unchanged), R2 (signed addresses).

## Global Constraints

- Work only in the worktree `/Users/davideloreti/virtuna-edit`, branch `feat/edit`; the plan starts at `7a5af9e6` (merge of `design/next-look`), where `pnpm exec tsc --noEmit` and the edit suites are green.
- Tests exercise real behaviour. Mocks only at boundaries that cannot run in a test: the worker's HTTP start call and stills (the `standIns()` worker and `agentDeps.stills`), the model (`agentDeps.ask`), Supabase's REST API (the `standIns()` stand-in, as `src/app/api/edit/__tests__/routes.test.ts` and `agent-route.test.ts` do), the bucket, `fetch` in client tests, and the browser APIs happy-dom lacks (`FontFace`, `document.fonts`, `navigator.share`, `getBoundingClientRect`). Never mock `applyOps`, `review`, `firstCut`, `change`, the reducer, or the turns' rules.
- Vitest on this Mac: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <paths>`. Type check: `pnpm exec tsc --noEmit`. Lint: `pnpm exec eslint <paths>`.
- Commits: local only, by named paths, hook off: `git add <paths> && git -c core.hooksPath=/dev/null commit -m "type(scope): description" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Never push. Never `git add -A`.
- New look only: the page calls `notFound()` when `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`) is false. Flag off renders exactly as before: never update `src/components/ui/__tests__/next-look-parity.test.tsx` with `-u`; a touched shared part keeps or gets a `*.flag-off.test.*`.
- Tokens and parts only: `src/components/ui/button.tsx`, `chip.tsx`, `icon-button.tsx`, `sheet.tsx`, `src/components/shell/pushed-header.tsx` geometry, `src/components/thread-next/answer-card.tsx`. No colour literals in `src/components/editor/` (the guard of Task 15; the one exemption is `look-sample.tsx`, which draws the film's own caption colours on the take's frame). Write `shadow-[var(--shadow-float)]`, never `shadow-float`. Inter only. Every control at least 44 px to tap (`tap-44`). One primary (ink) action a screen. Light and dark.
- Sizes from the drawing (`.scratch/editor/drawing/editor-v2.html`): phone video 254 × 452 on a 393 × 852 screen (`min(53dvh, (100vw − 32px) × 16 / 9)` tall), radius 22; header row 44: Back, Undo, Redo, then Export (40 tall pill) at the right, no title on a phone; tool chips 36; the field 52 tall, fully round, send 36; sheets radius 32 (`next:rounded-t-4xl`); desktop: video 348 × 619 in an 800-tall window, columns 348 and up to 500, gap 52.
- The gate stays: every new route calls `creator()`, is wrapped in `route()`, and calls `csrfGuard()` before reading a body (`src/app/api/edit/creator.ts`). `GET /api/edit/open` answers `{open}` about the signed-in account only.
- The migration is written in Task 1 and applied only by the controller (Task 18). No test needs the live database.
- `next dev` only as `next dev -H 127.0.0.1`. A background server dies when its turn ends: anything that needs a server runs inside one command.
- `POST /api/edit/agent`, `POST /api/edit/renders` and the dev pages (`src/app/dev-edit/**`) keep their behaviour; the agent and render routes change only by calling the extracted helpers (Task 5), proved by their unchanged suites. Nothing under `src/app/dev-edit/` is modified.
- The repo is public: no ids, addresses, account emails, secrets or the owner's spoken words in code, tests, fixtures or commit messages.

---

## File structure

Created:

- `supabase/migrations/20261124210000_edits_turns.sql` — the two tables, their keys, RLS, grants and the `updated_at` trigger.
- `src/lib/edit/turns.ts` — the turns' rules: turn shown, Undo and Redo targets, a new turn and what it drops, the 300 cap, the conversation, the look at a head.
- `src/lib/edit/said.ts` — words written by code: the first cut's line, a direct change's sentence, the edit's title, a look's name, the fixed next steps, "same word".
- `src/lib/edit/waits.ts` — how long a wait is: upload time left from measured throughput, the analysis and export estimates, their words.
- `src/lib/edit/changed.ts` — `firstChangedFrame(before, after)`.
- `src/lib/edit/edit-view.ts` — the types of what `GET /api/edit/edits/[id]` answers (`EditView` and its parts).
- `src/components/thread/edit-block.tsx` — the legacy renderer of an `edit` block: nothing (the editor does not exist with the flag off).
- `src/components/thread-next/edit-answer.tsx` — the card in the chat: picture, title, length, look, date, "Open editor".
- `src/app/api/edit/agent-calls.ts` — the agent's first cut and change as routes make them (moved out of `agent/route.ts`).
- `src/app/api/edit/take-now.ts` — a take as it stands, its row written when its state moved (moved out of `takes/[id]/route.ts`).
- `src/app/api/edit/render.ts` — starting a render of an edit (moved out of `renders/route.ts`).
- `src/app/api/edit/edits/store.ts` — an edit's rows: read, turns, a turn's edit, writing a turn, the live export, the `EditView`.
- `src/app/api/edit/open/route.ts` — `GET` → `{open}`.
- `src/app/api/edit/edits/route.ts` — `POST` makes the edit, its chat and the chat's card.
- `src/app/api/edit/edits/[id]/route.ts` — `GET` the edit as the page reads it.
- `src/app/api/edit/edits/[id]/take/route.ts` — `POST` another take for an edit with no cut yet.
- `src/app/api/edit/edits/[id]/cut/route.ts`, `change/route.ts`, `ops/route.ts`, `head/route.ts`, `export/route.ts` — the turns and the export.
- `src/app/api/edit/__tests__/edit-world.ts` — what the editor's route suites share (stand-ins wired, a ready take, the agent's boundaries, requests).
- `src/components/editor/net.ts` — `call`, `put`, a route's sentence (ported from the dev page's `shared.ts` and `picking.ts`, which stay).
- `src/components/editor/take-file.ts` — a file as a take to edit: its type, the edit tool's limits, the take signed for and its upload started.
- `src/components/editor/read-style.ts` — "Like a video" (a copy of the dev page's `reference.ts`, imports pointed at `./net`).
- `src/components/editor/uploads.ts` — the holder of uploads in flight, outside any page.
- `src/components/editor/edit-session.ts` — the page's pure state: reducer, page state, controls, chips, the playhead after a change, a look as a request body.
- `src/components/editor/use-edit.ts` — the calls around the reducer, polling, the first cut asked for itself.
- `src/components/editor/editor-icons.tsx` — the editor's glyphs (drawing's paths).
- `src/components/editor/editor-stage.tsx` — the video: `<video>` before the cut, `EditPlayer` after, our controls over both.
- `src/components/editor/editor-scrubber.tsx` — track, playhead, rings of things to check; a slider.
- `src/components/editor/editor-thread.tsx` — the turns, Undo on the answer, the chips, the list of things to check.
- `src/components/editor/editor-field.tsx` — "Ask for a change".
- `src/components/editor/look-sample.tsx` — a look drawn on the take's frame.
- `src/components/editor/look-sheet.tsx` — the eight looks (sheet and the row while waiting), "Like a video", "Describe it".
- `src/components/editor/captions-sheet.tsx` — the words, fix a word, "Fix all N", captions on and off.
- `src/components/editor/export-panel.tsx` — the export in the page.
- `src/components/editor/ready-sheet.tsx` — "Save to Photos" or "Download".
- `src/components/editor/editor-header.tsx` — Back, Undo, Redo, Export; the title on desktop.
- `src/components/editor/editor-screen.tsx` — picks the state, lays out phone and desktop.
- `src/components/editor/start-edit.ts` — the door: the take's checks, the take signed for, the upload started, the edit made, the page opened.
- `src/components/editor/use-edit-open.ts` — whether the editor is open to this account.
- `src/app/(app)/edit/[id]/page.tsx` — the page, new look only.
- Tests: listed in each task.

Modified:

- `src/types/database.types.ts` — `edit_turns` and `edits`, by hand, in the file's style.
- `src/lib/edit/worker/__tests__/stand-ins.ts` — the stand-in knows `edits`, `edit_turns`, `threads`, `messages`, the turn key, numbers as numbers.
- `src/lib/tools/profile-blocks.ts`, `src/lib/tools/block-registry.ts`, `src/lib/tools/on-screen.ts` — the `edit` block.
- `src/lib/thread-next/answer-parts.ts`, `src/components/thread-next/thread-turn-next.tsx`, `src/components/thread/message-blocks.tsx` — the block in the thread.
- `src/lib/library/chat-summary.ts`, `src/lib/library/piece-words.ts`, `src/components/library-next/row-line.ts`, `src/components/library-next/chat-row.tsx` — Library's kind `edit`; `src/lib/posted/posted.ts` — an edit is no posted piece kind.
- `src/components/thread-next/field-icons.tsx` — `ScissorsIcon`, `MoreIcon`.
- `src/app/api/edit/agent/route.ts`, `takes/[id]/route.ts`, `renders/route.ts` — call the extracted helpers.
- `src/components/shell/next-shell.tsx` — `/edit/` keeps the marker like `/simulation/` and draws its own header.
- `src/lib/supabase/middleware.ts` — `/edit` is a signed-in path under the new look.
- `src/components/home-next/home-screen.tsx`, `home-next.tsx` — six tiles for an account the editor is open to.
- `src/components/thread-next/thread-field.tsx`, `field-copy.ts` — Edit beside Simulate for a staged video; the edit tool's limits.
- `src/components/app/home/composer-controls.tsx`, `src/components/app/home/v8/skills-panel.tsx`, `src/components/app/home/composer.tsx` — `edit` in `ToolId`, its maps, one send branch.
- `src/components/home-next/__tests__/home-screen.test.tsx:81-88` — the skill list it holds is five now (Edit shown only where the editor is open); `src/components/thread-next/__tests__/slash-menu.test.tsx:55` — Home's cards in the `/` list, but Edit; `src/lib/thread-next/__tests__/answer-parts.test.ts:171` — the exact list of result types gains `edit`.

---

### Task 1: The two tables, their types, and the stand-in that holds them

**Files:**
- Create: `supabase/migrations/20261124210000_edits_turns.sql`
- Modify: `src/types/database.types.ts:1344` (after the `edit_takes` entry, before `engine_training_videos: {` at line 1345)
- Modify: `src/lib/edit/worker/__tests__/stand-ins.ts:34` (`type Table`), `:42-45` (`DEFAULTS`), `:62-84` (`passes`), `:87` (`tables`), `:95-100` (`put`), `:140-149` (GET order), `:155-164` (POST)
- Test: `src/lib/edit/__tests__/edits-migration.test.ts`, `src/lib/edit/worker/__tests__/stand-ins.test.ts`

**Interfaces:** Consumes: `standIns()`, `Rest.put(table, row)`, `takeRow()`, `TAKE`, `USER`, `OTHER` (`src/lib/edit/worker/__tests__/stand-ins.ts`, `rows.ts`). Produces: `Database["public"]["Tables"]["edits"]` (Row: `id, user_id, thread_id: string | null, take_id, title, look: string | null, style: Json | null, head: number | null, export_job: string | null, export_turn: number | null, created_at, updated_at`) and `["edit_turns"]` (Row: `edit_id, n: number, kind: string, request: string | null, at: number | null, say: string, findings: Json, kept: Json, doc: Json | null, created_at`); the stand-in's tables `"edits" | "edit_turns" | "threads" | "messages"` with the key `(edit_id, n)` answered `409 {code: "23505"}`.

- [ ] Step 1: Write the failing tests.

`src/lib/edit/__tests__/edits-migration.test.ts`:

```ts
/**
 * edits-migration.test.ts — the editor's two tables as their migration writes them (plan 2026-11-24-editor-screens-a, Task 1).
 * The migration is applied by the controller after review, never by a test: this reads its text and holds the rules the
 * routes and the stand-in rely on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(join(process.cwd(), "supabase/migrations/20261124210000_edits_turns.sql"), "utf8").replace(/--.*$/gm, "");

describe("the edits and edit_turns migration", () => {
  it("makes both tables, a turn keyed on its edit and its number", () => {
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.edits (");
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.edit_turns (");
    expect(SQL).toMatch(/PRIMARY KEY \(edit_id, n\)/);
    expect(SQL).toMatch(/kind\s+text\s+NOT NULL CHECK \(kind IN \('cut', 'change', 'direct', 'said'\)\)/);
    expect(SQL).toMatch(/CHECK \(\(kind = 'said'\) = \(doc IS NULL\)\)/);
    expect(SQL).toMatch(/n\s+integer\s+NOT NULL CHECK \(n >= 1 AND n <= 300\)/);
  });

  it("holds an edit to its creator's own take, and drops its turns with it", () => {
    expect(SQL).toMatch(/FOREIGN KEY \(take_id, user_id\) REFERENCES public\.edit_takes \(id, user_id\) ON DELETE CASCADE/);
    expect(SQL).toMatch(/FOREIGN KEY \(edit_id\) REFERENCES public\.edits \(id\) ON DELETE CASCADE/);
  });

  it("lets a creator read their own rows and write none", () => {
    expect(SQL.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(2);
    expect(SQL.match(/FOR SELECT TO authenticated/g)).toHaveLength(2);
    expect(SQL).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/);
    expect(SQL).toContain("REVOKE ALL ON TABLE public.edits, public.edit_turns FROM anon;");
    expect(SQL).toContain("REVOKE ALL ON TABLE public.edits, public.edit_turns FROM authenticated;");
    expect(SQL).toContain("GRANT SELECT ON TABLE public.edits, public.edit_turns TO authenticated;");
  });

  it("stamps an edit's updated_at with the database's clock", () => {
    expect(SQL).toMatch(/CREATE TRIGGER edits_updated_at\s+BEFORE UPDATE ON public\.edits\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.edit_touch_updated_at\(\);/);
  });
});
```

`src/lib/edit/worker/__tests__/stand-ins.test.ts`:

```ts
/**
 * stand-ins.test.ts — the REST stand-in holds the editor's tables as the migration has them (plan 2026-11-24-editor-screens-a,
 * Task 1): a turn keyed on its edit and number, an edit only on its creator's take, numbers ordered and compared as numbers,
 * and a session that reads its own edits and writes nothing.
 */
import { describe, expect, it } from "vitest";
import { OTHER, TAKE, USER, takeRow } from "./rows";
import { standIns } from "./stand-ins";

async function withEdit() {
  const world = standIns();
  world.rest.put("edit_takes", takeRow());
  const service = world.service();
  const made = await service.from("edits").insert({ user_id: USER, take_id: TAKE, title: "Good morning" }).select().single();
  if (made.error) throw new Error(made.error.message);
  return { world, service, edit: made.data };
}

describe("the stand-in's edits and turns", () => {
  it("refuses a second turn of the same number, as the key does", async () => {
    const { service, edit } = await withEdit();
    const turn = { edit_id: edit.id, n: 1, kind: "cut", say: "Captions are on." };
    expect((await service.from("edit_turns").insert(turn)).error).toBeNull();
    expect((await service.from("edit_turns").insert(turn)).error?.code).toBe("23505");
  });

  it("orders turns and compares their numbers as numbers", async () => {
    const { service, edit } = await withEdit();
    for (let n = 1; n <= 12; n++) await service.from("edit_turns").insert({ edit_id: edit.id, n, kind: "change", say: `turn ${n}`, doc: { n } });
    const read = await service.from("edit_turns").select("n").eq("edit_id", edit.id).order("n", { ascending: true });
    expect(read.data?.map((row) => row.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    await service.from("edit_turns").delete().eq("edit_id", edit.id).gte("n", 10);
    const left = await service.from("edit_turns").select("n").eq("edit_id", edit.id).gt("n", 8);
    expect(left.data?.map((row) => row.n)).toEqual([9]);
  });

  it("gives a turn no id of its own and an edit the migration's defaults", async () => {
    const { world, service, edit } = await withEdit();
    await service.from("edit_turns").insert({ edit_id: edit.id, n: 1, kind: "said", say: "I left the video as it is." });
    expect(world.rest.tables.edit_turns[0]).not.toHaveProperty("id");
    expect(world.rest.tables.edit_turns[0]).toMatchObject({ request: null, at: null, findings: [], kept: [], doc: null });
    expect(edit).toMatchObject({ thread_id: null, look: null, style: null, head: null, export_job: null, export_turn: null });
  });

  it("refuses an edit on another creator's take", async () => {
    const { service } = await withEdit();
    const made = await service.from("edits").insert({ user_id: OTHER, take_id: TAKE, title: "Not theirs" });
    expect(made.error?.code).toBe("23503");
  });

  it("lets a session read its own edits and write none", async () => {
    const { world, edit } = await withEdit();
    const session = world.session({ id: USER });
    expect((await session.from("edits").select("id").eq("id", edit.id)).data).toEqual([{ id: edit.id }]);
    expect((await world.session({ id: OTHER }).from("edits").select("id").eq("id", edit.id)).data).toEqual([]);
    expect((await session.from("edits").update({ head: 1 }).eq("id", edit.id)).error?.code).toBe("42501");
  });

  it("holds threads and messages for the edit's chat", async () => {
    const { service } = await withEdit();
    const thread = await service.from("threads").insert({ type: "open", reading_id: null, user_id: USER }).select("*").single();
    expect(thread.data).toMatchObject({ title: null, sim_seals: {}, type: "open" });
    const message = await service.from("messages").insert({ thread_id: thread.data!.id, role: "assistant", body: [] }).select("*").single();
    expect(message.error).toBeNull();
  });
});
```

- [ ] Step 2: Run them, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/edits-migration.test.ts src/lib/edit/worker/__tests__/stand-ins.test.ts` → the migration test fails with `ENOENT: no such file or directory` and the stand-in tests with `404 … no table edits` (the stand-in answers `PGRST205`); `tsc` also refuses `from("edits")` (`Argument of type '"edits"' is not assignable`).

- [ ] Step 3: Implement.

`supabase/migrations/20261124210000_edits_turns.sql`:

```sql
-- =========================================================================
-- The editor's edits and their turns (editor screens, slice A, Task 1;
-- spec 2026-11-24-editor-screens-design.md §6)
--
-- An edit is one take being edited by its creator: its chat, the take, its
-- title, the look of the cut shown, the style profile its last cut used, the
-- turn the creator is at (`head`), and the export of the turn shown.
-- A turn is one step: the first cut or a cut in another look (`cut`), a change
-- the agent made (`change`), a word or the captions set by hand (`direct`), or
-- an answer that changed nothing (`said`, with no `doc`). `doc` is the whole
-- edit after the turn (3 to 20 KB). Undo and Redo move `head` to a turn that
-- holds a doc; a new turn made while `head` is not the last drops the turns
-- after it. An edit keeps at most 300 turns.
-- `at` (the film frame a request was about) and `kept` (findings put away) are
-- written from slice B; in slice A they stay null and '[]'.
--
-- ── Who writes ──────────────────────────────────────────────────────────────
-- Only the app's routes, with the SERVICE client, after checking the edit is
-- the signed-in creator's. A creator reads their own rows through RLS (a turn
-- through its edit) and writes nothing, as `edit_takes` and `edit_jobs`.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.edits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id    uuid,
  take_id      uuid        NOT NULL,
  title        text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- A preset's id, 'house', 'video' (a reference's style) or 'words'; null before the first cut.
  look         text        CHECK (look IS NULL OR look ~ '^[a-z][a-z-]{0,39}$'),
  style        jsonb,
  head         integer     CHECK (head IS NULL OR (head >= 1 AND head <= 300)),
  export_job   uuid,
  export_turn  integer     CHECK (export_turn IS NULL OR (export_turn >= 1 AND export_turn <= 300)),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edits_take_owner_fkey FOREIGN KEY (take_id, user_id) REFERENCES public.edit_takes (id, user_id) ON DELETE CASCADE,
  CONSTRAINT edits_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads (id) ON DELETE SET NULL,
  CONSTRAINT edits_export_job_fkey FOREIGN KEY (export_job) REFERENCES public.edit_jobs (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.edits IS
  'The editor''s edits: a take being edited, its chat, title, look and the turn shown (editor screens, slice A). Service-role writes; a creator reads their own rows.';

CREATE TABLE IF NOT EXISTS public.edit_turns (
  edit_id     uuid        NOT NULL,
  n           integer     NOT NULL CHECK (n >= 1 AND n <= 300),
  kind        text        NOT NULL CHECK (kind IN ('cut', 'change', 'direct', 'said')),
  request     text        CHECK (request IS NULL OR char_length(request) <= 500),
  at          integer     CHECK (at IS NULL OR (at >= 0 AND at <= 5400)),
  say         text        NOT NULL,
  findings    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  kept        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  doc         jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (edit_id, n),
  CONSTRAINT edit_turns_edit_id_fkey FOREIGN KEY (edit_id) REFERENCES public.edits (id) ON DELETE CASCADE,
  CONSTRAINT edit_turns_said_has_no_doc CHECK ((kind = 'said') = (doc IS NULL))
);

COMMENT ON TABLE public.edit_turns IS
  'The editor''s turns: each step of an edit, the edit after it (doc) and what was said (editor screens, slice A). Service-role writes; a creator reads the turns of their own edits.';

-- A creator's edits, newest first; an edit's chat.
CREATE INDEX IF NOT EXISTS edits_user_created_idx ON public.edits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS edits_thread_idx ON public.edits (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS edits_take_idx ON public.edits (take_id, user_id);

-- ── updated_at, on every update (the function the edit tool's tables share) ──
DROP TRIGGER IF EXISTS edits_updated_at ON public.edits;
CREATE TRIGGER edits_updated_at
  BEFORE UPDATE ON public.edits
  FOR EACH ROW
  EXECUTE FUNCTION public.edit_touch_updated_at();

-- ── RLS: a creator reads their own rows; only the service role writes ───────
ALTER TABLE public.edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edits_select_own ON public.edits;
CREATE POLICY edits_select_own ON public.edits
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS edit_turns_select_own ON public.edit_turns;
CREATE POLICY edit_turns_select_own ON public.edit_turns
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.edits e WHERE e.id = edit_id AND e.user_id = (SELECT auth.uid())));

-- ── Grants narrowed to what is used (as 20261120130000_edit_takes_jobs_grants.sql) ──
REVOKE ALL ON TABLE public.edits, public.edit_turns FROM anon;
REVOKE ALL ON TABLE public.edits, public.edit_turns FROM authenticated;
GRANT SELECT ON TABLE public.edits, public.edit_turns TO authenticated;
```

`src/types/database.types.ts`: insert after the closing `      }` of `edit_takes` (line 1344) and before `      engine_training_videos: {` (line 1345), in the file's alphabetical order (`edit_turns` then `edits`):

```ts
      edit_turns: {
        Row: {
          at: number | null
          created_at: string
          doc: Json | null
          edit_id: string
          findings: Json
          kept: Json
          kind: string
          n: number
          request: string | null
          say: string
        }
        Insert: {
          at?: number | null
          created_at?: string
          doc?: Json | null
          edit_id: string
          findings?: Json
          kept?: Json
          kind: string
          n: number
          request?: string | null
          say: string
        }
        Update: {
          at?: number | null
          created_at?: string
          doc?: Json | null
          edit_id?: string
          findings?: Json
          kept?: Json
          kind?: string
          n?: number
          request?: string | null
          say?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_turns_edit_id_fkey"
            columns: ["edit_id"]
            isOneToOne: false
            referencedRelation: "edits"
            referencedColumns: ["id"]
          },
        ]
      }
      edits: {
        Row: {
          created_at: string
          export_job: string | null
          export_turn: number | null
          head: number | null
          id: string
          look: string | null
          style: Json | null
          take_id: string
          thread_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          export_job?: string | null
          export_turn?: number | null
          head?: number | null
          id?: string
          look?: string | null
          style?: Json | null
          take_id: string
          thread_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          export_job?: string | null
          export_turn?: number | null
          head?: number | null
          id?: string
          look?: string | null
          style?: Json | null
          take_id?: string
          thread_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edits_export_job_fkey"
            columns: ["export_job"]
            isOneToOne: false
            referencedRelation: "edit_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edits_take_owner_fkey"
            columns: ["take_id", "user_id"]
            isOneToOne: false
            referencedRelation: "edit_takes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "edits_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
```

`src/lib/edit/worker/__tests__/stand-ins.ts` (extend the header comment with one line: "The editor's `edits` and `edit_turns` (a turn keyed on `(edit_id, n)`, an edit only on its creator's take), and `threads` and `messages` for its chat (plan 2026-11-24-editor-screens-a, Task 1)."):

```ts
// line 34
type Table = "edit_takes" | "edit_jobs" | "edits" | "edit_turns" | "threads" | "messages";
```

```ts
// lines 42-45: DEFAULTS
const DEFAULTS: Record<Table, () => Row> = {
  edit_takes: () => ({ status: "uploading", facts: null, words: null, analysis: null, error: null }),
  edit_jobs: () => ({ take_id: null, input: null, status: "queued", stage: null, progress: 0, result: null, error: null, call_id: null, started_at: null, finished_at: null }),
  edits: () => ({ thread_id: null, look: null, style: null, head: null, export_job: null, export_turn: null }),
  edit_turns: () => ({ request: null, at: null, findings: [], kept: [], doc: null }),
  threads: () => ({ type: "open", reading_id: null, title: null, pinned_at: null, active_audience_id: null, sim_seals: {} }),
  messages: () => ({ body: [] }),
};
/** The tables keyed on something other than an `id` of their own. */
const NO_ID: ReadonlySet<Table> = new Set(["edit_turns"]);
```

```ts
// lines 62-84: passes — a number compares as a number, a time as a time; `gte` added
function passes(value: unknown, filter: string): boolean {
  const [op, ...rest] = filter.split(".");
  const arg = rest.join(".");
  const order = (v: unknown) => (typeof v === "number" ? v : new Date(String(v)).getTime());
  const against = (v: unknown) => (typeof v === "number" ? Number(arg) : new Date(arg).getTime());
  switch (op) {
    case "eq":
      return String(value) === arg;
    case "neq":
      return String(value) !== arg;
    case "in":
      return arg.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, "")).includes(String(value));
    case "is":
      return arg === "null" ? value === null : String(value) === arg;
    case "lt":
      return order(value) < against(value);
    case "lte":
      return order(value) <= against(value);
    case "gt":
      return order(value) > against(value);
    case "gte":
      return order(value) >= against(value);
    default:
      throw new Error(`the stand-in knows no filter "${filter}"`);
  }
}
```

```ts
// line 87
  readonly tables: Record<Table, Row[]> = { edit_takes: [], edit_jobs: [], edits: [], edit_turns: [], threads: [], messages: [] };
```

```ts
// lines 95-100: put — a keyed table's row has no id of its own
  put(table: Table, row: Row): Row {
    const at = new Date().toISOString();
    const full = { ...(NO_ID.has(table) ? {} : { id: randomUUID() }), ...DEFAULTS[table](), created_at: at, ...(table === "edit_turns" ? {} : { updated_at: at }), ...row };
    this.tables[table].push(full);
    return full;
  }
```

```ts
// lines 143-146: the GET's order — numbers as numbers
      if (order) {
        const [key = "", direction] = order.split(".");
        const compare = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
        rows = [...rows].sort((a, b) => compare(a[key], b[key]) * (direction === "desc" ? -1 : 1));
      }
```

```ts
// lines 157-162: the POST loop — the editor's keys, as the migration has them
      for (const row of Array.isArray(body) ? body : [body]) {
        if (table === "edit_jobs" && row.take_id != null && !this.tables.edit_takes.some((take) => take.id === row.take_id && take.user_id === row.user_id)) {
          return json(409, { code: "23503", message: 'insert or update on table "edit_jobs" violates foreign key constraint "edit_jobs_take_owner_fkey"' });
        }
        if (table === "edits" && !this.tables.edit_takes.some((take) => take.id === row.take_id && take.user_id === row.user_id)) {
          return json(409, { code: "23503", message: 'insert or update on table "edits" violates foreign key constraint "edits_take_owner_fkey"' });
        }
        if (table === "edit_turns" && this.tables.edit_turns.some((turn) => turn.edit_id === row.edit_id && turn.n === row.n)) {
          return json(409, { code: "23505", message: 'duplicate key value violates unique constraint "edit_turns_pkey"' });
        }
        made.push(this.put(table, row));
      }
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/edits-migration.test.ts src/lib/edit/worker/__tests__/ src/app/api/edit/__tests__/` (the existing edit suites stay green on the changed stand-in) and `pnpm exec tsc --noEmit`.

- [ ] Step 5: Commit: `git add supabase/migrations/20261124210000_edits_turns.sql src/types/database.types.ts src/lib/edit/worker/__tests__/stand-ins.ts src/lib/edit/__tests__/edits-migration.test.ts src/lib/edit/worker/__tests__/stand-ins.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(edit): the edits and edit_turns tables, written, with their types and stand-in" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 2: The turns' rules

**Files:**
- Create: `src/lib/edit/turns.ts`
- Test: `src/lib/edit/__tests__/turns.test.ts`

**Interfaces:** Consumes: nothing. Produces (all pure):
- `TURN_KINDS = ["cut", "change", "direct", "said"] as const`, `type TurnKind`, `MOST_TURNS = 300`
- `interface TurnMark { n: number; kind: TurnKind; doc: boolean }`
- `shownTurn(turns: readonly TurnMark[], head: number | null): number | null`
- `undoTarget(turns: readonly TurnMark[], head: number | null): number | null`
- `redoTarget(turns: readonly TurnMark[], head: number | null): number | null`
- `type NextTurn = { ok: true; n: number; drops: number[] } | { ok: false; reason: "full" }`; `nextTurn(turns: readonly TurnMark[], head: number | null): NextTurn`
- `canMoveTo(turns: readonly TurnMark[], n: number): boolean`
- `spokenTurns<T extends { n: number }>(turns: readonly T[], head: number | null): T[]`
- `lookAt(turns: readonly (TurnMark & { request: string | null })[], head: number | null): string | null`

`head` is the last turn of the line the creator is on (it may be a `said` turn); the edit shown is the latest turn at or before it that holds a doc. A cut turn's `request` is its look key (`house`, a preset id, `video`, `words`).

- [ ] Step 1: Write the failing test `src/lib/edit/__tests__/turns.test.ts`:

```ts
/**
 * turns.test.ts — the turns' rules (plan 2026-11-24-editor-screens-a, Task 2; spec §6): the turn shown, Undo and Redo, a new
 * turn and what it drops, the cap, the conversation and the look at a head.
 */
import { describe, expect, it } from "vitest";
import { MOST_TURNS, canMoveTo, lookAt, nextTurn, redoTarget, shownTurn, spokenTurns, undoTarget, type TurnMark } from "../turns";

const cut = (n: number): TurnMark => ({ n, kind: "cut", doc: true });
const change = (n: number): TurnMark => ({ n, kind: "change", doc: true });
const said = (n: number): TurnMark => ({ n, kind: "said", doc: false });
const direct = (n: number): TurnMark => ({ n, kind: "direct", doc: true });
/** The first cut, a change, an answer that changed nothing, a word fixed by hand. */
const LINE = [cut(1), change(2), said(3), direct(4)];

describe("the turn shown", () => {
  it("is none before the first cut", () => {
    expect(shownTurn([], null)).toBeNull();
  });

  it("is the latest turn at or before the head that holds an edit", () => {
    expect(shownTurn(LINE, 4)).toBe(4);
    expect(shownTurn(LINE, 3)).toBe(2);
    expect(shownTurn(LINE, 1)).toBe(1);
  });
});

describe("Undo and Redo", () => {
  it("Undo goes to the turn before the shown one that holds an edit, past what was said", () => {
    expect(undoTarget(LINE, 4)).toBe(2);
    expect(undoTarget(LINE, 3)).toBe(1);
    expect(undoTarget(LINE, 2)).toBe(1);
    expect(undoTarget(LINE, 1)).toBeNull();
    expect(undoTarget([], null)).toBeNull();
  });

  it("Redo goes to the first turn after the head that holds an edit", () => {
    expect(redoTarget(LINE, 1)).toBe(2);
    expect(redoTarget(LINE, 2)).toBe(4);
    expect(redoTarget(LINE, 4)).toBeNull();
  });

  it("moves only to a turn that holds an edit", () => {
    expect(canMoveTo(LINE, 2)).toBe(true);
    expect(canMoveTo(LINE, 3)).toBe(false);
    expect(canMoveTo(LINE, 9)).toBe(false);
  });
});

describe("a new turn", () => {
  it("comes right after the head and drops the turns after it", () => {
    expect(nextTurn([], null)).toEqual({ ok: true, n: 1, drops: [] });
    expect(nextTurn(LINE, 4)).toEqual({ ok: true, n: 5, drops: [] });
    expect(nextTurn(LINE, 2)).toEqual({ ok: true, n: 3, drops: [3, 4] });
  });

  it(`is refused past ${MOST_TURNS}`, () => {
    const full = Array.from({ length: MOST_TURNS }, (_, i) => change(i + 1));
    expect(nextTurn(full, MOST_TURNS)).toEqual({ ok: false, reason: "full" });
    expect(nextTurn(full, MOST_TURNS - 1)).toEqual({ ok: true, n: MOST_TURNS, drops: [MOST_TURNS] });
  });
});

describe("the conversation", () => {
  it("is every turn up to the head, in order, and none before the first", () => {
    const words = [{ n: 2, say: "b" }, { n: 1, say: "a" }, { n: 3, say: "c" }];
    expect(spokenTurns(words, 2).map((turn) => turn.say)).toEqual(["a", "b"]);
    expect(spokenTurns(words, null)).toEqual([]);
    expect(words.map((turn) => turn.n)).toEqual([2, 1, 3]);
  });

  it("names the look of the latest cut at or before the head", () => {
    const looks = [{ ...cut(1), request: "house" }, { ...change(2), request: "Bigger captions" }, { ...cut(3), request: "clean" }];
    expect(lookAt(looks, 3)).toBe("clean");
    expect(lookAt(looks, 2)).toBe("house");
    expect(lookAt(looks, null)).toBeNull();
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/turns.test.ts` → `Failed to resolve import "../turns"`.

- [ ] Step 3: Implement `src/lib/edit/turns.ts`:

```ts
/**
 * turns.ts — the rules of an edit's turns (spec 2026-11-24-editor-screens-design.md §6; plan 2026-11-24-editor-screens-a,
 * Task 2). Every change of an edit is a turn; `head` is the last turn of the line the creator is on, and the edit shown is
 * the latest turn at or before it that holds one (an answer that changed nothing, `said`, holds none). Undo and Redo move
 * `head` to a turn that holds an edit. A new turn comes right after `head` and drops the turns after it. An edit keeps at
 * most `MOST_TURNS` turns. A cut turn's `request` is the key of its look (`house`, a preset's id, `video`, `words`).
 *
 * Pure: the routes read and write the rows and ask this what to do; the page asks it nothing (the routes answer the targets).
 */
export const TURN_KINDS = ["cut", "change", "direct", "said"] as const;
export type TurnKind = (typeof TURN_KINDS)[number];

/** The most turns one edit keeps. */
export const MOST_TURNS = 300;

/** A turn as the rules read it: its number, its kind, and whether it holds an edit. */
export interface TurnMark {
  n: number;
  kind: TurnKind;
  doc: boolean;
}

const upTo = (head: number | null): number => head ?? 0;

/** The turn whose edit is shown: the latest at or before `head` that holds one; null before the first cut. */
export function shownTurn(turns: readonly TurnMark[], head: number | null): number | null {
  let shown: number | null = null;
  for (const turn of turns) if (turn.doc && turn.n <= upTo(head) && (shown === null || turn.n > shown)) shown = turn.n;
  return shown;
}

/** Where Undo goes: the turn before the shown one that holds an edit; null when there is none. */
export function undoTarget(turns: readonly TurnMark[], head: number | null): number | null {
  const shown = shownTurn(turns, head);
  return shown === null ? null : shownTurn(turns, shown - 1);
}

/** Where Redo goes: the first turn after `head` that holds an edit; null when there is none. */
export function redoTarget(turns: readonly TurnMark[], head: number | null): number | null {
  let next: number | null = null;
  for (const turn of turns) if (turn.doc && turn.n > upTo(head) && (next === null || turn.n < next)) next = turn.n;
  return next;
}

/** Whether `head` may move to `n`: a turn of the edit that holds an edit. */
export function canMoveTo(turns: readonly TurnMark[], n: number): boolean {
  return turns.some((turn) => turn.n === n && turn.doc);
}

export type NextTurn = { ok: true; n: number; drops: number[] } | { ok: false; reason: "full" };

/** A new turn: right after `head`, dropping every turn from there on; refused past `MOST_TURNS`. */
export function nextTurn(turns: readonly TurnMark[], head: number | null): NextTurn {
  const n = upTo(head) + 1;
  if (n > MOST_TURNS) return { ok: false, reason: "full" };
  return { ok: true, n, drops: turns.filter((turn) => turn.n >= n).map((turn) => turn.n) };
}

/** The conversation: every turn up to `head`, in order. A new array; `turns` is not touched. */
export function spokenTurns<T extends { n: number }>(turns: readonly T[], head: number | null): T[] {
  return turns.filter((turn) => turn.n <= upTo(head)).sort((a, b) => a.n - b.n);
}

/** The look of the edit at `head`: the `request` of the latest cut at or before it; null before the first cut. */
export function lookAt(turns: readonly (TurnMark & { request: string | null })[], head: number | null): string | null {
  let look: { n: number; request: string | null } | null = null;
  for (const turn of turns) if (turn.kind === "cut" && turn.n <= upTo(head) && (look === null || turn.n > look.n)) look = turn;
  return look?.request ?? null;
}
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/turns.test.ts && pnpm exec eslint src/lib/edit/turns.ts src/lib/edit/__tests__/turns.test.ts`.

- [ ] Step 5: Commit: `git add src/lib/edit/turns.ts src/lib/edit/__tests__/turns.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(edit): the turns' rules: the turn shown, undo, redo, a new turn and the cap" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 3: What code says, how long a wait is, and where a change starts

**Files:**
- Create: `src/lib/edit/said.ts`, `src/lib/edit/waits.ts`, `src/lib/edit/changed.ts`
- Test: `src/lib/edit/__tests__/said.test.ts`, `src/lib/edit/__tests__/waits.test.ts`, `src/lib/edit/__tests__/changed.test.ts`

**Interfaces:** Consumes: `applyOps`, `filmFrames`, `FPS`, `layout`, `lookOf`, `momentOf`, `framingAt`, `placed`, `runWords`, `type Edit`, `type Op` (`src/lib/edit/index.ts`); `presetOf` (`src/lib/edit/style/presets.ts`); `firstEdit`, `assetOf` (`src/lib/edit/worker/takes.ts`); test rows `takeRow`, `BUCKET` (`src/lib/edit/worker/__tests__/rows.ts`). Produces:
- `said.ts`: `firstCutLine(take: Edit, cut: Edit): string`; `opsSay(before: Edit, ops: readonly Op[]): string`; `sameWord(a: string, b: string): boolean`; `takeTitle(name: string, words: readonly { text: string }[] | null): string`; `lookName(key: string | null): string`; `NEXT_ASKS: readonly ["Shorter", "Bigger captions", "Add zooms"]`.
- `waits.ts`: `analysisSeconds(takeSeconds: number): number`; `exportSeconds(filmSeconds: number): number`; `MOST_EXPORT_S = 150`; `waitWords(seconds: number): string`; `interface Sample { at: number; sent: number }`; `RATE_WINDOW_MS = 8000`; `uploadSecondsLeft(samples: readonly Sample[], total: number): number | null`.
- `changed.ts`: `firstChangedFrame(before: Edit, after: Edit): number | null`.

- [ ] Step 1: Write the failing tests.

`src/lib/edit/__tests__/said.test.ts`:

```ts
/**
 * said.test.ts — the words code writes (plan 2026-11-24-editor-screens-a, Task 3; spec §5.4, E7, E22): the first cut's line,
 * a direct change's sentence, the edit's title, a look's name. On real edits made by the door from the suite's take
 * (12.7 s, "Good morning. Let us begin").
 */
import { describe, expect, it } from "vitest";
import { applyOps, type Edit, type Op } from "@/lib/edit";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { NEXT_ASKS, firstCutLine, lookName, opsSay, sameWord, takeTitle } from "../said";

const ASSET = assetOf(takeRow(), BUCKET);
const TAKE = firstEdit(ASSET);
const through = (edit: Edit, ops: Op[]): Edit => {
  const made = applyOps(edit, ops, [ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
};
const LABEL: Op = {
  op: "item.add",
  item: { id: "hook", part: "title", anchor: "start", at: 0, frames: null, props: { text: "Good morning", font: "tiktok", look: "label", y: 0.2, size: 72, color: "#111111", accent: null } },
};

describe("the first cut's line", () => {
  it("says what was cut and what is on", () => {
    expect(firstCutLine(TAKE, through(TAKE, [{ op: "shot.trim", id: "s1", startMs: 400, endMs: 11_300 }, LABEL]))).toBe("Cut from 12.7 to 10.9 seconds. Captions and a label are on.");
  });

  it("says only what is on when nothing was cut", () => {
    expect(firstCutLine(TAKE, through(TAKE, [LABEL]))).toBe("Captions and a label are on.");
  });

  it("says captions alone when the look has no label", () => {
    expect(firstCutLine(TAKE, through(TAKE, [{ op: "shot.trim", id: "s1", endMs: 11_300 }]))).toBe("Cut from 12.7 to 11.3 seconds. Captions are on.");
  });

  it("says there are no captions for a take with no speech", () => {
    const silent = firstEdit(assetOf(takeRow({ words: [] }), BUCKET));
    expect(firstCutLine(silent, silent)).toBe("No speech was found, so there are no captions.");
  });
});

describe("a direct change's sentence", () => {
  it("names the word fixed, once or in every place", () => {
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Lets" }])).toBe('Changed "Let" to "Lets".');
    const twice = through(TAKE, [{ op: "word.set", asset: ASSET.id, index: 3, text: "Let" }]);
    expect(opsSay(twice, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Lets" }, { op: "word.set", asset: ASSET.id, index: 3, text: "Lets" }])).toBe('Changed "Let" to "Lets" in 2 places.');
  });

  it("says captions on or off", () => {
    expect(opsSay(TAKE, [{ op: "captions.set", on: false }])).toBe("Captions are off.");
    expect(opsSay(TAKE, [{ op: "captions.set", on: true }])).toBe("Captions are on.");
  });

  it("knows a word heard again whatever its case and punctuation", () => {
    expect(sameWord("Claudel", "claudel.")).toBe(true);
    expect(sameWord("Claude", "Claudel")).toBe(false);
    expect(sameWord("...", "...")).toBe(false);
  });
});

describe("the edit's title and look", () => {
  it("is the take's first words, else its file's name", () => {
    expect(takeTitle("IMG_0042.MOV", ASSET.kind === "video" ? ASSET.words : null)).toBe("Good morning");
    expect(takeTitle("IMG_0042.MOV", [{ text: "Good" }, { text: "morning." }, { text: "Let" }])).toBe("Good morning");
    expect(takeTitle("IMG_0042.MOV", null)).toBe("IMG_0042");
    expect(takeTitle(".mov", [])).toBe("Your video");
  });

  it("names a look as the sheet does", () => {
    expect(lookName("house")).toBe("Our pick");
    expect(lookName("mono")).toBe("Black and white");
    expect(lookName("video")).toBe("Like a video");
    expect(lookName("words")).toBe("Described");
    expect(lookName(null)).toBe("Our pick");
  });

  it("offers three next steps in slice A", () => {
    expect(NEXT_ASKS).toEqual(["Shorter", "Bigger captions", "Add zooms"]);
  });
});
```

`src/lib/edit/__tests__/waits.test.ts`:

```ts
/** waits.test.ts — how long a wait is said to be (plan 2026-11-24-editor-screens-a, Task 3; spec E21). */
import { describe, expect, it } from "vitest";
import { MOST_EXPORT_S, analysisSeconds, exportSeconds, uploadSecondsLeft, waitWords } from "../waits";

describe("the estimates", () => {
  it("guesses the analysis from the take's length and the export from the film's", () => {
    expect(analysisSeconds(12.7)).toBe(38);
    expect(analysisSeconds(600)).toBe(420);
    expect(exportSeconds(11.3)).toBe(49);
    expect(exportSeconds(180)).toBe(MOST_EXPORT_S);
  });

  it("says a wait in words, never in a percentage", () => {
    expect(waitWords(38)).toBe("Under a minute");
    expect(waitWords(64)).toBe("About a minute");
    expect(waitWords(91)).toBe("About 2 minutes");
    expect(waitWords(200)).toBe("About 3 minutes");
  });
});

describe("the upload's time left", () => {
  it("is what is left at the rate measured over the last seconds", () => {
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 2000, sent: 4_000_000 }, { at: 4000, sent: 8_000_000 }], 48_000_000)).toBe(20);
  });

  it("is unknown before a second has been measured, and nothing once all is sent", () => {
    expect(uploadSecondsLeft([], 10)).toBeNull();
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 400, sent: 5 }], 10)).toBeNull();
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 3000, sent: 10 }], 10)).toBe(0);
  });

  it("follows the rate of the last eight seconds, not of the whole upload", () => {
    const slowThenFast = [{ at: 0, sent: 0 }, { at: 10_000, sent: 1_000_000 }, { at: 12_000, sent: 5_000_000 }, { at: 18_000, sent: 17_000_000 }];
    expect(uploadSecondsLeft(slowThenFast, 21_000_000)).toBe(2);
  });
});
```

`src/lib/edit/__tests__/changed.test.ts`:

```ts
/**
 * changed.test.ts — where a change starts on the film (plan 2026-11-24-editor-screens-a, Task 3; spec §5.2): on real edits
 * made by the door from the suite's take (12.7 s, 381 frames; "Good" at 519 ms, "Let" at 1500 ms, "begin" at 1760 ms; the
 * captions three words a page).
 */
import { describe, expect, it } from "vitest";
import { applyOps, type Edit, type Op } from "@/lib/edit";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { firstChangedFrame } from "../changed";

const ASSET = assetOf(takeRow(), BUCKET);
const FIRST = firstEdit(ASSET);
const through = (edit: Edit, ops: Op[]): Edit => {
  const made = applyOps(edit, ops, [ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
};

describe("firstChangedFrame", () => {
  it("is null when nothing seen changed, and when the whole film did", () => {
    expect(firstChangedFrame(FIRST, FIRST)).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.set", id: "s1", volume: 0.5 }]))).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "look.set", preset: "mono" }]))).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "captions.set", size: 96 }]))).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.split", id: "s1", atMs: 4000, newId: "s9" }]))).toBeNull();
  });

  it("is where a fixed word's caption page first shows", () => {
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "word.set", asset: ASSET.id, index: 0, text: "Hello" }]))).toBe(16);
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "word.set", asset: ASSET.id, index: 4, text: "start" }]))).toBe(45);
  });

  it("is where a part comes in, or where a zoom starts", () => {
    const title: Op = { op: "item.add", item: { id: "t1", part: "title", anchor: "start", at: 60, frames: 45, props: { text: "Hello there", font: "tiktok", look: "label", y: 0.2, size: 72, color: "#111111", accent: null } } };
    expect(firstChangedFrame(FIRST, through(FIRST, [title]))).toBe(60);
    const split = through(FIRST, [{ op: "shot.split", id: "s1", atMs: 4000, newId: "s9" }]);
    expect(firstChangedFrame(split, through(split, [{ op: "shot.set", id: "s9", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } }]))).toBe(120);
  });

  it("is the start for a cut at the start, and a second before the new end for a cut at the end", () => {
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.trim", id: "s1", startMs: 500 }]))).toBe(0);
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.trim", id: "s1", endMs: 10_000 }]))).toBe(270);
  });
});
```

- [ ] Step 2: Run them, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/said.test.ts src/lib/edit/__tests__/waits.test.ts src/lib/edit/__tests__/changed.test.ts` → `Failed to resolve import "../said"` (and `../waits`, `../changed`).

- [ ] Step 3: Implement.

`src/lib/edit/said.ts`:

```ts
/**
 * said.ts — the words the editor writes by code, never the model's (spec 2026-11-24-editor-screens-design.md §5.3, §5.4, E7;
 * plan 2026-11-24-editor-screens-a, Task 3): the first cut's line from the facts of the cut; the sentence of a change made by
 * hand; the edit's title; a look's name; the next steps offered under the latest answer. Pure, and light enough for the page.
 */
import { FPS, filmFrames, type Edit, type Op } from "@/lib/edit";
import { presetOf } from "@/lib/edit/style/presets";

/** The next steps under the latest answer in slice A, after "N to check" (§5.3). */
export const NEXT_ASKS = ["Shorter", "Bigger captions", "Add zooms"] as const;

const seconds = (edit: Edit): string => (filmFrames(edit) / FPS).toFixed(1);
const wordsOf = (edit: Edit) => edit.assets.flatMap((asset) => (asset.kind === "video" ? (asset.words ?? []) : []));

/**
 * The first cut's line (§5.4): what was cut, then what is on. `take` is the take as one shot (`firstEdit`), `cut` the first
 * cut. The agent's long first-cut sentence is not shown. Three lines of the spec, and two more for a look with no label
 * (`mono`) or a cut whose label was left out by its review: "Captions are on." and "A label is on.".
 */
export function firstCutLine(take: Edit, cut: Edit): string {
  if (wordsOf(cut).length === 0) return "No speech was found, so there are no captions.";
  const [from, to] = [seconds(take), seconds(cut)];
  const label = cut.items.some((item) => item.part === "title");
  const on = cut.captions.on && label ? "Captions and a label are on." : cut.captions.on ? "Captions are on." : label ? "A label is on." : null;
  const said = [from === to ? null : `Cut from ${from} to ${to} seconds.`, on].filter((part) => part !== null);
  return said.length > 0 ? said.join(" ") : "Your first cut is ready.";
}

/** A word bare of case and of the punctuation around it; "" for one that is all punctuation. */
const bare = (text: string) => text.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** Whether two heard words are the same word ("Claudel" and "claudel."): "Fix all N" offers the others. */
export function sameWord(a: string, b: string): boolean {
  return bare(a) !== "" && bare(a) === bare(b);
}

/**
 * The sentence of a change made by hand (`POST …/ops`): each word fixed, once or "in N places", then captions on or off.
 * `before` is the edit the ops were applied to.
 */
export function opsSay(before: Edit, ops: readonly Op[]): string {
  const fixed = new Map<string, { from: string; to: string; times: number }>();
  const captions: string[] = [];
  for (const op of ops) {
    if (op.op === "captions.set" && op.on !== undefined) captions.push(op.on ? "Captions are on." : "Captions are off.");
    if (op.op !== "word.set" || op.text === undefined) continue;
    const asset = before.assets.find((each) => each.id === op.asset);
    const word = asset?.kind === "video" ? asset.words?.[op.index] : undefined;
    if (!word || word.text === op.text) continue;
    const key = `${word.text}\u0000${op.text}`;
    const seen = fixed.get(key);
    if (seen) seen.times += 1;
    else fixed.set(key, { from: word.text, to: op.text, times: 1 });
  }
  const words = [...fixed.values()].map(({ from, to, times }) => `Changed "${from}" to "${to}"${times > 1 ? ` in ${times} places` : ""}.`);
  const all = [...words, ...captions];
  return all.length > 0 ? all.join(" ") : "Nothing changed.";
}

/**
 * The edit's title (§6, the card): the take's first words up to the end of its first sentence or five words, without the
 * closing mark; with none heard, its file's name without the extension; "Your video" when that is empty.
 */
export function takeTitle(name: string, words: readonly { text: string }[] | null): string {
  const first: string[] = [];
  for (const word of words ?? []) {
    first.push(word.text);
    if (/[.!?]$/.test(word.text) || first.length === 5) break;
  }
  const said = first.join(" ").replace(/[.!?,;:]+$/, "").trim();
  if (said !== "") return said.slice(0, 200);
  const stem = name.replace(/\.[A-Za-z0-9]{2,4}$/, "").trim();
  return stem === "" ? "Your video" : stem.slice(0, 200);
}

/** A look's name, as the sheet and the card say it: "Our pick" for the house style (and before any cut). */
export function lookName(key: string | null): string {
  if (key === null || key === "house") return "Our pick";
  if (key === "video") return "Like a video";
  if (key === "words") return "Described";
  return presetOf(key)?.name ?? "Our pick";
}
```

`src/lib/edit/waits.ts`:

```ts
/**
 * waits.ts — how long a wait is said to be (spec 2026-11-24-editor-screens-design.md E21; plan 2026-11-24-editor-screens-a,
 * Task 3): the upload's time left from what it has measured, and estimates of the analysis from the take's length and of the
 * export from the film's. Said in words ("About a minute"), never as a percentage alone. Pure.
 */

/** The longest an export is said to take, in seconds. */
export const MOST_EXPORT_S = 150;

/** The analysis of a take of this many seconds, in seconds: about 30 plus 0.65 a second of take. */
export function analysisSeconds(takeSeconds: number): number {
  return Math.round(30 + 0.65 * Math.max(0, takeSeconds));
}

/** The export of a film of this many seconds, in seconds: about 40 plus 0.8 a second of film, at most `MOST_EXPORT_S`. */
export function exportSeconds(filmSeconds: number): number {
  return Math.min(MOST_EXPORT_S, Math.round(40 + 0.8 * Math.max(0, filmSeconds)));
}

/** A wait in words: "Under a minute", "About a minute", "About N minutes". */
export function waitWords(seconds: number): string {
  if (seconds < 60) return "Under a minute";
  if (seconds < 90) return "About a minute";
  return `About ${Math.round(seconds / 60)} minutes`;
}

/** What an upload had sent, and when (ms). */
export interface Sample {
  at: number;
  sent: number;
}

/** How far back the upload's rate is measured: a connection that speeds up or slows down is followed. */
export const RATE_WINDOW_MS = 8000;

/**
 * The upload's seconds left: what is left, at the rate measured over the last `RATE_WINDOW_MS`; 0 once all is sent; null
 * until a second of it has been measured.
 */
export function uploadSecondsLeft(samples: readonly Sample[], total: number): number | null {
  const last = samples.at(-1);
  if (!last) return null;
  if (last.sent >= total) return 0;
  const from = samples.find((sample) => sample.at >= last.at - RATE_WINDOW_MS) ?? samples[0]!;
  const ms = last.at - from.at;
  const bytes = last.sent - from.sent;
  if (ms < 1000 || bytes <= 0) return null;
  return Math.ceil(((total - last.sent) / bytes) * (ms / 1000));
}
```

`src/lib/edit/changed.ts`:

```ts
/**
 * changed.ts — where a change starts on the film (spec 2026-11-24-editor-screens-design.md §5.2; plan
 * 2026-11-24-editor-screens-a, Task 3), so the page can go there and play it. Read from the two edits' layouts (`derive.ts`):
 * for each film frame, what is drawn on it (the footage and the moment of it, its framing and look; the caption page that can
 * show; each part showing and how far into it). The film's own look and captions' settings reach every frame: when they
 * differ, the whole film changed and there is no one place (null), and the playhead stays. Sound alone is not seen. Pure.
 */
import { FPS, framingAt, layout, lookOf, momentOf, placed, runWords, type Edit } from "@/lib/edit";

/** What every frame shares: the stage, the film's look, the captions' settings. */
function filmWide(edit: Edit): string {
  return JSON.stringify([edit.stage, edit.look, edit.captions]);
}

/** What is drawn on each frame, as text. */
function framesOf(edit: Edit): string[] {
  const lay = layout(edit);
  const footage = new Array<string>(lay.frames).fill("");
  const over: string[][] = Array.from({ length: lay.frames }, () => []);
  edit.shots.forEach((shot, i) => {
    const place = lay.shots[i];
    const run = place ? lay.runs[place.run] : undefined;
    if (!place || !run) return;
    const look = JSON.stringify(lookOf(edit, shot));
    // Later shots write over earlier ones: in a transition the frame is the incoming shot's (`momentAt`).
    for (let f = Math.max(0, place.at); f < Math.min(lay.frames, place.at + place.frames); f++) {
      const ms = momentOf(run, f);
      const framed = framingAt(shot, ms);
      footage[f] = `${shot.asset}@${Math.round(ms)} ${framed.zoom.toFixed(3)} ${framed.x.toFixed(3)} ${framed.y.toFixed(3)} ${look}`;
    }
  });
  if (edit.captions.on) {
    for (const run of lay.runs) {
      const words = runWords(edit, run);
      // A page holds at most `maxWords` words, so a word can show from the start of a page up to that many words before it.
      words.forEach((word, k) => {
        const page = words.slice(k, k + edit.captions.maxWords).map((each) => `${each.text}${each.stress ? "*" : ""}`).join(" ");
        for (let f = run.at + word.from; f < Math.min(lay.frames, run.at + word.to); f++) over[f]!.push(`said ${page}`);
      });
    }
  }
  for (const thing of placed(edit)) {
    for (let f = thing.at; f < Math.min(lay.frames, thing.at + thing.frames); f++) {
      over[f]!.push(`${thing.thing.part} ${thing.thing.id} ${f - thing.at + thing.skip} ${JSON.stringify(thing.thing.props)}`);
    }
  }
  return footage.map((shown, f) => [shown, ...over[f]!.sort()].join("|"));
}

/**
 * The first film frame whose drawn content differs between `before` and `after`; null when nothing seen changed, or when the
 * whole film did (its look, its captions' settings). A film made shorter at its end gives a second before its new end, so the
 * new ending is played; one made longer gives its first new frame.
 */
export function firstChangedFrame(before: Edit, after: Edit): number | null {
  if (filmWide(before) !== filmWide(after)) return null;
  const was = framesOf(before);
  const now = framesOf(after);
  const shared = Math.min(was.length, now.length);
  for (let f = 0; f < shared; f++) if (was[f] !== now[f]) return f;
  if (was.length === now.length) return null;
  return now.length < was.length ? Math.max(0, now.length - FPS) : shared;
}
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/said.test.ts src/lib/edit/__tests__/waits.test.ts src/lib/edit/__tests__/changed.test.ts && pnpm exec eslint src/lib/edit/said.ts src/lib/edit/waits.ts src/lib/edit/changed.ts`. (The expected frames were measured on a throwaway prototype against these same edits before the plan was written.)

- [ ] Step 5: Commit: `git add src/lib/edit/said.ts src/lib/edit/waits.ts src/lib/edit/changed.ts src/lib/edit/__tests__/said.test.ts src/lib/edit/__tests__/waits.test.ts src/lib/edit/__tests__/changed.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(edit): the editor's words by code, its waits, and where a change starts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 4: The edit block, its card in the chat, and Library's kind `edit`

**Files:**
- Create: `src/lib/edit/edit-view.ts`, `src/components/thread/edit-block.tsx`, `src/components/thread-next/edit-answer.tsx`, `src/components/editor/__tests__/views.ts` (test fixtures shared by the editor's client tests)
- Modify: `src/lib/tools/profile-blocks.ts:282` (after `export type VideoTestCardBlock`), `src/lib/tools/block-registry.ts:33-38` (import) and `:70` (registry), `src/lib/tools/on-screen.ts:264` (`NON_RECORD_BLOCKS`), `src/lib/thread-next/answer-parts.ts:21-40` (imports, `AnswerPart`), `:43-59` (`RESULT_TYPES`), `:117-125` (second switch), `src/components/thread-next/thread-turn-next.tsx:73` (import), `:268-280` (`originalIndexOf`), `:294-303` (`PartView`), `:366` (`chips`), `src/components/thread/message-blocks.tsx:38` (import) and `:71` (map), `src/components/thread-next/field-icons.tsx` (end of file), `src/lib/library/chat-summary.ts:29` (`PieceKind`), `:193-201` (lead and stage), `src/lib/library/piece-words.ts:28-29` (`case "chat"`), `src/lib/posted/posted.ts:41` (`PostedPieceKind`), `src/components/library-next/row-line.ts:55-63` (`FALLBACK_TITLE`), `src/components/library-next/chat-row.tsx:7` (import) and `:123-131` (`MARK`)
- Test: `src/lib/tools/__tests__/edit-block.test.ts`, `src/lib/thread-next/__tests__/answer-parts-edit.test.ts`, `src/lib/library/__tests__/chat-summary-edit.test.ts`, `src/components/thread-next/__tests__/edit-answer.test.tsx`; modify `src/lib/thread-next/__tests__/answer-parts.test.ts:171` (its exact list of result types gains `"edit"`)

**Interfaces:** Consumes: `validateBlock` (`block-registry.ts`), `partsOf`, `hasResultCard`, `type Indexed` (`answer-parts.ts`), `AnswerCard`, `CardHeader`, `AnswerPrimary` (`answer-card.tsx`), `VideoThumb` (`video-answer.tsx`), `timecode` (`src/lib/result/format.ts`), `lookName` (Task 3), `type TurnKind` (Task 2), `filmFrames`, `FPS`, `type Edit`, `type Asset`, `type Finding` (`src/lib/edit/review.ts`). Produces:
- `src/lib/edit/edit-view.ts`: `interface TurnShown { n: number; kind: TurnKind; request: string | null; at: number | null; say: string; doc: boolean; findings: Finding[] }`, `interface TakeShown { id: string; name: string; status: string; error: string | null; stage: string | null; progress: number | null; ms: number | null; posterUrl: string | null; previewUrl: string | null; asset: Asset | null }`, `interface ExportShown { job: string; turn: number; status: string; stage: string | null; progress: number; error: string | null; filmUrl: string | null; ms: number | null }`, `interface EditView { id: string; title: string; threadId: string | null; look: string | null; updatedAt: string; take: TakeShown; head: number | null; shown: number | null; edit: Edit | null; undo: number | null; redo: number | null; turns: TurnShown[]; export: ExportShown | null }`, `LIVE_JOB: ReadonlySet<string>` (`queued`, `running`).
- `EditBlockSchema`, `type EditBlock = { type: "edit"; props: { editId: string } }` (`profile-blocks.ts`); `AnswerPart` gains `{ kind: "edit"; item: Indexed<EditBlock> }`.
- `EditAnswer({ block }: { block: EditBlock })`, `EditAnswerView({ id, view, failed })`, `editedWords(iso: string, now?: Date): string`, `lengthOf(view: EditView): number` (`edit-answer.tsx`).
- `PieceKind` gains `"edit"`; `ScissorsIcon`, `MoreIcon` (`field-icons.tsx`).
- Test fixtures `EDIT_ID`, `THREAD_ID`, `ASSET`, `FIRST`, `changed(edit, ops)`, `viewOf(over?)` (`src/components/editor/__tests__/views.ts`).

- [ ] Step 1: Write the failing tests.

In `src/lib/thread-next/__tests__/answer-parts.test.ts`, the exact list of `"lists exactly the drawn result types"` (lines 166-182) gains `"edit",` after `"video-test-card",`: an edit's card is a drawn result, so prose beside it is narration.

`src/components/editor/__tests__/views.ts` (fixtures; not a test file):

```ts
/**
 * views.ts — `EditView`s as `GET /api/edit/edits/[id]` answers them, for the editor's client tests (plan
 * 2026-11-24-editor-screens-a). Their edits are real: made by the door (`firstEdit`, `applyOps`) from the suite's take (12.7 s,
 * 381 frames, "Good morning. Let us begin").
 */
import { applyOps, type Edit, type Op } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";

export const EDIT_ID = "55555555-5555-4555-8555-555555555555";
export const THREAD_ID = "66666666-6666-4666-8666-666666666666";
export const ASSET = assetOf(takeRow(), BUCKET);
export const FIRST = firstEdit(ASSET);
/** When the views were last changed: today, read once a test file, so two views of the same edit are equal. */
export const TODAY = new Date().toISOString();

export function changed(edit: Edit, ops: Op[]): Edit {
  const made = applyOps(edit, ops, [ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
}

/** A ready take and its first cut shown, unless told otherwise. */
export function viewOf(over: Partial<EditView> = {}): EditView {
  return {
    id: EDIT_ID,
    title: "Good morning",
    threadId: THREAD_ID,
    look: "house",
    updatedAt: TODAY,
    take: { id: ASSET.id, name: "take.mp4", status: "ready", error: null, stage: null, progress: null, ms: 12_700, posterUrl: "https://media.test/poster.jpg", previewUrl: "https://media.test/preview.mp4", asset: ASSET },
    head: 1,
    shown: 1,
    edit: FIRST,
    undo: null,
    redo: null,
    turns: [{ n: 1, kind: "cut", request: "house", at: null, say: "Captions are on.", doc: true, findings: [] }],
    export: null,
    ...over,
  };
}
```

`src/lib/tools/__tests__/edit-block.test.ts`:

```ts
/** edit-block.test.ts — the `edit` block: a door from a chat to its editor page (plan 2026-11-24-editor-screens-a, Task 4). */
import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, validateBlock } from "../block-registry";
import { NON_RECORD_BLOCKS } from "../on-screen";

const ID = "55555555-5555-4555-8555-555555555555";

describe("the edit block", () => {
  it("is registered and holds only the edit's id", () => {
    expect(Object.keys(BLOCK_REGISTRY)).toContain("edit");
    expect(validateBlock({ type: "edit", props: { editId: ID } })).toEqual({ ok: true, block: { type: "edit", props: { editId: ID } } });
    expect(validateBlock({ type: "edit", props: { editId: "not-an-id" } }).ok).toBe(false);
    expect(validateBlock({ type: "edit", props: {} }).ok).toBe(false);
  });

  it("drops anything else a stored block carries: the card reads the edit itself", () => {
    const read = validateBlock({ type: "edit", props: { editId: ID, title: "kept nowhere" } });
    expect(read.ok && read.block.props).toEqual({ editId: ID });
  });

  it("is knowingly left out of the chat's memory", () => {
    expect(NON_RECORD_BLOCKS.edit).toMatch(/editor/);
  });
});
```

`src/lib/thread-next/__tests__/answer-parts-edit.test.ts`:

```ts
/** answer-parts-edit.test.ts — an `edit` block in a turn is one card, and the prose beside it narration (Task 4). */
import { describe, expect, it } from "vitest";
import { hasResultCard, partsOf } from "../answer-parts";

const EDIT = { type: "edit", props: { editId: "55555555-5555-4555-8555-555555555555" } };

describe("an edit block in a turn", () => {
  it("is one edit part at its index", () => {
    const blocks = [{ type: "markdown", props: { text: "Here is your edit." } }, EDIT];
    expect(hasResultCard(blocks)).toBe(true);
    expect(partsOf(blocks)).toEqual([{ kind: "edit", item: { index: 1, block: EDIT } }]);
  });
});
```

`src/lib/library/__tests__/chat-summary-edit.test.ts`:

```ts
/** chat-summary-edit.test.ts — Library's row of a chat that holds an edit (plan 2026-11-24-editor-screens-a, Task 4). */
import { describe, expect, it } from "vitest";
import { fallbackTitle } from "@/components/library-next/row-line";
import { chatSummaryOf } from "../chat-summary";
import { insideLabel } from "../piece-words";

const EDIT = { type: "edit", props: { editId: "55555555-5555-4555-8555-555555555555" } };
const NONE = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

describe("a chat that holds an edit", () => {
  it("is led by the edit, a draft, with nothing counted", () => {
    expect(chatSummaryOf([[EDIT]], {})).toEqual({ counts: NONE, lead: "edit", stage: "draft", sim: null, frame: null });
  });

  it("says Edit and is named Edit until it has a title", () => {
    expect(insideLabel({ counts: NONE, lead: "edit" })).toBe("Edit");
    expect(fallbackTitle("edit")).toBe("Edit");
  });

  it("leaves a chat with no edit as it was", () => {
    expect(chatSummaryOf([[{ type: "markdown", props: { text: "Hi" } }]], {})).toMatchObject({ lead: "chat", stage: "chat" });
    expect(chatSummaryOf("not a list" as unknown as unknown[], {})).toMatchObject({ lead: "chat", stage: "chat" });
  });
});
```

`src/components/thread-next/__tests__/edit-answer.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * edit-answer.test.tsx — the edit's card in its chat (plan 2026-11-24-editor-screens-a, Task 4; spec §3 screen 13): it reads
 * the edit from `GET /api/edit/edits/[id]` (the network stood in, answered with a view of a real edit), so it is never out of
 * date; its one primary opens the editor. And the turn that holds it offers no chat chips.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { EDIT_ID, viewOf } from "@/components/editor/__tests__/views";
import { renderWithClient } from "@/test/render-with-client";
import { EditAnswer, editedWords } from "../edit-answer";
import { ThreadTurnNext } from "../thread-turn-next";

const BLOCK = { type: "edit" as const, props: { editId: EDIT_ID } };

function answer(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url) !== `/api/edit/edits/${EDIT_ID}`) throw new Error(`no answer for ${String(url)}`);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the edit's card", () => {
  it("shows the edit as it stands: its title, length, look and day, and opens the editor", async () => {
    answer(200, viewOf({ title: "Good morning", look: "clean" }));
    renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    expect(screen.getByText("0:13 · Clean")).toBeInTheDocument();
    expect(screen.getByText("Edited today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open editor/ })).toHaveAttribute("href", `/edit/${EDIT_ID}`);
  });

  it("says so when the edit is not there, and still offers the editor", async () => {
    answer(404, { error: "no such edit" });
    renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("This edit is not here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open editor/ })).toBeInTheDocument();
  });

  it("is the turn's whole answer: no chat chips under it", async () => {
    answer(200, viewOf());
    renderWithClient(<ThreadTurnNext blocks={[BLOCK]} />);
    await waitFor(() => expect(screen.getByText("Good morning")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Give me ideas/ })).toBeNull();
  });
});

describe("editedWords", () => {
  const now = new Date(2026, 10, 24, 15, 0);
  it("says today, yesterday, else the day", () => {
    expect(editedWords(new Date(2026, 10, 24, 9, 0).toISOString(), now)).toBe("Edited today");
    expect(editedWords(new Date(2026, 10, 23, 23, 0).toISOString(), now)).toBe("Edited yesterday");
    expect(editedWords(new Date(2026, 10, 12, 9, 0).toISOString(), now)).toBe("Edited Nov 12");
    expect(editedWords("not a time", now)).toBe("Edited");
  });
});
```

- [ ] Step 2: Run them, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/tools/__tests__/edit-block.test.ts src/lib/thread-next/__tests__/answer-parts-edit.test.ts src/lib/library/__tests__/chat-summary-edit.test.ts src/components/thread-next/__tests__/edit-answer.test.tsx` → `expected [ … ] to include 'edit'`, `Failed to resolve import "../edit-answer"`, `Failed to resolve import "@/lib/edit/edit-view"`, and `lead: "chat"` where `"edit"` was expected.

- [ ] Step 3: Implement.

`src/lib/edit/edit-view.ts`:

```ts
/**
 * edit-view.ts — an edit as the page and the card read it: what `GET /api/edit/edits/[id]` answers, and what every route that
 * changes an edit answers (plan 2026-11-24-editor-screens-a; spec §5, §7). Types only, and `LIVE_JOB`.
 */
import type { Asset, Edit } from "./doc";
import type { Finding } from "./review";
import type { TurnKind } from "./turns";

/** A job still at work: queued or running (as `liveJob` counts one). */
export const LIVE_JOB: ReadonlySet<string> = new Set(["queued", "running"]);

/** A turn of the conversation: what was asked, what was said, whether it holds an edit, what the review found then. */
export interface TurnShown {
  n: number;
  kind: TurnKind;
  /** The creator's words; a cut's look key (`house`, a preset's id, `video`, `words`). */
  request: string | null;
  /** The film frame a request was about; always null in slice A. */
  at: number | null;
  say: string;
  doc: boolean;
  findings: Finding[];
}

/** The take: its state as it stands (`takeState`), its analysis's progress, and once ready its facts and fresh addresses. */
export interface TakeShown {
  id: string;
  name: string;
  /** `uploading`, `analysing`, `ready` or `failed`. */
  status: string;
  error: string | null;
  stage: string | null;
  progress: number | null;
  ms: number | null;
  posterUrl: string | null;
  previewUrl: string | null;
  asset: Asset | null;
}

/** The export of the turn shown: its job as it stands, and the file's address once it is made. */
export interface ExportShown {
  job: string;
  turn: number;
  status: string;
  stage: string | null;
  progress: number;
  error: string | null;
  filmUrl: string | null;
  /** The film's length as rendered, in ms; null until it is made. */
  ms: number | null;
}

export interface EditView {
  id: string;
  title: string;
  threadId: string | null;
  /** The look of the edit shown: a preset's id, `house`, `video`, `words`; null before the first cut. */
  look: string | null;
  updatedAt: string;
  take: TakeShown;
  /** The last turn of the line the creator is on; null before the first cut. */
  head: number | null;
  /** The turn whose edit is shown, and that edit. */
  shown: number | null;
  edit: Edit | null;
  /** Where Undo and Redo go; null where they cannot. */
  undo: number | null;
  redo: number | null;
  /** The conversation: every turn up to `head`. */
  turns: TurnShown[];
  /** The export of the turn shown; null when there is none. */
  export: ExportShown | null;
}
```

`src/lib/tools/profile-blocks.ts`, after line 282 (`export type VideoTestCardBlock = …`):

```ts
// ─── edit ────────────────────────────────────────────────────────────────────────
// The editor's card in its chat (plan 2026-11-24-editor-screens-a, Task 4): only the edit's id. The card reads the edit's
// title, length, look, picture and day from the edit itself (`GET /api/edit/edits/[id]`), so it is never out of date.

export const EditBlockSchema = z.object({
  type: z.literal("edit"),
  props: z.object({ editId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) }),
});

export type EditBlock = z.infer<typeof EditBlockSchema>;
```

`src/lib/tools/block-registry.ts`: in the import from `./profile-blocks` (lines 33-38) add `EditBlockSchema,`; after line 70 (`"video-test-card": …`) add:

```ts
  // The editor's card (plan 2026-11-24-editor-screens-a): a door from a chat to its edit's page.
  edit: { schema: EditBlockSchema as z.ZodType },
```

`src/lib/tools/on-screen.ts`, inside `NON_RECORD_BLOCKS` after line 264 (`personas: …`):

```ts
  edit: "a door to the editor page: the edit lives in its own tables and is read there, so the chat has nothing to replay",
```

`src/lib/thread-next/answer-parts.ts`: line 22 becomes `import type { EditBlock, VideoTestCardBlock } from "@/lib/tools/profile-blocks";`; in `AnswerPart` after `| { kind: "video"; item: Indexed<VideoTestCardBlock> }` add `| { kind: "edit"; item: Indexed<EditBlock> }`; in `RESULT_TYPES` after `"video-test-card",` add `"edit",`; in the second switch after the `case "video-test-card":` arm add:

```ts
      case "edit":
        parts.push({ kind: "edit", item: { index, block: block as EditBlock } });
        return;
```

`src/components/thread/edit-block.tsx`:

```tsx
/**
 * edit-block.tsx — the legacy thread's renderer of an `edit` block: nothing. The editor exists under the new look only (its
 * page is a 404 with the flag off), so with the flag off there is no door to draw (plan 2026-11-24-editor-screens-a, Task 4).
 */
export function EditBlockRenderer(): null {
  return null;
}
```

`src/components/thread/message-blocks.tsx`: after line 38 (`import { ComposedCardRenderer } …`) add `import { EditBlockRenderer } from '@/components/thread/edit-block';`; after line 71 (`"video-test-card": VideoTestCardRenderer,`) add `edit: EditBlockRenderer,`.

`src/components/thread-next/field-icons.tsx`, at the end of the file:

```tsx
/** Edit (Home's card, the edit's card and Library's mark): scissors, the drawing's `I.cut` at this set's 24. */
export const ScissorsIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="6.6" cy="7.2" r="2.6" />
    <circle cx="6.6" cy="16.8" r="2.6" />
    <path d="M8.9 8.8 20.4 16.8M8.9 15.2 20.4 7.2" />
  </Glyph>
);

/** More (Home's sixth card): three dots, the drawing's `I.more`. */
export const MoreIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="6" cy="12" r="1.45" fill="currentColor" />
    <circle cx="12" cy="12" r="1.45" fill="currentColor" />
    <circle cx="18" cy="12" r="1.45" fill="currentColor" />
  </Glyph>
);
```

`src/components/thread-next/edit-answer.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { FPS, filmFrames } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { lookName } from "@/lib/edit/said";
import { timecode } from "@/lib/result/format";
import type { EditBlock } from "@/lib/tools/profile-blocks";

import { AnswerCard, AnswerPrimary, CardHeader } from "./answer-card";
import { ScissorsIcon } from "./field-icons";
import { VideoThumb } from "./video-answer";

/**
 * The edit's card in its chat (spec 2026-11-24-editor-screens-design.md §3 screen 13, §6; plan
 * 2026-11-24-editor-screens-a, Task 4; drawing `.acard`): the take's picture (66 wide), "Edit", the title, the film's length
 * and its look, the day it was last changed, and the one primary "Open editor". Read from the edit itself, so a change made in
 * the editor is what the card shows. The page says what is wrong with an edit; the card only that it is not there.
 */

/** "Edited today", "Edited yesterday", "Edited Nov 12": the day the edit was last changed, in the viewer's calendar. */
export function editedWords(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "Edited";
  const day = (when: Date) => new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  return `Edited ${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** The film's length in seconds: the edit shown, else the take's. */
export function lengthOf(view: EditView): number {
  return view.edit ? filmFrames(view.edit) / FPS : (view.take.ms ?? 0) / 1000;
}

async function readEdit(id: string): Promise<EditView> {
  const response = await fetch(`/api/edit/edits/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`the edit answered ${response.status}`);
  return (await response.json()) as EditView;
}

export function EditAnswerView({ id, view, failed }: { id: string; view: EditView | null; failed: boolean }) {
  return (
    <AnswerCard>
      <CardHeader
        left={
          <span className="inline-flex items-center gap-1.5">
            <ScissorsIcon size={15} aria-hidden />
            Edit
          </span>
        }
      />
      <div className="flex gap-3.5 pt-1">
        <VideoThumb src={view?.take.posterUrl ?? null} className="w-[66px]" />
        <div className="min-w-0 flex-1 pt-0.5">
          {view ? (
            <>
              <p data-part="title" className="truncate text-title font-[640] text-foreground">
                {view.title}
              </p>
              <p className="mt-1 text-reading text-foreground-secondary tabular-nums">{`${timecode(lengthOf(view))} · ${lookName(view.look)}`}</p>
              <p className="text-reading text-foreground-secondary">{editedWords(view.updatedAt)}</p>
            </>
          ) : failed ? (
            <p className="text-reading text-foreground-secondary">This edit is not here.</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3.5 md:mt-5">
        <AnswerPrimary icon={<ScissorsIcon size={20} aria-hidden className="shrink-0" />} label="Open editor" href={`/edit/${id}`} trailingArrow />
      </div>
    </AnswerCard>
  );
}

/** An `edit` block in the thread: its edit, read as the page reads it. */
export function EditAnswer({ block }: { block: EditBlock }) {
  const id = block.props.editId;
  const read = useQuery({ queryKey: ["edit", id], queryFn: () => readEdit(id), staleTime: 30_000, retry: false });
  return <EditAnswerView id={id} view={read.data ?? null} failed={read.isError} />;
}
```

`src/components/thread-next/thread-turn-next.tsx`: after line 73 (`import { VideoAnswer } from "./video-answer";`) add `import { EditAnswer } from "./edit-answer";`. In `originalIndexOf` (lines 274-276) the arm becomes `case "script": case "video": case "edit": return part.item.index;`. In `PartView` after `case "video": return <VideoAnswer block={part.item.block} />;` add:

```tsx
    case "edit":
      return <EditAnswer block={part.item.block} />;
```

and line 366 becomes:

```tsx
  // An edit's card is the whole answer: the next step is in the editor, not in the chat (plan 2026-11-24-editor-screens-a).
  const chips = showFollowups && !runLive && waiting === null && !simulating && !parts.some((part) => part.kind === "edit");
```

`src/lib/library/chat-summary.ts`: line 29 becomes `export type PieceKind = "video" | "script" | "remix" | "hooks" | "ideas" | "text" | "chat" | "edit";`. In `chatSummaryOf`, before `const last = pieces[pieces.length - 1];` (line 193) add:

```ts
  // An edit's card (plan 2026-11-24-editor-screens-a): one a chat, counted nowhere; it leads a chat that holds nothing else.
  const edited = Array.isArray(bodies) && bodies.some((body) => partsOf(blocksOf(body)).some((part) => part.kind === "edit"));
```

and the two lines of the returned object become:

```ts
    lead: sim?.kind ?? last?.kind ?? (edited ? "edit" : "chat"),
    stage: sim ? "simulated" : last || edited ? "draft" : "chat",
```

`src/lib/library/piece-words.ts`, before `case "chat":` add:

```ts
    case "edit":
      return "Edit";
```

`src/lib/posted/posted.ts` line 41 (its `KINDS` at line 43 is checked against it, so a new `PieceKind` must be named here): an edit is not a piece that "After posting" follows in slice A (its numbers come with "Check it", piece 3), so it is left out as a plain chat is:

```ts
/** What a posted piece can be: the Library's piece kinds, without a plain chat or an edit (an edit's post is piece 3's). */
export type PostedPieceKind = Exclude<PieceKind, "chat" | "edit">;
```

`src/components/library-next/row-line.ts`, in `FALLBACK_TITLE` after `chat: "Chat",` add `edit: "Edit",`.

`src/components/library-next/chat-row.tsx`: line 7 becomes `import { BulbIcon, DocIcon, LoopIcon, PenIcon, ScissorsIcon } from "@/components/thread-next/field-icons";`; in `MARK` after `chat: ChatIcon,` add `edit: ScissorsIcon,`.

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/tools/__tests__/ src/lib/thread-next/__tests__/ src/lib/library/__tests__/ src/components/thread-next/__tests__/ src/components/library-next/__tests__/ src/components/thread/__tests__/` (the registry, chat-reachability and Library suites included), then `pnpm exec tsc --noEmit` and `pnpm exec eslint src/lib/edit/edit-view.ts src/components/thread-next/edit-answer.tsx src/components/thread/edit-block.tsx`.

- [ ] Step 5: Commit: `git add src/lib/edit/edit-view.ts src/lib/tools/profile-blocks.ts src/lib/tools/block-registry.ts src/lib/tools/on-screen.ts src/lib/thread-next/answer-parts.ts src/components/thread-next/thread-turn-next.tsx src/components/thread/message-blocks.tsx src/components/thread/edit-block.tsx src/components/thread-next/edit-answer.tsx src/components/thread-next/field-icons.tsx src/lib/library/chat-summary.ts src/lib/library/piece-words.ts src/lib/posted/posted.ts src/components/library-next/row-line.ts src/components/library-next/chat-row.tsx src/components/editor/__tests__/views.ts src/lib/thread-next/__tests__/answer-parts.test.ts src/lib/tools/__tests__/edit-block.test.ts src/lib/thread-next/__tests__/answer-parts-edit.test.ts src/lib/library/__tests__/chat-summary-edit.test.ts src/components/thread-next/__tests__/edit-answer.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(edit): the edit block, its card in the chat, and Library's kind edit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 5: The agent's calls, a take's state and a render, shared by the routes

**Files:**
- Create: `src/app/api/edit/agent-calls.ts`, `src/app/api/edit/take-now.ts`, `src/app/api/edit/render.ts`
- Modify: `src/app/api/edit/agent/route.ts:29-228` (keeps its header comment, `maxDuration`, the two body schemas, `askedOf`, `POST`, `changing`, `cutting`, `answered`; moves the rest), `src/app/api/edit/takes/[id]/route.ts:12-46`, `src/app/api/edit/renders/route.ts:15-54`
- Test: `src/app/api/edit/__tests__/agent-calls.test.ts`; regression: the unchanged `agent-route.test.ts`, `routes.test.ts`, `references.test.ts`

**Interfaces:** Consumes (existing, `src/app/api/edit/agent/route.ts` at `7a5af9e6`): `firstCut(input: FirstCutInput, deps): Promise<FirstCutResult>`, `change(input: AgentInput, deps): Promise<AgentResult>`, `AGENT_LIMITS`, `agentDeps`, `styleOfWords(words, ask): Promise<{ style: StyleProfile; say: string }>`, `presetOf`, `StyleProfileSchema`, `HOUSE_STYLE`, `referencesAmong(session, user, takes)`, `takeState`, `assetOf`, `refusedFiles`, `MAX_TAKE_MS`, `analysisOf`, `bucket`, `latestJob(session, service, user, take, now)`, `liveJob`, `startJob`, `isId`, `coverFrame`, `creator`, `ownTake`, `refuse`, `log`, `type Creator`. Produces:
- `agent-calls.ts`: `MOST`, `SAID` (moved unchanged), `type Styled = { from: "house" } | { from: "profile"; profile: StyleProfile } | { from: "words"; words: string }`, `isObject(value: unknown): value is Record<string, unknown>`, `styleOf(given: unknown): Styled | Response`, `lookKeyOf(given: unknown, styled: Styled): string`, `readyTakes(who: Creator, ids: readonly string[]): Promise<TakeRow[] | Response>`, `changeEdit(who: Creator, takes: readonly TakeRow[], edit: Edit, request: string, begun: number): Promise<AgentResult | Response>`, `interface Cut { result: FirstCutResult; style: StyleProfile; styleSay: string | null; cost: number; source: string }`, `cutTake(who: Creator, take: TakeRow, styled: Styled, begun: number): Promise<Cut | Response>`.
- `take-now.ts`: `takeNow(who: Creator, take: TakeRow, service?: SupabaseClient<Database>, now?: number): Promise<{ state: TakeState; job: JobRow | null }>`.
- `render.ts`: `startRender(who: Creator, edit: Edit): Promise<JobRow | Response>`.

- [ ] Step 1: Write the failing test `src/app/api/edit/__tests__/agent-calls.test.ts`:

```ts
/**
 * agent-calls.test.ts — the style a first cut is asked in, read as the agent's route reads it, and the look key an edit keeps
 * of it (plan 2026-11-24-editor-screens-a, Task 5). The calls themselves are proved through the routes that make them: the
 * agent's route (`agent-route.test.ts`, unchanged) and the editor's turns (Task 7).
 */
import { describe, expect, it } from "vitest";
import { presetOf } from "@/lib/edit/style/presets";
import { lookKeyOf, styleOf } from "../agent-calls";

const read = async (given: unknown) => {
  const styled = styleOf(given);
  return styled instanceof Response ? { status: styled.status, ...(await styled.json()) } : styled;
};

describe("styleOf", () => {
  it("reads none as the house style, a preset by its id, words, and a profile as it is", async () => {
    expect(await read(undefined)).toEqual({ from: "house" });
    expect(await read(null)).toEqual({ from: "house" });
    expect(await read({ preset: "clean" })).toEqual({ from: "profile", profile: presetOf("clean")!.profile });
    expect(await read({ words: "  calm, small type  " })).toEqual({ from: "words", words: "calm, small type" });
    expect(await read(presetOf("mono")!.profile)).toEqual({ from: "profile", profile: presetOf("mono")!.profile });
  });

  it("refuses an unknown preset, blank or long words, and what is no profile, in the route's words", async () => {
    expect(await read({ preset: "nope" })).toEqual({ status: 400, error: "There is no preset of that name." });
    expect(await read({ words: "  " })).toEqual({ status: 400, error: "Say in a few words what style you want." });
    expect(await read({ words: "x".repeat(301) })).toEqual({ status: 400, error: "A style in words is at most 300 characters." });
    expect(await read({ look: "warm" })).toEqual({ status: 400, error: "This style could not be read." });
  });
});

describe("lookKeyOf", () => {
  it("keeps the look an edit was cut in: house, a preset's id, words, or a video's style", () => {
    expect(lookKeyOf(undefined, { from: "house" })).toBe("house");
    expect(lookKeyOf({ preset: "clean" }, { from: "profile", profile: presetOf("clean")!.profile })).toBe("clean");
    expect(lookKeyOf({ words: "calm" }, { from: "words", words: "calm" })).toBe("words");
    const video = { ...presetOf("clean")!.profile, source: { kind: "reference" as const, name: null } };
    expect(lookKeyOf(video, { from: "profile", profile: video })).toBe("video");
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/agent-calls.test.ts` → `Failed to resolve import "../agent-calls"`.

- [ ] Step 3: Implement.

`src/app/api/edit/agent-calls.ts` (the moved code is byte-for-byte the agent route's at `7a5af9e6`, lines 48-126 and 146-215, with `changing`'s and `cutting`'s agent calls lifted out of their answers):

```ts
/**
 * agent-calls.ts — the agent's two calls as the edit routes make them (plan 2026-11-24-editor-screens-a, Task 5): read from
 * `POST /api/edit/agent` so that route and the editor's turns (`/api/edit/edits/[id]/cut`, `…/change`) run the same code.
 * What a first cut's style may be, the takes a call may use (each the creator's, ready, no reference), the change (its files
 * checked against the takes as measured, N5) and the first cut (a style from words read first, its time counted in the
 * first cut's). Each refusal is the route's own `{error}`, one plain sentence.
 *
 * Server only.
 */
import "server-only";
import { analysisOf, type Analyses, type Edit } from "@/lib/edit";
import { agentDeps } from "@/lib/edit/agent/deps";
import { firstCut, type FirstCutResult } from "@/lib/edit/agent/first-cut";
import { AGENT_LIMITS, change, type AgentResult } from "@/lib/edit/agent/loop";
import type { Ask } from "@/lib/edit/agent/model";
import { QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { calculateCost } from "@/lib/engine/qwen/cost";
import { HOUSE_STYLE } from "@/lib/edit/style/house";
import { presetOf } from "@/lib/edit/style/presets";
import { referencesAmong } from "@/lib/edit/style/reference";
import { StyleProfileSchema, type StyleProfile } from "@/lib/edit/style/profile";
import { styleOfWords } from "@/lib/edit/style/words";
import { bucket } from "@/lib/edit/worker/r2";
import { MAX_TAKE_MS, assetOf, refusedFiles, takeState, type TakeRow } from "@/lib/edit/worker/takes";
import { log, ownTake, refuse, type Creator } from "./creator";

/** The longest request, style in words and list of takes. */
export const MOST = { request: 500, words: 300, takes: 20 } as const;

export const SAID = {
  unread: "The editor could not read this call.",
  edit: "This edit could not be read.",
  apart: "This edit does not hold together.",
  blank: "Say what to change.",
  long: `A request is at most ${MOST.request} characters.`,
  noPreset: "There is no preset of that name.",
  noWords: "Say in a few words what style you want.",
  longWords: `A style in words is at most ${MOST.words} characters.`,
  style: "This style could not be read.",
  busy: "The editor is already working on a call of yours; try again when it is done.",
  measured: "A video in this edit is not one of your takes as it was measured. Start again from the take.",
  words: "The style could not be read from those words. Try other words or pick a preset.",
} as const;
/** A take that is not ready, by what it is. */
const NOT_READY: Record<string, string> = {
  uploading: "That take has not finished uploading.",
  analysing: "That take is still being analysed; try again when it is ready.",
  failed: "That take could not be analysed; upload it again.",
};
/** A take the worker measured at over ten minutes (X56): failed for its length, which another upload does not change. */
const TOO_LONG = `That take is longer than ${MAX_TAKE_MS / 60_000} minutes; use a shorter take.`;
const isTooLong = (take: TakeRow): boolean => {
  const ms = (take.facts as { ms?: unknown } | null)?.ms;
  return typeof ms === "number" && ms > MAX_TAKE_MS;
};

/** The style a first cut is asked in: the house's, a profile (a preset's or one handed in), or one to read from words. */
export type Styled = { from: "house" } | { from: "profile"; profile: StyleProfile } | { from: "words"; words: string };

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const only = (value: Record<string, unknown>, key: string) => Object.keys(value).length === 1 && key in value;

/** A first cut's style: none (or null), `{preset}`, `{words}` or a profile, which `StyleProfileSchema` checks. */
export function styleOf(given: unknown): Styled | Response {
  if (given === undefined || given === null) return { from: "house" };
  if (isObject(given) && only(given, "preset")) {
    const preset = typeof given.preset === "string" ? presetOf(given.preset) : undefined;
    return preset ? { from: "profile", profile: preset.profile } : refuse(400, SAID.noPreset);
  }
  if (isObject(given) && only(given, "words")) {
    if (typeof given.words !== "string") return refuse(400, SAID.style);
    const words = given.words.trim();
    if (words === "") return refuse(400, SAID.noWords);
    return words.length > MOST.words ? refuse(400, SAID.longWords) : { from: "words", words };
  }
  const profile = StyleProfileSchema.safeParse(given);
  return profile.success ? { from: "profile", profile: profile.data } : refuse(400, SAID.style);
}

/** The look an edit keeps of a first cut's style (`edits.look`, a cut turn's `request`): `house`, a preset's id, `words`, `video`. */
export function lookKeyOf(given: unknown, styled: Styled): string {
  if (styled.from === "house") return "house";
  if (styled.from === "words") return "words";
  if (isObject(given) && typeof given.preset === "string" && presetOf(given.preset)) return given.preset;
  return "video";
}

/**
 * The creator's takes of these ids, each ready; or the refusal: 404 for one that is not theirs or is a reference (another's video
 * read for its style is no take of the creator's, `referencesAmong`), 409 for one not ready.
 */
export async function readyTakes(who: Creator, ids: readonly string[]): Promise<TakeRow[] | Response> {
  const takes: TakeRow[] = [];
  for (const take of await Promise.all([...new Set(ids)].map((id) => ownTake(who, id)))) {
    if (take instanceof Response) return take;
    takes.push(take);
  }
  const references = await referencesAmong(who.session, who.user, takes);
  if (takes.some((take) => references.has(take.id))) return refuse(404, "no such take");
  for (const take of takes) {
    const { status } = takeState(take); // its jobs not looked up: an analysing take reads as analysing
    if (status !== "ready") return refuse(409, isTooLong(take) ? TOO_LONG : (NOT_READY[status] ?? "That take is not ready."));
  }
  return takes;
}

/** A change to the creator's edit, on these takes: 422 for an edit whose files are not the takes as measured. */
export async function changeEdit(who: Creator, takes: readonly TakeRow[], edit: Edit, request: string, begun: number): Promise<AgentResult | Response> {
  const refused = refusedFiles(edit, takes, bucket());
  if (refused.length > 0) {
    log.warn("an edit's files are not the creator's takes as measured", { problems: refused.map((problem) => problem.message) });
    return refuse(422, SAID.measured);
  }
  const analyses: Analyses = Object.fromEntries(takes.map((take) => [take.id, analysisOf(take)]));
  const library = takes.map((take) => assetOf(take, bucket()));
  return change(
    { edit, analyses, request, library, user: who.user, deadlineMs: begun + AGENT_LIMITS.changeMs },
    { ask: agentDeps.ask, stills: agentDeps.stills },
  );
}

/** A first cut, with the style it used (the house's with none), what was said of a style from words, its whole cost, its source. */
export interface Cut {
  result: FirstCutResult;
  style: StyleProfile;
  styleSay: string | null;
  /** In cents: the words' calls and the cut's. */
  cost: number;
  /** For the log: the style's source kind, or `house`. */
  source: string;
}

/** A first cut of the creator's take, in the style asked: 502 when no style could be read from the words. */
export async function cutTake(who: Creator, take: TakeRow, styled: Styled, begun: number): Promise<Cut | Response> {
  let style = styled.from === "profile" ? styled.profile : undefined;
  let styleSay: string | null = null;
  const spent = { cost: 0 };
  if (styled.from === "words") {
    try {
      const read = await styleOfWords(styled.words, costed(agentDeps.ask, spent));
      style = read.style;
      styleSay = read.say;
    } catch (error) {
      log.warn("no style could be read from a creator's words", { error: error instanceof Error ? error.message : String(error), cost: spent.cost, ms: Date.now() - begun });
      return refuse(502, SAID.words);
    }
  }
  const result = await firstCut(
    { asset: assetOf(take, bucket()), analysis: analysisOf(take), user: who.user, deadlineMs: begun + AGENT_LIMITS.firstCutMs, style },
    { ask: agentDeps.ask, stills: agentDeps.stills },
  );
  return { result, style: style ?? HOUSE_STYLE, styleSay, cost: spent.cost + result.cost, source: style?.source.kind ?? "house" };
}

/** `ask`, with what each call costs added to `spent`, in cents, as the loop prices its own. */
function costed(ask: Ask, spent: { cost: number }): Ask {
  return async (messages, options) => {
    const answer = await ask(messages, options);
    spent.cost += calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: answer.usage.input, completion_tokens: answer.usage.output });
    return answer;
  };
}
```

`src/app/api/edit/agent/route.ts`: keep lines 1-28 (the header comment) and replace lines 29-228 with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { EditSchema, checkEdit, type Edit } from "@/lib/edit";
import type { AgentResult } from "@/lib/edit/agent/loop";
import { csrfGuard } from "@/lib/http/csrf-guard";
import type { StyleProfile } from "@/lib/edit/style/profile";
import { MOST, SAID, changeEdit, cutTake, isObject, readyTakes, styleOf, type Styled } from "../agent-calls";
import { creator, holdAgent, log, refuse, route, type Creator } from "../creator";

/** A first cut stops at 170 s (X89), its words' style read included; a change at 50 s. */
export const maxDuration = 180;

const Id = z.string().max(64);
const ChangeBody = z.strictObject({ takes: z.array(Id).min(1).max(MOST.takes), edit: z.unknown(), request: z.string() });
const FirstCutBody = z.strictObject({ takes: z.tuple([Id]), firstCut: z.literal(true), style: z.unknown().optional() });

type Asked = { kind: "change"; takes: string[]; edit: Edit; request: string } | { kind: "first cut"; take: string; style: Styled };

/** The call asked, read and checked without the database: the refusal to give, or what to do. */
function askedOf(body: unknown): Asked | Response {
  if (isObject(body) && "firstCut" in body) {
    const asked = FirstCutBody.safeParse(body);
    if (!asked.success) return refuse(400, SAID.unread);
    const style = styleOf(asked.data.style);
    return style instanceof Response ? style : { kind: "first cut", take: asked.data.takes[0], style };
  }
  const asked = ChangeBody.safeParse(body);
  if (!asked.success) return refuse(400, SAID.unread);
  const edit = EditSchema.safeParse(asked.data.edit);
  if (!edit.success) return refuse(400, SAID.edit);
  if (checkEdit(edit.data).length > 0) return refuse(400, SAID.apart);
  const request = asked.data.request.trim();
  if (request === "") return refuse(400, SAID.blank);
  if (request.length > MOST.request) return refuse(400, SAID.long);
  return { kind: "change", takes: asked.data.takes, edit: edit.data, request };
}

export const POST = route("POST /api/edit/agent", async (request: Request) => {
  const begun = Date.now();
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const asked = askedOf(await request.json().catch(() => undefined));
  if (asked instanceof Response) return asked;

  const release = holdAgent(who.user);
  if (!release) return refuse(409, SAID.busy);
  try {
    return asked.kind === "change" ? await changing(who, asked, begun) : await cutting(who, asked, begun);
  } finally {
    release();
  }
});

/** A change to the creator's edit. */
async function changing(who: Creator, asked: Extract<Asked, { kind: "change" }>, begun: number): Promise<Response> {
  const takes = await readyTakes(who, asked.takes);
  if (takes instanceof Response) return takes;
  const result = await changeEdit(who, takes, asked.edit, asked.request, begun);
  if (result instanceof Response) return result;
  return answered("change", result, begun, { cost: result.cost, match: null, style: null, styleSay: null });
}

/** A first cut of the creator's take, in the style asked. */
async function cutting(who: Creator, asked: Extract<Asked, { kind: "first cut" }>, begun: number): Promise<Response> {
  const takes = await readyTakes(who, [asked.take]);
  if (takes instanceof Response) return takes;
  const cut = await cutTake(who, takes[0]!, asked.style, begun);
  if (cut instanceof Response) return cut;
  return answered(`first cut (${cut.source})`, cut.result, begun, { cost: cut.cost, match: cut.result.match, style: cut.style, styleSay: cut.styleSay });
}

/** The 200: the agent's result as the creator's page reads it; logged with its kind, rounds, cost and time, never its words. */
function answered(
  kind: string, result: AgentResult, begun: number,
  more: { cost: number; match: unknown; style: StyleProfile | null; styleSay: string | null },
): Response {
  const ms = Date.now() - begun;
  log.info("an agent call", { kind, rounds: result.rounds.length, changed: result.changed, cost: more.cost, ms });
  return NextResponse.json({
    say: result.say, ops: result.ops, edit: result.edit, findings: result.findings, rounds: result.rounds.length, ms, cost: more.cost, changed: result.changed,
    match: more.match, style: more.style, styleSay: more.styleSay,
  });
}
```

`src/app/api/edit/take-now.ts`:

```ts
/**
 * take-now.ts — a take as it stands (plan 2026-11-24-editor-screens-a, Task 5; moved from `GET /api/edit/takes/[id]`): while it
 * is analysing its latest job decides its state (a failed or stopped one fails it, and so does having none two minutes on), and
 * its row is written so, filtered on the creator and only if it is still as it was read. Gives the state and that job.
 *
 * Server only.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { latestJob, type JobRow } from "@/lib/edit/worker/jobs";
import { takeState, type TakeRow, type TakeState } from "@/lib/edit/worker/takes";
import type { Database } from "@/types/database.types";
import type { Creator } from "./creator";

export async function takeNow(who: Creator, take: TakeRow, service: SupabaseClient<Database> = createServiceClient(), now = Date.now()): Promise<{ state: TakeState; job: JobRow | null }> {
  const latest = take.status === "analysing" ? await latestJob(who.session, service, who.user, take.id, now) : null;
  const state = takeState(take, latest, now);
  if (state.status !== take.status) {
    const { error } = await service
      .from("edit_takes")
      .update({ status: state.status, error: state.error })
      .eq("id", take.id)
      .eq("user_id", who.user)
      .eq("status", take.status)
      .lte("updated_at", take.updated_at); // untouched since it was read
    if (error) throw new Error(`the take could not be written ${state.status}: ${error.message}`);
  }
  return { state, job: latest };
}
```

`src/app/api/edit/takes/[id]/route.ts`: line 13 (`import { createServiceClient } …`) and line 15 (`import { latestJob } …`) go; line 17 becomes `import { assetOf, copiesOf, takeView } from "@/lib/edit/worker/takes";`; add `import { takeNow } from "../../take-now";`; lines 29-42 become:

```ts
  const { state } = await takeNow(who, take);
```

`src/app/api/edit/render.ts`:

```ts
/**
 * render.ts — a render of an edit started on the worker (plan 2026-11-24-editor-screens-a, Task 5; moved from
 * `POST /api/edit/renders`): every file of the edit a kit file or a ready take of this creator's as the worker measured it,
 * no reference among them, no other render of theirs live (A1); then the job, with its cover frame (X63). Gives the job as
 * written (failed when the worker could not start it), or the refusal: 404 {error, problems} for a reference, 400 {error,
 * problems} for a file not theirs to render, 409 while another render of theirs is live.
 *
 * Server only.
 */
import "server-only";
import { coverFrame, type Edit } from "@/lib/edit";
import { createServiceClient } from "@/lib/supabase/service";
import { referencesAmong } from "@/lib/edit/style/reference";
import { isId, liveJob, startJob, type JobRow } from "@/lib/edit/worker/jobs";
import { bucket } from "@/lib/edit/worker/r2";
import { refusedFiles } from "@/lib/edit/worker/takes";
import { refuse, type Creator } from "./creator";

export async function startRender(who: Creator, edit: Edit): Promise<JobRow | Response> {
  // Only an id that can be a row's is asked for; any other is no take of anyone's.
  const ids = edit.assets.filter((asset) => !("kit" in asset.at) && isId(asset.id)).map((asset) => asset.id);
  const { data: takes, error } = ids.length > 0 ? await who.session.from("edit_takes").select("*").in("id", ids).eq("user_id", who.user) : { data: [], error: null };
  if (error) throw new Error(`the edit's takes could not be read: ${error.message}`);
  const references = await referencesAmong(who.session, who.user, takes);
  if (references.size > 0) {
    const problems = edit.assets.flatMap((asset, i) => (references.has(asset.id) ? [{ path: `assets.${i}`, id: asset.id, message: `the file "${asset.id}" is not one of your takes` }] : []));
    return refuse(404, "no such take", { problems });
  }
  const refused = refusedFiles(edit, takes, bucket());
  if (refused.length > 0) return refuse(400, "a file of the edit is not yours to render", { problems: refused });
  if (await liveJob(who.session, who.user, "render")) return refuse(409, "a render of yours is already running; try again when it ends");
  return startJob(createServiceClient(), { user: who.user, kind: "render", input: { edit, cover: coverFrame(edit) } });
}
```

`src/app/api/edit/renders/route.ts`: lines 15-22 (imports) become:

```ts
import { EditSchema, checkEdit } from "@/lib/edit";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { creator, refuse, route, started } from "../creator";
import { startRender } from "../render";
```

and lines 41-54 become:

```ts
  const job = await startRender(who, edit);
  return job instanceof Response ? job : started(job);
```

- [ ] Step 4: Run, expect PASS — the new test and, unchanged, every edit route suite: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/ && pnpm exec tsc --noEmit && pnpm exec eslint src/app/api/edit/`.

- [ ] Step 5: Commit: `git add src/app/api/edit/agent-calls.ts src/app/api/edit/take-now.ts src/app/api/edit/render.ts src/app/api/edit/agent/route.ts src/app/api/edit/takes/[id]/route.ts src/app/api/edit/renders/route.ts src/app/api/edit/__tests__/agent-calls.test.ts && git -c core.hooksPath=/dev/null commit -m "refactor(edit): the agent's calls, a take's state and a render, shared by the routes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 6: An edit's rows, and the routes that make it, read it and give it another take

**Files:**
- Create: `src/app/api/edit/edits/store.ts`, `src/app/api/edit/open/route.ts`, `src/app/api/edit/edits/route.ts`, `src/app/api/edit/edits/[id]/route.ts`, `src/app/api/edit/edits/[id]/take/route.ts`, `src/app/api/edit/__tests__/edit-world.ts`
- Test: `src/app/api/edit/__tests__/edits.test.ts`

**Interfaces:** Consumes: `creator()`, `ownTake(who, id)`, `refuse()`, `route()`, `type Creator` (`creator.ts`); `takeNow` (Task 5); `isId`, `readJob(session, service, user, id)` (`worker/jobs.ts`); `signGet(key, download?)`, `folderOf`, `isUnder`, `bucket` (`worker/r2.ts`); `assetOf`, `copiesOf`, `type TakeRow` (`worker/takes.ts`); `referencesAmong` (`style/reference.ts`); `createNewThread(userId)`, `setThreadTitleIfEmpty` (`src/lib/threads/threads.ts`); `insertMessage(threadId, role, blocks)` (`src/lib/threads/messages.ts`); `takeTitle` (Task 3); `shownTurn`, `undoTarget`, `redoTarget`, `spokenTurns`, `nextTurn`, `type TurnKind`, `type TurnMark` (Task 2); `EditView`, `TakeShown`, `ExportShown`, `LIVE_JOB` (Task 4). Produces (`store.ts`):
- `type EditRow = Database["public"]["Tables"]["edits"]["Row"]`
- `EDIT_SAID = { notHere, hasCut, noCut, exporting, changed, full, direct, notMade, noVersion }` (strings)
- `ownEdit(who: Creator, id: string): Promise<EditRow | Response>`
- `interface TurnLine extends TurnMark { request: string | null; at: number | null; say: string; findings: Finding[] }`; `turnsOf(service: Db, edit: string): Promise<TurnLine[]>`
- `docOf(service: Db, edit: string, n: number): Promise<Edit>`
- `interface TurnWritten { kind: TurnKind; request: string | null; at: number | null; say: string; findings: readonly Finding[]; doc: Edit | null }`; `commitTurn(service: Db, edit: EditRow, turns: readonly TurnMark[], turn: TurnWritten, more?: { look?: string | null; style?: Json | null; title?: string }): Promise<EditRow | "conflict" | "full">`
- `exportLive(who: Creator, service: Db, edit: EditRow): Promise<boolean>`
- `viewOf(who: Creator, edit: EditRow, service: Db): Promise<EditView>`
- Routes: `GET /api/edit/open` → `{open: boolean}`; `POST /api/edit/edits {take}` → `201 {id, threadId}`; `GET /api/edit/edits/[id]` → `EditView`; `POST /api/edit/edits/[id]/take {take}` → `EditView`.
- Test helper (`edit-world.ts`): `wireEditWorld(): EditWorld` (`world`, `signedIn`, `errorsLogged()`, `boundaries(script?)`), `readyTake(over?)`, `TAKE_ASSET`, `TAKE_FIRST`, `through(edit, ops)`, `seedEdit(world, options)`, `cutOf(style?)`, `changeOf(edit, request, script?)`, `chose()`, `answer(say, ops)`, `NO_CHANGE`, `BIGGER`, `qwen()`, `drawer()`, `post`, `get`, `del`, `by`.

- [ ] Step 1: Write the test helper and the failing test.

`src/app/api/edit/__tests__/edit-world.ts`:

```ts
/**
 * edit-world.ts — what the editor's route suites share (plan 2026-11-24-editor-screens-a, Tasks 6 to 8): the stand-ins wired as
 * `routes.test.ts` and `agent-route.test.ts` wire them (Supabase's REST API with the tables' grants, the bucket, the worker),
 * the agent's two boundaries replaced where the routes read them (`agentDeps`), the made-up take of `agent-route.test.ts`
 * (8 s, 720x1280, twelve words, five pauses, a face in the middle; repeated here because a test file cannot be imported), an
 * edit seeded with turns, the first cut and a change made with no route (what a route is to answer), and requests.
 *
 * Each suite still declares the two module mocks itself (`vi.mock` is hoisted per file):
 *   vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
 *   vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
 */
import { afterEach, beforeEach, expect, vi, type MockInstance } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { analysisOf, applyOps, type Edit, type FaceSample, type Op, type TakeAnalysis } from "@/lib/edit";
import { agentDeps } from "@/lib/edit/agent/deps";
import { firstCut } from "@/lib/edit/agent/first-cut";
import { AGENT_LIMITS, change } from "@/lib/edit/agent/loop";
import type { Ask, Message } from "@/lib/edit/agent/model";
import { systemPrompt } from "@/lib/edit/agent/prompt";
import type { StyleProfile } from "@/lib/edit/style/profile";
import { wordsPrompt } from "@/lib/edit/style/words";
import type { TurnKind } from "@/lib/edit/turns";
import type { stillsOf } from "@/lib/edit/worker/stills";
import { assetOf, firstEdit, type TakeRow } from "@/lib/edit/worker/takes";
import { TAKE, USER, keyOf, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET, ENV, standIns } from "@/lib/edit/worker/__tests__/stand-ins";

/* ── the made-up take ── */

const MS = 8000;
const WORDS = [
  { text: "Stop", startMs: 300, endMs: 600 },
  { text: "scrolling", startMs: 620, endMs: 1000 },
  { text: "this", startMs: 1500, endMs: 1800 },
  { text: "changes", startMs: 1820, endMs: 2300 },
  { text: "everything", startMs: 2320, endMs: 2900 },
  { text: "you", startMs: 3400, endMs: 3700 },
  { text: "know", startMs: 3720, endMs: 4100 },
  { text: "about", startMs: 4120, endMs: 4600 },
  { text: "editing", startMs: 5100, endMs: 5700 },
  { text: "your", startMs: 5720, endMs: 6000 },
  { text: "videos", startMs: 6020, endMs: 6600 },
  { text: "today", startMs: 6620, endMs: 7500 },
];
const PAUSES = [
  { startMs: 0, endMs: 300, cutMs: 150 },
  { startMs: 1000, endMs: 1500, cutMs: 1250 },
  { startMs: 2900, endMs: 3400, cutMs: 3150 },
  { startMs: 4600, endMs: 5100, cutMs: 4850 },
  { startMs: 7500, endMs: 8000, cutMs: 7750 },
];
const FACES: FaceSample[] = Array.from({ length: MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }, mouth: { x: 0.42, y: 0.43, w: 0.16, h: 0.024 } }));
const LOUDNESS: TakeAnalysis["loudness"] = {
  lufs: -24, truePeak: -3,
  levels: Array.from({ length: MS / 100 }, (_, i) => ({ ms: i * 100, lufs: PAUSES.some((pause) => pause.startMs <= i * 100 && i * 100 < pause.endMs) ? -70 : -24 })),
};
const probe = (w: number, h: number) => ({ videoMs: MS, audioMs: MS, ms: MS, w, h, fps: 30, codec: "h264", hdr: false, sound: true, rotation: 0 });

/** The take's row as the worker writes it once it is ready; the creator's unless told. */
export function readyTake(over: Partial<TakeRow> = {}): TakeRow {
  const id = over.id ?? TAKE;
  const user = over.user_id ?? USER;
  return takeRow({
    name: "IMG_0042.MOV",
    facts: { source: probe(720, 1280), full: probe(720, 1280), preview: probe(540, 960), ms: MS },
    words: WORDS,
    analysis: {
      files: { full: keyOf("full.mp4", id, user), preview: keyOf("preview.mp4", id, user), poster: keyOf("poster.jpg", id, user) },
      untimed: 0, apart: 0, gaveWay: 0, language: "en", pauses: PAUSES, faces: FACES, loudness: LOUDNESS,
    } as TakeRow["analysis"],
    ...over,
  });
}
export const TAKE_ASSET = assetOf(readyTake(), BUCKET);
export const TAKE_FIRST = firstEdit(TAKE_ASSET);
export function through(edit: Edit, ops: Op[]): Edit {
  const made = applyOps(edit, ops, [TAKE_ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
}

/* ── the agent's two boundaries ── */

type Role = "cut" | "words" | "change";
function roleOf(messages: Message[]): Role {
  const system = messages[0]?.content;
  if (system === wordsPrompt()) return "words";
  if (system === systemPrompt()) return "change";
  if (typeof system === "string" && system.startsWith("You make the first cut")) return "cut";
  throw new Error("asked with none of the agent's prompts");
}
/** One canned answer: its text, and optionally a gate it waits on and a call told it has been asked; or an Error. */
export type Canned = string | { text: string; gate?: Promise<void>; asked?: () => void } | Error;
const USAGE = { input: 3000, output: 80 };

export const chose = (over: Record<string, unknown> = {}): string => JSON.stringify({ title: "Edit *smarter*", short: "*Smarter*", stress: [1, 4], look: "vivid", pauseMs: 200, ...over });
export const answer = (say: string, ops: unknown[]): string => JSON.stringify({ say, ops });
export const NO_CHANGE = answer("I left the video as it is.", []);
export const BIGGER: Op[] = [{ op: "captions.set", size: 110 }];

/** Qwen, as canned answers by role: a first cut's choices default to `chose()`, a change's to no ops. */
export function qwen(script: Partial<Record<Role, Canned[]>> = {}) {
  const calls: Role[] = [];
  const ask: Ask = async (messages) => {
    const role = roleOf(messages);
    calls.push(role);
    const next = script[role]?.shift() ?? (role === "cut" ? chose() : role === "change" ? NO_CHANGE : new Error("the script has no answer of words left"));
    if (next instanceof Error) throw next;
    const canned = typeof next === "string" ? { text: next } : next;
    canned.asked?.();
    if (canned.gate) await canned.gate;
    return { text: canned.text, usage: USAGE, ms: 400 };
  };
  return { ask, calls };
}

/** The worker's stills: each frame as a stand-in JPEG. */
export function drawer() {
  const calls: number[][] = [];
  const stills: typeof stillsOf = async (_user, _edit, frames) => {
    calls.push([...frames]);
    return frames.map((frame) => ({ frame, jpeg: Buffer.from(`jpeg ${frame}`).toString("base64") }));
  };
  return { stills, calls };
}

/** The first cut as the agent makes it on the take, with the same canned answers and no route. */
export function cutOf(style?: StyleProfile) {
  const row = readyTake();
  return firstCut({ asset: assetOf(row, BUCKET), analysis: analysisOf(row), user: USER, deadlineMs: Date.now() + AGENT_LIMITS.firstCutMs, style }, { ask: qwen().ask, stills: drawer().stills });
}
/** A change as the agent makes it on `edit`, with the same canned answers and no route. */
export function changeOf(edit: Edit, request: string, script: Partial<Record<Role, Canned[]>> = {}) {
  const row = readyTake();
  return change({ edit, analyses: { [row.id]: analysisOf(row) }, request, library: [assetOf(row, BUCKET)], user: USER, deadlineMs: Date.now() + AGENT_LIMITS.changeMs }, { ask: qwen(script).ask, stills: drawer().stills });
}

/* ── the world ── */

export interface EditWorld {
  world: ReturnType<typeof standIns>;
  signedIn: { id: string; is_anonymous?: boolean } | null;
  /** What the routes logged as errors, joined; the test has looked at it. */
  errorsLogged(): string;
  /** The agent's two boundaries for this test. */
  boundaries(script?: Partial<Record<Role, Canned[]>>): { model: ReturnType<typeof qwen>; worker: ReturnType<typeof drawer> };
}

/** Wires the world before each test of the suite, and after each one fails it on an error logged that it did not look at. */
export function wireEditWorld(): EditWorld {
  const original = { ...agentDeps };
  let logged: MockInstance<typeof console.error> | null = null;
  let looked = 0;
  const state: EditWorld = {
    world: standIns(),
    signedIn: null,
    errorsLogged: () => {
      looked = logged?.mock.calls.length ?? 0;
      return (logged?.mock.calls ?? []).map((args) => args.join(" ")).join("\n");
    },
    boundaries: (script = {}) => {
      const model = qwen(script);
      const worker = drawer();
      agentDeps.ask = model.ask;
      agentDeps.stills = worker.stills;
      return { model, worker };
    },
  };
  beforeEach(() => {
    state.world = standIns();
    state.signedIn = { id: USER, is_anonymous: false };
    looked = 0;
    vi.stubGlobal("fetch", state.world.fetch);
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    vi.stubEnv("EDIT_CREATORS", USER);
    vi.mocked(createClient).mockImplementation(async () => state.world.session(state.signedIn) as never);
    vi.mocked(createServiceClient).mockImplementation(() => state.world.service() as never);
    logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    const unlooked = (logged?.mock.calls.length ?? 0) - looked;
    Object.assign(agentDeps, original);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    expect(unlooked, "a route logged an error the test did not look at").toBe(0);
  });
  return state;
}

/** A turn to seed: its kind and its edit (null for `said`); words made up unless given. */
export interface Seeded {
  kind: TurnKind;
  doc: Edit | null;
  request?: string | null;
  say?: string;
}

/**
 * An edit of `take` (the ready take unless told; put once) with its chat and these turns, numbered from 1; its head at the last
 * turn unless told; its look `house` once it has a turn. Gives the edit's and the chat's ids.
 */
export function seedEdit(
  world: ReturnType<typeof standIns>,
  { take = readyTake(), turns = [], head, look, exportJob = null, exportTurn = null }: { take?: TakeRow; turns?: Seeded[]; head?: number | null; look?: string | null; exportJob?: string | null; exportTurn?: number | null } = {},
): { id: string; threadId: string } {
  if (!world.rest.row("edit_takes", take.id)) world.rest.put("edit_takes", take); // one row a take, however many edits are seeded of it
  const thread = world.rest.put("threads", { user_id: take.user_id, type: "open" });
  const edit = world.rest.put("edits", {
    user_id: take.user_id, thread_id: thread.id, take_id: take.id, title: "IMG_0042",
    look: look ?? (turns.length > 0 ? "house" : null), head: head === undefined ? (turns.length > 0 ? turns.length : null) : head,
    export_job: exportJob, export_turn: exportTurn,
  });
  turns.forEach((turn, i) => world.rest.put("edit_turns", { edit_id: edit.id, n: i + 1, kind: turn.kind, request: turn.request ?? null, say: turn.say ?? `turn ${i + 1}`, findings: [], doc: turn.doc }));
  return { id: String(edit.id), threadId: String(thread.id) };
}

/* ── requests ── */

export const post = (path: string, body: unknown = {}, type = "application/json") =>
  new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
export const get = (path: string) => new Request(`http://localhost:3000${path}`);
export const del = (path: string) => new Request(`http://localhost:3000${path}`, { method: "DELETE" });
export const by = (id: string) => ({ params: Promise.resolve({ id }) });
```

`src/app/api/edit/__tests__/edits.test.ts`:

```ts
/**
 * edits.test.ts — the editor's edit (plan 2026-11-24-editor-screens-a, Task 6; spec §6, §7): whether the editor is open to the
 * account, an edit made with its chat and the chat's card, the edit read as the page reads it, another take for an edit with
 * no cut. In process, with the real routes, gate, turns' rules and supabase-js; stand-ins at the network only (`edit-world.ts`).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import type { EditView } from "@/lib/edit/edit-view";
import { STALE_MS } from "@/lib/edit/worker/stale";
import { OTHER, TAKE, USER, keyOf, uploadingTake } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET } from "@/lib/edit/worker/__tests__/stand-ins";
import { GET as open } from "../open/route";
import { POST as make } from "../edits/route";
import { GET as read } from "../edits/[id]/route";
import { POST as retake } from "../edits/[id]/take/route";
import { TAKE_FIRST, by, get, post, readyTake, seedEdit, through, wireEditWorld } from "./edit-world";

const w = wireEditWorld();
const SECOND = "44444444-4444-4444-8444-444444444444";
const viewOf = async (response: Response): Promise<EditView> => {
  expect(response.status).toBe(200);
  return (await response.json()) as EditView;
};
const readEdit = (id: string) => read(get(`/api/edit/edits/${id}`), by(id));
const keyAt = (url: string | null) => (url ? decodeURIComponent(new URL(url).pathname) : null);

describe("GET /api/edit/open", () => {
  it("says the editor is open to a creator on the list and closed to anyone else, naming no one", async () => {
    expect(await (await open()).json()).toEqual({ open: true });
    w.signedIn = { id: OTHER };
    const closed = await open();
    expect(closed.status).toBe(200);
    expect(await closed.json()).toEqual({ open: false });
    w.signedIn = null;
    expect(await (await open()).json()).toEqual({ open: false });
  });
});

describe("POST /api/edit/edits", () => {
  it("makes the edit of a take still uploading, its own chat, and the chat's one card", async () => {
    w.world.rest.put("edit_takes", uploadingTake({ name: "IMG_0042.MOV" }));
    const made = await make(post("/api/edit/edits", { take: TAKE }));
    expect(made.status).toBe(201);
    const { id, threadId } = (await made.json()) as { id: string; threadId: string };
    expect(w.world.rest.row("edits", id)).toMatchObject({ user_id: USER, take_id: TAKE, thread_id: threadId, title: "IMG_0042", head: null, look: null });
    expect(w.world.rest.row("threads", threadId)).toMatchObject({ user_id: USER, type: "open", title: null });
    expect(w.world.rest.tables.messages).toEqual([expect.objectContaining({ thread_id: threadId, role: "assistant", body: [{ type: "edit", props: { editId: id } }] })]);
  });

  it("refuses another creator's take, a reference, and a body that is not {take}", async () => {
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, user_id: OTHER, source_path: keyOf("source", SECOND, OTHER) }));
    expect((await make(post("/api/edit/edits", { take: SECOND }))).status).toBe(404);
    w.world.rest.put("edit_takes", readyTake({ analysis: { ...(readyTake().analysis as object), reference: true } as never }));
    expect((await make(post("/api/edit/edits", { take: TAKE }))).status).toBe(404);
    expect((await make(post("/api/edit/edits", { take: TAKE, more: 1 }))).status).toBe(400);
    expect(w.world.rest.tables.edits).toEqual([]);
  });

  it("asks for a creator the editor is open to, and a call from the app's own page", async () => {
    w.signedIn = { id: OTHER };
    expect((await make(post("/api/edit/edits", { take: TAKE }))).status).toBe(403);
    w.signedIn = { id: USER };
    expect((await make(post("/api/edit/edits", { take: TAKE }, "text/plain"))).status).toBe(415);
  });
});

describe("GET /api/edit/edits/[id]", () => {
  it("reads an edit whose take is still uploading: no addresses, no turn", async () => {
    const { id, threadId } = seedEdit(w.world, { take: uploadingTake() });
    const view = await viewOf(await readEdit(id));
    expect(view).toMatchObject({ id, threadId, title: "IMG_0042", look: null, head: null, shown: null, edit: null, undo: null, redo: null, turns: [], export: null });
    expect(view.take).toMatchObject({ id: TAKE, status: "uploading", previewUrl: null, posterUrl: null, asset: null, ms: null });
  });

  it("reads the edit shown, the turns' words, where Undo and Redo go, and fresh addresses of the ready take", async () => {
    const bigger = through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]);
    const { id } = seedEdit(w.world, {
      turns: [{ kind: "cut", doc: TAKE_FIRST, request: "house" }, { kind: "change", doc: bigger, request: "Bigger captions" }, { kind: "said", doc: null, request: "Make it pop" }],
    });
    const view = await viewOf(await readEdit(id));
    expect(view).toMatchObject({ head: 3, shown: 2, undo: 1, redo: null, export: null });
    expect(view.edit).toEqual(bigger);
    expect(view.turns.map((turn) => [turn.n, turn.kind, turn.request, turn.doc])).toEqual([[1, "cut", "house", true], [2, "change", "Bigger captions", true], [3, "said", "Make it pop", false]]);
    expect(keyAt(view.take.previewUrl)).toBe(`/${BUCKET}/${keyOf("preview.mp4")}`);
    expect(keyAt(view.take.posterUrl)).toBe(`/${BUCKET}/${keyOf("poster.jpg")}`);
    expect(view.take).toMatchObject({ status: "ready", ms: 8000 });
    expect(view.take.asset?.id).toBe(TAKE);
  });

  it("fails a take whose analysis never started, and writes it so, as the take's own route does", async () => {
    const { id } = seedEdit(w.world, { take: uploadingTake({ status: "analysing", updated_at: new Date(Date.now() - STALE_MS - 1000).toISOString() }) });
    const view = await viewOf(await readEdit(id));
    expect(view.take).toMatchObject({ status: "failed", error: "its analysis was never started" });
    expect(w.world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "failed" });
  });

  it("404s an edit that is not the creator's, and an id that is no edit's", async () => {
    const { id } = seedEdit(w.world);
    vi.stubEnv("EDIT_CREATORS", `${USER},${OTHER}`);
    w.signedIn = { id: OTHER };
    expect((await readEdit(id)).status).toBe(404);
    expect((await readEdit("nope")).status).toBe(404);
  });
});

describe("POST /api/edit/edits/[id]/take", () => {
  it("puts another take in an edit with no cut yet", async () => {
    const { id } = seedEdit(w.world, { take: uploadingTake() });
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, name: "second.mov", source_path: keyOf("source", SECOND) }));
    const view = await viewOf(await retake(post(`/api/edit/edits/${id}/take`, { take: SECOND }), by(id)));
    expect(view.take.id).toBe(SECOND);
    expect(w.world.rest.row("edits", id)).toMatchObject({ take_id: SECOND, title: "second" });
  });

  it("refuses once the edit has a cut", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST, request: "house" }] });
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, source_path: keyOf("source", SECOND) }));
    const refused = await retake(post(`/api/edit/edits/${id}/take`, { take: SECOND }), by(id));
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "This edit already has a cut; start a new edit for another video." });
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/edits.test.ts` → `Failed to resolve import "../open/route"` (and the other three routes).

- [ ] Step 3: Implement.

`src/app/api/edit/edits/store.ts`:

```ts
/**
 * store.ts — an edit's rows (plan 2026-11-24-editor-screens-a, Task 6; spec §6): the creator's edit, its turns, the edit a turn
 * holds, a turn written, whether its export runs, and the edit as the page reads it (`EditView`). The edit is read through the
 * creator's session (their rows only); its turns, which carry no creator of their own, are read with the service client once
 * the edit is known to be theirs; every write is the service client's, filtered on the creator. The rules are `turns.ts`'s.
 *
 * Server only.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EditSchema, type Edit } from "@/lib/edit";
import { LIVE_JOB, type EditView, type ExportShown, type TakeShown } from "@/lib/edit/edit-view";
import type { Finding } from "@/lib/edit/review";
import { nextTurn, redoTarget, shownTurn, spokenTurns, undoTarget, type TurnKind, type TurnMark } from "@/lib/edit/turns";
import { isId, readJob, type JobRow } from "@/lib/edit/worker/jobs";
import { bucket, folderOf, isUnder, signGet } from "@/lib/edit/worker/r2";
import { assetOf, copiesOf, type TakeRow, type TakeState } from "@/lib/edit/worker/takes";
import type { Database, Json } from "@/types/database.types";
import { ownTake, refuse, type Creator } from "../creator";
import { takeNow } from "../take-now";

type Db = SupabaseClient<Database>;
export type EditRow = Database["public"]["Tables"]["edits"]["Row"];

/** What the editor's routes say when they refuse, one plain sentence each. */
export const EDIT_SAID = {
  notHere: "no such edit",
  hasCut: "This edit already has a cut; start a new edit for another video.",
  noCut: "There is no cut of this edit yet.",
  exporting: "Your video is being made; the edit holds still until it is done or cancelled.",
  changed: "The edit changed while this was being made. Try again.",
  full: "This edit has 300 changes, the most one edit keeps.",
  direct: "Only a word or the captions can be changed here.",
  notMade: "That change could not be made.",
  noVersion: "There is no such version of this edit.",
} as const;

/** One of the creator's edits, read through their session; the 404 to answer when the id is no edit of theirs. */
export async function ownEdit(who: Creator, id: string): Promise<EditRow | Response> {
  if (!isId(id)) return refuse(404, EDIT_SAID.notHere);
  const { data, error } = await who.session.from("edits").select("*").eq("id", id).eq("user_id", who.user).maybeSingle();
  if (error) throw new Error(`the edit could not be read: ${error.message}`);
  return data ?? refuse(404, EDIT_SAID.notHere);
}

/** A turn as the rules and the page read it: everything but its edit, and whether it holds one. */
export interface TurnLine extends TurnMark {
  request: string | null;
  at: number | null;
  say: string;
  findings: Finding[];
}

interface TurnRead {
  n: number;
  kind: string;
  request: string | null;
  at: number | null;
  say: string;
  findings: Json;
  /** The edit's `v` (1) when the turn holds one, else null: whether it does, without reading the edit. */
  v: Json | null;
}

/** An edit's turns, in order, without their edits. */
export async function turnsOf(service: Db, edit: string): Promise<TurnLine[]> {
  const { data, error } = await service
    .from("edit_turns")
    .select("n,kind,request,at,say,findings,v:doc->v")
    .eq("edit_id", edit)
    .order("n", { ascending: true })
    .returns<TurnRead[]>();
  if (error) throw new Error(`the edit's turns could not be read: ${error.message}`);
  return data.map((row) => ({
    n: row.n,
    kind: row.kind as TurnKind,
    request: row.request,
    at: row.at,
    say: row.say,
    findings: Array.isArray(row.findings) ? (row.findings as unknown as Finding[]) : [],
    doc: row.v !== null,
  }));
}

/** The edit turn `n` holds; throws for a turn that holds none, or one that is no edit. */
export async function docOf(service: Db, edit: string, n: number): Promise<Edit> {
  const { data, error } = await service.from("edit_turns").select("doc").eq("edit_id", edit).eq("n", n).maybeSingle();
  if (error) throw new Error(`the edit's turn could not be read: ${error.message}`);
  const doc = EditSchema.safeParse(data?.doc);
  if (!doc.success) throw new Error(`edit ${edit}: turn ${n} holds no edit`);
  return doc.data;
}

/** A turn to write. */
export interface TurnWritten {
  kind: TurnKind;
  request: string | null;
  at: number | null;
  say: string;
  findings: readonly Finding[];
  doc: Edit | null;
}

/**
 * Writes a turn after the head the edit was read at (`nextTurn`): the turns from there on dropped, the turn inserted (its key
 * `(edit_id, n)` refuses a second one made at once), then the head moved to it, only if it is still where it was read, and the
 * export forgotten. `more` is written with the head (a cut's look, style and title). Gives the edit as written; `conflict` when
 * another turn or a move came first; `full` at the cap.
 */
export async function commitTurn(
  service: Db, edit: EditRow, turns: readonly TurnMark[], turn: TurnWritten,
  more: { look?: string | null; style?: Json | null; title?: string } = {},
): Promise<EditRow | "conflict" | "full"> {
  const next = nextTurn(turns, edit.head);
  if (!next.ok) return "full";
  if (next.drops.length > 0) {
    const { error } = await service.from("edit_turns").delete().eq("edit_id", edit.id).gte("n", next.n);
    if (error) throw new Error(`the turns after the head could not be dropped: ${error.message}`);
  }
  const { error: unwritten } = await service.from("edit_turns").insert({
    edit_id: edit.id, n: next.n, kind: turn.kind, request: turn.request, at: turn.at, say: turn.say,
    findings: turn.findings as unknown as Json, doc: turn.doc as unknown as Json,
  });
  if (unwritten?.code === "23505") return "conflict";
  if (unwritten) throw new Error(`the turn could not be written: ${unwritten.message}`);
  const moving = service.from("edits").update({ head: next.n, export_job: null, export_turn: null, ...more }).eq("id", edit.id).eq("user_id", edit.user_id);
  const { data, error } = await (edit.head === null ? moving.is("head", null) : moving.eq("head", edit.head)).select();
  if (error) throw new Error(`the edit's head could not be moved: ${error.message}`);
  return data[0] ?? "conflict";
}

/** The export job of the edit, as it stands (`readJob` writes a stopped one failed); null when there is none. */
async function exportJobOf(who: Creator, service: Db, edit: EditRow): Promise<JobRow | null> {
  return edit.export_job === null ? null : readJob(who.session, service, who.user, edit.export_job);
}

/** Whether the edit's export is still at work: then no turn is made and the head holds still (E20). */
export async function exportLive(who: Creator, service: Db, edit: EditRow): Promise<boolean> {
  const job = await exportJobOf(who, service, edit);
  return job !== null && LIVE_JOB.has(job.status);
}

/** The take as the page reads it: its state, its analysis's progress, and once ready its facts and fresh addresses. */
async function takeShownOf(who: Creator, take: TakeRow, state: TakeState, job: JobRow | null): Promise<TakeShown> {
  const ready = state.status === "ready";
  const ms = (take.facts as { ms?: unknown } | null)?.ms;
  let previewUrl: string | null = null;
  let posterUrl: string | null = null;
  if (ready) {
    const files = copiesOf(take);
    const folder = folderOf(who.user, { take: take.id });
    if (!isUnder(files.preview, folder) || !isUnder(files.poster, folder)) throw new Error(`take ${take.id}: its copies are kept outside its folder`);
    [previewUrl, posterUrl] = await Promise.all([signGet(files.preview), signGet(files.poster)]);
  }
  return {
    id: take.id, name: take.name, status: state.status, error: state.error,
    stage: job?.stage ?? null, progress: job ? job.progress : null,
    ms: ready && typeof ms === "number" ? ms : null, posterUrl, previewUrl, asset: ready ? assetOf(take, bucket()) : null,
  };
}

/** The export of the turn shown, as it stands, with a fresh address of the film once it is made. */
async function exportShownOf(who: Creator, job: JobRow, turn: number): Promise<ExportShown> {
  const result = job.result as { path?: unknown; ms?: unknown } | null;
  const film = job.status === "done" && typeof result?.path === "string" ? result.path : null;
  if (film !== null && !isUnder(film, folderOf(who.user, "films"))) throw new Error(`job ${job.id}: its film is kept outside the creator's films`);
  return {
    job: job.id, turn, status: job.status, stage: job.stage, progress: job.progress, error: job.error,
    filmUrl: film === null ? null : await signGet(film, "video.mp4"), ms: typeof result?.ms === "number" ? result.ms : null,
  };
}

/** The edit as the page reads it (`EditView`): its take, its turns up to the head, the edit shown, Undo, Redo, the export. */
export async function viewOf(who: Creator, edit: EditRow, service: Db): Promise<EditView> {
  const take = await ownTake(who, edit.take_id);
  if (take instanceof Response) throw new Error(`edit ${edit.id}: its take cannot be read`);
  const [{ state, job }, turns] = await Promise.all([takeNow(who, take, service), turnsOf(service, edit.id)]);
  const shown = shownTurn(turns, edit.head);
  const exported = shown !== null && edit.export_turn === shown ? await exportJobOf(who, service, edit) : null;
  const [takeShown, doc, exportShown] = await Promise.all([
    takeShownOf(who, take, state, job),
    shown === null ? null : docOf(service, edit.id, shown),
    exported === null || shown === null ? null : exportShownOf(who, exported, shown),
  ]);
  return {
    id: edit.id, title: edit.title, threadId: edit.thread_id, look: edit.look, updatedAt: edit.updated_at,
    take: takeShown, head: edit.head, shown, edit: doc,
    undo: undoTarget(turns, edit.head), redo: redoTarget(turns, edit.head),
    turns: spokenTurns(turns, edit.head).map(({ n, kind, request, at, say, findings, doc: holds }) => ({ n, kind, request, at, say, findings, doc: holds })),
    export: exportShown,
  };
}
```

`src/app/api/edit/open/route.ts`:

```ts
/**
 * GET /api/edit/open → 200 {open}
 *
 * Whether the editor is open to the signed-in account (spec E11; plan 2026-11-24-editor-screens-a, Task 6): Home shows the Edit
 * card and the Edit pill only then, so nobody meets a closed door. It answers for the account asking and for no other: the list
 * never leaves the server. Signed out, or not on the list: `{open: false}`. 503 when the sign-in service could not be asked.
 */
import { NextResponse } from "next/server";
import { creator, route } from "../creator";

export const dynamic = "force-dynamic";

export const GET = route("GET /api/edit/open", async () => {
  const who = await creator();
  if (who instanceof Response) return who.status === 401 || who.status === 403 ? NextResponse.json({ open: false }) : who;
  return NextResponse.json({ open: true });
});
```

`src/app/api/edit/edits/route.ts`:

```ts
/**
 * POST /api/edit/edits {take} → 201 {id, threadId}
 *
 * Makes an edit of one of the creator's takes (spec §6, §7; plan 2026-11-24-editor-screens-a, Task 6), which may still be
 * uploading: the edit, a chat of its own, and in that chat one message with one block, `{type: "edit", props: {editId}}`. Its
 * title is the take's file name until the first cut names it from the take's first words.
 *
 * 401/403 as every edit route · 415/403 for a body that is not JSON or a call from another origin · 400 for a body that is not
 * `{take}` · 404 for a take that is not theirs, or is a reference.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { takeTitle } from "@/lib/edit/said";
import { referencesAmong } from "@/lib/edit/style/reference";
import { insertMessage } from "@/lib/threads/messages";
import { createNewThread } from "@/lib/threads/threads";
import { creator, ownTake, refuse, route } from "../creator";

const Body = z.strictObject({ take: z.string().max(64) });

export const POST = route("POST /api/edit/edits", async (request: Request) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, "the body is {take}");
  const take = await ownTake(who, body.data.take);
  if (take instanceof Response) return take;
  if ((await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such take");

  const thread = await createNewThread(who.user);
  const { data: edit, error } = await createServiceClient()
    .from("edits")
    .insert({ user_id: who.user, thread_id: thread.id, take_id: take.id, title: takeTitle(take.name, null) })
    .select()
    .single();
  if (error) throw new Error(`the edit could not be written: ${error.message}`);
  await insertMessage(thread.id, "assistant", [{ type: "edit", props: { editId: edit.id } }]);
  return NextResponse.json({ id: edit.id, threadId: thread.id }, { status: 201 });
});
```

`src/app/api/edit/edits/[id]/route.ts`:

```ts
/**
 * GET /api/edit/edits/[id] → 200 EditView
 *
 * The edit as the page and its card read it (spec §7; plan 2026-11-24-editor-screens-a, Task 6): its take as it stands (an
 * analysis that stopped fails it, written so), the turns' words up to the head, the edit shown, where Undo and Redo go, and the
 * export of the turn shown; every address signed afresh. 401/403 as every edit route · 404 for an edit that is not theirs.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { creator, route } from "../../creator";
import { ownEdit, viewOf } from "../store";

export const dynamic = "force-dynamic";

export const GET = route("GET /api/edit/edits/[id]", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  return NextResponse.json(await viewOf(who, edit, createServiceClient()));
});
```

`src/app/api/edit/edits/[id]/take/route.ts`:

```ts
/**
 * POST /api/edit/edits/[id]/take {take} → 200 EditView
 *
 * Another take for an edit with no cut yet (spec §5.1 "upload stopped" and "take failed"; plan 2026-11-24-editor-screens-a,
 * Task 6): the page signs for a new take and uploads it, then puts it here. Its title is the new file's name. The take it
 * replaces stays; clearing old takes is piece 4's.
 *
 * 401/403 · 415/403 · 400 for a body that is not `{take}` · 404 for an edit or a take that is not theirs, or a reference ·
 * 409 once the edit has a cut.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { takeTitle } from "@/lib/edit/said";
import { referencesAmong } from "@/lib/edit/style/reference";
import { creator, ownTake, refuse, route } from "../../../creator";
import { EDIT_SAID, ownEdit, turnsOf, viewOf } from "../../store";

const Body = z.strictObject({ take: z.string().max(64) });

export const POST = route("POST /api/edit/edits/[id]/take", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, "the body is {take}");
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (edit.head !== null || (await turnsOf(service, edit.id)).length > 0) return refuse(409, EDIT_SAID.hasCut);
  const take = await ownTake(who, body.data.take);
  if (take instanceof Response) return take;
  if ((await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such take");
  const { data, error } = await service
    .from("edits")
    .update({ take_id: take.id, title: takeTitle(take.name, null) })
    .eq("id", edit.id)
    .eq("user_id", who.user)
    .is("head", null)
    .select();
  if (error) throw new Error(`the edit's take could not be written: ${error.message}`);
  const moved = data[0];
  return moved ? NextResponse.json(await viewOf(who, moved, service)) : refuse(409, EDIT_SAID.hasCut);
});
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/ && pnpm exec tsc --noEmit && pnpm exec eslint src/app/api/edit/`. If supabase-js's type parser refuses the `v:doc->v` select string, keep `.returns<TurnRead[]>()` (as `GET /api/edit/takes` does with its own aliased select) and say so in the commit body.

- [ ] Step 5: Commit: `git add src/app/api/edit/edits/store.ts src/app/api/edit/open/route.ts src/app/api/edit/edits/route.ts "src/app/api/edit/edits/[id]/route.ts" "src/app/api/edit/edits/[id]/take/route.ts" src/app/api/edit/__tests__/edit-world.ts src/app/api/edit/__tests__/edits.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(edit): an edit made with its chat and card, read as the page reads it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 7: The turns: a cut, a change, a word fixed by hand, Undo and Redo

**Files:**
- Create: `src/app/api/edit/edits/[id]/cut/route.ts`, `src/app/api/edit/edits/[id]/change/route.ts`, `src/app/api/edit/edits/[id]/ops/route.ts`, `src/app/api/edit/edits/[id]/head/route.ts`
- Test: `src/app/api/edit/__tests__/edit-turns.test.ts`

**Interfaces:** Consumes: `SAID`, `MOST`, `styleOf`, `lookKeyOf`, `readyTakes`, `cutTake`, `changeEdit`, `isObject` (Task 5); `EDIT_SAID`, `ownEdit`, `turnsOf`, `docOf`, `commitTurn`, `exportLive`, `viewOf` (Task 6); `nextTurn`, `shownTurn`, `canMoveTo`, `lookAt`, `MOST_TURNS` (Task 2); `firstCutLine`, `opsSay`, `takeTitle` (Task 3); `creator`, `holdAgent(user)`, `log`, `refuse`, `route` (`creator.ts`); `applyOps`, `OpsSchema`, `analysisOf`, `MAX_FRAMES` (`@/lib/edit`); `review(edit, analyses)` (`@/lib/edit/review`); `assetOf`, `firstEdit` (`worker/takes.ts`); `bucket`; `setThreadTitleIfEmpty(userId, threadId, rawTitle)`. Produces the routes:
- `POST /api/edit/edits/[id]/cut {style?}` → `EditView` (`maxDuration = 180`)
- `POST /api/edit/edits/[id]/change {request, at?}` → `EditView` (`maxDuration = 60`)
- `POST /api/edit/edits/[id]/ops {ops}` → `EditView` (only `word.set`, `captions.set`)
- `POST /api/edit/edits/[id]/head {n}` → `EditView`

- [ ] Step 1: Write the failing test `src/app/api/edit/__tests__/edit-turns.test.ts`:

```ts
/**
 * edit-turns.test.ts — the editor's turns (plan 2026-11-24-editor-screens-a, Task 7; spec §6, §7, E2, E5, E9): the first cut and
 * a cut in another look, a change, a word fixed and captions set by hand, Undo and Redo; two turns at once, and none while the
 * export runs. Real routes, door, review, first cut, loop and turns' rules; stand-ins at the network and the model only.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { analysisOf } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { review } from "@/lib/edit/review";
import { firstCutLine } from "@/lib/edit/said";
import { presetOf } from "@/lib/edit/style/presets";
import { firstEdit } from "@/lib/edit/worker/takes";
import { OTHER, TAKE, USER, uploadingTake } from "@/lib/edit/worker/__tests__/rows";
import { holdAgent } from "../creator";
import { POST as cutRoute } from "../edits/[id]/cut/route";
import { POST as changeRoute } from "../edits/[id]/change/route";
import { POST as opsRoute } from "../edits/[id]/ops/route";
import { POST as headRoute } from "../edits/[id]/head/route";
import { BIGGER, NO_CHANGE, TAKE_ASSET, TAKE_FIRST, answer, by, changeOf, cutOf, post, readyTake, seedEdit, through, wireEditWorld } from "./edit-world";

const w = wireEditWorld();
const cut = (id: string, body: unknown = {}) => cutRoute(post(`/api/edit/edits/${id}/cut`, body), by(id));
const ask = (id: string, request: string, more: Record<string, unknown> = {}) => changeRoute(post(`/api/edit/edits/${id}/change`, { request, ...more }), by(id));
const ops = (id: string, list: unknown[]) => opsRoute(post(`/api/edit/edits/${id}/ops`, { ops: list }), by(id));
const move = (id: string, n: number) => headRoute(post(`/api/edit/edits/${id}/head`, { n }), by(id));
const viewOf = async (response: Response): Promise<EditView> => {
  if (response.status !== 200) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()) as EditView;
};
const refusal = async (response: Response) => ({ status: response.status, ...((await response.json()) as object) });
const turnNumbers = (id: string) => w.world.rest.tables.edit_turns.filter((turn) => turn.edit_id === id).map((turn) => turn.n);
/** A running render, as the edit's export. */
const runningExport = () => w.world.rest.put("edit_jobs", { user_id: USER, kind: "render", status: "running", updated_at: new Date().toISOString() });

describe("POST …/cut", () => {
  it("makes the first cut in the house style, says it by code, and names the edit and its chat from the take's words", async () => {
    const { id, threadId } = seedEdit(w.world);
    const { model } = w.boundaries();
    const expected = await cutOf();
    const view = await viewOf(await cut(id));
    expect(view).toMatchObject({ head: 1, shown: 1, look: "house", undo: null, redo: null, title: "Stop scrolling this changes everything" });
    expect(view.edit).toEqual(expected.edit);
    expect(view.turns).toEqual([{ n: 1, kind: "cut", request: "house", at: null, say: firstCutLine(firstEdit(TAKE_ASSET), expected.edit), doc: true, findings: expected.findings }]);
    expect(w.world.rest.row("threads", threadId)).toMatchObject({ title: "Stop scrolling this changes everything" });
    expect(model.calls[0]).toBe("cut");
  });

  it("cuts again in a preset after changes: a new turn, the changes kept behind Undo, the title kept", async () => {
    const bigger = through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]);
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST, request: "house" }, { kind: "change", doc: bigger, request: "Bigger captions" }] });
    w.boundaries();
    const view = await viewOf(await cut(id, { style: { preset: "clean" } }));
    expect(view).toMatchObject({ head: 3, shown: 3, look: "clean", undo: 2, title: "IMG_0042" });
    expect(view.edit?.captions.look).toBe(presetOf("clean")!.profile.captions.look);
  });

  it("drops the turns after the head", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }, { kind: "change", doc: TAKE_FIRST }, { kind: "change", doc: TAKE_FIRST }], head: 1 });
    w.boundaries();
    expect((await viewOf(await cut(id))).turns.map((turn) => turn.n)).toEqual([1, 2]);
    expect(turnNumbers(id)).toEqual([1, 2]);
  });

  it("refuses while the export runs, while an agent call of theirs is live, and for a take not ready, asking the model nothing", async () => {
    const job = runningExport();
    const exporting = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }], exportJob: String(job.id), exportTurn: 1 });
    const { model } = w.boundaries();
    expect(await refusal(await cut(exporting.id))).toEqual({ status: 409, error: "Your video is being made; the edit holds still until it is done or cancelled." });
    const release = holdAgent(USER)!;
    const held = seedEdit(w.world, { take: readyTake() });
    expect((await cut(held.id)).status).toBe(409);
    release();
    w.world.rest.tables.edit_takes.splice(0);
    const waiting = seedEdit(w.world, { take: uploadingTake() });
    expect(await refusal(await cut(waiting.id))).toEqual({ status: 409, error: "That take has not finished uploading." });
    expect(model.calls).toEqual([]);
  });

  it("404s another creator's edit, and 400s a style that is none", async () => {
    const { id } = seedEdit(w.world);
    w.boundaries();
    expect(await refusal(await cut(id, { style: { preset: "nope" } }))).toEqual({ status: 400, error: "There is no preset of that name." });
    vi.stubEnv("EDIT_CREATORS", `${USER},${OTHER}`);
    w.signedIn = { id: OTHER };
    expect((await cut(id)).status).toBe(404);
  });
});

describe("POST …/change", () => {
  it("makes the request on the edit shown and says what the agent said", async () => {
    const { edit } = await cutOf();
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: edit, request: "house" }] });
    const expected = await changeOf(edit, "make the captions bigger", { change: [answer("The captions are bigger now.", BIGGER)] });
    w.boundaries({ change: [answer("The captions are bigger now.", BIGGER)] });
    const view = await viewOf(await ask(id, "make the captions bigger", { at: 42 }));
    expect(view).toMatchObject({ head: 2, shown: 2, undo: 1 });
    expect(view.edit).toEqual(expected.edit);
    expect(view.turns[1]).toEqual({ n: 2, kind: "change", request: "make the captions bigger", at: 42, say: "The captions are bigger now.", doc: true, findings: expected.findings });
  });

  it("keeps an answer that changed nothing as said, the edit shown as it was", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    w.boundaries({ change: [NO_CHANGE] });
    const view = await viewOf(await ask(id, "make it better"));
    expect(view).toMatchObject({ head: 2, shown: 1 });
    expect(view.turns[1]).toMatchObject({ kind: "said", doc: false });
  });

  it("refuses the second of two turns made at once; the first lands", async () => {
    const { edit } = await cutOf();
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: edit }] });
    let open!: () => void;
    let asked!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const wasAsked = new Promise<void>((resolve) => (asked = resolve));
    w.boundaries({ change: [{ text: answer("The captions are bigger now.", BIGGER), gate, asked }] });
    const changing = ask(id, "make the captions bigger");
    await wasAsked;
    const fixed = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 0, text: "Stop!" }]));
    expect(fixed.head).toBe(2);
    open();
    expect(await refusal(await changing)).toEqual({ status: 409, error: "The edit changed while this was being made. Try again." });
    expect(turnNumbers(id)).toEqual([1, 2]);
  });

  it("refuses a blank request, an edit with no cut, and while the export runs", async () => {
    const none = seedEdit(w.world);
    w.boundaries();
    expect(await refusal(await ask(none.id, "  "))).toEqual({ status: 400, error: "Say what to change." });
    expect(await refusal(await ask(none.id, "shorter"))).toEqual({ status: 409, error: "There is no cut of this edit yet." });
    const job = runningExport();
    const exporting = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }], exportJob: String(job.id), exportTurn: 1 });
    expect((await ask(exporting.id, "shorter")).status).toBe(409);
  });
});

describe("POST …/ops", () => {
  it("fixes a word with no agent and no wait, and says it", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    const { model } = w.boundaries();
    const view = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 1, text: "scrollin'" }]));
    const fixed = through(TAKE_FIRST, [{ op: "word.set", asset: TAKE, index: 1, text: "scrollin'" }]);
    expect(view.edit).toEqual(fixed);
    expect(view.turns[1]).toEqual({ n: 2, kind: "direct", request: null, at: null, say: `Changed "scrolling" to "scrollin'".`, doc: true, findings: review(fixed, { [TAKE]: analysisOf(readyTake()) }) });
    expect(model.calls).toEqual([]);
  });

  it("fixes every place a word was heard at once, and turns captions off", async () => {
    const twice = through(TAKE_FIRST, [{ op: "word.set", asset: TAKE, index: 2, text: "Stop" }]);
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: twice }] });
    const all = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }, { op: "word.set", asset: TAKE, index: 2, text: "Halt" }]));
    expect(all.turns[1]?.say).toBe('Changed "Stop" to "Halt" in 2 places.');
    const off = await viewOf(await ops(id, [{ op: "captions.set", on: false }]));
    expect(off.edit?.captions.on).toBe(false);
    expect(off.turns[2]?.say).toBe("Captions are off.");
  });

  it("refuses any other operation, and one the door refuses", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    expect(await refusal(await ops(id, [{ op: "look.set", preset: "mono" }]))).toEqual({ status: 400, error: "Only a word or the captions can be changed here." });
    const refused = await refusal(await ops(id, [{ op: "word.set", asset: TAKE, index: 99, text: "x" }]));
    expect(refused).toMatchObject({ status: 400, error: "That change could not be made." });
    expect(turnNumbers(id)).toEqual([1]);
  });
});

describe("POST …/head", () => {
  const line = () => {
    const bigger = through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]);
    const fixed = through(bigger, [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }]);
    return [
      { kind: "cut" as const, doc: TAKE_FIRST, request: "house" },
      { kind: "change" as const, doc: bigger, request: "Bigger captions" },
      { kind: "said" as const, doc: null, request: "Make it pop" },
      { kind: "direct" as const, doc: fixed },
    ];
  };

  it("undoes to the edit before, past what was said, and redoes back", async () => {
    const turns = line();
    const { id } = seedEdit(w.world, { turns });
    const undone = await viewOf(await move(id, 2));
    expect(undone).toMatchObject({ head: 2, shown: 2, undo: 1, redo: 4 });
    expect(undone.turns.map((turn) => turn.n)).toEqual([1, 2]);
    expect(undone.edit).toEqual(turns[1]!.doc);
    const redone = await viewOf(await move(id, 4));
    expect(redone).toMatchObject({ head: 4, shown: 4, undo: 2, redo: null });
  });

  it("names the look of the cut it lands on", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST, request: "house" }, { kind: "cut", doc: TAKE_FIRST, request: "clean" }], look: "clean" });
    expect((await viewOf(await move(id, 1))).look).toBe("house");
  });

  it("refuses a turn that holds no edit, and moving while the export runs", async () => {
    const { id } = seedEdit(w.world, { turns: line() });
    expect(await refusal(await move(id, 3))).toEqual({ status: 400, error: "There is no such version of this edit." });
    const job = runningExport();
    const exporting = seedEdit(w.world, { turns: line(), exportJob: String(job.id), exportTurn: 4 });
    expect((await move(exporting.id, 2)).status).toBe(409);
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/edit-turns.test.ts` → `Failed to resolve import "../edits/[id]/cut/route"`.

- [ ] Step 3: Implement.

`src/app/api/edit/edits/[id]/cut/route.ts`:

```ts
/**
 * POST /api/edit/edits/[id]/cut {style?} → 200 EditView
 *
 * The first cut, or a cut in another look (spec §7, E2, E9; plan 2026-11-24-editor-screens-a, Task 7): the take cut by the agent
 * as `POST /api/edit/agent` cuts it (`cutTake`), in the style asked (none: the house's; `{preset}`; `{words}`; a reference's
 * profile), written as a new turn after the head: its line written by code (`firstCutLine`), its findings, its edit. A cut after
 * changes starts again from the take; Undo brings the changes back. The first cut names the edit and its chat from the take's
 * first words. One agent call of a creator's at a time (`holdAgent`, X92).
 *
 * 401/403 · 415/403 · 400 for a body or a style that is none · 404 for an edit that is not theirs, or a take that is a reference ·
 * 409 while its export runs, for a take not ready, while an agent call of theirs is live, when the edit changed meanwhile or holds
 * 300 turns · 502 when no style could be read from the words.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { firstCutLine, takeTitle } from "@/lib/edit/said";
import { nextTurn } from "@/lib/edit/turns";
import { bucket } from "@/lib/edit/worker/r2";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { setThreadTitleIfEmpty } from "@/lib/threads/threads";
import type { Json } from "@/types/database.types";
import { SAID, cutTake, lookKeyOf, readyTakes, styleOf } from "../../../agent-calls";
import { creator, holdAgent, log, refuse, route } from "../../../creator";
import { EDIT_SAID, commitTurn, exportLive, ownEdit, turnsOf, viewOf } from "../../store";

/** A first cut stops at 170 s (X89), its words' style read included. */
export const maxDuration = 180;

const Body = z.strictObject({ style: z.unknown().optional() });

export const POST = route("POST /api/edit/edits/[id]/cut", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const begun = Date.now();
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  const styled = styleOf(body.data.style);
  if (styled instanceof Response) return styled;
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  const takes = await readyTakes(who, [edit.take_id]);
  if (takes instanceof Response) return takes;
  const take = takes[0]!;
  const turns = await turnsOf(service, edit.id);
  if (!nextTurn(turns, edit.head).ok) return refuse(409, EDIT_SAID.full);

  const release = holdAgent(who.user);
  if (!release) return refuse(409, SAID.busy);
  try {
    const cut = await cutTake(who, take, styled, begun);
    if (cut instanceof Response) return cut;
    const asset = assetOf(take, bucket());
    const look = lookKeyOf(body.data.style, styled);
    const title = edit.head === null ? takeTitle(take.name, asset.kind === "video" ? asset.words : null) : undefined;
    const written = await commitTurn(
      service, edit, turns,
      { kind: "cut", request: look, at: null, say: firstCutLine(firstEdit(asset), cut.result.edit), findings: cut.result.findings, doc: cut.result.edit },
      { look, style: cut.style as unknown as Json, ...(title === undefined ? {} : { title }) },
    );
    if (written === "full") return refuse(409, EDIT_SAID.full);
    if (written === "conflict") return refuse(409, EDIT_SAID.changed);
    if (title !== undefined && edit.thread_id !== null) await setThreadTitleIfEmpty(who.user, edit.thread_id, title);
    log.info("an edit's cut", { look, rounds: cut.result.rounds.length, cost: cut.cost, ms: Date.now() - begun });
    return NextResponse.json(await viewOf(who, written, service));
  } finally {
    release();
  }
});
```

`src/app/api/edit/edits/[id]/change/route.ts`:

```ts
/**
 * POST /api/edit/edits/[id]/change {request, at?} → 200 EditView
 *
 * The agent's change on the edit shown (spec §7; plan 2026-11-24-editor-screens-a, Task 7), as `POST /api/edit/agent` makes one
 * (`changeEdit`), written as a new turn after the head: `change` with the edit it made, or `said` (no edit) when it changed
 * nothing. Its sentence is the agent's, shown as it is. `at`, the film frame the request was about, is stored and not used until
 * slice B. One agent call of a creator's at a time; a turn made meanwhile wins and this one is refused (409).
 *
 * 401/403 · 415/403 · 400 for a body that is not `{request, at?}`, a request blank or over 500 characters · 404 for an edit that
 * is not theirs · 409 while its export runs, with no cut yet, for a take not ready, while an agent call of theirs is live, when
 * the edit changed meanwhile or holds 300 turns · 422 for an edit whose files are not the take as measured.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_FRAMES } from "@/lib/edit";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { nextTurn, shownTurn } from "@/lib/edit/turns";
import { MOST, SAID, changeEdit, readyTakes } from "../../../agent-calls";
import { creator, holdAgent, log, refuse, route } from "../../../creator";
import { EDIT_SAID, commitTurn, docOf, exportLive, ownEdit, turnsOf, viewOf } from "../../store";

/** A change stops at 50 s (X89). */
export const maxDuration = 60;

const Body = z.strictObject({ request: z.string(), at: z.number().int().min(0).max(MAX_FRAMES).nullable().optional() });

export const POST = route("POST /api/edit/edits/[id]/change", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const begun = Date.now();
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  const asked = body.data.request.trim();
  if (asked === "") return refuse(400, SAID.blank);
  if (asked.length > MOST.request) return refuse(400, SAID.long);
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  const turns = await turnsOf(service, edit.id);
  const shown = shownTurn(turns, edit.head);
  if (shown === null) return refuse(409, EDIT_SAID.noCut);
  if (!nextTurn(turns, edit.head).ok) return refuse(409, EDIT_SAID.full);
  const takes = await readyTakes(who, [edit.take_id]);
  if (takes instanceof Response) return takes;
  const doc = await docOf(service, edit.id, shown);

  const release = holdAgent(who.user);
  if (!release) return refuse(409, SAID.busy);
  try {
    const result = await changeEdit(who, takes, doc, asked, begun);
    if (result instanceof Response) return result;
    const written = await commitTurn(service, edit, turns, {
      kind: result.changed ? "change" : "said", request: asked, at: body.data.at ?? null, say: result.say, findings: result.findings, doc: result.changed ? result.edit : null,
    });
    if (written === "full") return refuse(409, EDIT_SAID.full);
    if (written === "conflict") return refuse(409, EDIT_SAID.changed);
    log.info("an edit's change", { rounds: result.rounds.length, changed: result.changed, cost: result.cost, ms: Date.now() - begun });
    return NextResponse.json(await viewOf(who, written, service));
  } finally {
    release();
  }
});
```

`src/app/api/edit/edits/[id]/ops/route.ts`:

```ts
/**
 * POST /api/edit/edits/[id]/ops {ops} → 200 EditView
 *
 * What the creator changes by hand (spec E5, §7; plan 2026-11-24-editor-screens-a, Task 7): from a list of two, `word.set` (a word
 * heard wrong, in one place or every place it was heard) and `captions.set` (captions on and off). No agent, no wait: through the
 * door (`applyOps`), read again by the review, written as a `direct` turn with a sentence written by code (`opsSay`).
 *
 * 401/403 · 415/403 · 400 for a body that is not `{ops}`, any other operation, or one the door refuses (`{error, problems}`) ·
 * 404 for an edit that is not theirs · 409 while its export runs, with no cut yet, for a take not ready, when the edit changed
 * meanwhile or holds 300 turns.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { OpsSchema, analysisOf, applyOps } from "@/lib/edit";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { review } from "@/lib/edit/review";
import { opsSay } from "@/lib/edit/said";
import { nextTurn, shownTurn } from "@/lib/edit/turns";
import { bucket } from "@/lib/edit/worker/r2";
import { assetOf } from "@/lib/edit/worker/takes";
import { SAID, isObject, readyTakes } from "../../../agent-calls";
import { creator, refuse, route } from "../../../creator";
import { EDIT_SAID, commitTurn, docOf, exportLive, ownEdit, turnsOf, viewOf } from "../../store";

/** The two operations done by hand in this piece (E5). */
const DIRECT: ReadonlySet<string> = new Set(["word.set", "captions.set"]);
const Body = z.strictObject({ ops: z.array(z.unknown()).min(1).max(200) });

export const POST = route("POST /api/edit/edits/[id]/ops", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  if (!body.data.ops.every((op) => isObject(op) && typeof op.op === "string" && DIRECT.has(op.op))) return refuse(400, EDIT_SAID.direct);
  const ops = OpsSchema.safeParse(body.data.ops);
  if (!ops.success) return refuse(400, EDIT_SAID.notMade, { problems: ops.error.issues.map((issue) => ({ path: issue.path.map(String).join("."), id: null, message: issue.message })) });
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  const turns = await turnsOf(service, edit.id);
  const shown = shownTurn(turns, edit.head);
  if (shown === null) return refuse(409, EDIT_SAID.noCut);
  if (!nextTurn(turns, edit.head).ok) return refuse(409, EDIT_SAID.full);
  const takes = await readyTakes(who, [edit.take_id]);
  if (takes instanceof Response) return takes;
  const take = takes[0]!;
  const doc = await docOf(service, edit.id, shown);

  const made = applyOps(doc, ops.data, [assetOf(take, bucket())]);
  if (!made.ok) return refuse(400, EDIT_SAID.notMade, { problems: made.problems });
  const findings = review(made.edit, { [take.id]: analysisOf(take) });
  const written = await commitTurn(service, edit, turns, { kind: "direct", request: null, at: null, say: opsSay(doc, ops.data), findings, doc: made.edit });
  if (written === "full") return refuse(409, EDIT_SAID.full);
  if (written === "conflict") return refuse(409, EDIT_SAID.changed);
  return NextResponse.json(await viewOf(who, written, service));
});
```

`src/app/api/edit/edits/[id]/head/route.ts`:

```ts
/**
 * POST /api/edit/edits/[id]/head {n} → 200 EditView
 *
 * Undo and Redo (spec §6; plan 2026-11-24-editor-screens-a, Task 7): the head moves to turn `n`, which must hold an edit; the
 * edit's look follows to that of the cut it lands on. Nothing is dropped: a new turn made from there drops what comes after.
 *
 * 401/403 · 415/403 · 400 for a body that is not `{n}`, or a turn that holds no edit · 404 for an edit that is not theirs ·
 * 409 while its export runs.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { MOST_TURNS, canMoveTo, lookAt } from "@/lib/edit/turns";
import { SAID } from "../../../agent-calls";
import { creator, refuse, route } from "../../../creator";
import { EDIT_SAID, exportLive, ownEdit, turnsOf, viewOf } from "../../store";

const Body = z.strictObject({ n: z.number().int().min(1).max(MOST_TURNS) });

export const POST = route("POST /api/edit/edits/[id]/head", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  const turns = await turnsOf(service, edit.id);
  if (!canMoveTo(turns, body.data.n)) return refuse(400, EDIT_SAID.noVersion);
  const { data, error } = await service
    .from("edits")
    .update({ head: body.data.n, look: lookAt(turns, body.data.n) })
    .eq("id", edit.id)
    .eq("user_id", who.user)
    .select();
  if (error) throw new Error(`the edit's head could not be moved: ${error.message}`);
  const moved = data[0];
  return moved ? NextResponse.json(await viewOf(who, moved, service)) : refuse(404, EDIT_SAID.notHere);
});
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/ && pnpm exec tsc --noEmit && pnpm exec eslint src/app/api/edit/`. The first cut's expected title depends on the made-up take's words: if `firstCut` ever leaves the first word stressed or hidden, `takeTitle` still reads `text`, so the title stays "Stop scrolling this changes everything".

- [ ] Step 5: Commit: `git add "src/app/api/edit/edits/[id]/cut/route.ts" "src/app/api/edit/edits/[id]/change/route.ts" "src/app/api/edit/edits/[id]/ops/route.ts" "src/app/api/edit/edits/[id]/head/route.ts" src/app/api/edit/__tests__/edit-turns.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(edit): the editor's turns: a cut, a change, a word by hand, undo and redo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 8: The export, and giving it up

**Files:**
- Create: `src/app/api/edit/edits/[id]/export/route.ts`
- Test: `src/app/api/edit/__tests__/edit-export.test.ts`

**Interfaces:** Consumes: `startRender(who, edit): Promise<JobRow | Response>` (Task 5); `started(job)` (`creator.ts`); `EDIT_SAID`, `ownEdit`, `turnsOf`, `docOf`, `exportLive`, `viewOf` (Task 6); `shownTurn` (Task 2). Produces: `POST /api/edit/edits/[id]/export` → `202 EditView` (its `export` the job just started); `DELETE /api/edit/edits/[id]/export` → `200 EditView` (`export: null`).

What can be stopped (read at `worker/store.py:30-33`, `:156-162`, `:183-224`, `:381-415`): the app cannot cancel a Modal call, and needs not. The worker claims a job only while it is `queued`, writes its progress only while it is `running` (`status=eq.running`), and gives the job up (`Stopped`) at the next progress it tells once a write matches no running row: at most 2 s while the slices draw (`EVERY_S`), with the slices cancelled by `plan.collect`, or at the next stage. Its last write (`finish`) is filtered on `running` too. So `DELETE` writes the job `failed` from `queued` or `running`, and the worker stops on its own.

- [ ] Step 1: Write the failing test `src/app/api/edit/__tests__/edit-export.test.ts`:

```ts
/**
 * edit-export.test.ts — the export of the edit shown, and giving it up (plan 2026-11-24-editor-screens-a, Task 8; spec E20, §7).
 * The worker's start is the stand-in's (`/start`); a render that has finished is its row as the worker writes it.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { coverFrame } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { TAKE, USER } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET } from "@/lib/edit/worker/__tests__/stand-ins";
import { POST as exportRoute, DELETE as giveUp } from "../edits/[id]/export/route";
import { GET as read } from "../edits/[id]/route";
import { POST as opsRoute } from "../edits/[id]/ops/route";
import { TAKE_FIRST, by, del, get, post, seedEdit, through, wireEditWorld } from "./edit-world";

const w = wireEditWorld();
const start = (id: string) => exportRoute(post(`/api/edit/edits/${id}/export`), by(id));
const viewOf = async (response: Response, status = 200): Promise<EditView> => {
  if (response.status !== status) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()) as EditView;
};

describe("POST …/export", () => {
  it("renders the edit shown on the worker and keeps the job as the export of that turn", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    const view = await viewOf(await start(id), 202);
    expect(view.export).toMatchObject({ turn: 1, status: "queued", filmUrl: null });
    const job = w.world.rest.row("edit_jobs", view.export!.job)!;
    expect(job).toMatchObject({ user_id: USER, kind: "render", input: { edit: TAKE_FIRST, cover: coverFrame(TAKE_FIRST) } });
    expect(w.world.worker.started).toEqual([view.export!.job]);
    expect(w.world.rest.row("edits", id)).toMatchObject({ export_job: view.export!.job, export_turn: 1 });
  });

  it("refuses a second export while one runs, and an edit with no cut", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    await start(id);
    expect((await start(id)).status).toBe(409);
    const none = seedEdit(w.world);
    expect((await start(none.id)).status).toBe(409);
  });

  it("502s when the worker cannot start the render, and keeps no export", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    w.world.worker.answer = 500;
    const refused = await start(id);
    expect(refused.status).toBe(502);
    expect(w.world.rest.row("edits", id)).toMatchObject({ export_job: null });
  });
});

describe("the export as the page reads it", () => {
  it("gives the film's address once it is made, for the turn shown only", async () => {
    const job = w.world.rest.put("edit_jobs", { user_id: USER, kind: "render", status: "done", progress: 1, result: { path: `u/${USER}/films/film-1.mp4`, ms: 7400 } });
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }, { kind: "change", doc: through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]) }], exportJob: String(job.id), exportTurn: 2 });
    const view = await viewOf(await read(get(`/api/edit/edits/${id}`), by(id)));
    expect(view.export).toMatchObject({ turn: 2, status: "done", ms: 7400 });
    expect(decodeURIComponent(new URL(view.export!.filmUrl!).pathname)).toBe(`/${BUCKET}/u/${USER}/films/film-1.mp4`);
    w.world.rest.row("edits", id)!.head = 1;
    expect((await viewOf(await read(get(`/api/edit/edits/${id}`), by(id)))).export).toBeNull();
  });

  it("is forgotten when a new turn is made", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    await start(id);
    w.world.rest.tables.edit_jobs[0]!.status = "done";
    const view = await viewOf(await opsRoute(post(`/api/edit/edits/${id}/ops`, { ops: [{ op: "captions.set", on: false }] }), by(id)));
    expect(view.export).toBeNull();
    expect(w.world.rest.row("edits", id)).toMatchObject({ export_job: null, export_turn: null });
  });
});

describe("DELETE …/export", () => {
  it("writes the running render failed, so the worker gives it up, and gives the edit back", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    const started = await viewOf(await start(id), 202);
    w.world.rest.row("edit_jobs", started.export!.job)!.status = "running";
    const view = await viewOf(await giveUp(del(`/api/edit/edits/${id}/export`), by(id)));
    expect(view.export).toBeNull();
    expect(w.world.rest.row("edit_jobs", started.export!.job)).toMatchObject({ status: "failed", error: "the creator cancelled it" });
    expect(w.world.rest.row("edits", id)).toMatchObject({ export_job: null, export_turn: null });
    expect((await opsRoute(post(`/api/edit/edits/${id}/ops`, { ops: [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }] }), by(id))).status).toBe(200);
  });

  it("leaves a render that has ended as it is", async () => {
    const job = w.world.rest.put("edit_jobs", { user_id: USER, kind: "render", status: "done", progress: 1, result: { path: `u/${USER}/films/film-1.mp4`, ms: 7400 } });
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }], exportJob: String(job.id), exportTurn: 1 });
    await viewOf(await giveUp(del(`/api/edit/edits/${id}/export`), by(id)));
    expect(w.world.rest.row("edit_jobs", String(job.id))).toMatchObject({ status: "done" });
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/edit-export.test.ts` → `Failed to resolve import "../edits/[id]/export/route"`.

- [ ] Step 3: Implement `src/app/api/edit/edits/[id]/export/route.ts`:

```ts
/**
 * POST /api/edit/edits/[id]/export → 202 EditView
 * DELETE /api/edit/edits/[id]/export → 200 EditView
 *
 * The export of the edit shown (spec E6, E20; plan 2026-11-24-editor-screens-a, Task 8): its render started on the worker as
 * `POST /api/edit/renders` starts one (`startRender`), and kept as the export of that turn; the edit then holds still (no turn,
 * no move) until the render ends or is given up. A new turn forgets it; a move back to its turn finds it again.
 * DELETE gives it up: the job is written failed from queued or running ("the creator cancelled it"), and the worker, which claims
 * only a queued job and writes progress only to a running one, stops at its next step (`worker/store.py`, `Stopped`).
 *
 * 401/403 · 415/403 · 404 for an edit that is not theirs, or a file that is a reference · 400 for a file not theirs to render ·
 * 409 with no cut yet, while its export or another render of theirs runs · 502 {job, error} when the worker cannot start it.
 */
import { NextResponse } from "next/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { shownTurn } from "@/lib/edit/turns";
import { creator, refuse, route, started } from "../../../creator";
import { startRender } from "../../../render";
import { EDIT_SAID, docOf, exportLive, ownEdit, turnsOf, viewOf } from "../../store";

/** It waits on the worker's web address, 9 to 17 s when that is cold. */
export const maxDuration = 60;

export const POST = route("POST /api/edit/edits/[id]/export", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  const shown = shownTurn(await turnsOf(service, edit.id), edit.head);
  if (shown === null) return refuse(409, EDIT_SAID.noCut);
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  const job = await startRender(who, await docOf(service, edit.id, shown));
  if (job instanceof Response) return job;
  if (job.status === "failed") return started(job);
  const { data, error } = await service.from("edits").update({ export_job: job.id, export_turn: shown }).eq("id", edit.id).eq("user_id", who.user).select();
  if (error) throw new Error(`the edit's export could not be written: ${error.message}`);
  return NextResponse.json(await viewOf(who, data[0] ?? edit, service), { status: 202 });
});

export const DELETE = route("DELETE /api/edit/edits/[id]/export", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (edit.export_job !== null) {
    const { error } = await service
      .from("edit_jobs")
      .update({ status: "failed", error: "the creator cancelled it", finished_at: new Date().toISOString() })
      .eq("id", edit.export_job)
      .eq("user_id", who.user)
      .in("status", ["queued", "running"]);
    if (error) throw new Error(`the export could not be given up: ${error.message}`);
  }
  const { data, error } = await service.from("edits").update({ export_job: null, export_turn: null }).eq("id", edit.id).eq("user_id", who.user).select();
  if (error) throw new Error(`the edit's export could not be cleared: ${error.message}`);
  return NextResponse.json(await viewOf(who, data[0] ?? edit, service));
});
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit/__tests__/ && pnpm exec tsc --noEmit && pnpm exec eslint "src/app/api/edit/edits/[id]/export/route.ts"`.

- [ ] Step 5: Commit: `git add "src/app/api/edit/edits/[id]/export/route.ts" src/app/api/edit/__tests__/edit-export.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(edit): the export of the edit shown, and giving it up" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 9: The page's side of the routes: calls, a take's file, uploads that outlive a page, a style read from a video

**Files:**
- Create: `src/components/editor/net.ts`, `src/components/editor/take-file.ts`, `src/components/editor/uploads.ts`, `src/components/editor/read-style.ts` (copy of `src/app/dev-edit/agent/reference.ts`)
- Test: `src/components/editor/__tests__/uploads.test.ts`, `src/components/editor/__tests__/take-file.test.ts`, `src/components/editor/__tests__/read-style.test.ts` (copy of `src/app/dev-edit/agent/__tests__/reference.test.ts`)

**Interfaces:** Consumes: `uploadSecondsLeft`, `type Sample` (Task 3); `MAX_TAKE_BYTES`, `TAKE_TYPES` (`worker/takes.ts`); the dev page's `call`/`put` (`src/app/dev-edit/shared.ts:21-41`) and `sentence`/`problemOf`/`stageLine`/`UNREACHABLE`/`WENT_WRONG` (`src/app/dev-edit/agent/picking.ts:66-89`), copied, not imported. Produces:
- `net.ts`: `call<T>(path: string, body?: unknown, method?: "POST" | "DELETE"): Promise<{ ok: boolean; status: number; body: T & { error?: string } }>`; `put(url: string, file: File, onSent: (bytes: number) => void, type?: string): Promise<void>`; `sentence(text: string): string`; `problemOf(answer: { status: number; body: { error?: string } }): string`; `stageLine(stage: string): string`; `UNREACHABLE`, `WENT_WRONG`.
- `take-file.ts`: `takeTypeOf(file: Pick<File, "name" | "type">): string`; `editTakeProblem(file: Pick<File, "name" | "type" | "size">): string | null`; `sendTake(file: File): Promise<{ ok: true; takeId: string } | { ok: false; problem: string }>`.
- `uploads.ts`: `type UploadStatus = "sending" | "finishing" | "sent" | "failed"`; `interface Upload { takeId; file: File; localUrl: string; status: UploadStatus; sent: number; total: number; secondsLeft: number | null; error: string | null }`; `interface UploadDeps { put?; now?: () => number; objectUrl?: (file: File) => string; revoke?: (url: string) => void }`; `startUpload(take: { id: string; uploadUrl: string; type: string }, file: File, deps?: UploadDeps): Upload`; `retryUpload(takeId: string): void`; `uploadOf(takeId: string): Upload | null`; `forgetUpload(takeId: string): void`; `subscribeUploads(listener: () => void): () => void`; `useUpload(takeId: string | null): Upload | null`; `NOT_SENT`.
- `read-style.ts`: `readStyle(source: Source, tell: (progress: Progress) => void, deps?): Promise<Read>`, `type Source = { link: string } | { file: File }`, `type Progress`, `type Read` (as `reference.ts`).

- [ ] Step 1: Write the failing tests.

Copy the dev page's reference test and point it at the copy: `cp src/app/dev-edit/agent/__tests__/reference.test.ts src/components/editor/__tests__/read-style.test.ts`, then in the copy change line 7 to `import { readStyle, type Progress } from "../read-style";` and the first line of its header to ` * read-style.test.ts — "Like a video" in the editor (plan 2026-11-24-editor-screens-a, Task 9), as the dev page's reference.test.ts holds it: the page's side of`.

`src/components/editor/__tests__/take-file.test.ts`:

```ts
/** take-file.test.ts — a file as a take to edit (plan 2026-11-24-editor-screens-a, Task 9): the edit tool's limits, not Simulate's. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetUpload, uploadOf } from "../uploads";
import { editTakeProblem, sendTake, takeTypeOf } from "../take-file";

const TAKE = "22222222-2222-4222-8222-222222222222";
const file = (name: string, type: string, size = 10) => ({ name, type, size });

afterEach(() => {
  forgetUpload(TAKE);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a take's type and limits", () => {
  it("reads the type from the name when the device gave none", () => {
    expect(takeTypeOf(file("IMG_0042.MOV", ""))).toBe("video/quicktime");
    expect(takeTypeOf(file("take.mp4", ""))).toBe("video/mp4");
    expect(takeTypeOf(file("take.webm", "video/webm"))).toBe("video/webm");
  });

  it("takes an MP4 or a MOV of up to 2 GB, past Simulate's 200 MB", () => {
    expect(editTakeProblem(file("IMG_0042.MOV", "video/quicktime", 1.5 * 1024 ** 3))).toBeNull();
    expect(editTakeProblem(file("take.webm", "video/webm"))).toBe("A video to edit is an MP4 or a MOV file.");
    expect(editTakeProblem(file("take.mp4", "video/mp4", 2 * 1024 ** 3 + 1))).toBe("A video to edit is at most 2 GB.");
    expect(editTakeProblem(file("take.mp4", "video/mp4", 0))).toBe("This video is empty.");
  });
});

describe("sendTake", () => {
  it("signs for the file as a take with the type it is sent as, and starts its upload", async () => {
    const asked: { path: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
      asked.push({ path: String(path), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(path) === "/api/edit/takes") return new Response(JSON.stringify({ take: { id: TAKE }, uploadUrl: "https://r2.test/put" }), { status: 201 });
      return new Response(JSON.stringify({ job: { id: "j" } }), { status: 202 });
    }));
    vi.stubGlobal("XMLHttpRequest", class {
      upload = { onprogress: null as ((event: { loaded: number }) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      status = 0;
      open() {}
      setRequestHeader() {}
      send() {}
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local/1");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const sent = await sendTake(new File([new Uint8Array(10)], "IMG_0042.MOV", { type: "" }));
    expect(sent).toEqual({ ok: true, takeId: TAKE });
    expect(asked[0]).toEqual({ path: "/api/edit/takes", body: { name: "IMG_0042.MOV", bytes: 10, type: "video/quicktime" } });
    expect(uploadOf(TAKE)).toMatchObject({ status: "sending", total: 10, localUrl: "blob:local/1" });
  });

  it("says why a file cannot be sent, before asking anything", async () => {
    const fetching = vi.fn();
    vi.stubGlobal("fetch", fetching);
    expect(await sendTake(new File([new Uint8Array(10)], "clip.webm", { type: "video/webm" }))).toEqual({ ok: false, problem: "A video to edit is an MP4 or a MOV file." });
    expect(fetching).not.toHaveBeenCalled();
  });
});
```

`src/components/editor/__tests__/uploads.test.ts`:

```ts
/**
 * uploads.test.ts — the uploads in flight, held outside any page (plan 2026-11-24-editor-screens-a, Task 9; spec §5.2, E21): the
 * file put at its signed address with the type it was signed for, how far it is and the time left from what it measured, the
 * finish told, a failure said and tried again, and a holder anyone can listen to. The PUT into R2 and the network are stood in;
 * the holder is real.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOT_SENT, forgetUpload, retryUpload, startUpload, subscribeUploads, uploadOf, type UploadDeps } from "../uploads";

let n = 0;
const ids: string[] = [];
const takeId = () => {
  const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  ids.push(id);
  return id;
};
const file = (bytes: number) => new File([new Uint8Array(bytes)], "IMG_0042.MOV", { type: "video/quicktime" });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

interface Put {
  url: string;
  type: string | undefined;
  onSent: (bytes: number) => void;
  done: () => void;
  fail: () => void;
}

function wire(finish: { status: number; body: unknown } = { status: 202, body: { job: { id: "j" } } }) {
  let clock = 0;
  const puts: Put[] = [];
  const finishes: string[] = [];
  const answer = { ...finish };
  const deps: UploadDeps = {
    now: () => clock,
    objectUrl: () => "blob:local/1",
    revoke: vi.fn(),
    put: (url, _file, onSent, type) => new Promise<void>((done, fail) => puts.push({ url, type, onSent, done, fail: () => fail(new Error("the upload did not reach R2")) })),
  };
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    finishes.push(`${init?.method ?? "GET"} ${String(path)}`);
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }));
  return { deps, puts, finishes, answer, tick: (ms: number) => (clock += ms) };
}

afterEach(() => {
  for (const id of ids.splice(0)) forgetUpload(id);
  vi.unstubAllGlobals();
});

describe("an upload held outside the page", () => {
  it("puts the file at its signed address with the type it was signed for, says how far it is, then tells its finish", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(4800), net.deps);
    expect(uploadOf(id)).toMatchObject({ status: "sending", sent: 0, total: 4800, localUrl: "blob:local/1", secondsLeft: null });
    expect(net.puts[0]).toMatchObject({ url: "https://r2.test/put", type: "video/quicktime" });
    net.tick(2000);
    net.puts[0]!.onSent(400);
    expect(uploadOf(id)).toMatchObject({ sent: 400, secondsLeft: 22 });
    net.puts[0]!.done();
    await settle();
    await settle();
    expect(net.finishes).toEqual([`POST /api/edit/takes/${id}/uploaded`]);
    expect(uploadOf(id)?.status).toBe("sent");
  });

  it("says when the upload stopped, and Try again sends it again", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.fail();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: NOT_SENT });
    retryUpload(id);
    expect(net.puts).toHaveLength(2);
    net.puts[1]!.done();
    await settle();
    await settle();
    expect(uploadOf(id)?.status).toBe("sent");
  });

  it("takes a finish told twice as told, says a refused one in the route's words, and tries only the finish again", async () => {
    const id = takeId();
    const net = wire({ status: 409, body: { error: "IMG_0042.MOV did not arrive whole: 4 of its 10 bytes are stored" } });
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.done();
    await settle();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: "IMG_0042.MOV did not arrive whole: 4 of its 10 bytes are stored." });
    net.answer.body = { error: "the take is analysing: it is not waiting for its upload" };
    retryUpload(id);
    await settle();
    await settle();
    expect(net.puts).toHaveLength(1);
    expect(uploadOf(id)?.status).toBe("sent");
  });

  it("tells whoever listens, and forgets with its local copy", async () => {
    const id = takeId();
    const net = wire();
    const heard = vi.fn();
    const stop = subscribeUploads(heard);
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    expect(heard).toHaveBeenCalled();
    forgetUpload(id);
    expect(uploadOf(id)).toBeNull();
    expect(net.deps.revoke).toHaveBeenCalledWith("blob:local/1");
    stop();
  });
});
```

- [ ] Step 2: Run them, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/uploads.test.ts src/components/editor/__tests__/take-file.test.ts src/components/editor/__tests__/read-style.test.ts` → `Failed to resolve import "../uploads"` (and `../take-file`, `../read-style`).

- [ ] Step 3: Implement.

`src/components/editor/net.ts`:

```ts
"use client";

/**
 * net.ts — the editor page's side of its routes (plan 2026-11-24-editor-screens-a, Task 9): a call that always answers, a file
 * put into R2 that tells how far it is, and a route's refusal as one plain sentence. Ported from the dev page's `shared.ts`
 * (`call`, `put`) and `picking.ts` (`sentence`, `problemOf`, `stageLine`), which stay with that page until it goes (E14). Two
 * additions: a call may be a DELETE, and the PUT's type is the one the upload was signed for.
 */

/** A call to the app's routes: its status and body. One that fails (the network, a server restarting) is an answer that is not ok. */
export async function call<T>(path: string, body?: unknown, method?: "POST" | "DELETE"): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  try {
    const init: RequestInit =
      body === undefined && method === undefined
        ? { cache: "no-store" }
        : { method: method ?? "POST", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    const response = await fetch(path, init);
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({ error: `it answered ${response.status}` })) };
  } catch (error) {
    return { ok: false, status: 0, body: { error: String(error) } as T & { error?: string } };
  }
}

/** Puts the file into R2 at its signed address as `type` (the one signed into the address), telling how many bytes have gone. */
export function put(url: string, file: File, onSent: (bytes: number) => void, type: string = file.type): Promise<void> {
  return new Promise((done, fail) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", type);
    request.upload.onprogress = (event) => onSent(event.loaded);
    request.onload = () => (request.status >= 200 && request.status < 300 ? done() : fail(new Error(`R2 answered ${request.status} to the upload`)));
    request.onerror = () => fail(new Error("the upload did not reach R2"));
    request.send(file);
  });
}

/** A route's line as a sentence: a capital first, a full stop last. */
export function sentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const capital = trimmed[0]!.toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capital) ? capital : `${capital}.`;
}

export const UNREACHABLE = "The editor could not be reached. Check your connection.";
export const WENT_WRONG = "Something went wrong.";

/** What to show for a call that was not answered ok: the route's own sentence; else a plain line. Never a code or a stack. */
export function problemOf({ status, body }: { status: number; body: { error?: string } }): string {
  if (status === 0) return UNREACHABLE;
  if (!body.error || /^it answered \d+$/.test(body.error)) return WENT_WRONG;
  return sentence(body.error);
}

/** A stage in a creator's words ("reading its cuts") as a line of progress. */
export function stageLine(stage: string): string {
  return `${stage[0]?.toUpperCase() ?? ""}${stage.slice(1)}…`;
}
```

`src/components/editor/take-file.ts`:

```ts
"use client";

/**
 * take-file.ts — a file as a take to edit (spec §5.1; plan 2026-11-24-editor-screens-a, Task 9): its type as the route signs it,
 * the edit tool's limits (MP4 or MOV, at most 2 GB; its length is measured after the upload), and the take signed for and its
 * upload started. Home's door (`start-edit.ts`) and the page's "Pick the video again" both use it.
 */
import { MAX_TAKE_BYTES, TAKE_TYPES } from "@/lib/edit/worker/takes";
import { call, problemOf } from "./net";
import { startUpload } from "./uploads";

/** The file's type, or one read from its name when the device gave none (".mov", ".mp4"). */
export function takeTypeOf(file: Pick<File, "name" | "type">): string {
  if (file.type !== "") return file.type;
  if (/\.mov$/i.test(file.name)) return "video/quicktime";
  if (/\.mp4$/i.test(file.name)) return "video/mp4";
  return "";
}

/** Why this file cannot be a take to edit, in a line; null when it can. */
export function editTakeProblem(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!(TAKE_TYPES as readonly string[]).includes(takeTypeOf(file))) return "A video to edit is an MP4 or a MOV file.";
  if (file.size > MAX_TAKE_BYTES) return "A video to edit is at most 2 GB.";
  if (file.size === 0) return "This video is empty.";
  return null;
}

/** Signs for the file as a take (`POST /api/edit/takes`) and starts its upload in the holder (`uploads.ts`). */
export async function sendTake(file: File): Promise<{ ok: true; takeId: string } | { ok: false; problem: string }> {
  const problem = editTakeProblem(file);
  if (problem) return { ok: false, problem };
  const type = takeTypeOf(file);
  const signed = await call<{ take: { id: string }; uploadUrl: string }>("/api/edit/takes", { name: file.name, bytes: file.size, type });
  if (!signed.ok) return { ok: false, problem: problemOf(signed) };
  startUpload({ id: signed.body.take.id, uploadUrl: signed.body.uploadUrl, type }, file);
  return { ok: true, takeId: signed.body.take.id };
}
```

`src/components/editor/uploads.ts`:

```ts
"use client";

/**
 * uploads.ts — the uploads in flight, held outside any page (spec §5.2, E21; plan 2026-11-24-editor-screens-a, Task 9), so the
 * take sent from Home keeps uploading while the app moves to its editor (`router.push`). The file goes straight into R2 at the
 * address the take was signed for, then its finish is told (`POST /api/edit/takes/[id]/uploaded`), which starts its analysis.
 * Each upload says how far it is, the time left from what it has measured (`uploadSecondsLeft`), and the address of the
 * device's own copy, so the take plays at once. A failed one is tried again from where it failed: the PUT, or only the finish.
 * A reload loses them all, and the page then says the upload stopped.
 */
import { useSyncExternalStore } from "react";
import { uploadSecondsLeft, type Sample } from "@/lib/edit/waits";
import { call, problemOf, put } from "./net";

export type UploadStatus = "sending" | "finishing" | "sent" | "failed";

export interface Upload {
  takeId: string;
  file: File;
  /** The device's own copy, played before the take is ready. */
  localUrl: string;
  status: UploadStatus;
  sent: number;
  total: number;
  secondsLeft: number | null;
  error: string | null;
}

/** What an upload reaches: the PUT, the clock, the device's copies. The holder is the same with or without them. */
export interface UploadDeps {
  put?: typeof put;
  now?: () => number;
  objectUrl?: (file: File) => string;
  revoke?: (url: string) => void;
}

interface Held {
  upload: Upload;
  url: string;
  type: string;
  samples: Sample[];
  /** The file is in R2: a retry tells only the finish. */
  putDone: boolean;
  deps: Required<UploadDeps>;
}

export const NOT_SENT = "The upload stopped. Check your connection and try again.";
/** The most measures kept: a minute and more at the browser's rate of telling. */
const MOST_SAMPLES = 120;

const held = new Map<string, Held>();
const listeners = new Set<() => void>();
const tell = () => {
  for (const listener of listeners) listener();
};
const update = (entry: Held, more: Partial<Upload>) => {
  entry.upload = { ...entry.upload, ...more };
  tell();
};

async function finish(entry: Held): Promise<void> {
  update(entry, { status: "finishing", sent: entry.upload.total, secondsLeft: 0, error: null });
  const told = await call<unknown>(`/api/edit/takes/${entry.upload.takeId}/uploaded`, {});
  // Told already (an answer lost, then a retry): the take is analysing or ready, and goes on.
  const already = told.status === 409 && /is (analysing|ready)/.test(told.body.error ?? "");
  update(entry, told.ok || already ? { status: "sent" } : { status: "failed", error: problemOf(told) });
}

async function send(entry: Held): Promise<void> {
  const { deps } = entry;
  if (entry.putDone) return finish(entry);
  entry.samples = [{ at: deps.now(), sent: 0 }];
  update(entry, { status: "sending", sent: 0, secondsLeft: null, error: null });
  try {
    await deps.put(entry.url, entry.upload.file, (sent) => {
      entry.samples = [...entry.samples, { at: deps.now(), sent }].slice(-MOST_SAMPLES);
      update(entry, { sent, secondsLeft: uploadSecondsLeft(entry.samples, entry.upload.total) });
    }, entry.type);
  } catch {
    return update(entry, { status: "failed", error: NOT_SENT });
  }
  entry.putDone = true;
  return finish(entry);
}

/** Starts the upload of a take just signed for: its file to `uploadUrl`, as `type`. */
export function startUpload(take: { id: string; uploadUrl: string; type: string }, file: File, deps: UploadDeps = {}): Upload {
  const full: Required<UploadDeps> = {
    put: deps.put ?? put,
    now: deps.now ?? Date.now,
    objectUrl: deps.objectUrl ?? ((each) => URL.createObjectURL(each)),
    revoke: deps.revoke ?? ((url) => URL.revokeObjectURL(url)),
  };
  const entry: Held = {
    upload: { takeId: take.id, file, localUrl: full.objectUrl(file), status: "sending", sent: 0, total: file.size, secondsLeft: null, error: null },
    url: take.uploadUrl, type: take.type, samples: [], putDone: false, deps: full,
  };
  held.set(take.id, entry);
  tell();
  void send(entry);
  return entry.upload;
}

/** Tries a failed upload again, from where it failed. */
export function retryUpload(takeId: string): void {
  const entry = held.get(takeId);
  if (entry?.upload.status === "failed") void send(entry);
}

export function uploadOf(takeId: string): Upload | null {
  return held.get(takeId)?.upload ?? null;
}

/** Lets an upload go, and the device's copy with it (an unrevoked address pins the whole file in memory). */
export function forgetUpload(takeId: string): void {
  const entry = held.get(takeId);
  if (!entry) return;
  held.delete(takeId);
  entry.deps.revoke(entry.upload.localUrl);
  tell();
}

export function subscribeUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The upload of a take, as it goes; null when none is held (a reload, another device). */
export function useUpload(takeId: string | null): Upload | null {
  return useSyncExternalStore(subscribeUploads, () => (takeId === null ? null : uploadOf(takeId)), () => null);
}
```

`src/components/editor/read-style.ts`: `cp src/app/dev-edit/agent/reference.ts src/components/editor/read-style.ts`, then in the copy replace lines 10-11 with:

```ts
import { UNREACHABLE, call as callRoute, problemOf, put as putFile, sentence, stageLine } from "./net";
```

and the first line of its header with ` * read-style.ts — "Like a video" in the editor (plan 2026-11-24-editor-screens-a, Task 9): a copy of the dev page's reference.ts (Task 13b), a style read from a video: the page's side of`. Nothing else changes.

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/uploads.test.ts src/components/editor/__tests__/take-file.test.ts src/components/editor/__tests__/read-style.test.ts && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/`.

- [ ] Step 5: Commit: `git add src/components/editor/net.ts src/components/editor/take-file.ts src/components/editor/uploads.ts src/components/editor/read-style.ts src/components/editor/__tests__/uploads.test.ts src/components/editor/__tests__/take-file.test.ts src/components/editor/__tests__/read-style.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(editor): calls, a take's file, uploads that outlive a page, a style read from a video" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 10: The page's state and its calls

**Files:**
- Create: `src/components/editor/edit-session.ts`, `src/components/editor/use-edit.ts`
- Test: `src/components/editor/__tests__/edit-session.test.ts`, `src/components/editor/__tests__/use-edit.test.tsx`

**Interfaces:** Consumes: `EditView`, `LIVE_JOB` (Task 4); `firstChangedFrame` (Task 3); `NEXT_ASKS` (Task 3); `filmFrames` (`@/lib/edit`); `call`, `problemOf` (Task 9); `sendTake` (Task 9); `readStyle`, `type Source` (Task 9); `useUpload`, `retryUpload`, `type Upload` (Task 9); fixtures `viewOf`, `FIRST`, `ASSET`, `EDIT_ID`, `changed` (Task 4). Produces:
- `edit-session.ts`: `type CutStyle = { kind: "house" } | { kind: "preset"; id: string } | { kind: "words"; words: string } | { kind: "video"; style: unknown }`; `type Working`; `interface Session { view: EditView | null; unread: "gone" | "closed" | null; working: Working | null; problem: { text: string; request: string | null } | null; waitLook: CutStyle; moved: "turn" | "move" | null }`; `START`; `type Action`; `reduce(session, action): Session`; `type PageState = "loading" | "not here" | "closed" | "getting ready" | "upload stopped" | "cutting" | "ready" | "exporting" | "take failed"`; `pageStateOf(session: Session, upload: Pick<Upload, "status"> | null): PageState`; `wantsFirstCut(session: Session): boolean`; `interface Controls { ask; tools; undo; redo; exportOn; exporting: boolean }`; `controlsOf(session: Session): Controls`; `type NextChip = { kind: "check"; count: number } | { kind: "style" } | { kind: "ask"; text: string }`; `chipsOf(view: EditView | null, styleReady: boolean): NextChip[]`; `chipLabel(chip: NextChip): string`; `STILL = 15`, `LEAD_IN = 15`; `interface Playhead { frame: number; play: boolean; still: boolean }`; `playheadAfter(was: Edit | null, now: Edit, at: number, moved: "turn" | "move" | null): Playhead`; `styleBody(look: CutStyle): { style?: unknown }`; `lookKeyOfStyle(look: CutStyle): string`.
- `use-edit.ts`: `interface StyleRead { status: "idle" | "reading" | "ready" | "failed"; line: string | null; share: number | null; problem: string | null; style: unknown }`; `interface EditApi { session; state: PageState; controls: Controls; upload: Upload | null; reading: StyleRead; setWaitLook(look: CutStyle): void; cut(look: CutStyle): Promise<boolean>; ask(request: string): Promise<boolean>; ops(list: Op[]): Promise<boolean>; move(n: number): Promise<boolean>; startExport(): Promise<boolean>; cancelExport(): Promise<boolean>; replaceTake(file: File): Promise<void>; retry(): void; readVideo(source: Source): void; applyVideoStyle(): Promise<void>; dismiss(): void }`; `useEdit(id: string, options?: { pollMs?: number }): EditApi`.

- [ ] Step 1: Write the failing tests.

`src/components/editor/__tests__/edit-session.test.ts`:

```ts
/**
 * edit-session.test.ts — the editor page's own state (plan 2026-11-24-editor-screens-a, Task 10; spec §5.1-5.3): the reducer, the
 * page's state, which controls are on, the chips, where the playhead goes. On views of real edits (`views.ts`).
 */
import { describe, expect, it } from "vitest";
import { filmFrames } from "@/lib/edit";
import { ASSET, FIRST, changed, viewOf } from "./views";
import {
  LEAD_IN, START, STILL, chipLabel, chipsOf, controlsOf, lookKeyOfStyle, pageStateOf, playheadAfter, reduce, styleBody, wantsFirstCut, type Session,
} from "../edit-session";

const take = (status: string) => ({ ...viewOf().take, status });
const waiting = viewOf({ take: take("analysing"), head: null, shown: null, edit: null, turns: [] });
const read = (view = viewOf()): Session => reduce(START, { type: "read", view });

describe("reduce", () => {
  it("takes a read only while no call is out, and an answer only for the call out", () => {
    const out = reduce(read(), { type: "start", working: { what: "change", request: "Shorter" } });
    expect(reduce(out, { type: "read", view: waiting }).view).toEqual(viewOf());
    const answered = reduce(out, { type: "answered", view: viewOf({ head: 2 }) });
    expect(answered).toMatchObject({ working: null, moved: "turn" });
    expect(answered.view?.head).toBe(2);
    expect(reduce(answered, { type: "answered", view: viewOf({ head: 3 }) }).view?.head).toBe(2);
  });

  it("keeps a failed change's request, and lets one call out at a time", () => {
    const out = reduce(read(), { type: "start", working: { what: "change", request: "Shorter" } });
    expect(reduce(out, { type: "start", working: { what: "ops" } }).working).toEqual({ what: "change", request: "Shorter" });
    expect(reduce(out, { type: "failed", text: "Something went wrong." })).toMatchObject({ working: null, problem: { text: "Something went wrong.", request: "Shorter" } });
  });

  it("says a move was a move, and reads a refusal as not here or closed", () => {
    const moved = reduce(reduce(read(), { type: "start", working: { what: "move", to: 1 } }), { type: "answered", view: viewOf() });
    expect(moved.moved).toBe("move");
    expect(reduce(START, { type: "unread", status: 404 }).unread).toBe("gone");
    expect(reduce(START, { type: "unread", status: 403 }).unread).toBe("closed");
    expect(reduce(START, { type: "unread", status: 500 }).unread).toBeNull();
  });
});

describe("the page's state", () => {
  it("follows the take and the cut (§5.1)", () => {
    expect(pageStateOf(START, null)).toBe("loading");
    expect(pageStateOf(reduce(START, { type: "unread", status: 404 }), null)).toBe("not here");
    expect(pageStateOf(reduce(START, { type: "unread", status: 403 }), null)).toBe("closed");
    const uploading = read(viewOf({ take: take("uploading"), head: null, shown: null, edit: null, turns: [] }));
    expect(pageStateOf(uploading, { status: "sending" })).toBe("getting ready");
    expect(pageStateOf(uploading, null)).toBe("upload stopped");
    expect(pageStateOf(uploading, { status: "failed" })).toBe("upload stopped");
    expect(pageStateOf(read(waiting), null)).toBe("getting ready");
    expect(pageStateOf(read(viewOf({ take: take("failed"), head: null, shown: null, edit: null, turns: [] })), null)).toBe("take failed");
    expect(pageStateOf(read(viewOf({ head: null, shown: null, edit: null, turns: [] })), null)).toBe("cutting");
    expect(pageStateOf(read(), null)).toBe("ready");
    const exporting = viewOf({ export: { job: "j", turn: 1, status: "running", stage: "drawing", progress: 0.4, error: null, filmUrl: null, ms: null } });
    expect(pageStateOf(read(exporting), null)).toBe("exporting");
  });

  it("asks for the first cut only for a ready take with no turn, nothing out and nothing wrong", () => {
    const ready = read(viewOf({ head: null, shown: null, edit: null, turns: [] }));
    expect(wantsFirstCut(ready)).toBe(true);
    expect(wantsFirstCut(read(waiting))).toBe(false);
    expect(wantsFirstCut(read())).toBe(false);
    expect(wantsFirstCut(reduce(ready, { type: "start", working: { what: "cut", look: { kind: "house" } } }))).toBe(false);
  });
});

describe("the controls and the chips", () => {
  it("are on with a cut, while nothing is out and nothing is exported", () => {
    expect(controlsOf(read(viewOf({ undo: 1, redo: null })))).toEqual({ ask: true, tools: true, undo: true, redo: false, exportOn: true, exporting: false });
    expect(controlsOf(reduce(read(), { type: "start", working: { what: "ops" } })).ask).toBe(false);
    const exporting = viewOf({ undo: 1, export: { job: "j", turn: 1, status: "queued", stage: null, progress: 0, error: null, filmUrl: null, ms: null } });
    expect(controlsOf(read(exporting))).toEqual({ ask: false, tools: false, undo: false, redo: false, exportOn: false, exporting: true });
  });

  it("offer what to check first, a video's style when ready, then the fixed next steps, four at most (§5.3)", () => {
    const finding = { code: "on-face" as const, severity: "error" as const, where: { frame: 30 }, says: "the captions cover the face" };
    const found = viewOf({ turns: [{ n: 1, kind: "cut", request: "house", at: null, say: "Captions are on.", doc: true, findings: [finding, finding] }] });
    expect(chipsOf(found, false).map(chipLabel)).toEqual(["2 to check", "Shorter", "Bigger captions", "Add zooms"]);
    expect(chipsOf(found, true).map(chipLabel)).toEqual(["2 to check", "Use that style", "Shorter", "Bigger captions"]);
    expect(chipsOf(viewOf(), false).map(chipLabel)).toEqual(["Shorter", "Bigger captions", "Add zooms"]);
    expect(chipsOf(waiting, false)).toEqual([]);
  });
});

describe("the playhead after the edit changes", () => {
  it("stands a first cut half a second in, still", () => {
    expect(playheadAfter(null, FIRST, 0, "turn")).toEqual({ frame: STILL, play: false, still: true });
  });

  it("goes to just before where a change starts and plays it", () => {
    const fixed = changed(FIRST, [{ op: "word.set", asset: ASSET.id, index: 4, text: "start" }]);
    expect(playheadAfter(FIRST, fixed, 200, "turn")).toEqual({ frame: 45 - LEAD_IN, play: true, still: false });
    expect(playheadAfter(FIRST, fixed, 200, "move")).toEqual({ frame: 45 - LEAD_IN, play: false, still: false });
  });

  it("stays where it was when the whole film changed, or at the start when its frame is gone", () => {
    const mono = changed(FIRST, [{ op: "look.set", preset: "mono" }]);
    expect(playheadAfter(FIRST, mono, 200, "turn")).toEqual({ frame: 200, play: false, still: false });
    const short = changed(mono, [{ op: "shot.trim", id: "s1", endMs: 3000 }]);
    expect(playheadAfter(mono, short, filmFrames(mono) - 1, "turn").frame).toBe(Math.max(0, filmFrames(short) - 30 - LEAD_IN));
  });
});

describe("a look as a cut asks for it", () => {
  it("is a body and a key", () => {
    expect(styleBody({ kind: "house" })).toEqual({});
    expect(styleBody({ kind: "preset", id: "clean" })).toEqual({ style: { preset: "clean" } });
    expect(styleBody({ kind: "words", words: "calm" })).toEqual({ style: { words: "calm" } });
    expect(styleBody({ kind: "video", style: { a: 1 } })).toEqual({ style: { a: 1 } });
    expect(lookKeyOfStyle({ kind: "preset", id: "clean" })).toBe("clean");
    expect(lookKeyOfStyle({ kind: "video", style: null })).toBe("video");
  });
});
```

`src/components/editor/__tests__/use-edit.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * use-edit.test.tsx — the editor page's calls (plan 2026-11-24-editor-screens-a, Task 10): the edit read and read again while it
 * waits, the first cut asked for by the page in the look picked meanwhile, a change and its failure, Undo, one call at a time,
 * and a video's style read in the background and used. The network is stood in with the routes' own answers (views of real
 * edits); the reducer, the hook and the style reader are real.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditView } from "@/lib/edit/edit-view";
import { useEdit } from "../use-edit";
import { EDIT_ID, viewOf } from "./views";

type Answer = { status: number; body: unknown };
interface Asked {
  call: string;
  body: unknown;
}

function network(answers: Record<string, Answer[]>, keep: Record<string, Answer> = {}): Asked[] {
  const asked: Asked[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = `${init?.method ?? "GET"} ${String(input)}`;
    asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = answers[call]?.shift() ?? keep[call];
    if (!next) throw new Error(`no answer for ${call}`);
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  }));
  return asked;
}
const base = `/api/edit/edits/${EDIT_ID}`;
const ok = (view: EditView): Answer => ({ status: 200, body: view });
const noCut = (status = "ready") => viewOf({ take: { ...viewOf().take, status }, head: null, shown: null, edit: null, turns: [] });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useEdit", () => {
  it("reads the edit while its take is analysed, then asks for the first cut itself, in the look picked meanwhile", async () => {
    // The second read waits until the look is picked, so the test does not race the poll.
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => (ready = resolve));
    let reads = 0;
    const cuts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      if (call === `GET ${base}`) {
        reads += 1;
        if (reads > 1) await gate;
        return new Response(JSON.stringify(reads === 1 ? noCut("analysing") : noCut("ready")), { status: 200 });
      }
      if (call === `POST ${base}/cut`) {
        cuts.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify(viewOf({ look: "clean" })), { status: 200 });
      }
      throw new Error(`no answer for ${call}`);
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("getting ready"));
    act(() => result.current.setWaitLook({ kind: "preset", id: "clean" }));
    ready();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(cuts).toEqual([{ style: { preset: "clean" } }]);
  });

  it("keeps a failed change's request, and Try again asks it again", async () => {
    const asked = network({
      [`GET ${base}`]: [ok(viewOf())],
      [`POST ${base}/change`]: [{ status: 500, body: { error: "something went wrong" } }, ok(viewOf({ head: 2 }))],
    });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      expect(await result.current.ask("Shorter")).toBe(false);
    });
    expect(result.current.session.problem).toEqual({ text: "Something went wrong.", request: "Shorter" });
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.session.view?.head).toBe(2));
    expect(asked.filter((one) => one.call === `POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Shorter" }, { request: "Shorter" }]);
  });

  it("sends one call at a time, and moves the head for Undo", async () => {
    let answerChange!: () => void;
    const held = new Promise<void>((resolve) => (answerChange = resolve));
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (call === `POST ${base}/change`) await held;
      const view = call === `POST ${base}/head` ? viewOf({ head: 1, undo: null, redo: 2 }) : viewOf({ head: 2, undo: 1 });
      return new Response(JSON.stringify(view), { status: 200 });
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    let first!: Promise<boolean>;
    act(() => {
      first = result.current.ask("Shorter");
    });
    await act(async () => {
      expect(await result.current.ops([{ op: "captions.set", on: false }])).toBe(false);
    });
    answerChange();
    await act(async () => {
      await first;
    });
    await act(async () => {
      await result.current.move(1);
    });
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/change`, `POST ${base}/head`]);
    expect(result.current.session).toMatchObject({ moved: "move", view: { head: 1, redo: 2 } });
  });

  it("reads a video's style in the background and cuts in it when asked", async () => {
    const STYLE = { source: { kind: "reference", name: null } };
    const REF = "77777777-7777-4777-8777-777777777777";
    const asked = network({
      [`GET ${base}`]: [ok(viewOf())],
      ["POST /api/edit/references"]: [{ status: 202, body: { id: REF } }],
      [`GET /api/edit/references/${REF}`]: [{ status: 200, body: { status: "ready", style: STYLE, judged: true } }],
      [`POST ${base}/cut`]: [ok(viewOf({ head: 2, look: "video" }))],
    });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    act(() => result.current.readVideo({ link: "https://www.tiktok.com/@someone/video/7300000000000000000" }));
    expect(result.current.reading.status).toBe("reading");
    expect(result.current.controls.ask).toBe(true);
    await waitFor(() => expect(result.current.reading.status).toBe("ready"));
    await act(async () => result.current.applyVideoStyle());
    expect(asked.find((one) => one.call === `POST ${base}/cut`)?.body).toEqual({ style: STYLE });
    expect(result.current.reading.status).toBe("idle");
  });

  it("reads a refusal as not here, or closed", async () => {
    network({ [`GET ${base}`]: [{ status: 404, body: { error: "no such edit" } }] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("not here"));
  });
});
```

- [ ] Step 2: Run them, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/edit-session.test.ts src/components/editor/__tests__/use-edit.test.tsx` → `Failed to resolve import "../edit-session"` (and `../use-edit`).

- [ ] Step 3: Implement.

`src/components/editor/edit-session.ts`:

```ts
/**
 * edit-session.ts — the editor page's own state (spec 2026-11-24-editor-screens-design.md §5.1-5.3; plan
 * 2026-11-24-editor-screens-a, Task 10): the edit as last read from its routes, the call that is out, the one problem shown, the
 * look picked while the take gets ready, and what moved the edit last. Ported from the dev page's `session.ts`: what that page
 * held itself (the turns, undo) the server holds now, and every route that changes the edit answers it whole, so an answer
 * replaces the view. While a call is out nothing else moves and a poll's answer is not taken. Also, pure: the page's state,
 * which controls are on, the chips under the latest answer, where the playhead goes after a change, a look as a cut's body.
 */
import { filmFrames, type Edit } from "@/lib/edit";
import { firstChangedFrame } from "@/lib/edit/changed";
import { LIVE_JOB, type EditView } from "@/lib/edit/edit-view";
import { NEXT_ASKS } from "@/lib/edit/said";
import type { Upload } from "./uploads";

/** A look as the creator picks it: ours, a preset, words, or a video's style read already. */
export type CutStyle = { kind: "house" } | { kind: "preset"; id: string } | { kind: "words"; words: string } | { kind: "video"; style: unknown };

/** The call that is out. */
export type Working =
  | { what: "cut"; look: CutStyle }
  | { what: "change"; request: string }
  | { what: "ops" }
  | { what: "move"; to: number }
  | { what: "export" }
  | { what: "cancel" }
  | { what: "take" };

export interface Session {
  view: EditView | null;
  /** The read was refused: no such edit of theirs (404), or the editor is not open to them (403). */
  unread: "gone" | "closed" | null;
  working: Working | null;
  /** One plain sentence; and the request it was about when a change failed, so it is not lost. */
  problem: { text: string; request: string | null } | null;
  /** The look picked while the take gets ready, sent with the first cut. */
  waitLook: CutStyle;
  /** What moved the edit last: a turn (played from where it changed) or a move (Undo, Redo). */
  moved: "turn" | "move" | null;
}

export const START: Session = { view: null, unread: null, working: null, problem: null, waitLook: { kind: "house" }, moved: null };

export type Action =
  | { type: "read"; view: EditView }
  | { type: "unread"; status: number }
  | { type: "start"; working: Working }
  | { type: "answered"; view: EditView }
  | { type: "failed"; text: string }
  | { type: "wait look"; look: CutStyle }
  | { type: "dismiss" };

const TURNS: ReadonlySet<Working["what"]> = new Set(["cut", "change", "ops"]);

export function reduce(session: Session, action: Action): Session {
  switch (action.type) {
    case "read":
      return session.working ? session : { ...session, view: action.view, unread: null };
    case "unread":
      if (session.working) return session;
      if (action.status === 404) return { ...session, unread: "gone" };
      if (action.status === 403) return { ...session, unread: "closed" };
      return session;
    case "start":
      return session.working ? session : { ...session, working: action.working, problem: null };
    case "answered": {
      if (!session.working) return session;
      const moved = session.working.what === "move" ? "move" : TURNS.has(session.working.what) ? "turn" : session.moved;
      return { ...session, view: action.view, working: null, problem: null, moved };
    }
    case "failed":
      if (!session.working) return session;
      return { ...session, working: null, problem: { text: action.text, request: session.working.what === "change" ? session.working.request : null } };
    case "wait look":
      return { ...session, waitLook: action.look };
    case "dismiss":
      return session.problem ? { ...session, problem: null } : session;
  }
}

export type PageState = "loading" | "not here" | "closed" | "getting ready" | "upload stopped" | "cutting" | "ready" | "exporting" | "take failed";

/** The page's state (§5.1). `upload` is the holder's upload of the take, null when none is held (a reload). */
export function pageStateOf(session: Session, upload: Pick<Upload, "status"> | null): PageState {
  if (session.unread === "gone") return "not here";
  if (session.unread === "closed") return "closed";
  const view = session.view;
  if (!view) return "loading";
  if (view.export && LIVE_JOB.has(view.export.status)) return "exporting";
  if (view.shown !== null) return "ready";
  switch (view.take.status) {
    case "failed":
      return "take failed";
    case "uploading":
      return upload && upload.status !== "failed" ? "getting ready" : "upload stopped";
    case "analysing":
      return "getting ready";
    default:
      return "cutting";
  }
}

/** Whether the page asks for the first cut now (E2): the take is ready, there is no turn, nothing is out, nothing went wrong. */
export function wantsFirstCut(session: Session): boolean {
  const view = session.view;
  return view !== null && view.take.status === "ready" && view.head === null && session.working === null && session.problem === null;
}

export interface Controls {
  /** The field, its send and the chips. */
  ask: boolean;
  /** Look and Captions. */
  tools: boolean;
  undo: boolean;
  redo: boolean;
  /** Export, or the Ready sheet of the export made. */
  exportOn: boolean;
  /** The export is being made: the tools and the field rest, the video can be watched (E20). */
  exporting: boolean;
}

export function controlsOf(session: Session): Controls {
  const view = session.view;
  const exporting = !!view?.export && LIVE_JOB.has(view.export.status);
  const on = !!view && view.shown !== null && session.working === null && !exporting;
  return { ask: on, tools: on, undo: on && view?.undo != null, redo: on && view?.redo != null, exportOn: on, exporting };
}

export type NextChip = { kind: "check"; count: number } | { kind: "style" } | { kind: "ask"; text: string };

/** The chips under the latest answer (§5.3): what to check, a video's style once read, the fixed next steps; four at most. */
export function chipsOf(view: EditView | null, styleReady: boolean): NextChip[] {
  if (!view || view.shown === null) return [];
  const count = view.turns.at(-1)?.findings.length ?? 0;
  const chips: NextChip[] = [
    ...(count > 0 ? [{ kind: "check" as const, count }] : []),
    ...(styleReady ? [{ kind: "style" as const }] : []),
    ...NEXT_ASKS.map((text) => ({ kind: "ask" as const, text })),
  ];
  return chips.slice(0, 4);
}

export function chipLabel(chip: NextChip): string {
  return chip.kind === "check" ? `${chip.count} to check` : chip.kind === "style" ? "Use that style" : chip.text;
}

/** Where a first cut stands until it is played: half a second in, where its label and first captions are on (the dev page's). */
export const STILL = 15;
/** How far before a change the video starts, so the change is seen arriving. */
export const LEAD_IN = 15;

export interface Playhead {
  frame: number;
  play: boolean;
  /** A first cut standing still: it plays from its start when it is first played. */
  still: boolean;
}

/**
 * Where the playhead goes when the edit shown becomes `now` (§5.2): a first cut stands half a second in; a turn goes to just
 * before where it changed the film and plays it; a move goes there and waits; when the whole film changed (a look) the playhead
 * stays where it was, at the start when that frame is gone.
 */
export function playheadAfter(was: Edit | null, now: Edit, at: number, moved: "turn" | "move" | null): Playhead {
  const frames = filmFrames(now);
  if (was === null) return { frame: Math.min(STILL, frames - 1), play: false, still: true };
  const change = firstChangedFrame(was, now);
  if (change === null) return { frame: at < frames ? at : 0, play: false, still: false };
  return { frame: Math.max(0, change - LEAD_IN), play: moved === "turn", still: false };
}

/** A look as the cut's body (`POST …/cut`). */
export function styleBody(look: CutStyle): { style?: unknown } {
  switch (look.kind) {
    case "house":
      return {};
    case "preset":
      return { style: { preset: look.id } };
    case "words":
      return { style: { words: look.words } };
    case "video":
      return { style: look.style };
  }
}

/** A look's key, as the edit keeps it (`house`, a preset's id, `words`, `video`): which look is picked. */
export function lookKeyOfStyle(look: CutStyle): string {
  return look.kind === "house" ? "house" : look.kind === "preset" ? look.id : look.kind;
}
```

`src/components/editor/use-edit.ts`:

```ts
"use client";

/**
 * use-edit.ts — the editor page's calls around its reducer (spec 2026-11-24-editor-screens-design.md §5.2, §7, E2, E22; plan
 * 2026-11-24-editor-screens-a, Task 10). The edit is read, and read again every `pollMs` while the take uploads or is analysed,
 * while its export runs, and every three seconds while a first cut someone else holds is awaited. The first cut is asked for by
 * the page itself, once, when it reads a ready take and no turn, in the look picked meanwhile. The creator's calls (a cut, a
 * change, a word or the captions, Undo and Redo, the export and giving it up, another take) go one at a time; each answer
 * replaces the view, each refusal is one sentence. A video's style is read in the background ("Like a video") while the edit
 * stays usable, and offered when it is ready.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Op } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { START, controlsOf, pageStateOf, reduce, styleBody, wantsFirstCut, type Controls, type CutStyle, type PageState, type Session, type Working } from "./edit-session";
import { call, problemOf } from "./net";
import { readStyle, type Source } from "./read-style";
import { sendTake } from "./take-file";
import { retryUpload, useUpload, type Upload } from "./uploads";

/** How often a waiting edit is read again; and while a first cut held by another call is awaited. */
const POLL_MS = 1500;
const HELD_POLL_MS = 3000;

export interface StyleRead {
  status: "idle" | "reading" | "ready" | "failed";
  line: string | null;
  share: number | null;
  problem: string | null;
  style: unknown;
}
const NO_READ: StyleRead = { status: "idle", line: null, share: null, problem: null, style: null };

export interface EditApi {
  session: Session;
  state: PageState;
  controls: Controls;
  upload: Upload | null;
  reading: StyleRead;
  setWaitLook(look: CutStyle): void;
  cut(look: CutStyle): Promise<boolean>;
  ask(request: string): Promise<boolean>;
  ops(list: Op[]): Promise<boolean>;
  move(n: number): Promise<boolean>;
  startExport(): Promise<boolean>;
  cancelExport(): Promise<boolean>;
  replaceTake(file: File): Promise<void>;
  /** Try again: the upload, the first cut, or the change that failed. */
  retry(): void;
  readVideo(source: Source): void;
  applyVideoStyle(): Promise<void>;
  dismiss(): void;
}

export function useEdit(id: string, { pollMs = POLL_MS }: { pollMs?: number } = {}): EditApi {
  const [session, dispatch] = useReducer(reduce, START);
  const [reads, setReads] = useState(0);
  const [reading, setReading] = useState<StyleRead>(NO_READ);
  const upload = useUpload(session.view?.take.id ?? null);
  const state = pageStateOf(session, upload);
  const base = `/api/edit/edits/${id}`;

  // The edit, read when the page opens and again each time `reads` is counted up.
  useEffect(() => {
    let stopped = false;
    void call<EditView>(base).then((answer) => {
      if (stopped) return;
      if (answer.ok) dispatch({ type: "read", view: answer.body });
      else dispatch({ type: "unread", status: answer.status });
    });
    return () => {
      stopped = true;
    };
  }, [base, reads]);

  // Read again while it waits: armed anew by each view read.
  const held = state === "cutting" && session.working === null && session.problem !== null;
  const polling = state === "getting ready" || state === "exporting" || held;
  useEffect(() => {
    if (!polling) return;
    const timer = setTimeout(() => setReads((n) => n + 1), held ? Math.max(pollMs, HELD_POLL_MS) : pollMs);
    return () => clearTimeout(timer);
  }, [polling, held, pollMs, session.view]);

  // One call at a time: the reducer refuses a second `start`, and this refuses to send it.
  const out = useRef(false);
  const run = useCallback(async (working: Working, path: string, body: unknown, method?: "POST" | "DELETE"): Promise<boolean> => {
    if (out.current) return false;
    out.current = true;
    dispatch({ type: "start", working });
    const answer = await call<EditView>(path, body, method);
    out.current = false;
    if (answer.ok) dispatch({ type: "answered", view: answer.body });
    else dispatch({ type: "failed", text: problemOf(answer) });
    return answer.ok;
  }, []);

  const cut = useCallback((look: CutStyle) => run({ what: "cut", look }, `${base}/cut`, styleBody(look)), [run, base]);
  const ask = useCallback((request: string) => run({ what: "change", request }, `${base}/change`, { request }), [run, base]);
  const ops = useCallback((list: Op[]) => run({ what: "ops" }, `${base}/ops`, { ops: list }), [run, base]);
  const move = useCallback((n: number) => run({ what: "move", to: n }, `${base}/head`, { n }), [run, base]);
  const startExport = useCallback(() => run({ what: "export" }, `${base}/export`, {}), [run, base]);
  const cancelExport = useCallback(() => run({ what: "cancel" }, `${base}/export`, undefined, "DELETE"), [run, base]);

  // The first cut, asked for by the page itself (E2), once: a failed one waits for Try again.
  const askedFirst = useRef(false);
  useEffect(() => {
    if (askedFirst.current || !wantsFirstCut(session)) return;
    askedFirst.current = true;
    void cut(session.waitLook);
  }, [session, cut]);

  const replaceTake = useCallback(async (file: File) => {
    if (out.current) return;
    out.current = true;
    dispatch({ type: "start", working: { what: "take" } });
    const sent = await sendTake(file);
    const answer = sent.ok ? await call<EditView>(`${base}/take`, { take: sent.takeId }) : null;
    out.current = false;
    if (!sent.ok) return dispatch({ type: "failed", text: sent.problem });
    if (answer?.ok) dispatch({ type: "answered", view: answer.body });
    else if (answer) dispatch({ type: "failed", text: problemOf(answer) });
  }, [base]);

  const retry = useCallback(() => {
    if (state === "upload stopped" && upload?.status === "failed") return retryUpload(upload.takeId);
    const problem = session.problem;
    if (!problem) return;
    dispatch({ type: "dismiss" });
    if (problem.request !== null) void ask(problem.request);
    else if (state === "cutting") void cut(session.waitLook);
  }, [state, upload, session.problem, session.waitLook, ask, cut]);

  // "Like a video": read in the background, stopped by another read or by leaving the page; nothing read late is applied.
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);
  const readVideo = useCallback((source: Source) => {
    stop.current?.abort();
    const control = new AbortController();
    stop.current = control;
    setReading({ ...NO_READ, status: "reading", line: "Getting the video…" });
    void readStyle(source, (progress) => {
      if (!control.signal.aborted) setReading((now) => ({ ...now, line: progress.stage, share: progress.share }));
    }, { signal: control.signal }).then((read) => {
      if (control.signal.aborted || "stopped" in read) return;
      setReading(read.ok ? { ...NO_READ, status: "ready", style: read.style } : { ...NO_READ, status: "failed", problem: read.problem });
    });
  }, []);
  const applyVideoStyle = useCallback(async () => {
    if (reading.status !== "ready") return;
    if (await cut({ kind: "video", style: reading.style })) setReading(NO_READ);
  }, [reading, cut]);

  return {
    session, state, controls: controlsOf(session), upload, reading,
    setWaitLook: (look) => dispatch({ type: "wait look", look }),
    cut, ask, ops, move, startExport, cancelExport, replaceTake, retry, readVideo, applyVideoStyle,
    dismiss: () => dispatch({ type: "dismiss" }),
  };
}
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/edit-session.test.ts src/components/editor/__tests__/use-edit.test.tsx && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/`.

- [ ] Step 5: Commit: `git add src/components/editor/edit-session.ts src/components/editor/use-edit.ts src/components/editor/__tests__/edit-session.test.ts src/components/editor/__tests__/use-edit.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(editor): the page's state and its calls" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 11: The stage and the scrubber

**Files:**
- Create: `src/components/editor/editor-icons.tsx`, `src/components/editor/editor-stage.tsx`, `src/components/editor/editor-scrubber.tsx`
- Test: `src/components/editor/__tests__/editor-stage.test.tsx`

**Interfaces:** Consumes: `EditPlayer` (`src/edit/player/EditPlayer.tsx`: props `edit`, `kit`, `urls`, `controls?`, `spaceKeyToPlayOrPause?`, `style?`; ref `PlayerRef`), `PlayerRef` methods `seekTo`, `play`, `pause`, `toggle`, `mute`, `unmute`, `isMuted`, `addEventListener("frameupdate" | "play" | "pause" | "mutechange")` (`node_modules/@remotion/player/dist/cjs/player-methods.d.ts`, `event-emitter.d.ts`, 4.0.545); `FPS`; `timecode` (`src/lib/result/format.ts`); `ShellIcon`, `ShellIconProps` (`src/components/shell/icons.tsx`); fixtures `ASSET`, `FIRST`, `changed` (Task 4). Produces:
- `editor-icons.tsx`: `UndoIcon`, `RedoIcon`, `PlayIcon`, `SoundIcon`, `MutedIcon`, `LookIcon`, `CaptionsIcon`, `LinkIcon`, `QuoteIcon`, `SaveIcon`, `ChevronRightIcon` (all `ShellIcon`, 20-unit box).
- `editor-stage.tsx`: `interface StageHandle { seek(frame: number): void; play(): void; pause(): void }`; `EditorStage` (forwardRef) with props `{ edit: Edit | null; urls: Record<string, string>; source: string | null; poster: string | null; onFrame(frame: number): void; onFrames?(frames: number): void; onPlay?(): void; className?: string }`.
- `editor-scrubber.tsx`: `frameAtPointer(x: number, left: number, width: number, frames: number): number`; `EditorScrubber({ frames, frame, marks, disabled?, onSeek })`.

Found out before the plan was written (a throwaway test against the real `EditPlayer` in happy-dom): with `controls={false}` the Player draws no button of its own; `seekTo(30)` moves it, `getCurrentFrame()` reads 30 and `frameupdate` fires with 30; `mute()` makes `isMuted()` true. A cut with captions logs a `measureText` error in happy-dom (no font is loaded there), so the tests use an edit with captions off.

- [ ] Step 1: Write the failing test `src/components/editor/__tests__/editor-stage.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * editor-stage.test.tsx — the video and its scrubber (plan 2026-11-24-editor-screens-a, Task 11; spec E8, E19): the device's own
 * copy plays at once before the cut; after it the real Player plays the edit with its controls off and ours over it; a tap plays
 * and pauses, the mute button mutes, the handle seeks; the scrubber seeks where it is pressed, with a ring at each thing to
 * check. What happy-dom lacks as a browser is stood in: fonts, the media element's play, a box's size.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorScrubber, frameAtPointer } from "../editor-scrubber";
import { EditorStage, type StageHandle } from "../editor-stage";
import { ASSET, FIRST, changed } from "./views";

/** No captions: happy-dom loads no font to measure them with. */
const QUIET = changed(FIRST, [{ op: "captions.set", on: false }]);

class NoFontFace {
  constructor(readonly family: string) {}
  load = async () => this;
}
beforeAll(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: () => {}, ready: Promise.resolve() } });
});
beforeEach(() => {
  vi.stubGlobal("FontFace", NoFontFace);
  vi.stubGlobal("fetch", async () => new Response(new ArrayBuffer(8)));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the stage before the cut", () => {
  it("plays the device's own copy at once, with our controls over it", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const onFrame = vi.fn();
    const onFrames = vi.fn();
    render(<EditorStage edit={null} urls={{}} source="blob:local/1" poster={null} onFrame={onFrame} onFrames={onFrames} />);
    const video = document.querySelector("video")!;
    expect(video).toHaveAttribute("src", "blob:local/1");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalled();
    fireEvent.play(video);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    Object.defineProperty(video, "duration", { configurable: true, value: 12.7 });
    fireEvent.loadedMetadata(video);
    expect(onFrames).toHaveBeenCalledWith(381);
    Object.defineProperty(video, "currentTime", { configurable: true, value: 2 });
    fireEvent.timeUpdate(video);
    expect(onFrame).toHaveBeenLastCalledWith(60);
  });

  it("shows the take's picture, and no control, while there is nothing to play", () => {
    render(<EditorStage edit={null} urls={{}} source={null} poster="https://media.test/poster.jpg" onFrame={() => {}} />);
    expect(document.querySelector("img")).toHaveAttribute("src", "https://media.test/poster.jpg");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the stage after the cut", () => {
  it("plays the edit in the Player with its controls off and ours over it; it seeks and mutes", async () => {
    const handle = createRef<StageHandle>();
    const onFrame = vi.fn();
    render(<EditorStage ref={handle} edit={QUIET} urls={{ [ASSET.id]: "https://media.test/preview.mp4" }} source={null} poster={null} onFrame={onFrame} />);
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Play", "Mute"]);
    await act(async () => handle.current!.seek(30));
    expect(onFrame).toHaveBeenLastCalledWith(30);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mute" })));
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });
});

describe("the scrubber", () => {
  it("is a slider of the film's frames that seeks where it is pressed, with a ring at each thing to check", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[30, 200]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    expect(slider).toHaveAttribute("aria-valuenow", "60");
    expect(slider).toHaveAttribute("aria-valuemax", "380");
    expect(slider).toHaveAttribute("aria-valuetext", "0:02 of 0:13");
    expect(document.querySelectorAll("[data-part=mark]")).toHaveLength(2);
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({ left: 10, width: 380, top: 0, height: 44, right: 390, bottom: 44, x: 10, y: 0, toJSON: () => ({}) } as DOMRect);
    fireEvent.pointerDown(slider, { clientX: 200, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledWith(190);
  });

  it("reads the frame under a pointer, held to the track", () => {
    expect(frameAtPointer(10, 10, 380, 381)).toBe(0);
    expect(frameAtPointer(390, 10, 380, 381)).toBe(380);
    expect(frameAtPointer(999, 10, 380, 381)).toBe(380);
    expect(frameAtPointer(5, 0, 0, 381)).toBe(0);
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/editor-stage.test.tsx` → `Failed to resolve import "../editor-scrubber"`.

- [ ] Step 3: Implement.

`src/components/editor/editor-icons.tsx`:

```tsx
import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * editor-icons.tsx — the editor's glyphs (plan 2026-11-24-editor-screens-a, Task 11): the drawing's own paths
 * (`.scratch/editor/drawing/editor-v2.html`, `I`) on its 20 × 20 box, `currentColor`, 1.7 stroke, round caps and joins, sized
 * with `size` (20 unless told). Scissors and More live with the field's glyphs (`field-icons.tsx`), where Home's cards take them.
 */
function Glyph({ size = 20, children, ...props }: ShellIconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export const UndoIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M7.5 4.5 4 8l3.5 3.5" />
    <path d="M4 8h7.5a4 4 0 0 1 0 8H9" />
  </Glyph>
);

export const RedoIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M12.5 4.5 16 8l-3.5 3.5" />
    <path d="M16 8H8.5a4 4 0 0 0 0 8H11" />
  </Glyph>
);

export const PlayIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M6.5 4v12l10-6z" fill="currentColor" stroke="none" />
  </Glyph>
);

export const SoundIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M3 8v4h3l4 3.5v-11L6 8z" />
    <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5" />
  </Glyph>
);

export const MutedIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M3 8v4h3l4 3.5v-11L6 8z" />
    <path d="M13.5 8l4 4M17.5 8l-4 4" />
  </Glyph>
);

export const LookIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="10" cy="10" r="6.5" />
    <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" stroke="none" />
  </Glyph>
);

export const CaptionsIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="3" />
    <path d="M6 9.2h2.5M11 9.2h3M6 12h8" />
  </Glyph>
);

export const LinkIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1" />
  </Glyph>
);

export const QuoteIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M4 11.5c0-3 1.5-5 4-6M11 11.5c0-3 1.5-5 4-6" />
    <circle cx="6" cy="12.5" r="2" fill="currentColor" stroke="none" />
    <circle cx="13" cy="12.5" r="2" fill="currentColor" stroke="none" />
  </Glyph>
);

export const SaveIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />
  </Glyph>
);

export const ChevronRightIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M7.5 4.5 13 10l-5.5 5.5" />
  </Glyph>
);
```

`src/components/editor/editor-stage.tsx`:

```tsx
"use client";

import type { PlayerRef } from "@remotion/player";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditPlayer } from "@/edit/player/EditPlayer";
import { FPS, type Edit } from "@/lib/edit";
import { cn } from "@/lib/utils";
import { MutedIcon, PlayIcon, SoundIcon } from "./editor-icons";

/**
 * editor-stage.tsx — the video (spec 2026-11-24-editor-screens-design.md §5.2, E8, E19; plan 2026-11-24-editor-screens-a,
 * Task 11). Before the cut the browser's own `<video>` plays the device's copy (or the take's preview once it is ready), so the
 * take plays at once; after it the Player plays the edit (`EditPlayer`, kit `/edit`), its own controls off. Ours sit over both:
 * a tap plays and pauses, a play button in the middle while paused, a mute button in the corner (32 drawn, 44 to tap). The page
 * keeps one stage mounted across a resize (its layout is CSS), so the Player is never mounted again for a layout.
 */

export interface StageHandle {
  seek(frame: number): void;
  play(): void;
  pause(): void;
}

export interface StageProps {
  /** The edit shown; null before the first cut, when the take itself plays. */
  edit: Edit | null;
  /** The take's preview address by its id, for the Player. */
  urls: Record<string, string>;
  /** Before the cut: the device's own copy, or the take's preview once it is ready; null while there is neither. */
  source: string | null;
  poster: string | null;
  onFrame(frame: number): void;
  /** Before the cut: the take's length in frames once the browser has read it. */
  onFrames?(frames: number): void;
  /** It started playing. */
  onPlay?(): void;
  className?: string;
}

export const EditorStage = forwardRef<StageHandle, StageProps>(function EditorStage({ edit, urls, source, poster, onFrame, onFrames, onPlay, className }, handle) {
  const player = useRef<PlayerRef>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  useImperativeHandle(handle, () => ({
    seek: (frame) => {
      if (player.current) player.current.seekTo(frame);
      else if (video.current) video.current.currentTime = frame / FPS;
    },
    play: () => {
      if (player.current) player.current.play();
      else void video.current?.play().catch(() => undefined);
    },
    pause: () => {
      player.current?.pause();
      video.current?.pause();
    },
  }), []);

  // The Player's own events, from the moment it is mounted (the first cut) for as long as it is.
  const cut = edit !== null;
  useEffect(() => {
    const now = player.current;
    if (!now) return;
    const moved = (event: { detail: { frame: number } }) => onFrame(event.detail.frame);
    const played = () => {
      setPlaying(true);
      onPlay?.();
    };
    const paused = () => setPlaying(false);
    const muting = (event: { detail: { isMuted: boolean } }) => setMuted(event.detail.isMuted);
    now.addEventListener("frameupdate", moved);
    now.addEventListener("play", played);
    now.addEventListener("pause", paused);
    now.addEventListener("mutechange", muting);
    return () => {
      now.removeEventListener("frameupdate", moved);
      now.removeEventListener("play", played);
      now.removeEventListener("pause", paused);
      now.removeEventListener("mutechange", muting);
    };
  }, [cut, onFrame, onPlay]);

  const toggle = () => {
    if (player.current) return player.current.toggle();
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  };
  const toggleMute = () => {
    const now = player.current;
    if (now) {
      const next = !now.isMuted();
      if (next) now.mute();
      else now.unmute();
      return setMuted(next);
    }
    const element = video.current;
    if (!element) return;
    element.muted = !element.muted;
    setMuted(element.muted);
  };
  const playable = cut || source !== null;

  return (
    <div id="edit-stage" data-part="stage" data-cut={cut || undefined} className={cn("relative aspect-[9/16] overflow-hidden rounded-[22px] bg-scrim shadow-[var(--shadow-float)]", className)}>
      {cut ? (
        <EditPlayer ref={player} edit={edit} kit="/edit" urls={urls} controls={false} spaceKeyToPlayOrPause={false} style={{ height: "100%" }} />
      ) : source !== null ? (
        <video
          ref={video} src={source} poster={poster ?? undefined} playsInline preload="metadata"
          onTimeUpdate={(event) => onFrame(Math.round(event.currentTarget.currentTime * FPS))}
          onLoadedMetadata={(event) => {
            const seconds = event.currentTarget.duration;
            if (Number.isFinite(seconds)) onFrames?.(Math.round(seconds * FPS));
          }}
          onPlay={() => {
            setPlaying(true);
            onPlay?.();
          }}
          onPause={() => setPlaying(false)}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
          className="size-full object-cover"
        />
      ) : poster !== null ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed address of the creator's own poster, not an image of the app's
        <img src={poster} alt="" className="size-full object-cover" />
      ) : null}
      {playable && (
        <>
          <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className="absolute inset-0 z-[1] flex items-center justify-center">
            {!playing && (
              <span aria-hidden className="flex size-[58px] items-center justify-center rounded-full bg-scrim text-action-foreground dark:text-foreground [&_svg]:ml-[3px] [&_svg]:size-[26px]">
                <PlayIcon />
              </span>
            )}
          </button>
          {/* Placed by a wrapper: on touch `.tap-44` sets `position: relative` from unlayered CSS. */}
          <span className="absolute bottom-2.5 right-2.5 z-[2]">
            <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className="tap-44 flex size-8 items-center justify-center rounded-full bg-scrim text-action-foreground dark:text-foreground [&_svg]:size-4">
              {muted ? <MutedIcon /> : <SoundIcon />}
            </button>
          </span>
        </>
      )}
    </div>
  );
});
```

`src/components/editor/editor-scrubber.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { FPS } from "@/lib/edit";
import { timecode } from "@/lib/result/format";
import { cn } from "@/lib/utils";

/**
 * editor-scrubber.tsx — one scrubber (spec E8; plan 2026-11-24-editor-screens-a, Task 11; drawing `.scrub`): a 4 tall track, the
 * part played in ink, the playhead (14, ringed in the ground), a ring at each thing to check, and under it where the playhead is
 * and how long the film is. It is a slider of the film's frames, 44 tall to press; a press or a drag seeks there. Its keys are
 * Task 17's.
 */

/** The frame under a pointer at `x`, on a track from `left`, `width` wide; held to the track. */
export function frameAtPointer(x: number, left: number, width: number, frames: number): number {
  if (width <= 0 || frames <= 1) return 0;
  return Math.round(Math.min(1, Math.max(0, (x - left) / width)) * (frames - 1));
}

export interface ScrubberProps {
  frames: number;
  frame: number;
  /** The film frames of the things to check. */
  marks: readonly number[];
  disabled?: boolean;
  onSeek(frame: number): void;
}

export function EditorScrubber({ frames, frame, marks, disabled = false, onSeek }: ScrubberProps) {
  const track = useRef<HTMLDivElement>(null);
  const last = Math.max(1, frames - 1);
  const share = (at: number) => `${(Math.min(Math.max(at, 0), last) / last) * 100}%`;
  const seekTo = (x: number) => {
    const box = track.current?.getBoundingClientRect();
    if (box) onSeek(frameAtPointer(x, box.left, box.width, frames));
  };
  return (
    <div data-part="scrubber" className="w-full px-0.5">
      <div
        ref={track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={frame}
        aria-valuetext={`${timecode(frame / FPS)} of ${timecode(frames / FPS)}`}
        aria-disabled={disabled || undefined}
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          seekTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!disabled && event.buttons === 1) seekTo(event.clientX);
        }}
        className={cn("relative flex h-11 touch-none items-center", disabled ? "cursor-default" : "cursor-pointer")}
      >
        <div className="relative h-1 w-full rounded-full bg-surface-sunken">
          <div className="absolute inset-y-0 left-0 rounded-full bg-action" style={{ width: share(frame) }} />
          {marks.map((mark) => (
            <span
              key={mark} data-part="mark" aria-hidden
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.7px] border-foreground-secondary bg-background"
              style={{ left: share(mark) }}
            />
          ))}
          <span aria-hidden className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-action shadow-[0_0_0_3px_var(--color-background)]" style={{ left: share(frame) }} />
        </div>
      </div>
      <div aria-hidden className="-mt-2 flex justify-between text-label text-foreground-muted tabular-nums">
        <span>{timecode(frame / FPS)}</span>
        <span>{timecode(frames / FPS)}</span>
      </div>
    </div>
  );
}
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/editor-stage.test.tsx && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/`.

- [ ] Step 5: Commit: `git add src/components/editor/editor-icons.tsx src/components/editor/editor-stage.tsx src/components/editor/editor-scrubber.tsx src/components/editor/__tests__/editor-stage.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(editor): the stage and the scrubber, our controls over the take and the Player" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 12: The conversation, the chips, the things to check, and the field

**Files:**
- Create: `src/components/editor/editor-thread.tsx`, `src/components/editor/editor-field.tsx`
- Test: `src/components/editor/__tests__/editor-thread.test.tsx`

**Interfaces:** Consumes: `TurnShown` (Task 4); `type Finding` (`src/lib/edit/review.ts`); `lookName` (Task 3); `chipLabel`, `type NextChip` (Task 10); `sentence` (Task 9); `Chip` (`src/components/ui/chip.tsx`, `surface="card"`); `Button` (`src/components/ui/button.tsx`, `variant="primary" size="sm" loading`); `SendIcon` (`field-icons.tsx`); `timecode`, `FPS`. Produces:
- `editor-thread.tsx`: `requestOf(turn: TurnShown): string | null`; `EditorThread(props: ThreadProps)` with `interface ThreadProps { turns: readonly TurnShown[]; pending: string | null; undoable: boolean; onUndo(): void; chips: readonly NextChip[]; onChip(chip: NextChip): void; checking: boolean; findings: readonly Finding[]; onShow(frame: number): void; problem: { text: string; again: (() => void) | null } | null; disabled: boolean }`; the list of things to check has the id `edit-checks`.
- `editor-field.tsx`: `MOST_REQUEST = 500`; `interface FieldHandle { focus(): void; focused(): boolean }`; `EditorField` (forwardRef) with props `{ text: string; onText(text: string): void; onSend(request: string): void; disabled: boolean; sending: boolean }`.

- [ ] Step 1: Write the failing test `src/components/editor/__tests__/editor-thread.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * editor-thread.test.tsx — the conversation and the field (plan 2026-11-24-editor-screens-a, Task 12; spec §3 screens 3-5, §5.3,
 * §5.4): the first cut's line with no request above it, a look asked for, a request and its answer with Undo on it, a request
 * out, the chips, "N to check" opening the list with "Show", a failure with Try again; the field sends on Enter, not on
 * Shift+Enter, and not while off.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TurnShown } from "@/lib/edit/edit-view";
import type { Finding } from "@/lib/edit/review";
import { EditorField } from "../editor-field";
import { EditorThread, requestOf, type ThreadProps } from "../editor-thread";

const FINDING: Finding = { code: "on-face", severity: "error", where: { frame: 180 }, says: "the captions cover the face" };
const TURNS: TurnShown[] = [
  { n: 1, kind: "cut", request: "house", at: null, say: "Cut from 12.7 to 11.3 seconds. Captions and a label are on.", doc: true, findings: [] },
  { n: 2, kind: "cut", request: "clean", at: null, say: "Captions and a label are on.", doc: true, findings: [] },
  { n: 3, kind: "change", request: "Zoom in here", at: null, say: "Zoomed in from 0:06 to 0:08.", doc: true, findings: [FINDING] },
];
const props = (more: Partial<ThreadProps> = {}): ThreadProps => ({
  turns: TURNS, pending: null, undoable: true, onUndo: vi.fn(), chips: [{ kind: "check", count: 1 }, { kind: "ask", text: "Shorter" }], onChip: vi.fn(),
  checking: false, findings: [FINDING], onShow: vi.fn(), problem: null, disabled: false, ...more,
});

afterEach(cleanup);

describe("the conversation", () => {
  it("shows what was asked and what was said, the first cut with no request, a look by its name", () => {
    expect(TURNS.map(requestOf)).toEqual([null, "Look: Clean", "Zoom in here"]);
    render(<EditorThread {...props()} />);
    const turns = within(screen.getByRole("region", { name: "Your edit's changes" })).getAllByRole("listitem");
    expect(turns.map((turn) => turn.textContent)).toEqual([
      "Cut from 12.7 to 11.3 seconds. Captions and a label are on.",
      "Look: CleanCaptions and a label are on.",
      "Zoom in hereZoomed in from 0:06 to 0:08.Undo",
    ]);
  });

  it("puts Undo on the latest answer only, and the chips under it", () => {
    const shown = props();
    render(<EditorThread {...shown} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(shown.onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Shorter" }));
    expect(shown.onChip).toHaveBeenCalledWith({ kind: "ask", text: "Shorter" });
  });

  it("opens the things to check as a list, each going to its moment", () => {
    const shown = props({ checking: true });
    render(<EditorThread {...shown} />);
    expect(screen.getByRole("button", { name: /1 to check/ })).toHaveAttribute("aria-expanded", "true");
    const list = document.getElementById("edit-checks")!;
    expect(list.textContent).toContain("0:06 · The captions cover the face.");
    fireEvent.click(within(list).getByRole("button", { name: "Show" }));
    expect(shown.onShow).toHaveBeenCalledWith(180);
  });

  it("shows a request out with no chips under it, and a failure with Try again", () => {
    const again = vi.fn();
    render(<EditorThread {...props({ pending: "Shorter", problem: { text: "Something went wrong.", again } })} />);
    expect(screen.getByText("Working on it…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shorter" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(again).toHaveBeenCalled();
  });
});

describe("the field", () => {
  it("sends the request on Enter, breaks the line on Shift+Enter, and sends nothing while off", () => {
    const onSend = vi.fn();
    const { rerender } = render(<EditorField text="Zoom in here" onText={() => {}} onSend={onSend} disabled={false} sending={false} />);
    const field = screen.getByRole("textbox", { name: "Ask for a change" });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Zoom in here");
    rerender(<EditorField text="Zoom in here" onText={() => {}} onSend={onSend} disabled sending={false} />);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/editor-thread.test.tsx` → `Failed to resolve import "../editor-field"`.

- [ ] Step 3: Implement.

`src/components/editor/editor-thread.tsx`:

```tsx
"use client";

import { Chip } from "@/components/ui/chip";
import { FPS } from "@/lib/edit";
import type { TurnShown } from "@/lib/edit/edit-view";
import type { Finding } from "@/lib/edit/review";
import { lookName } from "@/lib/edit/said";
import { timecode } from "@/lib/result/format";
import { chipLabel, type NextChip } from "./edit-session";
import { sentence } from "./net";

/**
 * editor-thread.tsx — the conversation (spec §3 screens 3-5, §5.3, §5.4, E7, E19; plan 2026-11-24-editor-screens-a, Task 12):
 * each turn's request (the first cut, made by itself, has none; a look picked later reads "Look: Clean") and what was said,
 * the latest answer with Undo on it when it changed the edit; a request out; one problem with Try again; the chips under the
 * latest answer; and, opened by "N to check", the things the review found, each with "Show" (slice A: a list, not slice B's
 * card at its moment). The latest exchange is what shows; older turns are a scroll away.
 */

/** What the creator asked, as the conversation shows it. */
export function requestOf(turn: TurnShown): string | null {
  if (turn.kind === "cut") return turn.n === 1 ? null : `Look: ${lookName(turn.request)}`;
  return turn.request;
}

export interface ThreadProps {
  turns: readonly TurnShown[];
  pending: string | null;
  /** The latest answer changed the edit and Undo can go back. */
  undoable: boolean;
  onUndo(): void;
  chips: readonly NextChip[];
  onChip(chip: NextChip): void;
  checking: boolean;
  findings: readonly Finding[];
  onShow(frame: number): void;
  problem: { text: string; again: (() => void) | null } | null;
  disabled: boolean;
}

const ASKED = "max-w-[290px] self-end rounded-[18px] bg-surface-sunken px-3.5 py-2 text-ui text-foreground";

export function EditorThread({ turns, pending, undoable, onUndo, chips, onChip, checking, findings, onShow, problem, disabled }: ThreadProps) {
  const latest = turns.at(-1);
  return (
    <section data-part="thread" aria-label="Your edit's changes" className="flex min-h-0 flex-col gap-2.5">
      <ol className="flex flex-col gap-2.5">
        {turns.map((turn) => {
          const asked = requestOf(turn);
          return (
            <li key={turn.n} data-turn={turn.n} className="flex flex-col gap-2.5">
              {asked !== null && <p className={ASKED}>{asked}</p>}
              <p className="text-ui leading-[21px] text-foreground proportional-nums">
                {turn.say}
                {turn === latest && undoable && turn.doc && (
                  <button type="button" disabled={disabled} onClick={onUndo} className="tap-44 ml-1.5 whitespace-nowrap font-[600] text-foreground disabled:opacity-40">
                    Undo
                  </button>
                )}
              </p>
            </li>
          );
        })}
        {pending !== null && (
          <li className="flex flex-col gap-2.5">
            <p className={ASKED}>{pending}</p>
            <p className="text-ui text-foreground-secondary">Working on it…</p>
          </li>
        )}
      </ol>
      {problem && (
        <p role="alert" className="text-meta text-foreground-secondary">
          {problem.text}{" "}
          {problem.again && (
            <button type="button" onClick={problem.again} className="tap-44 font-[600] text-foreground">
              Try again
            </button>
          )}
        </p>
      )}
      {chips.length > 0 && pending === null && (
        <div data-part="chips" className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Chip
              key={chipLabel(chip)} surface="card" disabled={disabled} onClick={() => onChip(chip)}
              aria-expanded={chip.kind === "check" ? checking : undefined} aria-controls={chip.kind === "check" ? "edit-checks" : undefined}
            >
              {chip.kind === "check" && <span aria-hidden className="size-2.5 rounded-full border-[1.7px] border-current" />}
              {chipLabel(chip)}
            </Chip>
          ))}
        </div>
      )}
      {checking && findings.length > 0 && (
        <ul id="edit-checks" data-part="checks" className="flex flex-col divide-y divide-border rounded-2xl bg-surface px-3.5 shadow-[var(--shadow-rest)]">
          {findings.map((finding, i) => (
            <li key={`${finding.code}-${finding.where.frame}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
              <p className="text-meta text-foreground">
                <span className="text-foreground-muted tabular-nums">{`${timecode(finding.where.frame / FPS)} · `}</span>
                {sentence(finding.says)}
              </p>
              <button type="button" onClick={() => onShow(finding.where.frame)} className="tap-44 shrink-0 text-meta font-[600] text-foreground">
                Show
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

`src/components/editor/editor-field.tsx`:

```tsx
"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { SendIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * editor-field.tsx — "Ask for a change" (spec §3 screen 4, §5.2; plan 2026-11-24-editor-screens-a, Task 12; drawing `.field`):
 * one field of its own, not the chat; 52 tall, the surface floating on the page, growing to three lines; Enter sends,
 * Shift+Enter breaks the line; the send button is the ink circle (36). Off while a call is out or the export is being made.
 * A request that failed comes back to it (the page's).
 */

/** The longest request the routes take (`MOST.request`). */
export const MOST_REQUEST = 500;
const LINE = 22;

export interface FieldHandle {
  focus(): void;
  focused(): boolean;
}

interface Props {
  text: string;
  onText(text: string): void;
  onSend(request: string): void;
  disabled: boolean;
  sending: boolean;
}

export const EditorField = forwardRef<FieldHandle, Props>(function EditorField({ text, onText, onSend, disabled, sending }, handle) {
  const area = useRef<HTMLTextAreaElement>(null);
  // Focused without scrolling to it: it is docked on screen, and a scroll of its own would move the conversation.
  useImperativeHandle(handle, () => ({ focus: () => area.current?.focus({ preventScroll: true }), focused: () => document.activeElement === area.current }), []);
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 3 * LINE)}px`;
  }, [text]);
  const request = text.trim();
  const send = () => {
    if (!disabled && request !== "") onSend(request);
  };
  return (
    <form
      data-part="field"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className={cn("flex min-h-[52px] items-center gap-2 rounded-[26px] bg-surface py-2 pl-[18px] pr-2 shadow-[var(--shadow-float)]", disabled && "opacity-60")}
    >
      <textarea
        ref={area} rows={1} maxLength={MOST_REQUEST} disabled={disabled}
        aria-label="Ask for a change" placeholder="Ask for a change" value={text}
        onChange={(event) => onText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          send();
        }}
        className="block min-w-0 flex-1 resize-none bg-transparent text-ui text-foreground placeholder:text-foreground-muted focus:outline-none"
        style={{ lineHeight: `${LINE}px` }}
      />
      <Button
        type="submit" variant="primary" size="sm" aria-label="Send" disabled={disabled || request === ""} loading={sending}
        className={cn(
          "tap-44 h-9 min-h-0 w-9 min-w-0 shrink-0 rounded-full p-0 next:rounded-full",
          "disabled:bg-surface-sunken disabled:text-foreground-muted disabled:opacity-100 disabled:shadow-none next:disabled:opacity-100 next:disabled:shadow-none",
        )}
      >
        {sending ? null : <SendIcon size={18} strokeWidth={2.3} aria-hidden />}
      </Button>
    </form>
  );
});
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/editor-thread.test.tsx && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/`.

- [ ] Step 5: Commit: `git add src/components/editor/editor-thread.tsx src/components/editor/editor-field.tsx src/components/editor/__tests__/editor-thread.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(editor): the conversation, its chips, the things to check, and the field" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 13: The Look sheet and the Captions sheet

**Files:**
- Create: `src/components/editor/look-sample.tsx`, `src/components/editor/look-sheet.tsx`, `src/components/editor/captions-sheet.tsx`
- Test: `src/components/editor/__tests__/sheets.test.tsx`

**Interfaces:** Consumes: `Sheet`, `SheetContent` (props `side`, `showCloseButton`, `onHandleDismiss`), `SheetTitle` (`src/components/ui/sheet.tsx`); `IconButton`, `Button`, `Chip`; `CloseIcon` (`field-icons.tsx`); `HOUSE_STYLE` (`style/house.ts`); `PRESETS` (`style/presets.ts`); `type StyleProfile`; `frameOf`, `type Edit`, `type Op` (`@/lib/edit`); `sameWord` (Task 3); `type CutStyle` (Task 10); `type StyleRead` (Task 10); `type Source` (Task 9); `LinkIcon`, `QuoteIcon`, `ChevronRightIcon` (Task 11); fixtures (Task 4). Produces:
- `look-sample.tsx`: `LookSample({ style: Pick<StyleProfile, "captions" | "title" | "look">; poster: string | null; words: readonly string[]; tall: number })`.
- `look-sheet.tsx`: `interface Look { key: string; name: string; style: StyleProfile }`; `LOOKS: readonly Look[]` (eight); `lookStyleOf(key: string): CutStyle`; `MOST_WORDS = 300`; `STARTS_AGAIN`; `LookRow({ picked: string; poster; words; onPick(look: CutStyle): void; disabled? })`; `LookSheet(props: LookSheetProps)` with `{ open: boolean; onOpenChange(open: boolean): void; picked: string | null; poster: string | null; words: readonly string[]; changed: boolean; disabled: boolean; onPick(look: CutStyle): void; reading: StyleRead; onReadVideo(source: Source): void }`.
- `captions-sheet.tsx`: `wordFrame(edit: Edit, ms: number): number | null`; `othersLike(words: readonly { text: string }[], index: number): number[]`; `CaptionsSheet(props: CaptionsSheetProps)` with `{ open; onOpenChange(open: boolean): void; edit: Edit; takeId: string; disabled: boolean; onOps(ops: Op[]): Promise<boolean>; onSeek(frame: number): void }`.

- [ ] Step 1: Write the failing test `src/components/editor/__tests__/sheets.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * sheets.test.tsx — the two things done by hand (plan 2026-11-24-editor-screens-a, Task 13; spec §3 screens 9 and 10, E5, E9, E22):
 * the eight looks drawn on the take's frame, "starts again" after changes, "Like a video" and "Describe it"; the take's words,
 * a word fixed in place with the video sent to it, "Fix all N", captions off. On a real edit (`views.ts`).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptionsSheet, othersLike, wordFrame } from "../captions-sheet";
import { LOOKS, LookRow, LookSheet, STARTS_AGAIN, type LookSheetProps } from "../look-sheet";
import { ASSET, FIRST, changed } from "./views";

afterEach(cleanup);

const IDLE = { status: "idle" as const, line: null, share: null, problem: null, style: null };
const sheet = (more: Partial<LookSheetProps> = {}): LookSheetProps => ({
  open: true, onOpenChange: vi.fn(), picked: "house", poster: "https://media.test/poster.jpg", words: ["Good", "morning."], changed: false, disabled: false,
  onPick: vi.fn(), reading: IDLE, onReadVideo: vi.fn(), ...more,
});

describe("the Look sheet", () => {
  it("offers ours and the seven presets, each drawn on the take's frame, the one in use pressed", () => {
    render(<LookSheet {...sheet()} />);
    const looks = within(screen.getByRole("group", { name: "Looks" })).getAllByRole("button");
    expect(looks.map((look) => look.querySelector("[data-part=look-name]")?.textContent)).toEqual(["Our pick", "Sentences", "Clean", "One word", "Highlighter", "Key words", "Black and white", "Bold pop"]);
    expect(screen.getByRole("button", { name: "Black and white" })).toBeInTheDocument();
    expect(looks[0]).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll("[data-sample]")).toHaveLength(LOOKS.length);
  });

  it("cuts in the look picked and closes; after changes it says the cut starts again", () => {
    const props = sheet({ changed: true });
    render(<LookSheet {...props} />);
    expect(screen.getByText(STARTS_AGAIN)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clean" }));
    expect(props.onPick).toHaveBeenCalledWith({ kind: "preset", id: "clean" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cuts in a look said in words, and reads a video's style in the background", () => {
    const props = sheet();
    render(<LookSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Describe it/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "The look in your words" }), { target: { value: "calm, small white type" } });
    fireEvent.click(screen.getByRole("button", { name: "Use it" }));
    expect(props.onPick).toHaveBeenCalledWith({ kind: "words", words: "calm, small white type" });
    fireEvent.click(screen.getByRole("button", { name: /Like a video/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: " https://www.tiktok.com/@someone/video/7300000000000000000 " } });
    fireEvent.click(screen.getByRole("button", { name: "Read its style" }));
    expect(props.onReadVideo).toHaveBeenCalledWith({ link: "https://www.tiktok.com/@someone/video/7300000000000000000" });
  });

  it("is a row while the take gets ready", () => {
    const onPick = vi.fn();
    render(<LookRow picked="house" poster={null} words={["go", "now"]} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Bold pop" }));
    expect(onPick).toHaveBeenCalledWith({ kind: "preset", id: "bold-pop" });
  });
});

describe("the Captions sheet", () => {
  /** "Good morning. Let us begin", with "Let" heard as "Good" too: a word heard twice. */
  const TWICE = changed(FIRST, [{ op: "word.set", asset: ASSET.id, index: 2, text: "good" }]);

  it("finds where a word is on the film and where else it was heard", () => {
    expect(wordFrame(FIRST, 519)).toBe(16);
    expect(wordFrame(changed(FIRST, [{ op: "shot.trim", id: "s1", startMs: 1000 }]), 519)).toBeNull();
    const words = TWICE.assets[0]!.kind === "video" ? TWICE.assets[0]!.words ?? [] : [];
    expect(othersLike(words, 0)).toEqual([2]);
  });

  it("fixes a word in place, sends the video to it, then offers to fix every place it was heard", async () => {
    const onOps = vi.fn(async () => true);
    const onSeek = vi.fn();
    render(<CaptionsSheet open onOpenChange={() => {}} edit={TWICE} takeId={ASSET.id} disabled={false} onOps={onOps} onSeek={onSeek} />);
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    expect(onSeek).toHaveBeenCalledWith(16);
    const word = screen.getByRole("textbox", { name: "Word 1" });
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Enter" });
    await waitFor(() => expect(onOps).toHaveBeenCalledWith([{ op: "word.set", asset: ASSET.id, index: 0, text: "Gud" }]));
    fireEvent.click(await screen.findByRole("button", { name: "Fix all 2" }));
    expect(onOps).toHaveBeenLastCalledWith([{ op: "word.set", asset: ASSET.id, index: 2, text: "Gud" }]);
  });

  it("turns captions off", () => {
    const onOps = vi.fn(async () => true);
    render(<CaptionsSheet open onOpenChange={() => {}} edit={FIRST} takeId={ASSET.id} disabled={false} onOps={onOps} onSeek={() => {}} />);
    const toggle = screen.getByRole("switch", { name: "Captions" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(onOps).toHaveBeenCalledWith([{ op: "captions.set", on: false }]);
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/sheets.test.tsx` → `Failed to resolve import "../captions-sheet"`.

- [ ] Step 3: Implement.

`src/components/editor/look-sample.tsx`:

```tsx
"use client";

import type { CSSProperties } from "react";
import type { StyleProfile } from "@/lib/edit/style/profile";

/**
 * look-sample.tsx — a look drawn on the take's own frame (spec §3 screens 2 and 9, §5.2; plan 2026-11-24-editor-screens-a, Task 13):
 * the poster (black and white for the mono look), the look's label where its title sits, and two of the take's words set as its
 * captions set them (the drawing of the dev page's `Sample.tsx`, at the tile's height). Its colours are the film's own (the
 * kit's white words, their dark edge and box, the look's highlight, the label's light box and dark ink): a picture of the
 * video, as the stage is, not the app's. It is the one file of the editor the colour guard leaves out (Task 15).
 */
const WHITE = "#ffffff";
const EDGE = "rgba(0, 0, 0, 0.9)";
const BOX = "rgba(0, 0, 0, 0.78)";
const INK = "#111111";

type Shown = Pick<StyleProfile, "captions" | "title" | "look">;

/** A size on the film's 1920-tall stage at the tile's height, half as large again so it is read; 6 at least. */
const scaled = (size: number, tall: number) => Math.max(6, Math.round(((size * tall) / 1920) * 1.5));
const edged = (px: number): CSSProperties => ({ WebkitTextStroke: `${(px * 0.09).toFixed(2)}px ${EDGE}`, paintOrder: "stroke fill" });

export function LookSample({ style, poster, words, tall }: { style: Shown; poster: string | null; words: readonly string[]; tall: number }) {
  const px = scaled(style.captions.size, tall);
  const said = style.captions.maxWords === 1 ? words.slice(1, 2) : words.slice(0, 2);
  const mark = style.captions.highlight ?? WHITE;
  const title = style.title?.on ? style.title : null;
  return (
    <span
      aria-hidden data-sample=""
      className="relative block w-full overflow-hidden rounded-xl bg-surface-sunken"
      style={{
        height: tall,
        ...(poster ? { backgroundImage: `url(${JSON.stringify(poster)})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
        ...(style.look.preset === "mono" ? { filter: "grayscale(1)" } : {}),
      }}
    >
      {title && (
        <span className="absolute inset-x-1 flex justify-center" style={{ top: `${Math.round(title.y * 100) - 4}%` }}>
          <span
            className="whitespace-nowrap"
            style={{
              fontSize: Math.round(scaled(title.size, tall) * 0.8), fontWeight: title.weight ?? 700, lineHeight: 1.2, borderRadius: 2.5, padding: "1px 3px",
              ...(title.look === "label" ? { background: WHITE, color: title.ink ?? INK } : { color: WHITE, ...edged(px) }),
            }}
          >
            {words.join(" ")}
          </span>
        </span>
      )}
      {style.captions.on && (
        <span className="absolute inset-x-1 flex justify-center" style={{ top: `${Math.round(style.captions.y * 100) - 3}%` }}>
          <span
            className="inline-flex whitespace-nowrap"
            style={{
              columnGap: px * 0.3, fontSize: px, fontWeight: style.captions.weight ?? 800, lineHeight: 1.3, color: WHITE,
              ...(style.captions.look === "pill" ? { backgroundColor: BOX, borderRadius: px * 0.42, padding: `0 ${(px * 0.5).toFixed(1)}px` } : edged(px)),
            }}
          >
            {said.map((word, i) => {
              const now = i === said.length - 1;
              const onBox = style.captions.look === "highlight" && now;
              return (
                <span
                  key={`${word}-${i}`}
                  style={onBox ? { color: INK, backgroundColor: mark, borderRadius: px * 0.22, padding: `0 ${(px * 0.18).toFixed(1)}px`, WebkitTextStroke: "0px" } : { color: now ? mark : WHITE }}
                >
                  {word}
                </span>
              );
            })}
          </span>
        </span>
      )}
    </span>
  );
}
```

`src/components/editor/look-sheet.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ShellIcon } from "@/components/shell/icons";
import { HOUSE_STYLE } from "@/lib/edit/style/house";
import { PRESETS } from "@/lib/edit/style/presets";
import type { StyleProfile } from "@/lib/edit/style/profile";
import { cn } from "@/lib/utils";
import type { CutStyle } from "./edit-session";
import { ChevronRightIcon, LinkIcon, QuoteIcon } from "./editor-icons";
import { LookSample } from "./look-sample";
import type { Source } from "./read-style";
import type { StyleRead } from "./use-edit";

/**
 * look-sheet.tsx — the look (spec §3 screens 2 and 9, E5, E9, E22; plan 2026-11-24-editor-screens-a, Task 13; drawing `.sheet2`,
 * `.grid4`, `.looks`): the eight looks (ours, then the seven presets in `PRESET_IDS` order), each drawn on the take's own frame,
 * the one in use pressed; picked, the take is cut again in it (after changes the sheet says so, and Undo brings them back).
 * Two more ways: "Like a video" (a TikTok link or an upload) is read in the background, the edit staying usable, and offered
 * as a chip when ready; "Describe it" (at most 300 characters) is cut at once. While the take gets ready the same looks are a
 * row under the video, and the one picked is sent with the first cut.
 */

export interface Look {
  key: string;
  name: string;
  style: StyleProfile;
}

export const LOOKS: readonly Look[] = [
  { key: "house", name: "Our pick", style: HOUSE_STYLE },
  ...PRESETS.map((preset) => ({ key: preset.id, name: preset.name, style: preset.profile })),
];

export const lookStyleOf = (key: string): CutStyle => (key === "house" ? { kind: "house" } : { kind: "preset", id: key });

/** The longest style in words the route takes (`MOST.words`). */
export const MOST_WORDS = 300;
/** What a creator reads when a look is picked after changes (E9). */
export const STARTS_AGAIN = "Picking a look starts again from your take. Undo brings your changes back.";

function Tile({ look, picked, poster, words, tall, ground, disabled, onPick }: { look: Look; picked: boolean; poster: string | null; words: readonly string[]; tall: number; ground: "page" | "sheet"; disabled?: boolean; onPick(): void }) {
  return (
    <button type="button" aria-pressed={picked} disabled={disabled} onClick={onPick} className="flex w-full flex-col items-center gap-2 disabled:opacity-40">
      <span
        className={cn(
          "block w-full rounded-xl ring-offset-2",
          ground === "page" ? "ring-offset-[color:var(--color-background)]" : "ring-offset-[color:var(--color-surface)]",
          picked && "ring-2 ring-[color:var(--color-action)]",
        )}
      >
        <LookSample style={look.style} poster={poster} words={words} tall={tall} />
      </span>
      <span data-part="look-name" className={cn("whitespace-nowrap text-label", picked ? "font-[640] text-foreground" : "text-foreground-secondary")}>{look.name}</span>
    </button>
  );
}

/** The looks in a row under the video while the take gets ready (screen 2). */
export function LookRow({ picked, poster, words, onPick, disabled }: { picked: string; poster: string | null; words: readonly string[]; onPick(look: CutStyle): void; disabled?: boolean }) {
  return (
    <section aria-labelledby="edit-look-row" data-part="look-row">
      <h2 id="edit-look-row" className="mb-2.5 px-0.5 text-ui font-[640] text-foreground">
        Pick a look while you wait
      </h2>
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none]">
        {LOOKS.map((look) => (
          <div key={look.key} className="w-[60px] shrink-0">
            <Tile look={look} picked={picked === look.key} poster={poster} words={words} tall={107} ground="page" disabled={disabled} onPick={() => onPick(lookStyleOf(look.key))} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** One more way, a row that opens what it needs under it. */
function Way({ icon: Icon, name, line, open, onToggle, children }: { icon: ShellIcon; name: string; line: string; open: boolean; onToggle(): void; children: React.ReactNode }) {
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-[60px] w-full items-center gap-3 px-0.5 py-2.5 text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-foreground">
          <Icon size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-[640] text-foreground">{name}</span>
          <span className="block text-meta text-foreground-secondary">{line}</span>
        </span>
        <ChevronRightIcon size={16} aria-hidden className={cn("shrink-0 text-foreground-muted transition-transform duration-150", open && "rotate-90")} />
      </button>
      {open && children}
    </div>
  );
}

export interface LookSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The key of the look in use. */
  picked: string | null;
  poster: string | null;
  words: readonly string[];
  /** There are changes since the last cut: picking a look starts again from the take. */
  changed: boolean;
  disabled: boolean;
  onPick(look: CutStyle): void;
  reading: StyleRead;
  onReadVideo(source: Source): void;
}

export function LookSheet({ open, onOpenChange, picked, poster, words, changed, disabled, onPick, reading, onReadVideo }: LookSheetProps) {
  const [way, setWay] = useState<"video" | "words" | null>(null);
  const [link, setLink] = useState("");
  const [said, setSaid] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const close = () => onOpenChange(false);
  const pick = (look: CutStyle) => {
    onPick(look);
    close();
  };
  const read = (source: Source) => {
    onReadVideo(source);
    close();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom" showCloseButton={false} aria-describedby={undefined} onHandleDismiss={close}
        className="max-h-[92dvh] gap-0 overflow-y-auto px-4 pb-[max(34px,env(safe-area-inset-bottom))] md:mx-auto md:max-w-[560px]"
      >
        <div className="mt-1 flex h-11 items-center justify-between px-0.5">
          <SheetTitle className="text-subhead font-[640]">Look</SheetTitle>
          <IconButton surface="card" aria-label="Close" onClick={close} className="h-9 w-9 [&_svg]:size-4">
            <CloseIcon strokeWidth={2.6} aria-hidden />
          </IconButton>
        </div>
        <div role="group" aria-label="Looks" className="mt-2 grid grid-cols-4 gap-x-2.5 gap-y-3.5">
          {LOOKS.map((look) => (
            <Tile key={look.key} look={look} picked={picked === look.key} poster={poster} words={words} tall={146} ground="sheet" disabled={disabled} onPick={() => pick(lookStyleOf(look.key))} />
          ))}
        </div>
        {changed && <p className="mt-3.5 px-0.5 text-meta text-foreground-secondary">{STARTS_AGAIN}</p>}
        <div className="mt-3 divide-y divide-border border-t border-border">
          <Way icon={LinkIcon} name="Like a video" line="Paste a TikTok link or upload one" open={way === "video"} onToggle={() => setWay(way === "video" ? null : "video")}>
            <form
              className="flex flex-col gap-2 pb-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (link.trim() !== "") read({ link: link.trim() });
              }}
            >
              <input
                aria-label="A TikTok link" value={link} onChange={(event) => setLink(event.target.value)} inputMode="url" placeholder="https://www.tiktok.com/…"
                className="h-11 rounded-xl bg-surface-sunken px-3 text-ui text-foreground placeholder:text-foreground-muted focus:outline-none"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={disabled || link.trim() === ""}>
                  Read its style
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => upload.current?.click()}>
                  Upload a video
                </Button>
              </div>
              <input
                ref={upload} type="file" accept="video/mp4,video/quicktime" aria-label="A video to read the style of" tabIndex={-1} className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) read({ file });
                }}
              />
            </form>
          </Way>
          <Way icon={QuoteIcon} name="Describe it" line="Say it the way you would to an editor" open={way === "words"} onToggle={() => setWay(way === "words" ? null : "words")}>
            <form
              className="flex flex-col gap-2 pb-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (said.trim() !== "") pick({ kind: "words", words: said.trim() });
              }}
            >
              <textarea
                aria-label="The look in your words" value={said} maxLength={MOST_WORDS} rows={3} onChange={(event) => setSaid(event.target.value)}
                className="resize-none rounded-xl bg-surface-sunken px-3 py-2 text-ui text-foreground focus:outline-none"
              />
              <Button type="submit" variant="primary" size="sm" className="self-start" disabled={disabled || said.trim() === ""}>
                Use it
              </Button>
            </form>
          </Way>
        </div>
        {reading.status === "reading" && <p role="status" className="mt-3 px-0.5 text-meta text-foreground-secondary">{reading.line}</p>}
        {reading.status === "failed" && <p role="alert" className="mt-3 px-0.5 text-meta text-foreground-secondary">{reading.problem}</p>}
      </SheetContent>
    </Sheet>
  );
}
```

`src/components/editor/captions-sheet.tsx`:

```tsx
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { frameOf, type Edit, type Op } from "@/lib/edit";
import { sameWord } from "@/lib/edit/said";
import { cn } from "@/lib/utils";

/**
 * captions-sheet.tsx — fix a word (spec §3 screen 10, E5, E22; plan 2026-11-24-editor-screens-a, Task 13; drawing `.words`): the
 * take's words as they were heard; a tap on one sends the video to it and opens it for typing; Enter (or leaving it) sets it with
 * `word.set`, no agent and no wait, and a word heard in other places too offers "Fix all N". The switch turns captions off and
 * on (`captions.set`). Escape leaves a word as it was.
 */

/** The film frame a moment of the take shows on, in whichever shot shows it; null when the cut left it out. */
export function wordFrame(edit: Edit, ms: number): number | null {
  for (const shot of edit.shots) {
    const frame = frameOf(edit, shot.id, ms);
    if (frame !== null) return frame;
  }
  return null;
}

/** The other places a word was heard, by index. */
export function othersLike(words: readonly { text: string }[], index: number): number[] {
  const text = words[index]?.text ?? "";
  return words.flatMap((word, j) => (j !== index && sameWord(word.text, text) ? [j] : []));
}

export interface CaptionsSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  edit: Edit;
  takeId: string;
  disabled: boolean;
  onOps(ops: Op[]): Promise<boolean>;
  onSeek(frame: number): void;
}

export function CaptionsSheet({ open, onOpenChange, edit, takeId, disabled, onOps, onSeek }: CaptionsSheetProps) {
  const asset = edit.assets.find((each) => each.id === takeId);
  const words = asset?.kind === "video" ? (asset.words ?? []) : [];
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [fixed, setFixed] = useState<{ to: string; others: number[] } | null>(null);
  const typing = useRef<HTMLInputElement>(null);
  const editingAt = editing?.index ?? null;
  useEffect(() => {
    if (editingAt !== null) typing.current?.focus();
  }, [editingAt]);
  const on = edit.captions.on;

  // The word being typed, in a ref too: a word is set once (Enter, then the blur of an input going away, would set it twice) and
  // never after Escape.
  const typingAt = useRef<number | null>(null);
  const openWord = (index: number) => {
    const word = words[index];
    if (!word) return;
    setFixed(null);
    typingAt.current = index;
    setEditing({ index, text: word.text });
    const frame = wordFrame(edit, word.startMs);
    if (frame !== null) onSeek(frame);
  };
  const cancel = () => {
    typingAt.current = null;
    setEditing(null);
  };
  const commit = async () => {
    if (!editing || typingAt.current !== editing.index) return;
    typingAt.current = null;
    const was = words[editing.index]?.text ?? "";
    const to = editing.text.trim();
    setEditing(null);
    if (to === "" || to === was) return;
    const others = othersLike(words, editing.index);
    if (await onOps([{ op: "word.set", asset: takeId, index: editing.index, text: to }])) setFixed(others.length > 0 ? { to, others } : null);
  };
  const fixAll = async () => {
    if (!fixed) return;
    const ops: Op[] = fixed.others.map((index) => ({ op: "word.set", asset: takeId, index, text: fixed.to }));
    setFixed(null);
    await onOps(ops);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom" showCloseButton={false} aria-describedby={undefined} onHandleDismiss={() => onOpenChange(false)}
        // Radix hears Escape on the document in its capture phase, before the word's own keys: while a word is typed, Escape
        // leaves the word as it was and keeps the sheet open.
        onEscapeKeyDown={(event) => {
          if (editingAt === null) return;
          event.preventDefault();
          cancel();
        }}
        className="max-h-[70dvh] gap-0 overflow-y-auto px-4 pb-[max(34px,env(safe-area-inset-bottom))] md:mx-auto md:max-w-[560px]"
      >
        <div className="mt-1 flex h-11 items-center gap-3 px-0.5">
          <SheetTitle className="flex-1 text-subhead font-[640]">Captions</SheetTitle>
          <button
            type="button" role="switch" aria-checked={on} aria-label="Captions" disabled={disabled}
            onClick={() => void onOps([{ op: "captions.set", on: !on }])}
            className={cn("tap-44 relative h-7 w-[46px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-40", on ? "bg-action" : "bg-surface-sunken")}
          >
            <span aria-hidden className={cn("absolute top-[3px] size-[22px] rounded-full bg-surface shadow-[var(--shadow-control)] transition-[left] duration-150", on ? "left-[21px]" : "left-[3px]")} />
          </button>
          <IconButton surface="card" aria-label="Close" onClick={() => onOpenChange(false)} className="h-9 w-9 [&_svg]:size-4">
            <CloseIcon strokeWidth={2.6} aria-hidden />
          </IconButton>
        </div>
        {words.length === 0 ? (
          <p className="mt-2 px-0.5 text-ui text-foreground-secondary">No speech was found in this take.</p>
        ) : (
          <p data-part="words" className="mt-1 px-0.5 text-title leading-9 text-foreground">
            {words.map((word, i) => (
              <Fragment key={i}>
                {editing?.index === i ? (
                  <input
                    ref={typing} aria-label={`Word ${i + 1}`} value={editing.text} size={Math.max(2, editing.text.length)} maxLength={80}
                    onChange={(event) => setEditing({ index: i, text: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void commit();
                      }
                      if (event.key === "Escape") cancel(); // the sheet stays: `onEscapeKeyDown` above
                    }}
                    onBlur={() => void commit()}
                    className="mx-0.5 rounded-[9px] bg-transparent px-1.5 text-foreground shadow-[0_0_0_1.7px_var(--color-action)] focus:outline-none"
                  />
                ) : (
                  <button type="button" disabled={disabled} onClick={() => openWord(i)} className={cn("rounded-lg px-px hover:bg-surface-sunken disabled:opacity-60", word.hidden && "text-foreground-muted")}>
                    {word.text}
                  </button>
                )}{" "}
              </Fragment>
            ))}
          </p>
        )}
        {fixed && (
          <div className="mt-2">
            <Chip surface="card" disabled={disabled} onClick={() => void fixAll()}>{`Fix all ${fixed.others.length + 1}`}</Chip>
          </div>
        )}
        <p className="mt-2 px-0.5 text-meta text-foreground-secondary">Tap a word to fix it. The video jumps to it.</p>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/sheets.test.tsx && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/`.

- [ ] Step 5: Commit: `git add src/components/editor/look-sample.tsx src/components/editor/look-sheet.tsx src/components/editor/captions-sheet.tsx src/components/editor/__tests__/sheets.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(editor): the Look sheet and the Captions sheet" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 14: The export in the page, and the Ready sheet

**Files:**
- Create: `src/components/editor/export-panel.tsx`, `src/components/editor/ready-sheet.tsx`
- Test: `src/components/editor/__tests__/export-ready.test.tsx`

**Interfaces:** Consumes: `ExportShown` (Task 4); `exportSeconds`, `waitWords` (Task 3); `Sheet`, `SheetContent`, `SheetTitle`, `Button` (`asChild` supported), `IconButton`; `CloseIcon`; `VideoThumb` (`video-answer.tsx`); `SaveIcon` (Task 11); `timecode`. Produces:
- `export-panel.tsx`: `exportLine(filmSeconds: number, progress: number): string`; `ExportPanel({ shown: ExportShown; filmSeconds: number; onCancel(): void; cancelling: boolean })`.
- `ready-sheet.tsx`: `canShareFiles(nav?: Pick<Navigator, "canShare">): boolean`; `filmLine(seconds: number, sound: boolean): string`; `ReadySheet({ open: boolean; onOpenChange(open: boolean): void; filmUrl: string; poster: string | null; seconds: number; sound: boolean })`.

On a phone the share sheet needs the file in hand inside the tap (`navigator.share` must be called during the user's activation), so the file is fetched as soon as the export is done. That fetch reads the film from R2 across origins: whether the bucket answers the app's origin with CORS for a GET cannot be known from this worktree (the bucket's settings are not in the repo; uploads by PUT already work from the dev pages, which says only that PUT is allowed). The sheet therefore falls back to "Download" whenever that fetch fails, and Task 18 checks it with `curl -H "Origin: …"` on a real film address.

- [ ] Step 1: Write the failing test `src/components/editor/__tests__/export-ready.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * export-ready.test.tsx — the export in the page and its Ready sheet (plan 2026-11-24-editor-screens-a, Task 14; spec E6, E20,
 * E21): how long it has left in words, the bar, Cancel; then "Save to Photos" on a device that shares files (the file fetched
 * first, handed over inside the tap), else "Download". The device's share sheet and the film's address are stood in.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportPanel, exportLine } from "../export-panel";
import { ReadySheet, canShareFiles, filmLine } from "../ready-sheet";

const FILM = "https://media.test/films/film-1.mp4";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
});

describe("the export in the page", () => {
  it("says how long it has left, never a percentage alone, and gives the edit back on Cancel", () => {
    expect(exportLine(11.3, 0.5)).toBe("Under a minute left. You can leave, it keeps going.");
    expect(exportLine(150, 0)).toBe("About 3 minutes left. You can leave, it keeps going.");
    const onCancel = vi.fn();
    render(<ExportPanel shown={{ job: "j", turn: 1, status: "running", stage: "drawing", progress: 0.4, error: null, filmUrl: null, ms: null }} filmSeconds={11.3} onCancel={onCancel} cancelling={false} />);
    expect(screen.getByRole("heading", { name: "Making your video" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Your video" })).toHaveAttribute("aria-valuenow", "40");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("the Ready sheet", () => {
  it("says what was made", () => {
    expect(filmLine(11.3, true)).toBe("0:11 · 1080 × 1920 · with sound");
    expect(canShareFiles(undefined)).toBe(false);
    expect(canShareFiles({ canShare: () => true })).toBe(true);
    expect(canShareFiles({ canShare: () => { throw new Error("no"); } })).toBe(false);
  });

  it("offers Download where the device shares no files", () => {
    render(<ReadySheet open onOpenChange={() => {}} filmUrl={FILM} poster={null} seconds={11.3} sound />);
    const download = screen.getByRole("link", { name: /Download/ });
    expect(download).toHaveAttribute("href", FILM);
    expect(download).toHaveAttribute("download", "video.mp4");
    expect(screen.getByRole("button", { name: "Back to the edit" })).toBeInTheDocument();
  });

  it("on a phone fetches the file first and hands it to the share sheet inside the tap", async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob([new Uint8Array(8)], { type: "video/mp4" }))));
    render(<ReadySheet open onOpenChange={() => {}} filmUrl={FILM} poster={null} seconds={11.3} sound />);
    const save = screen.getByRole("button", { name: /Save to Photos/ });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    expect(share).toHaveBeenCalledTimes(1);
    const [{ files }] = share.mock.calls[0] as unknown as [{ files: File[] }];
    expect(files.map((file) => [file.name, file.type])).toEqual([["video.mp4", "video/mp4"]]);
  });

  it("falls back to Download when the file cannot be fetched", async () => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    render(<ReadySheet open onOpenChange={() => {}} filmUrl={FILM} poster={null} seconds={11.3} sound />);
    expect(await screen.findByRole("link", { name: /Download/ })).toHaveAttribute("href", FILM);
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/export-ready.test.tsx` → `Failed to resolve import "../export-panel"`.

- [ ] Step 3: Implement.

`src/components/editor/export-panel.tsx`:

```tsx
"use client";

import type { ExportShown } from "@/lib/edit/edit-view";
import { exportSeconds, waitWords } from "@/lib/edit/waits";

/**
 * export-panel.tsx — the export in the page (spec §3 screen 11, E20, E21; plan 2026-11-24-editor-screens-a, Task 14; drawing
 * `.exp`): it takes the conversation's place while the file is made, the tools and the field resting and the video still to be
 * watched; how long is left in words, from the film's length and how far the render is; the bar; Cancel gives the edit back.
 */

/** "About a minute left. You can leave, it keeps going.": the estimate of what is left of the render. */
export function exportLine(filmSeconds: number, progress: number): string {
  const left = Math.max(0, Math.round(exportSeconds(filmSeconds) * (1 - Math.min(1, Math.max(0, progress)))));
  return `${waitWords(left)} left. You can leave, it keeps going.`;
}

export function ExportPanel({ shown, filmSeconds, onCancel, cancelling }: { shown: ExportShown; filmSeconds: number; onCancel(): void; cancelling: boolean }) {
  const share = Math.round(Math.min(1, Math.max(0, shown.progress)) * 100);
  return (
    <section data-part="export" aria-labelledby="edit-export-title" className="flex flex-col gap-1">
      <h2 id="edit-export-title" className="text-ui font-[640] text-foreground">
        Making your video
      </h2>
      <p aria-live="polite" className="text-ui text-foreground-secondary">{exportLine(filmSeconds, shown.progress)}</p>
      <div role="progressbar" aria-label="Your video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-action" style={{ width: `${share}%` }} />
      </div>
      <button type="button" onClick={onCancel} disabled={cancelling} className="tap-44 mt-2 self-start text-ui font-[600] text-foreground disabled:opacity-40">
        Cancel
      </button>
    </section>
  );
}
```

`src/components/editor/ready-sheet.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { VideoThumb } from "@/components/thread-next/video-answer";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { timecode } from "@/lib/result/format";
import { SaveIcon } from "./editor-icons";

/**
 * ready-sheet.tsx — the file made (spec §3 screen 12, E6; plan 2026-11-24-editor-screens-a, Task 14; drawing `.done`, `.btn`): on a
 * device whose share sheet takes files (a phone: Photos, TikTok, Instagram) "Save to Photos" hands the file over; the file is
 * fetched as soon as the sheet has its address, because a share must start inside the tap. Elsewhere, or when that fetch fails
 * (the bucket's CORS, a connection), "Download" saves it. "Back to the edit" closes the sheet.
 */

/** Whether this device's share sheet takes a video file. */
export function canShareFiles(nav: Pick<Navigator, "canShare"> | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  try {
    return typeof nav?.canShare === "function" && nav.canShare({ files: [new File([new Uint8Array(1)], "video.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

/** "0:11 · 1080 × 1920 · with sound". */
export function filmLine(seconds: number, sound: boolean): string {
  return `${timecode(seconds)} · 1080 × 1920 · ${sound ? "with sound" : "no sound"}`;
}

export function ReadySheet({ open, onOpenChange, filmUrl, poster, seconds, sound }: { open: boolean; onOpenChange(open: boolean): void; filmUrl: string; poster: string | null; seconds: number; sound: boolean }) {
  const [shares] = useState(() => canShareFiles());
  const [held, setHeld] = useState<{ url: string; file: File } | null>(null);
  const [unfetched, setUnfetched] = useState<string | null>(null);
  useEffect(() => {
    if (!shares) return;
    let stopped = false;
    void fetch(filmUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`the film answered ${response.status}`);
        const file = new File([await response.blob()], "video.mp4", { type: "video/mp4" });
        if (!stopped) setHeld({ url: filmUrl, file });
      })
      .catch(() => {
        if (!stopped) setUnfetched(filmUrl);
      });
    return () => {
      stopped = true;
    };
  }, [shares, filmUrl]);
  const file = held?.url === filmUrl ? held.file : null;
  const share = shares && unfetched !== filmUrl;
  const close = () => onOpenChange(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} aria-describedby={undefined} onHandleDismiss={close} className="gap-0 px-4 pb-[max(34px,env(safe-area-inset-bottom))] md:mx-auto md:max-w-[440px]">
        <div className="mt-1 flex h-11 items-center justify-between px-0.5">
          <SheetTitle className="text-subhead font-[640]">Ready</SheetTitle>
          <IconButton surface="card" aria-label="Close" onClick={close} className="h-9 w-9 [&_svg]:size-4">
            <CloseIcon strokeWidth={2.6} aria-hidden />
          </IconButton>
        </div>
        <div className="mb-4 mt-1.5 flex items-center gap-3.5">
          <VideoThumb src={poster} className="w-[72px]" />
          <div className="min-w-0">
            <p className="text-subhead font-[640] text-foreground">Your video is ready</p>
            <p className="text-reading text-foreground-secondary tabular-nums">{filmLine(seconds, sound)}</p>
          </div>
        </div>
        {share ? (
          <Button
            variant="primary" size="lg" className="w-full gap-2" disabled={!file}
            onClick={() => {
              if (file) void navigator.share({ files: [file] }).catch(() => undefined);
            }}
          >
            <SaveIcon aria-hidden />
            Save to Photos
          </Button>
        ) : (
          <Button asChild variant="primary" size="lg" className="w-full gap-2">
            <a href={filmUrl} download="video.mp4">
              <SaveIcon aria-hidden />
              Download
            </a>
          </Button>
        )}
        <Button variant="secondary" size="lg" className="mt-2 w-full" onClick={close}>
          Back to the edit
        </Button>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/export-ready.test.tsx && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/`.

- [ ] Step 5: Commit: `git add src/components/editor/export-panel.tsx src/components/editor/ready-sheet.tsx src/components/editor/__tests__/export-ready.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(editor): the export in the page and the Ready sheet" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 15: The page: its states, phone and desktop, its header, and its place in the shell

**Files:**
- Create: `src/components/editor/editor-header.tsx`, `src/components/editor/editor-screen.tsx`, `src/app/(app)/edit/[id]/page.tsx`
- Modify: `src/components/shell/next-shell.tsx:66` (the marker's early return), `:99` (the band header), `src/lib/supabase/middleware.ts:35`
- Test: `src/components/editor/__tests__/editor-screen.test.tsx`, `src/components/editor/__tests__/editor-guard.test.ts`, `src/app/(app)/edit/[id]/__tests__/page.test.ts`, `src/components/shell/__tests__/next-shell-editor.test.tsx`, `src/lib/supabase/__tests__/middleware.edit.test.ts`

**Interfaces:** Consumes: everything of Tasks 9-14 (`useEdit`, `chipsOf`, `lookKeyOfStyle`, `playheadAfter`, `EditorStage`, `StageHandle`, `EditorScrubber`, `EditorThread`, `EditorField`, `FieldHandle`, `LookRow`, `LookSheet`, `CaptionsSheet`, `ExportPanel`, `ReadySheet`, `forgetUpload`, `sentence`); `useVideoMeta(file: File | null): { durationSec; thumbnail }` (`src/hooks/use-video-meta.ts`); `analysisSeconds`, `waitWords` (Task 3); `LIVE_JOB` (Task 4); `IconButton`, `Button`, `Chip`; `BackIcon` (`shell/icons.tsx`); `useShellStore` (`setThreadBack`); `NEW_LOOK_ENABLED`; `notFound` (`next/navigation`). Produces: `EditorHeader(props: { title: string; canUndo: boolean; canRedo: boolean; onUndo(): void; onRedo(): void; exportLabel: "Export" | "Exporting"; exportOn: boolean; onExport(): void })`; `EditorScreen({ id: string; pollMs?: number })`; the page `/edit/[id]` (`metadata.title = "Edit | Maven"`).

The shell (read at `next-shell.tsx:55-129`): `/edit/` already has no tab bar (`tabBarVisible` lights the four places only) and Back would lead Home (`backTarget`). Two changes: like `/simulation/`, it keeps the back-to-Library marker of the chat it was opened from (line 66), and it draws its own header in the shell's phone band, because the phone header there is Back, Undo, Redo and Export with no title (E19) while the shell's `PushedHeader` holds one trailing action (line 99). The page's scroll is its own (`h-[calc(100dvh-…)] overflow-y-auto`): the app's `<main>` scrolls with a padded top, and the video must stick under the header on a phone.

- [ ] Step 1: Write the failing tests.

`src/components/editor/__tests__/editor-screen.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * editor-screen.test.tsx — the editor page (plan 2026-11-24-editor-screens-a, Task 15; spec §3, §5.1): its states, a change and
 * Undo, a look, the export held in the page and given up, the Ready sheet. Everything of ours is real, the kit's Player too; the
 * network is stood in with the routes' own answers (views of real edits), and what happy-dom lacks as a browser (fonts) is given
 * empty stand-ins.
 */
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }), usePathname: () => "/edit/e" }));

import type { EditView, ExportShown } from "@/lib/edit/edit-view";
import { renderWithClient } from "@/test/render-with-client";
import { EditorScreen } from "../editor-screen";
import { EDIT_ID, FIRST, changed, viewOf } from "./views";

/** No captions: happy-dom loads no font to measure them with. */
const QUIET = changed(FIRST, [{ op: "captions.set", on: false }]);
const base = `/api/edit/edits/${EDIT_ID}`;
const shown = (more: Partial<EditView> = {}) => viewOf({ edit: QUIET, ...more });
const job = (status: string, more: Partial<ExportShown> = {}): ExportShown => ({ job: "j1", turn: 1, status, stage: null, progress: 0.4, error: null, filmUrl: null, ms: null, ...more });

type Answer = { status: number; body: unknown };
function network(answers: Record<string, Answer[]>, keep: Record<string, Answer> = {}) {
  const asked: { call: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/edit/fonts/")) return new Response(new ArrayBuffer(8));
    if (!path.startsWith("/api/")) return new Response(null, { status: 404 });
    const call = `${init?.method ?? "GET"} ${path}`;
    asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = answers[call]?.shift() ?? keep[call];
    if (!next) throw new Error(`no answer for ${call}`);
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  }));
  return asked;
}
const ok = (view: EditView): Answer => ({ status: 200, body: view });
const open = () => renderWithClient(<EditorScreen id={EDIT_ID} pollMs={5} />);
const field = () => screen.getByRole("textbox", { name: "Ask for a change" });

class NoFontFace {
  constructor(readonly family: string) {}
  load = async () => this;
}
beforeAll(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: () => {}, ready: Promise.resolve() } });
});
beforeEach(() => vi.stubGlobal("FontFace", NoFontFace));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the editor page", () => {
  it("shows the cut: the header, the tools, the first cut's line and the field", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    expect(await screen.findByText("Captions are on.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Good morning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Look/ })).toBeEnabled();
    expect(field()).toBeEnabled();
    expect(screen.getByRole("slider", { name: "Playhead" })).toBeInTheDocument();
  });

  it("asks for a change, shows it, and undoes it from the header", async () => {
    const two = shown({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, { n: 2, kind: "change", request: "Shorter", at: null, say: "Cut it to 9.8 seconds.", doc: true, findings: [] }] });
    const asked = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/change`]: [ok(two)], [`POST ${base}/head`]: [ok(shown({ redo: 2 }))] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(await screen.findByText("Cut it to 9.8 seconds.")).toBeInTheDocument();
    const undo = screen.getAllByRole("button", { name: "Undo" })[0]!;
    await waitFor(() => expect(undo).toBeEnabled());
    fireEvent.click(undo);
    await waitFor(() => expect(asked.map((one) => one.call)).toContain(`POST ${base}/head`));
    expect(asked.find((one) => one.call === `POST ${base}/head`)?.body).toEqual({ n: 1 });
  });

  it("cuts again in a look picked in its sheet", async () => {
    const asked = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/cut`]: [ok(shown({ look: "clean", head: 2, shown: 2, undo: 1 }))] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(screen.getByRole("button", { name: /^Look/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Clean" }));
    await waitFor(() => expect(asked.find((one) => one.call === `POST ${base}/cut`)?.body).toEqual({ style: { preset: "clean" } }));
  });

  it("holds the edit still while the file is made, gives it back on Cancel, and opens Ready when it is made", async () => {
    const asked = network(
      {
        [`GET ${base}`]: [ok(shown())],
        [`POST ${base}/export`]: [{ status: 202, body: shown({ export: job("running") }) }],
        [`DELETE ${base}/export`]: [ok(shown())],
      },
    );
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByRole("heading", { name: "Making your video" })).toBeInTheDocument();
    expect(field()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exporting" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(field()).toBeEnabled());
    expect(asked.map((one) => one.call)).toContain(`DELETE ${base}/export`);
  });

  it("opens the Ready sheet when the export it watched is made", async () => {
    network(
      { [`GET ${base}`]: [ok(shown({ export: job("running") }))] },
      { [`GET ${base}`]: ok(shown({ export: job("done", { progress: 1, filmUrl: "https://media.test/films/film-1.mp4", ms: 12_700 }) })) },
    );
    open();
    const sheet = await screen.findByRole("dialog", { name: "Ready" });
    expect(within(sheet).getByRole("link", { name: /Download/ })).toHaveAttribute("href", "https://media.test/films/film-1.mp4");
  });

  it("says an edit that is not there, and an upload that stopped", async () => {
    network({ [`GET ${base}`]: [{ status: 404, body: { error: "no such edit" } }] });
    open();
    expect(await screen.findByText("This edit is not here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    cleanup();
    network({ [`GET ${base}`]: [ok(viewOf({ take: { ...viewOf().take, status: "uploading", previewUrl: null, posterUrl: null, asset: null }, head: null, shown: null, edit: null, turns: [] }))] });
    open();
    expect(await screen.findByText("The upload stopped.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick the video again" })).toBeInTheDocument();
  });
});
```

`src/components/editor/__tests__/editor-guard.test.ts`:

```ts
/**
 * editor-guard.test.ts — the editor is built from tokens only (plan 2026-11-24-editor-screens-a, Task 15; the method of
 * `src/components/result/__tests__/result-guard.test.ts`): no colour literal (but in `look-sample.tsx`, which draws the film's own
 * caption colours on the take's frame), no glass, no type size outside the role scale, and never the `shadow-float` utility
 * (it ignores the new look's re-valued token). Pure FS test.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EDITOR = join(__dirname, "..");
const FILES = readdirSync(EDITOR, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name)).map((entry) => entry.name);
const code = (file: string) => readFileSync(join(EDITOR, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the editor: tokens only", () => {
  it("finds the editor's parts", () => {
    expect(FILES.length).toBeGreaterThan(15);
  });

  it.each(FILES.filter((file) => file !== "look-sample.tsx"))("%s carries no colour literal", (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\b(rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no glass, no off-scale type and no shadow-float utility", (file) => {
    const src = code(file);
    expect(/backdropFilter|backdrop-blur/i.test(src)).toBe(false);
    expect(src.match(/\btext-\[\d+(\.\d+)?(px|rem|em)\]/g) ?? []).toEqual([]);
    expect(src.match(/(?<![-\w])shadow-float\b/g) ?? []).toEqual([]);
  });
});
```

`src/app/(app)/edit/[id]/__tests__/page.test.ts`:

```ts
/** /edit/[id] under each build of the flag (plan 2026-11-24-editor-screens-a, Task 15): a 404 with it off, the editor with it on. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const page = await import("../page");
  return { Page: page.default, metadata: page.metadata, EditorScreen: (await import("@/components/editor/editor-screen")).EditorScreen };
}
const params = { params: Promise.resolve({ id: "55555555-5555-4555-8555-555555555555" }) };

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("/edit/[id]", () => {
  it("does not exist with the flag off", async () => {
    const { Page } = await load(false);
    const thrown = await Page(params).then(() => "nothing thrown", (error: { digest?: string }) => String(error.digest ?? error));
    expect(thrown).toContain("404");
  });

  it("is the editor of that edit with the flag on", async () => {
    const { Page, EditorScreen, metadata } = await load(true);
    const element = (await Page(params)) as ReactElement<{ id: string }>;
    expect(isValidElement(element) && element.type).toBe(EditorScreen);
    expect(element.props.id).toBe("55555555-5555-4555-8555-555555555555");
    expect(metadata.title).toBe("Edit | Maven");
  });
});
```

`src/components/shell/__tests__/next-shell-editor.test.tsx` (the mocks and `renderShell` of `next-shell-pushed-title.test.tsx:9-54`, with the path `/edit/e1`):

```tsx
/** @vitest-environment happy-dom */
/**
 * The editor in the shell (plan 2026-11-24-editor-screens-a, Task 15; spec E1, E19): no tab bar and no shell header on its page (it
 * draws Back, Undo, Redo and Export itself), and a chat opened from Library keeps its way back across it, as across a result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';
import { useSidebarStore } from '@/stores/sidebar-store';

vi.setConfig({ testTimeout: 20_000 });

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = '/edit/e1';
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => router }));
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: [], isLoading: false }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useRenameThread: () => ({ mutate: vi.fn() }),
  usePinThread: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/queries/use-profile', () => ({ useProfile: () => ({ data: null }) }));
vi.mock('@/hooks/use-subscription', () => ({ useSubscription: () => ({ usage: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/components/app/auth-guard', () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { NextShell } from '../next-shell';
import { backTarget, tabBarVisible } from '../nav-config';

const renderShell = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <TooltipProvider>
          <NextShell>
            <p>page content</p>
          </NextShell>
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  pathname = '/edit/e1';
  localStorage.clear();
  useShellStore.setState({ threadOpen: false, autoRail: false, pushedTitle: '', threadBack: null });
  useBoardStore.setState({ activeThreadId: null });
  useSidebarStore.setState({ isCollapsed: false, commandOpen: false });
});

describe('NextShell — the editor', () => {
  it('shows no tab bar and draws no header of its own over the editor', () => {
    expect(tabBarVisible('/edit/e1', false)).toBe(false);
    expect(backTarget('/edit/e1')).toBe('/home');
    renderShell();
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('keeps the way back to Library of the chat it was opened from', () => {
    useShellStore.getState().setThreadBack('/library');
    renderShell();
    expect(useShellStore.getState().threadBack).toBe('/library');
    pathname = '/audience';
    useShellStore.getState().setThreadBack('/library');
    renderShell();
    expect(useShellStore.getState().threadBack).toBeNull();
  });
});
```

`src/lib/supabase/__tests__/middleware.edit.test.ts` (the stand-ins of `middleware.you.test.ts:8-28`):

```ts
/** /edit is a signed-in page under the new look (plan 2026-11-24-editor-screens-a, Task 15): the deep link kept through login. */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://app.numen.test";
let mockUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarding_completed_at: "2026-01-01T00:00:00Z" }, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/referral/constants", () => ({ REFERRAL_COOKIE_NAME: "numen_ref", REFERRAL_COOKIE_MAX_AGE: 60 * 60 * 24 * 30 }));

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const { NextRequest } = await import("next/server");
  const { updateSession } = await import("../middleware");
  return (path: string) => updateSession(new NextRequest(new URL(path, ORIGIN)));
}

afterEach(() => {
  mockUser = null;
  vi.doUnmock("@/lib/flags/new-look");
});

describe("middleware: /edit", () => {
  it("flag on, signed out: to /login with the deep link", async () => {
    const res = await (await load(true))("/edit/e1");
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/edit/e1");
  });

  it("flag on, signed in: through; flag off: as before", async () => {
    mockUser = { id: "user-1" };
    expect((await (await load(true))("/edit/e1")).headers.get("location")).toBeNull();
    mockUser = null;
    expect((await (await load(false))("/edit/e1")).headers.get("location")).toBeNull();
  });
});
```

- [ ] Step 2: Run them, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/editor-screen.test.tsx src/components/editor/__tests__/editor-guard.test.ts "src/app/(app)/edit/[id]/__tests__/page.test.ts" src/components/shell/__tests__/next-shell-editor.test.tsx src/lib/supabase/__tests__/middleware.edit.test.ts` → `Failed to resolve import "../editor-screen"` and `"../page"`; the shell test fails on the shell's Back button being there and the marker dropped; the middleware test on no redirect for `/edit/e1`.

- [ ] Step 3: Implement.

`src/components/editor/editor-header.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { RedoIcon, UndoIcon } from "./editor-icons";

/**
 * editor-header.tsx — the editor's header (spec E1, E19; plan 2026-11-24-editor-screens-a, Task 15; drawing `.hd`, `.dtop`). On a
 * phone it sits in the shell's band (the shell draws none on `/edit/`): Back, Undo, Redo, and Export at the right, no title (the
 * title is the page's `<h1>`, read by assistive tech only). From md up it is a row of the page: Back, the title, then Undo,
 * Redo, Export. One tree, placed by `order`, so the focus order is Back, Undo, Redo, Export at every width. Back returns to where
 * the editor was opened from (Home, a chat), or Home when it was opened directly.
 */
export interface HeaderProps {
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  exportLabel: "Export" | "Exporting";
  exportOn: boolean;
  onExport(): void;
}

export function EditorHeader({ title, canUndo, canRedo, onUndo, onRedo, exportLabel, exportOn, onExport }: HeaderProps) {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.push("/home"));
  return (
    <header
      data-part="editor-header"
      className="fixed inset-x-0 top-0 z-[var(--z-sidebar)] flex h-[calc(env(safe-area-inset-top)+var(--mobile-nav-band,46px))] shrink-0 items-center gap-2 bg-background px-4 pt-[env(safe-area-inset-top)] md:static md:z-auto md:h-[68px] md:bg-transparent md:pl-3 md:pr-8 md:pt-0"
    >
      <IconButton aria-label="Back" onClick={back} className="order-0">
        <BackIcon aria-hidden />
      </IconButton>
      <h1 className="order-1 sr-only min-w-0 truncate text-title font-[640] text-foreground md:not-sr-only" style={{ letterSpacing: "-0.014em" }}>
        {title}
      </h1>
      <div className="order-1 flex items-center gap-2 md:order-3">
        <IconButton aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
          <UndoIcon aria-hidden />
        </IconButton>
        <IconButton aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
          <RedoIcon aria-hidden />
        </IconButton>
      </div>
      <span aria-hidden className="order-2 flex-1" />
      <Button variant="primary" size="sm" disabled={!exportOn} onClick={onExport} className="order-4 h-10 rounded-full px-[18px] next:rounded-full">
        {exportLabel}
      </Button>
    </header>
  );
}
```

`src/components/editor/editor-screen.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useVideoMeta } from "@/hooks/use-video-meta";
import { FPS, filmFrames, type Edit } from "@/lib/edit";
import { LIVE_JOB } from "@/lib/edit/edit-view";
import { analysisSeconds, waitWords } from "@/lib/edit/waits";
import { useShellStore } from "@/stores/shell-store";
import { CaptionsSheet } from "./captions-sheet";
import { chipsOf, lookKeyOfStyle, playheadAfter, type NextChip } from "./edit-session";
import { EditorField, type FieldHandle } from "./editor-field";
import { EditorHeader } from "./editor-header";
import { CaptionsIcon, LookIcon } from "./editor-icons";
import { EditorScrubber } from "./editor-scrubber";
import { EditorStage, type StageHandle } from "./editor-stage";
import { EditorThread } from "./editor-thread";
import { ExportPanel } from "./export-panel";
import { LookRow, LookSheet } from "./look-sheet";
import { sentence } from "./net";
import { ReadySheet } from "./ready-sheet";
import { forgetUpload } from "./uploads";
import { useEdit } from "./use-edit";

/**
 * editor-screen.tsx — the editor page (spec 2026-11-24-editor-screens-design.md §3 screens 2-5 and 9-12, §5.1, §5.2, E1, E8,
 * E19-E21; plan 2026-11-24-editor-screens-a, Task 15): it picks the state (`pageStateOf`) and lays the page out, one tree for
 * phone and desktop placed by CSS, so the video is never mounted again on a resize. Phone: the header in the band, the video
 * (`--stage-h`: at least half the screen, 254 × 452 on a 393 × 852 phone) held at the top while the conversation moves under it,
 * the field docked at the bottom. From md up: the video and its scrubber on the left, the tools, the conversation and the field on
 * the right (348 and up to 500, 52 apart). The page scrolls itself: the app's `<main>` has a padded top a sticky video would slide
 * under. Kept from the dev page: the playhead's place across a change, a first cut standing half a second in, a failed request
 * back in the field, an export of the exact version asked for.
 */

/** Two words for the looks' pictures until the take's own are known. */
const STAND_IN_WORDS = ["go", "now"];

function WaitLine({ label, right, share }: { label: string; right: string | null; share: number | null }) {
  const value = share === null ? null : Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <div data-part="wait" className="flex flex-col gap-2 px-0.5">
      <div className="flex justify-between gap-3 text-ui">
        <span className="font-[640] text-foreground">{label}</span>
        {right !== null && <span className="text-foreground-secondary">{right}</span>}
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} className="h-1 overflow-hidden rounded-full bg-surface-sunken">
        {value === null ? (
          <div className="h-full w-full animate-pulse rounded-full bg-action/30 motion-reduce:animate-none" />
        ) : (
          <div className="h-full rounded-full bg-action" style={{ width: `${value}%` }} />
        )}
      </div>
    </div>
  );
}

/** One line and the way Home; the back-to-Library marker is dropped, as the result page's dead end drops it. */
function DeadEnd({ line }: { line: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-24 text-center">
      <p className="text-title font-[640] text-foreground">{line}</p>
      <Button
        variant="secondary"
        onClick={() => {
          useShellStore.getState().setThreadBack(null);
          router.push("/home");
        }}
      >
        Home
      </Button>
    </div>
  );
}

/** A button that opens the device's picker for another take (MP4 or MOV), clicked inside the tap. */
function PickAgain({ label, disabled, onFile }: { label: string; disabled: boolean; onFile(file: File): void }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="primary" disabled={disabled} onClick={() => picker.current?.click()}>
        {label}
      </Button>
      <input
        ref={picker} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" aria-label="Choose a video file" tabIndex={-1} className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

export function EditorScreen({ id, pollMs }: { id: string; pollMs?: number }) {
  const api = useEdit(id, pollMs === undefined ? {} : { pollMs });
  const { session, state, controls, upload, reading } = api;
  const view = session.view;
  const take = view?.take ?? null;

  // The edit on the stage, kept per turn: a poll's fresh copy of the same turn does not touch the Player.
  const [onStage, setOnStage] = useState<{ turn: number; edit: Edit } | null>(null);
  if (view && view.shown !== null && view.edit && onStage?.turn !== view.shown) setOnStage({ turn: view.shown, edit: view.edit });
  if (view && view.shown === null && onStage !== null) setOnStage(null);
  const shown = onStage?.edit ?? null;

  // The take's preview address as first given (signed for two hours): a fresh one at each read would reload the Player's video.
  const [kept, setKept] = useState<{ id: string; url: string } | null>(null);
  if (take?.previewUrl && kept?.id !== take.id) setKept({ id: take.id, url: take.previewUrl });
  const urls = useMemo(() => (kept ? { [kept.id]: kept.url } : {}), [kept]);

  // What the browser reads of the device's copy: its length (the analysis's estimate) and a frame (the looks' pictures).
  const meta = useVideoMeta(upload?.file ?? null);
  const poster = take?.posterUrl ?? meta.thumbnail;
  const words = useMemo(() => {
    const heard = take?.asset?.kind === "video" ? (take.asset.words ?? []).slice(0, 2).map((word) => word.text) : [];
    return heard.length === 2 ? heard : STAND_IN_WORDS;
  }, [take]);

  // The playhead: where the Player is, and where it goes when the edit on the stage changes (`playheadAfter`).
  const stage = useRef<StageHandle>(null);
  const at = useRef(0);
  const [frame, setFrame] = useState(0);
  const [takeFrames, setTakeFrames] = useState(0);
  const onFrame = useCallback((next: number) => {
    at.current = next;
    setFrame(next);
  }, []);
  const still = useRef(false);
  const onPlay = useCallback(() => {
    if (!still.current) return;
    still.current = false;
    stage.current?.seek(0); // a first cut standing half a second in plays from its start
  }, []);
  const placed = useRef<{ stage: typeof onStage; edit: Edit | null }>({ stage: null, edit: null });
  const moved = session.moved;
  useEffect(() => {
    if (onStage === placed.current.stage) return;
    const before = placed.current.edit;
    placed.current = { stage: onStage, edit: onStage?.edit ?? null };
    if (onStage === null) return;
    const plan = playheadAfter(before, onStage.edit, at.current, moved);
    still.current = plan.still;
    stage.current?.seek(plan.frame);
    if (plan.play) stage.current?.play();
    else stage.current?.pause();
  }, [onStage, moved]);

  // The device's copy is let go once the cut plays from the take's preview.
  useEffect(() => {
    if (onStage !== null && upload !== null) forgetUpload(upload.takeId);
  }, [onStage, upload]);

  const [lookOpen, setLookOpen] = useState(false);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [text, setText] = useState("");
  const field = useRef<FieldHandle>(null);
  const panel = useRef<HTMLElement>(null);

  // The export: the Ready sheet opens once, when the export the page watched is made.
  const exported = view?.export ?? null;
  const made = exported?.status === "done" && exported.filmUrl !== null ? exported : null;
  const status = exported?.status ?? null;
  const [seen, setSeen] = useState(status);
  if (seen !== status) {
    setSeen(status);
    if (status === "done" && seen !== null && LIVE_JOB.has(seen)) setReadyOpen(true);
  }

  const send = async (request: string) => {
    setText("");
    setChecking(false);
    if (!(await api.ask(request))) setText((now) => (now === "" ? request : now)); // what was asked is not lost
  };
  const onChip = (chip: NextChip) => {
    if (chip.kind === "check") return setChecking((now) => !now);
    if (chip.kind === "style") return void api.applyVideoStyle();
    void send(chip.text);
  };
  const show = (target: number) => {
    stage.current?.pause();
    stage.current?.seek(target);
    document.getElementById("edit-stage")?.scrollIntoView({ block: "nearest" });
  };

  const findings = view?.turns.at(-1)?.findings ?? [];
  const filmSeconds = shown ? filmFrames(shown) / FPS : 0;
  const lastCut = view ? view.turns.map((turn) => turn.kind).lastIndexOf("cut") : -1;
  const changedSinceCut = !!view && view.turns.slice(lastCut + 1).some((turn) => turn.doc);
  const problem = session.problem;
  const again = problem && (problem.request !== null || state === "cutting") ? api.retry : null;
  const shownProblem = problem
    ? { text: problem.text, again }
    : exported?.status === "failed"
      ? { text: "The video could not be made.", again: () => void api.startExport() }
      : null;
  const takeSeconds = meta.durationSec ?? (takeFrames > 0 ? takeFrames / FPS : null);
  const ready = state === "ready" || state === "exporting";

  const waiting =
    state === "cutting" ? (
      <WaitLine label="Making the first cut" right={null} share={null} />
    ) : take?.status === "uploading" ? (
      <WaitLine label="Uploading" right={upload?.secondsLeft != null ? `${waitWords(upload.secondsLeft)} left` : null} share={upload && upload.total > 0 ? upload.sent / upload.total : null} />
    ) : (
      <WaitLine label="Listening to it" right={takeSeconds === null ? null : waitWords(analysisSeconds(takeSeconds) * (1 - (take?.progress ?? 0)))} share={take?.progress ?? null} />
    );

  let body: React.ReactNode = null;
  if (state === "upload stopped") {
    body = (
      <div className="flex flex-col items-start gap-3 px-0.5">
        <p className="text-title font-[640] text-foreground">The upload stopped.</p>
        <div className="flex gap-2">
          <PickAgain label="Pick the video again" disabled={session.working !== null} onFile={(file) => void api.replaceTake(file)} />
          {upload?.status === "failed" && (
            <Button variant="secondary" onClick={api.retry}>
              Try again
            </Button>
          )}
        </div>
        {problem && <p role="alert" className="text-meta text-foreground-secondary">{problem.text}</p>}
      </div>
    );
  } else if (state === "take failed") {
    body = (
      <div className="flex flex-col items-start gap-3 px-0.5">
        <p className="text-title font-[640] text-foreground">{sentence(take?.error ?? "that take could not be analysed")}</p>
        <PickAgain label="Use another video" disabled={session.working !== null} onFile={(file) => void api.replaceTake(file)} />
        {problem && <p role="alert" className="text-meta text-foreground-secondary">{problem.text}</p>}
      </div>
    );
  } else if (state === "getting ready" || state === "cutting") {
    body = (
      <div className="flex flex-col gap-5">
        {waiting}
        {problem && (
          <p role="alert" className="px-0.5 text-meta text-foreground-secondary">
            {problem.text}{" "}
            {again && (
              <button type="button" onClick={again} className="tap-44 font-[600] text-foreground">
                Try again
              </button>
            )}
          </p>
        )}
        {state === "getting ready" && <LookRow picked={lookKeyOfStyle(session.waitLook)} poster={poster} words={words} onPick={api.setWaitLook} />}
      </div>
    );
  } else if (ready && view) {
    body = (
      <>
        <div data-part="tools" className="flex items-center gap-2">
          <Chip disabled={!controls.tools} aria-haspopup="dialog" onClick={() => setLookOpen(true)} className="[&_svg]:size-4">
            <LookIcon aria-hidden />
            Look
          </Chip>
          <Chip disabled={!controls.tools} aria-haspopup="dialog" onClick={() => setCaptionsOpen(true)} className="[&_svg]:size-4">
            <CaptionsIcon aria-hidden />
            Captions
          </Chip>
        </div>
        {controls.exporting && exported ? (
          <ExportPanel shown={exported} filmSeconds={filmSeconds} onCancel={() => void api.cancelExport()} cancelling={session.working?.what === "cancel"} />
        ) : (
          <EditorThread
            turns={view.turns} pending={session.working?.what === "change" ? session.working.request : null}
            undoable={view.undo !== null} onUndo={() => view.undo !== null && void api.move(view.undo)}
            chips={chipsOf(view, reading.status === "ready")} onChip={onChip}
            checking={checking} findings={findings} onShow={show} problem={shownProblem} disabled={!controls.ask}
          />
        )}
        {reading.status === "reading" && <p role="status" className="px-0.5 text-meta text-foreground-secondary">{`Reading the video's style. ${reading.line ?? ""}`}</p>}
        {reading.status === "failed" && <p role="alert" className="px-0.5 text-meta text-foreground-secondary">{reading.problem}</p>}
      </>
    );
  }

  const dead = state === "not here" || state === "closed";
  return (
    <div
      data-part="editor" data-state={state}
      className="flex h-[calc(100dvh-env(safe-area-inset-top)-var(--mobile-nav-band,46px))] flex-col overflow-y-auto [--stage-h:min(53dvh,calc((100vw-32px)*16/9))] md:h-dvh md:[--stage-h:clamp(360px,calc(100dvh-180px),720px)]"
    >
      <EditorHeader
        title={view?.title ?? ""} canUndo={controls.undo} canRedo={controls.redo}
        onUndo={() => view?.undo != null && void api.move(view.undo)} onRedo={() => view?.redo != null && void api.move(view.redo)}
        exportLabel={controls.exporting ? "Exporting" : "Export"} exportOn={controls.exportOn}
        onExport={() => (made ? setReadyOpen(true) : void api.startExport())}
      />
      {dead ? (
        <DeadEnd line={state === "closed" ? "The editor is not open to this account yet." : "This edit is not here."} />
      ) : (
        <div className="mx-auto grid w-full max-w-[1000px] flex-1 grid-cols-1 content-start gap-x-[52px] px-4 md:grid-cols-[auto_minmax(300px,500px)] md:justify-center md:px-6">
          <section aria-label="Your video" className="sticky top-0 z-10 -mx-4 flex flex-col items-center gap-1 bg-background px-4 pb-2 pt-1 md:static md:mx-0 md:px-0 md:pt-0">
            <EditorStage
              ref={stage} edit={shown} urls={urls} source={shown ? null : (upload?.localUrl ?? take?.previewUrl ?? null)} poster={poster}
              onFrame={onFrame} onFrames={setTakeFrames} onPlay={onPlay} className="h-[var(--stage-h)] max-w-full"
            />
            {shown && (
              <div className="w-[calc(var(--stage-h)*9/16)] max-w-full">
                <EditorScrubber frames={filmFrames(shown)} frame={frame} marks={findings.map((finding) => finding.where.frame)} disabled={!controls.tools && !controls.exporting} onSeek={(target) => stage.current?.seek(target)} />
              </div>
            )}
          </section>
          <section ref={panel} tabIndex={-1} aria-label="Your edit" className="flex min-w-0 flex-col gap-3 pb-3 pt-2 outline-none md:max-h-[calc(var(--stage-h)+60px)] md:pt-0">
            <div className="flex min-h-0 flex-col gap-3 md:overflow-y-auto">{body}</div>
            {ready && (
              <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-background px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:px-0 md:pb-0">
                <EditorField ref={field} text={text} onText={setText} onSend={(request) => void send(request)} disabled={!controls.ask} sending={session.working?.what === "change"} />
              </div>
            )}
          </section>
        </div>
      )}
      {view && (
        <LookSheet
          open={lookOpen} onOpenChange={setLookOpen} picked={view.look} poster={poster} words={words} changed={changedSinceCut} disabled={!controls.tools}
          onPick={(look) => void api.cut(look)} reading={reading} onReadVideo={api.readVideo}
        />
      )}
      {shown && take && (
        <CaptionsSheet open={captionsOpen} onOpenChange={setCaptionsOpen} edit={shown} takeId={take.id} disabled={!controls.tools} onOps={api.ops} onSeek={(target) => stage.current?.seek(target)} />
      )}
      {made && made.filmUrl && (
        <ReadySheet
          open={readyOpen} onOpenChange={setReadyOpen} filmUrl={made.filmUrl} poster={take?.posterUrl ?? null}
          seconds={made.ms === null ? filmSeconds : made.ms / 1000} sound={take?.asset?.kind === "video" ? take.asset.sound : true}
        />
      )}
    </div>
  );
}
```

`src/app/(app)/edit/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorScreen } from "@/components/editor/editor-screen";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit | Maven" };

/**
 * `/edit/[id]`: the editor of one edit (spec 2026-11-24-editor-screens-design.md E1; plan 2026-11-24-editor-screens-a, Task 15).
 * New look only: with the flag off this address does not exist. Its routes are behind the edit tool's gate; the page says so.
 */
export default async function EditPage({ params }: PageProps) {
  if (!NEW_LOOK_ENABLED) notFound();
  const { id } = await params;
  return <EditorScreen id={id} />;
}
```

`src/components/shell/next-shell.tsx`: line 66 becomes

```tsx
    if (pathname === "/home" || pathname.startsWith("/simulation/") || pathname.startsWith("/edit/")) return;
```

and above line 99 add `const ownHeader = pathname.startsWith("/edit/");` (after `const showBar = …` at line 85) with the comment `// The editor draws its own header in the band: Back, Undo, Redo and Export (E19), more than the pushed header's one action.`; line 99 becomes `{!showBar && !ownHeader && (`. The comment block above the `useLayoutEffect` (lines 56-63) gains: "An edit opened from the chat keeps it too (plan 2026-11-24-editor-screens-a)."

`src/lib/supabase/middleware.ts` line 35 becomes:

```ts
  // You (plan 2026-11-24-you) and the editor (plan 2026-11-24-editor-screens-a) exist under the new look only; with the flag off the list is as before.
  ...(NEW_LOOK_ENABLED ? ["/you", "/edit"] : []),
```

(and the comment on line 34 goes, being replaced by this one).

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/ "src/app/(app)/edit/" src/components/shell/__tests__/ src/lib/supabase/__tests__/ && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/ "src/app/(app)/edit/" src/components/shell/next-shell.tsx src/lib/supabase/middleware.ts`.

- [ ] Step 5: Commit: `git add src/components/editor/editor-header.tsx src/components/editor/editor-screen.tsx "src/app/(app)/edit/[id]/page.tsx" src/components/shell/next-shell.tsx src/lib/supabase/middleware.ts src/components/editor/__tests__/editor-screen.test.tsx src/components/editor/__tests__/editor-guard.test.ts "src/app/(app)/edit/[id]/__tests__/page.test.ts" src/components/shell/__tests__/next-shell-editor.test.tsx src/lib/supabase/__tests__/middleware.edit.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(editor): the editor page, its states, phone and desktop, in the shell" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 16: The door on Home: six cards, Edit beside Simulate, one send branch

**Files:**
- Create: `src/components/editor/start-edit.ts`, `src/components/editor/use-edit-open.ts`
- Modify: `src/components/home-next/home-screen.tsx:17` (imports), `:46-61` (`HomeSkillId`, `HOME_SKILLS`, `ICON_BY_SKILL`), `:82-93` (props), `:175-187` (signature), `:232-253` (the cards and More); `src/components/home-next/home-next.tsx:106-114` (props), `:159-172` (`HomeScreen` call); `src/components/thread-next/thread-field.tsx:42-48` (`FieldHome`, `FieldTool`), `:75-77` (props), `:81-86` (`FIELD_TOOLS`), `:169-204` (destructure, picker ref), `:247-262` (focus, `takeVideo`), `:301` (`addVideoPill`), `:506-533` (the picked row), `:580-596` (the pills); `src/components/thread-next/field-copy.ts:21-25`; `src/components/app/home/composer-controls.tsx:48-61` (`ToolId`), `:104` (`SKILLS`), `:181-217` (`ICONS`), `:221-235` (`SKILL_ICON`), `:246-260` (`VERB_BY_TOOL`); `src/components/app/home/v8/skills-panel.tsx:45-63` (`PROMISE_BY_TOOL`); `src/components/app/home/composer.tsx:122` (imports), `:259-283` (`PLACEHOLDER_BY_TOOL`), `:392` (after `const router = useRouter();`), `:2132` (after `const tool = toolOverride ?? activeTool;`), `:4173-4182` (placeholder), `:4274-4284` (`video`, `onVideoChange`), `:4323-4331` (`home`), `:4655` (`onPickSkill`); `src/components/home-next/__tests__/home-screen.test.tsx:81-88` (the skill list is now five), `src/components/thread-next/__tests__/slash-menu.test.tsx:55` (Home's cards in the `/` list, but Edit)
- Test: `src/components/editor/__tests__/start-edit.test.ts`, `src/components/home-next/__tests__/home-screen-edit.test.tsx`, `src/components/thread-next/__tests__/thread-field-edit.test.tsx`, `src/components/app/home/__tests__/composer-edit.flag-on.test.tsx`

**Interfaces:** Consumes: `sendTake`, `editTakeProblem` (Task 9); `call`, `problemOf` (Task 9); `validateVideoFile` (`src/lib/video-file.ts`); `GET /api/edit/open` (Task 6); `ScissorsIcon`, `MoreIcon` (Task 4); `getSkill` (`composer-controls.tsx`); the composer's `handleUserSelectTool(id: ToolId)` (`composer.tsx:513`), `setSubmitError`, `setSubmitting`, `setFile`, `setActiveTool`, `DEFAULT_TOOL`, `router`, `file`, `activeTool`, `nextHomeShown`. Produces:
- `start-edit.ts`: `simulates(file: Pick<File, "name" | "type" | "size">): boolean`; `stageableVideo(file: File): string | null`; `videoSkillOf(file: Pick<File, "name" | "type" | "size">, picked: string, editOpen: boolean): "test" | "edit"`; `sendToEditor(file: File | null, push: (href: string) => void): Promise<{ ok: true; id: string } | { ok: false; problem: string }>`.
- `use-edit-open.ts`: `useEditOpen(): boolean`.
- `HomeSkillId` gains `"edit"`; `HOME_SKILLS` five; `HomeScreenProps.editOpen?: boolean`; `HomeNextProps.editOpen?: boolean`.
- `ThreadFieldProps` gains `editOpen?: boolean`, `pickerRef?: React.RefObject<HTMLInputElement | null>`, `validateVideo?(file: File): string | null`; `FieldHome.videoSkill?: { picked: "test" | "edit"; simulate: boolean; onPick(id: "test" | "edit"): void } | null`.
- `ToolId` gains `"edit"` (`SKILLS` row `enabled: false`); `NEXT_EDIT_PLACEHOLDER`, `videoPlaceholder(tool: "test" | "edit", staged: boolean): string` (`field-copy.ts`).

Flag off stays as it is: `useEditOpen` asks nothing without the new look (`enabled: NEW_LOOK_ENABLED`); `edit` is `enabled: false` in `SKILLS`, so no legacy menu, the v8 panel or the `/` list shows it; the legacy composer never arms it. The guards `composer-gone-chat.flag-off.test.tsx`, `next-look-parity.test.tsx` and the v8 `skills-panel.test.tsx` run unchanged in Step 4.

- [ ] Step 1: Write the failing tests, and change the two existing assertions the new card changes.

In `src/components/thread-next/__tests__/slash-menu.test.tsx` line 55 becomes (the `/` list is open to everyone and the editor is not, so Edit is in no `/` list; it is reached by its card and the field's pill, where the account may use it):

```tsx
    for (const home of HOME_SKILLS.filter((skill) => skill.id !== "edit")) {
```

In `src/components/home-next/__tests__/home-screen.test.tsx` lines 81-88 become:

```tsx
  it("the skill list is the five, with the ids the composer arms (Edit shown only where the editor is open)", () => {
    expect(HOME_SKILLS.map((s) => [s.id, s.label])).toEqual([
      ["test", "Simulate"],
      ["edit", "Edit"],
      ["hooks", "Hooks"],
      ["script", "Script"],
      ["remix", "Remix"],
    ]);
  });
```

`src/components/editor/__tests__/start-edit.test.ts`:

```ts
/** start-edit.test.ts — the door's rules (plan 2026-11-24-editor-screens-a, Task 16): which skill a staged video is, and the send. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetUpload } from "../uploads";
import { sendToEditor, simulates, stageableVideo, videoSkillOf } from "../start-edit";

const TAKE = "22222222-2222-4222-8222-222222222222";
const EDIT = "55555555-5555-4555-8555-555555555555";
const sized = (name: string, type: string, megabytes: number) => ({ name, type, size: megabytes * 1024 * 1024 }) as File;

afterEach(() => {
  forgetUpload(TAKE);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a staged video", () => {
  it("is staged when either skill takes it, else refused in Simulate's words", () => {
    expect(stageableVideo(sized("clip.mp4", "video/mp4", 20))).toBeNull();
    expect(stageableVideo(sized("IMG_0042.MOV", "video/quicktime", 900))).toBeNull();
    expect(stageableVideo(sized("clip.webm", "video/webm", 900))).toMatch(/^File too large/);
  });

  it("is an Edit when Edit was picked or only Edit takes it, and a Simulate otherwise or with the editor closed", () => {
    expect(simulates(sized("clip.mp4", "video/mp4", 20))).toBe(true);
    expect(videoSkillOf(sized("clip.mp4", "video/mp4", 20), "chat", true)).toBe("test");
    expect(videoSkillOf(sized("clip.mp4", "video/mp4", 20), "edit", true)).toBe("edit");
    expect(videoSkillOf(sized("IMG_0042.MOV", "video/quicktime", 900), "test", true)).toBe("edit");
    expect(videoSkillOf(sized("IMG_0042.MOV", "video/quicktime", 900), "edit", false)).toBe("test");
  });
});

describe("sendToEditor", () => {
  it("signs for the take, starts its upload, makes the edit and opens its page", async () => {
    const asked: { path: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
      asked.push({ path: String(path), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (path === "/api/edit/takes") return new Response(JSON.stringify({ take: { id: TAKE }, uploadUrl: "https://r2.test/put" }), { status: 201 });
      if (path === "/api/edit/edits") return new Response(JSON.stringify({ id: EDIT, threadId: "t" }), { status: 201 });
      return new Response("{}", { status: 202 });
    }));
    vi.stubGlobal("XMLHttpRequest", class {
      upload = { onprogress: null };
      onload = null;
      onerror = null;
      status = 0;
      open() {}
      setRequestHeader() {}
      send() {}
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local/1");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const push = vi.fn();
    expect(await sendToEditor(new File([new Uint8Array(10)], "IMG_0042.MOV", { type: "video/quicktime" }), push)).toEqual({ ok: true, id: EDIT });
    expect(asked.map((one) => one.path)).toEqual(["/api/edit/takes", "/api/edit/edits"]);
    expect(asked[1]?.body).toEqual({ take: TAKE });
    expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`);
  });

  it("says why it cannot, with no video, or a file the editor does not take", async () => {
    expect(await sendToEditor(null, vi.fn())).toEqual({ ok: false, problem: "Add a video to edit." });
    expect(await sendToEditor(new File([new Uint8Array(10)], "clip.webm", { type: "video/webm" }), vi.fn())).toEqual({ ok: false, problem: "A video to edit is an MP4 or a MOV file." });
  });
});
```

`src/components/home-next/__tests__/home-screen-edit.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/** home-screen-edit.test.tsx — Home's six cards for an account the editor is open to (plan 2026-11-24-editor-screens-a, Task 16; E3, E11). */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { HomeScreen, type HomeScreenProps } from "../home-screen";

afterEach(cleanup);

const props = (more: Partial<HomeScreenProps> = {}): HomeScreenProps => ({
  greeting: "Good evening, Nia.", avatar: null, initials: "NC", credits: null, field: <div />, picked: false,
  onPickSkill: vi.fn(), recent: [], onOpenThread: vi.fn(), recentOnDesktop: false, onMore: vi.fn(), ...more,
});
const cards = () => within(screen.getByRole("list", { name: "Skills" })).getAllByRole("button");

describe("Home's cards", () => {
  it("are six where the editor is open: Simulate, Edit, Hooks, Script, Remix, More", () => {
    const shown = props({ editOpen: true });
    render(<HomeScreen {...shown} />);
    expect(cards().map((card) => card.getAttribute("aria-labelledby") && document.getElementById(card.getAttribute("aria-labelledby")!)?.textContent)).toEqual(["Simulate", "Edit", "Hooks", "Script", "Remix", "More"]);
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAccessibleDescription("A raw take to a finished video");
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(shown.onPickSkill).toHaveBeenCalledWith("edit");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(shown.onMore).toHaveBeenCalled();
  });

  it("are the four and More skills, as before, where it is not", () => {
    render(<HomeScreen {...props()} />);
    expect(cards()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByRole("button", { name: "More skills" })).toBeInTheDocument();
  });
});
```

`src/components/thread-next/__tests__/thread-field-edit.test.tsx` (props as `thread-field-home.test.tsx:21-62`):

```tsx
/** @vitest-environment happy-dom */
/**
 * thread-field-edit.test.tsx — the field with the editor open (plan 2026-11-24-editor-screens-a, Task 16): a staged video offers
 * Simulate and Edit, a take only Edit can take staged (past Simulate's 200 MB), the Edit pill in a thread, the picker a caller opens.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { ToolId } from "@/components/app/home/composer-controls";
import { ThreadField, type FieldHome, type ThreadFieldProps } from "../thread-field";

const home = (over: Partial<FieldHome> = {}): FieldHome => ({ audience: { label: "@nia.tests", open: false, onOpen: vi.fn() }, picked: null, onClearPicked: vi.fn(), ...over });
const props = (over: Partial<ThreadFieldProps> = {}): ThreadFieldProps => ({
  value: "", onChange: vi.fn(), onKeyDown: vi.fn(), onSubmit: vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault()),
  tool: "chat" as ToolId, onSelectTool: vi.fn(), priceOf: () => null, canSend: false, busy: false, online: true, streaming: false, onStop: vi.fn(),
  video: null, onVideoChange: vi.fn(), evidence: null, onRemoveEvidence: vi.fn(), onDropFile: vi.fn(), errors: [],
  placeholder: "Ask anything, or pick a skill", ariaLabel: "Ask anything about your content", sendLabel: "Send message", onOpenMore: vi.fn(), moreOpen: false, ...over,
});
const take = (megabytes: number) => {
  const file = new File(["x"], "IMG_0042.MOV", { type: "video/quicktime" });
  Object.defineProperty(file, "size", { value: megabytes * 1024 * 1024 });
  return file;
};

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the field with the editor open", () => {
  it("offers Simulate or Edit for a staged video, Simulate off for a file it cannot take", () => {
    const onPick = vi.fn();
    render(<ThreadField {...props({ tool: "edit", video: take(300), home: home({ picked: { label: "Edit", price: null }, videoSkill: { picked: "edit", simulate: false, onPick } }) })} />);
    const choice = screen.getByRole("group", { name: "What to do with this video" });
    expect(within(choice).getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(within(choice).getByRole("button", { name: "Simulate" })).toBeDisabled();
    expect(document.querySelector('[data-part="picked-skill"]')).toBeNull();
  });

  it("stages a take past Simulate's 200 MB when told the edit tool's check, and refuses it with Simulate's", () => {
    const onVideoChange = vi.fn();
    const { unmount } = render(<ThreadField {...props({ home: home(), onVideoChange, validateVideo: () => null })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).toHaveBeenCalledTimes(1);
    unmount();
    render(<ThreadField {...props({ home: home(), onVideoChange })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toMatch(/File too large/);
  });

  it("shows the Edit pill in a thread only where the editor is open, and gives its picker to the caller", () => {
    const picker = createRef<HTMLInputElement>();
    const { unmount } = render(<ThreadField {...props({ editOpen: true, pickerRef: picker })} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(picker.current).toBe(screen.getByLabelText("Choose a video file"));
    unmount();
    render(<ThreadField {...props()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
```

`src/components/app/home/__tests__/composer-edit.flag-on.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * The door to the editor on Home (plan 2026-11-24-editor-screens-a, Task 16; spec §3 screen 1, E3, E11): the real composer, Home and
 * field. Stand-ins only for what cannot run here: the network (`fetch`, `/api/edit/open` answering for the account), the router,
 * the storage client, object URLs and the R2 upload (`XMLHttpRequest`). The setup is `composer-home.flag-on.test.tsx`'s.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/flags/concept-v8", () => ({ CONCEPT_V8_ENABLED: true }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({}), usePathname: () => "/home", useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    storage: { from: () => ({ upload: vi.fn(), remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "../composer";
import { forgetUpload } from "@/components/editor/uploads";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

const TAKE = "22222222-2222-4222-8222-222222222222";
const EDIT = "55555555-5555-4555-8555-555555555555";
let open = true;
let asked: { url: string; body: unknown }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  open = true;
  asked = [];
  push.mockReset();
  useShellStore.setState({ fieldFocusSignal: 0, threadBack: null, threadTitleHint: null, libraryScroll: null });
  useBoardStore.setState({ activeThreadId: null });
  document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("XMLHttpRequest", class {
    upload = { onprogress: null };
    onload = null;
    onerror = null;
    status = 0;
    open() {}
    setRequestHeader() {}
    send() {}
  });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (url.includes("/api/edit/open")) return json({ open });
    if (url === "/api/edit/takes") return json({ take: { id: TAKE }, uploadUrl: "https://r2.test/put" }, 201);
    if (url === "/api/edit/edits") return json({ id: EDIT, threadId: "t-edit" }, 201);
    if (url.includes("/api/threads/open")) return json({ messages: [] });
    if (url.includes("/api/threads/list")) return json({ threads: [] });
    if (url.includes("/api/threads/library")) return json({ chats: [], next: null });
    if (url.includes("/api/audiences")) return json({ audiences: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    return json({});
  }));
});
afterEach(() => {
  forgetUpload(TAKE);
  cleanup();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderHome() {
  renderWithClient(<Composer />);
  await screen.findByTestId("home-next");
}
const picker = () => screen.getByLabelText<HTMLInputElement>("Choose a video file");
const take = (megabytes: number) => {
  const file = new File(["x"], "IMG_0042.MOV", { type: "video/quicktime" });
  Object.defineProperty(file, "size", { value: megabytes * 1024 * 1024 });
  return file;
};

describe("Home's door to the editor", () => {
  it("shows six cards to an account the editor is open to; Edit opens the picker inside the tap", async () => {
    await renderHome();
    const edit = await screen.findByRole("button", { name: "Edit" });
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
    const click = vi.spyOn(picker(), "click");
    fireEvent.click(edit);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("stages a take Simulate cannot take as an Edit, and sends it to the editor's page", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Edit" });
    fireEvent.change(picker(), { target: { files: [take(300)] } });
    const choice = await screen.findByRole("group", { name: "What to do with this video" });
    expect(within(choice).getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(within(choice).getByRole("button", { name: "Simulate" })).toBeDisabled();
    fireEvent.submit(screen.getByTestId("thread-field"));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    expect(asked.find((one) => one.url === "/api/edit/takes")?.body).toEqual({ name: "IMG_0042.MOV", bytes: 300 * 1024 * 1024, type: "video/quicktime" });
    expect(asked.find((one) => one.url === "/api/edit/edits")?.body).toEqual({ take: TAKE });
  });

  it("shows no door to an account it is not open to: the four cards and More skills", async () => {
    open = false;
    await renderHome();
    await waitFor(() => expect(asked.some((one) => one.url.includes("/api/edit/open"))).toBe(true));
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByRole("button", { name: "More skills" })).toBeInTheDocument();
  });
});
```

- [ ] Step 2: Run them, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/start-edit.test.ts src/components/home-next/__tests__/ src/components/thread-next/__tests__/thread-field-edit.test.tsx src/components/app/home/__tests__/composer-edit.flag-on.test.tsx` → `Failed to resolve import "../start-edit"`; the home-screen list assertion (`["edit", "Edit"]` missing); `editOpen`, `videoSkill`, `validateVideo` unknown props (no Edit card, no group).

- [ ] Step 3: Implement.

`src/components/editor/start-edit.ts`:

```ts
"use client";

/**
 * start-edit.ts — the door to the editor (spec §3 screen 1, E3, E11; plan 2026-11-24-editor-screens-a, Task 16). A video staged in
 * Home's field may be simulated or edited: it is staged when either takes it (Simulate's 200 MB is not the editor's 2 GB), armed
 * as an Edit when Edit was picked or only Edit takes it, and sent with Edit: the edit tool's checks, the take signed for and its
 * upload started (it goes on while the app moves), the edit made with its chat, then its page. The composer calls this from one
 * branch of its send.
 */
import { validateVideoFile } from "@/lib/video-file";
import { call, problemOf } from "./net";
import { editTakeProblem, sendTake } from "./take-file";

/** Whether Simulate takes this file (its own checks). */
export function simulates(file: Pick<File, "name" | "type" | "size">): boolean {
  return validateVideoFile(file as File) === null;
}

/** The field's check of a picked or dropped video with the editor open: staged when either skill takes it, else Simulate's words. */
export function stageableVideo(file: File): string | null {
  const simulate = validateVideoFile(file);
  return simulate === null || editTakeProblem(file) === null ? null : simulate;
}

/** The skill a staged video is armed with. */
export function videoSkillOf(file: Pick<File, "name" | "type" | "size">, picked: string, editOpen: boolean): "test" | "edit" {
  if (!editOpen) return "test";
  return picked === "edit" || !simulates(file) ? "edit" : "test";
}

export async function sendToEditor(file: File | null, push: (href: string) => void): Promise<{ ok: true; id: string } | { ok: false; problem: string }> {
  if (!file) return { ok: false, problem: "Add a video to edit." };
  const sent = await sendTake(file);
  if (!sent.ok) return sent;
  const made = await call<{ id: string; threadId: string }>("/api/edit/edits", { take: sent.takeId });
  if (!made.ok) return { ok: false, problem: problemOf(made) };
  push(`/edit/${made.body.id}`);
  return { ok: true, id: made.body.id };
}
```

`src/components/editor/use-edit-open.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/**
 * use-edit-open.ts — whether the editor is open to this account (`GET /api/edit/open`; spec E11; plan
 * 2026-11-24-editor-screens-a, Task 16): asked once a session, under the new look only; closed until it answers, and on any failure,
 * so nobody meets a door that is shut.
 */
export function useEditOpen(): boolean {
  const asked = useQuery({
    queryKey: ["edit", "open"],
    queryFn: async () => {
      const response = await fetch("/api/edit/open", { cache: "no-store" });
      if (!response.ok) return false;
      return ((await response.json()) as { open?: unknown }).open === true;
    },
    enabled: NEW_LOOK_ENABLED,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return asked.data === true;
}
```

`src/components/home-next/home-screen.tsx`:
- line 17 becomes `import { DocIcon, LoopIcon, MoreIcon, PenIcon, PulseIcon, ScissorsIcon } from "@/components/thread-next/field-icons";`
- lines 46-61 become:

```tsx
export type HomeSkillId = "test" | "edit" | "hooks" | "script" | "remix";

/** The skills, in the drawn order. "Simulate" is the video test (`test`); Edit only for an account the editor is open to. */
export const HOME_SKILLS: ReadonlyArray<{ id: HomeSkillId; label: string; line: string }> = [
  { id: "test", label: "Simulate", line: "See who keeps watching" },
  { id: "edit", label: "Edit", line: "A raw take to a finished video" },
  { id: "hooks", label: "Hooks", line: "Openings for an idea" },
  { id: "script", label: "Script", line: "A full script, timed" },
  { id: "remix", label: "Remix", line: "Rebuild a proven video" },
];

const ICON_BY_SKILL: Record<HomeSkillId, ShellIcon> = {
  test: PulseIcon,
  edit: ScissorsIcon,
  hooks: PenIcon,
  script: DocIcon,
  remix: LoopIcon,
};
```

- in `HomeScreenProps` (after `onMore(): void;`) add `editOpen?: boolean;                    // the editor is open to this account: six cards, More the sixth (E3)`; in the destructure (line 186) add `editOpen = false,`.
- `SkillCard` (lines 95-119) gets its icon from a prop so More can be a card: its signature becomes `function SkillCard({ label, line, icon: Icon, onPick, popup = false }: { label: string; line: string; icon: ShellIcon; onPick(): void; popup?: boolean })`, its button's `onClick={() => onPick(id)}` becomes `onClick={onPick}` and it gains `aria-haspopup={popup ? "dialog" : undefined}`, and `const Icon = ICON_BY_SKILL[id];` goes.
- lines 232-253 (the cards and the "More skills" line) become:

```tsx
        {!picked && (
          <>
            {/* Six for an account the editor is open to (E3): Simulate, Edit, Hooks, Script, Remix, and More as the sixth card;
                else the four and the "More skills" line, as before (no closed door, E11). */}
            <ul aria-label="Skills" className={cn("mt-3 grid grid-cols-2 gap-2 @min-[760px]:mt-[18px] @min-[760px]:gap-4", editOpen ? "@min-[760px]:grid-cols-3" : "@min-[760px]:grid-cols-4")}>
              {HOME_SKILLS.filter((skill) => skill.id !== "edit" || editOpen).map((skill) => (
                <li key={skill.id} className="flex">
                  <SkillCard label={skill.label} line={skill.line} icon={ICON_BY_SKILL[skill.id]} onPick={() => pickSkill(skill.id)} />
                </li>
              ))}
              {editOpen && (
                <li className="flex">
                  <SkillCard label="More" line="Ideas, Explore, your account" icon={MoreIcon} popup onPick={onMore} />
                </li>
              )}
            </ul>
            {!editOpen && (
              // Ideas, Explore and Read my account: on Home otherwise only behind "/", which nobody types on a phone. The thread's
              // More sheet. `py-1` keeps the 44 px halo of `.tap-44` off the cards above (8 px away).
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={onMore}
                className="tap-44 mt-2 self-center py-1 text-ui text-foreground-secondary hover:text-foreground"
              >
                More skills
              </button>
            )}
          </>
        )}
```

`src/components/home-next/home-next.tsx`: `HomeNextProps` gains `editOpen?: boolean;`; the destructure becomes `{ field, credits, picked, onPickSkill, onMore, editOpen = false }`; the `HomeScreen` call gains `editOpen={editOpen}`.

`src/components/thread-next/field-copy.ts`, after `NEXT_SIMULATE_PLACEHOLDER` (line 25):

```ts
/** Edit's placeholder (plan 2026-11-24-editor-screens-a): waiting for a video, and with one staged. */
export const NEXT_EDIT_PLACEHOLDER = {
  empty: "Add a video to edit",
  video: "Send to edit this video",
} as const;

/** The placeholder of a skill that takes a video: Simulate's pair or Edit's. */
export function videoPlaceholder(tool: "test" | "edit", staged: boolean): string {
  const words = tool === "edit" ? NEXT_EDIT_PLACEHOLDER : NEXT_SIMULATE_PLACEHOLDER;
  return staged ? words.video : words.empty;
}
```

`src/components/thread-next/thread-field.tsx`:
- `FieldHome` (lines 42-46) gains:

```ts
  /** A video staged with the editor open (plan 2026-11-24-editor-screens-a): Simulate or Edit, in the picked skill's place.
   *  `simulate` false: Simulate cannot take this file (past its 200 MB). */
  videoSkill?: { picked: "test" | "edit"; simulate: boolean; onPick(id: "test" | "edit"): void } | null;
```

- line 48 becomes `type FieldTool = "test" | "edit" | "hooks" | "script" | "remix"; // the pills, in this order; Edit where the editor is open`
- after `home?: FieldHome | null;` (line 76) add:

```ts
  /** The editor is open to this account: the Edit pill in a thread's row (plan 2026-11-24-editor-screens-a). */
  editOpen?: boolean;
  /** The video picker's input, for a caller that opens it inside its own tap (Home's Edit card). */
  pickerRef?: React.RefObject<HTMLInputElement | null>;
  /** The check a picked or dropped video passes before it is staged; Simulate's (`validateVideoFile`) unless given. */
  validateVideo?(file: File): string | null;
```

- `FIELD_TOOLS` gains `{ id: "edit", label: "Edit" },` after Simulate.
- the destructure (after `home = null,`) gains `editOpen = false, pickerRef: givenPicker, validateVideo = validateVideoFile,`; line 204 becomes `const ownPicker = useRef<HTMLInputElement>(null);` followed by `const pickerRef = givenPicker ?? ownPicker;`.
- in the `pickedLabel` effect `if (tool === "test" && !video)` becomes `if ((tool === "test" || tool === "edit") && !video)`; in `takeVideo`, `validateVideoFile(file)` becomes `validateVideo(file)`; line 301 becomes `const addVideoPill = Boolean(home) && (tool === "test" || tool === "edit") && !video;`.
- the picked row (lines 506-533) is wrapped so a staged video with `home.videoSkill` shows the choice instead:

```tsx
            {video && home.videoSkill ? (
              <div role="group" aria-label="What to do with this video" className="flex gap-1.5 pb-1 pt-0.5">
                <Chip surface="card" selected={home.videoSkill.picked === "test"} disabled={!home.videoSkill.simulate} onClick={() => home.videoSkill?.onPick("test")} className={PILL}>
                  Simulate
                </Chip>
                <Chip surface="card" selected={home.videoSkill.picked === "edit"} onClick={() => home.videoSkill?.onPick("edit")} className={PILL}>
                  Edit
                </Chip>
              </div>
            ) : (
              home.picked && (
                /* the existing picked-skill row, lines 507-532, unchanged */
              )
            )}
```

  (the comment stands for the existing `<div className="flex pb-1 pt-0.5"> … </div>` block, moved inside the parentheses as it is).
- line 580 becomes `{FIELD_TOOLS.filter((pill) => pill.id !== "edit" || editOpen).map(({ id, label }) => {`, and in its click the focus rule `if (id === "test" && !selected && !video)` becomes `if ((id === "test" || id === "edit") && !selected && !video)`.

`src/components/app/home/composer-controls.tsx`:
- `ToolId` gains `| "edit"` after `| "test"`.
- after the `test` row of `SKILLS` (line 104):

```ts
  // The editor (plan 2026-11-24-editor-screens-a): reached under the new look by Home's Edit card and the field's Edit pill, for an
  // account the editor is open to. `enabled: false` keeps it out of every legacy menu, the v8 panel and the `/` list.
  { id: "edit",    label: "Edit",    desc: "A raw take to a finished video", command: "/edit",    group: "creator",   modes: ["socials"], model: "Flash", enabled: false },
```

- `ICONS` gains `scissors: '<circle cx="4.4" cy="4.8" r="1.8"/><circle cx="4.4" cy="11.2" r="1.8"/><path d="M5.9 5.8 13.6 11.2M5.9 10.2 13.6 4.8"/>',`; `SKILL_ICON` gains `edit: "scissors",`; `VERB_BY_TOOL` gains `edit: "Make",`.

`src/components/app/home/v8/skills-panel.tsx`, `PROMISE_BY_TOOL` gains `edit: "A raw take in, a finished video out: cut, captioned and labelled, then changed by asking.",`.

`src/components/app/home/composer.tsx`:
- after line 122 (`import { HomeNext } …`):

```ts
import { sendToEditor, simulates, stageableVideo, videoSkillOf } from "@/components/editor/start-edit";
import { useEditOpen } from "@/components/editor/use-edit-open";
```

  and in the import from `field-copy` (lines 116-121) `NEXT_SIMULATE_PLACEHOLDER,` gives way to `videoPlaceholder,` (Simulate's pair is now read through it; tsc's `noUnusedLocals` refuses the import left unused).
- `PLACEHOLDER_BY_TOOL` (lines 259-283) gains `edit: "Add a raw take to edit…", // never shown: Edit is in no legacy menu (enabled: false)`.
- after line 392 (`const router = useRouter();`):

```ts
  // The editor (plan 2026-11-24-editor-screens-a): whether it is open to this account, and the field's video picker, which Home's
  // Edit card clicks inside its own tap.
  const editOpen = useEditOpen();
  const videoPickerRef = useRef<HTMLInputElement | null>(null);
```

- after line 2132 (`const tool = toolOverride ?? activeTool;`):

```ts
    // The editor (plan 2026-11-24-editor-screens-a, Task 16): a staged video sent with Edit goes to its own page. No run here: the
    // upload and the edit are the editor's (`start-edit.ts`).
    if (tool === "edit") {
      setSubmitting(true);
      try {
        const sent = await sendToEditor(file, (href) => router.push(href));
        if (!sent.ok) return setSubmitError(sent.problem);
        setFile(null);
        setActiveTool(DEFAULT_TOOL);
      } finally {
        setSubmitting(false);
      }
      return;
    }
```

- lines 4173-4182 become:

```ts
    const placeholder =
      activeTool === "test" || activeTool === "edit"
        ? videoPlaceholder(activeTool, file !== null)
        : NEXT_PLACEHOLDER_BY_TOOL[activeTool] ?? PLACEHOLDER_BY_TOOL[activeTool];
    // Home (spec 2026-11-23) has its own words at rest and for the skills that take a topic;
    // Simulate and Edit keep their pair, and a skill without Home words keeps the thread's.
    const shownPlaceholder =
      nextHomeShown && activeTool !== "test" && activeTool !== "edit" ? HOME_PLACEHOLDER_BY_TOOL[activeTool] ?? placeholder : placeholder;
```

- lines 4274-4284 become:

```tsx
            video={activeTool === "test" || activeTool === "edit" ? file : null}
            onVideoChange={(f) => {
              setFile(f);
              if (f) {
                // One attachment at a time: the video replaces a staged evidence file.
                setEvidenceFile(null);
                setEvidenceError(null);
                // A video in the field is simulated, or edited where the editor is open (plan 2026-11-24-editor-screens-a).
                handleUserSelectTool(videoSkillOf(f, activeTool, editOpen));
              }
            }}
            pickerRef={videoPickerRef}
            validateVideo={editOpen ? stageableVideo : undefined}
            editOpen={editOpen}
```

- in `home={…}` (lines 4325-4329) the object gains:

```ts
                    videoSkill:
                      editOpen && file && (activeTool === "test" || activeTool === "edit")
                        ? { picked: activeTool === "edit" ? "edit" : "test", simulate: simulates(file), onPick: handleUserSelectTool }
                        : null,
```

- line 4655 becomes:

```tsx
          onPickSkill={(id) => {
            handleUserSelectTool(id);
            // Edit's card opens the picker inside the tap: iOS drops a picker opened any later.
            if (id === "edit") videoPickerRef.current?.click();
          }}
          editOpen={editOpen}
```

- [ ] Step 4: Run, expect PASS, the new tests and the guards and suites the change touches: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/start-edit.test.ts src/components/home-next/ src/components/thread-next/ src/components/app/home/ src/components/ui/__tests__/ src/lib/surfaces/__tests__/start-registry-drift.test.ts src/lib/flags/__tests__/horizontal.test.ts`, then `pnpm exec tsc --noEmit` and `pnpm exec eslint src/components/editor/ src/components/home-next/ src/components/thread-next/thread-field.tsx src/components/thread-next/field-copy.ts src/components/app/home/composer.tsx src/components/app/home/composer-controls.tsx src/components/app/home/v8/skills-panel.tsx`.

- [ ] Step 5: Commit: `git add src/components/editor/start-edit.ts src/components/editor/use-edit-open.ts src/components/home-next/home-screen.tsx src/components/home-next/home-next.tsx src/components/thread-next/thread-field.tsx src/components/thread-next/field-copy.ts src/components/app/home/composer-controls.tsx src/components/app/home/v8/skills-panel.tsx src/components/app/home/composer.tsx src/components/home-next/__tests__/home-screen.test.tsx src/components/thread-next/__tests__/slash-menu.test.tsx src/components/editor/__tests__/start-edit.test.ts src/components/home-next/__tests__/home-screen-edit.test.tsx src/components/thread-next/__tests__/thread-field-edit.test.tsx src/components/app/home/__tests__/composer-edit.flag-on.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(editor): the door on Home: six cards, Edit beside Simulate, one send branch" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 17: The page's accessibility and keyboard

**Files:**
- Modify: `src/components/editor/editor-scrubber.tsx` (the slider's `onKeyDown`), `src/components/editor/editor-thread.tsx` (a live region), `src/components/editor/editor-screen.tsx` (`WaitLine`'s label live; the focus rules)
- Test: `src/components/editor/__tests__/editor-a11y.test.tsx`

**Interfaces:** Consumes: `EditorScrubber`, `EditorThread`, `LookSheet`, `CaptionsSheet`, `EditorScreen` and fixtures (Tasks 4, 11-15); `FieldHandle.focus()`, `FieldHandle.focused()` (Task 12); `userEvent` (`@testing-library/user-event` 14). Produces: no new names; the behaviour below.

The rules, from the spec (§5.2, kept from the dev page) and the brief: the header's controls come first (Back, Undo, Redo, Export), then the video's (Play, Mute, the scrubber), the tools (Look, Captions), the conversation and its chips, the field; the scrubber is a slider moved by the arrow keys (a second), Page Up and Page Down (five seconds), Home and End; each turn and each request out is read as it is added (the conversation is a polite live region of its additions), and so is the wait's label (not its time left, which changes each second); Escape closes a sheet (Radix's dialog), and in a word being typed it leaves the word as it was and the sheet open; when the cut lands the focus goes to the field, on a touch screen to the panel instead (no keyboard opens over the video); a change sent from the field gives the field its focus back when answered.

- [ ] Step 1: Write the failing test `src/components/editor/__tests__/editor-a11y.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * editor-a11y.test.tsx — the editor by keyboard and screen reader (plan 2026-11-24-editor-screens-a, Task 17): the scrubber's keys,
 * what is read aloud, Escape, the focus order and where the focus goes when the cut lands.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }), usePathname: () => "/edit/e" }));

import type { EditView } from "@/lib/edit/edit-view";
import { renderWithClient } from "@/test/render-with-client";
import { CaptionsSheet } from "../captions-sheet";
import { EditorScreen } from "../editor-screen";
import { EditorScrubber } from "../editor-scrubber";
import { EditorThread } from "../editor-thread";
import { LookSheet } from "../look-sheet";
import { ASSET, EDIT_ID, FIRST, changed, viewOf } from "./views";

const QUIET = changed(FIRST, [{ op: "captions.set", on: false }]);
class NoFontFace {
  constructor(readonly family: string) {}
  load = async () => this;
}
beforeAll(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: () => {}, ready: Promise.resolve() } });
});
beforeEach(() => vi.stubGlobal("FontFace", NoFontFace));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function answering(view: EditView) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/edit/fonts/")) return new Response(new ArrayBuffer(8));
    if (path === `/api/edit/edits/${EDIT_ID}`) return new Response(JSON.stringify(view), { status: 200 });
    return new Response(null, { status: 404 });
  }));
}
const nameOf = (element: Element) => element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";

describe("the scrubber by keyboard", () => {
  it("moves a second with the arrows, five with Page Up and Down, to the ends with Home and End", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    for (const [key, to] of [["ArrowRight", 90], ["ArrowLeft", 30], ["ArrowUp", 90], ["PageUp", 210], ["PageDown", 0], ["Home", 0], ["End", 380]] as const) {
      fireEvent.keyDown(slider, { key });
      expect(onSeek).toHaveBeenLastCalledWith(to);
    }
  });

  it("does nothing while off", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[]} disabled onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole("slider", { name: "Playhead" }), { key: "ArrowRight" });
    expect(onSeek).not.toHaveBeenCalled();
  });
});

describe("what is read aloud", () => {
  it("reads each answer and each request being worked on as it is added to the conversation", () => {
    const base = { undoable: false, onUndo: vi.fn(), chips: [], onChip: vi.fn(), checking: false, findings: [], onShow: vi.fn(), problem: null, disabled: false };
    const { rerender } = render(<EditorThread {...base} turns={viewOf().turns} pending={null} />);
    const live = document.querySelector("[data-part=thread] ol")!;
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveAttribute("aria-relevant", "additions");
    rerender(<EditorThread {...base} turns={viewOf().turns} pending="Shorter" />);
    expect(live.lastElementChild?.textContent).toBe("ShorterWorking on it…");
  });

  it("reads the wait's stage, not its seconds", async () => {
    answering(viewOf({ take: { ...viewOf().take, status: "analysing", previewUrl: null, posterUrl: null, asset: null }, head: null, shown: null, edit: null, turns: [] }));
    renderWithClient(<EditorScreen id={EDIT_ID} pollMs={60_000} />);
    const label = await screen.findByText("Listening to it");
    expect(label).toHaveAttribute("aria-live", "polite");
  });
});

describe("Escape", () => {
  it("closes a sheet", async () => {
    function Open() {
      const [open, setOpen] = useState(true);
      const idle = { status: "idle" as const, line: null, share: null, problem: null, style: null };
      return <LookSheet open={open} onOpenChange={setOpen} picked="house" poster={null} words={["go", "now"]} changed={false} disabled={false} onPick={() => {}} reading={idle} onReadVideo={() => {}} />;
    }
    render(<Open />);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Look" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Look" })).toBeNull());
  });

  it("in a word being typed leaves the word as it was and the sheet open", () => {
    const onOps = vi.fn(async () => true);
    render(<CaptionsSheet open onOpenChange={vi.fn()} edit={FIRST} takeId={ASSET.id} disabled={false} onOps={onOps} onSeek={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    const word = screen.getByRole("textbox", { name: "Word 1" });
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Escape" });
    expect(onOps).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Captions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Good" })).toBeInTheDocument();
  });
});

describe("the focus", () => {
  it("goes through the header, the video, the tools, the chips and the field, in that order", async () => {
    answering(viewOf({ edit: QUIET, undo: null }));
    renderWithClient(<EditorScreen id={EDIT_ID} />);
    await screen.findByText("Captions are on.");
    const wanted = ["Back", "Export", "Play", "Mute", "Playhead", "Look", "Captions", "Shorter", "Ask for a change"];
    const focusable = [...document.querySelectorAll("[data-part=editor] button:not([disabled]), [data-part=editor] textarea:not([disabled]), [data-part=editor] [role=slider][tabindex='0']")].map(nameOf);
    expect(focusable.filter((name) => wanted.includes(name))).toEqual(wanted);
  });

  it("goes to the field when the cut lands, and to the panel on a touch screen", async () => {
    answering(viewOf({ edit: QUIET }));
    const { unmount } = renderWithClient(<EditorScreen id={EDIT_ID} />);
    await screen.findByText("Captions are on.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Ask for a change" })));
    unmount();
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({ matches: query === "(pointer: coarse)", media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }) as MediaQueryList);
    renderWithClient(<EditorScreen id={EDIT_ID} />);
    await screen.findByText("Captions are on.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("region", { name: "Your edit" })));
    await act(async () => undefined);
  });
});
```

- [ ] Step 2: Run it, expect FAIL: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/__tests__/editor-a11y.test.tsx` → the keys move nothing (`onSeek` not called), the conversation is no live region, the wait's label not live, and the focus left on the body.

- [ ] Step 3: Implement.

`src/components/editor/editor-scrubber.tsx`: on the `role="slider"` element, after `onPointerMove`, add:

```tsx
        onKeyDown={(event) => {
          if (disabled) return;
          const steps: Record<string, number> = { ArrowLeft: -FPS, ArrowDown: -FPS, ArrowRight: FPS, ArrowUp: FPS, PageDown: -5 * FPS, PageUp: 5 * FPS };
          const to = event.key === "Home" ? 0 : event.key === "End" ? last : event.key in steps ? frame + steps[event.key]! : null;
          if (to === null) return;
          event.preventDefault();
          onSeek(Math.min(last, Math.max(0, to)));
        }}
```

and the header comment's last sentence becomes "Its keys: the arrows a second, Page Up and Page Down five, Home and End the ends."

`src/components/editor/editor-thread.tsx`: the list becomes a polite live region of its additions, so each turn and each request being worked on is read as it is added, and the text is not written twice (a second, hidden copy would also be found twice by every query of the page's text):

```tsx
      <ol aria-live="polite" aria-relevant="additions" className="flex flex-col gap-2.5">
```

(in place of `<ol className="flex flex-col gap-2.5">`).

`src/components/editor/editor-screen.tsx`:
- in `WaitLine`, the label becomes `<span aria-live="polite" className="font-[640] text-foreground">{label}</span>`.
- after `const panel = useRef<HTMLElement>(null);` add:

```tsx
  // The focus follows the work (the dev page's rule): when the cut lands, to the field; on a touch screen to the panel, so no
  // keyboard opens over the video. A change sent from the field gives it the focus back when it is answered.
  const hadCut = useRef(false);
  useEffect(() => {
    const hasCut = onStage !== null;
    if (hasCut === hadCut.current) return;
    hadCut.current = hasCut;
    if (!hasCut) return;
    if (window.matchMedia("(pointer: coarse)").matches) panel.current?.focus({ preventScroll: true });
    else field.current?.focus();
  }, [onStage]);
  const refocus = useRef(false);
  const out = session.working !== null;
  useEffect(() => {
    if (out || !refocus.current) return;
    refocus.current = false;
    field.current?.focus();
  }, [out]);
```

- the first line of `send` becomes `refocus.current = field.current?.focused() ?? false;`, before `setText("")`.

- [ ] Step 4: Run, expect PASS: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor/ && pnpm exec tsc --noEmit && pnpm exec eslint src/components/editor/`.

- [ ] Step 5: Commit: `git add src/components/editor/editor-scrubber.tsx src/components/editor/editor-thread.tsx src/components/editor/editor-screen.tsx src/components/editor/__tests__/editor-a11y.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(editor): the page by keyboard and screen reader" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 18: The controller's proof

**Files:** none committed. Local and uncommitted only: `.scratch/editor/proof/` (scripts, logs, screenshots, the exported file), `.env.local` (the test account's lines).

**Interfaces:** Consumes everything above. Produces the evidence of spec §9 for slice A. This task is the controlling session's own, step by step, never a subagent's.

- [ ] Step 1: Review, then apply the migration. Read `supabase/migrations/20261124210000_edits_turns.sql` once more against Task 1's test. Apply it to the app's project with the Supabase tool (`apply_migration`, name `edits_turns`, the file's SQL as it is). Then: `list_tables` shows `edits` and `edit_turns` with RLS on; `get_advisors` (security) names neither table; `generate_typescript_types` gives the two tables exactly as Task 1 wrote them by hand (compare the two blocks; any difference is fixed in `database.types.ts` and committed as `fix(edit): …`).

- [ ] Step 2: A dedicated test account. Write `.scratch/editor/proof/make-account.ts` (never committed; `e2e/create-test-user.ts` is not run: it carries a fixed password in a public repo). It reads the Supabase URL and service key from `.env.local` with `dotenv`, makes a user `editor-proof-<8 random hex>@maven.test` with a password of 32 random bytes (`crypto.randomBytes(32).toString("base64url")`) and `email_confirm: true`, marks its onboarding done exactly as `ensureProfile` in `e2e/create-test-user.ts` does (read that function first and copy it), then appends to `.env.local` the lines `EDITOR_PROOF_EMAIL=…`, `EDITOR_PROOF_PASSWORD=…`, `EDITOR_PROOF_USER_ID=…` and adds the id to `EDIT_CREATORS` (comma-separated, the existing ids kept). It prints only `test account ready`. Run it with `pnpm exec tsx .scratch/editor/proof/make-account.ts`. Check `git status --short` shows no new tracked change.

- [ ] Step 3: The walk, at 390 × 844 and at 1280 × 800, on the real app and the real worker. Write `.scratch/editor/proof/walk.ts` (raw Playwright, `animations: "disabled"`, `caret: "hide"`; it signs in through `/login` with the proof account from `.env.local`, never printing it) and run server and walk in one command, so the server dies with it:

  `(NEXT_PUBLIC_NEW_LOOK=true pnpm exec next dev -H 127.0.0.1 -p 3022 > .scratch/editor/proof/dev.log 2>&1 &) && npx wait-on -t 120000 http://127.0.0.1:3022/login && pnpm exec tsx .scratch/editor/proof/walk.ts 390 && pnpm exec tsx .scratch/editor/proof/walk.ts 1280; lsof -ti:3022 | xargs kill`

  The walk, each step a screenshot and a line in `.scratch/editor/proof/walk-<width>.md`:
  1. Home shows six cards; Edit opens the picker; a raw take of 20 to 60 s (MOV, from the controller's own test material, not committed) is staged as Edit; Send opens `/edit/<id>`.
  2. Getting ready: the take plays at once from the device's copy; "Uploading" with the time left, then "Listening to it" with its estimate; "Clean" is picked in the row.
  3. The first cut lands by itself in Clean: the line written by code, the chips; the card in the chat exists (open the chat from Library).
  4. One change ("Shorter"): the video goes to just before where it changed and plays; Undo in the header, then Redo.
  5. A word fixed in the Captions sheet (with "Fix all N" when the word was heard again); captions off and on.
  6. The Look sheet: "Sentences", with the line "Picking a look starts again…"; Undo brings the changes back.
  7. Export: the panel with its estimate and bar, the tools and the field resting; Cancel gives the edit back; Export again and wait; Ready: Download (1280) saves the file to `.scratch/editor/proof/film-<width>.mp4`; at 390 the sheet's button (Chromium has no file share: Download).
  8. A reload at each wait: during the upload ("The upload stopped." and "Pick the video again", then the same file again goes on), during the analysis, during the first cut (it lands or says the editor is busy and lands), during the export (it goes on, and Ready opens when it is made).
  9. Back to the chat from the editor; Library lists the chat ("Edit · today"); opening the card returns to the editor as it was left, with its turns.

- [ ] Step 4: Read the exported files: `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of json .scratch/editor/proof/film-1280.mp4` (and `-390`): h264 1080 × 1920 at 30 fps with an audio stream, its duration within 0.05 s of the film's length on the page.

- [ ] Step 5: What could not be known from the code. `curl -s -D - -o /dev/null -H "Origin: http://127.0.0.1:3022" "<a film address from the Ready sheet>" | grep -i access-control-allow-origin` (none: the phone's "Save to Photos" falls back to Download until piece 4's production CORS; write it down). `curl -sI http://127.0.0.1:3022/edit/fonts/inter/Inter.ttf` answers 200 with a font beside the `/edit/[id]` page. `curl -s http://127.0.0.1:3022/api/edit/open` signed out answers `{"open":false}`. A second account not on the list sees four cards and no Edit pill.

- [ ] Step 6: The built screens beside the drawing, light and dark. With `NEXT_PUBLIC_NEW_LOOK=true` and the theme switched in `/settings`, screenshots at 390 of screens 2, 3, 5, 9, 10, 11, 12 and 13 and at 1280 of the desktop, each beside its crop of `.scratch/editor/drawing/editor-v2-row-A.png` … `-D.png`, composed into `.scratch/editor/proof/beside-light.png` and `beside-dark.png`. Look at them: the video at least half the phone's height, the header Back, Undo, Redo, Export with no title on the phone, chips 36, the field 52, sheets radius 32, one ink action a screen, no colour literal visible as a stray tint in dark.

- [ ] Step 7: The gates, each run and its output kept in `.scratch/editor/proof/gates.md`: `pnpm exec tsc --noEmit`; `pnpm exec eslint src/components/editor src/app/api/edit src/lib/edit "src/app/(app)/edit" src/components/home-next src/components/thread-next src/components/shell src/components/library-next src/lib/library src/components/app/home/composer.tsx src/components/app/home/composer-controls.tsx`; the edit suites `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/app/api/edit src/components/editor src/app/dev-edit`; the flag-off guards `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/ui/__tests__/next-look-parity.test.tsx src/components/ui/__tests__/toast.flag-off.test.tsx src/components/thread/__tests__/thread-frame.flag-off.test.tsx src/components/app/home/__tests__/composer-gone-chat.flag-off.test.tsx src/app/__tests__/design-token-drift.test.ts`; then the whole suite `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run`, any failure compared with the same run at `7a5af9e6` before it is called pre-existing.

- [ ] Step 8: `pnpm exec next build` with the flag off, then `NEXT_PUBLIC_NEW_LOOK=true pnpm exec next build`; both finish. Stop every server this proof started (`lsof -ti:3022`). The test account and its `.env.local` lines stay for slice B; nothing of this task is committed.

---

## Self-review

### Spec coverage

| Spec (2026-11-24-editor-screens-design.md) | Task |
|---|---|
| §2 slice A: the way in | 16 |
| §2 slice A: the page and its states (§5.1, all nine) | 10 (`pageStateOf`), 15 |
| §2 slice A: saved edits, two tables (§6, E4) | 1, 2, 6 |
| §2 slice A: asking and undoing | 7, 10, 12, 15 |
| §2 slice A: the look (E5, E9, screen 9, E22 "Like a video") | 5 (`styleOf`, `lookKeyOf`), 7 (`cut`), 9 (`read-style.ts`), 10 (`readVideo`), 13 |
| §2 slice A: the captions (E5, screen 10, E22 "Fix all N") | 3 (`opsSay`, `sameWord`), 7 (`ops`), 13 |
| §2 slice A: the export (E6, E20, screens 11-12) | 5 (`startRender`), 8, 14, 15 |
| §2 slice A: the card in the chat (§6, screen 13) | 4, 6 (`POST edits` writes it) |
| §3 screen 1 Home, six cards, Edit beside Simulate (E3, E11) | 16 |
| §3 screen 2 getting ready, plays at once, a look while waiting, time left (E21) | 3 (`waits.ts`), 9 (`uploads.ts`), 11 (`<video>`), 13 (`LookRow`), 15 |
| §3 screen 3 first cut by itself (E2), line by code (E7, §5.4), chips (§5.3) | 3 (`firstCutLine`), 7, 10 (`wantsFirstCut`, `chipsOf`), 12 |
| §3 screen 4 asking, without the moment tag | 12 (`EditorField`), 7 (`at` accepted, unused) |
| §3 screen 5 the change: video to where it starts (§5.2 `firstChangedFrame`), Undo on the answer and in the header | 3 (`changed.ts`), 10 (`playheadAfter`), 12, 15 |
| §3 screens 6-8, E15-E18 | not in slice A (the moment tag, the original, the posted preview, finding cards); "N to check" opens a plain list with "Show" (12) |
| §3 desktop, two columns (E19) | 15 |
| E1 own page, new look only, pushed header, no tab bar | 15 |
| E8 our own player controls | 11 |
| E10 one take an edit | 6 (`take_id`), 16 |
| E12 no price on screen | 16 (`BILLABLE_BY_TOOL` has no `edit`) |
| E13 built on this branch | Global Constraints |
| E14 the dev pages and the stateless agent route stay | 5 (only extraction; suites unchanged), Global Constraints |
| E19 video at least half the screen, header Back, Undo, Redo, Export | 15 |
| §5.2 parts of slice A (`editor-screen`, `use-edit` + `edit-session`, `uploads`, `editor-stage`, `editor-scrubber`, `editor-thread`, `editor-field`, the three sheets, `export-panel`, `edit-answer`) | 4, 9-15 |
| §5.2 kept from the dev page: video held on a phone, controls off while a call is out, playhead kept, focus rules, a failed request back in the field, an export of the exact version | 10, 15, 17; 6 (`export_turn` = turn shown) |
| §6 `edits` and `edit_turns`, `at` and `kept`, Undo to a doc turn, drop after head, 300 cap, owner reads, routes write | 1, 2, 6 |
| §7 routes of slice A (`edits`, `[id]`, `cut`, `change`, `ops`, `head`, `export`), 409 for two at once, none while exporting | 6, 7, 8 |
| §7 `POST …/kept` | not in slice A |
| §8 Home, Thread, Library, Shell changes | 16; 4; 4; 15 |
| §8 flag off renders as before | 4 (legacy renderer null), 15 (page 404), 16 (`enabled: false`, `useEditOpen` gated), 18 (guards) |
| §9 proof for slice A | 18 |
| Brief: `GET /api/edit/open` | 6, 16 |
| Brief: another take for an edit with no cut | 6 (`POST …/take`), 10 (`replaceTake`), 15 (`PickAgain`) |
| Brief: a11y and keyboard | 17 |

### Checked while planning

Before this plan was handed over, every file it creates and every change it makes (all eighteen tasks but the proof) was applied to a throwaway copy of `src/` (under `.scratch/editor/plan-proto/`, deleted afterwards for disk room, never committed): `tsc --noEmit` passed on the whole copy; the suites of the edit tool, the editor, the thread, Home, the shell, Library, the composer (its flag-on and flag-off suites), the UI parity snapshot and the middleware passed on it (one suite, `references.test.ts`, read `worker/` files the copy lacked and passes in the worktree); `eslint` reported no error on the new and changed files. The expected numbers in Task 3's tests (frames, seconds, lines) were measured on the real edits first. What the copy cannot show is the browser, the worker, R2's CORS and the database: Task 18.

### Type consistency

- `EditView`, `TurnShown`, `TakeShown`, `ExportShown`, `LIVE_JOB` are defined once (Task 4, `src/lib/edit/edit-view.ts`); the store builds them (Task 6, `viewOf`), every route answers them (Tasks 6-8), the client reads them (Tasks 10-17). `TurnShown.doc` and `TurnLine.doc` are the same boolean (whether the turn holds an edit), read from `doc->v`.
- `TurnKind`, `TurnMark`, `MOST_TURNS` (Task 2) are used by the store (Task 6), the routes (Task 7) and `TurnShown` (Task 4).
- `Styled` and `styleOf`/`lookKeyOf` (Task 5) are the server's reading of a cut's `style`; `CutStyle` and `styleBody` (Task 10) are the page's writing of it; `styleBody` writes exactly the four bodies `styleOf` reads (none, `{preset}`, `{words}`, a profile), held by Task 5's and Task 10's tests.
- `Upload` (Task 9) is consumed by `pageStateOf` as `Pick<Upload, "status">` and by the screen (Task 15) for `localUrl`, `sent`, `total`, `secondsLeft`, `status`, `takeId`.
- `StageHandle { seek, play, pause }` (Task 11) and `FieldHandle { focus, focused }` (Task 12) are the only refs the screen drives (Tasks 15, 17).
- `NextChip` and `chipLabel` (Task 10) are drawn by `EditorThread` (Task 12) and acted on by the screen (Task 15).
- `StyleRead` (Task 10) is shown by `LookSheet` (Task 13) and the screen (Task 15); `Source` comes from `read-style.ts` (Task 9).
- `HomeSkillId` gains `edit` with `ToolId` (Task 16), so `onPickSkill` keeps passing a `HomeSkillId` to `handleUserSelectTool(id: ToolId)`.
- Names that look alike and are not the same: `assetOf` of `src/lib/edit/derive.ts` (a file of an edit by id) and `assetOf` of `src/lib/edit/worker/takes.ts` (a take row as a file); the routes import the latter. `creditsLabel` exists in both `thread-field.tsx` and `answer-card.tsx`; nothing here adds a third.

---

## Results (2026-11-25)

Built as planned, subagent-driven, in 17 tasks and one final fix wave: 47 commits on `feat/edit` after the plan's own, 110
files. Each task had its own review; the rulings that override this plan's text where they differ are R1 to R31 in the
plan's workspace. Nothing is pushed.

**What is in the app now** (new look on, an account on the editor's list): Home's six cards with Edit; the door (a take
attached, "Send to edit"); the page `/edit/[id]` with its ten states; the first cut made by itself; asking for a change;
Undo and Redo as a round trip; the Look sheet (eight looks on the creator's own frame, "Describe it", "Like a video"); the
Captions sheet (a word fixed by hand, "Fix all", on and off); the export shown in the page, with Cancel; the Ready sheet
("Save to Photos" on a touch screen, "Download" on a desk); the edit as a card in its chat and a row in Library. On the
server: the tables `edits` and `edit_turns`, applied to the app's database and probed there, and eight routes under
`/api/edit/edits/` and `/api/edit/open`.

**Changed from the spec while building, each ruled:** Undo then Redo never loses an answer (`head` rests on the end of a
run); a caption word fixed by hand is carried into every later cut of the same take (spec E9, changed); a cancel that
arrives after the file is made keeps the file; the Ready sheet opens by itself only for an export finished in front of
the creator, and the film is fetched only while the sheet is open; a take sent while another is being listened to waits
its turn; a take over three minutes says that its first three minutes were used; every call from the page has a
deadline.

**Proved** on the final head `9f3291b6`:
- the whole suite: 865 files and 12,953 tests passed, none failed; `tsc --noEmit` clean; `next build` with the new look
  on exits 0, with the page and its routes in it;
- in a real browser (Chromium, 393 by 852 with touch and 1280 by 800), signed in as a dedicated account, on the real
  worker and storage, four runs: the door lands in the editor about 4 s after Send with the take playing from the
  device's own copy; the first cut 48 to 69 s after Send; a change answered in about 3 s by the route; a word fixed by
  hand at once; "big yellow captions, one word at a time" as a look in 5 to 6 s, the fixed word still fixed; Cancel
  gives the edit back; an export in 43 to 57 s, the file 1080 by 1920, H.264 with AAC sound; a reload brings the edit
  back and fetches no film; dark and light; the chat's card and Library; with the flag off the app's own 404 and the
  old Home with nothing named Edit.

**Proved after the slice was closed** (2026-11-25, two more browser runs, no problem logged in either):
- captions off and on: the switch answers in 1.4 to 2.9 s; off, the stage shows no caption and the label stays; a
  reload keeps it off; the exported file has none; on again, they are back;
- "Like a video" with an uploaded reference of 33 s: the sheet closes, the read goes on behind the page with Stop, the
  field stays free, "Use that style" is offered when the read is over (within 91 s), and taking it makes a new cut in
  about 8 s whose captions follow the reference (phrases with one coloured word, set high).

**Not proved:** a real iPhone (the Player in Safari, the share sheet, an upload over mobile data), any Safari at all;
"Like a video" from a pasted link (the fetch through the scraper; the rest is the path above); a take over three
minutes and a second take sent during an analysis (both rest on their tests); a production build opened in a browser;
the deployed platform and the storage's rules for its origin.

**Seen in those runs, for slice B:** with captions off a chip still offers "Bigger captions"; the line of the
background read lies over the row of chips.

**Known and left for later** (the full lists are in the workspace's ledger and in `final-review.md`): no spending limit
exists, only the list of accounts bounds renders and agent calls; text typed while Edit is picked on Home is sent
nowhere; the Ready sheet's and the card's picture is the take's first frame, not the cut's look; the list of things to
check says the review's own sentences; Recent may miss a new edit's chat for up to a minute; a stored edit is read with
today's schema; a chat deleted leaves its edit, take and films in storage. Slice B (the moment in a request, the
original, the preview as posted, a fix on a finding) is not started.
