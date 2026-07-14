# SPEC — /audience redesign

**Date:** 2026-07-13 · **Worktree:** `~/virtuna-explore-b` · **Status:** agreed in discussion, NOT built
**Mockups:** `docs/audit-2026-07-13/mockup-audience-v3.html` (the agreed concept) · v1/v2 kept for history
**Supersedes:** the `/audience` rows of `docs/audit-2026-07-13/AUDIT-calendar-discover-audience-library.md` §P1.7

---

## 1 · The concept

**An audience is an instrument you tune. `/audience` is the rack; clicking one opens the console.**

Two levels, two jobs:

| Level | Route | Job |
|---|---|---|
| **Index** | `/audience` | Understand what audiences you have, where each came from, and which one seeds your work. |
| **Workspace** | `/audience/[id]` | Tune one: its mix, its cast, its grounding. Every control here moves a real prediction. |

There is **no taxonomy to learn**. Origin is a *column*, not a section header. The four buckets
(YOURS / BASELINE / TEMPLATES / GENERAL TEMPLATES) are deleted.

### Vocabulary (locked)
- **Audience** — the concept, everywhere in the UI. Retire *room* and *panel* as synonyms for it.
- **Persona** — one reactor inside an audience. (A "cast" of personas.)
- **General** — the control every social Read is scored against. Not a "baseline", not a "template".
- Trust vocabulary (`Validated` / `Directional` / `Calibrated` / `Baseline` / `Template` / `Limited data`) is **deleted from the UI**. See §3.

---

## 2 · Facts this spec is built on (all verified in code / live data, 2026-07-13)

| # | Fact | Evidence |
|---|---|---|
| F1 | The engine's prediction dial is `persona_weights` {fyp, niche, loyalist, cross_niche}, Σ=1.0, passed as `analysis_override`. | `resolve-audience-weights.ts:63` |
| F2 | A persona's `repaint` sentence feeds the reaction panel → the SIM. Its `label` is presentation-only and **never** reaches a runner. | `persona-edit-form.tsx:12-14`, `ideas-runner.ts:383` |
| F3 | A Read emits **bands, never scores** — `band: Strong\|Mixed\|Weak` + `fraction` + per-persona `stop\|scroll` + a quote. `.strict()` rejects a smuggled 0-100. | `blocks.ts:49-58, 73-75` |
| F4 | Every Read is a **pair**: the thread's audience vs **General**, by default. | `read/route.ts`, `two-audience-read.ts` |
| F5 | Audience is pinned **per thread** (`threads.active_audience_id`), set from the composer. `user_settings.last_audience_id` only *seeds* new threads. `/api/audiences` already returns `lastAudienceId` — the page ignores it. | `threads/[id]/route.ts:26`, `audiences/route.ts:99` |
| F6 | `resolveTier()` reads **only** `audience.mode`. `socials` → always `Validated`. It is a property of the engine pack, not of the audience. It currently stamps "Validated" on empty audiences. | `resolve-tier.ts:44` |
| F7 | **No audience in live data carries persona `evidence`.** The "grounded" branch never fires; every user audience falls to `personas modeled · receipts pending`. | live `/api/audiences` |
| F8 | Two build paths produce identical-looking rows: `@handle` → scrape → real signature; `description` → model invents personas. `Fitness Creators` is the *description* path (`calibration.source: "description"`). | live data, `calibration-flow.tsx` |
| F9 | `GENERAL_AUDIENCE` (the control) is **`mode: "socials"`, `platform: "tiktok"`**. | `audience-repo.ts:41-47` |
| F10 | **No runner branches on `mode`.** A `mode:general` custom audience is compared against a TikTok crowd, and social-only skills (hooks/remix/discover) accept it. | grep: `mode` absent from all runners |

---

## 3 · What gets deleted

- `audience-constellation-thumb.tsx` — the dot-scatter. Data-bearing only where personas exist; an identical static placeholder on every row where they don't.
- `trust-badge.tsx` + `resolve-tier` **from the UI** (keep the lib export; nothing renders it). Per F6 it is not a fact about the audience.
- `audience-status-chip.tsx` — the six-term calibration vocabulary.
- The four section headers.
- The AUDIENCE MAP on `/audience/[id]` — 250px of decorative dot cloud.
- The four mismatched tiles on `/audience/[id]` (platform / goal / temp mix / dispositions).
- The blue/green temp+disposition pills on the detail cast table — **off-system** (flat-warm has no cool tints).
- The right-rail marketing paragraph ("…the moat that makes a prediction yours, not generic").
- `personas modeled · receipts pending` — a dead branch (F7) promising receipts that don't exist.

---

## 4 · Level 1 — the index (`/audience`)

### Header
- H1: **Audiences**
- One factual line: *"The panel your work gets tested against. Every Read is scored twice — once by the audience you pick, once by General."* (This is the only explainer; it teaches F4.)
- Actions: `Compare two` (secondary) · `New audience` (primary).

### Track switch
A segmented control: **Social · Custom** (`mode: socials` | `mode: general`).
- Default track: Social.
- Custom track holds the horizontal audiences (Analyst Panel, Hiring Panel, Marcus Reyes, Maya —
  *"a person you described"*, not tied to a social account).

### The table
| Column | Content |
|---|---|
| ○ | **Default radio.** The audience that seeds new threads. Writes `last_audience_id` (F5). Exactly one, or none (= General). |
| **Audience** | Name + one meta line (`TikTok · grow my fitness following`). Presets carry a quiet `PRESET` tag; General carries `MAVEN`. |
| **Built from** | The honesty column. `Read from @zachking · 84 videos` / `A description you wrote — no account data behind it` / `Maven's baseline — same for every user` / `Nothing yet` (amber, actionable). |
| **Who's in it** | Share-weighted composition bar (segments = personas, tone = temperature) + `6 personas · warm-leaning`. Empty audiences show a dashed empty bar, never a decorative one. |
| **Used for** | `Default · seeds new threads` / `Always on · as the control` (General) / `—`. |
| | Row action: `Open` / `Build` (empty) / `Use` (preset). |

