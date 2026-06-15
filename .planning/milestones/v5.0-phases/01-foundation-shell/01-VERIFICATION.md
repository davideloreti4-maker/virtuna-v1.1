---
phase: 01-foundation-shell
verified: 2026-06-14T00:00:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
roadmap_divergence: # ROADMAP SCs predate the CONTEXT.md brief-overrides; verified against the override-corrected contract (CONTEXT.md wins for Phase 1, per its own statement + the phase verification context)
  - sc: "SC#1 — starter chips (Paste link · Upload · Try a demo)"
    resolution: "Intentionally overridden by D-18 (composer-only, no chips). CONTEXT.md L45 + L69 + L133: 'overrides SHELL-01's locked 3-chip spec'. PLAN 01-03 frontmatter encodes 'no chips' as the truth. Verified: home renders greeting + composer only, no chips."
  - sc: "Product noun 'Reading' (used throughout ROADMAP SCs + REQUIREMENTS.md)"
    resolution: "Intentionally overridden by D-09 ('Reading'→'Simulation', Davide vetoed 'Reading'). CONTEXT.md L29-30. Verified: all user-facing copy uses 'Simulation' (sidebar label, greeting, composer)."
  - sc: "SC#4 'warm-neutral hue'"
    resolution: "Refined by D-02 (neutral charcoal, not warm-brown; warmth from cream text + coral). CONTEXT.md L21 + L132. Verified: charcoal #262624 surfaces, cream #ece7de text, terracotta coral accent."
human_gate:
  requirement: THEME-06
  status: APPROVED
  method: "Live human review on the running dev server (localhost:3000), recorded in 01-05-SUMMARY.md. Screenshots were env-gated at capture time (0/4); the committed e2e/uat-theme06.spec.ts harness re-enables them. Per the phase verification context, the live approval satisfies THEME-06; the missing screenshot artifacts are a documented non-blocking follow-up, NOT a gap."
---

# Phase 1: Foundation & Shell Verification Report

**Phase Goal:** Flat-warm token system + the home/composer/sidebar shell the Reading lives in, locked by a human visual-UAT gate.
**Verified:** 2026-06-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is observably achieved in the codebase. The flat-warm `@theme` token system is migrated and provably compiles; the sidebar, home, composer, and authed-landing shell are built, wired, and behaviorally tested; and the THEME-06 human visual-UAT gate was reviewed live and signed off. Verified by reading every implementation file against the must_haves, running the Phase-1 test suites (37/37), running the full Vitest suite (1945 passed / 0 failed) independently, and running a clean production build (exit 0, `ƒ /home` emitted).

### Observable Truths

