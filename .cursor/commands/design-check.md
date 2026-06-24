# /design-check

Audit the current changes (or the file/surface I name) against the Numen design system.

Read `docs/DESIGN-SYSTEM.md` first, then check the diff for violations:

1. **Tokens only** — no hardcoded hex. Flag any `#FF7F50`, `#07080a`, `#18191a`, `#fff`,
   or raw hex that should be a token (`--color-background`, `--cream-primary`, `--color-accent`, …).
2. **Matte, not glass** — no glass gradients, `backdrop-filter` glass, glow, or white inset-shine.
   Flat surfaces + 6% border + (only on floating surfaces) `--shadow-float`.
3. **Cream not white** — text uses `--cream-primary` `#ece7de`, never `#fff`.
4. **Terracotta accent** — `--color-accent` `#d97757`, never coral `#FF7F50`.
5. **Radius scale** — 4/6/8/12/16/20/24 only (cards 12, inputs/buttons 8).
6. **Type** — Inter for chrome; Newsreader serif ONLY for voice-moments (greeting/hero).
7. **Ownership** — confirm no edits to `src/lib/**` or `src/app/api/**` (engine track owns those).

Then run `npm run lint`. Report each violation as `file:line — issue → fix`. If clean, say so.
