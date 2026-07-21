> ✅ **DONE (2026-07-21)** — all three cards landed on the spine. See
> `docs/HANDOFF-2026-07-21-card-refinements.md`. This doc is kept as the original spec/findings.

# HANDOFF — Rework the read-family cards: Explore · Account Read · Text Read

> **Date:** 2026-07-19 · **From:** the unified-skill-card-system session (PR #334, squash
> `3d1e098b`) · **For:** a fresh session. Owner directive, verbatim intent: *"rework the ui
> design for explore, account read and test/read cards — they still have old content and old ui
> compared to the other skill cards."*

## 0. Mission

Bring the last three drifted result cards up to the current card language:

| Card | Block / renderer | Why it's behind |
|---|---|---|
| **Explore** | `outlier-grid` → `outlier-grid-block.tsx` + `SkillResultCard` + the `OutlierTile` under `components/discover/**` | Three cream primaries in one card (one per tile), band color used as a full bar fill, tile CTA label "Remix → Read" is two verbs in one button |
| **Account Read** | `account-read-block.tsx` | No hero — opens on the creator's *name*; WHAT'S WORKING / WHAT TO FIX are **colored** section labels (green/amber on the label itself, not a dot+word) |
| **Text Read** | `multi-audience-read-block.tsx` | "THE ROOM" is a box-within-the-card (the exact nesting #327/#329 removed everywhere else); band color applied twice (amber dot + amber "Mixed Read." lead-in); provenance sits as a bare footer line ("SIM-1 Flash · static") instead of demoted onto a disclosure |

**NOT in scope:** `video-test-card` (built 2026-07-18 on the primitives — it IS the current
language), the `/analyze` Reading page (own surface, separately audited §0.7), the hidden
GSI cards (profile/simulate/predict — `HORIZONTAL_ENABLED` off).

## 1. The bar you are matching

- **The contract:** `docs/subsystems/ui-skill-cards.md` **§0.5** (the spine: eyebrow → hero →
  receipt → why-teaser → proof → ONE disclosure → ONE action bar), **§0.5b** (honesty — Explore
  stays measured-only, no SIM band/quote), **§0.8** (the run capsule), **§0.9** (primitives).
- **The look:** hook card (`hook-card-block.tsx`) + the Variant-A "quiet" language from
  #327/#329 — **one focal frame per card**, everything else borderless rows/hairlines, reach
  cream, band color once (dot + word), near-zero accent.
- **The primitives (mandatory):** `CardEyebrow` / `CardPrimaryAction` (has `href`) /
  `CardActionBar` / `SECTION_LABEL` from `card-primitives.tsx`; notices from `run-notices.tsx`.
  Never hand-roll a cream button, label stack, or radius (`radius-scale.test.ts` is tokens-only).

## 2. Per-card findings (from the 2026-07-19 screenshot audit — verify live first)

### Explore (`#explore` on /dev/cards)
- Header (`SkillResultCard`) is fine: EXPLORE eyebrow · "3 outliers, scored for your audience"
  hero · audience meta.
- **Per-tile "Remix → Read" cream primary ×3** — §0.5.7 says ONE cream primary per card. Owner
  call on the fix shape: one primary per *tile* may be acceptable for a grid (tiles are
  quasi-cards), but the label is two actions fused; prior art says pick the forward chain step
  ("Remix this →"?) and demote the rest. **Ask/lock before rolling.**
- **`FIT · STRONG` bar is band-color-filled edge to edge** — the shared `Band`/proof language is
  a dot + the word, magnitude bars stay neutral cream (`ProofUnit` ribbon precedent).
- "+ Track account" text link + Save sit ABOVE the primary (stacking §0.6 flagged).
- Honesty is right — measured data only. Keep it that way (no fabricated SIM proof on tiles).

### Account Read (`#account`)
- #324 already fixed the worst (real scrape header, covers, track record). Remaining:
- **No hero sentence** (§0.5.2): the payoff — the one-line read of the account — never appears;
  the card opens on the profile row. This was explicitly deferred as an OWNER CALL in §0.6.
  Propose hero candidates from real fields before building.
- **Colored section labels**: `WHAT'S WORKING` (green) / `WHAT TO FIX` (amber) put data tones on
  LABELS. The system's rule: labels are muted `SECTION_LABEL`; color belongs to data marks
  (dots/values). Also decide whether two-column working/fix survives the quiet pass on mobile.
- Forward action `Write to my strengths →` exists and uses the primitive ✓.

### Text Read (`#multi-audience-read` + `#multi-audience-read--single`)
- **De-box "THE ROOM"**: the verbatim wall lives in a nested bordered box — apply the
  `ProofUnit framed={false}` / hairline-rows treatment (see Script beats in #329; vendored
  `AccordionItem` gotcha: needs `rounded-none border-0` to de-box, per memory).
- **Band color once**: amber dot + "General 5/10 stop" is right; the amber **"Mixed Read."**
  lead-in on the next line is the second application — the interpretation sentence should be
  cream with the band word already colored above.
- **Provenance**: footer "SIM-1 Flash · static" → demote onto the disclosure line
  (`· SIM-1 Flash`, §0.5.6). The "Audience reactions 4/6 stop · Show" row IS the disclosure —
  fold provenance there; one disclosure only.
- STOPPED THE SCROLL / SCROLLED PAST labels: green data tone on a label again — same rule as
  Account. The Lever row + who-not-for + orphaned-pin honesty line are correct — do not lose
  them (§0.5b).
- Note: this card is STATIC (P9 boundary) — no live Lens; don't add "See the room →" affordances
  that can't open anything.

## 3. Process that worked (repeat it)

1. **LOOK first**: dev server + `/dev/cards` (`#explore`, `#account`, `#multi-audience-read`,
   `#multi-audience-read--single`) — screenshots desktop 1440 + mobile 390 BEFORE touching code.
2. **Calibrate on ONE card** (the worst: Text Read), get the owner to lock the direction
   (ASCII variants or a throwaway `/dev/…` route — the #327 pattern), THEN roll the language to
   the other two.
3. Fail-first guards where behavior changes; run affected suites per commit.
4. Verify every degraded state (empty/partial fixtures on /dev/cards), not just the healthy one.

## 4. Tooling + gotchas (all live-verified today)

- **Dev server:** `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev -p 3000 --turbopack`,
  detached via the Python `fork+setsid` trick (plain background gets SIGKILLed by later
  commands — see memory `dev-server-launch`). After branch switches: kill + `rm -rf .next` +
  restart (NEVER `rm -rf .next` under a running server — it 500s on its own manifests).
- **Screenshots:** `.scratch/shoot.mjs` (this worktree) — logs in as `e2e-test@virtuna.local` /
  `e2e-test-password-2026`, shoots `/dev/cards` per **section id**. ⚠️ the page body does NOT
  scroll (AppShell owns an inner scroll container) — the harness already handles it
  (per-section viewport + `scrollIntoView` on the element + viewport-relative clip). Env:
  `SECTIONS=a,b,c MOBILE=a,b node .scratch/shoot.mjs`.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run` (NEVER `npm test` — rtk shim prints
  fake results). tsc via `npx tsc --noEmit`.
- **Stale worktree deps:** if an unrelated test fails on a missing module, `pnpm install` —
  this worktree missed deps merged by other lanes (hit today with `@gltf-transform`).
- **⚠️ Tailwind v4 scans TEST COMMENTS:** a class-shaped wildcard literal in any source file
  (comments included) compiles into invalid CSS and 500s EVERY route while tests stay green.
  After adding class-like strings anywhere, `curl localhost:3000/login` once.
- **Guards that will catch you:** `radius-scale.test.ts` (tokens-only), section-label guard
  (`11px/0.05em` only), `reskin-matte` (no legacy coral/glass).

## 5. State of the world (post-#334)

- Main tip at handoff: `3d1e098b` (#334 unified system) on top of `df47eb77` (#336 grounding
  tool-loop spike, another session).
- The RUN side is done — every wait (agent dispatch, composer, fields) renders the run capsule
  (`run-capsule.tsx`, `SKILL_RUN_META`). This handoff is about the RESULT side of the last 3.
- Worktree `~/virtuna-explore-c` hosts this lane; cut the new branch off fresh `origin/main`
  (e.g. `design/read-family-cards`).
- Memory: `skill-card-run-capsule` (this system) · `reading-redesign-2026-07-18` +
  `card-polish-sweep-make-2026-07-18` (the locked quiet language + how it was calibrated) ·
  `thread-cards-polish-2026-07-18` (the drafts pass that touched these 3 last).
