# Handoff — /audience, after P1–P3 shipped

**Updated:** 2026-07-14 · **Worktree:** `~/virtuna-explore-b` (branch `explore-b-sync`, synced to `main`)
**Spec:** `docs/SPEC-2026-07-13-audience-redesign.md` — ⚠️ read §2 F10 below before trusting it.
**Shipped:** P1 (index + workspace, #280) · **P3 the mode seam (#281)** · **archetype binding (#282)**
· **progress staging + persona receipts (#284)**. All merged to `main` (`f7c82352`).

> ⚠️ **This document lied to its last reader.** Its old §4.3 said *"no audience in live data carries
> `evidence`"* and blamed the description-calibration path for inventing archetype names. **Both were
> false**, and acting on them cost real time. Everything below is code- or live-verified on 2026-07-14.
> If you add a claim here, say how you verified it.

---

## 1 · The pattern that has now produced THREE bugs — read this first

**The one input that makes the feature the feature, dropped in silence, with every test green.**

- **#281** — the Read never steered. A `niche: null` fall-through silently discarded the persona
  repaint, and the weights were computed then thrown away (`void resolved`). Every Read compared
  General to General and relabelled one side. **10/10 identical verdicts**, live.
- **#282** — `archetype` is the engine's **binding key**. A slug outside the fixed 10 matched no slot
  in any niche, so its repaint reached the model *never*. One prod row had **45% of its own declared
  share** dead.
- **#284** — the SSE progress copy named the wrong phase for **126 of 128 seconds**, and
  `isPersonaGrounded` had zero callers.

**When auditing this subsystem, ask of every input: does it actually reach the model, and what
happens if it doesn't?** Grep for silent fall-throughs (`?? stock`, `if (!x) return DEFAULT`) on any
path carrying audience data. **Only a live run has ever caught one of these.** Not tsc, not eslint,
not 3,400 unit tests.

---

## 2 · ✅ THE MOAT WORKS — proven live, 2026-07-14

Before this date **no audience in prod had ever been scrape-calibrated.** Every signature had
`videos_analyzed: 0` and an empty provenance handle; no row had `calibration.source = 'scrape'`. The
whole pipeline was built, unit-tested with mocked I/O, and **never once run against reality.**

One real calibration (`POST /api/audiences/calibrate`, handle `zachking`, real Apify + DashScope):

| | |
|---|---|
| **128.8s**, HTTP 200 | `calibration.source = "scrape"` — the first in the database |
| provenance | `handle: zachking · videos_analyzed: 12 · videos_watched: 5 · sub_coverage: 8/12` |
| **the omni video-watch works** | the fragile part (Apify KV mp4 + `?token=` + SSRF allowlist) |
| **10/10 personas carry REAL evidence** | *"Massive view counts (8M–45M) dwarfing active engagement metrics."* |
| repaints are account-specific | *"Skeptical of the 'magic,' looking for glitches to debunk the illusion."* |

Cost ≈ $0.05–0.15 + one Apify scrape. **The Qwen client reads `DASHSCOPE_API_KEY`** (not
`QWEN_API_KEY` — that one is absent and unused). Row: `6b1114e6-…` ("Zach King").

---

## 3 · The facts the design rests on (corrected)

| | |
|---|---|
| **F1** | `persona_weights` {fyp, niche, loyalist, cross_niche} Σ=1.0 is the prediction dial (`resolve-audience-weights.ts:63`). `personas[].share` is NOT. |
| **F3** | The engine emits **bands, never scores** — `Strong\|Mixed\|Weak`. The block schema is `.strict()` and rejects a smuggled 0-100 (`blocks.ts:49`). **Never design a numeric score.** |
| **F5** | Audience is pinned **per thread** (`threads.active_audience_id`). `last_audience_id` only *seeds* new threads. |
| **F7** | `personas[].repaint` reaches the SIM. `label` never does. **`archetype` is the BINDING KEY** — outside the 10-slug `ARCHETYPES` enum it binds to nothing (#282). |
| **F10** | ~~"No runner branches on `mode`."~~ **WAS ALWAYS WRONG** — `predict` always did. The seam is now CLOSED (#281): a `mode:general` audience reads **single**, gets a general reaction frame, and socials-only skills refuse it server-side (400). Cross-mode pairs → 400. |

---

## 4 · What's next, in the order I'd do it

### P2 — make the workspace alive  ← **the ROLLUP (the data half) is SHIPPED. UI is what's left.**

**Shipped (ROLLUP-01):** `GET /api/audiences/[id]/rollup` + `src/lib/audience/read-rollup.ts`.
Returns per-persona latest reactions (verdict + quote) and audience-vs-other divergence, bands only.
Live-verified 2026-07-14 against real Flash runs on the scrape-calibrated **Zach King** audience.

Three things the build had to fix before the rollup could exist at all — each verified in the DB:

- **The block carried no audience id.** Entries had `name` only, so a rollup could only have keyed on
  a *user-editable display string* — silently re-attributing history on rename, and inheriting a
  deleted audience's Reads to a new one of the same name. Added `audienceId` (optional, additive) per
  entry; `"general"` is the sentinel, so **both sides of a compare are attributable**.
- **The concept was persisted NOWHERE.** The Read route writes only the assistant block and (unlike
  `/api/tools/chat`) never a user turn. A panel keyed on "the two verdicts per concept" had no
  concept. Added `concept` to `props` (run-level, beside `model`/`tier` — the per-audience entry is
  `.strict()`).
- **⚠️ THE BODY IS NOT AN ARRAY.** `insertMessage` writes `{kcGenVersion, blocks:[…]}` whenever a KC
  stamp is passed — which every tools route does. **All 7 Read blocks in prod are in the wrapper
  shape; ZERO are bare arrays.** So `body @> '[{"type":"multi-audience-read"}]'` matches **nothing**
  and looks exactly like "this user has never run a Read." Unwrap both shapes.

**🔴 The finding that changes the P2 spec — A MATCHING BAND IS NOT AGREEMENT.**
The spec's divergence metric (compare the two bands) **under-reports, and would have shipped a panel
that lies.** The band aggregates 10 persona verdicts, so **offsetting flips cancel out.** The very
first live Read proved it: Zach King and General **both landed Strong at 7/10** — while disagreeing
about *who* stopped (`niche_deep_buyer` stopped for Zach, scrolled for General; `tough_crowd` did the
reverse). Band-only says *"agreed."* Across the 2 live Reads: **band-diverged 0/2, persona-diverged
1/2.** So the rollup returns BOTH: `diverged` (the aggregate moved) and **`personaDiverged` + per-case
`personaFlips`** (your people wanted something different) — pair by **archetype**, never by array
index (the two Flash runs carry no ordering guarantee). **Build the panel on `personaFlips`.**

**Legacy rows are EXCLUDED, not name-matched.** The 7 pre-existing blocks (all `e2e-test@`, all
2026-07-13) carry no id — and they all predate #281, when both sides ran the identical prompt, so
4 of their 5 two-sided rows "agree" *as an artifact of the bug*. Folding them in would render a bug
as a finding. The rollup reports them as `legacyUnattributed` (live: 7) and never guesses.

**Still to build:** the UI — per-persona quote cards + the divergence panel, reading from this
endpoint. `reads`/`compared`/`personaDiverged`/`cases[].personaFlips` are the fields it wants.

### P4 — dissolve the account tab
The account numbers become the **provenance receipt** on the audience. **Half of this already
exists**: the workspace renders *"Built from Read from @zachking · 12 videos · TikTok"* (#284 added
the per-persona receipts under it). What remains is folding in follower/post counts
(*"· 85.9M followers · 608 posts"*), moving **What to do next** + **Content pillars** to `/start`,
and dropping the tabs so the H1 stops flipping. Touches `/start` → separate PR.

---

## 5 · Open questions — 2 of 3 are now ANSWERED

1. ~~**The general-mode control**~~ — **ANSWERED (owner, 2026-07-13):** a custom audience is compared
   against **nothing** — it reads single. A real general-mode control needs an authored general panel,
   which belongs to the **General pack** (`packs/index.ts` still throws on any id but `"socials"`).
2. ~~**`SignatureProvenance` in prod**~~ — **ANSWERED (live, 2026-07-14): YES, fully populated.**
   `videos_analyzed: 12`, `videos_watched: 5`, `scraped_at`, `sub_coverage: 8/12`. The source line
   renders them correctly. See §2.
3. ~~**Persona `evidence` — "no audience in live data carries it"**~~ — **THAT WAS FALSE.** Every
   signature carries it (3/3, 4/4, 4/4 on the authored rows; **10/10 on the scraped one**). The
   authored rows' "evidence" is conversational quotes; **the scraped row's is genuine
   engagement-ratio proof.** It is now RENDERED per-persona in the workspace (#284), and shown *only*
   when a scrape actually earned it — a described audience shows none and claims none.

**Still genuinely open:** the 10-slot Flash schema means a 6-persona audience repaints 6 slots and
inherits 4 neutral ones. Collapsing the panel to only the audience's real personas = the General pack.

---

## 6 · Traps (every one of these cost real time)

- **A grep that excludes the obvious place is not evidence.** I "proved" `getPersonaRoster` was dead
  code by grepping every file *except its own* — it has **5 callers** there. Deleting it would have
  broken the module. **Verify a claim before acting on it, especially a claim about deleting.**
- **A test that asserts presence is not a test.** The old route test asserted
  `statusEvents.length >= 2` — which the **broken ordering satisfied happily**. Ask whether your test
  would still pass if the things happened in the wrong order, or described the wrong thing.
- **Test the shape the CALLER actually sends.** #281 shipped a guard on a branch that never fires,
  because its unit test used a shape the route never sends (the route always passes a 2-element
  array). `persona-edit-form` PATCHes the **full** personas array — one bad sibling fails the payload.
- **`bg-cream` is NOT a token.** It compiles to `rgba(0,0,0,0)`. Probe with
  `getComputedStyle(el).backgroundColor` before trusting any colour class you didn't grep for.
- **A `signature` does not prove a scrape.** The authored customs (Marcus Reyes, Maya) carry one with
  an **empty provenance handle**. The **handle** is the evidence.
- **Persona `temperature`/`disposition` are USER-EDITABLE** (`persona-edit-form.tsx`) — a value that
  differs from `TEMPERATURE_DISPOSITION` may be deliberate, not drift. Only realign them when the
  **archetype itself** was wrong.
- **Never `npm test` / `npx vitest`** — a shim prints fake results. Use
  `node ./node_modules/vitest/vitest.mjs run <path>`.

---

## 7 · Run & verify

```bash
NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3007
```
**Auth:** `npx tsx e2e/create-test-user.ts` → `/login` with `e2e-test@virtuna.local` /
`e2e-test-password-2026`. **Routes:** `/audience` · `/audience/[id]`.

**Screenshots hang** (ambient animations never settle) — inject before capturing:
```js
const s=document.createElement('style');
s.textContent=`*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}`;
document.head.appendChild(s);
```

**Green gates before any commit:**
```bash
npx tsc --noEmit                                   # 0
npx eslint <changed files>                         # 0 errors
node ./node_modules/vitest/vitest.mjs run src/lib/audience src/components/audience \
  src/app/api/audiences src/lib/engine/flash       # 531 passed
```
⚠️ The **full** suite has **12 pre-existing full-suite-only failures** (tools routes + billing quota;
they pass in isolation). They are NOT yours — confirm against the base commit before chasing one.

---

## 8 · Design mockups (throwaway, kept for reference)

`docs/audit-2026-07-13/mockup-audience-v3.html` — the agreed concept (index + workspace).
Serve with: `python3 -m http.server 8099` inside `docs/audit-2026-07-13/`.
