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
| **1 — Card** (`CardReaction`) | `types.ts` §1 | 🟢 **LANDED.** `readToCardReaction(read): CardReaction` shipped (`src/lib/room-contract/read-to-card-reaction.ts`, unit-tested) — pure, derives the glance-tier card face from a Seam-2 `Read` (tone banded off `stop` like the Room's `meterTone`; `lead` a real reaction verbatim, never fabricated). | `mock-room.ts` `MOCK_READS` → `getReadByCardId` | **Surfaces-side only:** feed a real card face via `readToCardReaction(predictionResultToRead(data, id))` instead of mock. |
| **2 — Read** (`Read`) | `types.ts` §2b | 🟢 **LANDED.** `predictionResultToRead(data, contentId)` shipped (`src/components/reading/prediction-to-read.ts`, unit-tested) — pure, builds the same nodes the Phase-3 Room does (`buildAudienceNodes`), maps `PredictionResult → Read{stop,split,weakSpot,fix,reactions,population}` (all real engine output; names never the enum; honest population). | `mock-room.ts` `MOCK_READS` | **Surfaces-side only:** feed a real analysis through the adapter instead of `getReadByCardId` / `MOCK_READS`. Shapes align 1:1. |
| **3 — Presence** (`AudiencePresence variant='surface'`) | `types.ts` §3 | 🟢 **LANDED (Room side).** The read-only `'surface'` render branch is implemented (`audience-presence.tsx` — peek band always + on-focus read-only `AmbientRoom`; the Rewrite CTA + "type below" prompt gated off) **and** the `audienceToActiveAudience` adapter shipped (`audience-to-active.ts`, unit-tested). Data atom `resolveUserAudience` already landed. | `surface-dock.tsx` renders local `AudienceConstellation` + switcher, fed `MOCK_AUDIENCES` | **Surfaces-side only:** swap the `surface-dock.tsx` stub → `<AudiencePresence variant='surface'>` fed `resolveUserAudience → audienceToActiveAudience`. See §2.4. |
| **4 — Embedded composer** (`Composer mode='embedded'`) | `THE-CONTRACT §3` | 🔴 **VERIFIED GAP (2026-07-04).** The Room `Composer` exposes NONE of the embedded contract — props are `{className?, onThreadChange?, onConversationChange?, onRehydratingChange?}` (no `mode`/`onLaunch`/`audience`/`seed`); it is /home-only + self-contained (mounted always prop-less). Contract §112's "confirmed" was wrong — **corrected**. | `surfaces/embedded-composer.tsx` — a SELF-OWNED stub (`onLaunch:(input,verb)`) wired to a `launchThread` **toast** (no real routing) | **NOT mechanical.** Either **(A)** the Room extracts an embeddable Composer (real ~1,400-line refactor) or **(B)** the surfaces own the embedded UI + wire the real create→navigate themselves (Seam 4 = a handoff, not a shared atom). Owner's call — see THE-CONTRACT §112. |

**Headline (2026-07-04):** All THREE data-seam producers are **landed on the Room side** — Seam 1 `readToCardReaction` (card face), Seam 2 `predictionResultToRead` (the Read), Seam 3 `audienceToActiveAudience` + the read-only `variant='surface'` presentation (+ the `resolveUserAudience` data atom). The surfaces now have real producers for the card face, the Read, and the app-wide presence. Remaining: the **surfaces-side mount** (swap the stubs — §2.4/§5) + the **Seam-4 composer decision** (path A/B — §1 row 4). No shared-atom work left on the Room side.

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

### 2.4 The swap in `surface-dock.tsx`
```diff
- import { AudienceConstellation } from "./audience-constellation";      // stub
- <AudienceConstellation reacting={reacting} />                          // + local switcher markup
+ import { AudiencePresence } from "@/components/audience-lens/audience-presence";
+ <AudiencePresence variant='surface' layout={isDesktop ? 'rail' : 'dock'}
+   audience={active} audiences={all} selectedAudienceId={active?.id ?? null}
+   onSelectAudience={onSwitch} focus={null} open={open} onOpenChange={setOpen} />
```
Feed `active`/`all` from `resolveUserAudience` (server) → `audienceToActiveAudience` instead of `MOCK_AUDIENCES`.

---

## 3. What the Room must build (the deferred work)
1. ✅ **DONE — the `'surface'` render branch in `audience-presence.tsx`.** Read-only: the peek band always + (on focus) the read-only `AmbientRoom` body; the composer-bound affordances are gated off (`canRewrite=false` → no Rewrite CTA; the "type below" idle prompt swapped for a read-only description). Guarded by `isSurface` so `variant='thread'` stays byte-identical. Reuses the Phase-3 `AmbientRoom` (`personaNodes` + `embedded`). Browser-verified (dock + rail; the on-focus Population weak-spot renders, CTA absent even with `canRewrite=true`).
2. ✅ **DONE — `audienceToActiveAudience(audience): ActiveAudience`** (`src/lib/audience/audience-to-active.ts`) — pure + unit-tested (13 cases; mapping in §2.2). Room-owned so both sessions import one source.
3. ✅ **DONE — `predictionResultToRead(data, contentId): Read`** (`src/components/reading/prediction-to-read.ts`, 10 unit tests) — the Seam-2 adapter so a surface can open the read-only panel / render a card face on a *real* analysis, not mock. Self-contained (builds nodes via `buildAudienceNodes`), honest (real stop/split/reactions, verbatim weakSpot/fix, names never the enum).

## 4. Open questions for the Surfaces sync
- **Which surfaces mount the dock, and which are read-only vs composer-hosting?** Start = composer-hosting (asks work). Confirm feed / calendar / grow / library are read-only. (The new GROW/DISCOVER hubs, #133/#135 — do they change dock placement?)
- **Focus source per surface:** does any non-start surface anchor the dock on a card (→ needs the read-only Read panel), or is every non-start surface peek-only at launch? Peek-only is simplest for v1.
- **Seam 4 truth — ✅ RESOLVED (2026-07-04):** neither. The Room `Composer` is NOT embeddable (no `mode`/`onLaunch`/`audience`/`seed` props; /home-only, mounted prop-less) and the surfaces' embedded composer is a self-owned stub wired to a `launchThread` toast. Seam 4 is a real gap → pick **path A** (the Room builds an embeddable Composer) or **path B** (the surfaces own the UI + the real create→navigate handoff). See THE-CONTRACT §112 (corrected).

## 5. Suggested graft sequence
1. ✅ **DONE (Room).** `audienceToActiveAudience` + the read-only `variant='surface'` branch (peek-only at rest; the on-focus read-only Room is forward-ready). Additive — shipped behind nothing.
2. **← NEXT (Surfaces).** Swap `SurfaceDock` stub → `AudiencePresence variant='surface'`, fed `resolveUserAudience → audienceToActiveAudience`. Verify in a real browser on `/start` + one read-only surface.
3. (Later) add the read-only Read panel once the Seam-2 `PredictionResult → Read` adapter lands, so a surface card can open the room.

_Cross-refs: [`THE-CONTRACT.md`](./THE-CONTRACT.md) §3 Seam 3 + §6.2 · `src/lib/audience/resolve-user-audience.ts` · `src/components/audience-lens/audience-presence.tsx:136` · `src/components/surfaces/surface-dock.tsx` · `src/lib/room-contract/types.ts`._
