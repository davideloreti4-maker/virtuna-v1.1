# Phase 1: Foundation & Shell - Research

**Researched:** 2026-06-13
**Domain:** Next.js 16 App Router presentation layer — Tailwind v4 `@theme` token reskin, app-shell routing/sidebar, composer ingestion. Engine FROZEN 3.19.0.
**Confidence:** HIGH (all findings grounded in the live codebase; line numbers verified against current files)

## Summary

This phase is unusually well-specified: CONTEXT.md locks 25 decisions and UI-SPEC.md owns the entire visual/interaction contract. This research does NOT re-derive either. It resolves the five genuine technical unknowns the planner needs and **verifies every code claim** in CONTEXT/UI-SPEC against the running code so the plan builds on facts.

The headline finding: **the submit→create→permalink loop the CONTEXT describes as "the Claude new-chat → /chat/[id] model" already exists and works today.** `ContentForm` → `stream.start()` → SSE `event: started` carries a `nanoid(12)` id → `router.push('/analyze/${id}')`; the row persists to `analysis_results`; `/api/analysis/[id]` re-fetches it (IDOR-defended); `usePermalinkAnalysis` hydrates it on reload. Phase 1's routing work is therefore **a re-route and a rename of an existing, proven mechanism**, not a new build. The sidebar's collapse code is genuinely dead (`effectiveCollapsed = false` hardcoded) but the persisted store backing it (`isCollapsed`/`toggleCollapsed`) **already exists** — reviving it is wiring, not authoring. The composer (`ContentForm`) exists but is **heavier than P1 wants** (Score/Remix intent selector, model-tier picker, 3-mode tabs) — P1 needs a simplified TikTok-URL+upload-only composer, reusing the validated sub-parts (`VideoUpload`, the TikTok regex).

Three CONTEXT claims are **corrected** below (see "Code Claim Verification"): the sidebar store fields are `isOpen`/`isCollapsed` (CONTEXT said the store was merely "ready" — it's fully present); `app/simulation/*` is **dead reference code** not a reusable kit; and the new authed home **cannot** be `/` (that path is the PUBLIC marketing landing, not authed).

**Primary recommendation:** Reuse and re-route, don't rebuild. New authed home at `/home` (NOT `/`), keep `/analyze/[id]` as the existing Simulation permalink for P1 (no new `/s/[id]` route needed — renaming routes is churn the brief doesn't require), repoint middleware authed-landing `/analyze` → `/home`, revive the dead collapse via the already-persisted `sidebar-store`, and migrate the `@theme` tokens flat-warm in `globals.css` per the UI-SPEC Glass Strip Map (verified line numbers below).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-25 — verbatim summary; full text in 01-CONTEXT.md)

