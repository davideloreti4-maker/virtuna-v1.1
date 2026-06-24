# Handoff — UI Restrained Rebrand (de-Claude)

> **Worktree:** `~/virtuna-ui-restrained` · **branch:** `design/ui-restrained` (off `main`) · **tool:** Cursor
> **You are:** the planning agent. Produce a phased plan, then (on approval) execute surface-by-surface.
> **Read first, in order:** this file → `docs/DESIGN-SYSTEM.md` ("Accent dosage (LOCKED)") →
> `.cursor/rules/ui-design.mdc` → `docs/UI-SURFACES.md` → the sketches in `.planning/sketches/`
> (`composer-numen-restrained.html` is the locked direction).

## 1. Mission (one line)
Strip the app back to a **monochrome cream-on-charcoal** system where the brand accent (signal red
`#e23b2d`) appears **really sparingly, if at all** — and let identity come from the **constellation/SIM
motif + serif voice + copy + layout**, not color. This removes the "we look like Claude" problem at the
root (Claude floods its terracotta; we starve ours).

## 2. The single most important framing — READ THIS
`--color-accent` has already been repointed from terracotta to **signal red `#e23b2d`** in
`globals.css`. **That means ~203 files that reference the accent token now render RED.** The app is
currently in an interim "red flood" state.

**Your job is NOT to recolor. It is to REMOVE.** Walk the surfaces and pull accent OUT of almost
everything — buttons, chrome, charts, badges, tabs, links, hovers — replacing with neutral cream /
muted, until each screen is monochrome and accent survives only where it carries genuine meaning (and
often nowhere). Think *subtraction*.

## 3. Locked decisions — do NOT relitigate
These are settled (see `docs/DESIGN-SYSTEM.md`). Plan within them; don't reopen:
1. **Monochrome by default.** Zero-accent screens are the norm. Every accent use must be justified;
   aim for ≤1 accent element per view, frequently zero.
2. **Hue = signal red `#e23b2d`** (the logo mark). Terracotta is retired. Don't propose other hues.
3. **Primary actions are neutral cream** — `--color-action` / `--color-action-foreground`. The composer
   send button is a cream button with a dark glyph, NOT accent.
4. **Accent = "alive" only (RESOLVED).** Red has exactly two homes: the live presence / lit
   constellation node (dynamic liveness signal — same idea, one per view) and the brand mark / logo
   (static). If an element is not signaling liveness, it is neutral. Selection/active/focus → neutral.
5. **accent red ≠ error red.** `--color-error` stays for destructive/error only. Never conflate.
6. **Emphasis without color:** weight, *italic* serif voice-moments, size, spacing.
7. **Matte only** (unchanged): no glass, no glow, no inset-shine. Keep `reskin-matte.test.ts` green.

## 4. Tokens you'll use (already in `globals.css`)
- `--color-action` (cream) / `--color-action-foreground` (dark) → primary buttons, send
- `--color-accent` (`#e23b2d`) → solid fill, the rare liveness dot / lit node ONLY
- `--color-accent-text` (`#ef6e62`) → accent as text/icon on dark (rare)
- `--color-accent-soft` → soft tint bg for a sanctioned accent moment (rare)
- `--color-accent-foreground` (cream) → glyph on a solid-red fill
- Neutrals: `--cream-primary/-secondary/-muted`, `--charcoal-app/-sidebar/-composer/-chip`, borders 6%/10%
- **Never** hardcode hex in components. No `#d97757`, `#e23b2d`, `#FF7F50`, `#fff`, `#07080a`.

## 5. Highest-leverage strategy (plan around this)
1. **Fix the shared primitives FIRST** — `src/components/ui/*` (esp. `button.tsx`, `badge.tsx`,
   `select.tsx`, `input.tsx`, `dropdown-menu.tsx`, `toggle.tsx`, `command.tsx`) and the composer send.
   Most of the 203 files inherit color through these. Neutralizing the primitives cascades and shrinks
   the per-surface work dramatically. Measure the red-flood before/after here.
2. **Then sweep live surfaces** (see §6) top-down through the core loop.
3. **Then chrome/marketing/onboarding.**
4. **Then delete/neutralize dead code** (don't restyle things that aren't shipped — see §6 caveat).

## 6. Scope map — VERIFY live-vs-dead before planning
The 203 hits span both live and likely-dormant areas. **Do not assume — confirm what actually ships**
(check routing, imports, and with the human) before spending effort:
- **LIVE core loop (priority):** `app/home/` (composer, greeting, chips), `audience-lens/`
  (presence/AudienceLens — flagship), `thread/` (skill cards + thread views), `reading/` (the Read
  panels), `sidebar/`, `ui/` primitives.
