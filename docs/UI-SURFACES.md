# UI Lanes — Surfaces Plan

> Lane worktrees off `main`: `lane/polish` (`~/virtuna-polish` — tokens / design system),
> `lane/frame` (`~/virtuna-frame` — peripheral screens), `lane/shell` (`~/virtuna-shell` —
> global chrome + states), `lane/cursor-ui` (`~/virtuna-cursor` — Cursor refinement).
> Parallel to the **GSI milestone** (`virtuna-numen-gsi`, `milestone/numen-gsi`), which is
> horizontally rebuilding the core verb surfaces (Profile / Simulate / Predict) and promising the
> creator experience stays byte-identical. Design rules: `.cursor/rules/ui-design.mdc`. Design SoT:
> `docs/DESIGN-SYSTEM.md` + `src/app/globals.css` (ignore all other design docs — stale).

## ⛔ GSI HOLD list (do NOT edit — guaranteed merge conflict)

`milestone/numen-gsi` is horizontally rewriting the core verb surfaces. Editing them in a lane
WILL conflict — and trips GSI's byte-identical gate. Leave them until the matching GSI phase lands
on `main`; polish them via the **token seam** (`lane/polish`) only:

- **Home empty state + starter chips** — `src/components/app/home/**`
- **Composer / inbox** — `src/components/app/home/composer.tsx` + `composer-controls.tsx`
- **Audience picker / library** — `src/components/audience/**`, routes `src/app/(app)/audience/*`
- **AudienceLens / ambient reactor / presence** — `src/components/audience-lens/**`
- **Thread / skill cards / reaction cards** — `src/components/thread/**`
- **Skill menu · trust badges (Validated/Directional) · the Read output view**

The conflict-free surface for the lanes = `globals.css` tokens (lane/polish), the peripheral
screens (lane/frame), and global chrome/states (lane/shell). Rebase on `origin/main` before
starting and again before opening a PR to catch GSI's merges as each phase lands.

## Coupling status (decides what's safe to build now)

Surfaces split into **free-to-build** (no GSI dependency — go now) and **gated**
(coupled to the in-flight GSI milestone — restyle via tokens OK, but structural/data changes wait).

| Surface | Components | Lane | Status | Notes |
|---|---|---|---|---|
| **Audience flow / picker / library** | `src/components/audience/**`; routes `src/app/(app)/audience/*` | GSI | 🔴 HOLD | GSI Phase 3/7 rewrites these (general population, library, badges). Token-seam polish only — no component edits. |
| **Ambient audience / AudienceLens** | `src/components/audience-lens/` (`AudienceLens`, `audience-presence`, `PopulationSwarm`) | GSI | 🔴 HOLD | GSI Phase 7 generalizes the ambient reactor. Token-seam polish only; don't fork-edit. |
| **Skills UI / thread cards / reaction cards** | `src/components/thread/` (`message-blocks` dispatcher + `*-card-block`) | GSI | 🔴 HOLD | GSI Phase 5/6 adds Profile/Simulate/Predict cards + Mode-scoped skill menu. Token-seam only. |
| **Composer / inbox / home empty state** | `src/components/app/home/**` (`composer.tsx`, `composer-controls.tsx`) | GSI | 🔴 HOLD | GSI Phase 4/7 rebuilds the input adapter + home wow. Token-seam only. |
| Design-system tokens / primitives | `globals.css`, `docs/DESIGN-SYSTEM.md`, shared primitives | `lane/polish` | 🟢 FREE | the token authority — only lane/polish edits definitions. Coordinate token renames. |
| Peripheral screens | landing/marketing, auth, settings, account, billing/pricing routes under `src/app/**` | `lane/frame` | 🟢 FREE | no GSI dependency. |
| Global chrome + states | nav/sidebar/header shell, error/404, non-home loading skeletons, motion | `lane/shell` | 🟢 FREE | no GSI dependency. |
| **Library page (saved content)** | route `src/app/(app)/library/page.tsx`; cards `src/components/saved/` | `lane/frame` | 🟡 GATED | mostly presentational; restyle OK. Watch for overlap if GSI's general-library work reaches it — coordinate. `saved-item-card.tsx` may have stale `#FF7F50` → tokens. |

## Recommended order
1. **Start on 🟢 FREE work** — design tokens (lane/polish), peripheral screens (lane/frame), global chrome (lane/shell). Zero conflict risk, immediate throughput.
2. **Polish 🔴 HOLD verb surfaces via the token seam** — change a token in lane/polish and they inherit the new look without anyone touching GSI's component files. Never fork-edit those components.
3. **Component-level work on a HOLD surface** lands AFTER the matching GSI phase merges to `main` (then polish on top), or is handed into the GSI session directly. Sequence with the milestone — don't parallelize the same files.

## Per-surface doc
For each surface you take on, capture the before/after intent + decisions in
`docs/subsystems/ui-<surface>.md` (reuse the `docs/subsystems/_TEMPLATE.md` shape, UI-flavored)
so design decisions are recallable — mirrors how the engine track documents subsystems.
