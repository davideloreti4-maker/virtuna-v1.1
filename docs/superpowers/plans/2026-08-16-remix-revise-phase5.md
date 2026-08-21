# Remix Phase 5 (`revise_remix`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **TDD is non-negotiable: every task writes its failing test first and shows it red before implementation.**

**Goal:** "beat 3 is too soft" in chat rewrites that beat on that card's sheet — one free LLM call against the stored blueprint, variant-isolated write, and the already-rendered card refreshes. Per `docs/superpowers/specs/2026-08-15-remix-clips-and-revise-design.md` §6 — **read §6.8 (the 2026-08-16 corrections) before §6.7; the plan builds to §6.8's reality, not §6.7's original sentences.**

**Architecture:** Two channels first, then the tool. (in) `ChatAgentPriorTurn` gains a structured `remixSheets` field collected where `chat-prior-turns.ts` already walks `remix-card` blocks, rendered as a data block inside `replayPriorTurn`'s thread-state note — prose lines stay address-free. (out) a `revised` SSE frame from the loop → route → `use-chat-stream` → a nonce context the composer provides → `RemixBeats` refetches, including through `initialData`. The write is an atomic single-element `jsonb_set` RPC modeled on `patch_analysis_variants`; the LLM call reuses `AdaptedBeatZodSchema` and the typed-input idiom (there is no fence to reuse — spec §6.8.2).

**Tech Stack:** Next.js 15 App Router, TypeScript, vitest (+ happy-dom for components), DashScope/Qwen via the existing client, Supabase (service client + hand-applied SQL migration).

## Global Constraints

- Worktree: `/Users/davideloreti/virtuna-remix-shoot-sheet`. **Branch from origin/main, NOT from the lane branch**: `git fetch && git switch -c feat/remix-revise-phase5 origin/main` (main is held by the trunk worktree; the old lane branch is fully merged and stays parked). Re-check `git rev-parse origin/main` before branching AND before the PR — co-sessions move it.
- 🔴 Deploy is OFF (owner-confirmed). Nothing may claim "runs in production" as evidence.
- 🔴 `revise_remix` is FREE (spec §6.2): it must never reach the billing gate at `chat-agent-loop.ts:~1505`, never fire `onDispatch`, never raise a credit wall. Its dispatch branch sits BEFORE the skill lookup (`byName.get`), like `request_input` / `emit_card`.
- 🔴 One row serves ALL ranked cards. Every write goes through the RPC; no read-modify-write of the whole `script` array anywhere.
- 🔴 `supabase db push` is UNSAFE here (ledger drift). The migration file is committed but applied BY HAND via the SQL editor. supabase-js RETURNS errors — read `{error}` on every RPC call; a swallowed error stores nothing silently.
- 🔴 Seed rows write to the SHARED PROD database — every live probe ends with `seed-remix-blueprint.ts --drop <id>`.
- `NEXT_PUBLIC_ENGINE_ONE_BRAIN` defaults ON since #538 (2026-08-16) — the chat loop and its tools are the default path now, not a dark branch. No flag work needed for this plan.
- Adapt/revise output is non-deterministic at temperature 0 (9 distinct outputs / 9 runs measured). One live run proves plumbing, never quality; quality claims need N samples and a rate.
- vitest does not typecheck: run `node node_modules/typescript/bin/tsc --noEmit` separately; trust `$?`, not npx output.
- Full suite: kill dev servers first, `--maxWorkers=3`. Known flakes: `scraping/resolve-video`, `engine/omni-analysis-*`, and three `composer-*.tsx` (`composer-offline-gate` fails ~50% even in isolation — measured 2026-08-16). Ask whether the failing file can reach your diff before blaming it.
- Commit format `type(scope): description`.

---

### Task 1: The address channel — `remixSheets` rides the replay turn as data

Spec §6.7 (first task) + §6.8.1. **One seam, not two**: remix cards reach the model only via `openChatPriorTurns` → `replayPriorTurn`'s `role:"user"` thread-state note. There is no live path and no `role:"tool"` object — the structured field goes on `ChatAgentPriorTurn`.

