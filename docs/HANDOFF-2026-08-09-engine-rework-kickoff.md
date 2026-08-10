# Handoff — in-thread chat: engine-rework kickoff (2026-08-09, end of session 2)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Position at write time:** 3 commits ahead of `origin/main` (`69a5270f` → `c970b9f7` → `4bae1171`),
0 behind. NOT pushed. ⚠️ Co-sessions move refs — `git fetch` and re-measure before branching or PR-ing.
**Sibling session:** `virtuna-platform-concept` owns the v8 concept lane; stay out of it.

## What this lane is

Two audit sessions (Opus, then Fable) measured the in-thread chat surface end to end and produced a
staged engine-rework proposal. **NOTHING IS BUILT — the lane is 100% docs + probe scripts.** The
owner has NOT yet picked a stage.

## Read in this order

1. `docs/PROPOSAL-2026-08-09-generation-engine-rework.md` — THE document. Diagnosis (§1–2),
   staged plan A→D (§3), don't-touch list (§4), open owner decisions (§5).
2. `docs/HANDOFF-2026-08-09-in-thread-chat-live-runs.md` — session 2's evidence: new P0s N-1…N-8,
   F-17/F-21 corrections, §3b residue from the session-1 author, §3c corpus data measurements.
3. `docs/HANDOFF-2026-08-09-in-thread-chat-audit.md` — session 1's 22 findings (F-1…F-22),
   benchmark tables vs Perplexity, mobile findings, corpus SQL.

Memory `in-thread-chat-audit-lane.md` is the compact index of all of it.

## The 60-second version of the diagnosis

- Generation = ONE pass of `qwen3.7-flash` (temp 0, seed 7 → regenerates byte-identical), prompt
  capped at 4,000 chars total, ~450 chars per grounding example. Validation is shape-only.
- The chat path has thread memory; it compresses to ONE `topic` sentence before generation. Card
  CTAs (`/api/tools/{hooks,ideas,script}` one-shots) see NO thread context, persist NO user row
  (→ turn-merge bug N-8), and the script anchor is an uninstructed fence (→ wrong-topic script N-7).
- `adapt.ts` — the measured fix for grounding that currently LOSES to no-grounding — is built and
  dead behind `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ADAPT` (unset). Same for
  `GROUNDING_HOOKS_SURFACE=structure`.
- Ranking is the generator's self-estimate (the scoring SIM was removed 2026-07-22); the UI's
  "reacted with your 10 reactors, strongest first" claims machinery that doesn't run.
- A real refine engine (`/api/tools/refine`) exists; the shipped follow-up chips bypass it.

## Owner decisions pending (proposal §5)

1. Which stage first — recommendation: **Stage A** (contracts & honesty; pure bug-kills).
2. Stage C lane order — recommendation: **C0 (flip adapt + surface flags, A/B on a 10-ask probe
   set) → C1 (judge on CHECKABLE properties only — the removed rubric critic failed ~100%) → C3
   remainder**; C2 (model tier + cap raise) if latency budget allows.
3. F-6 multiplier positioning (backfill follower data = scraping / stop printing / relabel).
4. `composer.tsx` (3,802 lines) split with Stage B, or surgical only.
5. (Carried from session 1, still unanswered:) sketch-first vs build-behind-gates for thread feel.

## Resume recipe

```bash
cd ~/virtuna-in-thread-chat && git fetch && git status
lsof -ti:3005 || npm run dev -- --port 3005          # reaper kills it after ~10 min idle
# signed-in browser: run the playwright setup, then inject the cookie from e2e/auth/state.json
set -a; . ./.env.local; set +a
E2E_BASE_URL=http://localhost:3005 E2E_USER_EMAIL=e2e-test@virtuna.local \
E2E_USER_PASSWORD=e2e-test-password-2026 \
  node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts
node scripts/probe-thread-mobile.mjs                  # green baseline: composerGrew:false · errors:0
```

Evidence threads on the e2e account (⚠️ REAL prod account; every live run spends credits;
`BILLING_ENFORCE_QUOTA=true`; 3 runs spent across both sessions):
- "give me hooks for a video…" — the MERGED turn (N-8), F-1 dup, seed-line "0" (N-2), dance-script
  card (N-7)
- "3 hooks for my new video were i didnt eat…" — F-2 outro/button contradiction, F-5 junk template,
  F-7 same-reel×3
- "give me video ideas…" — F-3 "General" summary

## Traps that already bit these sessions

- `page.evaluate` with a STRING function silently returns undefined → always pass a real function.
- Never conclude mobile facts from desktop elements (`aside` misread produced F-17; probe field is
  now `desktopAsideHidden`).
- The "N" bottom-left and ⚙ bottom-right are dev-only overlays, not product bugs.
- Vercel git is DISCONNECTED (memory `vercel-git-disconnected`): merging does NOT deploy; a green
  check is not a build — run `tsc` yourself.
- Benchmark set is Claude + Perplexity ONLY (owner, explicit).
- Don't "fix" the zero-accent thread, the empty state, or the one-shot script run's live progress
  card — see proposal §4.