**Visual system — flat-warm (HUMAN-UAT-GATED):**
- **D-01:** Surfaces = neutral charcoal, de-blued ("Frame A" ~`#262624` app / ~`#1a1a18` sidebar). NOT warm-brown. Lifted off cold `#07080a`.
- **D-02 (refines THEME-01):** Warmth from cream/warm off-white text (`~#ece7de`, never pure white) + coral accent — NOT the surface hue. Surfaces perceptually neutral.
- **D-03:** Add editorial serif for voice moments only (greeting + hero line). Candidates: Newsreader or Source Serif 4. No serif exists today (Inter-only). Sans (Inter) for ALL data.
- **D-04:** Coral matures toward terracotta/clay (~`#d97757`, hue ~33–37). Stays distinct from alert-red. Lone brand accent.
- **D-05:** Depth from tone-step + hairline borders; whisper-soft shadow ONLY on floating elements (composer, popovers). No inset shine, glow, halo, ambient lighting.
- **D-06 (THEME-02 glass strip):** Strip 137deg Raycast glass at TWO layers — (a) token level in `globals.css`; (b) inline styles in `Sidebar.tsx`. oklch L<0.15 → use hex; Lightning CSS strips backdrop-filter → inline style if any blur survives.
- **D-07 (THEME-06 gate):** Human-UAT review + sign-off on the BUILT shell before later phases reskin. Plan a concrete reviewable surface.
- **D-08 (Claude's discretion):** Exact hex ramp, serif typeface, coral hue = decided at build, signed at UAT gate. Capture direction, not final values.

**Product naming (MILESTONE-LEVEL):**
- **D-09:** Product noun = **"Simulation"** (vetoed "Reading"). Replaces "Reading" in ALL user-facing copy. Ripples to Phase 2.

**Sidebar (SHELL-05):**
- **D-10:** Lean & clean — New Simulation (coral CTA, top) + past-Simulations list (score chips) + Settings/Account bottom.
- **D-11:** Remove Pinned stub, Projects "Soon" placeholder, "Boards" nav. No dead affordances.
- **D-12:** Keep @handle selector (`SidebarAccountSelector`) — engine uses creator context. Reskin flat.
- **D-13:** Relabel "Recent" → "Simulations"; keep score chips + remix tag; rows route to new Simulation permalink (not `/analyze` board).

**Shell layout (SHELL-05, SHELL-07):**
- **D-14:** Desktop sidebar persistent + collapsible (content shifts right, no overlap; collapse to icon rail via ⌘\). Revive dead collapse code.
- **D-15:** Mobile = slide-in drawer from left with backdrop. NOT a bottom sheet.
- **D-16:** Expanded by default on first desktop load; persist collapse/expand via persisted `sidebar-store`.
- **D-17:** Composer + thread cap at ~760px centered readable column (Claude-style).

**Home & ingestion (SHELL-01..04):**
- **D-18 (DEVIATES from brief):** Home = greeting + composer ONLY, NO starter chips.
- **D-19:** Greeting = "Ready to simulate your audience, [Name]?" — serif, name from `useProfile`. Micro-copy finalized at UAT.
- **D-20:** Use `NumenMark` stele glyph, not an asterisk. [exists]
- **D-21:** Paste-URL auto-detect = TikTok only for v1. Reject non-TikTok with clear message.
- **D-22:** Upload via composer `+` control.
- **D-23:** New Numen home = default authed landing (today → `/analyze`). Submit → create Simulation → navigate to permalink (composer drops bottom-pinned). `/analyze` stays dormant-but-reachable. Exact route paths = planner's call.
- **D-24:** Composer centered-when-empty → bottom-pinned-when-active; same composer serves follow-ups.

**Demo (Phase 5):**
- **D-25:** Keep first-run demo concept. Build NOTHING in Phase 1; no demo chip/affordance on P1 home.

### Claude's Discretion
- Exact route paths for new home + Simulation permalink (D-23) — planner.
- Component/motion library choices (Radix / shadcn / MagicUI / Aceternity / motion) within flat-warm + calm-motion taste bar — executor.
- Final token values, serif typeface, coral hex — pending UAT gate (D-08).
- Greeting micro-copy final wording (D-19).

### Deferred Ideas (OUT OF SCOPE)
- Pinning Simulations (Pinned stub cut; real pinning = later milestone).
- Projects ("Soon" placeholder cut).
- Instagram URL analysis (v1 TikTok-only; @handle selector still supports IG accounts).
- **Brief reconciliation follow-ups (separate task, NOT in P1):** noun "Reading"→"Simulation" milestone-wide; base hue neutral-charcoal; empty home composer-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | Clean home: serif greeting + universal composer, centered, NumenMark. NO chips (D-18 overrides). No Simulation list under composer. | R5 (`useProfile` shape, `NumenMark` API confirmed); R4 (composer architecture); new `/home` route (R1). |
| SHELL-02 | Start a Simulation by pasting a video URL (auto-detected). | R4 — TikTok regex `/^https?:\/\/(www\.|vm\.)?tiktok\.com\//` in `/api/analyze` (line 465); `TIKTOK_URL_PATTERN` in `tiktok-url-input.tsx`. |
| SHELL-03 | Start a Simulation by uploading a video file via composer `+`. | R4 — `VideoUpload` component (validated, `bare` variant); upload path in `Board.handleContentSubmit` (Supabase storage → `video_storage_path`). |
| SHELL-04 | Once a Simulation exists, composer drops to bottom-pinned, same composer serves follow-ups. | R4 — two-layout state-driven; existing `ContentForm` `isOnResultRoute` precedent; D-24. (Follow-up chat itself = Phase 5.) |
| SHELL-05 | Past Simulations in sidebar — collapsible desktop, drawer mobile — from `useAnalysisHistory`. | R3 — `Sidebar.tsx` + `useAnalysisHistory` + persisted `sidebar-store`; collapse revival mechanics. |
| SHELL-06 | Reopen a past Simulation from sidebar; full thread restored (permalink). | R1 — `/analyze/[id]` + `/api/analysis/[id]` (IDOR-defended) + `usePermalinkAnalysis` ALREADY restore by id. P1 restores the SHELL; P2 renders the thread. |
| SHELL-07 | Mobile-first; renders on phones; desktop = same shell widened. | R3 — `useIsMobile` (768px breakpoint); drawer vs persistent branch. |
| THEME-01 | Flat-warm token system replaces cold base; matte; contrast from elevation. | R2 — `@theme` re-base (`--color-background` #07080a → #262624 hex). |
| THEME-02 | Raycast glass removed everywhere incl. sidebar. | R2 + R3 — Layer A tokens (verified lines) + Layer B inline styles in `Sidebar.tsx` (verified lines). |
| THEME-03 | Score zones + evolved coral = only colors; rest neutral. | R2 — coral scale migration (lines 13–23); `--color-success/warning/error` retained as data colors. |
| THEME-04 | Serif for voice moments; sans for data. | R5 — `next/font/google` Newsreader → `--font-serif`, mirroring Inter wiring in root `layout.tsx`. |
| THEME-05 | Hairline borders, generous spacing, calm motion. | R2 (existing `--color-border` 0.06 scale, spacing scale) + existing `--duration-*`/`--ease-out-cubic`; `usePrefersReducedMotion`. |
| THEME-06 | Flat-warm system passes explicit human-UAT gate before lock. | "THEME-06 Gate" section — concrete reviewable surface defined. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Flat-warm token system | CDN/Static (CSS `@theme`) | — | Tokens compile into `globals.css` at build; consumed everywhere via semantic vars. |
| New authed home route | Frontend Server (App Router) | Browser (client composer) | Route is a server page in `(app)` group; composer is `"use client"`. |
| Simulation permalink restore | API/Backend (`/api/analysis/[id]`) | Browser (TanStack hydrate) | Row fetch + IDOR enforcement is server-owned; client hydrates cache. |
| Authed-landing redirect | Frontend Server (middleware) | — | `src/lib/supabase/middleware.ts` owns the auth→landing decision. |
| Sidebar collapse/drawer state | Browser (Zustand persisted) | — | Pure client UI state; persisted to localStorage `virtuna-sidebar`. |
| Composer ingestion (URL/upload) | Browser (form) → API (`/api/analyze`) | Database (storage + `analysis_results`) | Client validates + uploads; server validates again, runs pipeline, persists. |
| Greeting name | API (`/api/profile`) | Browser (`useProfile` query) | Profile is server data; greeting reads it client-side. |

**Why this matters:** The plan must not, e.g., try to enforce the TikTok-only restriction client-side ONLY — the server already validates it (line 465). The client check is UX (fast reject); the server check is the trust boundary. Both layers stay.

## Standard Stack

All libraries are **already installed** — this phase adds essentially one runtime dependency (a Google serif font, which `next/font/google` pulls at build time, no npm install). Versions verified against `package.json` `[VERIFIED: package.json]`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.5 | App Router, `next/font/google`, middleware | Project framework; routing + font wiring live here. |
| react | 19.2.3 | Client components, hooks | Project baseline. |
| tailwindcss | ^4 | CSS-first `@theme` token SSOT | Reskin epicenter; no config file (`globals.css` only). |
| zustand | ^5.0.10 | `sidebar-store` (persisted), `board-store` | Already backs sidebar open/collapse state. |
| @tanstack/react-query | ^5.90.21 | `useProfile`, `useAnalysisHistory`, permalink fetch | All data hooks built on it. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion / framer-motion | ^12.29.x | Calm sidebar/composer transitions | Reflow centered→pinned, drawer slide. Respect `usePrefersReducedMotion`. |
| @radix-ui/* | various (9 pkgs) | Tooltip, Popover, Dialog primitives | Sidebar tooltips (collapsed rail), account popover, mobile drawer can use Radix Dialog. |
| lucide-react + @phosphor-icons/react | both present | Icons | Sidebar uses Phosphor; composer uses Lucide. Both available. |
| class-variance-authority + clsx + tailwind-merge (`cn()`) | present | Class composition | Established pattern. |

### Serif font (the one genuinely new addition — D-03/THEME-04)
| Candidate | Source | Why | Note |
|-----------|--------|-----|------|
| **Newsreader** | `next/font/google` | In Frame A swatch; literary/editorial; variable; italic for name accent (UI-SPEC display row). | Recommended starting point (matches swatch). |
| **Source Serif 4** | `next/font/google` | Fallback candidate; cleaner/more neutral serif. | Both ship variable weights + italic. |

**Do NOT pick the typeface in the plan** — D-08 + UI-SPEC say it signs at the THEME-06 gate. Plan to wire ONE (Newsreader as the Frame-A-matching default) as `--font-serif`, with the swap to Source Serif 4 being a one-line change at the gate if the human prefers it.

**Installation:** No `npm install`. Add the font via `next/font/google` in `src/app/layout.tsx` (see Code Examples).

**Version verification:** `next@16.1.5`, `react@19.2.3`, `tailwindcss@^4`, `zustand@^5.0.10`, `@tanstack/react-query@^5.90.21`, `motion@^12.29.2`, `vitest@^4.0.18` — all `[VERIFIED: package.json]` (read 2026-06-13).

## Package Legitimacy Audit

> **Not applicable.** This phase installs **zero** external packages. The serif font is pulled by `next/font/google` at build time (no registry install). All other libraries are already in `package.json`. No slopcheck/registry verification required.

| Package | Disposition |
|---------|-------------|
| (none) | No external package installs in Phase 1. |

## Code Claim Verification

> The planner's most valuable input from this research: confirming/correcting every code claim in CONTEXT.md + UI-SPEC.md against the live files. ✅ = verified accurate. ⚠️ = corrected.

| # | Claim (source) | Verdict | Reality |
|---|----------------|---------|---------|
| C1 | `Sidebar.tsx` line 358 hardcodes `effectiveCollapsed = false` (D-14/UI-SPEC) | ✅ | `src/components/sidebar/Sidebar.tsx:358` — `const effectiveCollapsed = false;` exactly. Comment line 357: "Sidebar is always a full-width overlay". |
| C2 | Sidebar nav glass at lines ~414–420 (UI-SPEC Layer B) | ✅ | `Sidebar.tsx:414–420` — the `<nav>` `style={{ backgroundImage: linear-gradient(137deg…), backdropFilter: blur(5px), boxShadow: …inset }}`. Exact. |
| C3 | Account popover glass at ~683–686 (UI-SPEC Layer B) | ✅ | `Sidebar.tsx:682–686` — `style={{ backgroundColor: rgba(22,23,25,0.98), backdropFilter: blur(12px), WebkitBackdropFilter: blur(12px) }}`. Exact (popover is a solid bg + blur, not the 137deg gradient — flatten = drop blur). |
| C4 | Hamburger glass at ~747–751 (UI-SPEC Layer B) | ✅ | `Sidebar.tsx:747–751` — `style={{ background: linear-gradient(137deg…0.85…0.95…), backdropFilter: blur(8px), WebkitBackdropFilter: blur(8px) }}`. Exact. |
| C5 | `sidebar-store` exposes `isCollapsed`/`toggleCollapsed`, persisted (D-16) | ✅ + clarify | `src/stores/sidebar-store.ts` exposes `isOpen`(default `true`), `isCollapsed`(default `false`), `toggle`, `open`, `close`, `toggleCollapsed`, `setCollapsed`. Persisted via `persist({name:'virtuna-sidebar'})`. **CONTEXT undersold it** — the store is COMPLETE, including the ⌘\-collapse field. Reviving = consuming `isCollapsed` instead of the hardcoded `false`. |
| C6 | `app-shell.tsx` is ~25 lines, `--sidebar-offset: 0px` (D-14) | ✅ | `src/components/app/app-shell.tsx` — 25 lines; `<main style={{ "--sidebar-offset": "0px" }}>`. The offset var is declared but **never read** by any CSS today (sidebar is `fixed` overlay). Wiring it = set it to real width + apply `margin-left` / `padding-left: var(--sidebar-offset)` on `<main>`. |
| C7 | `globals.css` `--gradient-glass` line 195, `--gradient-navbar` 194, `--gradient-card-bg` 192, `--gradient-feature` 196 (UI-SPEC Layer A) | ✅ | `src/app/globals.css`: `--gradient-card-bg` **L192**, `--gradient-navbar` **L194**, `--gradient-glass` **L195**, `--gradient-feature` (radial) **L196**. All exact. |
| C8 | `--shadow-glass` line 145, `--shadow-glow-accent` 146, `--shadow-button` inset-shine 147 (UI-SPEC Layer A) | ✅ | `globals.css`: `--shadow-glass` **L145** (`…inset 0 1px 0 oklch(1 0 0 / 0.1)`), `--shadow-glow-accent` **L146** (`0 0 20px oklch(0.72 0.16 40 / 0.3)`), `--shadow-button` **L147** (4-layer incl. two `inset` white-shine layers). Exact. |
| C9 | `--color-background` `#07080a` at line 69/38 (UI-SPEC) | ✅ + detail | `--color-background: var(--color-gray-950)` at **L69**; `--color-gray-950: #07080a` at **L38**. To re-base: change the **primitive** (`--color-gray-950`) OR add a dedicated charcoal primitive and repoint `--color-background`. Recommend the latter (don't overload the gray ramp — see R2). |
| C10 | coral scale hue 40 → ~35, new base, lines 13–23 (UI-SPEC) | ✅ | `--color-coral-100..900` at **L15–23** (header comment L13–14), all `oklch(… 40)`. Base `--color-coral-500: oklch(0.72 0.16 40)` L19. Mature toward `#d97757` (hue ~33–37, slightly deeper/desaturated). |
| C11 | No serif exists; Inter only (D-03/THEME-04) | ✅ | `globals.css` L105 `--font-sans: var(--font-inter)…`; only `--font-sans` + `--font-mono`. Root `layout.tsx` wires only `Inter`. No `--font-serif`. |
| C12 | `NumenMark` exists in `numen-logo.tsx` (D-20) | ✅ | `src/components/brand/numen-logo.tsx` exports `NumenMark({ size=22, variant?, className })` — single `evenodd` stele path, `fill="currentColor"`, `aria-hidden`. Inherits text color (so coral applied via parent `text-accent`). |
| C13 | `useProfile` returns greeting name (D-19) | ✅ + shape | `src/hooks/queries/use-profile.ts` — `useProfile()` returns `{ name, email, company, role, avatar, notifications }` from `GET /api/profile`. Greeting uses `profile?.name` (fallback `profile?.email`, as Sidebar account row does at L672). TanStack query → has `isLoading` for the greeting skeleton. |
| C14 | `useAnalysisHistory` returns `id, content_text, overall_score, created_at, variants` (D-10/D-13) | ✅ | `src/hooks/queries/use-analyze.ts:120` — `useAnalysisHistory()` → `GET /api/analysis/history` → `SELECT * FROM analysis_results … limit 50`. Sidebar consumes `id, content_text, overall_score, created_at, variants` (Sidebar.tsx:362–368). |
| C15 | Middleware authed-landing `/dashboard`→`/analyze` 308 (D-23) | ✅ + detail | `src/lib/supabase/middleware.ts:55–59` — `/dashboard*` → 308 `/analyze`. Authed users hitting `/login`/`/signup` → `/analyze` (L130). `/analyze` is a `PROTECTED_PREFIX` (L13). **No explicit "land on /analyze after login" beyond the auth-page redirect** — the post-login destination comes from the `next` param or defaults via the auth callback. |
| C16 | New home can be `/` (implied) | ⚠️ CORRECTION | `/` is the **PUBLIC marketing landing** (`src/app/(marketing)/page.tsx`, in `PUBLIC_PATHS` L26). The new authed home **must be a new authed route in `(app)`** (recommend `/home`), NOT `/`. See R1. |
| C17 | `app/simulation/*` is a reusable kit (CONTEXT implies via barrel) | ⚠️ CORRECTION | `src/components/app/simulation/*` (HeroScore, ResultsPanel, LoadingPhases, etc.) is **DEAD reference code** — only `ResultsPanel` is imported, by `test-creation-flow.tsx`, which is itself **unused** (`TestCreationFlow` consumed nowhere). Do NOT reuse this kit (it's the abandoned numen-surface-style result panel). The LIVE result UI is the Konva `<Board>`. |
| C18 | A composer/input already exists (R4 premise) | ✅ | LIVE composer = `src/components/app/content-form.tsx` (`ContentForm`), hosted by `CommandBar` (bottom dock) inside `<Board>`. NOT the simulation kit. |

## Architecture Patterns

### System Architecture Diagram

```
                          AUTHED USER
                               │
                   ┌───────────┴────────────┐
                   │  middleware.ts          │  (R1: repoint authed landing
                   │  auth gate + landing    │   /analyze → /home)
                   └───────────┬────────────┘
                               │
        ┌──────────────────────┼───────────────────────────┐
        ▼                      ▼                            ▼
  /home (NEW)            /analyze/[id]                 /analyze (DORMANT
  authed landing         = Simulation permalink         but reachable)
        │                (EXISTING — reused)
        │                      │
  ┌─────┴──────────┐           │ on reload
  │ AppShell       │           ▼
  │  ├ Sidebar ◄───┼── sidebar-store (persisted: isOpen, isCollapsed)
  │  │   New Sim CTA│           │
  │  │   Simulations│◄── useAnalysisHistory ── GET /api/analysis/history
  │  │   @handle    │           │
  │  │   Account    │   usePermalinkAnalysis ── GET /api/analysis/[id]
  │  └ <main>       │           │                  (IDOR: .eq user_id)
  │      offset ◄───┼── --sidebar-offset (R3: wire to real width)
  │      Composer   │
  └──────┬──────────┘
         │ submit (URL paste / + upload)
         ▼
   stream.start()  ──POST──►  /api/analyze
         │                         │ validate TikTok URL (L465, trust boundary)
         │                         │ INSERT placeholder analysis_results (nanoid id)
         │ ◄── SSE event:started { id } ── (the permalink id)
         ▼
   router.push('/analyze/${id}')   ──►  composer drops to bottom-pinned
   (THIS IS the "new chat → /chat/[id]" model — already built)
```

**Data flow to trace (the primary use case):** authed user lands `/home` (greeting + centered composer) → pastes TikTok URL → client validates → `POST /api/analyze` → server validates again + inserts placeholder row + streams `started{id}` → client navigates to `/analyze/${id}` → composer reflows bottom-pinned → (Phase 2 renders the thread above). On reload of `/analyze/${id}`, `usePermalinkAnalysis` re-fetches the row → shell + (P2) thread restore.

### Recommended Project Structure (additions/changes only)
```
src/app/
├── (app)/
│   ├── home/page.tsx          # NEW — authed landing: greeting + composer
│   │                          #   (server page; renders client <Composer> + greeting)
│   ├── analyze/               # UNCHANGED — stays dormant-but-reachable + permalink host
│   │   ├── page.tsx           #   (dormant board landing)
│   │   └── [id]/page.tsx      #   (EXISTING Simulation permalink — P2 renders thread here)
│   └── layout.tsx             # AppShell wrapper (unchanged)
├── globals.css                # REWORK — flat-warm @theme tokens (R2)
└── layout.tsx                 # EDIT — add Newsreader → --font-serif (R5)

src/components/
├── app/
│   ├── app-shell.tsx          # EDIT — wire --sidebar-offset to real width (R3)
│   └── home/                   # NEW — home composer + greeting (P1 composer, simplified)
│       ├── home-greeting.tsx  #   serif "Ready to simulate your audience, [Name]?"
│       └── composer.tsx       #   NEW simplified composer (URL + upload only, two-layout)
├── sidebar/Sidebar.tsx        # REWORK — revive collapse (D-14), strip glass (D-06),
│                              #   cut Pinned/Projects/Boards (D-11), relabel Simulations (D-13)
└── (reuse) app/video-upload.tsx  # VideoUpload — reuse verbatim in the new composer

src/lib/supabase/middleware.ts # EDIT — authed landing → /home (R1)
```

### Pattern 1: submit→create→permalink (ALREADY IMPLEMENTED — reuse, don't reinvent)
**What:** The "new chat → /chat/[id]" model. Submit fires `stream.start()`; the server returns the new id via SSE `event: started`; the client `router.push`es to the id route, where the composer reflows to bottom-pinned.
**When to use:** SHELL-04, SHELL-06, D-23, D-24.
**Where it lives today:**
```ts
// Source: src/components/board/Board.tsx:300-307 (the navigate-on-id-arrival effect)
const prevAnalysisIdRef = useRef<string | null>(stream.analysisId);
useEffect(() => {
  const id = stream.analysisId;
  if (id && prevAnalysisIdRef.current === null) {
    router.push(`/analyze/${id}`);   // ← new-chat→/chat/[id] navigation
  }
  prevAnalysisIdRef.current = id;
}, [stream.analysisId, router]);
```
The id originates server-side: `POST /api/analyze` does `const analysisId = nanoid(12)` (route line 842), inserts a placeholder `analysis_results` row, and emits `send("started", { id: analysisId })` (line 951). `useAnalysisStream` surfaces it as `stream.analysisId` (hook Pitfall #6). **Phase 1 must replicate this same effect in the new home composer** (lift `handleContentSubmit` + the navigate effect out of `<Board>`, since the new home is NOT the Konva board).

### Pattern 2: permalink restore (ALREADY IMPLEMENTED)
**What:** Load a Simulation by id on direct nav/reload.
```ts
// Source: src/hooks/queries/use-permalink-analysis.ts
export function usePermalinkAnalysis() {
  const params = useParams();           // reads /analyze/[id]
  const id = …;
  return useQuery({
    queryKey: queryKeys.analysis.detail(id ?? ''),
    queryFn: async () => (await fetch(`/api/analysis/${id}`)).json(),
    enabled: !!id, staleTime: Infinity, gcTime: 5*60_000,
  });
}
```
The server route `GET /api/analysis/[id]` enforces ownership (`/api/analysis/[id]/route.ts:30` — `.eq("id", id).eq("user_id", user.id)`) — IDOR-defended. **P1 needs the route to exist + restore the shell; P2 renders the thread from this data.** The route ALREADY exists and works. This is the P1↔P2 seam: P1 = shell + composer position; P2 = the result IA above the composer.

### Pattern 3: two-layout composer (state-driven position — precedent exists)
**What:** One composer, position driven by "does a Simulation exist?". Centered (empty home) → bottom-pinned (active/permalink).
**Precedent:** `ContentForm` already branches on route (`isOnResultRoute = !!params.id`, content-form.tsx:158) to change its default tab. Extend this idea: the **container** (centered vs bottom-pinned) is the variable; the composer component is constant.
**When to use:** SHELL-04, D-24.

### Anti-Patterns to Avoid
- **Rebuilding the submit/permalink loop.** It exists and is battle-tested (handles cache hits, SSE reconnect, navigation-cancel). Lift and reuse `handleContentSubmit` + the navigate effect; do not author a new POST flow.
- **Reusing `app/simulation/*` or `TestCreationFlow`.** Dead reference code (C17). The live composer is `ContentForm`.
- **Making the new home `/`.** That's the public marketing page (C16). Use `/home` in `(app)`.
- **Renaming `/analyze/[id]` to `/s/[id]` in Phase 1.** Pure churn — the brief says keep `/analyze` dormant-but-reachable, and `/analyze/[id]` already works as the permalink with all the IDOR/restore plumbing. A cosmetic rename risks breaking the 6+ call sites (`use-permalink-*`, `Board`, middleware, history rows) for zero user-visible gain. If a prettier `/s/[id]` is wanted, defer to a later phase or do it as an explicit, well-tested rename task — NOT bundled into the shell work.
- **Token-swapping the inline glass.** The 3 inline-style glass spots in `Sidebar.tsx` (C2/C3/C4) hardcode the gradient — they will NOT change when you edit `globals.css` tokens. They must be edited inline (D-06 Layer B).
- **Authoring oklch dark surfaces.** CLAUDE.md gotcha: oklch L<0.15 compiles wrong in `@theme`. New charcoal surfaces MUST be hex.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TikTok URL validation | A new regex | Server regex `/^https?:\/\/(www\.|vm\.)?tiktok\.com\//` (analyze route L465) is the trust boundary; client `TIKTOK_URL_PATTERN` (tiktok-url-input.tsx L11) for fast UX reject | Two-layer validation already exists; just narrow the client copy to TikTok-only (D-21 — `ContentForm`'s `SOCIAL_URL_PATTERN` currently also allows Instagram; P1 composer must reject IG). |
| Video file upload + validation | A new dropzone | `VideoUpload` (`src/components/app/video-upload.tsx`, `bare` variant) | Handles drag/drop, type allowlist (MP4/MOV/WebM/AVI/MKV), 200MB cap, thumbnail extract, privacy disclosure. Reuse verbatim. |
| Submit → create → navigate | A new POST + nav | `stream.start()` + the navigate-on-id effect (Board.tsx:300-307) | Handles SSE, cache hits, reconnect, cancel-on-nav. |
| Permalink restore by id | A new fetch | `usePermalinkAnalysis` + `GET /api/analysis/[id]` | IDOR-defended, TanStack-cached, dedup'd. |
| Sidebar collapse persistence | A new store/localStorage | `sidebar-store` (`isCollapsed`/`toggleCollapsed`, persisted `virtuna-sidebar`) | Already complete (C5). |
| Relative timestamps | A date lib | `relativeTime()` (Sidebar.tsx:59, `Intl.RelativeTimeFormat`) | Already in Sidebar. |
| Mobile detection | A new media-query hook | `useIsMobile()` (768px) + `usePrefersReducedMotion()` | Both present; SSR-safe defaults (mobile=true, reduced=true). |
| Score chip tone | New color logic | `scoreTone()` (Sidebar.tsx:75) | Existing; tones map to data colors. Will need flat-warm reskin but logic stays. |

**Key insight:** Phase 1 is ~80% reskin + re-wire of proven code and ~20% genuinely new surface (the `/home` route + a simplified composer container + the serif/charcoal tokens). The highest-risk net-new work is the **composer simplification** (stripping `ContentForm`'s Score/Remix + model-tier + text-mode complexity down to URL+upload) and the **`@theme` flat-warm migration**. Everything else is wiring.

## Runtime State Inventory

> Phase 1 is **presentation-only** (CONTEXT: work in `src/components/**`, `src/app/**`, hooks, `globals.css`). It renames USER-FACING COPY ("Reading"→"Simulation") but does NOT rename any stored key, route param, table, or env var. Inventory below confirms no runtime-state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None affected.** The "Simulation" rename (D-09) is display-copy only. `analysis_results` table, `id` column, `variants` JSONB keys, query keys (`queryKeys.analysis.*`) are unchanged. No row stores the literal string "Reading" as a key. | None — verified: rename is in JSX/copy, not data. |
| Live service config | **None.** No external service config (n8n, Datadog, etc.) embeds "Reading"/"analyze". Middleware route strings are in git (`middleware.ts`). | None. |
| OS-registered state | **None.** No Task Scheduler / pm2 / cron embeds these strings (cron routes under `/api/cron/*` are unrelated to this rename). | None. |
| Secrets/env vars | **None.** localStorage keys: `virtuna-sidebar` (sidebar-store), `virtuna-perf-tier` (perf). Neither references "Reading"/"Simulation". If you rename the sidebar store's persist `name`, existing users lose their collapse pref (minor) — **recommend keeping `virtuna-sidebar`**. | None — keep `virtuna-sidebar` persist key. |
| Build artifacts | **None.** No compiled package names change. The Google serif font is build-time via `next/font`. | None. |

**The canonical question — after every file is updated, what runtime systems still have the old string cached/stored/registered?** Answer: **nothing.** "Reading"→"Simulation" is a pure presentation rename. The only persisted client state (`virtuna-sidebar`, `virtuna-perf-tier`) is orthogonal to the rename and should keep its key. `/analyze/[id]` stays as the route (no permalink rename in P1) so no bookmarks/history rows break.

## Common Pitfalls

### Pitfall 1: Tailwind v4 oklch dark-surface miscompile
**What goes wrong:** Authoring `--color-background: oklch(0.2 0.005 60)` (a warm charcoal) compiles to a visibly wrong color in `@theme`.
**Why:** Documented project bug — oklch with L<0.15 (and unreliably up to ~0.2 for dark tones) compiles incorrectly in Tailwind v4 `@theme` (CLAUDE.md). `[CITED: CLAUDE.md "Known Technical Issues"]`
**How to avoid:** Author ALL dark surface tokens as **exact hex** (`#262624`, `#1a1a18`, etc.). The existing file already does this for the gray ramp (L28–38 are hex with oklch noted in comments). Follow that precedent.
**Warning signs:** Surfaces look purple/blue/too-light in the browser vs the hex you intended.

### Pitfall 2: Lightning CSS strips `backdrop-filter` from classes
**What goes wrong:** A `backdrop-blur` Tailwind class silently does nothing.
**Why:** Lightning CSS (Tailwind v4's processor) strips `backdrop-filter` from compiled CSS classes (CLAUDE.md). The 3 sidebar glass spots already work around this by using inline `style={{ backdropFilter }}`. `[CITED: CLAUDE.md]`
**How to avoid:** Matte target = **no blur at all** (D-05/D-06), so the correct fix is to DELETE the blur, not move it. If any blur legitimately survives (it should not), apply via inline `style`.
**Warning signs:** Glass looks flat-but-wrong in production but fine in a non-Lightning context.

### Pitfall 3: Dev-server CSS cache masks token changes
**What goes wrong:** You edit `globals.css`, reload, and the old colors persist — leading to thrashing or "it didn't work" false negatives.
**Why:** Next dev server + `.next/` + `node_modules/.cache/` + browser cache hold stale compiled CSS (CLAUDE.md). `[CITED: CLAUDE.md]`
**How to avoid:** After token edits, the verification step must include: kill dev server → `rm -rf .next node_modules/.cache` → restart → hard-reload browser. **The planner should make this an explicit instruction in any task that edits `globals.css`**, and the UAT-gate task must start from a clean rebuild.
**Warning signs:** Colors change in the file but not the browser.

### Pitfall 4: Inline glass survives a token-only reskin
**What goes wrong:** You flatten all `--gradient-*`/`--shadow-glass` tokens, the app still shows glass on the sidebar.
**Why:** `Sidebar.tsx` hardcodes the 137deg gradient + blur + inset inline (C2/C3/C4) — tokens never touch it.
**How to avoid:** The plan MUST have a discrete task for Layer B (the 3 inline spots), separate from the Layer A token task. The UI-SPEC Glass Strip Map already separates them — preserve that split.
**Warning signs:** "Glass is gone everywhere except the sidebar."

### Pitfall 5: Composer complexity bleed
**What goes wrong:** Reusing `ContentForm` wholesale drags in the Score/Remix intent selector, the Apollo model-tier picker, the Text-mode tab, and Instagram URL acceptance — none of which P1's clean home wants (D-18, D-21).
**Why:** `ContentForm` is the mature board composer with features from later milestones.
**How to avoid:** Build a **new, slimmer composer** for the home that reuses the validated sub-parts (`VideoUpload`, the submit→navigate effect, the TikTok regex) but presents only: a text input (URL paste / future follow-up), a `+` upload control, and a submit. Reject non-TikTok URLs (D-21). Do NOT import the intent selector or model-tier picker. (The composer's eventual follow-up behavior is Phase 5 — P1 just needs the input + the two-layout position.)
**Warning signs:** The "clean Claude-style" home shows a Score/Remix toggle and an "Apollo Pro" dropdown.

### Pitfall 6: New home `/` collides with marketing
**What goes wrong:** Routing the authed home to `/` either shadows the public marketing page or forces middleware gymnastics.
**Why:** `/` is `(marketing)/page.tsx`, a `PUBLIC_PATH` (C16).
**How to avoid:** New authed home = `/home` (or `/app`) in the `(app)` group; repoint the authed-landing redirect there. Keep `/` public.
**Warning signs:** Logged-out users hit a 401/redirect on the landing page, or logged-in users see the marketing splash.

## Code Examples

### Wiring the serif font (THEME-04 / D-03 / R5)
```tsx
// Source: pattern mirrors existing Inter wiring in src/app/layout.tsx
import { Inter, Newsreader } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  style: ["normal", "italic"],   // italic needed for the name accent (UI-SPEC display row)
  weight: ["400"],                // serif uses 400 only (UI-SPEC Typography)
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      …
    </html>
  );
}
```
```css
/* globals.css @theme — add alongside --font-sans (L105) */
--font-serif: var(--font-serif), ui-serif, Georgia, serif;
```
Greeting usage: `<h1 className="font-serif">Ready to simulate your audience, <em>{name}</em>?</h1>` (Tailwind v4 generates `font-serif` from the `--font-serif` theme var).

### Reviving the sidebar collapse (D-14/D-16 / R3)
```tsx
// Source: replace src/components/sidebar/Sidebar.tsx:358 (`const effectiveCollapsed = false;`)
const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebarStore(); // store already has these (C5)
const isMobile = useIsMobile();                  // 768px breakpoint (existing hook)
// Desktop: collapse to icon rail; Mobile: never collapsed (it's a drawer, open/closed instead)
const effectiveCollapsed = !isMobile && isCollapsed;

// ⌘\ keybind (no handler exists today — add one)
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "\\") { e.preventDefault(); toggleCollapsed(); }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [toggleCollapsed]);
```
```tsx
// Source: src/components/app/app-shell.tsx — wire the offset (currently always 0px)
// (lift sidebar state to a shared read, or read the store here too)
const { isOpen, isCollapsed } = useSidebarStore();
const isMobile = useIsMobile();
const offset = isMobile ? "0px" : (isCollapsed ? "var(--sidebar-rail, 60px)" : "var(--sidebar-w, 220px)");
<main className="h-full overflow-auto" style={{ marginLeft: offset } as React.CSSProperties}>
```
Sidebar width today is `w-[220px]` (Sidebar.tsx:410); icon rail target ~56–64px (UI-SPEC Spacing). On mobile the sidebar stays the `fixed` translate-in drawer (D-15) — `effectiveCollapsed` is forced false and `isOpen` drives the slide.

### Flat-warm token re-base (THEME-01/02 / R2)
```css
/* globals.css — recommended approach: add charcoal primitives, repoint semantics.
   DO NOT overload the gray ramp (it's still used by data/score components). */
