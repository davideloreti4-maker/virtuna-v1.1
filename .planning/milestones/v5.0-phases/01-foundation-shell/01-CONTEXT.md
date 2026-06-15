# Phase 1: Foundation & Shell - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the **flat-warm visual system** and the **app shell** the Simulation thread lives in: the clean home (serif greeting + universal composer), the two composer layouts (centered when empty → bottom-pinned when active), ingestion via the composer (`+` upload / paste-URL auto-detect), and the reskinned sidebar of past Simulations (reuse `useAnalysisHistory`). The flat-warm system is reskinned OFF the Raycast glass and is **human-UAT-gated against this real built shell** before it locks for rollout.

Presentation-layer only. Engine FROZEN at 3.19.0 — no `lib/engine/` changes. Work in `src/components/**`, `src/app/**`, hooks, and `globals.css` tokens only. Mobile-first; desktop is the same shell widened.

Requirements: SHELL-01..07, THEME-01..06 (13).
</domain>

<decisions>
## Implementation Decisions

### Visual system — flat-warm (THEME-01..06) — HUMAN-UAT-GATED
- **D-01 (base hue):** Surfaces are **neutral charcoal, softer/de-blued** — approved "Frame A" (~`#262624` app / ~`#1a1a18` sidebar), clearly lifted off the harsh cold `#07080a`. **NOT warm-brown.** Reference: the Claude.ai dark UI Davide shared + `.planning/sketches/01-base-hue/swatch.html` (Frame A).
- **D-02 (where warmth lives — REFINES brief THEME-01):** The brief said "warm-*neutral* hue." Davide's UAT eye rejected visibly warm/brown surfaces. Warmth comes from **cream/warm off-white text** (`~#ece7de`, never pure white) + the **coral accent** — *not* the surface hue. Surfaces stay perceptually neutral.
- **D-03 (serif):** Add an **editorial/literary serif** for voice moments only (greeting + hero line). Candidates: **Newsreader** or **Source Serif 4** (free, variable, Google Fonts, pair with Inter). No serif exists today — `globals.css` is Inter-only. Sans (Inter) for ALL data.
- **D-04 (coral):** Coral matures toward **terracotta/clay** (~`#d97757`, hue ~33–37, slightly deeper + desaturated) — validated by Claude's own clay accent. Stays distinct from the alert-red score-zone. Coral remains the lone brand accent (logo, primary action, focus).
- **D-05 (elevation, matte):** Depth from **tone-step + hairline borders**; a whisper-soft shadow ONLY on genuinely floating elements (composer, popovers). No inset white shine, no glow, no halo, no ambient/"presence" lighting.
- **D-06 (glass strip scope — THEME-02):** Strip the 137deg Raycast glass at **two layers**: (a) token level in `globals.css` (`--gradient-glass`, `--gradient-navbar`, `--shadow-glass`, `--shadow-glow-accent`, the inset-shine in `--shadow-button`); (b) **inline styles** in `Sidebar.tsx` (lines ~414–420 nav, ~747–751 hamburger, ~683–686 account popover) — these hardcode the gradient + `blur(5px)` + inset shine and must be replaced flat. Remember CLAUDE.md gotchas: oklch L<0.15 compiles wrong → use **hex** for dark tokens; Lightning CSS strips `backdrop-filter` → if any blur survives, apply via inline style.
- **D-07 (THEME-06 gate):** The flat-warm system gets an explicit **human-UAT review + sign-off on the BUILT shell** (not the abstract) before later phases reskin onto it. The swatch is pre-viz only; the gate is on the real running shell. Plan a concrete reviewable surface.
- **D-08 (Claude's discretion):** Exact hex ramp, exact serif typeface, exact coral hue = **decided at build, signed at the UAT gate** (brief §7). Capture *direction* here, not final values.

### Product naming — MILESTONE-LEVEL
- **D-09:** Product noun = **"Simulation"** (Davide vetoed "Reading" — "sounds shit"). Rationale: names the moat (audience simulation / persona cloud) vs commodity "analysis"; pairs with "Numen." Replaces "Reading" in ALL user-facing copy (CTA "New Simulation", history "Simulations", greeting, thread). **Ripples beyond Phase 1** — Phase 2 retitles "The Reading" → "The Simulation"; brief + roadmap prose need reconciling (requirement IDs `READ-*` may stay as opaque IDs). See "Brief Deviations" below — flagged for follow-up, NOT done in this discussion.

### Sidebar (SHELL-05, brief §2.8)
- **D-10 (composition):** **Lean & clean** — New Simulation (coral CTA, top) + the past-Simulations list (today's "Recent", with score chips) + Settings/Account at bottom. Matches the Claude.ai reference.
- **D-11 (cut):** Remove the **Pinned** stub (empty placeholder) and **Projects "Soon"** placeholder; remove the **"Boards" nav** (canvas retired). No dead affordances.
- **D-12 (keep @handle selector):** Keep the TikTok/IG handle selector (`SidebarAccountSelector`) — the engine uses creator context (followers/niche) for analysis, so the active account stays one click away. Reskin flat.
- **D-13 (history rows):** Relabel as "Simulations"; keep the score chips + remix tag; rows route to the new Simulation permalink (not the `/analyze` board).

### Shell layout (SHELL-05, SHELL-07)
- **D-14 (desktop):** Sidebar is **persistent + collapsible** on desktop (content shifts right, no overlap; collapse to an icon rail via ⌘\). **Revive the currently-dead collapse code** — `Sidebar.tsx` line 358 hardcodes `effectiveCollapsed = false` and the sidebar is overlay-only on all viewports today. Main content (`app-shell.tsx` currently `--sidebar-offset: 0px`) gains a real left offset when expanded.
- **D-15 (mobile):** **Slide-in drawer** from the left with backdrop (close to today's mobile behavior). NOT a bottom sheet (resolves brief §7 open item).
- **D-16 (default state):** **Expanded by default** on first desktop load (Simulations history visible); persist the user's collapse/expand choice via the existing **persisted `sidebar-store`**.
- **D-17 (content width):** Composer + thread cap at a **~760px centered readable column** in the main area (Claude-style). Mobile-first scales up cleanly; rich visuals may break wider in later phases.

### Home & ingestion (SHELL-01..04)
- **D-18 (empty home — DEVIATES from brief 3-chip spec):** Home = **greeting + composer only, NO starter chips**. The composer already affords paste (placeholder) + upload (`+`), so Paste/Upload chips are redundant; Davide chose the clean Claude-style minimal start. (Brief/SHELL-01 locked `Paste · Upload · Try a demo` — this is an intentional override.)
- **D-19 (greeting):** Working line = **"Ready to simulate your audience, [Name]?"** — serif voice moment, name from `useProfile`. Exact micro-copy finalized at the UAT gate.
- **D-20 (glyph):** Use the **Numen stele glyph** (`NumenMark` in `src/components/brand/numen-logo.tsx` — already exists), not an asterisk. [Locked by brief; confirmed.]
- **D-21 (URL scope):** Paste-URL auto-detect = **TikTok only** for v1 (engine + Apify scraper are TikTok-tuned). Reject non-TikTok URLs with a clear message.
- **D-22 (upload):** Upload via the composer `+` control.
- **D-23 (route model):** The **new Numen home becomes the default authed landing** (today authed users land on `/analyze` — dashboard already sunset → `/analyze` in middleware). Submit → create a new Simulation → navigate to its **permalink** where the composer drops to bottom-pinned (the Claude "new chat → /chat/[id]" model). `/analyze` stays **dormant-but-reachable** (not deleted) per the brief. Exact route paths = planner's call.
- **D-24 (composer two-layout):** Centered-when-empty → bottom-pinned-when-active; same composer serves follow-ups (no separate dock). [Locked by brief §2.2.]

### Demo (DEMO-01 — Phase 5)
- **D-25:** Keep the first-run demo concept (pre-run Simulation on a known viral video, shown to brand-new users to "show the magic first"). **Build nothing in Phase 1**; no demo chip/affordance on the P1 home. Detail the form in Phase 5.

### Claude's Discretion
- Exact route paths for the new home + Simulation permalink (D-23) — planner.
- Component/motion library choices (Radix / shadcn / MagicUI / Aceternity / motion+Framer Motion) within the flat-warm + calm-motion taste bar — executor.
- Final token values, serif typeface, coral hex — pending the UAT gate (D-08).
- Greeting micro-copy final wording (D-19).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth & requirements
- `.planning/NUMEN-REWORK-BRIEF.md` — LOCKED milestone brief. **BUT** this discussion overrides three points: the product noun (D-09: "Simulation" not "Reading"), the base-hue interpretation (D-02: neutral charcoal, not warm-brown), and the empty-home chips (D-18: composer-only, not the locked 3-chip spec). Where this CONTEXT conflicts with the brief, this CONTEXT wins for Phase 1.
- `.planning/REQUIREMENTS.md` — SHELL-01..07, THEME-01..06 (this phase's contract).
- `.planning/ROADMAP.md` — Phase 1 goal + success criteria (note: "Reading" → "Simulation" per D-09).

### Approved visual direction (pre-viz, not the gate)
- `.planning/sketches/01-base-hue/swatch.html` — the approved **Frame A** (neutral charcoal + cream text + terracotta coral + tone-step/hairline elevation + editorial serif greeting). The visual north star for the token migration; the real UAT gate (D-07) is on the built shell.

### Reskin / reuse targets (existing code)
- `src/app/globals.css` — token SSOT (Tailwind v4 `@theme`, primitive→semantic). The reskin epicenter (D-01..D-06).
- `src/components/sidebar/Sidebar.tsx` — sidebar reskin target: inline glass to strip (D-06), dead collapse code to revive (D-14), history list (D-13), `SidebarAccountSelector` to keep (D-12). 756 lines.
- `src/components/app/app-shell.tsx` — thin shell wrapper; add real content offset for the persistent desktop sidebar (D-14). 25 lines.
- `src/components/brand/numen-logo.tsx` — `NumenMark` stele glyph (D-20).
- `src/components/sidebar/use-sidebar-queries.ts` + `src/hooks/queries` (`useAnalysisHistory`) — past-Simulations data wiring (D-10/D-13).
- `src/stores/sidebar-store.ts` — persisted open/close state (D-16).
- `src/hooks/queries/use-profile.ts` (`useProfile`) — greeting name source (D-19).
- `src/lib/supabase/middleware.ts` — current authed landing logic (`/dashboard` → `/analyze` 308); the new-home landing change (D-23) touches this.
- `BRAND-BIBLE.md` — the current Raycast design language being **replaced** (read to know what's being torn out).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Sidebar.tsx`** — full sidebar already wired to `useAnalysisHistory` (Recent list w/ score chips, remix tags, relative time), account popover, and a complete (but dead) icon-rail collapse implementation. Revive + reskin rather than rebuild.
- **`useAnalysisHistory` / `use-sidebar-queries.ts`** — returns history rows (`id`, `content_text`, `overall_score`, `created_at`, `variants`); already projected for the sidebar.
- **`sidebar-store.ts`** — persisted Zustand open/close store (ready for the desktop expand/collapse persistence, D-16).
- **`NumenMark`** (`numen-logo.tsx`) — the stele glyph, already shipped.
- **`useProfile`** — user name/email for the greeting.
- Hooks present: `useIsMobile`, `usePrefersReducedMotion` (calm-motion + reduced-motion support).
- Libs available: Radix, motion/Framer Motion, Phosphor + Lucide icons, CVA, `cn()`.

### Established Patterns
- **Tailwind v4 `@theme`** two-layer tokens (primitive → semantic) in `globals.css`. Reskin happens here first; component classes reference semantic tokens.
- **CLAUDE.md gotchas (critical for the dark reskin):** (1) oklch with L<0.15 compiles incorrectly in `@theme` → use **exact hex** for dark surface tokens; (2) Lightning CSS strips `backdrop-filter` → any surviving blur via inline `style`; (3) kill dev server + clear `.next/` when CSS changes don't appear.
- kebab-case components; `"use client"` for interactive; barrel exports.

### Integration Points
- `globals.css` `@theme` — the flat-warm migration root.
- `Sidebar.tsx` inline glass (3 spots) — must be replaced flat, not just token-swapped.
- `app-shell.tsx` `--sidebar-offset` — wire to real desktop sidebar width when expanded.
- New home route + Simulation permalink route — new surfaces alongside dormant `/analyze` (planner defines paths).
- `middleware.ts` landing redirect — repoint authed landing to the new home (D-23).
</code_context>

<specifics>
## Specific Ideas

- **Visual north star:** the Claude.ai dark UI (screenshot Davide shared) — neutral charcoal surfaces, cream serif greeting, clay/coral accent, flat hairline borders, persistent collapsible sidebar, centered column. Numen = "Claude-quality calm" applied to a TikTok scoring instrument.
- **Approved swatch:** `.planning/sketches/01-base-hue/swatch.html` Frame A (softer charcoal) — the committed direction over Frame B (deeper) and the rejected warm-brown options.
- **Greeting:** "Ready to simulate your audience, [Name]?" (the "your audience" object is what makes it land — ties to the simulation moat).
- **Coral target:** Claude's clay `~#d97757` is a good north star for the matured terracotta coral.
</specifics>

<deferred>
## Deferred Ideas

- **Pinning Simulations** — the Pinned sidebar stub is cut for v1; real pinning is useful but new scope. Revisit in a later milestone.
- **Projects** — the "Soon" placeholder is cut; a Projects/grouping feature is future scope.
- **Instagram URL analysis** — v1 is TikTok-only (D-21); IG ingestion deferred (the @handle selector already supports IG accounts, but engine analysis is TikTok-tuned).

### Brief Deviations — reconciliation follow-up (NOT done here)
These three Phase-1 decisions intentionally override the LOCKED brief and need the brief/roadmap/requirements prose reconciled (separate task, not part of this discussion):
1. **Product noun "Reading" → "Simulation"** (D-09) — milestone-wide; retitle Phase 2 "The Reading" → "The Simulation".
2. **Base hue = neutral charcoal, not "warm-neutral hue"** (D-02) — refines THEME-01.
3. **Empty home = composer-only, no starter chips** (D-18) — overrides SHELL-01's locked 3-chip spec.
</deferred>

---

*Phase: 1-Foundation & Shell*
*Context gathered: 2026-06-13*
