# HANDOFF — Ambient Audience v2, Detail cards: premium pass (2026-07-22, session 2)

**Worktree:** `~/virtuna-ambient-audience-v2` · **branch:** `design/ambient-audience-v2`
**Dev route:** `/ambient-v2` (dev :3007) · **status:** merged to main this session (see PR link in commit).
**Predecessor:** `docs/HANDOFF-2026-07-22-ambient-audience-v2-card-rework.md` (session 1 = PR #356). Read it for the contract/role-frame theory. This doc is the session-2 delta.

The v2 Detail instrument is **not wired into the product yet** — `/ambient-v2` is a standalone dev review surface. The platform contract is unchanged: a new domain = ONE `DomainTemplate` object; the frames never fork.

---

## What session 2 did (the arc)

Session 1 built the Brain/Audience detail cards. Session 2 was a **look + premium pass** on both tabs, driven by live owner feedback in this order:

1. **Node animation → narrative cascade.** On open, the society is present but dim, then the stoppers **ignite district-by-district in rank order** (believers first → coral ceiling last) while the verdict **counts up** `0 → 38.2%`. Then a gentle staggered breathe. Motion = intensity only (design law); nodes never move; seed 42 layout is byte-identical SSR/client.
2. **Cross-tab thread.** The top objection (`The payoff comes too late ×253`) taps → jumps to the brain tab and **flashes** the matching moment (`0:04 · the drop`, coral ring + scroll-into-view). The human "why" and the mechanical "why" are one story. (`CodedReason.thread?: { toMoment }`.)
3. **Ledger ↔ map hover link.** Hovering a district row spotlights that cluster on the map (soft hull, `highlightCluster` prop).
4. **Premium node language.** Killed the messy edge-web; **cream + coral only** (crowd recedes to dust); **soft matte radial-gradient dots** (not a glow — `<radialGradient>` fill), 3-tier sizing.
5. **Node-bar dot vocabulary.** The district ledger's gray progress bars → **node-bars** (dots, lit share = rate, same cream/coral as the map). Pricing's WTP segments use them too. Map + ledger + segments now speak ONE dot language.
6. **Wider + bigger.** Card `max-w-[380px] → 480px` (both tabs, same width). Hero figures `208 → 270px` (426×270 rendered); terrain fills the card (`preserveAspectRatio="…slice"`). `Kick` chrome quieted globally (10px, airier).
7. **Editorial declutter — both tabs.** Removed genuinely redundant chrome.

### ⚠️ The lesson that cost two mis-fires (read this)
**"Declutter" ≠ "remove content/insight."** In the editorial-minimal pass I over-cut the audience page — I removed the **interpretive read** and compressed the reason context, and the owner called it out twice ("did you remove insights again"). The fix that landed:
- **Premium comes from SPACE (wider card, bigger figures, quiet chrome), NOT from deleting substance.**
- Cut only true chrome: loud kickers, role-word noise (`MIXED/MIXED`), the `SIMULATED`/`from this run` tags, per-reason gray share-bars.
- **Keep the insight:** the read line ("your believers cluster in builders; skeptics are your ceiling") and the full reason meta (`↳ 0:04 · the drop · Maya · skeptic · interview ›`) were restored.
- The owner explicitly did NOT want the tiny `believers/ceiling` row-tags or `what's leaking/holding` whisper labels I tried — those were reverted. The insight must live in real content, not sprinkled micro-labels.

---

## Current state — the two tabs (final structure)

**Card:** `#1f1f1e`, `rounded-[16px]`, `max-w-[480px]`, `AMBIENT_PANEL_HEIGHT` tall. Slim top bar (back · pager · `The brain | The audience` tabs). Hero figure leads each tab.

**② The audience** (`AudienceTab.tsx` → `PopulationFrame`):
1. `TerrainMap` (`AudienceTerrain.tsx`) — living society, cascade, verdict chip (count-up). 426×270.
2. **The read** — one dim line (`population.heroRead`), the non-obvious "so what."
3. **District ledger** — ranked believers→ceiling, `name · node-bar · rate`, coral on the loss row. Hover → map spotlight.
4. **Outcome** — quiet `top 18%…` line + the `38 / 41 / 21` trio (coral on scrolled-past).
5. **Segments** — pricing only (WTP tiers as node-bars).
6. **Receipts** — coded reasons, objections (coral ×count) above a hairline, endorsements below. Each: label · ×count · serif quote · `↳ moment · who · interview ›`.
7. Calibration (pricing) · `HowToRead`.

**① The brain** (`BrainTab.tsx` → `BrainFrame`) — kept all sections, decluttered chrome:
cortex hero (426×270, WebGL, corner chips + verdict chip) → read line + `cortexNote` → the drop moment (attention scrubber: transcript + curve + moment chips + synthesis; `flashMoment` highlights on cross-tab jump) → `vs your typical` breakdown (signal deltas) → `THE UNLOCK` (de-boxed) → `HowToRead`.

**Files (this session):**
- NEW `src/components/audience-lens/v2/AudienceTerrain.tsx` — seeded graph + cascade + hulls + soft dots + count-up verdict.
- `AudienceTab.tsx` — NodeBar, node-bar ledger, read line, receipts, editorial declutter.
- `AmbientDetail.tsx` — `VerdictChip` count-up (`useCountUp`), `flashMoment`/`onJumpToBrain` wiring, `CodedReason.thread`, quieter `Kick`, `max-w-[480px]`.
- `BrainTab.tsx` — `flashMoment` thread + declutter, hero 270.
- `domain-template.ts` — `voices.total?`.
- `detail-fixture.ts` / `pricing-template.ts` — `total: 1000`, `thread` on top objection.
- `app/ambient-v2/page.tsx` — wrapper `w-[480px]` so `max-w` engages (was collapsing to content width).

---

## Gates & verification
- `npx tsc --noEmit` → 0 · `npx eslint <touched>` → 0 · matte: `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` → 38/38 · files < 500 (max BrainTab ~440).
- **Screenshots HANG** on this app (animations never settle). Verify via Playwright **DOM** only: `browser_evaluate` on `innerText` / `getComputedStyle` / `getBoundingClientRect`. Resize viewport wide (≥1440) or the card measures ~290 (content-collapsed). Never `browser_take_screenshot`.
- Dev: macOS has NO setsid → `nohup node node_modules/next/dist/bin/next dev -p 3007 &`.

---

## NEXT SESSION — owner wants to keep working on BOTH pages
The owner will give **feedback per card, one at a time** (they iterate visually). Start by: `git log -3` to confirm the tip, launch dev :3007, open `/ambient-v2` → `② brain` chip → toggle `The brain` / `The audience` and `creator template` / `pricing template`, then **STOP and wait for the owner's feedback** — do not pre-emptively redesign.

**Standing principles (do not relearn the hard way):**
- More depth / user value / insight is the through-line of every round. **Add substance; don't strip it.** Premium = space + hierarchy + restraint in CHROME, never fewer facts.
- One dot vocabulary (map + node-bars). Cream + coral only; coral = loss/liveness ONLY (dosage locked). Matte — no glow/glass.
- Motion = intensity, never position. Seed 42 stays.

**Candidate directions already on the table (owner's call):**
- Verdict **confidence/benchmark** — `38.2% ± 3.1% · vs your median 29%` (honesty law wants it; needs engine data, slot buildable).
- Pricing **revenue curve** — prove `$24 optimal` (revenue = price × share), don't assert it.
- **Cortex ↔ read live sync** — annotate which networks light at the playhead frame-by-frame.
- **Curve draw-in motion** — attention/demand/resistance are static SVG; a one-time reveal like the terrain got.
- Optional restores I offered and the owner may still want: per-reason **weight bar** (×253 as its share of 1,000) and a fuller **OUTCOME** treatment.
- Build the **A/B (compare)** + **survey (ask)** intake arms — each = "the pricing recipe again."
- Eventually: **wire v2 into the product.**
