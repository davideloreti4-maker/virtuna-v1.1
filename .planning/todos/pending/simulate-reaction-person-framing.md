---
id: simulate-reaction-person-framing
created: 2026-06-29
source: 05-06 human-verify
severity: medium
area: engine / simulate-runner (05-05)
status: pending
---

# Simulate reaction is content-framed, not person-framed

## What
The Simulate verb (`runSimulate`, `src/lib/tools/runners/simulate-runner.ts`) runs a
drafted message through the baked **person** General SIM, but the reaction reads as a
generic **content** critique rather than the person reacting to the message.

Observed during 05-06 human-verify (subject "Marcus Reyes", a skeptical business
partner baked from a chat; drafted a business reply with cohort data):

> "Marcus Reyes is likely to be resistant — The message doesn't land, they pass over
> it rather than stop to engage. *'Boring start. If you don't grab me in the first
> second with visuals, I'm gone.'*"
>
> (second run) *"Started with 'sending data now'? Instant scroll. Show me the insight,
> not the file transfer."*

These are social-content/hook reactions ("visuals", "scroll", "first second"), not how
a skeptical analyst would react to a business message.

## Why it happens (hypothesis)
`runSimulate` lifts the per-audience read from `two-audience-read.ts`
(`buildAudienceRepaint` → `runFlashTextMode` → `aggregateFlash`), which is the
**content-reaction** frame. The reactor personas / prompt frame evaluate the stimulus
as a piece of content to scroll past, regardless of the baked person's cognition. The
person's behavioral profile (`behavioral-core.ts`, used by the Profile READ) is
deliberately NOT imported into Simulate (Pitfall 5 in 05-05), so the message-reaction
has no person-cognition grounding — it falls back to content heuristics.

## Impact
The Profile→Simulate "wow" renders and chains correctly (verified), but the reaction's
*content quality* undercuts the person-simulation promise. Card self-labels
`Directional`, so it is honest, not misleading — hence medium, not blocking.

## Possible directions (decide in a focused cycle — engine/product scope)
- Give Simulate a message-reaction frame for `subjectKind: "person"` distinct from the
  content-scroll frame (react to the *message's content/ask*, not its hook/visuals).
- Consider grounding the person reaction in the baked cognition (carefully — 05-05
  Pitfall 5 kept behavioral-core out of Simulate by design; revisit that boundary).
- This is the known "barbell" limitation (heavy READ brain / content-framed live tier).

## Not in scope for
Phase 05 (UI-wiring + verb assembly). This is an engine reaction-frame change; do NOT
auto-close on phase-05 completion.
