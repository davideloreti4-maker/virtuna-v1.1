# Handoff — hero iterations, unresolved (2026-07-27, session 7)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` (pushed)
**Green:** suite 423 files / 0 fail BOTH flag ways after every commit · `tsc` 0 · lint clean

> Reads on top of `HANDOFF-2026-07-26-checkout-and-claim.md` (session 6 — checkout + claim +
> reaper, all still accurate and untouched today). Design SSOT `ONBOARDING-FUNNEL-DESIGN.md` §0b.
> ⛔ `HANDOFF-2026-07-24-onboarding-funnel.md` is still the retired walkthrough.

---

## 1. The state of the hero, in one line

The /go hero is structurally right (live composer, centered, no $1 above the fold) but its
"show me what this is" layer has been through THREE concepts today and **the owner has
accepted none of them** — the current HeroDemo loop ships in the tree but is explicitly
"not something a billion dollar company would release."

## 2. What happened today (4 commits, chronological)

1. **Merge `origin/main`** — brought the corrected v2 room panel (`853b6560` + `433365c3`,
   the one the owner approved after 3 corrections on lane/offer-below-hero) + the F-019
   composer thread fix. Conflict only on `ambient-panel.tsx`, resolved wholesale to main's.
   The "old design" the owner kept seeing was this branch's stale pre-433365c3 panel.
2. **`feat(offer): the entry IS the hero`** — killed the side-by-side pairing (composer
   centered, max-w 640, natural height), demoted the room to a pull-up sheet, **removed the
   hero's "Test your first video — $1" → #pricing button** (it siphoned fold traffic away
   from the flow and contradicted "free, no account"). Below-fold $1 CTAs untouched.
3. **`feat(offer): ASK → GET → PROOF`** — heading row ("Test a video" + "Free · no account"
   badge) replacing the caps eyebrow, plus a static sample-read strip (38.2% · 0:04 · the
   fix, verbatim from `CREATOR_TEMPLATE`). **Owner removed the strip next round.**
4. **`feat(offer): HeroDemo`** — a ~9s looping three-beat demo under the composer (link
   types itself → progress sweep with stage language → verdict staggers in). Honest (DEMO
   chip), reduced-motion safe, freezes one-way when focus enters the real composer.
   **Owner: "doesnt look like something a billion dollar company would release."**

## 3. The owner's feedback trail — READ THIS BEFORE TOUCHING THE HERO

Chronological, near-verbatim, all 2026-07-27:

1. *"the rail is still old design. the composer with rail next to it doesnt look that good
   either. we want traffic actually go into the flow"*
2. *"lets improve the hero better ui design concept, let refine and optimize. for fresh
   traffic the page is unclear"*
3. *"Remove the section under the composer again, and lets rethink the concept. I like the
   composer on the hero, but we need some sort of demo for the user or a interactive model
   because when you go on the page freshly, you don't know exactly what to do as a user. So
   we need some kind of animation or similar. premium and conversion optimized"*
4. *"doesnt look like something a billion dollar comany would release"*

**What is STABLE across all four:** the live composer stays in the hero; the entry must be
the fold's job; a fresh visitor must be SHOWN what the product does without reading.
**What keeps failing:** every "show" layer so far — stale panel, static strip, abstracted
mini-demo — reads as under-produced next to the serif headline. The pattern in the misses:
abstractions of the product instead of the product. The next candidate should probably be
the REAL surface at full fidelity (the actual Test card / the actual room, rendered
beautifully — `ProductRender` (297 lines, browser chrome + BorderBeam + guided build-motion,
unreferenced but alive in the tree) was the last version of that idea and was the original
"wow"; a re-dressed successor of it, or a full-fidelity live-looking run, is the obvious
direction). Do NOT re-propose: side-by-side always-on panel (rejected ×2), static figure
strip (rejected), wireframe-grade mini-demo (rejected).

## 4. NEXT SESSION'S MISSION (owner-stated)

*"i want to refine the landing page and complete user flow from landing into platform and
first steps"* — two workstreams:

**A. The landing (/go)** — a premium hero "show" layer (see §3), then the below-fold story:
   - below-fold sections still carry "$1" CTA copy vs the hero's free entry (owner call
     raised sessions 4–6, still open);
   - `shot-stages.tsx` how-it-works webps still capture the LEGACY room (stale vs v2 —
     flagged in memory `offer-page-below-hero`).

**B. Landing → platform → first steps** (most pieces EXIST, sessions 4–6; what's missing is
   the connective polish):
   - submit → anon → /home thread → Test runs FREE → seals in-thread ✅ (session 4)
   - verdict sealed server-side, sealed drill + $1 CTA + checkout + claim ✅ (sessions 5–6)
   - **post-link return UX** — after OAuth the visitor lands /home with the thread unsealed
     but nothing celebrates or auto-opens the verdict they paid for (session-6 §4.1, top
     of the NOT-built list);
   - **first-steps surface** for a fresh anon /home visit (the starter-grid owner question);
   - the demo-pool sharp edge: pool = ONE Reading, verb menu open ⇒ one 1-credit hook
     forecloses the free Test forever (402). Owner call pending;
   - webhook sandbox pass + reaper scheduling (owner/reconnect-gated).

## 5. Session start block for next session

Copy-paste is in the final session message (also mirrored in memory
`onboarding-funnel-milestone`).

## 6. Landmines (all carried, unchanged)

- `npm test` is FAKE — `node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways.
- Dev server left RUNNING on :3000 (nohup, `NEXT_PUBLIC_AMBIENT_V2=true
  AMBIENT_V2_ENABLED=true`) — it has died twice this session; if :3000 refuses, restart it.
- 🔴 THREE worktrees serve /go — THIS work is :3000; `~/virtuna-maven-offer` on :3020 does
  NOT have it. (The hero-showcase merge conflict with lane/maven-offer is now MOOT — main
  was merged in today; verify at lane merge time anyway.)
- A seeded preview thread lives in prod DB: `threads` "Preview — tested video"
  (`52b05aa9-…`, user `85d55906-…`, 2 messages) — kept for wall previews; delete when done.
- The Playwright MCP profile PERSISTS the anon cookie — "fresh visitor" may be an old anon
  user; check the JWT sub. Still 6 anon auth rows.
- `.env.local` here lacks ALL Whop vars — funnel checkout 503s locally (stub it in browser
  checks). ⛔ Never `npx supabase config push`.
- Merging to main still deletes 143 inherited `.planning/` files — recipe in session-4's
  handoff §6.
- Confidence-rises-as-signals-disappear: untraced, behind the wall.
