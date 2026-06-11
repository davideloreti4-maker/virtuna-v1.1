# Requirements — v5.0 Numen Surface

> Mobile-first rebrand + UX rework. Replace the Konva canvas board with **one thread per video** where the AI's first turn IS the **Reading**. Presentation-layer only — engine v4.1 (ENGINE_VERSION 3.19.0) is frozen. Source: `.planning/NUMEN-SURFACE-VISION.md` + `.planning/research/SUMMARY.md`.

## v5.0 Requirements

### DS — Design System Foundation
- [x] **DS-01**: Warm-neutral dark token system (no pure black; base ~`#1a1714`, panels stepped warmer, warm off-white text), with L<0.15 darks as exact **hex not oklch** (Tailwind v4 bug this repo has hit)
- [x] **DS-02**: Verdict color scale (muted green / amber / clay-red) is the ONLY load-bearing functional color; everything else near-neutral
- [x] **DS-03**: Brand accent = coral matured to warm clay/terracotta (evolve `#FF7F50`), used sparingly — logo, primary action, focus only
- [x] **DS-04**: Sans-led type system with serif reserved for voice moments (greeting/hero + the verdict line)
- [x] **DS-05**: Component vocabulary — full-pill tool chips, circular icon buttons, hairline warm borders, soft elevation, glass restricted to ephemeral elements (composer, tool sheet); backdrop-filter via inline style not class (Lightning CSS strips it)
- [x] **DS-06**: Migration boundary — inventory + retire Raycast GlassPanel-everywhere, scattered hardcoded coral, fake macOS window chrome, **and the chat dock** (absorbed into the thread); ground-up kit, not a retheme of the 36 components
- [x] **DS-07**: Calm motion system (soft, never bouncy/snappy); the stage-reveal is the key motion moment
- [x] **DS-08**: Keyframes ARE the imagery/chroma (load-bearing §6 principle) — the user's video stills are the only atmosphere (hero, accents, empty states); warm-neutral chrome recedes so the (often cool) content + verdict carry all the color and energy

### DATA — Data Contract / View-Model (ENG-06 D-12)
- [ ] **DATA-01**: Pure `lib/reading/view-model.ts` `toReadingBlocks()` mapping ~40 engine fields → ~10 value-bearing Reading blocks
- [ ] **DATA-02**: Both the live `complete` path and persisted-row replay funnel through the SAME view-model, so a Reading and its re-opened resting document are identical
- [ ] **DATA-03**: Consumed-vs-dead field prune documented (resolves F27/F28/F43) — which engine fields the Reading uses vs drops
- [ ] **DATA-04**: Verdict derivation (band + one-line why) from engine output; the `/100` number demoted to supporting evidence (resolves F41/F45)

### GATE — Preconditions
- [ ] **GATE-01**: SMOKE GATE — one real-video E2E on live infra returns sane/honest output (confirms F46/F47 truncation, F22 confidence, F23 §-cites hold live) + yields the real ENG-03 latency number (watch DashScope-429)
- [ ] **GATE-02**: Verdict-banding calibration — band buffer zones WIDER than measured score variance (~±15pt over ~26–86); "Mixed signals" is a first-class, common verdict (kills "confident lie → trust dies")
- [ ] **GATE-03**: UAT sign-off — F42 permalink (authenticated) + full measure-pipeline pass (can land during the milestone)

### READ — The Reading
- [ ] **READ-01**: AI pronounces first, unprompted — the Reading is the thread's first turn; user never faces a blank prompt
- [ ] **READ-02**: Stage-reveal — each completed engine stage materializes its structured block (NOT chatbot token-streaming); reshape existing `StageEvent`/SSE into the Reading's block vocabulary
- [ ] **READ-03**: Verdict in a reserved top "throne" slot, visibly forming while evidence assembles below, crystallizing last as the climax
- [ ] **READ-04**: Verdict = calibrated band + one-sentence why (reads as judgment, not metric); confidence lives in the band's language, never a hedge (resolves F36 — collapses 3 scorecards to ONE verdict)
- [ ] **READ-05**: ~10 evidence blocks re-composed from value-bearing engine fields (reusing the existing card vocabulary as message blocks), with the **expert insight (Apollo interpretation) foregrounded, not buried** (keeps F37)
- [ ] **READ-06**: A completed Reading persists as a re-openable resting document that opens on the verdict
- [ ] **READ-07**: Plain language throughout — calm restraint, NO engine jargon surfaced to the user (resolves F38)

### SHELL — App Shell
- [ ] **SHELL-01**: Home = a vertical list of past Readings, each a compact verdict card (content-intelligence portfolio over time)
- [ ] **SHELL-02**: One persistent "analyze new" action
- [ ] **SHELL-03**: Per-video thread routing — chat-app spine (list → conversation); reuses `analysis_results` + `analysis_chats` + history API
- [ ] **SHELL-04**: Installable PWA (Serwist + `manifest.ts`) with mobile-native feel + iOS add-to-home coaching

### IN — Ingestion
- [ ] **IN-01**: In-app video upload kicks the stage-reveal immediately
- [ ] **IN-02**: Paste-URL ingestion (TikTok/Reels) with clipboard auto-detect
- [ ] **IN-03**: Android `share_target` entry from the TikTok/Reels native share sheet