**Files:**
- Edit: `src/lib/threads/chat-prior-turns.ts` (collect), `src/lib/tools/chat-agent-loop.ts` (`ChatAgentPriorTurn` type + `replayPriorTurn` render)
- Test: `src/lib/threads/__tests__/chat-prior-turns.test.ts` (exists — extend), `src/lib/tools/__tests__/chat-agent-loop-replay.test.ts` (find the file that already pins `replayPriorTurn`'s note wording; extend it, don't fork it)

**Interfaces:**
- `ChatAgentPriorTurn` gains `remixSheets?: Array<{ blueprintId: string; variant: number; hook: string }>`.
- `chat-prior-turns.ts` (~`:105`, where `isRecordedBlock("remix-card")` pushes `recordLineOf(...)` into `pendingRecords`): when `blockType === "remix-card"` AND `props.blueprintId` is a non-empty string AND `props.blueprintVariant` is an integer ≥ 0, also push `{ blueprintId, variant: blueprintVariant, hook: str(props.adaptedHook)?.slice(0, 120) ?? "" }` onto the pending turn's `remixSheets`. **A card without `blueprintId` contributes a record line but NO sheet entry** — the run route strips the props on a failed row write (`api/tools/remix/run/route.ts:259-262`); that is a normal card, not an error.
- `replayPriorTurn` (`chat-agent-loop.ts:596-609`): when `turn.remixSheets?.length`, append to the SAME thread-state note (after the `· record` lines) a clearly-fenced data block:
  ```
  [remix sheets on screen — addresses for the revise_remix tool ONLY; never repeat these ids in prose]
  {"remix_sheets":[{"blueprintId":"…","variant":0,"hook":"…"}]}
  ```
  One JSON line, `JSON.stringify`, no truncation risk from `MAX_RECORD_LENGTH` (that cap applies to `recordLineOf` prose, `on-screen.ts:279` — assert the data block bypasses it).

