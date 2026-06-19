---
phase: 09-living-audience-interactive-simulation-ux
artifact: gaps-summary
closes: [LIVE-03, LIVE-06, LIVE-07]
verified_against: 09-VERIFICATION.md
date: 2026-06-19
status: gaps_closed
---

# Phase 9 — Gap Closure Summary (Wiring-Level Fixes)

Closed the 3 wiring-level gaps from `09-VERIFICATION.md`. No new components — every
part (AudienceLens, PersonaChatDrawer, ClusterView, CHAIN_HANDOFFS, RewriteCta, chat
route + runner, flat-card-reactions) already existed. The gaps were all at the
connection layer: surfaces never wired a groundable persona + concept together, and
never supplied the `rewrite` descriptor. These fixes connect them.

## Proof

| Check | Command | Result |
|-------|---------|--------|
| Phase test suites | `npx vitest run src/components/audience-lens src/components/reading/__tests__/persona-cloud.test.tsx src/components/thread src/lib/tools/runners/__tests__/chat-runner.test.ts src/lib/tools/__tests__/chain-handoff.test.ts` | **PASS (61) FAIL (0)** — exit 0 (was 49; +12 new regression tests) |
| Production build | `npm run build` | **Compiled successfully**, TypeScript passed — exit 0 |
| Determinism gate | `grep Math.random\|Date.now src/components/audience-lens/*` | CLEAN (no executable matches) |
| Lint (changed files) | `npx eslint <changed>` | No issues found |

## Gap 1 — LIVE-03 chat-with-persona reachability

### 1(a) Video Test surface — `reading-panels.tsx`
The rich-signal video surface already opens `<AudienceLens>` with real registry-enum
archetype nodes + heatmap, but omitted `conceptText`, so the chat list + drawer were
gated off (`conceptText && chatList.length > 0`).

**Wired:** added `readingConceptText(data)` — derives the concept the room reacted to
**honestly** from the real engine `verbatim` (hook spoken + on-screen text; falls back to
the first segment's verbatim). Returns `undefined` when no verbatim exists → chat stays
gated (honest: no concept to ground). Passed as `conceptText` into the video-Test
`<AudienceLens>` mount. With the existing real-enum archetype nodes, the
"Ask them why →" rows now mount and `PersonaChatDrawer` is reachable.

- File: `src/components/reading/reading-panels.tsx`
- Commit: `e3f1a8e4` (auto-wip file-watcher captured the UI edit mid-session)

### 1(b) Text-Read PersonasBlock — `message-blocks.tsx` (also closes Gap 3)
The generic renderer did `<Component block={block} />` and never threaded `conceptText`,
so `PersonasBlockRenderer`'s `conceptText` prop was always `undefined` → its `LensTrigger`
branch (the one surface passing BOTH real enum archetypes AND conceptText) never activated.

**Wired:** `MessageBlocks` now accepts an optional `conceptText` prop and threads it into
the `personas` renderer. Added an **in-band fallback** — when no explicit prop is supplied,
the concept is derived from a co-located `markdown` block in the SAME message body (the
concept the personas reacted to in that turn). Honest, never fabricated. Every other block
renderer is still invoked byte-identically (`<Component block={block} />`).

- File: `src/components/thread/message-blocks.tsx`
- Commits: `e3f1a8e4` (initial thread) + `59a6cb0a` (defensive `props: unknown` read — build-fix)

### Text cards (idea/hook/script/remix) — left honestly chat-less
Per the CR-01 design, the 4 text cards carry no registry-enum archetype (only `viewer_N`
placeholders + display labels like "Stops the skeptic", which are NOT registry enums). They
already pass `conceptText` but supplying a non-enum `leadArchetype` would silently break the
chat route. So they remain chat-gated by design — documented, not a gap. (The hook card's
`audienceArchetype` is explicitly a display label, never passed as the grounding enum.)

## Gap 2 — LIVE-07 Rewrite-for-audience loop reachability

`RewriteCta` renders on `rewrite && hasReaction`, but the `rewrite: LensRewrite` prop was
supplied by ZERO mount sites → the sticky CTA never rendered, the flywheel never closed.

**Wired:** new pure builder `src/components/audience-lens/card-rewrite.ts` →
`buildCardRewrite({ skill, fraction, scrollQuote, conceptText, platform, leverRidesAnchor? })`:
- **endpoint** sourced from `handoffsFor(skill)` self-handoff (from===to,
  "Rewrite for this audience →") — the CHAIN_HANDOFFS SSOT, never hard-coded.
- **priorStopCount/priorTotal** parsed from the card's REAL `fraction` (e.g. "6/10 stop").
- **lever** = the audience's REAL verbatim (the lead `scrollQuote`), never fabricated.
- **onRewrite** re-POSTs to the originating runner with the pinned `{ ask?, anchor?, platform }`
  contract (lever → `ask`, concept → `anchor`); the runner persists the regenerated card + Read
  into the SAME open thread server-side, so the new card surfaces through the **existing**
  thread stream. No new pipeline invented. Returns `null` for the delta (no fabricated
  before/after number from an unparsed SSE stream — the regenerated card is the honest result).

Supplied as `rewrite={buildCardRewrite(...)}` at all 4 regenerable card surfaces:

| Surface | skill | endpoint (self-handoff) | lever ride |
|---------|-------|-------------------------|-----------|
| `idea-card-block.tsx` | `idea` | `/api/tools/ideas` | `ask` |
| `hook-card-block.tsx` | `hooks` | `/api/tools/hooks` | `ask` |
| `script-card-block.tsx` | `script` | `/api/tools/script` | `ask` |
| `remix-card-block.tsx` | `remix` | `/api/tools/ideas/develop` | folded into `anchor` (A2: develop route is anchor-only) |

Since `RewriteCta` gates on `hasReaction` (not on the chat/archetype gate), the sticky CTA
now renders on all 4 text cards (each has flat personas). The Rewrite loop is reachable.

**Treatment note (per constraint):** the `onRewrite` fires the **real re-POST** to the real
runner (functional, not a dead stub) and reuses the existing endpoint/streaming pipeline. The
synchronous in-Lens delta readout returns `null` rather than parsing the SSE stream inline —
surfacing the new card via the thread stream was the in-reach path; a synchronous delta parse
would require lifting each skill's stream consumer into context (architectural, out of scope
for a wiring fix). The CTA is fully functional; only the optional before/after number is deferred.