### Rules
- Sort: yours first, then General, then presets. Untouched presets beyond the first collapse into a
  `Show all` line — a preset you've never used gets one line, not a card.
- **General appears in the table** (marked *Always on · as the control*) — that's how F4 teaches itself.
- Empty audience (`test`) states the truth: `Nothing yet — read your @handle to fill it`.

---

## 5 · Level 2 — the workspace (`/audience/[id]`)

Replaces the current detail page entirely.

### Header
- Name (inline `Rename`), then the **source line**: *Built from a description you wrote · 20 Jun · no account data behind it.*
- **The ladder:** `Described → Read from @handle → Proven by outcomes`, current rung boxed.
  One honest axis replacing six badge terms. Maps to `calibration.source` (F8) + the outcome loop.
- Actions: `Compare` · `Duplicate` · primary = the next rung (`Read from @zachking`).

### Section 1 — The mix *(changes what Maven predicts)*
Four sliders = `persona_weights` (F1), Σ = 100%, with human labels:

| Field | Label | Sub |
|---|---|---|
| `fyp` | New viewers | For You page, don't follow you |
| `niche` | Niche regulars | In your world, not yet yours |
| `loyalist` | Loyalists | Watch everything you post |
| `cross_niche` | Cross-niche | Outsiders who wander in |

Validation mirrors the API: must total 1.0 ±0.01 (`audiences/[id]/route.ts:45`). Save is blocked otherwise.
**This is the highest-leverage control in the product and it currently has no UI at all.**

### Section 2 — The cast
One row per persona: display name, the **`repaint` sentence (editable)**, temperature, disposition, share.
- Copy states the truth from F2: *"Naming only: a persona's display name never reaches the model — the description does."*
- Editing a repaint changes that persona's verdicts. That is the point.

### Section 3 — What Maven should know *(optional · changes predictions)*
Freeform grounding → `custom_context` (`source: "user"`). Tagged as user-supplied, never presented as scraped data.

### Save model
Explicit. A `3 unsaved changes` bar with `Discard` / `Save audience`. No autosave on an object that moves predictions.

### Rail
- **Source** — built from / account data / created; button = the next rung (`Read from @handle →`), with the honest consequence: *"Replaces these guesses with the real shares from your last 80 videos."*
- **Where it's used** — `Default (new threads)` · `Pinned in N threads` · `Compared against General`. Plus: *"Any thread can pin a different audience from the composer."* (This makes F5 visible instead of a lie.)
- **Danger** — delete.

---

## 6 · The mode seam (the horizontal track)

Per F9/F10 the platform cannot currently tell "will this travel on TikTok" from "will this land with Marcus".
The workspace is identical for both. What forks:

1. **The control.** A `mode: general` audience must **not** be compared against `GENERAL_AUDIENCE` (a TikTok crowd).
   Either run it single-audience, or author a general-mode control. **Owner decision outstanding.**
2. **Skill gating.** `hooks` / `remix` / `discover` / `calendar` are socials-shaped → they must refuse a custom
   audience in the composer picker. `read` / `chat` / `simulate` accept both.
3. The index's Social/Custom switch is the *visible* half of this seam; the gating is the real half.

---

## 7 · Phasing

| Phase | Contents | Depends on |
|---|---|---|
| **P1 — the redesign** | Index (§4) + workspace (§5) + all deletions (§3). | Nothing. Every field already exists; PATCH already accepts every control. |
| **P2 — make it alive** | Per-persona real quotes from past Reads; the you-vs-General **divergence panel** (in bands, never scores — F3). | A rollup endpoint scanning `multi-audience-read` blocks in thread messages. No scores table exists. |
| **P3 — mode seam** | Skill gating + the custom-audience control rule (§6). | Owner decision on the general-mode control. Touches composer + runners → separate PR, coordinate with lane a. |
| **P4 — account tab** | `Your account` dissolves: numbers → the source line; `What to do next` + Content pillars → `/start` (they already live there). H1 stops flipping. | Touches `/start` → separate PR. |

---

## 8 · Constraints

- **Honesty spine.** Nothing may imply data we don't have. Empty is empty. Bands, never scores (F3).
- **Design system:** `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`. Flat-warm charcoal, cream `#ece7de`,
  terracotta `#d97757` at near-zero dosage (the default radio + one CTA), matte — no glass, glow, or inset-shine.
- **Reuse primitives** (`components/ui/*`). No new visual language.
- **Guard:** `reading/__tests__/reskin-matte.test.ts` stays green (38/38).
- Green gates before any commit: `npx tsc --noEmit` = 0 · `npx eslint <changed>` clean ·
  `node ./node_modules/vitest/vitest.mjs run` (never `npm test` — the shim prints fake results).
- **Verify behaviour, not appearance** — browser pass on every state (empty, described, read, custom).

---

## 9 · Open items

1. **The general-mode control** — what does a custom audience get compared against, if anything? (§6.1)
2. **Provenance fields** — does `SignatureProvenance` actually populate `videos_analyzed` / `scraped_at` in prod?
   The source line renders them; if they're absent the line must degrade honestly, not fabricate.
3. **F7** — is the missing persona `evidence` a fixture gap or a production gap? If the scrape path doesn't
   populate `evidence`, the "Read" rung is thinner than it claims.
