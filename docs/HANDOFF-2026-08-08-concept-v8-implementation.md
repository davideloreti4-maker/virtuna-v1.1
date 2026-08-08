# Handoff — implement platform concept v8 (lane/platform-concept)

> **Written 2026-08-08 at the end of the concept session. This is the SSOT for the
> implementation.** The concept was settled with the owner over eight mock iterations in one
> session; the owner's close: *"other than that it's pretty good — prepare the handoff to
> implement everything in a fresh context."*
>
> **Document chain (precedence order):**
> 1. This handoff — decisions + build order + cautions.
> 2. `docs/superpowers/specs/2026-08-08-platform-concept-v2-design.md` — the design spec.
>    Read the revision blocks (v8 → v3) at the top FIRST: later revisions override earlier
>    text below them.
> 3. `docs/mockups/concept-v2-2026-08-08.html` — the v8 mock (also published:
>    https://claude.ai/code/artifact/6577804a-bc6d-41b2-ad0c-9e5c8cd0fd17). **Visual contract
>    for layout/anatomy ONLY — see §5 cautions.**
> 4. `docs/HANDOFF-2026-08-08-platform-concept.md` — the prior strategy handoff. Its §2
>    verified findings and §3 what-not-to-do REMAIN BINDING except where this document
>    supersedes them.

---

## 1. The concept in one page

**The spine:** proven format → adapted into *your* niche → scored by *your* audience.
Chat stays the work surface; the front door leads with output, not input. Mobile-first.

- **Arrival (`/home` empty state): "Tonight's remixes."** Six video-first cards — real outlier
  videos (source still + view count), each with its hook already adapted to the user's niche and
  a pre-run sim score. One action per card: **Remix**. Single-column scroll on mobile, 2-col on
  desktop, composer docked below. Rotating example chips + **More ▸** under the composer.
  Nothing else on the page. The current `AmbientStartHome` arrival (config chips + skill menu)
  dies.
- **The composer (one component everywhere):** field · foot (⊕ attach · skill pill (icon+▾) ·
  … · model selector "SIM-1 Flash ▾" · send) · **attached sub-bar** (hairline strip: avatars +
  "Your people · TikTok ▾" ←audience sheet | **"Simulate ›"** ←the report; "watching…" while a
  fired run is in flight). Nothing above the field, ever.
- **Skills:** auto-routing is the only *required* path (routing exists in the product today).
  Discovery: the skill pill and typing **/** open the **skills panel** — two-pane (list grouped
  Make/Test/Research + preview with one-paragraph promise + **Use**); mobile = same content as a
  sheet; `/` autocompletes inline and Enter turns the skill into a dismissible box in the field.
  A bare pasted video link is the one ambiguous input → two inline chips (Test it / Remix it).
- **The sim: fire-on-demand, three presences.** ⚠️ Generation NEVER auto-simulates. Only the
  nightly drops arrive pre-scored (the proactive pipe). Presences: **meters on simulated cards**
  (ambient) · **the verdict report** — three tabs Audience / Brain / Engagement, sheet on
  mobile, overlay + **pinnable** on desktop (contextual) · **the Audience surface** — the ten
  people, accuracy ledger (predicted vs actual from real reconciliations), recalibration
  (permanent). The persistent desktop rail retires; `fireSim` + sealed-verdict law carry over
  untouched.
- **Thread:** normal chat. Remix's first turn = the skill's real output (exactly 3 adapted
  angles, `adapt.ts`), unscored, staged as a stack; actions: Script the first · Simulate.
  Steering in plain language; versions stack (append-only). Context bar: back + job name.
  Audience/platform per run still stamped in data (`runHeaderBlock`).
- **Audience & platform:** audience = portable identity (one per connected account, or described;
  a described audience IS an ad target segment). Platform = run-level lens; `audiences.platform`
  reinterpreted as provenance; lens ≠ provenance → quiet "calibrated on X — extrapolating",
  never a block. Switching applies next-run-only.
- **Day 0:** role toggle (Creator · Brand · Ads → workspace flavor) → **create the first
  audience** (Connect TikTok / Connect Instagram / Describe them) → "Meet your people" reveal →
  straight into the shelf. Describe-path with no niche → one question ("what could you talk
  about for 20 minutes?") → three-lanes reveal; picking content picks the lane.
- **Advertiser flavor:** same product — catalog reorders, chips swap, drops become proven *ad*
  formats for the offer, audiences are segments, **A/B compare = Test with two inputs** (verdict
  names winner + reason; one tap to re-run against another segment). Overnight agent loops
  (generate→sim→iterate to a bar) are a *behavior on existing jobs* later, not a surface — paid
  tier, post-MVP.

## 2. Owner decisions ledger (this session, chronological)

1. Full rethink mandate; bar = "what a billion-dollar company would release" (Claude/Perplexity).
2. Wow spine = "land and it's done" + "paste → your version" + "it finds your lane" (one
   mechanic, three moments). The audience vote is the stamp, not the headline.
3. **Frame: content-first, chat inside** (option 1 of 3, owner-picked).
4. **Six cards** on the shelf (not three). Mobile-first design order accepted.
5. **Thread stays a chat**; card-first rendering rejected.
6. Sim: verdict-as-event accepted, then evolved (see 12).
7. Composer anatomy: nothing above the field (Claude/Perplexity restraint); premium bar.
8. **Drop cards must carry source-video thumbnails** (+ view counts); typographic-only rejected.
9. Skills must be discoverable by fresh users; four-verb mode row tried and **rejected** (can't
   tell users what's inside); catalog-behind-⊕ tried and **rejected** (⊕ = media convention).
10. **No skill selection required — auto-routing is primary** (already implemented). Slash
    commands + skills panel (Perplexity two-pane reference) for discovery. Skill pill = roomy
    icon+chevron pill (cramped chip rejected; bare glyph rejected).
11. **Model selector always visible** next to send ("SIM-1 Flash ▾"); carries price on Max.
12. **Sim is fire-on-demand** — generations carry NO auto score; sub-bar right half is the
    "Simulate ›" door (not a score readout); drops are the only pre-scored surface. Sim's
    permanent home = Audience surface; report pinnable on desktop; report = Audience/Brain/
    Engagement tabs (the old rail's depth, restored as tabs).
13. **Audience+sim live in the composer's attached sub-bar** (Claude-Cowork pattern ≈ the
    shipped mobile dock, refined). Top bar returns to nav. Audience sheet: audiences +
    provenance + "+ New audience" + platform segmented control.
14. **Scope: creators + social-media marketers + advertisers now** (workspace flavors, segments,
    A/B compare, ADS-badged catalog rows).
15. Onboarding leads with **creating the first audience**; role toggle sets flavor.
16. Agent harnesses: behavior on existing jobs ("keep going overnight"), never a surface; post-MVP.

## 3. Existing machinery this maps onto (verified in the prior handoff, do not rebuild)

| Concept piece | Existing code |
|---|---|
| Nightly drops content | curated corpus `public.outlier_teardowns` (211 printable rows) + `src/lib/grounding/rank.ts` round-robin |
| Drop pre-scoring + daily cache | `getFreshSurfaceCards` / `use-lazy-warm` (surfaces system, live on old `/start`) |
| Remix 3 angles | `src/lib/engine/remix/adapt.ts` (Zod `.length(3)`) + `decode.ts` (D-01 strips luck) |
| Sim + sealed verdict | `fireSim` + sealed-verdict law (`AmbientOverviewRail` — the LAW survives, the rail UI retires) |
| Report depth tabs | the rail's Brain/Engagement/Audience views + WebGL brain, relocated |
| Accuracy ledger | FLYWHEEL reconciliations (`buildLoopReceipts` / `buildLoopAccuracy`) |
| Run stamps | `runHeaderBlock` (persisted, never rendered — render optional, data binding stays) |
| Placeholder per skill | `PLACEHOLDER_BY_TOOL` (load-bearing copy) |
| Audience calibration | existing onboarding calibration + `audiences` schema (`platform`→provenance needs NO migration; `source_account_id` exists) |
| Auto-routing | the implemented agent routing (owner: "we have auto agent routing implemented") |

## 4. Suggested build order (each phase flagged, gated, shippable)

1. **Composer v8** — one component: field/foot/sub-bar, skill pill + panel + `/` autocomplete,
   model selector, chips row. Wire sub-bar halves to the audience sheet + report. Retire
   `AmbientStartHome`'s config-and-skills arrival behind the same flag.
2. **The shelf** — remix-first drop cards over the existing daily-surface cache; thumbnails from
   rehosted source stills; Remix → thread seeded with the 3-angle turn (render treatment).
3. **The report** — three-tab sheet/panel from the rail's existing views; pinnable on desktop;
   Simulate actions on cards (fire-on-demand); rail retirement completes here.
4. **Audience surface** — people + traits, accuracy ledger, recalibration; sub-bar/report links.
5. **Day-0** — audience-first onboarding + role toggle + lanes (needs the lane-synthesis
   producer — new build).
6. **Advertiser flavor + A/B compare** — workspace flavoring, segments language, two-input Test.

## 5. ⚠️ Cautions — the mock contains OLD/illustrative content (owner's explicit warning)

The mock is authoritative for **layout, anatomy, and interaction shape only**. Do NOT transcribe
its content into the product. Known illustrative/stale items:

- All copy, hooks, personas, niches, view counts, scores, "87% match", trait chips — fabricated.
- Thumbnails are CSS stand-ins; production uses real rehosted source stills.
- The brain visual is a stand-in for the existing WebGL cortex.
- The skills-panel row list is a sketch of the taxonomy, NOT the shipped skill registry — build
  the panel from the real registry + routing table, and reconcile names with the owner.
- "12 cr" pricing, credit figures — unverified; pull from the real pricing table.
- §7 Audience-surface details (persona one-liners, ledger wording) — direction, not spec.
- Any meter shown on a non-drop card in older sections = pre-v8 leftovers; fire-on-demand rule
  (spec v8 block) wins.
- Marketing labels ("Tonight's remixes", lane names, "Meet your people") are direction-grade
  copy — good enough to ship behind a flag, but owner reviews copy before launch.

**When the mock and the spec's revision blocks disagree, the spec wins. When new scope is
implied by a mock detail, ask the owner instead of building it.**

## 6. Binding constraints carried forward (do not re-litigate)

- **No corpus multiplier number anywhere** until the owner settles its basis
  (prior handoff §2.4: `follower_count` NULL on all rows; `baseline_label` = "vs their usual
  views"). View counts + sim scores are the only numbers.
- **Donor domain/niche never shown.** Curated teardown prose never shown verbatim (corpus
  decisions). WARRANT vs CLAIM stays split.
- **Accent dosage locked:** the live-presence dot is the only accent on these surfaces; primary
  actions neutral cream; matte; no `#fff`. Token drift guard stays green.
- **The Flash SIM is platform-blind** (`buildReactionPanel` has no platform) — the platform lens
  changes generation prompts only until that's built. Never imply the verdict moved with the lens.
- **Grounded generation has never run** (`GROUNDING_*_ENABLED` off) — flip in sandbox and read
  output before building the drops pipe on it (`scripts/preview-grounding-slices.ts`).
- **Drop economics**: six adapt+sim per user per day, cached once/day/audience;
  `BILLING_ENFORCE_QUOTA` is live (free tier `limit:0`); get a real cost number before launch.
- **Don't fire sims per keystroke; debounce; every room reaction costs credits.**
- Apify stays off the critical path (drops come from the curated corpus, not scraping).

## 7. Open owner calls (unchanged, blocking where noted)

1. **Multiplier basis** — blocks printing any corpus number.
2. **"Move calendar and your plan"** was executed as *delete* on an unconfirmed reading of a
   2026-08-08 instruction — the working-tree `/start` trim is wrong if "relocate" was meant.
3. Drop economics / free-tier stance.
4. Does the decode survive cross-domain adaptation? (cheap test: ~20 rows × 3 domains, read output)
5. Library size / cadence / curator for the corpus; saturation controls before scale.
6. Skill-panel taxonomy naming vs the real registry (see §5).

## 8. Ops notes for the implementing session

- Worktree `~/virtuna-platform-concept`, branch `lane/platform-concept` (forked from `main`
  @ `1be28832`). Own `.env.local` + `npm install` already done. One dev server per port
  (`lsof -ti:3000`, use `--port 300X`); a launchd reaper kills idle dev servers after 10 min.
- The working tree carries **uncommitted `src/` changes** (the restored `/start` review build
  from 2026-08-08). The v8 concept absorbs that page's live pieces into `/home`; do not build
  on `/start` — decide with the owner whether to keep or drop those edits before Phase 2.
- Gates before any push: `tsc --noEmit` · `npm run build` · tests. A green Vercel check is NOT
  a build. ⚠️ Memory says Vercel git was DISCONNECTED again as of 2026-08-08 — verify deploy
  behavior, don't assume merging deploys.
- `main` moves while you work: `git fetch` + re-measure before PRs.
- Verify UI signed-in in a real browser (see memory: signed-in verification recipe; Playwright
  needs `animations:'disabled'` here). Mobile checks need a native-size browser context.

## 9. Kickoff prompt for the fresh implementation session

```
Implementation session for the settled platform concept v8, worktree
~/virtuna-platform-concept (branch lane/platform-concept).

Read, in order:
1. docs/HANDOFF-2026-08-08-concept-v8-implementation.md  (SSOT — decisions, build order, cautions)
2. docs/superpowers/specs/2026-08-08-platform-concept-v2-design.md  (spec — revision blocks at
   the top override the body)
3. docs/mockups/concept-v2-2026-08-08.html  (v8 mock — layout/anatomy contract only; its
   content is illustrative, see handoff §5)

The concept is SETTLED — do not re-litigate it. Start with Phase 1 (the composer v8) from
handoff §4: plan it, build it behind a flag, and verify signed-in in a real browser at mobile
and desktop sizes before proposing a PR. Gates before any push: tsc --noEmit, npm run build,
tests. No corpus multiplier numbers anywhere. Accent dosage stays locked. Ask the owner before
any scope the handoff marks as an open call.
```
