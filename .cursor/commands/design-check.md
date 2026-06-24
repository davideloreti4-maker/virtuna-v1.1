# /design-check

Audit the current changes (or the file/surface I name) against the Numen design system.

Read `docs/DESIGN-SYSTEM.md` first, then check the diff for violations:

1. **Tokens only** — no hardcoded hex. Flag any `#FF7F50`, `#07080a`, `#18191a`, `#fff`,
   raw `#d97757`/`#e23b2d`, or any hex that should be a token (`--color-background`,
   `--cream-primary`, `--color-accent`, `--color-action`, …).
2. **Matte, not glass** — no glass gradients, `backdrop-filter` glass, glow, or white inset-shine.
   Flat surfaces + 6% border + (only on floating surfaces) `--shadow-float`.
3. **Cream not white** — text uses `--cream-primary` `#ece7de`, never `#fff`.
4. **Accent = signal red, used SPARINGLY** — `--color-accent` `#e23b2d` (logo mark). Terracotta
   `#d97757` is RETIRED; never coral `#FF7F50`. **Enforce the LOCKED dosage:** accent only on
   liveness signals (live dots, lit constellation node, brand mark, tiny active ticks). FLAG accent
   on primary buttons, icon buttons, skill pills, chevrons, placeholders, link floods, large fills.
5. **Primary actions are neutral** — buttons/send use `--color-action` (cream) + `--color-action-foreground`,
   NOT the accent. Flag any accent-colored primary button.
6. **Accent ≠ error** — `--color-accent` (brand red) must not be used for destructive/error states;
   those use `--color-error`. Flag conflation.
7. **Radius scale** — 4/6/8/12/16/20/24 only (cards 12, inputs/buttons 8).
8. **Type** — Inter for chrome; serif (`--font-serif`) ONLY for voice-moments (greeting/hero).
9. **Ownership** — confirm no edits to `src/lib/**` or `src/app/api/**` (engine track owns those).
10. **Engine-rework HOLD** — confirm no edits to `src/components/audience/calibration-flow.tsx`
    or `src/components/audience/audience-reveal.tsx` (actively rewritten on `rework/engine-core`,
    not yet on main — editing = guaranteed merge conflict).

Then run `npm run lint`. Report each violation as `file:line — issue → fix`. If clean, say so.
