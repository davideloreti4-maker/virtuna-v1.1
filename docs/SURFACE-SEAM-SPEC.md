# The `variant='surface'` seam — graft-readiness + implementation spec

> **Room-authored 2026-07-04.** Companion to the signed-off [`THE-CONTRACT.md`](./THE-CONTRACT.md)
> (the four seams). That doc defines the *interfaces*; this one is the **current graft-readiness of
> each seam** + the **implementation spec for Seam 3 (`variant='surface'`)** — the app-wide ambient
> presence, which is the last big Room↔Surfaces integration and the product's spine ("your audience
> on *every* surface, not just the thread").
>
> Audience: the **Surfaces** session (owns the pages that mount the dock) + the **Room** session
> (owns the real atoms). Nothing here changes the contract — it records what's landed and specs the
> one deferred component. If a *seam shape* needs to change, that's a §6 reconciliation, not this doc.

---

## 1. Graft-readiness ledger (as of 2026-07-04, `origin/main`)

Legend: 🟢 landed & usable · 🟡 partial / adapter needed · 🔴 stubbed both sides.

| Seam | Contract shape | Room-side status (real atom) | Surfaces stub | Delta to graft |
|---|---|---|---|---|
| **1 — Card** (`CardReaction`) | `types.ts` §1 | 🟢 **LANDED.** `readToCardReaction(read): CardReaction` shipped (`src/lib/room-contract/read-to-card-reaction.ts`, unit-tested) — pure, derives the glance-tier card face from a Seam-2 `Read` (tone banded off `stop` like the Room's `meterTone`; `lead` a real reaction verbatim, never fabricated). | `mock-room.ts` `MOCK_READS` → `getReadByCardId` | ⛔ **BLOCKED on a real surface-card data source (2026-07-05).** The producer works, but the start-page's daily-ideas/outliers are *fabricated* content with **no 1:1 `analysis_results` backing** — feeding a real face onto a mock card = a mismatched verdict (violates the honesty spine). Needs the surfaces to SOURCE cards from real analyses (a new pipeline: generate+sim ideas → persist, or attach per-audience analyses to feed/competitor rows) — a product build, not a graft. Also collides with the live design rewrite of `idea-card.tsx`/`outlier-card.tsx`. |
| **2 — Read** (`Read`) | `types.ts` §2b | 🟢 **LANDED.** `predictionResultToRead(data, contentId)` shipped (`src/components/reading/prediction-to-read.ts`, unit-tested) — pure, builds the same nodes the Phase-3 Room does (`buildAudienceNodes`), maps `PredictionResult → Read{stop,split,weakSpot,fix,reactions,population}` (all real engine output; names never the enum; honest population). | `mock-room.ts` `MOCK_READS` | ⛔ **BLOCKED — same data-sourcing gap as Seam 1.** `room-drawer.tsx` already renders whatever `Read` a tapped card carries (via `RoomFocus.read`); the swap is `predictionResultToRead(data,id)` → but `data` must be the card's REAL `PredictionResult`, and mock cards have none. Unblocks the moment a real surface-card source lands (no adapter work — shapes align 1:1). |
| **3 — Presence** (`AudiencePresence variant='surface'`) | `types.ts` §3 | 🟢 **LANDED (Room side).** The read-only `'surface'` render branch is implemented (`audience-presence.tsx` — peek band always + on-focus read-only `AmbientRoom`; the Rewrite CTA + "type below" prompt gated off) **and** the `audienceToActiveAudience` adapter shipped (`audience-to-active.ts`, unit-tested). Data atom `resolveUserAudience` already landed. | ~~`surface-dock.tsx` renders local `AudienceConstellation` + switcher, fed `MOCK_AUDIENCES`~~ **RETIRED** | ✅ **MOUNTED 2026-07-05** (`feat/seam-mount-live`). `surface-dock.tsx` now wraps `<AudiencePresence variant='surface' layout='dock'>` fed **raw `Audience[]`** from the `/start` server route (`listAudiences` + `resolveUserAudience`) — **NOT** via `audienceToActiveAudience` (type-flow trap, §2.4). `MOCK_AUDIENCES` + the `AudienceConstellation` stub deleted. Browser-verified (real switcher, live select, persist-across-reload). |
| **4 — Embedded composer** (`Composer mode='embedded'`) | `THE-CONTRACT §3` | 🟢 **SHIPPED via Path A (2026-07-05, PR #151).** Embedding is a *handoff*, not an inline run, so the Room built a dedicated decoupled atom instead of refactoring the /home monolith: `EmbeddedComposer` (`src/components/app/home/embedded-composer.tsx` — drop-in superset of the old stub API) + `buildThreadLaunchHref` (`src/lib/room-contract/thread-launch.ts`, pure). The contract's `/thread/:id` doesn't exist → the launch lands on `/home`; a one-shot seed inlet in `composer.tsx` maps verb→skill, pre-fills the field, and auto-runs on `run=1` (non-runnable verbs degrade to pre-fill). | ~~`surfaces/embedded-composer.tsx` stub~~ **DELETED** — `start-page.tsx` now imports the Room atom + pushes the real launch. | **DONE (Room side + start-page graft).** Audience not carried yet (surface switcher still mock → /home uses its last-used; helper accepts `audienceId`, forward-ready for the Seam-3 real-audience graft). |

**Headline (updated 2026-07-05):** ALL FOUR seams are now **landed on the Room side** — Seam 1 `readToCardReaction` (card face), Seam 2 `predictionResultToRead` (the Read), Seam 3 `audienceToActiveAudience` + the read-only `variant='surface'` presentation (+ the `resolveUserAudience` atom), and Seam 4 the `EmbeddedComposer` atom + `buildThreadLaunchHref` launch handoff (PR #151, Path A — `start-page.tsx` already grafted). Remaining is purely the **surfaces-side mount of the 3 data producers** (§2.4/§5 — swap the card-face / dock / read-panel stubs onto the real adapters) + the **Phase-4 outcome loop** (blocked on account-connect). No shared-atom work left on the Room side.

**Update 2026-07-05b (surfaces-side mount session, `feat/seam-mount-live`):** **Seam 3 is MOUNTED + browser-verified** — the /start dock now renders the real `AudiencePresence` on live audiences (mock retired). Seams **1 + 2 are BLOCKED**, not on adapters (both producers work + unit-test green) but on a **real surface-card data source**: the start-page's daily-ideas/outliers are fabricated cards with no `analysis_results` behind them, so a real Read/face on them would be a *mismatched* verdict (honesty-spine violation). They unblock only when the surfaces SOURCE cards from real analyses — a product/pipeline decision (see the Seam 1/2 rows), which also collides with the live design rewrite of those card components. **Net:** the seam **plumbing** is done everywhere it can honestly be; what's left for 1/2 is **surface content sourcing**, not seam mounting.

**Update 2026-07-05c (Seams 1/2 MOUNTED for OUTLIERS, `feat/seam12-outliers`):** the content-source blocker is **resolved for outliers**. Real competitor videos (`scraped_videos`, via `queryFeed`) are simmed against the user's resolved audience in ONE batched Flash call (`runFlashTextModeBatch` — the same niche-discriminating sim the ideas/hooks runners use; no reinvented scorer), yielding a real per-audience `ReactionPersona[]` behind each outlier card. **Key correction to the earlier plan:** start-page cards sim via **Flash** (`{archetype,verdict,quote}`), NOT the heavy `PredictionResult`, so the render path is **NOT** `predictionResultToRead`/contract-`Read` (which needs weakSpot/fix the Flash sim doesn't emit) — it is the **real `AmbientRoom` fed `flatPersonas`** (the exact component the video Read embeds) + a pure `personasToCardFace` (Seam 1 glance face). Both derive from the SAME personas, so the card face and the opened Room agree (browser-verified: a card's lead quote IS a named voice in the Room). Cached in `surface_reactions` (migration `20260705120000`), re-warmed lazily on the first /start visit of the day (owner cadence). **Outliers: `1 🟢 · 2 🟢`.**

**Update 2026-07-05d (Seams 1/2 MOUNTED for DAILY-IDEAS, `feat/seam12-ideas`):** the second /start section is real, same mechanism, content GENERATED: `buildLiveIdeas` runs the `ideas` skill (`runIdeasPipeline` — already generate→sim→ranks in one call, each block carries its own S3′ `personas`), caches the ranked blocks in `surface_reactions` (kind=`idea`), and renders them onto `idea-card.tsx` via the same `personasToCardFace` (Seam 1) + `AmbientRoom` drawer (Seam 2). The drawer is now **personas-only** — the legacy mock-`Read` layout is retired (`RoomFocus` carries `personas`, not `read`). Cache read/warm generalized into a `useLazyWarm` hook + a `warmOnce` in-flight dedupe (survives React StrictMode's dev double-invoke of the expensive generation). `MOCK_OUTLIERS` retired; `MOCK_IDEAS`/`MOCK_READS` KEPT for the still-mock /calendar (`day-detail.tsx` `getReadByCardId`) — migrate together when /calendar goes real. Browser-verified (real generated ideas e.g. "The $500 'Adulting' Scam" 9/10, tap → real Room, card lead == a Room voice, cache-hit on reload). **Both /start sections: `1 🟢 · 2 🟢` — all 4 seams live.**

---

## 2. Seam 3 spec — `AudiencePresence variant='surface'`

### 2.1 What it renders (read-only, per the §3 sign-off delta)
A non-thread surface has **no composer field to route asks into**, so `variant='surface'` is **read-only**:

- **PEEK band (always):** the audience identity — name + the breathing persona constellation + a **one-line pulse**. At rest on a surface there is no card in focus, so the pulse is the honest idle line: **`"General · 10 people ready"`** (never a stale/fabricated reaction). Tap → switcher (portaled).
- **READ-ONLY panel (only where a focus + Read exist):** if the host surface anchors the dock on a card that carries a Read (e.g. a feed tile / saved card tapped open), the panel shows the **`AmbientRoom` body read-only** — named voices + The people ⇄ Population·1,000 + the weak-spot — **with NO ask input and the Rewrite CTA OFF** (`canRewrite=false`). At rest (no focus) it stays the peek band only.
- **Asks require a composer.** If a surface wants live asks, it must host Seam 4 (the start page does). Feed / calendar / library mount the dock **read-only**. (`surface-dock.tsx` is already read-only — consistent.)

> Honesty spine (binding, unchanged from `variant='thread'`): exactly ONE labeled concept at a time,
> idle when nothing is in focus, never a fabricated reaction or per-persona quote. Deterministic
> (mulberry32-seeded, no wall-clock/PRNG in render) — SSR + engine-determinism-gate safe.

### 2.2 Data flow — the one adapter the graft needs
```
resolveUserAudience(supabase, userId)  →  Audience   (already landed; RLS-safe, degrades to General)
                                            │
                        audienceToActiveAudience(audience)   ← BUILD THIS (pure, testable)
                                            ▼
                                       ActiveAudience  (contract type, room-contract/types.ts §3)
                                            ▼
                      <AudiencePresence variant='surface' audience=… />   (mounted by the surface)
```
Adapter mapping (`Audience` → `ActiveAudience`):

| ActiveAudience | ← source on `Audience` |
|---|---|
| `id` | `audience.id` |
| `name` | `audience.is_general ? 'General' : audience.name` |
| `people` | `audience.personas` → `{id, name, segment}` (name via `persona-names.ts` `personaNameMap`; **named, never the archetype enum** — §2) |
| `tier` | `resolveTier(audience)` → `'Directional' | 'Validated'` (leaf import, not the SOCIALS_PACK barrel — bundle-leak discipline, see `audience-presence.tsx:33-36`) |
| `goal` | `audience.goal_intent` → `'Grow' | 'Sell'` |
| `platform` | `audience.platform` |
| `pulse` | idle readiness (`"General · N people ready"`) — a surface has no at-rest focus |

The switcher already **writes** `user_settings.last_audience_id` on every selection (`resolve-user-audience.ts` header), so switching audiences on a surface persists app-wide with no extra work.

### 2.3 Mount mechanics
- **Portal to `<body>` + `position:fixed`** so the switcher escapes surface `overflow-hidden` — mirror the existing `audience-presence.tsx` (it already portals; do NOT reinvent in the surfaces).
- **One presentation per viewport.** `layout='dock'` (mobile bottom-pinned) vs `'rail'` (desktop right-rail) already exists; the host picks via media query so exactly one `AmbientRoom` mounts (no hidden second timer).
- The surfaces currently mount `AudienceConstellation` (a stub of the breathing dots). At graft, swap the whole `SurfaceDock` internals for `<AudiencePresence variant='surface' …>`; the Room's component owns the real brand `Constellation` (`src/components/brand/constellation.tsx`).

### 2.4 The swap in `surface-dock.tsx` — ✅ DONE (as-built 2026-07-05)

> ⚠️ The original diff below was **INACCURATE** on two points — the real mount corrects both:
> **(1) TYPE — feed RAW `Audience`, not the adapter.** `AudiencePresence` consumes the DB `Audience`
> type (`audience: Audience | null`, `audiences: Audience[]`, `onSelectAudience: (Audience) => void`
> — `audience-presence.tsx:86-92,147`), **not** the contract `ActiveAudience` that
> `audienceToActiveAudience` emits. So the dock is fed raw `Audience[]` straight from the server;
> the adapter is **bypassed for the dock** (it stays for a future card layer that genuinely consumes
> `ActiveAudience`). **(2) LAYOUT — `layout='dock'` at every breakpoint**, not `isDesktop ? 'rail'`:
> /start pins dock+composer as one bottom object and its content right-rail already owns the desktop
> right column, so /home's `rail` presentation doesn't apply here.

As-built: `surface-dock.tsx` is a thin host wrapper owning only `open` + `reducedMotion`:
```tsx
<AudiencePresence variant='surface' layout='dock'
  audience={audience} audiences={audiences} selectedAudienceId={selectedAudienceId}
  onSelectAudience={onSelectAudience} focus={null}
  open={open} onOpenChange={setOpen} reducedMotion={reducedMotion}
  reacting={reacting} onBuildAudience={() => router.push('/audience/new')} />
```
`audiences` + `selectedAudienceId` come from the `/start` server route (`listAudiences` +
`resolveUserAudience`); `start-page.tsx` owns the selected state + persists on select
(`PUT /api/settings/last-audience`, UUID-guarded — mirrors `composer.handleSelectAudience`).

---

## 3. What the Room must build (the deferred work)
1. ✅ **DONE — the `'surface'` render branch in `audience-presence.tsx`.** Read-only: the peek band always + (on focus) the read-only `AmbientRoom` body; the composer-bound affordances are gated off (`canRewrite=false` → no Rewrite CTA; the "type below" idle prompt swapped for a read-only description). Guarded by `isSurface` so `variant='thread'` stays byte-identical. Reuses the Phase-3 `AmbientRoom` (`personaNodes` + `embedded`). Browser-verified (dock + rail; the on-focus Population weak-spot renders, CTA absent even with `canRewrite=true`).
2. ✅ **DONE — `audienceToActiveAudience(audience): ActiveAudience`** (`src/lib/audience/audience-to-active.ts`) — pure + unit-tested (13 cases; mapping in §2.2). Room-owned so both sessions import one source.
3. ✅ **DONE — `predictionResultToRead(data, contentId): Read`** (`src/components/reading/prediction-to-read.ts`, 10 unit tests) — the Seam-2 adapter so a surface can open the read-only panel / render a card face on a *real* analysis, not mock. Self-contained (builds nodes via `buildAudienceNodes`), honest (real stop/split/reactions, verbatim weakSpot/fix, names never the enum).

## 4. Open questions for the Surfaces sync
- **Which surfaces mount the dock, and which are read-only vs composer-hosting?** Start = composer-hosting (asks work). Confirm feed / calendar / grow / library are read-only. (The new GROW/DISCOVER hubs, #133/#135 — do they change dock placement?)
- **Focus source per surface:** does any non-start surface anchor the dock on a card (→ needs the read-only Read panel), or is every non-start surface peek-only at launch? Peek-only is simplest for v1.
- **Seam 4 truth — ✅ SHIPPED (2026-07-05, PR #151):** Path A. The Room built the embeddable `EmbeddedComposer` atom (decoupled — embedding is a handoff, not an inline run) + the pure `buildThreadLaunchHref` handoff (`/home?v=…&seed=…&run=1`, since `/thread/:id` doesn't exist), and grafted `start-page.tsx` onto it (surfaces stub deleted). The launch defaults to **auto-run** (the explicit /start send is the fire, honesty-safe); non-runnable verbs (Test w/o a valid URL) degrade to pre-fill.

## 5. Suggested graft sequence
1. ✅ **DONE (Room).** `audienceToActiveAudience` + the read-only `variant='surface'` branch (peek-only at rest; the on-focus read-only Room is forward-ready). Additive — shipped behind nothing.
2. ✅ **DONE (Surfaces, 2026-07-05).** `SurfaceDock` stub → `AudiencePresence variant='surface' layout='dock'`, fed **raw `Audience[]`** from the server (`listAudiences` / `resolveUserAudience`) — NOT via `audienceToActiveAudience` (type-flow trap, §2.4). Browser-verified on `/start` (switcher lists real audiences, live select, persist-across-reload).
3. ⛔ **BLOCKED (not adapter work).** The Seam-2 `predictionResultToRead` adapter already landed — but a surface card can only open a real Read when the card carries a real `PredictionResult`, and the start-page's cards are fabricated (no `analysis_results`). This step unblocks once the surfaces SOURCE cards from real analyses (see Seam 1/2 ledger rows) — a content/pipeline build, not a seam mount.

_Cross-refs: [`THE-CONTRACT.md`](./THE-CONTRACT.md) §3 Seam 3 + §6.2 · `src/lib/audience/resolve-user-audience.ts` · `src/components/audience-lens/audience-presence.tsx:136` · `src/components/surfaces/surface-dock.tsx` · `src/lib/room-contract/types.ts`._
