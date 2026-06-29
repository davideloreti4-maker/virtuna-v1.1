# Premium thread — the client-templated copy FLOOR (grounded)

> Lane `lane/shell` · 2026-06-28. Pressure-tests audit finding #1: *can client-templated prose carry the
> voice without engine synthesis or fabrication?* Answer below is grounded in the real data surfaces, not vibes.
> Companions: `docs/subsystems/ui-loading-states.md` §5, sketch `premium-thread.html` (v3 = the *ceiling*).

---

## 0. TL;DR — the result of the test

**Most of the premium shape is buildable in-lane with ZERO fabrication.** The sketch's magic is mostly real
data we just aren't styling yet:

| Slot | In the sketch (ceiling) | What's actually real today | Verdict |
|---|---|---|---|
| **Outro** | hand-written "beats your last opener…" | `followupText` — **model-authored, already streamed + rendered** as markdown (`hooks-thread-view.tsx:142`) | ✅ **Already real.** Just restyle (word-fade). No templating, no fabrication. |
| **Progress spine** | connected spine + checks | `stages: {name,status}[]` — **real SSE stage events** (`use-*-stream.ts`) | ✅ **Real.** Restyle ProgressChecklist → spine. |
| **Forward chips** | "Write a script from #1 →" | hook→script **handoff already exists** (card action) | ✅ **Real.** Derive chips from card actions. |
| **Script intro** | "building a script around '…' and pressure-testing the open" | the **input hook is known at submit** (it's the thing you fed in) | ✅ **Templatable, honest** — describes the *input*. |
| **Hooks intro** | "The top one stops 8/10 — it weaponizes the exact advice…" | at submit we have **audience only; NO scores/rank/mechanism yet** | ⚠️ **Over-reach.** Cites outputs that don't exist at intro time. Honest version is thinner. |
| **Progress sub-detail** | "Reactor 6 of 10 reacting…" (live counter) | `StageState = {name, status}` — **no per-stage detail field exists** | ⚠️ **Fabricated.** No backing data. Honest substitute or engine ask. |

**So finding #1 resolves favorably:** templating *does* carry the voice — for everything except two
over-reaching bits (rich pre-card hooks-intro, live reactor counter), both of which have honest substitutes.
We were judging on hand-written ceiling copy; the real floor is close, and the two gaps are down-scopable.

---

## 1. The honest data timeline (what's known WHEN a slot renders)

```
SUBMIT ──────────► STREAMING ──────────► CARDS LAND ──────────► DONE
  │ intro renders     │ progress renders     │ cards render          │ outro renders
  │                   │                       │                       │
known: skill,      + stages[] (name,      + per-card: hookLine,   + followupText (engine md,
  audience.name,     status) — REAL          audienceArchetype,     real-when-present)
  .platform,       + statusMessage          mechanism, seedHook,   + handoff actions (real)
  .goal_label,       (1 global caption)      rank, band, fraction,
  .personas (10)   ✗ NO per-stage detail    scrollQuote — REAL
  + the user ask
✗ NO band/rank/score yet
```

Source: `src/lib/audience/audience-types.ts` (`CalibratedAudience`: `name`, `platform`, `goal_label`,
`personas` = exactly 10), `use-hooks-stream.ts` `toBlocks()` (card props), `progress-checklist.tsx`
(`StageState = {name,status}`), `*-thread-view.tsx` (`followupText` render).

**The rule that falls out:** a templated line is honest when it describes an **input** (audience, the hook you
fed in, the skill) — and a fabrication when it describes an **output** before the output exists. Intros that
orient are honest; intros that *report results* are not (until results land — at which point that's the
outro's job, and the engine already writes it).

---

## 2. The floor — actual template functions (grounded in real fields)

### Intro (the only net-new, client-owned slot)

```ts
// renders at SUBMIT — inputs only, never results
function introLine(skill: Skill, aud: CalibratedAudience, input?: { hookLine?: string }): string {
  const who = aud.name;                          // "Morning Routine Creators"
  const where = PLATFORM_LABEL[aud.platform];    // "TikTok"
  switch (skill) {
    case 'hooks':
      return `Pulling hooks for **${who}** — I'll react each one with your 10 reactors and rank the strongest first.`;
    case 'ideas':
      return `Looking for angles **${who}** would actually stop on. Scoring each against your 10 reactors.`;
    case 'script':
      // RICHER + still honest: the hook is the input, known now.
      return `Writing a script from "${truncate(input?.hookLine, 60)}" — then pressure-testing the open against **${who}**.`;
    case 'remix':
      return `Decoding this video, then rewriting it for **${who}** on ${where}.`;
    case 'account-read':
      return `Reading your last posts to find what's working — and where you're leaking ${where} watch-time.`;
  }
}
```

### Outro — NOT templated. Use the real engine text.

```ts
// followupText already exists + renders. Premium work = restyle, + a fallback when null.
const outro = followupText ?? outroFallback(skill, topCard);

