# Handoff — Cards UI session (Explore de-load + distinct, elevated Make cards)

**Date:** 2026-07-22 · **Branch:** `lane/skill-cards-prod` · **Status:** shipped + merged, green.
**Merged:** PR **#357** → `main` (merge commit `b9a6b9d4`). Lane reset clean to `origin/main`.
**Next:** owner is continuing **cards UI** and will hand fresh card feedback to the next session.

This was an owner-driven, card-by-card pass. Two things shipped (Explore, the 4 Make cards);
one thing was **trialed and reverted** (a ProofUnit "designed moment" — see §3).

---

## 1. What shipped (2 commits, PR #357)

### `feat(cards)` — Explore thread tile on the card spine (`fbf11e08`)
The in-thread Explore card rendered through the **Discover-page** `OutlierTile` — a different
component family: the loud **cream** Remix button (never got last session's tonal restyle) and
~11 stacked elements per tile, which is a **wall at the real 15–20-tile scale** the owner flagged
(the gallery fixture only shows 3 — verify at scale).

- `OutlierTile` gains a **`variant`** prop:
  - `grid` (default) = the unchanged Discover/Feed tile. **Cream primary kept byte-for-byte** —
    that CTA was deliberately excluded from the tonal restyle (`docs/HANDOFF-2026-07-22-cards-ui.md`).
  - `thread` = the in-thread Explore tile: the quiet tonal `CardPrimaryAction` (the sibling
    thread-card primitive) **+ a de-loaded layout** — the multiplier moves onto the cover as a
    badge (honest, keeps `vs own`/`vs niche`), the FIT bar + "predicted" subline collapse to one
    meta line (`● fit · views · source`), the 4-metric row drops to **views only**, caption
    clamps to one line.
- `DiscoverGrid` + `OutlierGridBlockRenderer` forward `variant`; the in-thread renderer **defaults
  to `thread`** (Discover page renders `DiscoverGrid` directly and is untouched).
- Files: `src/components/discover/outlier-tile.tsx`, `discover-grid.tsx`,
  `src/components/thread/outlier-grid-block.tsx`.
- Guard `outlier-tile-standard.test.tsx` stays green — it renders the **default** variant (cream).

### `feat(cards)` — distinct + elevated Make cards (`1d552ebb`)
The four Make cards shared ONE skeleton (hero line → why-line → **dominant ProofUnit** → expand →
action bar), so they read the same AND buried each skill's real value behind *expand*. Owner:
"they all should have their value, atm they kinda look the same." Now each **leads with its own
payload in its own visual form**, while keeping the family grammar (`bg-surface-sunken` chrome,
the shared `ProofUnit` room through-line, the honesty spine, `CardActionBar`).

| card | signature form | leads with |
|---|---|---|
| **Hook** | copyable **line** | asset header (`#rank` + one-tap **Copy**) · big line · **Why it works** promoted to a labeled payload |
| **Idea** | concept **brief** | title + angle · **Why it lands** · a **Topic·Take·Format recipe strip** (no Copy — a brief, not a line) |
| **Script** | **beat timeline** | a timing-column + connecting-rail shot list · **Copy script** (grabs the whole beat sheet) |
| **Remix** | **decode → apply** | source post → **Why the original worked** (hook pattern + the turn) → a *your version* divider → adapted hook + Copy |

**Elevation (owner: "still looks bland"):**
- **Editorial Newsreader SERIF heroes** on the deliverable lines (hook line / idea title / adapted
  hook) — the one place the design system sanctions serif (voice-moments). `font-serif text-[21px]
  font-medium leading-[1.3]`.
- A matte **`.elev-rest`** floor on every Make card root.
- Files: `hook-card-block.tsx`, `idea-card-block.tsx`, `script-card-block.tsx`, `remix-card-block.tsx`.

---

## 2. Design grounding (for the next session)

- **SSOT = `src/app/globals.css` `@theme`, NOT `docs/DESIGN-SYSTEM.md`** — that doc is itself STALE
  (says terracotta `#d97757` / bg `#262624`). Runtime truth: accent = **coral `#FF6363`**, card
  fill = `#1a1a19` (`--color-surface-sunken`), serif = Newsreader (`--font-serif`).
- Card fill is **locked to `bg-surface-sunken`** by `card-surface-consistency.test.ts` — don't
  change it. Depth comes from **serif + `.elev-rest` floor + nested tone zones**, not a lighter fill.
- Sanctioned un-bland levers: serif heroes (voice-moments), `.elev-rest`/`.elev-lift`, tone zones.
  The premium reference in-repo is the **Test card** (`video-test-card-block.tsx`) — a craft ring +
  driver bars (band-colored: sage→amber→coral-only-at-lowest).
- Accent dosage is **near-zero, owner-locked**. A restrained coral moment is possible but the
  owner rejected the one tried this session (§3) — get an explicit OK per attempt.

---

## 3. ⚠️ Trialed + REVERTED — the ProofUnit "designed audience moment"

Owner had asked (earlier this session) for **warmth + a designed data moment** on the shared
audience-reaction block (`ProofUnit`). Built: a **band-colored stop-rate ring** (`7/10` in the
center, arc = band color) replacing the thin ribbon, + **"See the room →" in coral**.

**Owner disliked it and it was REVERTED.** `src/components/thread/proof-unit.tsx` is **unchanged
from `main`** (net-zero diff). Likely reasons: the partial arc (e.g. amber `5/10`) **read as a
loading spinner**, and the coral on "See the room" **read as an alert**.

**So this is still an OPEN want, not a closed decision.** The audience block is back to the clean
original (`● band · N/10 stopped · thin bar` + quote + neutral "See the room →"). If the next
session re-attempts a designed treatment: avoid the spinner-look (no partial ring), avoid coral,
and show the owner one calm option before rolling it across all cards. `ProofUnit` is **shared**
by hook/idea/script/remix/test — one change hits all, and it's guarded by
`proof-unit-open-room.test.tsx` (the room-open click target + card-id threading) and
`idea-card-block.test.tsx` (fraction "7/10" must appear **exactly once**; "See the room →" present).

---

## 4. Open follow-ups (candidates for the fresh session)

1. **Owner has fresh card feedback** — start there (one card at a time, the flow that worked).
2. **Account Read card** — still queued from the original feedback ("partially off"): right-size
   its profile-header + 5-up post-feed weight vs. its siblings. `account-read-block.tsx` is already
   on the card-primitives spine (structurally fine — it's a proportion issue).
3. **A designed audience moment** — still wanted, execution open (see §3). Calmer than the ring/coral.
4. **Discover page / Feed** still use the cream `OutlierTile` primary (variant `grid`) — the owner
   didn't flag them; convert to tonal only if asked.

---

## 5. Verification

- **tsc 0 · eslint 0.**
- **thread + discover suites: 297/297** (`node ./node_modules/vitest/vitest.mjs run
  src/components/thread/__tests__ src/components/discover/__tests__`). Key guards green: hook
  handoff, idea card (fraction-once), proof-unit open-room, section-label, radius, card-surface.
- Live-shot every card in `/dev/cards → Skills` (Explore de-load verified at a temp 18-tile fixture,
  since reverted). Screenshots this session: `.scratch/*.png` (gitignored).

---

## 6. Runtime

- Dev server: **`:3011`**, `--turbopack`. Launch (per memory `dev-server-launch`): direct-node,
  2GB heap cap, Python `os.fork()`+`setsid` detach (`setsid` isn't on macOS):
  ```
  python3 -c "import os,subprocess; os.environ['NODE_OPTIONS']='--max-old-space-size=2048';
  pid=os.fork()
  if pid==0:
      os.setsid(); log=open('.scratch/dev.log','w')
      subprocess.Popen(['node','./node_modules/next/dist/bin/next','dev','--turbopack','-p','3011'],
                       stdin=subprocess.DEVNULL, stdout=log, stderr=log)
      os._exit(0)"
  ```
  ⚠️ **It OOM-cycled twice this session** (the known memory-pressure death — turbopack native RSS
  outside the V8 cap). Relaunch clean when it dies; screenshots hang on the ambient animations, so
  use raw Playwright with `animations:'disabled'` (scripts in `.scratch/`).
- `/dev/cards` is the real renderer (auth-gated → 307). Test user `e2e-test@virtuna.local` /
  `e2e-test-password-2026`. The gallery **Skills** tab is where these cards render.
- `.env.local` is per-worktree gitignored.

Related memory: `skill-cards-prod-lane`, `skill-card-run-capsule`, `dev-server-launch`,
`design-system-current`, `test-vs-simulation-split`.
