# Atlas §01 — Shared Request Envelope + Threads/Messages Spine

> The connective tissue every generative skill (`/api/tools/*`) shares: the
> per-request envelope, the single open thread, the active-audience pin, and the
> block-discipline that keeps model output off the UI surface.
> Trace-level companion to `docs/PLATFORM-MAP.md` §2 + §4. File refs are `path:line`.
> Branch: `milestone/numen-tools`. Traced 2026-06-22.

---

## A. The common skill-route envelope (execution order)

Every tool route is a hand-rolled `POST` (NOT routed through the `ToolRunner`
contract — see Lean lens). The canonical reference is **ideas**
(`src/app/api/tools/ideas/route.ts:75-309`); hooks/script/chat/remix/react/refine
repeat the same skeleton with per-skill bodies.

### ASCII sequence (canonical SSE skill route)

```
client POST /api/tools/<skill>  (Content-Type: application/json)
   │
   ▼
[1] createClient()                               route.ts (top of POST)
   │   await supabase.auth.getUser()             → 401 if !user        :79-84
   ▼
[2] csrfGuard(request)  ── 415 (bad CT) / 403 (cross-origin)
   │   src/lib/http/csrf-guard.ts:25-47
   │   ⚠ PRESENT in chat/script/hooks/remix/read/explore
   │   ⚠ ABSENT  in ideas / ideas-develop / refine / react   (gap, §Lean)
   ▼
[3] body = await request.json()  (try/catch → defaults)            :87-92
   │   rawAsk cap: if ask.length > 2000 → 400      (MAX_MESSAGE_LENGTH) :97-103
   │   platform normalised to tiktok|instagram|youtube              :106-108
   │   (react/refine use Zod instead of manual caps — react :44-87)
   ▼
[4] rate-limit  ── DEAD in ideas: consts defined, voided, never run :110-120
   ▼
[5] load creator profile (cold-start safe, null OK)                :126-131
   │   supabase.from("creator_profiles").select("*").eq(user.id).maybeSingle()
   ▼
[6] openThread = await createOpenThreadLazy(user.id)               :134
   │   src/lib/threads/threads.ts:134-166
   │   service-client INSERT {type:"open", reading_id:null, user_id}
   │   on 23505 → getOpenThread(user.id) (concurrent first-open dedup) :150-155
   ▼
[7] resolve ACTIVE AUDIENCE off the thread (CR-01: never from body) :142-152
   │   activeAudienceId = thread.active_audience_id ?? null
   │   null  → GENERAL_AUDIENCE (no DB query)
   │   value → getAudience(supabase, id)  src/lib/audience/audience-repo.ts:260-281
   │           (sentinel ids short-circuit; else RLS SELECT)
   │   load failure / not found → GENERAL_AUDIENCE  (graceful, never blocks)
   ▼
[8] ReadableStream — runner produces typed OutputBlock[]           :157-306
   │   runIdeasPipeline({ask,platform,profileRow,audience,pin})     :175
   │   SSE FRAME ORDER (content-first UX, IDEAS-02):
   │     stage(active/done)* → warning? → status
   │     ── content   (card FACES incl. lead scrollQuote)           :207-225
   │     ── score     (per-card band + fraction, "a beat later")    :228-235
   │     ── followup  (one-shot Qwen observation, non-fatal)        :249-291
   │     ── done                                                     :293
   ▼
[9] insertMessage(openThread.id,"assistant",blocks, kcStamp().kcGenVersion)
   │   src/lib/threads/messages.ts:73-116                            route :241
   │   validates EVERY block at the write boundary (D-14)
   │   stores body = { kcGenVersion, blocks } JSONB wrapper          messages.ts:95-97
   ▼
[10] kcStamp() → { kcGenVersion: KC_GEN_VERSION }  ("gen.1.1.0")
     src/lib/kc/kc-stamp.ts:76-78 → kc-version.ts:26
```

### Numbered steps with refs

