# E2E walk — findings ledger

> **Lane:** `lane/e2e-fixes`, worktree `~/virtuna-e2e-fixes`, branched from `main` at `89e84daf`.
> **Build under test (from 2026-08-12):** `NEXT_PUBLIC_AMBIENT_V2` on **and `NEXT_PUBLIC_CONCEPT_V8`
> on** (verified: `POST /api/surfaces/drops` → 401, not 404 — the route only exists under the flag).
> ⚠️ **This is no longer the LIVE product.** v8 is unreleased, so a finding from here is a
> pre-release finding unless it also reproduces flag-off. Say which build each row was seen on.
> **Account:** a fresh signup, so onboarding / first-run / empty states are all in scope.
> **Nothing deploys** — Vercel git is disconnected while the owner switches accounts.
>
> _Superseded header (walk opened here): v2 on, v8 **off** — the live product, verified
> `POST /api/surfaces/drops` → 404. No findings were recorded before the switch._

⚠️ **dev and prod share ONE Supabase project.** Everything this walk creates is real production
data. There is no sandbox.

---

## Flag inventory — what is on while we walk

Read off the code defaults (`grep`'d 2026-08-12), **not** off `.env.local`. Anything set in
`.env.local` overrides these; confirm with `grep -oE '^[A-Z_]+' .env.local` before trusting a row.

**Client — must be passed inline or live in `.env.local`:**

| Flag | Predicate | State | Note |
|------|-----------|-------|------|
| `NEXT_PUBLIC_AMBIENT_V2` | `=== "true"` | **ON** | in `.env.local`. Gates the whole v2 arrival. |
| `NEXT_PUBLIC_CONCEPT_V8` | `=== "true"` | **ON** (inline) | NOT in `.env.local`. Layers on top of v2 — both required. |
| `NEXT_PUBLIC_ENGINE_ONE_BRAIN` | `=== "true"` | off | `src/lib/tools/one-brain-flag.ts` |
| `NEXT_PUBLIC_REACT_SCAN` | — | **keep off** | perf overlay; it renders exactly where a UI audit looks. |

**Server — default ON (a stray `="false"` silently turns them off):**
`CHAT_AGENT_DISPATCH` · `ENGINE_CHAT_CARDS_ON_SCREEN` · `ENGINE_COUNT_HINT` (flipped default-ON
2026-08-12, `d5dea06c`) · `ENGINE_AUDIO_SPLIT` (its value picks `ENGINE_VERSION` 3.23.0 vs 3.22.0).

**Server — dark, default OFF:** `COMPOSED_CARDS` · `ENGINE_GEN_CONVERSATION` · `ENGINE_GUESS_PIN` ·
`ENGINE_REPEAT_ASK_PIN` · `GROUNDING_CHAT_PREFLIGHT`. Leave them off — off is what ships.

**Not env:** `HORIZONTAL_ENABLED = false`, a hard constant in `src/lib/flags/horizontal.ts`. Hides
the Profile · Simulate · Predict verbs. A missing horizontal verb is by design, not a finding.

**Not a feature flag but it shapes the walk:** `BILLING_ENFORCE_QUOTA` is `true` in prod and the
free tier is `limit: 0`, so a fresh account hits the credit wall on the first paid skill. Expect it.

---

## How this ledger works

The owner walks the product and reports what looks wrong. Each report gets a row below, then gets
diagnosed and fixed one at a time. A finding is only marked **FIXED** once it has been re-checked
in the browser — not when the code changes.

**Status:** 🔴 open · 🟡 diagnosed, fix in flight · ✅ fixed + verified · ⬜ not a bug / by design

| ID | Surface | What the owner saw | Status |
|----|---------|--------------------|--------|
| E-001 | `/home` arrival | "old start page still rendering" — the Create/Research skill grid | ⬜ not a bug — flag-off render |

---

## Findings

_Each finding gets its own section here: what was reported, what the cause turned out to be, what
changed, and how the fix was verified._

### E-001 — `/home` renders the Create/Research grid ⬜ not a bug

**Reported:** "old start page still rendering" — `/home` showed a greeting card, an audience chip
row, a Create/Research grid of skills, and the `＋ Test something of your own` door.

**Cause — the premise was wrong twice over.**

1. It is **not** `start-page.tsx`. That component has **zero live imports** (every surviving mention
   is a comment) and `/start` (`src/app/(app)/start/page.tsx:12`) only `redirect("/home")`. It
   cannot render. Its `QuickActions` are a different set entirely — Make · Test · Ask + Repurpose
   (`src/components/surfaces/sections/quick-actions.tsx:4`).
2. What rendered was **`AmbientStartHome`** (ambient-v2). The screen's labels — "Ad creative / Test
   before you spend", "Account teardown / Yours, or a rival's", "Compare A/B / Two versions, one
   winner" — are verbatim from `src/lib/surfaces/ambient-v2-adapters.ts:392-404`.

The mount is a two-level gate at `src/components/app/home/composer.tsx:4002`:

```
AMBIENT_V2_ENABLED && !hasConversationContent && !startEngaged
  ? CONCEPT_V8_ENABLED ? <ArrivalV8/> + <DropShelf/>   // greeting-only arrival
                       : <AmbientStartHome/>           // ← the grid
```

The dev server was launched as a bare `npm run dev`. `NEXT_PUBLIC_AMBIENT_V2=true` lives in
`.env.local`; **`NEXT_PUBLIC_CONCEPT_V8` does not and never has** — it must be passed inline. So the
flag-off arm rendered, correctly. The grid is the shipping arrival; the greeting-only one is v8.

**Changed:** nothing in `src/`. No defect exists. The walk moved to the v8 build instead — see the
header, and the launch line below.

**Verified:** `POST /api/surfaces/drops` → **401** with the flags passed inline (404 without them —
the route is flag-gated, so its status is a wire-level read of `CONCEPT_V8_ENABLED`). Not asserted
from the code; measured against the running server.

**Trap to keep:** a bare `npm run dev` in this worktree silently gives you the **flag-off** UI, and
it looks like a legitimate surface rather than a misconfiguration. Always launch with:

```bash
NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3001
```

then hard-reload (⌘⇧R) — reusing a port across a flag change leaves flag-off RSC payloads and
chunks in the browser cache.
