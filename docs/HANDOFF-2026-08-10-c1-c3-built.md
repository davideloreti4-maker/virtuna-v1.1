# Handoff — in-thread chat: C1 BUILT+MEASURED · C3 REMAINDER BUILT (2026-08-10, session 5)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Position at write time:** `fb848c4e` (C3) on `c8f846e3` (C1 evidence) on `87e98b34` (C1) on
session 4's `3eec125b`. Auto-pushed to `origin/lane/in-thread-chat` by the post-commit hook.
**NOT PR'd, NOT merged — main untouched. NO env var set anywhere; every new lever ships dark.**
origin/main moved during the session (`3d401e70` → `04e4c814`, co-session) — re-measure before
anything ref-sensitive.

## One paragraph

Session 5 executed the owner's two calls from the C0 handoff. **C1 (checkable-judge) is built,
gated and measured live**: a per-runner loop — generate → checkable checks (unfilled-`[slot]`
leak · ask-thesis inversion · count · anchor re-check) → ONE consolidated revise → honest
degrade — behind `ENGINE_JUDGE_{HOOKS,IDEAS,SCRIPT}` (default OFF). Live: **0 false positives
in 12 runs** (the S5 rubric-critic killer), **one real catch** (hooks delivered 2/5 → visible
"Delivered 2 of the 5" warning), cost +0–5s. **C3-remainder is built and live-verified**: the
script adapt briefer now sees the timed rhythm it was always promised (seconds on every beat)
plus what each source actually SAID per beat (`narrative_structure.structure_sections[].
transcript_sentences`, 524/532 rows) — briefer-only by design, and the live run showed no
verbatim leak into the shipped script. Other in-thread skills (develop/refine/chat) were not
touched: their fix is Stage B (owner's standing call).

## What landed (all on the lane)

| Commit | What | Evidence |
|---|---|---|
| `87e98b34` | C1 checkable-judge: `checkable-judge.ts` (slot-leak regex · narrow binary thesis judge, fail-OPEN · revise-prompt builder) + the loop wired in hooks/ideas/script runners. Script ships ORIGINAL+warning on failed revise; hooks/ideas DROP the failing unit; revision adopted only when strictly better (script: clears every check incl. anchor; units: strictly more clean). Chip runs (no real ask) skip the judge call. `judgeTrace` on results = harness surface. | `checkable-judge.test.ts` (14) + `judge-loop.test.ts` (9, runner-level, carries the VERBATIM measured leak payload) |
| `c8f846e3` | `scripts/ab-judge.ts` + the live measurement | `docs/AB-JUDGE-2026-08-10.md` |
| `fb848c4e` | C3 remainder: beat TIMINGS in the briefer decode view (all skills) + per-beat transcripts into the SCRIPT briefer only (`fetchBeatTranscripts` follow-up read — the match RPC has no `teardown` column; no migration needed), threaded via `gather-for-run` on example COPIES, `GROUNDING_SCRIPT_ADAPT`-gated, degrade-safe at every seam | `adapt-deep-anatomy.test.ts` (11) + live probe (5/6 teardowns fed full transcripts) + 1 full pipeline run (clean · cited · no verbatim leak · +3s) |

Gates at each commit: tsc clean · full suite green (5,729 at the end, +34 this session) · prod
build clean.

## 🔴 Finding that changes assumptions: cross-day temp-0 is NOT byte-stable

The measured case-1 script failure (verbatim template Turn + thesis inversion, committed
yesterday in `AB-ADAPT-IDEAS-SCRIPT-2026-08-10-script.md`) did **not** reproduce today — same
code, same flags, same cache-hit corpus, temp 0, seed 7. The `client.ts:24` "byte-identical
regenerate" assumption holds within a session, not across days (the adapt briefer is itself an
LLM call feeding generation; any serving-side drift cascades). Consequences:

- the C1 failure class is **INTERMITTENT** → a per-run gate is the right shape (a one-time
  prompt fix has nothing stable to fix against) — this strengthens the judge case;
- no future session can stage a live reproduction of a specific bad output on demand; the
  runner-level composition tests carrying the verbatim payload are the durable proof;
- A/B latency comparisons across days stay valid; content comparisons are weaker than the
  docs' framing implies.

## Skill coverage map (owner asked: "are we addressing all active skills?")

Verified against `skill-dispatch.ts` (chat-dispatchable: ideas · hooks · script · read) and
`src/app/api/tools/*` (one-shots: hooks · ideas · script · ideas/develop · refine · remix/run;
score/read surfaces: read · react · predict · simulate · profile · explore; chat).

