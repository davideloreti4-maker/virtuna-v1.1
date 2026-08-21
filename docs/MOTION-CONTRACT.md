# Signed-in motion contract — v1 PROPOSAL

**Status (2026-08-21):** the accessibility half is **SHIPPED** (globals.css, this PR).
The interaction half below is a **proposal awaiting the owner's approval** — nothing in it
is applied yet. Scope is the signed-in app chrome; the marketing layer's scroll-reveal
grammar lives in `docs/motion-guidelines.md` and is not touched by this contract.

## Measured baseline (2026-08-16, re-verified 2026-08-21)

- `active:` press feedback exists on **10 elements, all on marketing routes — zero signed-in**.
- ⌘K palette, project picker and account menu measure `animationName: none` / `0s` — no
  entrance motion at all. Add-Competitor is the outlier: a 200ms `ease` keyframe.
- `--ease-spring` is an **overshoot** curve (`0.34,1.56,0.64,1`) with **no consumers** — a trap
  waiting for someone to reach for the name.
- `prefers-reduced-motion` is broadly wired (`usePrefersReducedMotion` + ~60 files). It was
  never the gap.
- `prefers-contrast` and `prefers-reduced-transparency` were at **zero occurrences app-wide**
  → now handled centrally in `globals.css` (this PR): contrast bumps hairlines 6%→16% and
  muted text one cream rung; reduced-transparency kills every `backdrop-filter` (all frosted
  fills already ship ≥0.75 alpha, so no per-site opaque fallbacks are needed).

## The contract (proposed — approve/amend before applying)

1. **Press feedback.** Every signed-in interactive element acknowledges the press:
   buttons, tiles and rows get `active:` feedback — a background step to `--color-active`
   for flat/hairline elements, `active:scale-[0.98]` for solid-fill buttons. ~100ms, no delay.
   Text links get none. Matte rule holds: no glow, no ripple.
2. **Entrance motion for floating layers only.** ⌘K, pickers, menus, popovers: **140ms**
   fade + scale from 0.98, ease-out; exit **100ms** ease-in fade. Sheets/drawers: 200ms slide.
   In-flow content on signed-in routes gets **no** entrance motion — reveals are the marketing
   layer's grammar, not the workspace's.
3. **Curves.** Chrome uses plain ease-out (enter) / ease-in (exit). **Retire `--ease-spring`**
   (delete the token) unless the owner names the one playful moment allowed to overshoot.
4. **Preferences gate everything.** Every rule above collapses to `none` under
   `prefers-reduced-motion: reduce`, via the existing hook or a media query — never a new
   mechanism per surface.

## Deliberately not proposed

- Scroll-triggered reveals inside the signed-in app.
- Motion on data updates (streams and skill output frames have their own treatment).
- Rail/sidebar animation of any kind — adjacent to the vetoed rail-collapse ruling
  (2026-08-12, recorded in AmbientOverview.tsx).

## Application order, once approved

Shared primitives first — `ui/button`, `ui/sheet`, `CommandPalette`, the pickers — then a
per-surface sweep with a before/after motion census (the `animationName`/`active:` probe
pattern from `docs/HANDOFF-2026-08-21-apple-grammar-and-overlay-z.md`).
