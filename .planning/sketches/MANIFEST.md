# Sketch Manifest

## Design Direction
Replace the flat skill chip row with a single mode pill in the composer header that expands into context-appropriate skill selectors. Raycast dark aesthetic (#07080a bg, coral accent #FF7F50, Inter font). Mobile and desktop must feel native — not the same component forced onto both viewports.

## Reference Points
- Raycast: command palette, extension switching
- Claude: model selector pill
- Notion: slash command / block type picker
- iOS: native bottom sheets (UISheetPresentationController)

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | hybrid-composer | How should the skill selector work when the chip row doesn't scale? | null | composer, skills, navigation, mobile, desktop |
| 002 | audience-lens | How do we deliver one living audience felt across every skill that builds the moat (the Read)? | superseded by 005 | audience, simulation, moat, phase9, audience-lens, chat, focus-group |
| 003 | audience-lens-clean | Cleaner UI language — faces not dots, words carry the room. Which inline treatment? | superseded by 005 | audience, simulation, moat, phase9, redesign, clean |
| 004 | audience-constellation | Node-cloud (Artificial Societies) for the room? + replay as persistent feed | superseded by 005 | constellation, node-cloud, replay-feed, phase9 |
| 005 | audience-scale | Refine opened audience (Read + Rewrite loop) + scale to 1,000 population (honest swarm) | ✅ CHOSEN — Phase 9 direction | population, scale, the-read, regenerate-loop, phase9 |

## Phase 9 chosen direction → Sketch 005 (audience-scale)
The AudienceLens spine: one shared component every skill mounts. **The Read** (interpretation + lever) leads; **Panel · 10 ⇄ Population · 1,000** scale toggle (10 named archetypes are the legend of a variance-instantiated swarm; population cascade + live metrics = the missing touch); persistent reaction feed; audience-scoped chat; sticky **Rewrite for this audience** closes the regenerate loop. Refine in Phase 9. Lineage: 002 (interaction spine) → 003 (clean language) → 004 (constellation + feed) → 005 (interpret + scale).
