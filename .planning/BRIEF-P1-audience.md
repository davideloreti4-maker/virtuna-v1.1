# Brief — P1: Audience surface redesign (de-Claude track)

> **For:** Cursor (UI track, `design/ui-restrained`) · **Author:** planning/coordination
> **Read first:** `.planning/HANDOFF-ui-restrained.md` → `.planning/AUDIT-ui-surfaces-260624.md` → this.
> **Status:** UNBLOCKED as of 2026-06-24 — engine-rework's AudienceSignature is code-complete + merged
> (PR #24) + integrated into `design/ui-restrained`. Sequence after P0 (or in parallel — different files).

---

## 1. Why
Audit (`audit-03-audience.png`): `/audience` is the flagship "your moat / hero object" (brand spine:
SIMs = user-built audience personas, the hero object) but renders as a **plain CRUD list** — bare
full-width rows (name + "Tiktok · Template" + `…` menu), no persona avatars/count, no calibration
status, no constellation, no who-they-are preview. 2/3 of the viewport empty. The moat looks like a
settings screen.

**Reference bar:** the Reading surface. The audience should feel like the most important object in
the app, because it is.

## 2. The data is now rich (use it)
Engine just shipped the real `AudienceSignature` (`src/lib/audience/audience-types.ts`):
- `creator_persona` (CreatorPersona) — who the creator is, per audience.
- `personas` — `SignaturePersona[]` / `CalibratedPersona[]` with **archetype, share (0..1), temperature
  (cold/warm/hot) breakdown**. → persona count, archetype mix, temperature distribution are all real.
- calibration state per audience (General / preset / target / personal).

This is the substance for rich cards: avatars/dots per persona, count, archetype labels, temperature
mix, calibration status, creator-persona preview.

## 3. Boundaries
**Engine merged, so the former HOLD files are now editable** — `components/audience/calibration-flow.tsx`
+ `audience-reveal.tsx` were just rewritten by the engine track. You MAY restyle them visually, but
**do NOT change their new logic / data flow** (freshly landed; presentation-only, as everywhere).
⛔ Still off-limits: `src/lib/**`, `src/app/api/**`, `supabase/**`, the signature types/contracts.

**🔴 Honesty constraint (A1):** calibration weights + the flywheel are currently **inert in the text
product** (Max-path only — `void resolvedWeights` in the runners). So the audience/calibration UI must
**NOT imply that calibrating changes generation output.** Frame calibration as shaping *who reacts /
the Read*, not "tunes what Numen writes," until A1 is wired. Confirm copy with the human.

> **LOCKED copy (2026-06-24, A1-coupled):**
> - List subtitle → **"Who's in the room when you run a Read."**
> - Calibration / persona-edit line (detail + cards) → **"Shapes who reacts in a Read — not how Numen writes."**
>
> **⚠️ A1 revisit trigger:** the "— not how Numen writes" disclaimer is correct ONLY while A1 is
> unwired (weights inert / Max-path only). **If the engine wires weights→generation (A1), this copy
> goes stale and MUST change.** Whoever lands A1 must update this line (and re-check the subtitle).

**Flux — don't over-build (engine backlog, may change):**
- **A-T:** the Target 3-position model is **not yet implemented**. Don't design target-specific
  affordances that assume it; treat "target" audiences like the others for now.
- **A4:** preset audiences currently have `personas: []` (near-inert). Handle the empty-personas card
  state gracefully (don't render a broken/empty constellation); don't invest in preset-specific UI yet.

## 4. What to build (`src/components/audience/`)
- **Rows → rich cards:** each audience as a card with persona representation (avatars/dots or the
  `Constellation` from P0), persona **count**, archetype/temperature summary, calibration status chip,
  and the per-type label (General / Template / Target / Personal). Match Reading card density.
- **Constellation motif:** reuse P0's extracted `Constellation` as the per-audience visual identity —
  this is the natural home for the motif (the brand leans on it where color is gone).
- **Empty / thin states:** General has no personas → calm baseline card, not a broken visual. Preset
  empty-personas (A4) → graceful.
- **Hierarchy:** kill the dead vertical space; make the page read as a curated set of living audiences.
- **Detail view** (`audience-profile-view.tsx` / the `[id]` route): bring the same richness to the
  single-audience view — creator persona, the persona roster with archetype/temperature, calibration.
- Neutral primary actions (Create audience = cream, already correct); accent = liveness only.

## 5. Acceptance criteria (screenshot each)
1. Audience list reads as rich cards (persona representation + count + calibration status), not rows.
2. Constellation motif present as per-audience identity.
3. General + preset (empty-personas) render gracefully, no broken visuals.
4. Calibration copy does not imply it changes generated output (A1 honesty).
5. Detail view matches the new card richness.
6. `prefers-reduced-motion`: constellation static. Matte; accent neutral except liveness.

## 6. Verification gates
- `npm run lint` + typecheck clean (no NEW tsc errors — note the inherited engine type-debt baseline).
- `node ./node_modules/vitest/vitest.mjs run` — green (see backlog item **T**: reconcile the 5
  pre-existing recolor color-test failures first so the gate is meaningful).
- `/design-check` on the diff (dosage, neutral actions, accent≠error).
- Visual proof: list + detail + empty/thin states.

## 7. Sequencing
- Can run in parallel with P0 (different files) OR right after. Rebase on `origin/main` before the PR.
- Commit format `type(audience): description`. PR into `design/ui-restrained`.
- This is a "draft now / refine on build" brief — re-confirm the signature shape + A1/A-T/A4 status
  against live code at execution time (engine backlog is still moving).
