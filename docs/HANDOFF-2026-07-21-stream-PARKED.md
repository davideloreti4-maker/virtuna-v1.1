# HANDOFF — THE STREAM: **PARKED** (2026-07-21)

> **Decision (owner, 2026-07-21):** stop the stream program. Do **not** migrate skills onto
> the `composed` block. `main` is untouched; this branch (`feat/thread-cards`) stays as a
> documented, revertable exploration — **never merge it.** The next lane (polishing the *real*
> skill cards) starts from a **fresh worktree off `main`**, not from here.

## Why it was parked (the honest reason)

The stream's entire justification was the 2026-07 audit's finding — *"3 languages + 17
renderers, unify them into one."* Two pivots quietly dissolved that:

1. **Rev 8** ("frames aren't bad") already retreated from the one-frame law.
2. **Rev 9** ("delegate to the real cards") was the fatal one: making the stream cards accurate
   meant rendering the **actual 17 shipped renderers** (the `test-verdict → VideoTestCardRenderer`
   pattern, generalized). So the stream does **not** kill the 17 renderers — it **wraps** them.
   The headline reason for the migration evaporated.

What the `composed` block genuinely added over the status quo turned out to be **narrow**: a
validated grammar so the **chat agent** could compose a richer answer. But:
- Skill cards already render in-thread (per-skill thread views + `MessageBlocks`).
- A chat message is **already** an array of blocks (`[markdown, hook-card]`) — "prose between
  cards" shipped long ago.
- Markdown covers prose/structure; skill-dispatch drops the real rich cards. The connective
  primitives sit in an awkward, low-value middle, and cost a whole second rendering path to keep.

Net: the migration was a lot of work to render cards we already render. Parked.

## Nothing in production was affected

No live skill emits a `composed` block — it existed only in `/dev/cards` fixtures + a spike
script. "Park" = don't merge, don't migrate, stop building. There is nothing to unwind in prod.

## What to KEEP (the salvage)

1. **The fidelity bar.** The `/dev/cards` "Card parity" section proved the **existing per-skill
   cards ARE the standard** — old renderer ‖ same card in the stream, pixel-identical (hooks,
   ideas, read, account, test), verified desktop + mobile.
2. **The per-card gap audit** (what a lossy rebuild *drops* — i.e. the features the real cards
   already have and must never lose): for the ranked/hook family — the archetype eyebrow, the
   grounded `ProofReceipt`, the mechanism teaser, the `ProofUnit` + Lens door **with its
   rewrite**, `population`, `NoSourceNote` (honest silence), the `· SIM-1 Flash` model tag,
   **Save**, and the forward-chain action. For Read — TrustBadge, VerbatimWall, the audience-
   removed fallback, Save + provenance footer. For Account — the scrape profile header, analyzed-
   post cover strip, working/fix columns, the recurring-hooks/format-mix/drop-points disclosure,
   the accuracy track record. Use this as the checklist if any real card is ever refactored.

## What "continue working on the real skill cards" means

The pre-stream direction: **rework Explore · Account Read · Text Read on the REAL renderers** —
`docs/HANDOFF-2026-07-19-read-family-cards.md` (on `main`). The stream was a detour from that.

- **Base:** fresh worktree off `main` — `git worktree add ~/virtuna-skill-cards -b design/skill-cards main`.
- **Do NOT** branch off `feat/thread-cards` (it carries the parked stream).
- Real card renderers live at `src/components/thread/{hook,idea,script,remix,account-read,
  multi-audience-read,video-test-card}-*.tsx`; the full Reading page is `src/components/reading/reading.tsx`.
- `/dev/cards` (on `main`) is the live gallery of every real card — the place to iterate.

## The stream work, if ever revived (map, not a plan)

On `feat/thread-cards`, tip `4365822d`:
- `src/lib/tools/stream-primitives.ts` — 21-primitive vocabulary (17 generic + 4 delegated skill cards).
- `src/components/thread/composed-{block,cards,shared}.tsx` — dispatch + renderers.
- `src/lib/tools/__tests__/fixtures/stream-composition.ts` — the all-21 canonical fixture.
- `src/app/(app)/dev/cards/page.tsx` — the "Card parity" section.
- Tests green at park: tsc 0, thread+tools 624/624.
- If revived, the only defensible scope is a **minimal chat-answer composer** (connective
  primitives + delegation), **never** the full skill migration.
