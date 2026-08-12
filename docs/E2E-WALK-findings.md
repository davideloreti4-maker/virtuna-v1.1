# E2E walk — findings ledger

> **Lane:** `lane/e2e-fixes`, worktree `~/virtuna-e2e-fixes`, branched from `main` at `89e84daf`.
> **Build under test:** the LIVE product — `NEXT_PUBLIC_AMBIENT_V2` on, `NEXT_PUBLIC_CONCEPT_V8`
> **off** (verified: `POST /api/surfaces/drops` → 404). Every finding here is a real, shipping bug.
> **Account:** a fresh signup, so onboarding / first-run / empty states are all in scope.
> **Nothing deploys** — Vercel git is disconnected while the owner switches accounts.

⚠️ **dev and prod share ONE Supabase project.** Everything this walk creates is real production
data. There is no sandbox.

---

## How this ledger works

The owner walks the product and reports what looks wrong. Each report gets a row below, then gets
diagnosed and fixed one at a time. A finding is only marked **FIXED** once it has been re-checked
in the browser — not when the code changes.

**Status:** 🔴 open · 🟡 diagnosed, fix in flight · ✅ fixed + verified · ⬜ not a bug / by design

| ID | Surface | What the owner saw | Status |
|----|---------|--------------------|--------|
| _(none yet — walk in progress)_ | | | |

---

## Findings

_Each finding gets its own section here: what was reported, what the cause turned out to be, what
changed, and how the fix was verified._
