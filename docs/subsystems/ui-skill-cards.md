# UI Surface: Skill output cards (hook / idea / script)

> Lane: `lane/polish` (token authority). Surface owner at the component level: **GSI milestone**
> (`milestone/numen-gsi`) — `src/components/thread/**` is on the GSI HOLD list (Phase 5/6 rewrites
> the block dispatcher + adds Profile/Simulate/Predict cards). This doc captures the visual intent +
> a queued fix-list so the refinement is recallable when GSI lands the thread phase. Date: 2026-06-26.
> Design SoT: `docs/DESIGN-SYSTEM.md` + `src/app/globals.css` `@theme`.

## 1. What it is

The cards rendered in the thread when a skill returns a Read: `hook-card-block.tsx`,
`idea-card-block.tsx`, `script-card-block.tsx`, dispatched by `message-blocks.tsx`. Each card is a
matte charcoal frame with a FACE (always visible: rank, audience-archetype chip, the hook/idea/script
line, a lead scroll-quote + at-rest reaction, a band·fraction·SIM-1 chip) and an EXPAND disclosure
(mechanism prose, seed, channel, opt-in failure-mode), with chain CTAs (Save / Write script → / Test full →).

## 2. Token-reach analysis (why a pure token-seam pass barely moves these)

The cards are a **mix**: some values consume tokens (`text-foreground`, `text-muted`,
`border-white/[0.06]`, `var(--color-success|warning|error)`, `var(--color-foreground-secondary)`),
but the **card-local visual knobs are hardcoded inline `rgba()`** and bypass the token layer
entirely. A `lane/polish` token change cannot reach those. The only token-driven values are global
semantics — tweaking them to fix a card regresses every other surface. **Conclusion: a meaningful
skill-card visual refinement requires editing `thread/*.tsx` = HOLD. It cannot be done well through
the token seam alone.** Same copy-pasted template across all three cards.

## 3. Live vs design-system (deltas / bugs)

| # | Sev | Item | Evidence | Fix |
|---|-----|------|----------|-----|
| C1 | **P1** | **Matte violation — white inset-shine re-introduced inline.** The `@theme` shadow block explicitly removed inset white shine ("NO inset white shine, NO glow"); the cards add `boxShadow: 'rgba(255,255,255,0.05) 0 1px 0 0 inset'` back. | `hook-card-block.tsx:90`, `idea-card-block.tsx:115`, `script-card-block.tsx:99` | Drop the inline `boxShadow` (resting cards = border + tone only, per D-05). |
| C2 | P2 | **Cold white-alpha where brand wants warm cream.** Dim text uses `rgba(255,255,255,0.35)` (rank) / `0.30` / `0.50` — bluish-white, off-brand vs the cream scale. | `hook-card-block.tsx:101`, `script-card-block.tsx:48,172` | Consume a cream-toned token (see §4 gap T1). |
| C3 | P2 | **Disabled state hardcodes cream-alpha.** `rgba(236,231,222,0.35)` / `0.5` for disabled CTA text — no token. | `hook-card-block.tsx:265,281`, `idea-card-block.tsx:304`, `script-card-block.tsx:241` | Consume a cream-disabled token (gap T2). |
| C4 | P3 | **Archetype chip hardcodes fill + border alpha.** `bg rgba(255,255,255,0.06)` + `border rgba(255,255,255,0.1)` — duplicates `--color-border` / `--color-border-hover` values but as a *fill*; no semantic chip-surface token. | `hook-card-block.tsx:110-114`, `idea-card-block.tsx:131-132` | Consume a chip-surface token (gap T3). |

## 4. Token-vocabulary gaps (lane/polish CAN add these now — conflict-free, no `thread/` edits)

Adding these to `globals.css` `@theme` + `src/types/design-tokens.ts` produces **no visible change
today** (the cards must be edited to consume them — that's the HOLD/GSI part), but it makes the
deferred structural pass a clean inline-rgba → token swap.

- **T1 — tertiary/dim cream text.** Cards want a ~35%-dim label tone; today they use cold white-alpha.
  Either add `--color-foreground-faint` (cream at lower alpha) or document that `--color-foreground-muted`
  (#8a857c) is the floor. *Decide the ramp before adding.*
- **T2 — cream-disabled.** `--color-disabled` is gray `rgba(128,128,128,0.5)`; cards want cream-disabled.
  Add `--color-action-disabled` (cream-primary at ~0.35).
- **T3 — chip surface.** A semantic fill token for inline chips (archetype tag) distinct from
  `--color-surface-thread` (the frame). e.g. `--color-chip-surface` + `--color-chip-border`.

## 5. Decisions made
- D1: **Do NOT fork-edit the cards in `lane/polish`.** They are GSI HOLD — any `thread/**` edit trips
  the byte-identical gate + guarantees a merge war. Token-seam + this doc only.
- D2: Token-seam reach on these cards is **thin** (inline rgba bypasses tokens) — so this surface is
  *not* a high-yield `lane/polish` target. Higher-yield polish work lives on genuinely token-driven surfaces.

## 6. Queued for GSI (structural / component-level — lands after GSI thread phase merges to main)
1. C1 inset-shine removal (P1 — pure matte regression; smallest, highest-value).
2. C2/C3/C4 inline-rgba → token swap (depends on §4 tokens existing first).
3. Card anatomy / hierarchy refinement (the band-chip vs archetype-chip visual weight, CTA row treatment)
   — discuss as part of the GSI Phase 5/6 card rebuild, not in a lane.

## 7. Open questions
- Add the §4 prep-tokens now (invisible today, enables clean later swap), or defer until GSI is ready
  to consume them in the same pass? — owner call.
- Does GSI Phase 5/6 keep the hook/idea/script cards or replace them with Profile/Simulate/Predict
  cards? If replaced, C1–C4 may be moot — confirm with the GSI session before investing.