| #   | Truth (from PLAN must_haves) | Status | Evidence |
| --- | ---------------------------- | ------ | -------- |
| 1   | App background renders neutral charcoal (#262624), not cold #07080a (THEME-01) | ✓ VERIFIED | `globals.css` L45 `--color-charcoal-app: #262624` (hex, avoids oklch-L<0.15 miscompile); L85 `--color-background: var(--color-charcoal-app)`. Cream text #ece7de L51; terracotta coral oklch(0.68 0.13 33) L21. |
| 2   | Raycast glass fully stripped at token level — no 137deg gradient, glass/glow shadow, inset-shine (THEME-02 Layer A) | ✓ VERIFIED | `globals.css`: 0 `linear-gradient(137deg` declarations (the 2 string hits are removal-documenting comments L211/L214), 0 `--shadow-glass`, 0 `--shadow-glow-accent`, 0 inset-white in shadows, gradient-navbar/glass/feature removed. `--shadow-button` flattened to matte (L168). |
| 3   | Serif available as `--font-serif`, applied via font-serif utility (THEME-04) | ✓ VERIFIED | `layout.tsx` L2/L14-20 imports + configures `Newsreader` as `--font-newsreader` (400+italic), L53 `newsreader.variable` on `<html>`. `globals.css` L123 `--font-serif: var(--font-newsreader)...`. Consumed by greeting (`home-greeting.tsx` L41 `font-serif` h1). |
| 4   | Score zones (green/amber/red) retained as data colors (THEME-03) | ✓ VERIFIED | `globals.css` L57-59 success/warning/error raw oklch defined; L102-104 semantic tokens. 3 `--color-(success\|warning\|error):` declarations present. |
| 5   | Calm/soft motion, hairline borders, reduced-motion respected (THEME-05) | ✓ VERIFIED | Hairline `border-white/[0.06]` throughout sidebar/composer/app-shell; transitions gated on `usePrefersReducedMotion()` (Sidebar L178/L248, app-shell L24/L40, composer L54/L177). Duration/ease tokens reused. |
| 6   | Sidebar inline glass stripped — no 137deg gradient, no backdrop blur (THEME-02 Layer B) | ✓ VERIFIED | `Sidebar.tsx`: 0 `linear-gradient(137deg`, 0 `backdropFilter`. nav `bg-background-elevated border` (L243-244); popover `bg-surface-elevated shadow-float` (L445); hamburger flat (L503). `SidebarAccountSelector.tsx`: 0 glass. Source-grep guard test passes. |
| 7   | Desktop sidebar persistent + collapses to icon rail via Cmd-\, persisted across reload (SHELL-05/07) | ✓ VERIFIED | `Sidebar.tsx` L183 `effectiveCollapsed = !isMobile && isCollapsed` (NOT hardcoded false — 0 occurrences of `effectiveCollapsed = false`); L176 reads `useSidebarStore`; L187-196 Cmd/Ctrl-\ keydown → preventDefault + toggleCollapsed. Persist key `virtuna-sidebar` unchanged (`sidebar-store.ts` L29). `Sidebar.collapse.test.tsx` green. |
| 8   | Mobile (<768px) sidebar is a slide-in drawer with backdrop (SHELL-05/07) | ✓ VERIFIED | `Sidebar.tsx` L233-239 backdrop on `isOpen` calling `close()`; L249 `isOpen ? translate-x-0 : -translate-x-[calc(100%+12px)]` drawer. `effectiveCollapsed` excludes mobile (never the rail). |
| 9   | Sidebar lists past Simulations from useAnalysisHistory under "Simulations" label with score chips (SHELL-05) | ✓ VERIFIED | `Sidebar.tsx` L199 `useAnalysisHistory()`; L314 `<SectionLabel>Simulations</SectionLabel>`; L375-384 score chip via `scoreTone`; L323-324 empty copy "No simulations yet." Data source IDOR-defended (`/api/analysis/history` L24 `.eq("user_id", user.id)`). |
| 10  | No Pinned/Projects/Boards/Running dead affordances remain (D-11) | ✓ VERIFIED | `Sidebar.tsx`: 0 matches for Pinned/Coming soon/Boards label/Running. Header doc comment rewritten to lean composition (L3-17). |
| 11  | Main content shifts right by real sidebar width when expanded, resets to 0 on mobile (SHELL-07/D-14) | ✓ VERIFIED | `app-shell.tsx` L28-40: `offset = isMobile ? 0 : SIDEBAR_INSET + sidebarWidth + CONTENT_GUTTER`, applied as `marginLeft`. `"use client"`, reads `isCollapsed` + `useIsMobile`. No longer static `--sidebar-offset: 0px`. |
| 12  | First-time user lands on clean home: serif greeting + centered composer + NumenMark, no chips, no Simulation list (SHELL-01) | ✓ VERIFIED | `home/page.tsx` L24-32 renders `HomeGreeting` + `Composer` centered in `max-w-[760px]`, no chips/demo/list. `home-greeting.tsx` L34-36 NumenMark glyph (coral via text-accent), L39-53 font-serif h1, L50 italic name from useProfile, L45-47 name-less loading (no [Name] flash). |
| 13  | Pasting TikTok URL enables submit; non-TikTok rejected with D-21 copy (SHELL-02) | ✓ VERIFIED | `composer.tsx` L40 `TIKTOK_URL_PATTERN`; L73/L79 enables submit on valid TikTok; L74 `showUrlError` on non-empty non-TikTok; L45-46/L243-247 exact D-21 copy "Numen reads TikTok videos for now…", submit disabled. No Instagram. `composer.test.tsx` green. |
| 14  | The + control uploads a video reusing VideoUpload validation (SHELL-03) | ✓ VERIFIED | `composer.tsx` L191 `<VideoUpload bare .../>`; L196-210 + toggle; L97-128 upload path stages to Supabase storage + `stream.start({input_mode:"video_upload"})`. VideoUpload (`video-upload.tsx` L34/L62 `bare` prop, MP4/MOV/200MB) reused verbatim. |
| 15  | Submitting creates a Simulation, navigates to /analyze/[id]; composer drops to bottom-pinned there (SHELL-04/06) | ✓ VERIFIED | `composer.tsx` L85-92 navigate-on-id effect (lifted from Board) `router.push('/analyze/${id}')`; L120-128/L138-146 `stream.start(...)`. Two-layout L58-60/L161 `data-layout` centered/pinned from `useParams().id`. Permalink kept (not renamed). |
| 16  | Authed user landing post-login (or on auth page while signed in) is sent to /home, not /analyze (SHELL-06/D-23) | ✓ VERIFIED | `middleware.ts` L132-134 authed-on-auth-page → `new URL("/home", request.url)` (reachable via AUTH_PAGES carve-out L28/L73/L76, runs before public-skip); L64-68 /dashboard 308 → /home. `auth/callback/route.ts` L21 default `?? "/home"` (0 `?? "/dashboard"` remain). `middleware.landing.test.ts` green. |
| 17  | /home is auth-gated; unauthenticated /home → /login. /analyze stays reachable (SHELL-06/D-23) | ✓ VERIFIED | `middleware.ts` L13 `/home` in PROTECTED_PREFIXES; L142-148 unauthenticated protected → `/login?next=...`. `/home` NOT in PUBLIC_PATHS. `(app)/analyze/[id]/page.tsx` exists; build emits `ƒ /analyze` + `ƒ /analyze/[id]` (dormant-but-reachable). |
| 18  | Full Vitest suite green + clean build compiles the flat-warm @theme (SHELL-07/THEME-01/03/06) | ✓ VERIFIED | **Independently re-ran:** full suite = 1945 passed / 26 skipped / 0 failed (186 files); `next build` = "✓ Compiled successfully in 13.0s", exit 0, `ƒ /home` emitted. Not trusting SUMMARY claim — executed here. |
| 19  | Human reviews built shell and signs off [UAT] values as locked (THEME-06) | ✓ VERIFIED | THEME-06 = `checkpoint:human-verify` gate, APPROVED via live human review on running dev server (01-05-SUMMARY.md "Gate Outcome: APPROVED"). Locked value table recorded (charcoal ramp, coral, Newsreader, score zones, greeting copy). Per phase verification context, live approval satisfies the gate. |

**Score:** 19/19 underlying truths verified → 13/13 requirements satisfied

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/app/globals.css` | Flat-warm @theme SSOT, no glass/glow tokens, --font-serif | ✓ VERIFIED | 349 lines; charcoal hex + cream + terracotta + score zones + --shadow-float + --font-serif; glass fully stripped. Compiles (build exit 0). |
| `src/app/layout.tsx` | Newsreader wired as --font-serif | ✓ VERIFIED | Newsreader imported + configured + on `<html>` className. |
| `src/components/sidebar/Sidebar.tsx` | Flat-warm, Simulations list, score chips, revived collapse, glass stripped | ✓ VERIFIED | 510 lines; all behaviors present + wired; 0 glass/backdropFilter; consumes useSidebarStore/useAnalysisHistory. |
| `src/components/sidebar/SidebarAccountSelector.tsx` | @handle selector extracted, flat | ✓ VERIFIED | Created; 0 glass; consumes real useSocialAccounts. |
| `src/components/app/app-shell.tsx` | Main offset wired to real sidebar width | ✓ VERIFIED | "use client"; marginLeft computed from isCollapsed + useIsMobile (0 mobile). |
| `src/app/(app)/home/page.tsx` | Authed home rendering greeting + centered composer | ✓ VERIFIED | Server page in (app) group (inherits getUser gate); composes both pieces, no chips/demo/list. |
| `src/components/app/home/home-greeting.tsx` | Serif greeting, name from useProfile, NumenMark, isLoading skeleton | ✓ VERIFIED | font-serif + useProfile + NumenMark + name-less loading path. |
| `src/components/app/home/composer.tsx` | Slim TikTok+upload composer, two-layout, submit→navigate | ✓ VERIFIED | 250 lines; TikTok-only regex, VideoUpload bare, lifted navigate loop, data-layout. No ContentForm/intent/tier/IG. |
| `src/lib/supabase/middleware.ts` | Authed landing → /home; /home protected | ✓ VERIFIED | /home in PROTECTED_PREFIXES; authed-auth-page redirect → /home (made reachable); same-origin preserved. |
| `src/app/auth/callback/route.ts` | OAuth callback default → /home | ✓ VERIFIED | Default next `?? "/home"`; /welcome precedence kept; same-origin. |
| `e2e/uat-theme06.spec.ts` | Playwright UAT capture harness | ✓ VERIFIED (artifact present) | Committed; re-enables 4 screenshots once E2E creds + active id provided (non-blocking follow-up). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Sidebar.tsx | sidebar-store.ts | useSidebarStore (isCollapsed/toggleCollapsed) | ✓ WIRED | L176 reads store; L191 calls toggleCollapsed. Not hardcoded false. |
| app-shell.tsx | sidebar-store.ts | read isCollapsed → marginLeft offset | ✓ WIRED | L22 reads isCollapsed; L29/L39 computes + applies marginLeft. |
| Sidebar.tsx | useAnalysisHistory | Simulations rows → /analyze/[id] | ✓ WIRED | L199 hook; L336 `router.push('/analyze/${board.id}')`. |
| composer.tsx | /api/analyze (stream.start + navigate effect) | submit→create→navigate | ✓ WIRED | L120-146 stream.start; L85-92 navigate-on-id → /analyze/[id]. |
| composer.tsx | video-upload.tsx | VideoUpload bare for + upload | ✓ WIRED | L31 import; L191 mounted with bare. |
| home-greeting.tsx | use-profile.ts | useProfile() name | ✓ WIRED | L21 import; L28 useProfile; L50 renders name. |
| middleware.ts | /home | authed redirect + PROTECTED_PREFIXES | ✓ WIRED | L13 + L133 same-origin. |
| auth/callback/route.ts | /home | default landing | ✓ WIRED | L21 default; L74 same-origin redirect. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Sidebar.tsx | historyData (Simulations list) | useAnalysisHistory → /api/analysis/history (`.eq user_id`) | Yes — real DB-backed history, IDOR-scoped | ✓ FLOWING |
| home-greeting.tsx | profile.name | useProfile → TanStack query | Yes — real profile; name-less fallback while loading (not a stub) | ✓ FLOWING |
| composer.tsx | stream.analysisId | useAnalysisStream → POST /api/analyze SSE started{id} | Yes — server-originated nanoid; drives navigation | ✓ FLOWING |
| composer.tsx | file (upload) | VideoUpload onFileSelect → Supabase storage → stream.start | Yes — real upload path + storage | ✓ FLOWING |

No HOLLOW or DISCONNECTED artifacts. The composer's active-state input placeholder ("Ask about this simulation…") is a plan-sanctioned forward seam — the follow-up *behavior* is Phase 5; the input itself is the real two-layout artifact (SHELL-04), not an empty-data stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase-1 test suites (sidebar+home+middleware) | `vitest run src/components/sidebar src/components/app/home src/lib/supabase` | 8 files / 37 tests passed | ✓ PASS |
| Full regression suite | `vitest run` | 1945 passed / 26 skipped / 0 failed (186 files) | ✓ PASS |
| Flat-warm @theme compiles | `next build` | "✓ Compiled successfully in 13.0s", exit 0 | ✓ PASS |
| Home route born auth-gated | build route table | `ƒ /home` emitted (server-rendered on demand, in (app) group) | ✓ PASS |
| /analyze permalink dormant-but-reachable | build route table | `ƒ /analyze` + `ƒ /analyze/[id]` emitted (not deleted) | ✓ PASS |
| Glass-strip source invariant | grep on globals.css + Sidebar.tsx | 0 `linear-gradient(137deg` declarations, 0 backdropFilter | ✓ PASS |

### Requirements Coverage

All 13 Phase-1 requirement IDs from PLAN frontmatter cross-referenced against REQUIREMENTS.md. Every ID is accounted for; no orphans (REQUIREMENTS.md maps exactly 13 IDs to Phase 1).

| Requirement | Source Plan(s) | Description (REQUIREMENTS.md) | Status | Evidence |
| ----------- | -------------- | ----------------------------- | ------ | -------- |
| SHELL-01 | 01-03 | Clean home: serif greeting + composer + glyph (note: chips overridden by D-18) | ✓ SATISFIED | home/page.tsx + home-greeting.tsx (truths 12). Chip omission is the documented D-18 override. |
| SHELL-02 | 01-03 | Start a Reading by pasting a video URL | ✓ SATISFIED | composer.tsx TikTok regex (truth 13). |
| SHELL-03 | 01-03 | Start by uploading via composer + control | ✓ SATISFIED | composer.tsx VideoUpload (truth 14). |
| SHELL-04 | 01-03 | Composer drops bottom-pinned once Reading exists | ✓ SATISFIED | composer.tsx data-layout (truth 15). |
| SHELL-05 | 01-02 | Past Readings sidebar — collapsible desktop, drawer mobile, from useAnalysisHistory | ✓ SATISFIED | Sidebar.tsx (truths 7,8,9). |
| SHELL-06 | 01-03, 01-04 | Reopen a past Reading via permalink | ✓ SATISFIED | composer navigate + /analyze/[id] kept + landing repoint (truths 15,16,17). |
| SHELL-07 | 01-02, 01-05 | Mobile-first; desktop = same shell widened | ✓ SATISFIED | app-shell offset + mobile drawer + 760px column (truths 8,11); build green. |
| THEME-01 | 01-01, 01-05 | Flat-warm token system replaces cold base, matte | ✓ SATISFIED | globals.css charcoal (truth 1); build compiles. |
| THEME-02 | 01-01, 01-02 | Raycast glass removed everywhere incl. sidebar | ✓ SATISFIED | Layer A (truth 2) + Layer B (truth 6). |
| THEME-03 | 01-01, 01-05 | Score zones + evolved coral are only colors | ✓ SATISFIED | globals.css score zones + terracotta (truths 1,4). |
| THEME-04 | 01-01, 01-03 | Serif for voice moments, sans for data | ✓ SATISFIED | Newsreader wired + greeting consumes (truth 3). |
| THEME-05 | 01-01..04 | Hairline borders, calm motion, reduced-motion | ✓ SATISFIED | Throughout (truth 5). |
| THEME-06 | 01-05 | Flat-warm passes explicit human-UAT gate | ✓ SATISFIED | Live human review APPROVED (truth 19). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | Zero debt markers (TBD/FIXME/XXX), zero warning markers (TODO/HACK/PLACEHOLDER/coming soon/not implemented), zero stub indicators (return null / empty impl) across all 10 Phase-1 source files. The 32 `[UAT]` markers in globals.css are intentional design provisionals (now locked at THEME-06), not debt — they do not match any debt-marker pattern. |

### Human Verification Required

None outstanding. THEME-06 — the phase's only human-verify gate — was executed and **APPROVED via live human review** on the running shell (recorded in 01-05-SUMMARY.md). The live approval satisfies the gate per the phase verification context. The 4 Playwright screenshots (0/4 captured, env-gated) are a documented non-blocking follow-up via the committed `e2e/uat-theme06.spec.ts` harness — not a verification gap.

### Deferred / Out-of-Scope (noted, not failing the phase)

These are logged in `deferred-items.md` and confirmed out-of-scope for Phase 1 per the phase verification context — noted, not counted as gaps:

| Item | Reason out-of-scope |
| ---- | ------------------- |
| Marketing-page consumers of removed `--gradient-navbar` (header.tsx, showcase/page.tsx) | Phase 1 scope = app shell, not marketing. Build unaffected (dangling var() resolves empty). |
| Pre-existing `tsc --noEmit` errors in engine/board test fixtures (12 errors) | Untouched FROZEN engine area; Phase-1 files type-check clean; Vitest (esbuild) green. |
| Sidebar score-chip token unification (emerald-400/amber-400 vs --color-success/warning/error) | Phase-2 nit — unify when the hero zone-colored score lands. |
| /analyze/[id] BOARD route still shows the old board | Intentional — its reskin to the Reading view is Phase 2 (explicitly out of Phase 1 scope). |
| 4 UAT screenshots not captured | Env-gated; gate satisfied via live review; harness committed for future runs. |

### Gaps Summary

No gaps. All 13 Phase-1 requirements are satisfied with verified, substantive, wired, data-flowing artifacts. The flat-warm token system migrated and provably compiles (independent build exit 0); the sidebar/home/composer/landing shell is built and behaviorally tested (independent full suite 1945/0); the THEME-06 human visual-UAT gate was reviewed live and approved. The ROADMAP success criteria divergences (starter chips, "Reading"→"Simulation" noun, warm-neutral→neutral-charcoal hue) are intentional, documented brief-overrides recorded in CONTEXT.md (which explicitly states it wins over the brief for Phase 1) and encoded as the PLAN must_haves — verified against the corrected contract, not flagged as gaps.

---

_Verified: 2026-06-14_
_Verifier: Claude (gsd-verifier)_
