# Handoff — /audience, after P1 shipped

**Date:** 2026-07-13 · **Worktree:** `~/virtuna-explore-b` · **Dev server:** `:3002`
**Spec (read this first):** `docs/SPEC-2026-07-13-audience-redesign.md`
**Shipped:** P1 — the index + workspace rebuild. Merged to `main`.

---

## 1 · What just happened

`/audience` was a database table with a UI on top. It rendered `is_general` / `is_preset` /
`mode` / trust-tier and made the user infer meaning; it could not answer *"which audience am I
being tested against?"* even though `GET /api/audiences` has always returned `lastAudienceId`.

It is now two levels:

- **Index** (`/audience`) — a table. Provenance is a **column** ("Built from"), which retired the
  four section headers and the whole six-term badge vocabulary. The **default radio** renders and
  writes `user_settings.last_audience_id`. General sits in the table as *"Always on · as the
  control"*. A **Social / Custom** track switch splits the horizontal (`mode: general`) audiences.
- **Workspace** (`/audience/[id]`) — the console. Four **mix sliders** = `persona_weights`, which
  the engine consumes as `analysis_override` → moving one moves a prediction (the product had never
  exposed this). The **cast** shows each persona's `repaint` — the sentence the SIM actually scores
  with — and states that a persona's display `label` never reaches the model. Grounding writes
  `custom_context`.

**Deleted:** `audience-card`, `audience-constellation-thumb`, `audience-temp-bar`,
`audience-status-chip`, `audience-profile-view`, the rail marketing paragraph, and
`personas modeled · receipts pending`.
**Kept:** `trust-badge.tsx` — three thread blocks still render it, where the tier describes the
*run's model*, not the audience.

---

## 2 · The ten facts the design rests on

They're in the spec (§2) with file:line evidence. The four that will bite you if you forget them:

| | |
|---|---|
| **F1** | `persona_weights` {fyp, niche, loyalist, cross_niche} Σ=1.0 is the prediction dial (`resolve-audience-weights.ts:63`). `personas[].share` is NOT — it steers discovery ranking and the lead persona. |
| **F3** | The engine emits **bands, never scores** — `Strong\|Mixed\|Weak` + `"6/10 stop"`. The block schema is `.strict()` and rejects a smuggled 0-100 (`blocks.ts:49`). **Never design a numeric score.** |
| **F5** | Audience is pinned **per thread** (`threads.active_audience_id`, set from the composer). `last_audience_id` only *seeds* new threads. `/audience` must never claim to show what a given thread used. |
| **F10** | **No runner branches on `mode`.** This is the open bug — see P3. |

---

## 3 · What's next, in the order I'd do it

### P3 — the mode seam (do this FIRST: it's a correctness bug, not an enhancement)
`GENERAL_AUDIENCE` is `mode: "socials"`, `platform: "tiktok"` (`audience-repo.ts:41-47`), and no
runner reads `mode`. So today:
- Run a Read with **Analyst Panel** → the engine compares a non-social panel against a **TikTok
  crowd**, and prints a confident band on it.
- Hand **Marcus Reyes** to the hook writer or the remix tool — both TikTok-shaped by construction —
  and nothing refuses.

Two pieces of work:
1. **Skill gating.** `hooks` / `remix` / `discover` / `calendar` are socials-only → the composer's
   audience picker must not offer a custom audience for them. `read` / `chat` / `simulate` accept both.
2. **The control rule.** A `mode: general` audience must not be paired against `GENERAL_AUDIENCE`.
   **OWNER DECISION OUTSTANDING:** run it single-audience (no comparison), or author a general-mode
   control? Don't guess — ask.

Touches the composer + runners → coordinate with lane a (audience/room), and keep it its own PR.

### P2 — make the workspace alive
Two data-backed additions, both blocked on the same missing piece:
- **Per-persona quotes** — each persona's last real reaction from your Reads (verdict `stop|scroll`
  + a ≤160-char first-person quote).
- **The divergence panel** — *"12 Reads · your people disagreed with the generic crowd 4 times"*,
  with the two verdicts per concept. **In bands. Never a score (F3).**

Both live inside `multi-audience-read` blocks in **thread-message JSONB**. There is no scores table
and no query for them. So P2 starts with a rollup endpoint (scan the user's assistant messages for
those blocks, roll up per-persona reactions + audience-vs-General verdicts). That's engine/data
work, not UI.

### P4 — dissolve the account tab
Owner already agreed: the account numbers become the **provenance receipt** on the audience
("read from @zachking · 85.9M followers · 608 posts"); **What to do next** and **Content pillars**
move to `/start`, where they already live. `/audience` loses its tabs and the H1 stops flipping.
Touches `/start` → separate PR.

---

## 4 · Open questions for the owner

1. **The general-mode control** (P3.2) — what does a custom audience get compared against, if anything?
2. **`SignatureProvenance` in prod** — does the scrape path actually populate `videos_analyzed` /
   `scraped_at`? The source line renders them and must degrade honestly if they're absent.
3. **Persona `evidence` (F7)** — **no audience in live data carries it.** Fixture gap, or does the
   production scrape never write it? If the latter, the "Read" rung is thinner than the ladder implies.

---

## 5 · Traps (I hit both of these; they cost real time)

- **`bg-cream` is NOT a token in this design system.** It compiles to `rgba(0,0,0,0)` — my slider
  thumbs were invisible while the screenshot looked fine. Probe with
  `getComputedStyle(el).backgroundColor` before trusting any colour class you didn't grep for.
- **A `signature` does not prove a scrape.** The authored custom audiences (Marcus Reyes, Maya)
  carry one with an **empty provenance handle** — keying off `audience.signature` alone rendered
  *"Read from @"*, claiming account data that doesn't exist. The **handle** is the evidence.
- **Verify behaviour, not appearance.** Both bugs above passed tsc, eslint, and 73 unit tests.
- **Never `npm test` / `npx vitest`** — a shim prints fake results. Use
  `node ./node_modules/vitest/vitest.mjs run <path>`.

---

## 6 · Run & verify

```bash
# dev server (from ~/virtuna-explore-b)
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002
```
**Auth:** `npx tsx e2e/create-test-user.ts` → `/login` with `e2e-test@virtuna.local` /
`e2e-test-password-2026`. **Routes:** `/audience` · `/audience/[id]` · `/audience?tab=account`.

**Screenshots hang** (ambient animations never settle) — inject before capturing:
```js
const s=document.createElement('style');
s.textContent=`*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}`;
document.head.appendChild(s);
```

**Green gates before any commit:**
```bash
npx tsc --noEmit                                  # 0
npx eslint <changed files>                        # clean
node ./node_modules/vitest/vitest.mjs run src/components/audience/__tests__/ \
  src/components/reading/__tests__/reskin-matte.test.ts   # 73/73
```

**Live-data note:** the test user's only `personal` audience (`test`) is **empty**, and
`lastAudienceId` is **null** — so the app is scoring every Read with General, and the index now
says so. That is correct, not a bug.

---

## 7 · Design mockups (throwaway, kept for reference)

`docs/audit-2026-07-13/mockup-audience-v3.html` — the agreed concept (index + workspace).
v1/v2 kept only to show what was rejected and why (see the spec's history).
Serve with: `python3 -m http.server 8099` inside `docs/audit-2026-07-13/`.