- **Likely dormant / verify before touching:** `components/board/**` (old canvas board — superseded by
  `reading/`?), `components/primitives/Glass*` (the RETIRED glass system — candidates for deletion, not
  restyle), `app/(marketing)/showcase/**` (component gallery), parts of `competitors/`, `lib/engine/_dormant/**`.
  If dead → propose removal or leave untouched; do NOT invest restyle effort.
- **Identity build (likely net-new):** confirm whether the **constellation/SIM mark** exists as a real
  component or needs building (`audience-lens/audience-presence.tsx` is the place to look). The locked
  direction leans HARD on this motif — it may be the one place to ADD, while everything else subtracts.

## 7. Guardrails (hard constraints)
- **Lane:** you own `src/components/**`, page styling in `src/app/(app)/**` (non-api), `globals.css`,
  design tokens. ⛔ Do NOT touch `src/lib/**`, `src/app/api/**`, `supabase/**` (engine track).
- **⛔ Engine-rework HOLD — do not edit (guaranteed conflict):**
  `src/components/audience/calibration-flow.tsx` and `src/components/audience/audience-reveal.tsx`
  (actively rewritten on `rework/engine-core`, not yet merged). Everything else is conflict-free.
- **Coupled surfaces** (composer, AudienceLens, thread cards): restyle/relayout OK, but do NOT change
  props/data contracts or block schemas — those are engine-owned.
- **Rebase** on `origin/main` before starting and again before each PR (catch the engine merge).
- Keep PRs **small + per-surface**. Commit format `type(surface): description`.

## 8. Suggested phase order (free → coupled → cleanup)
1. **P1 Primitives + tokens** — neutralize `ui/*`, composer send → `--color-action`. Cascade check.
2. **P2 Composer + home** — `app/home/*` (send neutral, chips/skill-pill/chevrons neutral, placeholder muted).
3. **P3 Audience presence + AudienceLens** — the ONE place accent may live (single live dot / lit node);
   amplify the constellation motif. Visual-only, contracts untouched.
4. **P4 Thread + reading** — card faces, panels, chat → monochrome; remove accent from badges/bars.
5. **P5 Sidebar + global chrome.**
6. **P6 Marketing / onboarding / settings.**
7. **P7 Dead-code pass** — delete/neutralize `primitives/Glass*` + any confirmed-dormant board surfaces.
- For each surface, capture intent + before/after in `docs/subsystems/ui-<surface>.md`.

## 9. Verification (per surface, before "done")
- `npm run lint` + typecheck clean.
- `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` green.
- Run `/design-check` on the diff (audits dosage, neutral actions, accent≠error, HOLD files).
- **Visual proof** — screenshot the surface in the browser. Don't say "should work."
- Sanity: count visible accent elements on each screen — target 0–1.

## 10. First moves (first session)
1. Confirm worktree/branch: `git -C ~/virtuna-ui-restrained status` (expect `design/ui-restrained`).
2. `npm run dev`, screenshot the current **red-flood** state of the core loop (composer/home, a reading)
   — this is your "before" and proves the scale of the subtraction.
3. Read the 4 SoT docs + the `composer-numen-restrained.html` sketch (the target look).
4. Inventory live-vs-dead (§6) and the accent cascade through `ui/*`.
5. Draft the phased plan (§8) with concrete file lists; surface open questions (§11) to the human.

## 11. Open questions for the human (resolve before deep execution)
- **Serif swap:** keep Newsreader or move `--font-serif` → Fraunces? (Needs `next/font` wiring in root
  layout; currently Newsreader.) Affects voice-moments only.
- **Constellation motif:** how far to amplify, and where it appears (audience id only, or also loading /
  empty / brand mark)? Does a real component exist or is it net-new?
- ~~Truly zero, or one dot?~~ **RESOLVED: keep the single live presence dot.** Accent = "alive" only —
  the live/lit node + the logo mark are red; everything else neutral.
- **Dead code:** confirm `board/**` and `primitives/Glass*` are dormant → delete vs leave.

---
**State at handoff:** token system + neutral action token + LOCKED near-zero dosage rule landed
(`globals.css`, `docs/DESIGN-SYSTEM.md`, `.cursor/rules/ui-design.mdc`, `.cursor/commands/design-check.md`,
`docs/UI-SURFACES.md`). Matte guard green. Deps installed. Branch on origin. Prior `design/ui-system`
batch merged to main. The per-component subtraction is the work that starts here.
