# Handoff — Ambient Audience v2 depth pass (2026-07-22, session 3) → next: cards 1/4/5

## Status: ✅ SHIPPED to main — PR #362, squash `a663a727`

Third session on the v2 detail instrument (`/ambient-v2` → **The brain** / **The audience**),
from live owner review. Branch `design/ambient-audience-v2` rebased onto latest main (disjoint from
the cards lane) → squash-merged → worktree reset clean to the merged tip.

Builds on the premium pass (#359 `41a3aac3`, doc `HANDOFF-2026-07-22-ambient-audience-v2-premium-pass.md`).

---

## What shipped

### Card + terrain
- Detail card **480→440px**, side padding **26→22** (`page.tsx:142`, `AmbientDetail.tsx`).
- **Audience = ONE living cloud** (`AudienceTerrain.tsx`): districts slid **40% toward the shared
  centre** (`kC = 0.4`) + wider spread (`*1.28`) so the four blobs overlap into a single mass; each
  node gets a **seeded `cx/cy` drift** (organic Lissajous, `DRIFT_*` consts, reduced-motion-guarded,
  seed-42 SSR-stable). Hover-hulls moved to the contracted centres (`centers[]`). District identity +
  ledger spotlight preserved. (Owner had rejected the earlier 0.42-pull version as "still two clumps".)

### Brain depth — new `v2/BrainDepth.tsx` (creator-only)
Rebuilt lean in `TONE` (the old-room `SigmaBars`/`SignalGrid`/`SignalHeatmap` read fixed CSS vars +
their data fns are grounded-only → lifted shapes/labels, re-rendered matte with reveals):
- **① nine breakdown signals** — 3-col grid, number + status word (weak=coral/strong=cream/okay=faint)
  + vs-typical delta · `StaggerReveal`.
- **② network σ-bars** — 7 networks, centered-baseline diverging bars + `+0.38σ · slightly above` ·
  fill grows on `whileInView`.
- **③ KPI-per-second heatmap** — 10 systems × 12s cream-ramp cells · L→R column-wipe · labels are
  **single words, right-aligned nowrap rail** (fixed the earlier 2-line collision) + a 3-tick second-axis.
- **④ purchase-intent curve** — built but **OMITTED from creator** (owner: "doesn't make sense on
  regular content"). Contract + `BuyIntentCurve` retained for a future commerce domain.
- Stop/skim/scroll → **3 framed cells**; THE UNLOCK gain reframed as a **framed takeaway pill**
  (redundant "modeled" tag dropped). One consolidated **calibration line** at the tab bottom replaces
  the scattered per-section "modeled" disclaimers (the old floating `cortexNote` render was deleted).

### Audience depth — new `v2/AudienceDepth.tsx`
- **who this is for** — over/under-index vs typical (builders +34% → scrollers −12% loss), diverging bars.
- **who spreads it · how far** — `×5.8` reach headline (count-up) + reshare cascade
  (`saw it 1,000 → reshared 180 → their networks 5,800`) + carrier bars (builders ×3.2 lead).
- **the swing** — `88 on the fence`, verdict-move bar `38% → 49%` (solid=today, ghost=upside).
- **the room** — trust strip: confidence bar `0.78 · High`, `1,000 simulated · calibrated on your 4.2k
  followers` (richer replacement for the plain calibration note).
- Shared **diverging-bar vocabulary** with the brain σ-bars — brain + audience read as one system.

### Pricing template refined (`pricing-template.ts`)
- Dead `cortexNote` → `calibrationNote` ("Modeled reaction · not a real purchase decision").
- Added `audienceFit` (price tolerance: premium +40% → bargain −31% loss), `swing` (140 balk at $29,
  would-buy 53%→67%, +18% revenue), `room` (confidence **0.54 "Directional"** — the honest
  engagement-vs-purchase calibration gap).
- **Omitted** (don't fit a price axis): content-craft depth (nine-grid / heatmap), `buyIntent` (the
  demand curve already IS purchase-intent-over-price), `amplification` (reach ≠ the pricing question).

### Contract
New **optional** `DomainTemplate` fields (`domain-template.ts`): brain `signalGrid / networkBars /
kpiHeatmap / buyIntent / calibrationNote`; population `audienceFit / amplification / swing / room`.
Both templates author their own figures — **no frame forks** (the whole v2 bet holds).

---

## Design laws (held — do not relearn)
- Matte only: hairlines + tone-step depth, **no glow/shadow/inset-shine**.
- Coral `#FF6363` = **liveness/loss only** (lit nodes, the loss segment, a fence-sitter loss); cream
  `#ece7de` is the good default; serif only for voice quotes.
- Motion = intensity; all new motion **reduced-motion-guarded** + **seed-42 SSR-stable**.
- **declutter ≠ remove insight** — premium via space + hierarchy, never fewer facts.
- SSOT = `src/app/globals.css` (accent `#ff6363`) — NOT the stale `docs/DESIGN-SYSTEM.md`.

## Verify method
- `npx tsc --noEmit` → 0 · `npx eslint <files>` → 0.
- Matte guard: `node ./node_modules/vitest/vitest.mjs run reading/__tests__/reskin-matte.test.ts` → 38/38.
- Suite: `node ./node_modules/vitest/vitest.mjs run reading/__tests__/reskin-matte.test.ts src/components/audience-lens` → 154 pass.
- Live (dev :3007, already running this worktree): `/ambient-v2` → ② brain chip → toggle
  creator/pricing + brain/audience. **Screenshots hang on this app** (WebGL/SMIL never settle) — verify
  via `getComputedStyle` / DOM text / `getBoundingClientRect`, not `browser_take_screenshot`.

---

## ▶ NEXT SESSION — cards 1 / 4 / 5

The owner wants to work on **cards 1, 4, 5** — a DIFFERENT surface from ambient v2. This is the
**skill-cards** work, gallery at **`src/app/(app)/dev/cards/page.tsx`** (route `/dev/cards`, the real
tabbed renderer). Cards lane = `lane/skill-cards-prod` (last shipped #358 `1e1e49a9`: value+info pass;
memory flagged **loading states** as the pending next — but the owner now wants cards 1/4/5).

**⚠️ The gallery `THREAD_VIEWS` entries are not numbered in code** — confirm the 1/4/5 mapping with the
owner on the first message. Ordered inventory for reference:

| # | id | label |
|---|----|-------|
| 1 | `ideas` | Ideas |
| 2 | `ideas-outliers` | Ideas (find new outliers) |
| 3 | `hooks` | Hooks |
| 4 | `hooks-degraded` | Hooks (degraded run) |
| 5 | `hooks-outliers` | Hooks (find new outliers) |
| 6 | `script` | Script |
| 7 | `script-outliers` | Script (find new outliers) |
| 8 | `remix` | Remix |
| 9 | `chat` | Ask (chat) |
| 10 | `chat-followups` | Chat follow-ups |
| 11–15 | `in-thread-*` | in-thread input fields (link/account/explore/read/upload) |
| 16 | `explore` | Explore |
| 17 | `account` | Account Read |
| 18 | `video-test-card` | Video Test card (test) |

If the owner means the **primary skill cards** (excluding debug/degraded/in-thread variants), the
likely intent is Ideas / Script / Remix or similar — **ask, don't assume**.

**Start:** clean on `main` (`a663a727`). `git log -1`. `rm -rf .next`, launch dev per
[[dev-server-launch]] (2GB cap, direct-node), open `/dev/cards`. Fixtures: `dev/cards/fixtures.ts`.
Test user `e2e-test@virtuna.local`. Confirm which cards = 1/4/5 → then WAIT for per-card direction.
