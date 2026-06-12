# Phase 3: Honesty Moat, Gallery, Proof & Conversion - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the four remaining MVP section slots already scaffolded (heading-only) in
`src/app/(marketing)/page.tsx` — `#honesty`, `#gallery`, `#proof`, `#cta` — to
make the page **earn belief and convert**:

- **#honesty (TRUST-01/02):** an anti-snake-oil trust section that contrasts
  Numen's calibrated honest verdict against the "virality-score" tier via a
  kero-style 2-column comparison move — zero "X% accuracy" claims page-wide.
- **#gallery (GALLERY-01/02):** a luma-style gallery of real Readings across ≥3
  distinct creator niches, each a gallery-quality content centerpiece (not a
  feature diagram).
- **#proof (PROOF-01/02):** a social-proof block — primarily a **live waitlist
  count** — with credibility also anchored **early** on the page.
- **#cta (CTA-02):** the conversion section (repeated near the footer) with a
  **real waitlist email capture that records the signup** to Supabase.
- **Positioning copy (CONTENT-02):** reads "an honest verdict creators can
  believe," explicitly not hype, in the inherited confident-mentor voice.

Reuses the Phase 2 verdict language (`VerdictThrone` / `VerdictSwatch`) wherever
a verdict is shown, on the `.numen-surface` **placeholder** tokens.

**In scope (Phase 3):** the four conviction/conversion sections above; the new
`waitlist` Supabase table + insert path + server action; the live-count read;
positioning copy; gallery built structurally complete on real-shaped placeholder
stills.

**Out of scope (later phases):** final `.numen-surface` token swap (D-L3 /
Phase 4); scroll-driven reveal choreography (MOT-01 / Phase 4); LCP/OG/a11y
launch polish (PERF-01/03 / Phase 4); the **final rights-cleared ≥3-niche
gallery asset set + real testimonial quotes** (D-L4 — finalize at Phase 4 /
launch); use-cases/personas section (§4.5 — post-MVP, not a requirement); app
deep-linking / app auth flows (landing is pre-launch credibility + waitlist).

Covers requirements: **TRUST-01, TRUST-02, GALLERY-01, GALLERY-02, PROOF-01,
PROOF-02, CONTENT-02, CTA-02**.
</domain>

<decisions>
## Implementation Decisions

### Conversion CTA + waitlist capture (CTA-02)
- **D-01:** The conversion CTA is a **real email waitlist form that records the
  signup to Supabase** — NOT a link-out to the app. CTA-02 explicitly requires
  "records the signup"; a pure link records nothing at the landing and assumes
  app reachability (rejected, consistent with Phase 2 D-07). Supabase infra
  already exists in-repo and is reachable via anon key even though the landing
  may deploy separately.