@theme {
  /* NEW flat-warm surface primitives (hex — Pitfall 1) — [UAT] values, Frame A */
  --color-charcoal-app: #262624;     /* dominant surface */
  --color-charcoal-sidebar: #1a1a18;
  --color-charcoal-composer: #1e1d1b;
  --color-charcoal-chip: #2f2e2b;

  /* Repoint semantics off the cold ramp onto charcoal */
  --color-background: var(--color-charcoal-app);    /* was var(--color-gray-950) #07080a, L69 */
  --color-surface: var(--color-charcoal-composer);  /* was #18191a, L71 */

  /* Coral → terracotta (mature hue 40 → ~35, L15–23) — [UAT] */
  --color-coral-500: oklch(0.68 0.13 33);  /* ≈ #d97757; verify at gate */

  /* DELETE / flatten (Glass Strip Map Layer A): */
  /* --gradient-glass (L195), --gradient-navbar (L194), --gradient-card-bg (L192),
     --gradient-feature (L196), --shadow-glass (L145), --shadow-glow-accent (L146);
     --shadow-button (L147): strip the two `inset … white` layers, keep a flat matte. */
}
```
Note: coral as oklch is fine (it's not a dark surface — L is ~0.68, well above the L<0.15 miscompile zone). Only the dark charcoal surfaces must be hex.

## State of the Art

| Old Approach (current code) | Phase-1 Approach | Why |
|--------------|------------------|-----|
| Raycast 137deg glass + blur + inset shine (tokens + 3 inline spots) | Flat-warm matte: tone-step + hairline, charcoal hex surfaces, whisper shadow only on floating | D-05/D-06; the entire visual thesis. |
| Inter-only typography | Inter + serif (Newsreader/Source Serif 4) for voice moments | D-03/THEME-04. |
| Cold `#07080a` base | Neutral charcoal `#262624` | D-01/D-02. |
| Sidebar = `fixed` overlay on all viewports, collapse dead | Desktop persistent+collapsible (content shifts), mobile drawer | D-14/D-15. |
| Coral `oklch(0.72 0.16 40)` (#FF7F50) | Terracotta `~#d97757` (hue ~33–37) | D-04. |
| Composer = `ContentForm` (Score/Remix + tiers + 3 tabs + IG) | Slim home composer: URL(TikTok-only)+upload+submit | D-18/D-21/D-22. |
| Result UI = Konva `<Board>` (canvas) | (Phase 2+) DOM thread above bottom-pinned composer | Canvas retired (milestone constraint); P1 only builds the shell/composer. |

**Deprecated/outdated (do not reuse):**
- `src/components/app/simulation/*` (HeroScore, ResultsPanel, LoadingPhases, AttentionBreakdown, etc.) — DEAD reference code (C17).
- `src/components/app/test-creation-flow.tsx` (`TestCreationFlow`) — unused.
- The Konva canvas board shell (pan/zoom) — retired this milestone (board *visual components* are reused as drill-downs in Phase 3, not the canvas).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/home` is the right new authed-landing path (D-23 leaves it to planner) | R1 | Low — any authed path in `(app)` works; `/home` is conventional. Planner/discuss may prefer `/app` or `/dashboard` (note `/dashboard` is 308-redirected to `/analyze` today — would need that redirect removed). Tag for planner confirmation. |
| A2 | Keep `/analyze/[id]` as the Simulation permalink in P1 (no `/s/[id]` rename) | R1 | Low — recommended to avoid churn; if product wants a pretty permalink it's a deferrable, explicit rename. Surfaced as a decision, not silently assumed. |
| A3 | Newsreader is the serif starting point (vs Source Serif 4) | R5 / Stack | None — explicitly UAT-gated (D-08). Either works; wiring is identical. |
| A4 | The post-login destination flows through middleware/auth-callback and changing the authed-landing means editing both `middleware.ts` line 130 (`/login`→`/analyze`) AND the auth callback redirect | R1 | Medium — IF a separate post-login redirect exists in `auth/callback/route.ts` it must ALSO be repointed. Planner should grep auth-callback for the landing target. (I traced middleware fully; did not exhaustively read `auth/callback/route.ts`.) |
| A5 | Charcoal hex values (#262624 etc.) are the Frame-A starting point, not final | R2 | None — all `[UAT]` per D-08; lock at THEME-06. |

**Note:** Every `[UAT]`-flagged value (hex ramp, coral, serif, score zones, greeting copy) is by-design provisional (D-08). These are NOT assumptions to confirm pre-build — they confirm at the gate. A1/A4 are the only items needing planner/discuss attention.

## Open Questions

1. **Exact authed-home path (`/home` vs `/app` vs reclaim `/dashboard`).**
   - What we know: D-23 leaves it to the planner; `/` is taken (public marketing); `/dashboard` is currently 308→`/analyze`.
   - What's unclear: product preference for the URL users see.
   - Recommendation: `/home`. If `/dashboard` is preferred for familiarity, the plan must remove the `/dashboard`→`/analyze` 308 (middleware L55–59) first.

2. **Does `auth/callback/route.ts` hardcode a post-login landing?** (A4)
   - What we know: middleware sends authed users off `/login`/`/signup` to `/analyze` (L130).
   - What's unclear: whether the OAuth callback also hardcodes `/analyze` as the final destination.
   - Recommendation: planner adds a grep/read of `src/app/auth/callback/route.ts` as the first task of the routing work; repoint any landing target to `/home`.

3. **Greeting loading/empty state.** `useProfile` is async; `profile?.name` is undefined on first paint.
   - What we know: Sidebar falls back `profile?.name ?? profile?.email ?? "Account"` (Sidebar.tsx:672).
   - Recommendation: greeting shows a serif skeleton (or name-less "Ready to simulate your audience?") while `isLoading`, then fills the name. Don't flash "[Name]". (Final copy is `[UAT]`.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node toolchain (next dev/build) | All | ✓ | next 16.1.5 | — |
| vitest | Validation | ✓ | ^4.0.18 | — |
| @playwright/test | UAT screenshots (THEME-06) | ✓ | ^1.58.0 | Manual browser review |
| Supabase (auth/profile/history) | SHELL-05/06, greeting | ✓ (project configured) | — | — (engine frozen; no new tables) |
| Google Fonts (Newsreader) | THEME-04 | ✓ (build-time via next/font) | — | Source Serif 4 (also Google) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None blocking. Serif choice is interchangeable.

## Validation Architecture

> nyquist_validation is enabled (`config.json` `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (`[VERIFIED: package.json]`) |
| Config file | `vitest.config.ts` (root) — `[VERIFIED]` |
| Environment | `node` default; component/hook tests opt into `happy-dom` via `/** @vitest-environment happy-dom */` pragma |
| Setup | `src/test/setup.ts` — jest-dom + vitest-axe matchers, ResizeObserver + matchMedia shims for Radix `[VERIFIED]` |
| Quick run command | `npx vitest run src/components/sidebar src/components/app/home` (scoped) |
| Full suite command | `npm test` (= `vitest run`) |
| Includes | `src/**/*.test.ts(x)`, `tests/**/*.test.ts`; excludes `_dormant/**` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | Home renders greeting (serif) + composer + NumenMark; no chips | unit (happy-dom) | `npx vitest run src/components/app/home/__tests__/home.test.tsx` | ❌ Wave 0 |
| SHELL-02 | URL paste of TikTok link → submit enabled; non-TikTok rejected with copy | unit | `npx vitest run src/components/app/home/__tests__/composer.test.tsx` | ❌ Wave 0 |
| SHELL-03 | `+` upload accepts MP4/MOV, rejects >200MB / wrong type | unit | reuse `src/components/app/__tests__/video-upload.test.tsx` (exists) + composer test | ✅ (video-upload) / ❌ composer Wave 0 |
| SHELL-04 | Composer position = centered when no id, bottom-pinned when id present | unit | `npx vitest run src/components/app/home/__tests__/composer-layout.test.tsx` | ❌ Wave 0 |
| SHELL-05 | Sidebar lists Simulations from `useAnalysisHistory`; score chips; no Pinned/Projects/Boards | unit | extend `src/components/sidebar/__tests__/Sidebar.recent.test.tsx` (exists) | ✅ (extend) |
| SHELL-05 | Desktop collapse toggles via ⌘\ + persists; mobile = drawer | unit | `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx` | ❌ Wave 0 |
| SHELL-06 | `/analyze/[id]` route restores shell from `usePermalinkAnalysis` | integration | existing permalink hooks have coverage; add shell-restore assertion | ⚠️ partial |
| SHELL-07 | Mobile (<768) = drawer; desktop = persistent (branch on `useIsMobile`) | unit | `Sidebar.collapse.test.tsx` (viewport-mocked) | ❌ Wave 0 |
| THEME-01..03 | Tokens compile (no `--gradient-glass`/`--shadow-glow-accent`); charcoal surfaces | manual + build | `npm run build` (compiles `globals.css`) + UAT visual | manual-only (visual) |
| THEME-02 | No `backdropFilter` / 137deg gradient remains in `Sidebar.tsx` | unit (source-grep) or a11y snapshot | a grep-based test asserting the 3 inline-glass styles are gone | ❌ Wave 0 (cheap) |
| THEME-04 | `--font-serif` defined; greeting uses `font-serif` | unit | `home.test.tsx` asserts greeting element class | ❌ Wave 0 |
| THEME-05 | Calm motion respects `usePrefersReducedMotion` | unit | composer/sidebar transition tests with reduced-motion mock | ❌ Wave 0 |
| THEME-06 | Human-UAT sign-off on built shell | **manual gate** | N/A — `checkpoint:human-verify` (see below) | N/A |

**Manual-only justification:** THEME-01/03 (exact color perception) and THEME-06 (taste sign-off) are inherently human-judgment — they cannot be asserted by an automated test (D-07/D-08 make this explicit). Automated coverage asserts *structural* facts (token absence, font var presence, no-glass-in-sidebar, composer position, sidebar composition); the *aesthetic* lock is the human gate.

### Sampling Rate
- **Per task commit:** scoped quick run, e.g. `npx vitest run src/components/sidebar` or `…/app/home`.
- **Per wave merge:** `npm test` (full suite green).
- **Phase gate:** full suite green + `npm run build` succeeds (proves `globals.css` compiles) BEFORE the THEME-06 human gate, then `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/components/app/home/__tests__/home.test.tsx` — SHELL-01, THEME-04 (greeting serif + NumenMark + no chips)
- [ ] `src/components/app/home/__tests__/composer.test.tsx` — SHELL-02/03 (TikTok-only reject, upload validation)
- [ ] `src/components/app/home/__tests__/composer-layout.test.tsx` — SHELL-04 (centered↔pinned)
- [ ] `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx` — SHELL-05/07 (⌘\ collapse + persist + mobile drawer)
- [ ] A cheap source-assertion test that `Sidebar.tsx` no longer contains `linear-gradient(137deg` or `backdropFilter` — THEME-02 Layer B regression guard
- [ ] Extend `Sidebar.recent.test.tsx` — assert "Simulations" label, no Pinned/Projects/Boards nodes
- [ ] (No framework install needed — Vitest + happy-dom + testing-library all present)

## Security Domain

> `security_enforcement` not present in `config.json` → treat as enabled. This phase is presentation-layer; the relevant trust boundaries are pre-existing and must be PRESERVED, not weakened.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (existing — preserve) |
|---------------|---------|-----------------|
| V2 Authentication | yes | Middleware + `(app)/layout.tsx` server-side `getUser()` redirect. The new `/home` route MUST stay inside `(app)` (or be added to `PROTECTED_PREFIXES`) so it's auth-gated. |
| V3 Session Management | no (unchanged) | Supabase SSR cookies — untouched. |
| V4 Access Control | yes | `/api/analysis/[id]` + history enforce `.eq("user_id", user.id)` (IDOR defense). Permalink restore (SHELL-06) MUST keep going through these routes — do NOT add a client-only fetch that skips the user_id scope. |
| V5 Input Validation | yes | TikTok URL regex (analyze route L465) + content-length 287MB cap (L416) + Zod `AnalysisInputSchema`. The new composer's client validation is UX; the server checks remain the boundary. D-21 narrows the *client* to TikTok-only. |
| V6 Cryptography | no | None introduced. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation (status) |
|---------|--------|---------------------|
| Open redirect on landing change (D-23) | Tampering | Middleware already uses same-origin `request.nextUrl.clone()` for the dashboard redirect (L57 comment cites V5). The new `/home` redirect must use the same same-origin pattern — never reflect a user-supplied `next` into the Location without validation. |
| IDOR on Simulation permalink | Information Disclosure | `.eq("id").eq("user_id")` on `/api/analysis/[id]` — PRESERVE (do not bypass for "faster" restore). |
| Auth bypass on new home | Spoofing | `/home` in `(app)` group inherits the layout's server `getUser()` gate; ALSO add to `PROTECTED_PREFIXES` in middleware for defense-in-depth. |
| Non-TikTok URL slips to engine | (cost) Tampering | Server regex L465 rejects; client D-21 reject is UX. Both stay. |

## THEME-06 Human-UAT Gate (D-07) — plannable task

**Make this a real `checkpoint:human-verify` task, not a checkbox.** Per UI-SPEC §THEME-06, the reviewable surface the plan must produce BEFORE the gate:

- The running app shell at the new home, showing BOTH:
  - **Empty state:** serif greeting ("Ready to simulate your audience, [Name]?") + centered composer + NumenMark stele glyph, no chips.
  - **Active layout:** composer bottom-pinned + sidebar of Simulations with score chips (use a real or seeded completed Simulation).
- On BOTH a **desktop width** (persistent sidebar, ~760px column) AND a **phone width** (drawer sidebar, full-width composer with gutters).
- With the Raycast **glass fully stripped** (no 137deg gradient, no blur, no inset shine, no glow) — verifiable by the THEME-02 regression test + eyes.
- Captured via Playwright screenshots (4 shots: desktop-empty, desktop-active, mobile-empty, mobile-active) attached to the gate for the human reviewer.

**What signs at the gate (the `[UAT]` fields):** exact charcoal hex ramp · exact coral hex · exact serif typeface (Newsreader vs Source Serif 4) · exact score-zone green/amber/red · greeting micro-copy. Until signed, downstream phases treat these as Frame-A provisional (do not propagate as final).

**Precondition for the gate task:** a clean rebuild (`rm -rf .next node_modules/.cache` → restart) per Pitfall 3, so the reviewer sees the true compiled tokens.

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on this phase |
|-----------|--------|----------------------|
| Tailwind v4 oklch L<0.15 compiles wrong → use hex for dark tokens | project CLAUDE.md | All charcoal surface tokens MUST be hex (Pitfall 1, R2). |
| Lightning CSS strips `backdrop-filter` → inline `style` | project CLAUDE.md | Matte = delete blur; if any survives, inline (Pitfall 2). |
| Dev-server CSS caching → kill server + clear `.next/`/cache | project CLAUDE.md | Verification + UAT tasks must clean-rebuild (Pitfall 3). |
| Server components by default, client only when interactive | project CLAUDE.md | `/home/page.tsx` = server shell; composer/greeting = `"use client"`. |
| Commit format `type(phase): description` | project CLAUDE.md | Plan commits as `feat(01): …` / `style(01): …`. |
| Files under 500 lines; no files in root; `/src` for source | global CLAUDE.md | New composer/greeting under `src/components/app/home/`; keep `Sidebar.tsx` under 500 after cuts (it's 756 now — cutting Pinned/Projects/Boards + Running stub helps; consider extracting `SidebarAccountSelector` if it pushes over). |
| Run tests after changes; verify build before commit | global + project CLAUDE.md | Maps to the Validation sampling rate above. |
| TDD London (mock-first) for new code | project CLAUDE.md | Wave 0 tests authored before the composer/sidebar-collapse implementation. |
| pnpm or npm; TypeScript; Tailwind; functional components + hooks | global CLAUDE.md | All satisfied by existing stack. |

## Sources

### Primary (HIGH confidence — live codebase, read 2026-06-13)
- `src/app/globals.css` — `@theme` token SSOT; verified all Glass Strip Map line numbers (L13–23, 69, 105, 145–147, 192–196).
- `src/components/sidebar/Sidebar.tsx` — verified L358 (`effectiveCollapsed=false`), inline glass L414–420 / L682–686 / L747–751, history wiring, cut targets.
- `src/stores/sidebar-store.ts` — verified `isOpen`/`isCollapsed`/`toggleCollapsed`/`setCollapsed`, persisted `virtuna-sidebar`.
- `src/components/app/app-shell.tsx` — verified 25 lines, `--sidebar-offset: 0px` declared-but-unread.
- `src/lib/supabase/middleware.ts` — verified `/dashboard`→`/analyze` 308 (L55–59), authed-page redirect (L130), PROTECTED/PUBLIC path lists.
- `src/components/brand/numen-logo.tsx` — verified `NumenMark` API.
- `src/hooks/queries/use-profile.ts` — verified `{ name, email, … }` shape.
- `src/hooks/queries/use-analyze.ts` — verified `useAnalysisHistory` / `useAnalyze` / `useAnalysisDetail`.
- `src/hooks/queries/use-permalink-analysis.ts` — verified permalink restore-by-id.
- `src/app/api/analyze/route.ts` — verified TikTok regex L465, nanoid id L842, SSE `started` L951, content-length cap L416, Zod parse.
- `src/app/api/analysis/[id]/route.ts` + `…/history/route.ts` — verified IDOR `.eq("user_id")`.
- `src/components/board/Board.tsx` — verified submit→navigate effect (L300–307), `handleContentSubmit` (L309–345).
- `src/components/app/content-form.tsx` — verified live composer (Score/Remix, tiers, IG-allowing `SOCIAL_URL_PATTERN` L106, `isOnResultRoute` L158).
- `src/components/app/video-upload.tsx` — verified reusable `VideoUpload` (`bare`, 200MB, type allowlist).
- `src/hooks/useIsMobile.ts`, `usePrefersReducedMotion.ts` — verified 768px / reduced-motion hooks.
- `src/app/layout.tsx` — verified Inter `next/font/google` → `--font-inter` wiring pattern.
- `vitest.config.ts`, `src/test/setup.ts` — verified test framework/setup.
- `supabase/migrations/20260213000000_content_intelligence.sql` — verified `analysis_results` schema (id UUID default, but route supplies nanoid).
- `package.json` — verified all dependency versions.
- App Router tree (`find src/app`) — verified `(app)`/`(marketing)`/`(onboarding)` groups; `/` is public marketing.
- `.planning/phases/01-foundation-shell/01-CONTEXT.md`, `01-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`.
- `CLAUDE.md` (project + global) — gotchas, conventions.

### Secondary / Tertiary
- None required — all claims grounded in primary sources (the live code). No web search needed; no library docs needed (no new packages; existing-stack patterns verified in-repo).

## Metadata

**Confidence breakdown:**
- Code claim verification (R1–R5): HIGH — every line number/claim read against the current file; corrections (C5/C16/C17) explicitly flagged.
- Standard stack: HIGH — versions from `package.json`; zero new installs.
- Architecture/patterns: HIGH — submit/permalink/restore loop read end-to-end in live code.
- Routing recommendation: MEDIUM-HIGH — `/home` is a sound default but the exact path + auth-callback landing (A4) need one planner grep to finalize.
- Pitfalls: HIGH — three are project-documented (CLAUDE.md); two derived from verified code (inline glass, composer complexity).

**Research date:** 2026-06-13
**Valid until:** ~2026-07-13 (stable — codebase + frozen engine; re-verify line numbers only if `Sidebar.tsx` or `globals.css` are edited before planning).
