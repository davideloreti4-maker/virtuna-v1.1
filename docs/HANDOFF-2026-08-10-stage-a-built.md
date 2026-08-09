# Handoff — in-thread chat: STAGE A BUILT (2026-08-10, end of session 3)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Position at write time:** commit `7d4bc133` (Stage A) on top of a merge of origin/main (which had
moved 39 commits — composer v8; no engine-file conflicts). Auto-pushed to
`origin/lane/in-thread-chat` by the post-commit hook. **NOT PR'd, NOT merged — main untouched.**
⚠️ The previous kickoff's "unpushed" claim was stale: the hook has been publishing the lane all
along. Assume every commit you make here is public on the lane branch the moment you make it.

## Where the lane stands, in one paragraph

Two audit sessions produced a staged engine-rework proposal (A→D). Session 3 (this one) BUILT
Stage A — contracts & honesty — end to end: all measured P0s from the audits are fixed at their
mechanisms, gated (tsc clean · 5,689 tests green, +41 new · prod build clean · mobile probe green)
and live-verified on the e2e account, including one paid script run that proved the N-7 fix with
the real model. Stages B (one brain), C (quality pass), D (corpus & measurement) are NOT started.

## What Stage A changed (all in `7d4bc133`)

| Finding | Fix | Where |
|---|---|---|
| N-7 script ignores its anchor | anchor fence label states the contract per mode; runner checks opening honors anchor (word overlap), ONE retry with the rejection IN the prompt (temp0/seed7 ⇒ must change the prompt), else visible warning | `assembler.ts anchorLabel()`, `script-runner.ts`, guards in `output-guards.ts` |
| N-8 chip runs merge on reload | one-shot routes (hooks/ideas/script/develop) persist a USER-ACTION row before the assistant message | the four `route.ts` files, "(5c)" sections |
| N-2 seed line "0" | implausible seedHook → hookLine at validation; renderer suppresses junk on old rows | `hooks-runner.ts`, `hook-card-block.tsx` |
| N-4 count ignored | `count` slot in dispatch tool schema + route body + ask-parse fallback, clamped 1..5 | `skill-dispatch.ts`, `hooks/route.ts`, `hooks-runner.ts` |
| N-1 decorative receipts | citation dropped to honest "Original" when the madlib's literal segments don't appear in the output (mechanics, not taste) | `templateInstantiated()` in `output-guards.ts`, wired in hooks+script runners |
| F-7 same source ×3 | per-source receipts capped at 2/run, rank order keeps priority | `createSourceDiversityCap()` |
| cite-what-was-truncated | `sourceIndex` resolves against examples that SURVIVED bundle assembly | `trimExamplesToBundle()`, wired in all 3 grounded runners |
| chat-path uncapped args | topic/anchor capped 2000/5000 in `parseSkillArgs` (mirrors routes) | `chat-agent-loop.ts` |
| F-3 'General' flash | chat + develop routes stamp run-headers (`skillKey` now on `SkillRunOutput`); renderer fallback is 'your audience', never 'General' | `chat/route.ts`, `develop/route.ts`, `thread-turn.tsx:220` |
| warnings swallowed | loop passes runner warnings through (was `[]`); chat route emits `warning` SSE; client parses + renders | `chat-agent-loop.ts:~1140`, `chat/route.ts`, `use-chat-stream.ts`, `composer.tsx` candidate |
| F-1 markdown re-answer | post-tool prose capped 600 chars server-side; refusal turns (no cards) uncapped | `POST_TOOL_TEXT_CAP` in `chat-agent-loop.ts` |
| N-3 ranking lie | intro copy claims the METHOD (projection), never a reaction — now agrees with the panel's "Not simulated yet"; greeting tile "pre-tested" retired | `conversational-frame.tsx introLine()`, `embedded-composer.tsx` |

New module: `src/lib/tools/runners/output-guards.ts` (+ tests) — pure CHECKABLE guards. Design
constraint honored: the removed rubric critic failed ~100% judging TASTE (`hooks-runner.ts` S5
note); every guard here judges mechanics (word overlap, literal segments, digits, prefix survival).