**Steps:**
- [ ] **Red:** extend the prior-turns test: a hydrated thread containing a `remix-card` block with `blueprintId:"bp1", blueprintVariant:2, adaptedHook:"…"` yields a turn whose `remixSheets` is `[{blueprintId:"bp1", variant:2, hook:"…"}]`; a remix-card WITHOUT `blueprintId` yields a turn with the record line and NO `remixSheets` entry; a thread with no remix cards yields `remixSheets` undefined (not `[]` — don't grow every turn).
- [ ] **Red:** extend the replay test: a prior turn with `remixSheets` renders ONE `role:"user"` note containing both the `·` record line and the JSON data block; `JSON.parse` of the extracted line round-trips; the prose lines (everything before the marker) contain neither `blueprintId` value nor the word `blueprintId`. A turn without `remixSheets` renders byte-identical to today (pin with a before/after fixture).
- [ ] **Green:** implement both edits. No change to `on-screen.ts` — the prose renderer stays address-free by construction.
- [ ] `tsc` + both test files + `chat-prior-turns` neighbors green.
- [ ] Commit `feat(remix): remix sheets ride the replay turn as data (phase 5, address channel)`.

### Task 2: The refresh channel — `revised` frame → nonce context → `RemixBeats` refetches

Spec §6.7 (second task) + §6.8's understatement: the thread reloads every turn but positional keys mean `RemixBeats` never remounts and its `[blueprintId, initialData]` effect never re-runs. The signal must be explicit.

**Files:**
- Edit: `src/lib/tools/chat-agent-loop.ts` (input callback `onRevised`), `src/app/api/tools/chat/route.ts` (wire `onRevised: (r) => send("revised", r)` beside `onDispatch`, ~`:629`), `src/hooks/queries/use-chat-stream.ts` (parse `revised` beside `dispatch`, ~`:332`; expose `revisedSheets: Array<{blueprintId: string; variant: number; nonce: number}>` — nonce increments per frame so a second revision of the SAME sheet is a distinct signal, the `focusVideo` lesson at `composer.tsx:2512`), `src/components/app/home/composer.tsx` (fold the hook's `revisedSheets` into a context value), `src/components/thread/remix-beats.tsx` (consume)
- Create: `src/lib/remix-refresh-context.ts` — `createContext<{ counters: Record<string, number> }>` (blueprintId → bump count), provided from the composer beside the nine existing providers (`composer.tsx:3097-3131`), default `{counters: {}}` so every non-thread host (e.g. `/dev/cards`) is unaffected.
- Test: `src/hooks/queries/__tests__/use-chat-stream-revised.test.ts` (or extend the existing stream-hook test), `src/components/thread/__tests__/remix-beats.test.tsx` (exists — extend)

**Interfaces:**
- Loop: `input.onRevised?: (info: { blueprintId: string; variant: number }) => void` — called by Task 5's handler ONLY after a successful write. Documented beside `onDispatch` (`:318-320`) as "free-tool side channel; fires on `revise_remix` success only".
- `RemixBeats`: reads `counters[blueprintId] ?? 0` from context; adds it to the fetch effect's deps; **when the counter is > 0 the `initialData` short-circuit is skipped** (`if (initialData && bump === 0) return;`) so a dev-cards-injected card also refetches after a revise. The existing `alive` cleanup pattern stays.

**Steps:**
- [ ] **Red (hook):** an SSE fixture stream containing `event: revised\ndata: {"blueprintId":"bp1","variant":1}` yields `revisedSheets` `[{blueprintId:"bp1", variant:1, nonce:1}]`; two frames for the same sheet yield nonces 1 and 2.
- [ ] **Red (component):** render `RemixBeats` with a mocked fetch under the context provider; bump `counters["bp1"]` → exactly one refetch fires (assert fetch call count, not implementation); bump for a DIFFERENT blueprintId → no refetch; with `initialData` present and bump 1 → the network IS hit (the short-circuit is skipped); with `initialData` and bump 0 → no network, byte-identical to today.
- [ ] **Green:** implement loop callback, route wiring, hook parsing, context, composer fold, `RemixBeats` consumption.
- [ ] `tsc` + targeted tests + the existing `remix-beats` and stream-hook suites green unmodified where untouched.
- [ ] Commit `feat(remix): revised frame + nonce context refresh RemixBeats (phase 5, refresh channel)`.

### Task 3: The write — RPC migration + `updateVariantScript()`

Spec §6.5 + §6.8.4. Atomicity by construction: `jsonb_set` on one array element makes "rewrote a sibling card" impossible.

**Files:**
- Create: `supabase/migrations/20260817120000_remix_variant_script_rpc.sql`
- Edit: `src/lib/remix/blueprint-repo.ts`
- Test: `src/lib/remix/__tests__/blueprint-repo.test.ts` (exists — extend)

**Interfaces — the migration (hand-applied; imitate `20260706130000_atomic_variants_merge.sql`: `create or replace`, `set search_path = public, pg_temp`, NOT `security definer`; `p_user_id` MANDATORY, stricter than the precedent, per spec §6.5):**

```sql
-- Phase 5 (revise_remix): atomic single-variant script write.
-- Applied BY HAND via the SQL editor (supabase db push is unsafe here — ledger drift).
create or replace function public.remix_blueprint_set_variant_script(
  p_id text,
  p_user_id uuid,
  p_variant int,
  p_script jsonb
) returns void
language sql
set search_path = public, pg_temp
as $$
  update public.remix_blueprints
  set script = jsonb_set(script, array[p_variant::text], p_script)
  where id = p_id and user_id = p_user_id;
$$;
```

⚠️ `jsonb_set` on an out-of-range array index is a silent no-op on the row value — the repo guards the variant range BEFORE calling (read the row first via `getBlueprint`, which Task 5 does anyway; pass the validated index through).

- Repo: `updateVariantScript(service, id, userId, variant, script: AdaptedBeat[]): Promise<boolean>` — calls the RPC, **reads `{error}`**, logs + returns false on error (never throws for a write; the tool relays an honest failure), true on success. `blueprint-repo.ts` stays the only module touching the table.

**Steps:**
- [ ] **Red:** repo test — the RPC is called with exactly `{p_id, p_user_id, p_variant, p_script}`; an `{error}` result returns false and logs (assert both); success returns true; **no code path selects + rewrites the whole `script` array** (assert the mock's `from("remix_blueprints").update` is never called).
- [ ] **Green:** migration file + repo function.
- [ ] `tsc` + repo tests green. The migration is NOT applied yet — that's Task 6, by hand.
- [ ] Commit `feat(remix): variant-isolated script write via RPC (phase 5)`.

### Task 4: The revision call — `revise.ts`

Spec §6.4 + §6.8.2. One LLM call, typed input, validated output for the targeted indexes only. No resolve, no Omni, no re-rank.

**Files:**
- Create: `src/lib/engine/remix/revise.ts`
- Test: `src/lib/engine/remix/__tests__/revise.test.ts`

**Interfaces:**
- `interface ReviseInput { beats: SourceBlueprint["beats"]; current: AdaptedBeat[]; targets: number[]; note: string }` — the compile-time guard idiom (`AdaptInput`, `decode-types.ts:203`): no field for luck/caption/persona exists, so none can be passed. The prompt receives, per targeted index: the source beat (timing + what the source did), the current adapted line being replaced, and the creator's note. Reuse `getQwenClient` + the adapt call shape (`adapt.ts:453-468`): `temperature: 0`, `seed: QWEN_SEED`, `enable_thinking: false`, bounded `max_tokens`.
- `reviseBeats(input: ReviseInput): Promise<AdaptedBeat[] | null>` — parses the model output, validates each beat with `AdaptedBeatZodSchema` (`adapt.ts:92-98`, import — don't copy), asserts `index` ∈ `targets` and each target present at most once; returns null on any validation failure (all-or-nothing per call, the `stripInvalidScript` philosophy `adapt.ts:264` — half a revision is worse than a refusal). **Check every capped field, not just the one that failed first** (the `angle`/`production.shots` lesson): the schema already caps `spoken`/`on_screen_text`/`shot`/`repair`; the test asserts an over-cap on EACH field individually rejects.
- A target index absent from `current` → the call returns only beats for indexes that exist; an output beat for a non-existent index fails validation (clean no-op comes from Task 5 filtering targets against `current` BEFORE the call — spec §7).

**Steps:**
- [ ] **Red:** mocked Qwen client (I/O boundary — the ONLY mock): a valid response for targets `[1,3]` returns exactly those beats, indexes preserved; a response containing index 2 (untargeted) → null; over-cap `spoken` → null; over-cap `shot` → null; over-cap `on_screen_text` → null; over-cap `repair` → null; malformed JSON → null; the prompt string contains the source beat text, the current line, and the note verbatim (input completeness — assert on the built messages, the `probes-stop-short-of-the-shipped-prompt` lesson).
- [ ] **Green:** implement.
- [ ] `tsc` + test green.
- [ ] Commit `feat(remix): reviseBeats — one validated call against the stored skeleton (phase 5)`.

### Task 5: The tool — `REVISE_REMIX_TOOL` bound free in the loop

Spec §6.2, §6.3 + §6.8. The branch sits BEFORE the skill lookup so it can never be mistaken for an unbound paid skill (`emit_card`'s stated reason, `chat-agent-loop.ts:1391-1393`).

**Files:**
- Create: `src/lib/tools/revise-remix-tool.ts` (schema constant + handler, following `corpus-tool.ts`'s split)
- Edit: `src/lib/tools/chat-agent-loop.ts` (bind in the tools array `:983-990`; service branch beside `request_input` `:1337`; thread `deps`), `src/app/api/tools/chat/route.ts` (pass the service client / repo deps the handler needs — mirror how grounding deps arrive)
- Test: `src/lib/tools/__tests__/revise-remix-tool.test.ts`, extend `src/lib/tools/__tests__/chat-agent-loop*.test.ts` (the file that pins free-tool dispatch)

**Interfaces:**
- Schema: plain function object `as const` like `REQUEST_INPUT_TOOL` (`chat-agent-loop.ts:65-98`): `name: "revise_remix"`, `required: ["blueprintId", "variant", "beats", "note"]`, `variant` integer minimum 0 (**no default — spec §6.3**), `beats` array of integers minLength 1, `note` string. Description tells the model: addresses come ONLY from the `remix_sheets` data block in the thread state; it rewrites beats and cannot change the hook (spec §6.6, so the model doesn't accept a hook revision it would drop).
- Handler flow: parse+validate args (malformed → honest tool-result error, no throw) → `getBlueprint(service, blueprintId, user.id)` (ownership by predicate; null → "that sheet isn't yours or doesn't exist" tool result, spec §7) → filter `beats` to indexes present in `script[variant]` (all filtered out → clean no-op result, not an insert; `variant` out of range for `script` → refusal result) → `reviseBeats` → null → honest failure result → success → merge revised beats into a copy of `script[variant]` by `index` (the `find`-by-index idiom, `remix-beats.tsx:181`) → `updateVariantScript` → false → honest failure result; true → `input.onRevised?.({blueprintId, variant})` + tool result `{ok: true, revised: targets, variant}`.
- Tool result goes back as `{role:"tool", tool_call_id, content: JSON.stringify(...)}` exactly like `request_input`'s (`:1376-1387`). It renders nothing: no `onBlock`, no `uiBlocks` push.
- **Free-tool invariants, asserted not assumed:** `deps.billing.gate` never called; `onDispatch` never fired; the branch precedes `byName.get`.

**Steps:**
- [ ] **Red (handler):** ownership refusal on null blueprint; variant out of range refused; targets filtered against existing indexes; sibling variants never touched (the write mock receives ONLY `script[variant]`); `onRevised` fires on success only (not on refusal, not on a false write); every failure path returns a tool-result string, never throws.
- [ ] **Red (loop):** with a `revise_remix` call in the round, the billing gate mock and `onDispatch` are NOT called; the tool result lands in `messages` as `role:"tool"`; an unrelated skill call in the same round still bills normally.
- [ ] **Green:** implement + bind. Bind unconditionally beside `REQUEST_INPUT_TOOL` (a creator with no sheets just never gets addresses to call it with; the description says so).
- [ ] `tsc` + targeted tests + the full `chat-agent-loop` and `route` test files green.
- [ ] Commit `feat(remix): revise_remix — free tool, variant-isolated rewrite (phase 5)`.

### Task 6: Full gates + live verification

Spec §8. 🔴 Deploy is OFF — nothing claims production. **Phase 5's live proof needs NO Apify**: `seed-remix-blueprint.ts` plants a real row (⚠️ PROD db — `--drop` after, always).

- [ ] `node node_modules/typescript/bin/tsc --noEmit` → exit 0, zero lines.
- [ ] Full suite `--maxWorkers=3` → 0 failed (modulo the documented flake families — re-run any failure in isolation and check reachability before blaming the diff).
- [ ] `npm run build` → **check `$?`, foreground** (a sandboxed/background shell can fail the Google-Fonts fetch and it looks like a code break — measured 2026-08-16).
- [ ] **Apply the migration BY HAND** in the SQL editor; verify with a direct `select proname from pg_proc where proname = 'remix_blueprint_set_variant_script'`.
- [ ] **Live, signed in, dev server:** seed a blueprint for the e2e user → open the thread surface → confirm the replay note carries the `remix_sheets` data block (probe the POST body or the loop's messages, not the DOM) → send "beat 2 is too soft — punchier" → confirm: the tool ran free (no credit wall, no `dispatch` frame for it), the `revised` SSE frame arrived (**count off the SSE, not the DOM** — [[emit-card-fires-in-a-later-round]]), the card refetched (network tab / fetch count), and — the decisive check — **re-read the row**: `script[variant]` changed ONLY at the targeted indexes, sibling variants byte-identical (`JSON.stringify` equality against the pre-call row, spec §8.5).
- [ ] Sample the revision N≥4 times before ANY quality sentence; report a rate, not a run.
- [ ] `seed-remix-blueprint.ts --drop <id>`.
- [ ] PR with gates + live evidence in the body; merge only after re-checking `origin/main` moved-ness.

## Out of scope (deliberately)

- Hook/angle/whoItsFor revision — frozen on the block, needs a message-mutation path that doesn't exist (spec §6.6; owner lane if ever wanted).
- Any change to `on-screen.ts` prose, `adapt.ts`, or the remix run route beyond reading their shapes.
- The one owed phase-4 item (live feed→Remix→clips E2E after Apify resets 2026-08-20) — different lane debt, not this plan's.
- Echo/n-gram output guards — measured catching 0 of 13 on the defect they were proposed for (#482's finding); a guard punishing shared wording fights the product ([[remix-is-a-1to1-copy]]).
