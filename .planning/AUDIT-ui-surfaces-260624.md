# Visual UI/UX Audit — de-Claude track (2026-06-24)

> Live, logged-in audit of the **recolored** build (`923183a3` → merged `48ed16f1`), run at
> 1440×900 via Playwright against the running dev server. This is the durable record behind the
> delegated briefs. Screenshots: `.planning/audit/`. Backlog status lives in
> `HANDOFF-ui-restrained.md` §0; per-task specs in `BRIEF-P0-thread-shell.md`, `BRIEF-P2-library.md`.

## Headline
The recolor **succeeded** — the red flood is gone, primary actions are neutral cream, only the logo
mark + the single live presence dot stay red (correct per the locked dosage rule). But recoloring
**exposed the real problem: under the color, most surfaces are unstyled v1 drafts.** Exactly one
surface (the Reading) is actually designed. The remaining work is a **design/UX pass**, not more color.

## Per-surface findings

| Surface | State | Severity | Findings (non-color) | Shot |
|---------|-------|----------|----------------------|------|
| **Reading** `analyze/[id]` | **Designed ✅** | — | The quality bar: score gauge, watch-through/drop/finish strip, "How far it gets pushed" funnel, driver accordion w/ inline warnings. Got the v5.0 attention. ⚠️ funnel bars render green + warm-brown — verify charts use score-zone tokens, not stray terracotta. | `audit-04-reading.png` |
| **General chat / loading** | Worst 🔴 | High | Loading = the literal word **"Thinking…"** in plain gray, dead-center in empty space. **User's question is never echoed** (no message bubble). **No thread UI at all** — greeting stays pinned, answer dumped as a **raw unformatted wall of text** between greeting and composer. No bubbles, roles, avatars, turn separation. | `audit-06-chat-loading.png`, `audit-07-chat-result.png` |
| **Home** `/home` | Broken 🔴 | High | Skill output renders **inline with no card chrome**: orphaned "No standout outliers" text floating mid-page, outlier tiles (`18× / 12× / 6.7×`) **overflowing horizontally, cut off, labels jumbled**, full raw script paragraphs bleeding onto the canvas. Home = junk drawer of half-rendered results. | `audit-01-home.png` |
| **Audience** `/audience` | Scaffold 🟠 | Med-High | The flagship "your moat / hero object" rendered as a **plain CRUD list**: bare full-width rows (name + "Tiktok · Template" + `…`), no persona avatars/count, no calibration status, no constellation, no who-they-are preview. 2/3 of the viewport empty below. | `audit-03-audience.png` |
| **Library** `/library` | Scaffold 🟠 | Med | Filter tabs are flat low-contrast text w/ a barely-visible active pill, no per-type counts. Empty state = giant near-empty bordered box w/ prose floating in the top third (awkward centering, dead space), no icon, no CTA. Loading = plain "Loading your library…". No sort/search. | `audit-02-library.png` |
| **Skill menu** (composer) | OK ✅ | — | The `/`-command skill popover (Explore/Ideas/Hooks/Script/Remix/Test/Chat + descriptions) is solid — the locked composer UX. | `audit-05-skillmenu.png` |
| **Secondary** (code-audit, not re-shot) | Scaffold 🟠 | Low-Med | competitors table 4-col on mobile; referrals stats cramped; settings hardcodes `text-white`; brand-deals tabs. Same v1-draft tier. | — |

## Systemic patterns (root causes, not symptoms)
1. **No conversation/thread shell.** Chat + skills run inline on `/home` with the greeting persisting;
   no thread layout, no user-message echo, no message framing. Breaks chat AND every skill output.
2. **No shared "skill output card" / result container.** Each `*ThreadView` dumps its payload raw →
   overflow + no chrome (home Explore, chat).
3. **Loading states are an afterthought** — bare text ("Thinking…", "Pulling outliers…"), no skeletons,
   no branded motion. The mature `Constellation` (`audience-lens/audience-presence.tsx`) should own these.
4. **List/empty surfaces never got past scaffold** — audience, library, competitors are unstyled rows
   + prose boxes.
5. Only the Reading received component-level design love → it's the bar for everything else.

## Conflict map vs engine-rework (`rework/engine-core`) — verified via diff
Engine track touches **backend lanes only** — `src/lib/audience/**`, `src/app/api/audiences/**`,
`src/lib/scraping/**`, `src/lib/tools/runners/*`, `src/types/database.types.ts`, `supabase/migrations/**`
— **plus exactly two UI files**: `src/components/audience/calibration-flow.tsx` + `audience-reveal.tsx`.
Those two are the ONLY component-layer landmines. The recolor (160 files) did **not** touch them →
the two tracks merge clean. Block schemas/registry/renderer-props (D-14) and the stream hooks are
**engine-owned contracts** — UI work is relayout-only.

**Update 2026-06-24:** the contract was breached — engine commit `8c9f4111` (AudienceSignature) also
edited `src/components/app/home/composer.tsx` (+35) and `home-page-layout.tsx` (+34/−24), the two
files P0 rewrites (engine replaced the fixed-18vh anchor with a greeting-collapse + two-layout split).
**Resequenced: engine-rework merges to main first; P0 rebases on top and restarts.** Engine also did
the `G2` cut (deleted dead `src/components/app/simulation/*` — unused by the UI track) and is
code-complete on audience (Track A/B + intent lens + drift cron) → P1 audience near-unblocked.

## Prioritized backlog (full)
| Pri | Task | Brief | Status |
|-----|------|-------|--------|
| **P0** | Thread/conversation shell + `SkillResultCard` + greeting recede + branded loading (extract `Constellation`). Fixes chat + all 6 skill outputs + home in one move. | `BRIEF-P0-thread-shell.md` | Ready / in planning |
| **P2** | Library: segmented filter + counts, skeleton loading, designed empty state (constellation + CTA), card polish, neutral launch CTA. Flat guard (no folders). | `BRIEF-P2-library.md` | Queued after P0 |
| **P1** | Audience surface: CRUD-list → rich persona cards. | *(not written)* | **Blocked** on engine merge — depends on new persona/signature shape |
| — | Chart-recolor verify (funnel terracotta), mobile/responsive, settings `text-white` → token | minor batch | Fold into `/design-check`; later |

## Environment notes (how this audit was run)
- Worktree lacked `.env.local`; it lives only in `~/virtuna-v1.1` (main). Copied it into the run
  worktree to start dev. Dev server OOMs under the default 768MB cap — bump `--max-old-space-size`.
- Test login: `e2e-test@virtuna.local` / `e2e-test-password-2026` (from `e2e/create-test-user.ts`).
