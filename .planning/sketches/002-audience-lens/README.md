---
sketch: 002
name: audience-lens
question: "How do we deliver the best UX/value for audience simulation — one living audience felt across every skill — that actually builds the moat?"
winner: null
tags: [audience, simulation, moat, phase9, audience-lens, mobile, chat, focus-group]
---

# Sketch 002: AudienceLens

## Design Question
The audience reacts in every skill (ideas, hooks, script, remix, test, chat). The audience is therefore **not a screen — it's a cross-cutting layer**. How do we express *one living audience* consistently across six skills so it feels like a persistent entity you have a relationship with, not six bolted-on widgets — and make each Read feel like sitting behind focus-group glass?

## The Value Thesis (why this is the moat)
Competitors stop at "here's a script." Numen's moat is **the Read** — watching a calibrated audience react before you post. Value ladder, each rung deeper:
1. **See them react** (replay) — visceral proof, not a number generator
2. **Hear them** (verbatims) — specificity makes it believable
3. **Ask them why** (chat) — judgment → understanding
4. **Regenerate *for* them** (steer) — the flywheel; audience changes the output, not just grades it

## The One Architectural Decision
**One `AudienceLens` component, mounted by every Read block.** Each skill hands it `{concept, simResult}`; the Lens renders identically everywhere. Build once → lights up all six skills. Get this wrong = rebuild the cloud five times and the "one audience" illusion dies.

## How to View
```
open .planning/sketches/002-audience-lens/index.html
```

## The Spine (recommended: D + B's identity anchor)
- **Persistent anchor** (top-right chip) = the P7 composer chip extended → the *one entity*, always present, live dot.
- **Inline compact cloud** on every Read card (A's context) → the aliveness test.
- **Bottom-sheet drill** (D, mobile-native) → replay + clickable nodes + verbatims → the focus-group glass.
- **Chat at the audience level**, reachable from anchor or node → persists across cards; subject changes, conversation doesn't.
- **Room mode** = aggregate spokesperson (feeds refine ③ / regenerate). **Node-voice** = "ask Maya directly" (the wow shot). "Room" full-screen (C) parked.

## The Three Risks This Sketch Tests
1. **Inline aliveness** — does the cloud read as *reacting* (dots settle into their reaction on result-land via IntersectionObserver), or as decoration? Scroll the feed to trigger.
2. **Focus-group glass** — open a hook → press ▶ Replay (watch the room react over 0–15s), tap any node for its verbatim + *why*, "Ask [name] directly" for in-voice node chat.
3. **Chat persistence** — open chat from Hook 1, ask something, close the sheet, open Hook 2 → the conversation is still there; only the *subject chip* changes. This is the proof it's one audience, not six widgets.

## What to Look For
- Does the inline cloud earn its place or is it wallpaper?
- Does Replay sell "they reacted in real time"?
- Room-spokesperson vs node-voice — which feels more useful? (Hypothesis: room closes the loop, node is the demo wow.)
- Does the persistent chat actually *feel* like a relationship across cards?
- Mobile bottom-sheet ergonomics — touch targets, scroll, grab handle.

## Open Questions for P9 Discuss
- Desktop: does the docked-pane (B) variant beat the sheet, or do we keep the sheet everywhere for one codebase?
- How much motion is "alive" vs "annoying on every result"?
- Does "Ask [name] directly" ship in P9 MVP or defer with full-screen room mode?
- Where does **steer** (regenerate-for-them) surface — inside chat ("re-run the Read") or as a card action?
