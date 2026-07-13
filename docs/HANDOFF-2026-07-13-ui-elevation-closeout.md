# Handoff — UI elevation closeout (Calendar · Discover · Audience · Library)

**Date:** 2026-07-13  
**From:** Cursor session (continued Claude Code audit → P0–P1)  
**Worktree:** `~/virtuna-explore-b`  
**Audit SoT:** [`docs/audit-2026-07-13/AUDIT-calendar-discover-audience-library.md`](./audit-2026-07-13/AUDIT-calendar-discover-audience-library.md)  
**Prior handoff (stale mid-P1):** [`docs/HANDOFF-2026-07-13-ui-p1-p2-cursor.md`](./HANDOFF-2026-07-13-ui-p1-p2-cursor.md) — superseded by this file for status.

---

## Mission (unchanged)

Elevate four surfaces from “AI-produced” to production polish. Disease: the app **narrates itself**, **repeats copy**, and **leaks taxonomy**. Cure: **subtraction + hierarchy**.

---

## Git state (as of this closeout)

| Item | Status |
|---|---|
| `origin/main` tip | includes merges **#273 → #274 → #275 → #276** |
| P0 copy hygiene | **MERGED** [#273](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/273) |
| P1 calendar grid | **MERGED** [#274](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/274) (+ `lead.length` TS fix for Vercel) |
| P1 Discover toolbar | **MERGED** [#275](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/275) |
| P1 Library cards | **MERGED** [#276](https://github.com/davideloreti4-maker/virtuna-v1.1/pull/276) |

All four audit surfaces’ **objective P0 + unblocked P1** work is on `main`. Stop here before Audience sketches.

---

## DONE

### P0 — copy & bug hygiene (#273)
- Stripped marketing / instructional subtitles across Calendar, Discover, Audience, Library, Account analytics.
- De-duplicated “trend builds daily” / reassurance copy on Account.
- Calendar: “tap to place” → hover-reveal; legend cleaned.
- **D1** Library `7/10 stop stopped` → `7/10 stopped` (`fracNM()`).
- **D2** Audience Account tab H1 follows the tab.

### P1 — Calendar grid (#274)
- In-month cells: visible 6% border + faint fill; weekend rhythm; today ringed in `--color-action`.
- Follow-up fix: weekend math uses `lead.length` (not the `lead` array) — unblocked Vercel build.

### P1 — Discover toolbar + metrics (#275)
- Filters / Sort lead; Add video URL + Export in `⋯` overflow.
- Toolbar legend: `× baseline · views · engagement`.
- Cards: outlier × weighted as hero; views/engagement `title` + `aria-label`.

### P1 — Library card anatomy (#276)
- ALL-CAPS eyebrow = **content type only** (Hook / Idea / Script / Read / Outlier / Format).
- Audience segment / “Opener only” → muted secondary tag.
- Proof quotes: present-or-omit (same position).
- Card + list-row CTAs share one visual treatment.

---

## REMAINING (do not start without owner sign-off)

### P1 · Audience — avatars + pills *(BLOCKED)*
Files: `src/components/audience/audience-card.tsx`, `audience-status-chip.tsx`, `audience-manager.tsx`, trust badges.

- Placeholder dot-avatars → designed persona mark (sketch 2–3 HTML mockups first).
- Collapse 6-term pill vocabulary to ≤2 meanings (owner mapping).
- Fold 4 section headers → 2.

**Also GSI HOLD:** do **not** fork-edit `src/components/audience/**` in explore lanes — wait for GSI phase on `main`, or hand the brief into the GSI session.

### P2 · System-level *(design direction required)*
1. One vocabulary: audience / room / persona / panel — pick one, purge synonyms.
2. Right-rail IA — stop duplicating modules (e.g. Content pillars on Calendar + Account).
3. Density/contrast token pass in `globals.css` (`lane/polish` owns token definitions).

### Optional / low priority
- Library masonry → uniform card height / cleaner grid (deferred from #276).

---

## Next session (when ready)

1. Audience **sketch only** (throwaway HTML) — no production edits.
2. Owner picks avatar + pill mapping.
3. Build only after GSI HOLD clears **or** via the GSI milestone branch.

---

## How to run & verify

```bash
# from ~/virtuna-explore-b
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002
npx tsx e2e/create-test-user.ts
# login: e2e-test@virtuna.local / e2e-test-password-2026
# routes: /calendar · /feed · /audience · /library
```

Green-gates:

```bash
npx tsc --noEmit
npx eslint <changed files>
node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts
```

Do **not** use `npm test` / `npx vitest` shims.

---

## Design system reminders

- SoT: `src/app/globals.css` + `docs/DESIGN-SYSTEM.md` (ignore stale Raycast docs).
- Flat-warm charcoal, cream text (never `#fff`), terracotta accent near-zero dosage.
- Matte only; primary actions use `--color-action`, not accent.
