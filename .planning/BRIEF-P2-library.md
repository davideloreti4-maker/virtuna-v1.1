# Brief — P2: Library surface redesign (de-Claude track)

> **For:** Cursor (UI track, `design/ui-restrained`) · **Author:** planning/coordination
> **Read first:** `.planning/HANDOFF-ui-restrained.md` → `.planning/BRIEF-P0-thread-shell.md` → this.
> **Sequence:** start after P0 (thread-shell) lands. Conflict-free with engine-rework. Reuses the
> branded loading + `Constellation` built in P0.

---

## 1. Why

Live audit (`audit-02-library.png`) found `/library` is a v1-draft scaffold:
- Filter tabs (All/Reads/Ideas/Hooks/Scripts/Outliers/Formats) are flat low-contrast text with a
  barely-visible active pill — no real tab/segmented affordance, no per-type counts.
- Empty state is a giant near-empty bordered box with prose floating in the top third (awkward
  vertical centering, big dead space), **no icon/illustration, no CTA button**.
- Loading is plain text ("Loading your library…"). No skeleton.
- No sort/search even though the type vocabulary implies a growing collection.

The data + interaction layer is solid and shipped — this is a **visual/UX refinement only.**

**Reference bar:** the Reading surface (`src/components/reading/`). Match its card density + framing.

---

## 2. Hard boundary (same lanes as P0)

**⛔ DO NOT TOUCH:** `src/lib/**`, `src/app/api/**`, `supabase/**`, the 2 audience HOLD files, and
the data/launch contracts: `useSavedItems` hook, `shelf-repo.ts` (`SavedItem`/`SavedItemType`),
`chain-handoff.ts` / `CHAIN_HANDOFFS` launch wiring. Restyle output only — don't change props,
queries, or handoff resolution.

**🔒 LOCKED PRODUCT GUARD — do NOT relitigate (D-07, ROADMAP guard):**
The Library is **FLAT by construction. NO folders, NO tags, NO collection grouping.** The filter row
is a client-side `item_type` filter, not a folder tree. Any redesign stays flat. (`saved-shelf.tsx`
header comment is the source of this rule.)

**✅ Presentation-only.** Everything below is layout/markup/state derivable client-side from the
already-fetched `data.items`.

---

## 3. Current architecture

- `src/app/(app)/library/page.tsx` (server) → `<SavedShelf/>` in a `max-w-5xl` content div.
- `src/components/saved/saved-shelf.tsx` — header + `FILTERS` chip row + body
  (loading / error / empty / grid of `SavedItemCard`). `useSavedItems()` returns `{ items }`.
- `src/components/saved/saved-item-card.tsx` — typed item card: type chip (neutral),
  title + timestamp, per-type launch CTA ("Test full →" / "Develop →") via `handoffsFor`, overflow
  "Remove" w/ Radix AlertDialog confirm.

---

## 4. What to build (all in `src/components/saved/`)

### A. Filter row → real segmented control + counts
- Upgrade the `FILTERS` row to a proper segmented/tab control with a clear active state (not a faint
  pill). Keep `role="tablist"` semantics already present.
- Add a **per-type count** badge (e.g. "Hooks 4"), derived client-side from `data.items`
  (`items.filter(i => i.item_type === f.id).length`). "All" shows total. Counts are presentation —
  no new query.
- Stay flat-warm + neutral (no accent on tabs — dosage rule).

### B. Loading → skeleton grid
- Replace "Loading your library…" with a skeleton grid matching the real card layout
  (1/2/3 cols responsive), using the **branded skeleton pattern from P0**. No bare text, no spinner.

### C. Empty state → designed
- Replace the prose-in-a-box with a designed empty state:
  - The **`Constellation`** motif (extracted in P0) as the visual anchor — calm, on-brand.
  - A primary **CTA button** ("Start a Simulation" → `/home`) so the state is actionable.
  - Proper vertical centering within a sensible min-height (kill the dead space).
  - Keep the existing filtered-vs-unfiltered copy split ("Nothing of this type yet" vs "Nothing in
    your Library yet"); the filtered variant CTA can clear the filter instead.

### D. Card + grid polish
- Audit `SavedItemCard` density/hierarchy against the Reading bar: type chip, title, timestamp,
  launch CTA, overflow. Tighten spacing/typographic scale as needed.
- **Verify the launch CTA is NEUTRAL cream** (`--color-action`), not accent — the card header comment
  still calls it an "accent CTA" (pre-de-Claude). Under the dosage rule, primary actions are neutral;
  accent is liveness-only. Fix if the recolor missed it.
- Grid rhythm: keep `gap-6`, `radius-lg`; confirm it reads as designed cards, not raw boxes.

### E. (Optional, flat-safe) sort + search
- A client-side **sort** (Recent / Type) and/or a **title search** filtering `data.items` in memory.
- Both are presentation-only and DO NOT violate the flat guard (no folders). Add only if it doesn't
  bloat the surface; recent-first sort is the higher-value of the two.

---

## 5. Acceptance criteria (screenshot each)
1. Filter row reads as a real segmented control with visible active state + per-type counts.
2. Loading shows a skeleton grid, not text.
3. Empty state has the constellation + a working CTA, properly centered (no big dead box).
4. Populated grid matches Reading-level card polish; launch CTA is neutral cream.
5. Flat guard intact — no folders/tags/collections introduced.
6. `prefers-reduced-motion`: constellation static.

## 6. Verification gates
- `npm run lint` + typecheck clean.
- `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` green.
- Existing saved/shelf tests green.
- `/design-check` on the diff (dosage, neutral actions, accent≠error, HOLD files untouched).
- Visual proof: before/after of empty + populated + loading.

## 7. Sequencing
- Rebase on `origin/main` before starting and before the PR.
- Commit format `type(library): description` / `type(saved): …`. Small PR.
- Next after this — **only once engine-rework merges + rebase** — the P1 **Audience surface**
  redesign (depends on the new persona/signature shape; do not start earlier).
