# Numen Surface — Migration Boundary (DS-06 / D-04)

**Milestone:** v5.0 Numen Surface · **Phase:** 01 Design System Foundation + Brand Migration
**Plan:** 01-05 · **Measured:** 2026-06-11 (this repo, `milestone/numen-surface`)
**Status:** Inventory + boundary only — **delete nothing live**.

---

## The D-04 rule (read this first)

**Phase 1 deletes NOTHING live.** This document is a grep inventory plus a written
retirement boundary — not a removal. The new warm-neutral Numen kit is built as a
**parallel, namespaced layer** (D-01) that coexists with the live coral/Raycast app
(10 pages / 36 components / board / landing). Nothing in `src/` is modified by this plan.

Every actual removal happens **per-surface, inside the later feature phase that rebuilds
that surface**. The "Owning Phase" column below records who retires each costume target —
and only when they rebuild it. This keeps the app green with zero regression risk while
satisfying DS-06's "documented boundary" literally.

> Audit-only proof: `git status --porcelain src/` is empty for this plan. The only file
> written is this doc, under `/docs` (per CLAUDE.md file-organization rule).

---

## Inventory + disposition table

Counts re-measured 2026-06-11 against `src/` (this repo's `rg` is shimmed → `grep -rl` /
`grep -rni` used per Research Q8). Counts are reported as **files** (unique files) and,
where useful, **refs** (total line matches).

| Target | Files/Count (measured 2026-06-11) | Surface(s) | v5.0 Disposition (replace / defer) | Owning Phase |
|--------|-----------------------------------|------------|-------------------------------------|--------------|
| `#07080a` cold base | **5 files** (6 line-refs) | globals.css, marketing OG images, board-preview, error page | **Replace** with `--numen-bg` warm base, per-surface | Each surface's rebuild |
| `#FF7F50` hardcoded coral | **17 files** (35 line-refs) | globals.css, marketing showcase + OG, board (audience/verdict/camera/node/view-toggle), brand-deals chart, video-upload, competitors video-card, upgrade-banner | **Replace** with `--numen-accent` (matured clay), per-surface | Each surface's rebuild |
| `GlassPanel` (everywhere) | **10 files** | analyze result-card (+ test), primitives showcase + GlassPanel.tsx + index, board (CreatorRulebookCard, MobileBoardBanner, NodeOverlay, OrientationHint) | **Replace** with the rare Glass primitive (ephemeral surfaces only — composer + tool-sheet, §6), per-surface | Each surface's rebuild |
| `coral-` / `--color-coral` tokens | **7 files** | globals.css, design-tokens.ts, marketing showcase, board copy-button + audience-constants, command-bar ExpertChatThread, ui/toggle | **Map** to `--numen-accent`, per-surface | Each surface's rebuild |
| `framer-motion` | **4 files** | simulation analysis-loading + loading-phases, viral-results FactorCard + ViralScoreRing | **Defer.** Standardize NEW code on `motion`; defer the `pnpm remove framer-motion` + 4-file migration (D-04: don't touch live) | Later surface-rebuild phase (D-10 cleanup) |
| `TrafficLights` (fake macOS chrome) | **5 files** (33 refs) | primitives/TrafficLights.tsx + index, marketing primitives-showcase, showcase traffic-lights-demo + utilities page | **Retire.** No window-chrome in the mobile thread (§6) | Phase 5 (shell rebuild) |
| chat dock | **4 files** — FOUND (see widened-grep note) | `src/components/command-bar/` (CommandBar.tsx, ExpertChatThread.tsx, ExpertChatInput.tsx) + `src/hooks/queries/use-expert-chat.ts`; mounted in `board/Board.tsx` | **Absorb** into the thread (the dock's "Ask the expert" panel becomes the conversation surface) | Phase 4/5 |

---

## Chat-dock widened-grep finding (resolves Q8 caveat)

Research Q8 reported **0 hits** for the narrow grep (`chat-dock` / `ChatDock` / `drawer`)
and flagged it for widening before concluding the dock is absent. **Widened grep was run**
and the dock **is present** — it simply lives under a different name:

```
grep -rni "chat.*dock\|ChatDock\|chat-dock\|chat.*drawer\|chat.*panel" src
→ src/components/command-bar/CommandBar.tsx
  src/components/command-bar/ExpertChatInput.tsx
  src/components/command-bar/ExpertChatThread.tsx
  src/hooks/queries/use-expert-chat.ts
```

`CommandBar.tsx` self-describes (header comment) as the **"bottom-pinned dock"** rendering a
**"unified expert chat panel"** (thread + composer as siblings in one panel; full-height
sheet on mobile <768px). It is mounted in `src/components/board/Board.tsx`. This is the
"Ask the expert" chat dock the narrow grep missed.

**Disposition:** absorbed into the thread; owned by **Phase 4/5** at rebuild. **No "absent" /
"flag-to-locate" note needed** — the real component (`command-bar/CommandBar.tsx` + the two
`ExpertChat*` siblings + the `use-expert-chat` hook) is recorded above.

---

## What v5.0 replaces vs defers

**Built NOW (Phase 1) — the parallel Numen kit:**
- A namespaced warm-neutral token layer (`--numen-*`) under a surface scope class (D-01/D-02),
  coexisting with the live coral/Raycast tokens in `globals.css` — **no global swap**.
- The rare Glass primitive (ephemeral surfaces only), core primitives, motion tokens, serif
  voice, APCA-calibrated palette, and a kit showcase route.
- New code standardizes on `motion` (not `framer-motion`).

**Deferred (per-surface, later phases) — the retirements:**
- Every row in the table above is retired **only when its owning phase rebuilds that surface**.
  Phase 1 changes none of those live files. Coral hex → `--numen-accent`, cold `#07080a` →
  `--numen-bg`, `GlassPanel`-everywhere → the rare Glass primitive, `coral-` tokens →
  `--numen-accent`, `framer-motion` → `motion` (+ `pnpm remove`), `TrafficLights` → deleted,
  chat dock → absorbed into the thread.
- The parallel kit is **additive**; the costume retirements are **subtractive** and scheduled.
  The two never collide because the new kit lives under its own scope class and the old app
  keeps its existing tokens untouched.

---

## Forbidden carry-overs (D-07 anti-patterns — the kit must NEVER adopt these)

Even though Phase 1 deletes nothing, the **new kit must not re-import** the old costume's
worst habits. Explicitly forbidden:

- **OLD `--animate-shimmer` / `gradient-x` keyframes** — the shimmer/animated-gradient
  effects. Forbidden in the new kit (keyframes-as-chroma means the *user video* + *verdict*
  carry color/energy, not decorative chrome animation — DS-08).
- **`--ease-spring` 1.56 bounce token** — the snappy overshoot easing. Forbidden: the Numen
  motion language is calm (opacity = tween easing; springs only on physical props; no
  bounce/snap — D-10/D-14). The one key motion moment is the stage-reveal, which degrades to a
  static appear under `prefers-reduced-motion`.
- More broadly (D-07 hard rule): **no neon / gradient / beam / glow / shimmer** effect ships —
  those are the "AI-spaceship" aesthetic the vision (§3/§6) positions against.

---

*Generated by Phase 01 Plan 05 (DS-06). Audit-only. Source: Research Q8 grep inventory,
re-measured 2026-06-11; dispositions from UI-SPEC § Migration Boundary + CONTEXT D-04.*