- **D-02:** Implementation is **minimal**: a single `email` field → a Next.js
  **server action** (mirror the existing `src/app/(onboarding)/signup/actions.ts`
  pattern using `createClient` from `@/lib/supabase/server`) → insert into a
  **net-new `waitlist` table**. The `waitlist` table does NOT exist yet — a new
  migration + RLS (insert-only for anon, no public select of rows) +
  `database.types.ts` regen are required. Columns: `email` (unique),
  `created_at`, `source` (e.g. "landing-hero" vs "landing-footer-cta" to attribute
  which CTA converted). Include a honeypot + basic email validation; graceful
  duplicate-email handling (treat as success, don't leak existence). No auth, no
  confirmation email this phase (defer double-opt-in).
- **D-03:** The CTA section is **repeated near the footer** (the `#cta` slot) and
  the Phase 2 hero CTA already scroll-anchors to `#cta` — both entry points feed
  the same waitlist (distinguished by `source`).

### TRUST comparison move (TRUST-01/02)
- **D-04:** A **kero-style 2-column comparison**: Numen (calibrated band + one-line
  why) vs an **unnamed generic "virality-score tools" tier**. Do **NOT** name real
  rivals (Viralocity/quso/Virality Cortex/etc.) — naming invites
  disparagement/legal exposure and dates the page; the moat is the *posture*, not
  a hit list.
- **D-05:** The rival column may surface the **fake-precision pattern** ("95%
  accuracy!", "viral score") as exactly the thing Numen rejects — this is the one
  place "% accuracy" / "virality score" strings appear, used to *label the rival
  category being rejected*, never as a Numen claim. Numen's column stays VOICE-clean
  (band + why, never a number). Keep it a tasteful contrast, not a teardown.

### Gallery content sourcing (GALLERY-01/02)
- **D-06:** Build the gallery **structurally complete now** against **real-shaped
  placeholder stills** across ≥3 niches; the **final rights-cleared ≥3-niche asset
  set is deferred to Phase 4 / launch (D-L4)**. Ship-first per LANDING-STRUCTURE §6
  + the Phase 2 placeholder precedent — structure/layout/copy is token-independent
  and must not block on content sourcing.
- **D-07:** Placeholder stills are sourced by **extracting keyframes from short
  videos the user supplies** (same pipeline as the Phase 2 comedy-skit keyframe:
  ffmpeg frame extract → cwebp). Reuse the existing
  `public/images/landing/hero/keyframe.webp` as one niche; ask the user for ~2 more
  short videos during the phase. If none are supplied, proceed with the available
  still(s) varied across cards — supplying real distinct-niche stills is a
  **non-blocking** in-phase checkpoint, NOT a gate. Each card = real still + real-
  shaped band + one-line why (reuse `VerdictThrone`/`VerdictSwatch`), luma staging
  (content dominates, whitespace, NOT a feature diagram).

### Social proof (PROOF-01/02)
- **D-08:** **Live waitlist count is the primary proof** (read from the D-02
  `waitlist` table). Real creator testimonials almost certainly don't exist
  pre-launch and **fabricating them violates the honesty moat** — so testimonial
  cards are **built as a component but placeholder-ready**, populated only when
  real quotes exist (D-L4 / launch).
- **D-09 (honesty guard):** Show the waitlist **number only above a sensible
  threshold**; if the count is tiny/zero, show a **qualitative anchor** instead —
  never "0 creators". The threshold + count copy register is Claude's discretion
  but MUST obey VOICE (no fake precision, no inflated promise).
- **D-10 (placement, PROOF-02):** Credibility is **anchored early** via a thin
  strip (waitlist count + optional niche tags) near the top of the page (just under
  the hero / around `#how-it-works`), with the **fuller proof block in the `#proof`
  slot** lower down. Two surfaces, one source.

### Positioning copy (CONTENT-02)
- **D-11:** Positioning copy reads **"an honest verdict creators can believe,"
  explicitly not hype**, in the inherited confident-mentor voice. Every heading/
  subhead/button/microcopy across all four sections passes VOICE self-check
  (Rules 1–3, do/don't words). "honest verdict" not "viral score"; second person.

### Carried forward (locked earlier — do NOT re-decide)
- **Tokens/primitives:** consume `.numen-surface` token layer + `numen/` primitives;
  **never fork/reinvent tokens** (DS-01 / D-09). Tokens are placeholders; final swap
  is Phase 4 (D-L3). Build on placeholders now.
- **Verdict contract:** any verdict shown reuses `VerdictThrone` (Phase 2,
  plate-backed per APCA gate) / `VerdictSwatch` — band + why, never a naked number
  (VOICE Rule 3). No `bg-${verdict}` interpolation (literal classes only).
- **Motion:** `StageBlock` / `numen-ease-calm` is THE motion language;
  reduced-motion = static opacity appear, no translate. Scroll-reveal choreography
  is Phase 4 (MOT-01) — do NOT add it here; no bouncy/presence theater.
- **Single h1:** the hero owns the only h1; each Phase 3 slot passes `heading=`
  → its own h2 (slots already do this in `page.tsx`).
- **Voice:** every word obeys `.planning/VOICE.md` — zero engine jargon (Rule 1),
  zero hype/fake precision/"% accuracy" as a Numen claim (Rule 2), verdict = band +
  why never a number (Rule 3).

### Claude's Discretion
- Component file split under `src/components/numen-landing/` (e.g.
  `honesty-comparison.tsx`, `reading-gallery.tsx`, `social-proof.tsx`,
  `waitlist-form.tsx`, `cta-section.tsx`) + any shared count/card subcomponents.
- The exact `waitlist` table schema beyond the D-02 columns (indexes, constraints),
  the RLS policy shape, and where the live count is read (server component vs cached).
- The waitlist-count display threshold (D-09) + the qualitative-anchor copy.
- Comparison-table row contents (which dimensions Numen-vs-rivals contrasts) and
  whether it's a true `<table>` or a 2-column grid — must stay accessible + VOICE-clean.
- Gallery layout (grid vs masonry vs row), card count beyond 3, niche labels.
- Exact positioning/section copy (must pass VOICE).
- Spam/abuse hardening depth on the form (honeypot is the floor; rate-limit optional).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Landing spec, voice & structure (this milestone)
- `.planning/LANDING-STRUCTURE.md` — base spec: locked reference set (kero
  comparison-table move §4.3, luma gallery §4.4, anti-snake-oil rivals §1), design
  discipline (§2 — specificity over claims, anti-snake-oil posture), positioning
  spine (§3), section wireframe (§4 — slots 3/4/6/7 = this phase), open decisions
  (§5 — **D-L4 credibility assets** lands here, partially deferred to Phase 4).
- `.planning/VOICE.md` — **canonical voice SSOT**; Rules 1–3 + do/don't words bind
  every heading/subhead/button/microcopy/alt across all four sections. The
  comparison-rival column is the ONLY sanctioned place "% accuracy"/"virality score"
  strings appear (labeling the rejected category, D-05).
- `.planning/REQUIREMENTS.md` — Phase 3 owns TRUST-01/02, GALLERY-01/02, PROOF-01/02,
  CONTENT-02, CTA-02.
- `.planning/ROADMAP.md` §"Phase 3" — goal + 5 success criteria.

### Phase 1 + 2 outputs (the shell + verdict language this phase reuses)
- `.planning/phases/02-hero-centerpiece-reading-explainer/02-CONTEXT.md` — D-03/D-04
  verdict throne contract, D-07 (hero CTA scroll-anchors to `#cta`, live capture is
  this phase), placeholder-asset precedent.
- `src/app/(marketing)/page.tsx` — the seven ordered slots; `#honesty` / `#gallery`
  / `#proof` / `#cta` are heading-only and to be filled this phase.
- `src/components/numen-landing/section-shell.tsx` — slot wrapper; non-hero slots
  pass `heading=` → their own h2.
- `src/components/numen-landing/verdict-throne.tsx` — the Phase 2 verdict component
  (plate-backed per APCA gate) to reuse in gallery cards.

### Design system primitives (consume — never fork; DS-01)
- `src/components/numen/verdict-swatch.tsx` — `VerdictSwatch` (good/mixed/bad peer
  bands, APCA Lc ≥ 60 on-swatch). Gallery can show a RANGE of verdicts (mixed/bad
  too — the deferred "rotating multi-niche verdicts" idea from Phase 2 lands here).
- `src/components/numen/stage-reveal.tsx` — `StageBlock` ({show, children}); reuse
  for any reveal; reduced-motion safe. No new scroll choreography (Phase 4).
- `src/components/numen/{pill-chip,surface,glass,icon-button}.tsx` — supporting
  primitives (e.g. `Surface` for cards, `PillChip` for niche tags).
- `src/app/globals.css` `.numen-surface` scope — placeholder tokens + verdict band
  colors + `--numen-ease-calm` + Tailwind bridge.

### Waitlist / Supabase capture (CTA-02 — net-new this phase)
- `src/app/(onboarding)/signup/actions.ts` — **server-action pattern to mirror**:
  `"use server"`, `createClient` from `@/lib/supabase/server`, FormData handling,
  error mapping.
- `src/lib/supabase/server.ts` — the server Supabase client factory the action uses.
- `src/types/database.types.ts` — generated DB types; **must be regenerated** after
  the `waitlist` migration adds the table.
- `supabase/migrations/` — where the net-new `waitlist` table migration goes (no
  waitlist migration exists yet).
- `.env.example` / `.env.local.example` — Supabase env keys; the landing deploy must
  have `NEXT_PUBLIC_SUPABASE_URL` + anon key configured (flag for research/launch).

### Asset pipeline (gallery placeholders — D-07)
- `public/images/landing/hero/keyframe.webp` — the Phase 2 real comedy-skit still;
  reuse as one gallery niche. New stills extract via ffmpeg → cwebp into
  `public/images/landing/gallery/` (path = planner choice).

### Authoritative brand (cross-worktree — coherence, not forking)
- `BRAND-BIBLE.md` (repo root) — brand/design reference.
- `~/virtuna-numen-surface/.planning/NUMEN-SURFACE-VISION.md` — authoritative brand vision.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VerdictThrone` (`numen-landing/verdict-throne.tsx`) + `VerdictSwatch`
  (`numen/verdict-swatch.tsx`): the verdict language for gallery cards (good/mixed/
  bad bands let the gallery show a real RANGE across niches — honesty by breadth).
- `Surface` (`numen/surface.tsx`): the opaque plate for cards (gallery, testimonial,
  comparison) — APCA-safe backing (same reason the verdict throne is plate-backed).
- `SectionShell` (`numen-landing/section-shell.tsx`): the four target slots already
  mounted with headings in `page.tsx`.
- `signup/actions.ts` + `@/lib/supabase/server`: the exact server-action + Supabase
  client pattern the waitlist action mirrors.
- `StageBlock` (`numen/stage-reveal.tsx`): reduced-motion-safe reveal primitive.

### Established Patterns
- Single-h1 page: each non-hero slot passes `heading=` → its own h2 (slots already
  do this). New section components render BELOW the slot's h2.
- Tailwind v4 CSS-first; verdict classes are LITERAL strings (never `bg-${verdict}`).
- `tailwind-variants` (`tv`) for component variants.
- Server actions for mutations (`"use server"` + Supabase server client), not API
  routes, for the form submit.

### Integration Points
- Fill `#honesty`, `#gallery`, `#proof`, `#cta` in `src/app/(marketing)/page.tsx`.
- New components under `src/components/numen-landing/` (net-new).
- New `waitlist` table via `supabase/migrations/` + RLS + `database.types.ts` regen.
- Waitlist server action under the `(marketing)` route group; live count read in a
  server component.
- Gallery stills → `public/images/landing/gallery/` (path = planner choice).

### Known constraints (CLAUDE.md)
- Lightning CSS strips `backdrop-filter` → apply via React inline `style` (avoid
  glass-over-photo; use opaque `Surface` plates — same as Phase 2).
- Tailwind v4 oklch inaccuracy for very dark colors (L < 0.15) → dark tokens use hex.
- Dev-server CSS caching: kill dev server + clear `.next/` when CSS changes don't appear.
- Supabase RLS: the anon insert policy must allow waitlist INSERT but NOT public
  SELECT of rows (count read via an aggregate/policy-safe path).

</code_context>

<specifics>
## Specific Ideas

- The honesty moat is the **positioning moat baked into voice** (Rule 2) AND made
  **explicit** in the `#honesty` comparison this phase — the one section where the
  rival "virality score / 95% accuracy" pattern is shown, to be rejected.
- Gallery shows a **range of verdicts across niches** (not all "good") — this is the
  honest-breadth proof and absorbs Phase 2's deferred "rotating multi-niche verdicts"
  idea. Specificity = depth (luma).
- Waitlist count is **honest by construction** (D-09 threshold guard) — the proof
  must never lie any more than the product does.
- Both CTAs (hero scroll-anchor + footer) feed ONE waitlist, attributed by `source`.

</specifics>

<deferred>
## Deferred Ideas

- **Final rights-cleared ≥3-niche gallery asset set + real testimonial quotes**
  (D-L4) → **Phase 4 / launch**. Gallery + testimonial components ship structurally
  complete on placeholders this phase.
- **Double opt-in / confirmation email** on the waitlist → post-MVP (D-02 ships
  single-step insert only).
- **Use cases / personas section** (LANDING-STRUCTURE §4.5) → post-MVP, not a v1
  requirement.
- **Named-rival comparison** → rejected (legal/positioning); generic tier only (D-04).
- **App deep-linking / app entry routing** → not this milestone (landing is pre-launch
  credibility + waitlist; consistent with Phase 2 D-07).
- **Final token swap (D-L3), scroll-reveal choreography (MOT-01), LCP/OG/a11y polish
  (PERF-01/03)** → **Phase 4**.

None of the above were dropped — each is mapped to its owning phase.

</deferred>

---

*Phase: 03-honesty-moat-gallery-proof-conversion*
*Context gathered: 2026-06-12*