| Skill | A (honesty) | C0 adapt | C1 judge | C3 | Quality fix lane |
|---|---|---|---|---|---|
| hooks | ✅ | ✅ measured | ✅ | — | done through C-levers |
| ideas | ✅ | ✅ measured (HOLD) | ✅ | — | done through C-levers |
| script | ✅ | ✅ measured (win) | ✅ | ✅ | done through C-levers |
| develop | ✅ (rows, headers) | n/a | — | — | **Stage B** (standing call) |
| refine | wired, chips bypass it | n/a | — | — | **Stage B** (B2) |
| chat | ✅ (warnings, F-1 cap) | n/a | — | — | **Stage B** |
| remix | — | n/a | **— (unguarded)** | — | no measured defect; decide at B: wire judge cheaply or wait |
| read/react/predict/simulate/profile/explore | — | n/a | n/a (they score/read, don't generate) | — | out of scope by design |

## Open owner decisions (updated)

1. **Prod flip** (deployment currently OFF — owner switching Vercel accounts; touch nothing):
   recommended set is now `GROUNDING_SCRIPT_ADAPT` + `GROUNDING_HOOKS_ADAPT` +
   `GROUNDING_HOOKS_SURFACE=structure` **+ `ENGINE_JUDGE_{HOOKS,IDEAS,SCRIPT}`** (measured:
   0 FP, 1 real catch, +0–5s; judge is independent of adapt and also guards the slice path).
   `GROUNDING_IDEAS_ADAPT` still held (unchanged — craft read owed).
2. **F-6 multiplier positioning** (backfill / stop printing / relabel) — still bracketed.
3. **`composer.tsx` split** (with Stage B / surgical only) — still bracketed.
4. **Next stage: Stage B — DECIDED (owner, end of session 5).** One brain: B1 card CTAs
   through the agent loop (`forceSkill` exists) · B2 `cards` slot + chips→refine · B3 cheap
   pre-router for the 4.8s dead zone. Also the fix lane for develop/refine/chat. C2/C4 ride
   after. Recommendation on the composer bracket: split WITH Stage B (the seams are open
   there anyway) — owner call still pending.

## Traps (session-5 additions)

- **`~/ab-judge-raw-script.json` was CLOBBERED** by the post-C3 1-case rerun (the manual
  preservation copy predates the harness suffix and shares its name). The full morning script
  arm survives in `~/ab-judge-raw-all.json` (all 12 runs, merged). Raw dumps are run residue,
  not evidence — the committed doc is the record.
- Untracked residue, deliberately not committed: `docs/AB-ADAPT-IDEAS-SCRIPT-2026-08-10.md`
  (session 4's un-suffixed combined doc) and `docs/AB-JUDGE-2026-08-10-script.md` (the 1-case
  C3 rerun; its facts are in this handoff). `.scratch/probe-c3-enrichment.ts` is the C3 live
  probe (gitignored, re-runnable).
- The `.claude` memory store is outside this worktree's git root — the path guard blocks
  Write from here (07-15 precedent); THIS DOC is the durable record.
- `judgeTrace` entries are pushed on BOTH check passes (initial + post-revise) — a doubled
  `check:count:2/5` in a trace means "still failing after revise", not a bug.
- The judge marker for call-dispatch in tests is the system-prompt phrase
  `"mechanical output checker"` — change the judge system prompt and `judge-loop.test.ts`'s
  dispatcher goes blind (it will fail loudly, but know why).

## Resume recipe

Session 3's recipe still holds (`HANDOFF-2026-08-10-stage-a-built.md` §Resume). Harnesses
(foreground, sandbox OFF — rtk silently drops DashScope/Supabase):

```bash
# C1 judge measurement (per skill; ~2 min each; writes AB_SKILL-suffixed docs — no overwrite):
AB_SKILL=script node node_modules/tsx/dist/cli.mjs scripts/ab-judge.ts
AB_SKILL=hooks  node node_modules/tsx/dist/cli.mjs scripts/ab-judge.ts
AB_SKILL=ideas  node node_modules/tsx/dist/cli.mjs scripts/ab-judge.ts
# C3 enrichment probe (embedding cost only, no generation):
node node_modules/tsx/dist/cli.mjs .scratch/probe-c3-enrichment.ts
# Session 4's harnesses: re-date their OUT paths before re-running (they overwrite evidence).
```

Spend note: ~15 pipeline runs this session, all DashScope flash credits via harnesses — zero
prod e2e-account credits used.
