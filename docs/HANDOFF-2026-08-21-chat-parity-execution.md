# HANDOFF 2026-08-21 — Chat parity with Claude/ChatGPT: execution plan

**Branch:** `lane/chat-parity` (docs only). Execution sessions branch from `origin/main` — always
`git fetch` + `git rev-parse origin/main` first; co-sessions move refs.
**Worktree note:** a new worktree needs its own `npm install` and its own `.env.local` (copy from
trunk BEFORE any `worktree remove` — removal deletes gitignored files).

**Source:** full audit session 2026-08-21 (three deep code sweeps: chat surface inventory, agent
loop/Qwen internals, grounding/latency). Every claim below carries file:line from that audit —
re-verify lines before editing; main moves.

## Owner rulings captured this session

1. **Money is unlocked.** "Everything can be turned on" — live scraping, cron scheduling,
   background execution, model spend. See the Apify blocker below before flipping anything.
2. **Onboarding interview is ruled outdated** — and the audit found it was already deleted
   (PR #502, 2026-08-14); today's funnel is already handle-first. The real gap is the missing
   scrape→profile write-back. Lane 9 items 1–6 execute without further rulings; obs 1 + 6 of the
   2026-08-04 refinement lane still await the owner.

### 🔴 Blocker on the money ruling: Apify account

Apify runs on rotating FREE accounts with a **$5/month hard cap**
(memory: `apify-free-plan-hard-limit`). Live sourcing costs ~$0.11/send verified — the cap dies in
~45 sends, and a cap-out masquerades as "check your handle is public". **"Everything on" requires a
paid Apify account first.** That is the one purchase gating Lanes 7 and 8. Confirm with the owner
which account/plan before scheduling any scrape cron.

### Standing verification norms (do not relax)

- tsc + `npm run build` + tests BEFORE push. A green Vercel check is NOT a build.
- 🔴 Deploy state: memory `vercel-git-disconnected` says auto-deploy is OWNER-CONFIRMED OFF and
  `numenmachines.com` 404s by design — **never make "watch it in production" a success criterion**;
  probe the running app only if the owner confirms a deploy.
- UI changes: verify in a real browser (Playwright: `animations: 'disabled'`, native viewport per
  device — resizing a loaded page is not the mobile UI). Suite flakes 0–7 tests under full load
  (memory: `suite-flakes-scraping-omni`) — ask whether a failing test can reach your diff.
- dev and prod share ONE Supabase project. `supabase db push` is UNSAFE (ledger drift) — single
  migrations via SQL editor / `apply_migration`.

---

## The audit in one table

| Dimension | vs Claude/ChatGPT | Verdict |
|---|---|---|
| Loading states (progress spine, evidence rail) | AHEAD | keep; 2 blind spots (Lane 5) |
| Grounding honesty (warrant, citable subset, banding) | AHEAD | keep |
| UI design system (charcoal, accent dosage, guards) | At parity, differentiated | polish only |
| TTFT (5.28s prose / 4.04s skill measured) | BEHIND | ~2s self-inflicted → Lane 1 |
| Message ops (regenerate/edit/copy/thumbs/search) | BEHIND | Lane 6 |
| Context (20-turn hard window, no compaction) | BEHIND | Lane 4 |
| Memory (no library/cross-thread/auto-extraction) | BEHIND | Lanes 2+3 |
| Freshness (ageless corpus, no web) | ABSENT | Lane 7 |
| Bigger tasks (background/scheduled/resumable) | ABSENT | Lane 8 |
| Onboarding (scrape→profile write-back MISSING) | broken data loop | Lane 9 |

Key figures an executor should not re-derive:
- TTFT decomposition (probe `scripts/probe-f11-stream-timing.ts`, N=4/shape, docs/NEXT-SESSION-2026-08-17.md §2b):
  prose 5.28s thinking-ON vs 3.14s OFF; skill 4.04s vs 2.35s. ~2s = `enable_thinking`
  (`chat-agent-loop.ts:1166`, quality-load-bearing — composition 6/6→2-4/6 without it; keep ON),
  ~3s provider baseline vs the 25,268-char system prompt, ~1.5–2s sequential pre-stream work.
- Loop bounds: `DEFAULT_MAX_ROUNDS=4` / `COMPOSING_MAX_ROUNDS=6`, `DEFAULT_MAX_SKILL_RUNS=2`,
  `MAX_CORPUS_SEARCHES_PER_TURN=3`, `max_tokens` 2000/4000 (`src/lib/tools/chat-agent-loop.ts:429-447`).
- Prior-turn window: `MAX_PRIOR_TURNS=20`, silent slice (`src/lib/threads/chat-prior-turns.ts:44`).
- Corpus: 532 rows (63% IG / 33% TikTok / 4% YT), `posted_at` populated on 532/532 and read by
  NOTHING; `proof_captured_at` NULL on all curated rows so the 90-day freshness gate is a no-op.
- Prod profile coverage (2026-08-10): 18 profiles, 3 saw the interview, 2 have niche/goal/style,
  0 have past_wins/pain_points. Auto-derived beats self-reported: 6/13 audiences carry a
  scrape-derived `creator_persona` vs 2/18 profiles carrying anything.

---

## Lane 1 — TTFT sequencing (free ~1.5–2s, zero product trade)

**Files:** `src/app/api/tools/chat/route.ts:300-473`.

Today, strictly sequential before the first SSE frame: auth → csrf → rateLimit (Upstash RT) →
`request.json()` → `creator_profiles` select → open-thread resolve → `resolveThreadAudience`
(2 selects) → `loadMessages` (select *, **no limit**) → `insertMessage` (user turn) →
`setThreadTitleIfEmpty` (select+update) → stream constructed.

Changes:
1. `Promise.all` the independent reads: profile ∥ thread-resolve, then audience ∥ loadMessages.
2. Move the two writes (`insertMessage`, `setThreadTitleIfEmpty`) past first token — the loop never
   reads them (`priorTurns` comes from `loadMessages`; the current ask is passed as `currentAsk`).
   Keep write-failure handling: if the user-turn insert fails after streaming began, persist at turn
   end with the assistant turn (same transaction) and surface a warning frame — never lose the turn.
3. Add `export const maxDuration = 300` to `/api/tools/chat` (it has NONE today; its skills assume
   a 300s budget — `skill-capabilities.ts:10-11` documents the mismatch). Same for the four heavy
   generator routes (`hooks`, `ideas`, `script`, `explore`) which also export none.
4. Provider resilience: chat client is `maxRetries: 0`, no fallback (`src/lib/engine/qwen/client.ts:15`)
   — one DashScope hiccup = user-facing error. Add one retry with short backoff on the FIRST
   completion call of a turn only (never mid-stream), preserving the cached prefix (retry nudges on
   user message, per `engine/remix/adapt.ts` pattern).

**Verify:** re-run `scripts/probe-f11-stream-timing.ts` (N≥4/shape) before/after; assert user turn +
assistant turn both persisted on happy path, abort path, and insert-failure path. tsc + suite.

## Lane 2 — Library visibility (`search_library` tool)

**Gap:** the model cannot see `saved_items`/`library_projects` — no tool, no bundle field. A saved
hook in a new thread is invisible. `match_personal_teardowns` RPC exists with NO producer
(`src/lib/grounding/retrieve.ts:16-18`).

Build: a free, read-only `search_library` tool bound alongside `search_corpus`
(registry: one `SkillTool` in `src/lib/tools/skill-dispatch.ts:217` shape `{name, skillKey,
billable?, schema, run}`; free tools follow the `search_corpus` pattern in
`src/lib/grounding/corpus-tool.ts`). Start with structured filters (type, recency, text ILIKE) over
`saved_items` — embeddings later only if recall proves weak. Return compact JSON rows + emit a small
UI receipt block (mirror `corpus-references` restraint: no block when 0 rows). Reuse the search
budget/withdrawal pattern (`src/lib/grounding/search-budget.ts`), shared or parallel governor.
Update `toolUseDirective` so the tool is named only when bound (`chat-agent-loop.ts:475-578`).

**Verify:** live thread — save a hook, new thread, "what did I save about X?" → correct row cited.
Sealed visitors must NOT get the tool (they have no library).

## Lane 3 — Memory: conversation → profile auto-extraction

**Gap:** chat never writes anything back; profile is empty for 16/18 users; every "add X to the
bundle" proposal dies on null columns (memory: `profile-columns-are-mostly-empty`).

Shape (ChatGPT-memories analog, adapted):
1. Post-turn extraction pass at turn persistence (NOT in the token path — zero TTFT cost): a cheap
   flash call over the user's turns of this thread, extracting ONLY facts that map to existing
   `creator_profiles` columns via `PROFILE_ROLE_MAP` roles (niche, audience, goals, platform, wins,
   flops, voice). No free-text memory store in v1 — fill the columns the bundle already reads.
2. Confidence + provenance: write only explicit self-statements ("I make cooking videos"), never
   inferences from questions. Store `{value, source: "chat", captured_at}`; never overwrite an
   interview/self-edited value with an extracted one without a receipt.
3. Receipt UX: a quiet one-line block under the turn — "Noted: niche → cooking. Edit in profile." —
   with undo. User-editable via the existing `profile-settings-form.tsx`.
4. Respect the corollary: prefer computed over asked — where a connected account exists, scrape-derived
   fields (Lane 9) outrank chat-extracted ones.

**Traps:** Supabase writes swallow CHECK failures silently — read the real CHECKs before any upsert
(memory: `supabase-check-constraints-fail-silently`). Coverage-count prod before/after; the win
condition is measured non-null coverage climbing, not a green suite.

## Lane 4 — Context: compaction + audience in the chat bundle

1. **Compaction:** when turns fall off the 20-turn window (`chat-prior-turns.ts:158`), fold them
   into a rolling thread summary persisted on `threads` (write at turn boundaries, same place as
   Lane 3's pass); prepend as one system-adjacent app note. Keep the summary out of the byte-stable
   system prefix (cache contract, `src/lib/kc/compiled.ts:1-10`) — it rides the user/bundle tier.
   Card lines stay OUT (they were evicted from the digest for copy-safety; keep that).
2. **Audience:** `resolveThreadAudience` result reaches skill runs but never the chat bundle —
   `assembleBundle` call at `route.ts:579-582` passes only `{ask, platform, mode, modeLabel}`. Add
   an audience role to `MODE_ROLES.chat` (currently `niche, audience, platform` — verify what
   `audience` maps to vs the thread's pinned audience) so the chat prompt knows who it's aiming at.
3. Do NOT just raise `MAX_PRIOR_TURNS` — compaction first; raising the window alone inflates the
   volatile tier and slows TTFT.

**Verify:** long-thread probe — 30+ turn thread, reference a fact from turn 2, answer must hold it.
Measure bundle size stays ≤ `BUNDLE_CHAR_CAP` shed behavior (`kc/assembler.ts:500-598`).

## Lane 5 — Interactive affordances: choice chips + search visibility

1. **`choices` variant of `request_input`** (`chat-agent-loop.ts:66-104`,
   `src/components/thread/input-request-block.tsx`): model supplies option VALUES only (2–4 short
   strings + optional "why" per option); chrome, copy, and layout stay registry-owned — the "no
   model-generated UI" policy survives. Selecting an option posts it as a user turn (same path as
   follow-up chips, `composer.tsx:1634-1651`). Cap value length; sanitize like `sanitizeCards`
   (strings only, junk → drop). Idempotence via the existing `shownInputFields` set.
2. **Model-authored follow-up text:** `chat-followups.ts` is a static registry (2–3 chips per turn
   kind). Allow the model to propose chip TEXT inside the fixed chip chrome (same sanitize rules),
   falling back to the registry when absent/invalid.
3. **Search visibility:** chat's own `search_corpus` emits no stage/evidence — a grounded prose turn
   goes silent ~10s per search round. Emit a `stage` frame ("Searching the corpus — 'query'…") on
   tool start/end from the loop (`chat-agent-loop.ts:1268-1294`), and reuse the evidence honesty
   rules (`src/lib/tools/evidence.ts:14-25` — input claims only, never result claims).

**Verify:** browser. Chips render, tap sends, second identical request_input suppressed. Screenshot.

## Lane 6 — Table-stakes message ops (one batch PR, or two)

- **Regenerate** on a successful assistant turn (today Retry exists only on failure,
  `run-notices.tsx:50-57`). Re-send the same ask; mark the old turn superseded (keep it — no
  destructive delete without ruling).
- **Edit a sent user message** + re-run from there (ChatGPT's main correction path).
- **Copy on prose turns** — `CopyAffordance` (`card-primitives.tsx:134`) exists for cards; add to
  `markdown-block` turns.
- **Thumbs up/down per assistant turn** — persist to a small table keyed
  `{message_id, user_id, verdict}`; this seeds the dead outcome loop (`reconciliations` = 0 rows
  forever, memory: `outcome-loop-has-never-closed`). No UI dashboards yet; just bank the signal.
- **Full-text thread search** — ⌘K palette searches titles only (`CommandPalette.tsx`,
  `app-shell.tsx:77-96`). Supabase FTS (tsvector on messages content) + palette section.
- **Composed-card action bar** — ships `disabled`/unwired (`composed-card-block.tsx:56-62`). Wire it
  or hide it; a visible dead control is worse than absence.
- Stretch: partial-stream persistence (persist assistant content at round boundaries so a mid-turn
  server throw doesn't lose the whole answer; today nothing persists until turn end and there's no
  `cancel()` on the ReadableStream — `route.ts:459`); LLM thread titles (today write-once heuristic).

**Verify:** each op in a real browser on a real thread; FTS via API probe; suite.

## Lane 7 — Freshness (money ruled ON; Apify blocker above applies)

1. **Use `posted_at`:** add recency to ranking (`src/lib/grounding/rank.ts:89-122` round-robin —
   recency as a within-archetype tiebreak ahead of similarity for topical axis; do NOT let it
   nuke structural retrieval where "structure never rots" is the documented stance) and surface age
   on reference cards (`corpus-references-block.tsx`) — "May 2026" chip. Cheap, honest, immediate.
2. **`LIVE_SCRAPE_DEFAULT=true`** (env; strict `=== "true"` — `scrape-default.ts:42-48`) once the
   paid Apify account exists. Note #517 made authorized runs scrape-FIRST (cache is the net behind,
   `gather-for-run.ts:423`) — so this flag turns ~every generator send into ~$0.11. Env vars are
   write-only `sensitive` on Vercel and need a REDEPLOY; probe the running app after.
3. **Fix the limit lie:** tool advertises `limit` 1–12 (`corpus-tool.ts:42`) but retrieval caps at
   `maxExamples: 6` (`retrieve.ts:102,435-438`). Align the advertised max to the real one (6) —
   fix the claim, not the threshold, unless the owner wants more rows.
4. **Platform correctness:** `PLATFORM="tiktok"` hardcoded but never reaches resolution; corpus is
   63% Instagram — derive platform from the source URL (memory: `corpus-is-majority-instagram`).
5. **Web search in chat:** still ABSENT and the largest capability gap. Scope as its own future lane
   (provider choice, honesty rules for web rows vs corpus rows). Do not bolt on inside this one.

## Lane 8 — Bigger tasks: background execution (money ruled ON)

Today: nothing survives the SSE request — no `waitUntil`, no job/queue table (0 of ~55 tables), no
resumable runs. 11 cron route dirs exist, only 3 scheduled in `vercel.json`; the 8 unscheduled
(`audience-drift`, `calculate-trends`, `refresh-account-snapshots`, `refresh-competitors`,
`refresh-corpus`, `scrape-trending`, `reap-anonymous`, `validate-rules`) are written and auth-gated
— they were unscheduled as deliberate cost control, which the owner has now lifted (Apify blocker
permitting).

Order of attack:
1. **Schedule the safe crons first** (no scrape spend): `reap-anonymous`, `validate-rules`,
   `calculate-trends`. Watch logs a full cycle.
2. **Scrape crons** after the paid Apify account: `refresh-account-snapshots`, `audience-drift`,
   `refresh-corpus`, `scrape-trending`, `refresh-competitors`. Price each per run BEFORE scheduling
   (memory: `price-a-fix-before-deferring`) and cap frequency accordingly.
   ⚠️ Do NOT touch `delete-retained-videos` — the video-retention cron has NEVER worked (missing FK;
   its green tests mock the FK graph — memory: `video-retention-cron-never-worked`). Separate fix.
3. **Background primitive:** smallest viable = Vercel `waitUntil` for post-response work (Lane 3's
   extraction pass is the first consumer). A real job table + resumable runs is a bigger design —
   brainstorm separately before building; it changes product shape ("watch my account", deep
   research runs), not just plumbing.

## Lane 9 — Onboarding: close the write-back loop (the interview is already dead)

**Corrected picture (audited 2026-08-21).** The 9-card interview modal was **deleted 2026-08-14
(PR #502)** — it had been unreachable since `/analyze` became a redirect (that's the whole "3 of 18,
nothing since 2026-05-31" stat). The card pickers survive only as the flat `/settings` profile form
(`profile-settings-form.tsx`). The onboarding a new account actually gets today is already the
handle-first shape:

`/signup` → middleware-gated `/welcome` → step 1 handle **or** description (`connect-step.tsx`;
no skip) → ~2 min calibration scrape (110–209s measured, blocking, not resumable mid-scrape) with
**3 optional questions rendered during the wait** (`wait-questions.tsx`: `primary_goal`,
`creator_stage`, `pain_points` — auto-save on tap, no submit button) → `/home` first-run
(one teaching sentence + show-once demo). Every calibration exit completes onboarding.

**🔴 The defect that matters — the scrape writes NOTHING to `creator_profiles`.** Calibration output
lands in `audiences.creator_persona` / `connected_accounts` / `account_snapshots`, while
`niche_primary`, `target_platforms`, `content_style`, `past_wins` stay NULL for every scraped
account. `HANDOFF-2026-08-15-three-orphans.md:33` claims "niche, platforms and past wins/flops all
fall out of the account read" — true of the DATA, never implemented as a WRITE. This is why chat
grounding sees an empty profile even for users who completed the new onboarding, and it is the
cheapest possible fix to the "empty profile" problem: **zero added friction, pure plumbing.**

Work items, in order:
1. **Write-back:** after `calibrateFromScrape`, populate `creator_profiles` from scrape output —
   `niche_primary`/`niche_sub` (from `creator_persona.content_description` / `nicheQuery`),
   `target_platforms` (connect door's platform), `content_style` (`format_signature`/`formatMix`),
   `past_wins` (top `analyzedVideos` by views). Never overwrite a non-null self-edited value.
   Read the real CHECK constraints first (writes swallow errors silently).
2. **Fix obs 2** — "Good afternoon," with no name (`home-greeting.tsx` expects a name a new account
   never gave). Straight bug, no ruling needed.
3. **Wire or delete the cold-start nudge:** `coldStart` is computed, streamed as the first meta
   frame, parsed, made sticky (`use-chat-stream.ts:287-293`) — and consumed by NOTHING (the
   documented consumer `ChatThreadView` exists only as a dev-page stub). Either build the D-08
   nudge (one-time, only when a needed field is null AND would change the next run) or remove the
   dead signal.
4. **Unify `isColdStart`:** three near-copies; `assembler.ts:377-387` added `hasVoice` against the
   "MIRRORS EXACTLY / do NOT modify independently" contract in `chat-runner.ts:159`. Inert today
   (voice has no producer — `writing_voice_description` isn't even a column), but a live
   contradiction. One predicate, one home.
5. **Prune dead intake from `/settings`:** `cuts_per_second`, `reference_creators`,
   `posting_frequency`, `time_of_day_aware` feed only the video-analyze pipeline
   (`engine/creator.ts:262`), not any generative skill. Either label that section honestly
   ("video analysis settings") or drop the fields. `pain_points` stays — collected by explicit
   design ruling as roadmap signal, deliberately NOT engine grounding (`wait-questions.tsx:28-30`).
6. **Platform:** `connect-step.tsx:115` hardcodes `platform: "tiktok"` — the corpus is 63%
   Instagram; open the door enum (ties to Lane 7 item 4).
7. **Coverage-gate the goals role:** `primary_goal`/`creator_stage` (the wait questions) reach only
   `idea` mode today. Once write-back + Lane 3 raise coverage, re-count prod and consider adding
   `goals` to more `MODE_ROLES` — a previous attempt died on 16/18-null coverage; the fix is
   upstream data first, roles second.

**Still owner's call (from the 2026-08-04 refinement lane):** obs 1 (400px card in a desktop void)
and obs 6 (the teaching half is one sentence sitting below the composer — "the one that matters
most and is the least built"). Obs 3/4/5 are settled COPY constraints; the five 🔒 locked calls in
`docs/HANDOFF-2026-08-04-onboarding-ui-refinement.md` stand — onboarding IS the first run; no tour,
no demo screens. `docs/ONBOARDING-FUNNEL-DESIGN.md` S3 ("delete /welcome, calibrate inside /home")
remains the sketched end-state if the owner wants to go further than write-back.

---

## Sequencing & dependencies

- Lanes 1, 2, 5, 6 are independent → separate branches/PRs off `origin/main`, any order. Lane 1
  first (everything else gets measured against a faster baseline).
- Lane 3 wants Lane 8's `waitUntil` primitive (post-response pass) — or run inline at persistence
  if `waitUntil` is deferred. Lane 4's compaction shares Lane 3's turn-boundary hook: build the hook
  once.
- Lane 7 steps 1/3/4 are independent code fixes; step 2 waits on the Apify account.
- Lane 9 needs one owner approval of the shape, then obs-2 fix + build.
- One dev server per port; check `lsof -ti:3000`. Suite flake families per memory before blaming a
  diff.

## Copy-paste kickoff prompts

Lane 1 — TTFT:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 1. New worktree + branch off
> origin/main. Parallelize the pre-stream reads and defer the two writes past first token in
> src/app/api/tools/chat/route.ts; add maxDuration to the chat + generator routes; add one
> first-call retry to the Qwen client path. Prove with scripts/probe-f11-stream-timing.ts
> before/after (N≥4 per shape) and the persistence tests. tsc + build + suite before push.

Lane 2 — Library tool:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 2. New worktree + branch. Add a free
> read-only search_library tool over saved_items following the search_corpus/search-budget
> patterns; compact JSON to the model, receipt block to the UI, no block on 0 rows, absent for
> sealed visitors. Live-verify: save a hook, new thread, ask for it.

Lane 3 — Memory extraction:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 3. Brainstorm the extraction contract
> first (columns, confidence, receipts, undo), then build the turn-boundary pass + receipt block.
> Read the real CHECK constraints before any upsert. Success = prod coverage counts climbing.

Lane 4 — Compaction:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 4. Rolling thread summary at turn
> boundaries + audience role into the chat bundle. Keep the system prefix byte-stable. Long-thread
> probe is the gate.

Lane 5 — Choice chips:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 5. Add the choices variant to
> request_input (values from the model, chrome from the registry), model-authored follow-up text
> with registry fallback, and stage frames for search_corpus. Browser-verify with screenshots.

Lane 6 — Message ops batch:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 6. Regenerate, edit+rerun, copy on
> prose, thumbs (new table, no dashboard), FTS thread search, wire-or-hide the composed-card action
> bar. Browser-verify each. Split into two PRs if the diff grows.

Lane 7 — Freshness:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 7. Recency tiebreak + age chip, fix the
> limit 12→6 claim, derive platform from source URL. LIVE_SCRAPE_DEFAULT only after the paid Apify
> account is confirmed; env change needs a redeploy — probe the running app.

Lane 8 — Background:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 8. Schedule the three no-spend crons
> and watch a full cycle. Then waitUntil primitive. Scrape crons only after the Apify account;
> price each per run first. Do not touch delete-retained-videos.

Lane 9 — Onboarding:
> Read docs/HANDOFF-2026-08-21-chat-parity-execution.md Lane 9 + the two 2026-08-04 onboarding
> handoffs. Do items 1–2 first (scrape→profile write-back; the greeting-comma bug), then 3–6.
> Never overwrite non-null self-edited values; read the CHECK constraints before upserting. Do not
> re-litigate obs 3/4/5 or the five LOCKED calls. Verify write-back with a real signup + scrape and
> a prod coverage count.

## Explicitly out of scope this audit

Mobile-specific UX (not swept), pricing/billing UX, landing/trial funnel (own lane, in flight),
a11y (lane closed 2026-08-21), voice input/TTS, thread branching, generic multimodal composer
(routed attach is the product answer), MCP (solves a problem Maven doesn't have).

## Also-noticed (small, park or fold into nearest lane)

- `delta.reasoning_content` never read in the loop (`chat-agent-loop.ts:1194-1212`) — provider
  reasoning on the proper channel is dropped silently; read-and-discard explicitly.
- Adaptive `enable_thinking`: predispatch already classifies the ask — skipping thinking on
  smalltalk/simple prose turns would cut ~2s on those turns. Needs a quality probe per shape
  (N≥6, rate not one-shot — DashScope is nondeterministic even at temperature:0).
- Model tiering: all roles resolve to `qwen3.7-flash`; the rollback-seam constants would accept a
  deeper model for script/remix now that spend is unlocked. Probe quality first.
- `composer.tsx` is 4,104 lines and owns half the chat behavior — decompose opportunistically when
  a lane touches it, not as its own project.
- Motion contract (`docs/MOTION-CONTRACT.md`) still awaits owner approve/amend before any surface
  sweep.
