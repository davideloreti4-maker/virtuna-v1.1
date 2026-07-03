# The Contract — shared interface between The Room and the Surfaces

> **Created 2026-07-03.** The coordination SSOT between two parallel milestones:
> **The Room** (`~/virtuna-the-room`, `milestone/the-room`) — the ambient audience *in the thread*;
> and **the Surfaces** (`~/virtuna-surfaces`, `milestone/surfaces`) — everything besides the thread.
> **Both sessions build to these four seams.** The Room owns the real implementations; the Surfaces
> session builds against the interface and **stubs it with mock data** until the atom lands, then grafts.
> Status: **✅ SIGNED OFF by The Room 2026-07-03g** (their Task A shipped, PR #107 merged into `milestone/the-room`). **All 4 seams confirmed as specced. §6.1 + §6.2 RESOLVED; §6.3 confirmed (one blended number).** One design delta absorbed: `variant='surface'` presence is **read-only** (no ask input unless the surface hosts a composer) — see Seam 3. The Room owns the real atoms and will flag when each lands so the Surfaces swap stub → real.

---

## 1. Why this exists

The moat is "your audience reacts to what you make." The Room makes that real *inside the thread*.
The Surfaces spread the same ambient audience to **every** surface (start page, feed, calendar, library, loop).
For it to feel like **one product**, the pieces both sessions render must be the *same* pieces — defined once here.
If we each invent our own card / payload / presence, they won't line up at integration and we get rebuild-hell.

**Rule:** build surfaces *ambient-ready, not ambient-blind.* Reserve a reaction slot in every surface, stub it against
this contract, build fully around it. When The Room ships the real components, swap stub → real. A graft, not a rebuild.

---

## 2. Shared vocabulary (from The Room's model — use these words everywhere)

Five nouns · three verbs. No "SIM" jargon; "personas" → **people**; plain English; honesty spine (never fabricate a reaction).

- **Your Audience** — a living model of the creator's real followers (calibration = the moat asset).
- **A Person** — a *named* character (Maya, Jordan…), ~10–12, representing segments; they recur. **Named, never the archetype enum.**
- **Content** — anything tested: a hook, idea, script, real video, or a raw thought.
- **A Reaction** — how one Person responds: verdict + moment + what they'd say, *in voice*.
- **The Read** — the room's aggregate: headline metric + who split which way + the weak spot + the fix.
- **Verbs (the whole app collapses ~13 skills → three):** **Make · Test · Ask.** The Room is the stage; verbs put Content on it.
- **Intent (Grow/Sell)** is a *property of the Audience's goal*, **not** a separate control.

---

## 3. The four seams

### Seam 1 — The card (the "Glance" tier: a door to the room)
Every card wears the room's verdict inline — identical on a thread card, feed tile, calendar slot, saved card, briefing item.
```ts
type Tone = 'loved' | 'bounced' | 'neutral'; // dot color: green / terracotta / muted

interface CardReaction {
  cardId: string;   // stable id — the Room anchors focus on this (their "anchored focus")
  tone: Tone;
  stop: number;     // headline metric, of 10  → "7/10 hooked"
  lead: string;     // one lead verbatim, in a Person's voice → "finally, honest"
}
// Interaction: tapping the card opens The Room anchored on cardId.
```

### Seam 2 — Reaction + The Read (the "Drill" payload)
The data behind a card when the room opens on it.
```ts
interface Reaction {
  person: { id: string; name: string; segment: string }; // NAMED (Maya · "gym rat")
  tone: Tone;
  verdict: string;   // their take, in voice → "cancelling? instant unfollow"
  moment?: string;   // where/when they reacted → "drop at 0:07" (optional)
}
interface Read {
  contentId: string;
  stop: number;                                   // headline metric (of 10)
  split: { loved: number; bounced: number; neutral: number }; // percentages, sum ~100
  weakSpot: string;                               // the problem
  fix: string;                                    // the lever (feeds Rewrite steering)
  reactions: Reaction[];                          // the named people
  population?: { modeledFrom: number; total: number }; // honest: 1,000 modeled from the 10 (NOT 1,000 calls)
}
```

### Seam 3 — The presence / dock (the "Focus" tier: the living audience, mountable app-wide)
The Room's always-visible living presence, made mountable outside the thread.
```ts
interface ActiveAudience {
  id: string; name: string;
  people: { id: string; name: string; segment: string }[]; // ~10, named
  tier: 'Directional' | 'Validated';   // from resolve-tier.ts
  pulse?: string;                        // "6 of 10 would stop" | idle "General · 10 people ready"
}
<AudiencePresence
  audience={ActiveAudience}
  onSwitch={(audienceId: string) => void}
  focus={cardId | null}                 // what card it's anchored on; null = idle honest "N people ready"
  variant='thread' | 'surface'          // 'surface' = app-wide dock on non-thread pages
/>
```
Reuse The Room's switcher pattern: **portal to `<body>` + `position:fixed`** so it escapes `overflow-hidden`
(their `audience-presence.tsx` already does this — mirror it).

> **★ SIGN-OFF DELTA (2026-07-03g).** In the thread, the presence panel routes typing into audience-chat
> via the composer field. A non-thread surface has no such field, so **`variant='surface'` = a PEEK band +
> a READ-ONLY Read/lever panel — NO ask input.** If a surface wants asks, it must **host a composer (Seam 4).**
> The start page does (the embedded composer), so asks work there; feed / calendar / library mount the dock
> *read-only* unless they also mount a composer. Our `SurfaceDock` stub is already read-only (presence +
> switcher only) — consistent. Portal-to-`<body>` + `position:fixed` unchanged.

### Seam 4 — The embeddable composer + handoff
The Room's clean composer `✦ Make ▾ · input · ↑`, embeddable on the start page.
```ts
<Composer
  mode='thread' | 'embedded'            // 'embedded' = on the start page, no thread yet
  audience={ActiveAudience}
  seed?={ Content }                      // tapping a briefing item / feed tile pre-fills
  onLaunch={(input: string, verb: 'Make'|'Test'|'Ask', audience: ActiveAudience) => void}
/>
// Handoff: on submit (or tapping a briefing item), 'embedded' creates a thread with the audience
// context + seed, then routes to /thread/:id. This is the ONE contract point between the two halves.
```
> **✅ CONFIRMED (2026-07-03g)** — The Room is exposing `mode='thread'|'embedded'` + `onLaunch(input, verb, audience)`;
> `embedded` reuses the existing create→navigate loop (thread w/ audience+seed → `/thread/:id`). One handoff point.
> **★ Stub drift to fix at graft:** our `EmbeddedComposer` stub's `onLaunch` is `(input, verb)` and it takes no
> `audience` prop; the real signature is `(input, verb, audience)` with `audience` a prop. Mechanical to align when
> we swap stub → real (we already hold `activeAudience` in scope) — tracked, no functional gap in the shell.

---

## 4. Ownership

| Piece | Real implementation | Stubs against it |
|---|---|---|
| Seams 1–4 components | **The Room** (`src/components/audience-lens/`, composer) | The Surfaces (mock data) |
| The card / presence / composer *on non-thread surfaces* | The Surfaces mounts the shared components | — |
| The Read/Reaction data (sim) | The Room / engine | The Surfaces reads the payload |

The Surfaces session **never rebuilds** the atom — it imports the shared components and feeds them contract-shaped data.

---

## 5. What already works (don't re-derive — from The Room's audit)

- Audience is **per-thread pinned** (`thread.active_audience_id`); the switcher persists to it and the engine reads it.
- The **sim runs during generation** → thread cards already come back with `audienceArchetype`, `scrollQuote`, stop-fraction, so per-card reactions are ~free.
- Real components: `src/components/audience-lens/` (`AudienceLensContent`, `PersonaChatDrawer`, `PopulationSwarm`, `audience-presence.tsx`), `src/lib/audience/` (`resolve-thread-audience`, `resolve-tier`, `intent-lens`), `persona-registry.ts`.

---

## 6. Reconciliations — ✅ ALL RESOLVED (The Room sign-off 2026-07-03g, PR #107)

1. **The Outcome loop overlap — ✅ RESOLVED (AGREE).** Split confirmed: the *surface* (account connect, paste-URL, receipts,
   accuracy-rising) = **Surfaces**; the *reconcile → recalibrate-the-twin* = **The Room / engine.** **Condition (The Room's):
   the predicted-vs-actual DELTA + the write-back to the calibration asset are ENGINE-SIDE** (honest, consistent with the sim).
   Build-last is fine. **➜ Consequence for our loop:** we do NOT invent the receipt scalar / accuracy metric — the engine
   computes the predicted-vs-actual delta and we *render* what it exposes. So the loop's read side is a **future engine read-shape
   we consume**, not a metric we define. Still deferred to milestone end (`START-PAGE-BUILD-HANDOFF.md` §4.4): at the end, EITHER
   wire it (once the engine exposes the delta/accuracy read-shape + there's seeded data to verify) OR remove the section for launch.
2. **Audience context outside a thread — ✅ RESOLVED (The Room's to build).** They add a **user-level last-used audience**: the
   switcher writes it; `variant='surface'` + new-thread creation seed from it; `thread.active_audience_id` stays SSOT once inside a
   thread (`resolveThreadAudience` unchanged; they add a **`resolveUserAudience` sibling**). **➜ For us:** the `SurfaceDock` reads
   this user-level audience at graft (swap our `MOCK_AUDIENCES`/local state → `resolveUserAudience`). Unblocks the app-wide dock.
3. **The card number — ✅ CONFIRMED ONE (both halves).** `CardReaction.stop` = a single blended number; **The Room owns the shared
   card and renders one.** A two-signal face would imply a per-audience craft/fit split the engine does not compute today (craft is
   audience-agnostic). The breakdown lives *inside* the Room drill, never on the card face. (Prototypes carry a toggle for the record; default = one.)