function outroFallback(skill: Skill, top?: HookCardBlock['props']): string | null {
  if (skill === 'hooks' && top) return `#${top.rank} is your strongest. Want me to turn it into a script?`;
  return null; // no fabricated outro; if engine gave nothing and no safe fallback, render nothing
}
```

### Forward chips — derived from real card handoffs (not invented)

```ts
function forwardChips(skill: Skill, top?: HookCardBlock['props']): Chip[] {
  if (skill === 'hooks' && top) return [
    { label: `Write a script from #${top.rank} →`, primary: true, action: 'hook→script' },
    { label: `Test #${top.rank} on your audience →`,                action: 'hook→test'   },
  ];
  // ...one chip per existing handoff. No chip without a real destination.
}
```

### Progress sub-detail — the one real gap. Three options (§4).

```ts
// OPTION B (recommended now): static descriptor per known stage name. Honest (describes the
// stage's JOB, not a fake live count), never tight-loops on long waits.
const STAGE_COPY: Record<string, string> = {
  'audience':  'Reading your audience signature',
  'generate':  'Drafting against your audience',
  'beats':     'Mapping the beat structure',
  'write':     'Writing the script',
  'score':     'Scoring the opener against your 10 reactors',
};
// sub = STAGE_COPY[stage.name] ?? null;   // no counter, no fabrication
```

---

## 3. Side-by-side — ceiling (sketch) vs honest floor

**Hooks · intro**
- Ceiling: *"Here are your strongest hooks for Morning Routine Creators. The top one stops 8 of 10 — it
  weaponizes the exact advice they already follow, then turns it into the villain."*
- Floor: *"Pulling hooks for **Morning Routine Creators** — I'll react each one with your 10 reactors and
  rank the strongest first."*
- Gap: the ceiling's value (the "8/10 + why it lands" insight) is **output**, unknown at intro time. The floor
  is honest but plainer. **The insight isn't lost — it's in the card's proof unit + why-line + the engine
  outro.** The question is only whether we *also* want a results-citing lead line (→ §4 decision 1).

**Script · intro**
- Ceiling: *"On it — building a script around 'Everyone tells you to post daily…' and pressure-testing the
  open against your audience."*
- Floor: *"Writing a script from \"Everyone tells you to post daily. That advice is…\" — then pressure-testing
  the open against **Morning Routine Creators**."*
- Gap: **none worth mentioning.** Script intro cites the input hook (known), so the floor ≈ the ceiling. ✅

**Outro (both)**
- Ceiling: hand-written.
- Floor: **the engine's `followupText`** — already richer than anything we'd template, and already shipping.
  We were going to *downgrade* the outro by templating it. Don't. Just style it. ✅

**Progress sub-detail**
- Ceiling: *"Reactor 6 of 10 reacting…"* (implies live per-reactor progress)
- Floor (B): *"Scoring the opener against your 10 reactors"* (static; true; calm on a 90s wait)
- Gap: we lose the *live-counter thrill* but kill the fabrication + the long-wait tight-loop bug.

---

## 4. Two decisions this surfaces — ✅ LOCKED 2026-06-28

> **Decision 1 → (a) Thin orientation.** **Decision 2 → (a) Static now + (b) file the engine ask.**
> Both folded into the sketch (v3.1). The one engine request is filed below.

### 🔧 FILED ENGINE ASK (carry to the GSI/engine lane at integration)
Add an optional **`detail?: string`** to the stage SSE event and to `StageState`
(`src/components/thread/progress-checklist.tsx:25`). Backend may stream a live per-stage status string
("The Skeptic is responding…", "Reactor 6 of 10…"); chrome renders `stage.detail ?? STAGE_COPY[stage.name]`
so it degrades to the honest static descriptor when absent. Small, additive, no breaking change. Until then,
chrome ships static descriptors only — **no faked live counter.**

---

**Decision 1 — the hooks/ideas intro: thin-orientation vs results-lead vs none.**
- **(a) Thin orientation [recommended].** Honest pre-card line as in the floor. Premium feel comes from the
  *reveal motion* + the engine outro, not from a fake-rich intro. Ships now, in-lane, zero risk.
- (b) Results-lead: hold the intro until rank-1 lands, then lead with "Your strongest stops 8/10…". Honest
  (results exist by then) but (i) delays the first text, hurting the "instant you-were-heard" goal, and
  (ii) overlaps `followupText` (now we summarize twice). Not recommended.
- (c) No intro for hooks; let cards + outro carry it. Cleanest, but loses the "you were heard" beat that A3/the
  north star want. The thin orientation (a) is that beat done honestly.

**Decision 2 — progress sub-detail: static descriptor vs engine `detail` field.**
- **(a) Static per-stage descriptor [recommended now].** Option B above. In-lane, honest, no loop bug.
- (b) Engine ask: add `detail?: string` to the stage SSE event so the backend can stream true live status
  ("Reactor 6 of 10…", "The Skeptic is responding…"). This is the **one justified engine request** — small,
  additive, and it's what makes the narration *genuinely* alive. File it for the GSI/engine lane; ship (a)
  meanwhile so the chrome doesn't block on it. The seam (`StageState`) is ready for the extra field.

Net: **(1a) + (2a) now, (2b) as a filed engine follow-up.** Both keep us in-lane with zero fabrication, and
the experience is ~90% of the sketch ceiling — the missing 10% (live counter + insight-rich preamble) is
exactly the part that *should* come from the engine, not be faked in chrome.

---

## 5. What this means for the sketch + the build

- **Re-copy the sketch to the floor** so the target is buildable: swap the hooks-intro to the thin line, swap
  the reactor-counter sub-details to static descriptors, and label the outro "= engine followupText (real)".
  Keep script-intro, spine, chips, lens, cards as-is (all real/honest).
- The sketch's **lens "Ask the skeptic why →"** stays flagged aspirational (living AudienceLens is P9/unbuilt;
  sibling `all-skill-cards-refined.html` deliberately uses **Save**, not live chat) — render it as **Save the
  read** now, upgrade later.
- Then the v3 → v3.1 sketch IS the build spec for Chunk 1 (which still also needs the A1 switch-skeleton +
  A4 unscored→scored states added — those are the *mechanics* under this *copy*).