### TOOL — Follow-ups + Agentic Tools (the moat)
- [ ] **TOOL-01**: 3–4 suggested follow-up taps after the Reading, scoped to competence ("about this Reading / your content"), then free text
- [ ] **TOOL-02**: Instant follow-ups re-interpret existing data (why this score, rewrite the hook, highest-leverage fix) via the existing chat route — no engine spend
- [ ] **TOOL-03**: One agentic tool turn — competitor analysis via the existing Apify `ScrapingProvider` — appended as a structured tool-result turn
- [ ] **TOOL-04**: Agentic taps are visually distinct from instant chips (they cost time + can fail), with a natural "working…" beat
- [ ] **TOOL-05**: Tool failures voiced in-persona, NEVER red error toasts
- [ ] **TOOL-06**: `analysis_chats` schema extension (`kind` + `payload` cols, `'tool'` role) to persist structured tool turns

### MON — In-thread Monetization
- [ ] **MON-01**: Oracle-initiated monetization turn/tool inside the thread (brand-deal fit for the creator's niche) — NOT a separate tab

### DESK — Desktop Instrument
- [ ] **DESK-01**: Same thread widened on desktop — one product, two densities, not a separate app (mobile ships first)
- [ ] **DESK-02**: A dense instrument layer survives desktop-only for powerusers (today's Konva board, or a dense linear successor — keep-vs-retire decided here)

## Future Requirements (deferred to a follow-up milestone)
- [ ] First-run demo Reading — pre-baked Reading on a recognizable viral video shown before first upload
- [ ] iOS native share-sheet ingestion — requires the Capacitor native-wrapper milestone (WebKit #194593 blocks PWA share-target on iOS)
- [ ] Additional agentic tools — back-catalog comparison, trending sounds, best-post-time
- [ ] Shareable Reading export — image card vs link (growth-loop mechanics unresolved, vision §9)
- [ ] Cross-video insight — "your hooks consistently underperform" (surfaces at the home/list level)
- [ ] Projected-views / strategic outcome model — F40, explicitly still deferred (vision §7a)
- [ ] Prompt accuracy + token tuning — the surface-independent sliver of ENG-06 (vision §7b); rides along or a quick later pass

## Open Decisions (resolve during discuss/plan-phase — vision §9, not gaps)
- Exact clay/terracotta brand hue + exact verdict-scale green/amber/red values (calibration, not direction) — owned by **DS-02/DS-03**
- Exact serif typeface for the voice moments — owned by **DS-04**
- How the Reading *settles* (reveal moment → resting document) in detail — owned by **READ-03/READ-06**
- Desktop instrument: keep the Konva canvas vs a dense *linear* successor (willing to retire the canvas entirely) — owned by **DESK-02**
- How much desktop diverges (lean: same thread widened, minimal divergence) — owned by **DESK-01**

## Out of Scope
- **Engine changes** — presentation-only milestone; engine v4.1 / ENGINE_VERSION 3.19.0 is frozen
- **Light mode** — dark-only, decided 2026-06-11
- **Mysticism / oracle theater** — temple / light-as-presence / amber gravitas explicitly cut as gimmicky
- **Open-ended assistant** — follow-ups scoped to competence, not a general chatbot
- **Naked-number verdict / three parallel scorecards / 40-field bloat** — resolved by READ + DATA
- **Konva canvas as the PRIMARY surface** — demoted to the desktop-only instrument
- **Retheme of the 36 Raycast components** — this is a ground-up kit
- **iOS share-target in a PWA** — structurally unbuildable (WebKit #194593); deferred to Capacitor
- **`next-pwa`** — unmaintained; use Serwist

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 1 | Complete |
| DS-02 | Phase 1 | Complete |
| DS-03 | Phase 1 | Complete |
| DS-04 | Phase 1 | Complete |
| DS-05 | Phase 1 | Complete |
| DS-06 | Phase 1 | Complete |
| DS-07 | Phase 1 | Complete |
| DS-08 | Phase 1 | Complete |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| GATE-01 | Phase 3 | Pending |
| GATE-02 | Phase 3 | Pending |
| GATE-03 | Phase 3 | Pending |
| READ-01 | Phase 4 | Pending |
| READ-02 | Phase 4 | Pending |
| READ-03 | Phase 4 | Pending |
| READ-04 | Phase 4 | Pending |
| READ-05 | Phase 4 | Pending |
| READ-06 | Phase 4 | Pending |
| READ-07 | Phase 4 | Pending |
| SHELL-01 | Phase 5 | Pending |
| SHELL-02 | Phase 5 | Pending |
| SHELL-03 | Phase 5 | Pending |
| SHELL-04 | Phase 4 | Pending |
| IN-01 | Phase 5 | Pending |
| IN-02 | Phase 5 | Pending |
| IN-03 | Phase 5 | Pending |
| TOOL-01 | Phase 6 | Pending |
| TOOL-02 | Phase 6 | Pending |
| TOOL-03 | Phase 6 | Pending |
| TOOL-04 | Phase 6 | Pending |
| TOOL-05 | Phase 6 | Pending |
| TOOL-06 | Phase 6 | Pending |
| MON-01 | Phase 6 | Pending |
| DESK-01 | Phase 7 | Pending |
| DESK-02 | Phase 7 | Pending |

**Coverage:** 38/38 requirements mapped — no orphans, no duplicates.

> Note: SHELL-04 (installable PWA) is delivered in Phase 4 alongside the mobile Reading thread (the PWA shell and the mobile surface ship together); the remaining SHELL reqs (home list, persistent action, thread routing) land in Phase 5.