1. **Auth** — `supabase.auth.getUser()` before any DB read (T-03-07 / CR-01). `route.ts:79-84`. `user.id` is the ONLY trust source for `user_id` everywhere downstream.
2. **CSRF guard** — `csrfGuard(request)` (`csrf-guard.ts:25-47`): Content-Type must be exactly `application/json` (415) + Origin must match own origin if present (403). Called right after auth. **Coverage is inconsistent** (see Lean).
3. **Length caps** — manual `MAX_MESSAGE_LENGTH=2000` on `ask` (`ideas/route.ts:61,97-103`); `anchor ≤5000` on hooks/script/refine; react uses `ReactBodySchema` Zod (`react/route.ts:44-47`).
4. **Open thread** — `createOpenThreadLazy(user.id)` (`threads.ts:134-166`). One open thread per user, enforced by partial unique index (migration `20260618000000`). Insert-then-reselect on 23505; no `ON CONFLICT` (partial index can't be a PostgREST arbiter → 42P10).
5. **Active audience** — read `thread.active_audience_id`; `null` = `GENERAL_AUDIENCE` sentinel (no query); else `getAudience()` with `GENERAL_AUDIENCE` fallback on any failure (`ideas/route.ts:142-152`, `react/route.ts:101-112`). Identical 10-line block is **copy-pasted into every runner route**.
6. **Pipeline + SSE** — runner returns `{blocks, warnings}`; route emits `content` (faces) THEN `score` (bands) — the honesty/content-first ordering is a route-level convention, not enforced by a helper.
7. **Persistence** — `insertMessage()` re-validates blocks (belt-and-suspenders over the runner's `assertBlocksInRegistry`) and writes the `{kcGenVersion, blocks}` wrapper.
8. **KC stamp** — `kcStamp().kcGenVersion` (`kc-stamp.ts:76`). Decoupled from `ENGINE_VERSION` by design (`kc-version.ts` header). Passed as 4th arg to `insertMessage`.

**React route** (`react/route.ts:62-138`) is the envelope minus persistence: auth → Zod body → profile → server-side audience resolve → ONE `runFlashTextMode` → return `{fraction, scrollQuote}` JSON. Ephemeral; no `insertMessage`, no SSE.

---

## B. Threads data model

### Tables (`src/types/database.types.ts`)

- **`threads`** (`:1728`): `type` ("open"|"grounded"), `reading_id string|null` (`:1733`), **`active_audience_id string|null`** (`:1730`, FK `threads_active_audience_id_fkey` → audiences), `user_id`, `created_at`. FK `threads_reading_id_fkey` → analysis_results (`:1765`).
  - **Open thread** = `type:"open" AND reading_id IS NULL`, **one per user** via partial unique index `threads_open_user_unique_idx` (`migrations/20260618000000_threads_one_open_per_user.sql:91-93`). Holds ALL generative-skill output.
  - **Grounded thread** = `type:"grounded"` keyed to a reading. Partial unique index on `reading_id` (D-15). **See Lean — currently has no production writer.**
  - **Dedup pattern**: insert-first; catch `23505` unique_violation; re-select scoped by `user_id` (CR-01). `createOpenThreadLazy` `threads.ts:134-166`; `createGroundedThreadLazy` `threads.ts:54-95`.
- **`messages`** (`:1117`): `thread_id`, `role` (string, narrowed to `user|assistant|tool`), `body` JSONB, `created_at`. **`body` is polymorphic**: either a bare `Block[]` OR the provenance wrapper `{ kcGenVersion, blocks: Block[] }`. `unwrapBody()` normalises both (`messages.ts:124-130`).
- **`analysis_chats`** (`:180`): SEPARATE table for per-reading expert chat (`role`, `content` text, `scope`). NOT part of this spine — the tools spine never touches it (it belongs to Lane B `/api/analyze/[id]/chat`).

### CRUD helpers

- `createOpenThreadLazy(userId)` — `threads.ts:134-166` (service client INSERT, RLS bypassed → user-scoped reselect).
- `getOpenThread(userId)` — `threads.ts:183-201`. Defensive `order(created_at ASC).limit(1).maybeSingle()` to survive pre-migration duplicate state.
- `createGroundedThreadLazy(readingId, userId)` — `threads.ts:54-95`.
- `getThread(id)` — `threads.ts:102-116` (RLS session client).
- `insertMessage(threadId, role, blocks, kcGenVersion?)` — `messages.ts:73-116`. Validates each block at write; wraps body with stamp if provided.
- `loadMessages(threadId)` — `messages.ts:145-178`. RLS session client; ordered by `created_at`; re-validates each block; invalid → `UnsupportedBlock` sentinel (never dropped).
- Read-back route: `GET /api/threads/open` (`src/app/api/threads/open/route.ts:25-54`) → `getOpenThread` + `loadMessages`.

---

## C. Block discipline (triple validation, not double)

`validateBlock()` (`src/lib/tools/block-registry.ts:50-67`) — never throws, returns `{ok,block}|{ok:false}`. Same Zod schemas (`src/lib/tools/blocks.ts`) are the single validation surface, run at **THREE** points:

1. **Write / runner boundary** — `assertBlocksInRegistry()` (`block-registry.ts:73-84`) in the runner, then again inside `insertMessage` (`messages.ts:80-87`, throws on invalid).
2. **Rehydrate** — `loadMessages` (`messages.ts:168-176`) maps failures to `{type:"__unsupported__", props:{raw}}`.
3. **Render** — `MessageBlocks` (`src/components/thread/message-blocks.tsx:86-97`) re-validates a THIRD time and renders `<UnsupportedBlock/>` for failures or registered-but-componentless types.

> PLATFORM-MAP calls this "double-validation"; the renderer makes it **triple**. Write throws; rehydrate + render degrade gracefully.

**11 block types** (`block-registry.ts:30-42`): `markdown`, `band`, `personas`, `idea-card`, `hook-card`, `script-card`, `remix-card`, `outlier-grid`, `multi-audience-read`, `persona-chat-turn`, `account-read`. Schemas + inferred types in `blocks.ts` (`:21-426`). `UnsupportedBlock` fallback = static placeholder, never executes props (`message-blocks.tsx:25,89,97`).

---

## D. How `active_audience_id` is SET and READ

### SET (write path)
`AudienceChip` (`src/components/app/home/audience-chip.tsx`) → `handleSelect` (`:103-126`):
- `newId = audience.is_general ? null : audience.id` — **General is represented as NULL**.
- `PATCH /api/threads/{threadId}` body `{ active_audience_id: newId }` (`:112-116`).
- `PATCH /api/threads/[id]/route.ts:25-84`: auth → `PatchSchema` requires `z.string().uuid().nullable()` (`:19-23`) so virtual sentinels (`"general"`, `"preset-*"`) are **rejected 400, never hit Postgres as 500** → UPDATE scoped `.eq("id").eq("user_id")` (belt-and-suspenders over RLS).

### READ (every runner)
Each tool route reads `thread.active_audience_id` server-side off the open thread and resolves via `getAudience` (sentinel short-circuit) with `GENERAL_AUDIENCE` fallback. The exact block is duplicated in:
`ideas/route.ts:142-152`, `react/route.ts:101-112`, `hooks/route.ts`, `script/route.ts`, `remix/run/route.ts`, `read/route.ts`, `chat/route.ts`, plus `explore-runner.ts:34` / `explore-rank.ts:170`. **Never read from the request body (CR-01).** Audience bias is pre-baked at calibration; runners only resolve + pass the row to `buildReactionPanel`.

---

## Lean lens / cut-candidates

1. **`ToolRunner` contract + `dispatchToolOutput` + `flashRunner` are fully DEAD.** `tool-runner.ts:37-122` defines the contract; `flashRunner` (`runners/flash-runner.ts:62`) is the only implementer and is **never imported or invoked** anywhere (grep: zero non-test, non-self refs). The real runners (`ideas-runner`, `hooks-runner`, …) are plain async functions that bypass the contract entirely. This is P1 scaffolding (the file's own comments say "reserved/unused in P1") that the SSE-route pattern superseded. **Cut `tool-runner.ts` + `flash-runner.ts`** (and the `stream?` seam) — ~200 LOC of inert abstraction.
2. **CSRF guard coverage is inconsistent — a real hole, not just lean.** `csrfGuard` is applied in chat/script/hooks/remix/read/explore but **MISSING in `ideas`, `ideas/develop`, `refine`, and `react`** — all state-mutating, cookie-authed POSTs (ideas/refine/develop persist to the thread; react spends Qwen budget). Either add the guard to all four or document why they're exempt. (ideas' own header even claims the CSRF mitigation exists.)
3. **Dead rate-limit scaffolding in `ideas`.** `RATE_LIMIT_WINDOW_SECS`/`RATE_LIMIT_MAX_MSGS` declared (`:59-60`), then `void`-ed (`:119-120`) with a v2 TODO. The route has NO rate limit. Either wire it or delete the consts + comment block (~12 lines of misleading code).
4. **Grounded-thread machinery has no production writer.** `createGroundedThreadLazy` (`threads.ts:54-95`, ~40 LOC + its partial unique index + tests) is referenced only by tests and a doc comment. `getThread` (`threads.ts:102-116`) has zero production callers. The `type:"grounded"` + `reading_id` half of the threads model is unused by the current product (per-reading chat lives in `analysis_chats`, not grounded threads). Strong cut-candidate — or confirm it's reserved for a planned reading-thread merge.
5. **Unused KC-stamp helpers.** `withKcStamp()` and `KC_PROVENANCE_FIELD` (`kc-stamp.ts:67,88-92`) are exported but never used (routes call `kcStamp().kcGenVersion` directly). The 80-line decision-log header comment block in `kc-stamp.ts` is stale (debates Option A/B that were already resolved). Trim.
6. **`BlockUnionSchema`** (`blocks.ts:430-444`) exported, zero consumers — validation goes through the registry map, not the union. Cut-candidate.
7. **The 10-line "resolve active audience" block is copy-pasted into ~7 routes** verbatim (with the same `as typeof openThread & {...}` cast workaround for an un-regenerated type). Extract one `resolveActiveAudience(supabase, openThread)` helper — removes duplication AND the repeated cast.
8. **Polymorphic `messages.body` adds permanent unwrap cost.** Bare-array vs `{kcGenVersion,blocks}` wrapper means every read path carries `unwrapBody` (`messages.ts:124-130`). Cheap, but a single canonical wrapper shape would be leaner.

---

## Open questions

1. **Is the grounded-thread / `reading_id` model intentionally reserved**, or genuinely abandoned? If reading chat is permanently in `analysis_chats`, cut `createGroundedThreadLazy` + `getThread` + the grounded unique index. (Cross-ref PLATFORM-MAP §4.1 which still documents grounded threads as live.)
2. **Why do ideas/develop/refine/react skip `csrfGuard`?** Deliberate (e.g. same-origin-only callers) or an oversight? The ideas header advertises a CSRF mitigation that isn't there.
3. **Should `content`-before-`score` SSE ordering be a shared emitter helper?** It's currently a per-route hand-rolled convention; one slip silently breaks the honesty/content-first UX with no guard.
4. **Is the `ToolRunner` contract slated for revival** (the `stream?` seam was "reserved for Phase 3 streaming")? Phase 3 streaming shipped via raw SSE routes instead — so the seam never landed. Confirm before cutting.
5. **Rate-limiting**: the whole tools surface relies on auth + length caps only. Is per-user throttling planned (the `ideas` TODO), or is Qwen/Apify spend acceptable unthrottled?