- File: `src/components/audience-lens/card-rewrite.ts` (new), 4 card blocks
- Commit: `e3f1a8e4`

### Video Test surface — no Rewrite (honest)
The video Reading surface has no skill-chain origin and no regenerable concept-card to
re-POST into a thread (it carries a heatmap timeline, not a generated card). Matching the
existing "no Read block" treatment, it correctly receives no `rewrite` descriptor.

## Gap 3 — LIVE-06 text-Read retrofit

Same root cause as Gap 1(b). Fixed by the `MessageBlocks → PersonasBlockRenderer` conceptText
threading — the text-Read PersonasBlock now mounts the reusable AudienceLens (cloud / cluster /
Population / cascade + chat when groundable). Verified by `message-blocks-concept.test.tsx`.

## Regression tests added (+12)

| File | Locks |
|------|-------|
| `src/components/audience-lens/__tests__/lens-chat-gate.test.tsx` | "Ask them why →" mounts iff conceptText + registry-enum archetype both present; stays gated when either is absent (the exact Gap-1 root cause). 3 tests. |
| `src/components/audience-lens/__tests__/card-rewrite.test.ts` | per-skill endpoint from self-handoff SSOT; prior counts parsed from real fraction; `onRewrite` re-POSTs the pinned payload (ask vs anchor-fold); undefined on unparseable fraction; null on non-ok. 5 tests. |
| `src/components/thread/__tests__/message-blocks-concept.test.tsx` | explicit + in-band conceptText threads to personas renderer → Lens cue mounts; no concept → no cue (byte-identical); non-personas renderers unaffected. 4 tests. |

## Honesty / determinism / regression invariants held

- Non-persona open chat path: untouched (byte-identical).
- Deterministic math core (lens-derive) + swarm: untouched.
- No executable `Math.random` / `Date.now` in lens/swarm/card-rewrite paths.
- Counters remain the weighted rollup of the real 10; no fabricated persona reactions or
  concept text anywhere (verbatim-sourced or honestly absent → gated off).
- Existing block renderers render byte-identically when the new optional props are absent.
- Commits used the project hooks (no `--no-verify`).

## Commit map

| Commit | Scope |
|--------|-------|
| `e3f1a8e4` | UI wiring: card-rewrite.ts (new), reading-panels.tsx (1a), message-blocks.tsx (1b initial), 4 card blocks (Gap 2) — captured by the repo's auto-wip file-watcher |
| `438b8460` | 3 regression test files — auto-wip captured |
| `59a6cb0a` | `fix(09):` message-blocks.tsx defensive props read (build-fix) + final threading |

> Note: the repo runs an external auto-wip file-watcher that committed the in-flight UI +
> test edits under `chore(auto-wip)` messages before they could be grouped into per-gap
> `fix(09):` commits. The work is intact in history; this summary provides the gap→commit
> mapping. The final delta was committed with the prescribed `fix(09):` message.

## Self-Check: PASSED

- `src/components/audience-lens/card-rewrite.ts` — FOUND (committed `e3f1a8e4`)
- `src/components/reading/reading-panels.tsx` `readingConceptText` — FOUND
- `src/components/thread/message-blocks.tsx` conceptText threading — FOUND (committed `59a6cb0a`)
- 4 card blocks `buildCardRewrite` wiring — FOUND (committed `e3f1a8e4`)
- 3 regression test files — FOUND (committed `438b8460`)
- vitest 61/0, build exit 0 — VERIFIED