## Live verification performed (evidence)

- Free (reload only): old hooks thread now shows "Delivery"-only expanders (seed "0" suppressed),
  new intro copy on old turns. Old merged turns STAY merged — persisted data, expected.
- **Paid (1 script run, the session's budget):** clicked "Write the script →" on the same hook
  that previously produced the dance script (N-7). New script opens with the anchored hook
  VERBATIM ("Stop trying to wake up at 5 AM…"), 5 beats all on-topic ("Sleep science vs hustle
  culture"). After reload it is its OWN turn with a user bubble `Write a script from "Stop trying
  to wake up…"` — no merge. That thread now holds both scripts back-to-back: the old dance one
  (broken) directly above the new anchored one (fixed) — a perfect before/after exhibit.
- `probe-thread-mobile.mjs`: composerGrew:false · consoleErrors:0 · smallTargets 103 (was 91 —
  scales with thread rows per the probe's own note; the thread gained a turn).

## What is NOT done

- Stage B (route card CTAs through the agent loop, `cards` slot for "rewrite these", pre-router
  for the 4.8s dead zone) — untouched.
- Stage C — untouched. `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ADAPT` and `GROUNDING_HOOKS_SURFACE`
  remain UNSET; adapt.ts is still the built-but-dead fix. C0 (flip + A/B on a 10-ask probe set)
  is the recommended first move and near-zero build cost.
  ⚠️ C0 interaction note: `trimExamplesToBundle` falls back CONSERVATIVELY (drops unresolvable
  tails) if a corpus format's numbering can't be parsed — the adapt.ts briefer output should be
  checked against it when C0 flips the flag (untruncated corpus is a no-op, so this only matters
  if an adapt brief overflows the bundle).
- Stage D — untouched (F-5 junk rows, F-6 multiplier basis, retrieval eval harness).
- F-8 `fitLabel`="adjacent" hardcode — untouched (Stage C4).
- F-2 (prose picks #2, button runs #1), F-11 streaming feel, F-13 guillotine — untouched.

## Open owner decisions (unchanged from proposal §5)

1. Stage C order — recommendation stands: **C0 (flip+measure) → C1 (checkable-judge) → C3**, C2 if
   latency budget allows. Not yet owner-confirmed.
2. F-6 multiplier positioning (backfill = scraping / stop printing / relabel) — blocks part of D.
3. `composer.tsx` (~4,000 lines) split with Stage B, or surgical only.
4. Sketch-first vs build-behind-gates for the thread feel work.

## Resume recipe

```bash
cd ~/virtuna-in-thread-chat && git fetch && git status   # expect: clean, ahead of origin/main only by lane commits
lsof -ti:3005 || npm run dev -- --port 3005              # reaper kills it after ~10 min idle
set -a; . ./.env.local; set +a
E2E_BASE_URL=http://localhost:3005 E2E_USER_EMAIL=e2e-test@virtuna.local \
E2E_USER_PASSWORD=e2e-test-password-2026 \
  node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts
# MCP browser sign-in: addCookies() from e2e/auth/state.json via a snippet file under
# .playwright-mcp/ (MCP file access is rooted there) — then goto /home. DELETE the snippet after:
# it contains the session token.
node scripts/probe-thread-mobile.mjs                     # green: composerGrew:false · errors:0
```

## Traps (session-3 additions on top of the kickoff's list)

- **Committing = publishing.** The post-commit hook pushes `HEAD` to the lane branch and logs to
  `~/.claude/auto-commit-push.log`. "Unpushed lane" is never true here.
- Route tests assert `insertMessage` call ORDER — the user-action row is now `calls[0]`, the
  assistant message `calls[1]` (+ follow-up `calls[2]` where routes emit one). Extending a route
  test? Count from the new contract.
- `vi.fn(async () => …)` arg-less mocks make `mock.calls[0][0]` a type error under tsc — give the
  mock a typed parameter instead of casting.
- The e2e account's evidence threads are still the best free regression fixtures: the merged turn
  + dance script are PRESERVED (old data) directly above the fixed run.
- Co-sessions are active on `lane/platform-concept` — re-fetch before measuring anything.
