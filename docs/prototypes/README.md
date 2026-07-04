# The Room — prototypes & artifacts (reference)

Design sketches from the 2026-07-03 shaping session. **Directional, not final** —
reference for intent + interaction, not a spec to copy pixel-verbatim.

## Durable source (in this repo)
- `00-vision.html` — the product-vision doc (why/moat/object-model/loop/flywheel + static screen mockups).
- `the-room-prototype-v5.html` — the **latest** clickable prototype (living presence, clean composer, Bloom/Floating toggle, population split + motion). Self-contained; to view: serve over `python3 -m http.server` (file:// is blocked in the MCP browser).

## Live artifacts (claude.ai)
- **Vision doc** — https://claude.ai/code/artifact/a0dd0372-ab89-4f93-9eb3-d6e93527e3b0
- **Prototype** — https://claude.ai/code/artifact/bc2e21f1-0e10-4ab1-ba7a-2a9c51e82e42

## Prototype version history
The prototype was **redeployed to the same artifact URL** five times, each with a distinct
version **label** — so the earlier iterations are preserved in that artifact's **version
picker** (open the prototype URL → version history). Only v5 source is saved on disk here
(each redeploy overwrote the working file); use the version picker to view/restore v1–v4.

| Label | What it introduced |
|-------|--------------------|
| `room-prototype-v1` | First clickable loop: make hooks → reactions arrive (badge) → open room → ask a persona → numbers → rewrite (7→8). |
| `room-prototype-v2-charset` | Same, fixed a UTF-8/mojibake bug (`<meta charset>`). |
| `room-proto-v3-focus` | **Anchored focus**: multi-batch thread, per-card doors, room header stepper `‹2 of 3›` + `⤺ compare`, re-target-in-place, badge-follows-newest. |
| `room-proto-v4-compose-partial` | **Composition dock** (verb chip + audience chip + input) replacing the quickbar; **partial Room sheet** (focused card peeks above); numbers as a collapsible peek; per-content-type metric. |
| `room-proto-v5-living-presence` (current) | **Living audience presence** restored (always-visible, animated) + audience moved out of composer; **Bloom vs Floating** room-form toggle; **Population split** from the persona feed via scale toggle; **motion back** (Replay / Play). |

See `../THE-ROOM-HANDOFF.md` for the full spec, locked/open decisions, and code audit.
