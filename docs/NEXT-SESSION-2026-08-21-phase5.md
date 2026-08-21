# Next session — remix phase 5 (`revise_remix`) execution brief · written 2026-08-21

**Lane:** remix · worktree `~/virtuna-remix-shoot-sheet` · branch `feat/remix-revise-phase5`
(pushed; holds the plan + the spec §6.8 corrections; based on origin/main of 2026-08-16 — **merge
current origin/main in before task 1**, main moves daily here).

**State:** Phase 4 is fully closed. The owed live E2E ran 2026-08-21 through the real UI:
row `u49bxDWRcpyN`, 8 clips cut during adapt, uploaded on success only, route serves signed
clips 0–7, delivered bytes 1 stream / no audio / 360×640. The failure path also proved itself
live (run 1: `adapt_failed` → no row, bucket untouched). **Do not re-run it.**
`NEXT_PUBLIC_ENGINE_ONE_BRAIN` defaults ON since #538 — the chat loop is the default path now.

---

## ▶️ PASTE THIS TO START

```
Repo ~/virtuna-remix-shoot-sheet, branch feat/remix-revise-phase5.

Read, in order:
1. docs/superpowers/plans/2026-08-16-remix-revise-phase5.md  (the plan — execute it task by task)
2. docs/superpowers/specs/2026-08-15-remix-clips-and-revise-design.md §6 AND §6.8
   (§6.8's corrections OVERRIDE §6.7's original sentences — build to §6.8's reality)
3. docs/NEXT-SESSION-2026-08-21-phase5.md (this brief)

Execute with superpowers:subagent-driven-development. TDD: red test first, every task.

⚠️ First: git fetch && git merge origin/main (branch is from 2026-08-16; main moves daily).
⚠️ main is checked out by the trunk worktree — never switch to it here.
⚠️ Re-check origin/main before the PR too; co-sessions merged 3 PRs under the last session
   in one afternoon.

THE FOUR THINGS MOST LIKELY TO GO WRONG (all measured, all in the plan):
1. The address channel has ONE seam, not two — remix cards reach the model only as a
   role:"user" thread-state note via skillRecords (chat-agent-loop.ts ~:596). There is NO
   live path and NO tool-result JSON today. ChatAgentPriorTurn gains the structured field.
2. The refresh channel cannot ride the existing thread reload — every React key in the
   chain is a positional index, so RemixBeats never remounts. It needs its own nonce
   context (imitate arrivalNonce, composer.tsx ~:2797).
3. revise_remix is FREE: its dispatch branch goes BEFORE the skill lookup (like emit_card,
   ~:1391), never touches deps.billing.gate, never fires onDispatch. Assert all three.
4. The write is ONLY the jsonb_set RPC (variant-isolated). Never read-modify-write the
   whole script array. supabase-js RETURNS errors — read {error} or the write silently
   stores nothing. The migration is applied BY HAND in the SQL editor (db push = ledger drift).

DO NOT:
- Do not re-run the phase-4 E2E (closed 2026-08-21, row u49bxDWRcpyN). Apify budget is fresh
  but phase 5 needs NONE — live proof uses scripts/seed-remix-blueprint.ts (PROD db: always
  --drop after).
- Do not clamp/cap script fields beyond AdaptedBeatZodSchema (import it from adapt.ts,
  don't copy it).
- Do not add an echo/n-gram output guard (caught 0/13 on the defect it was proposed for;
  a remix copies the source ~1:1 BY DESIGN).
- Do not touch on-screen.ts prose, adapt.ts, or the remix run route.
- Do not claim anything "runs in production" — deploy is owner-confirmed OFF.

🔴 Adapt attempt 0 failed in BOTH live runs ("returned no script[] despite a beat map");
the retry is load-bearing. One run proves plumbing, never quality — sample N, report a rate.

⚠️ Suite: --maxWorkers=3, kill dev servers first. Flake families: scraping/resolve-video,
engine/omni-analysis-*, three composer-*.tsx (composer-offline-gate fails ~50% even in
isolation — measured). Re-run in isolation + check the file can REACH your diff before blaming it.
⚠️ npm run build in the FOREGROUND and check $? — a sandboxed/background shell fails the
Google-Fonts fetch and it reads as a code break.
```

---

## Verification cheat-sheet (task 6)

- Signed-in browser: `node scripts/mint-auth-state.mjs http://localhost:301X` then raw
  Playwright with `storageState: '.scratch/auth-state.json'`. `networkidle` NEVER settles here.
- Seed: `node node_modules/tsx/dist/cli.mjs scripts/seed-remix-blueprint.ts --email
  e2e-test@virtuna.local --path "omni-split/59455-447571480576291.mp4" --source "<tiktok url>"`
  → `--drop <id>` after. PROD database.
- The decisive phase-5 check: **re-read the row** after a revise turn — `script[variant]`
  changed only at targeted indexes, sibling variants byte-identical. Never trust the UI for this.
- Count `revised` frames off the SSE, not the DOM (emit-card lesson: frames land in a later
  round than the prose).
- A working E2E driver for the feed flow (dialog click included) sits in trunk at
  `~/virtuna-v1.1/.scratch/e2e-remix-run.mjs` if ever needed again.
