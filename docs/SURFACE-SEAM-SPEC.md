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
| **1 — Card** (`CardReaction`) | `types.ts` §1 | 🟡 Per-card reaction data already rides thread cards (`audienceArchetype`/`scrollQuote`/`stop`, THE-CONTRACT §5). No contract-shaped `CardReaction` **producer** for non-thread cards yet. | `mock-room.ts` `MOCK_READS` → `getReadByCardId` | A producer `content → CardReaction{cardId,tone,stop,lead}` for feed tiles / calendar slots / saved cards. Derivable where a real card exists (saved cards already echo thread cards). |
| **2 — Read** (`Read`) | `types.ts` §2b | 🟡 The real Read renders today via `AmbientRoom` (Phase 3 embedded). Engine emits `PredictionResult`. No `PredictionResult → contract Read` adapter. | `mock-room.ts` `MOCK_READS` | An adapter `PredictionResult → Read{stop,split,weakSpot,fix,reactions,population}`. Shapes already align 1:1 (see Phase-3 `reading-room.tsx`). |
| **3 — Presence** (`AudiencePresence variant='surface'`) | `types.ts` §3 | 🔴 **The target.** `AudiencePresence` *accepts* `variant` but only stores it as `data-variant` — **only `'thread'` is implemented** (`audience-presence.tsx:136-140`). **Data atom `resolveUserAudience` IS landed** (`resolve-user-audience.ts`, §6.2 resolved). | `surface-dock.tsx` renders local `AudienceConstellation` + switcher, fed `MOCK_AUDIENCES` | **Build the `'surface'` render branch** (read-only) + an `Audience → ActiveAudience` adapter. Data is ready; this is component work. **See §2.** |
| **4 — Embedded composer** (`Composer mode='embedded'`) | `THE-CONTRACT §3` | 🟡 **Verify.** No explicit `mode='embedded'` / `onLaunch(input,verb,audience)` prop found in `composer.tsx` (contract §112 claims it confirmed). The `/home` composer may serve embedded without an explicit mode. | `surfaces/embedded-composer.tsx` (`onLaunch` is `(input,verb)`, no `audience` prop — §3 "stub drift") | Confirm the real embedded surface + align the `onLaunch(…, audience)` signature. Out of scope for Seam 3. |

**Headline:** Seam 3's *data* is ready (`resolveUserAudience`). What's missing is the **read-only surface presentation** in `AudiencePresence` + a small **adapter**. That is the whole graft.

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
1. **Implement the `'surface'` branch in `audience-presence.tsx`** — today it only sets `data-variant` (`:138`). Read-only: render the peek band + (on focus) the read-only `AmbientRoom` body; gate off the composer-field routing, the ask input, and the Rewrite CTA. Reuse the existing `AmbientRoom` (Phase 3 gave it `personaNodes` + `embedded`; add/confirm a read-only guard so no ask affordance renders when there's no host composer).
2. **`audienceToActiveAudience(audience): ActiveAudience`** — pure function + unit test (mapping in §2.2). Room-owned (`src/lib/audience/` or `room-contract`), so both sessions import one source.
3. **(Later, Seam 2)** a `PredictionResult → Read` adapter, so a surface can open the read-only panel on a *real* card, not mock.

## 4. Open questions for the Surfaces sync
- **Which surfaces mount the dock, and which are read-only vs composer-hosting?** Start = composer-hosting (asks work). Confirm feed / calendar / grow / library are read-only. (The new GROW/DISCOVER hubs, #133/#135 — do they change dock placement?)
- **Focus source per surface:** does any non-start surface anchor the dock on a card (→ needs the read-only Read panel), or is every non-start surface peek-only at launch? Peek-only is simplest for v1.
- **Seam 4 truth:** is the real embedded composer a `mode='embedded'` prop or just `composer.tsx` mounted directly? (ledger row 4 — verify before the composer graft.)

## 5. Suggested graft sequence
1. Room builds `audienceToActiveAudience` + implements `variant='surface'` (peek-only first — no Read panel). **Ship behind nothing; it's additive.**
2. Surfaces swap `SurfaceDock` stub → `AudiencePresence variant='surface'`, fed `resolveUserAudience`. Verify in a real browser on `/start` + one read-only surface.
3. (Later) add the read-only Read panel once the Seam-2 `PredictionResult → Read` adapter lands, so a surface card can open the room.

_Cross-refs: [`THE-CONTRACT.md`](./THE-CONTRACT.md) §3 Seam 3 + §6.2 · `src/lib/audience/resolve-user-audience.ts` · `src/components/audience-lens/audience-presence.tsx:136` · `src/components/surfaces/surface-dock.tsx` · `src/lib/room-contract/types.ts`._
