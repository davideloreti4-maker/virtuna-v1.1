# The Contract — shared interface between The Room and the Surfaces

> **Created 2026-07-03.** The coordination SSOT between two parallel milestones:
> **The Room** (`~/virtuna-the-room`, `milestone/the-room`) — the ambient audience *in the thread*;
> and **the Surfaces** (`~/virtuna-surfaces`, `milestone/surfaces`) — everything besides the thread.
> **Both sessions build to these four seams.** The Room owns the real implementations; the Surfaces
> session builds against the interface and **stubs it with mock data** until the atom lands, then grafts.
> Status: **proposed — 3 open items in §6 (2 cross-session reconciliations + the card-number call), pending The Room sign-off.** Don't treat as final until those close.

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

## 6. ★ OPEN reconciliations (resolve with The Room before the graft)

1. **The Outcome loop overlaps.** The Room's Phase 4 (account connect → predicted-vs-actual → model sharpens) is the same
   as the Surfaces "post-publish loop." **Proposed split:** the *surface* (account connect, paste-URL, receipts, accuracy-rising)
   = Surfaces; the *reconcile → recalibrate the twin* = The Room / engine. The Room marked it build-last, so timing is fine — the ask is only: don't design it twice.
2. **Audience context outside a thread.** The audience is per-thread pinned; non-thread surfaces have **no thread** → the presence
   has nothing to read. **Proposed:** add a **user-level active/default audience** (last-used) that `variant='surface'` reads; entering
   a thread pins from it. Small but load-bearing — needs The Room's OK since it touches audience resolution.
3. **The card number — one or two.** ✅ **RESOLVED 2026-07-03 — ONE blended `stop`** (owner call: cleaner/punchier on
   the start page). Rejected the craft+audience-fit two-signal split despite its honesty edge (craft is audience-agnostic in
   the engine today), preferring a simpler card. `CardReaction.stop` stays a single number; the two-signal breakdown lives
   *inside* the Room drill, not on the card face. **Relay to The Room** — they own the shared card component, so both halves
   must render one number. (Prototypes carry a toggle for the record; default = one.)
